"""
Mini-Wireshark: Motor de Captura Scapy y Transformación al Modelo OSI
Fase 1 - Especificación: /specs/01-motor-captura-osi.md
Contrato: /PROJECT_CONTEXT.md
"""

import datetime
import io
import re
import socket
import time
import xml.etree.ElementTree as ET
import zipfile
import zlib
from typing import Any, Dict, List, Optional, Tuple

import scapy.all as scapy
from scapy.layers.inet import ICMP, IP, TCP, UDP
from scapy.layers.inet6 import IPv6
from scapy.layers.l2 import ARP, Ether


def sanitize_ascii(data: bytes, max_bytes: int = 16384) -> str:
    """
    Convierte bytes a representación ASCII segura cumpliendo la Regla 10 (32 <= ord <= 126).
    Preserva caracteres imprimibles (32-126).
    Convierte saltos de línea (\\n, \\r) y tabulaciones (\\t) a espacios (32) para mantener
    la legibilidad de documentos y cabeceras HTTP sin truncar artificialmente el contenido.
    """
    if not data:
        return ""
    chunk = data[:max_bytes]
    result = []
    for b in chunk:
        if 32 <= b <= 126:
            result.append(chr(b))
        elif b in (10, 13, 9):
            result.append(" ")
        else:
            result.append(".")
    return "".join(result)


def _clean_utf8_text(raw: bytes, max_bytes: int = 16384) -> str:
    chunk = raw[:max_bytes]
    decoded = chunk.decode("utf-8", errors="replace").replace("\r\n", "\n").replace("\r", "\n")
    cleaned = []
    for ch in decoded:
        code = ord(ch)
        if ch in ("\n", "\t") or (32 <= code <= 126) or (160 <= code <= 55295):
            cleaned.append(ch)
        else:
            cleaned.append(".")
    return "".join(cleaned)


def _extract_docx_readable_summary(body_bytes: bytes) -> Optional[str]:
    """Si los bytes corresponden a un contenedor .docx (ZIP/OOXML), extrae el texto real de word/document.xml."""
    if not body_bytes.startswith(b"PK\x03\x04"):
        return None
    try:
        with zipfile.ZipFile(io.BytesIO(body_bytes)) as zf:
            names = zf.namelist()
            if "word/document.xml" not in names:
                return f"[Contenedor ZIP detectado ({len(body_bytes)} bytes) — Archivos: {', '.join(names[:10])}]"
            xml_bytes = zf.read("word/document.xml")
            root = ET.fromstring(xml_bytes)
            paragraphs: List[str] = []
            for elem in root.iter():
                if elem.tag.endswith("}p") or elem.tag == "w:p":
                    parts: List[str] = []
                    for child in elem.iter():
                        if (child.tag.endswith("}t") or child.tag == "w:t") and child.text:
                            parts.append(child.text)
                        elif child.tag.endswith("}tab") or child.tag == "w:tab":
                            parts.append("\t")
                        elif child.tag.endswith("}br") or child.tag == "w:br":
                            parts.append("\n")
                    para_text = "".join(parts).strip()
                    if para_text:
                        paragraphs.append(para_text)
            doc_text = "\n".join(paragraphs) if paragraphs else "(Documento Word sin párrafos de texto plano)"
            return (
                f"=== TEXTO REAL EXTRAÍDO DEL DOCUMENTO WORD (.DOCX · {len(body_bytes)} bytes) ===\n"
                f"{doc_text}\n\n"
                f"=== ESTRUCTURA INTERNA OOXML (ZIP) ===\n"
                f"Entradas: {', '.join(names[:8])}"
            )
    except Exception:
        return None


def _extract_pdf_readable_summary(body_bytes: bytes) -> Optional[str]:
    """Si los bytes corresponden a un documento .pdf (%PDF-), extrae metadatos y cadenas de texto legibles."""
    if not body_bytes.startswith(b"%PDF-"):
        return None
    try:
        first_line = body_bytes.split(b"\n", 1)[0].split(b"\r", 1)[0].decode("ascii", errors="ignore")
        meta_items: List[str] = []
        for field in (b"Title", b"Author", b"Subject", b"Creator", b"Producer", b"CreationDate"):
            m = re.search(rb"/" + field + rb"\s*\(([^)]{1,200})\)", body_bytes)
            if m:
                val = m.group(1).decode("latin-1", errors="ignore").strip()
                if val:
                    meta_items.append(f"{field.decode('ascii')}: {val}")

        # Extraer texto de streams comprimidos FlateDecode y cadenas literales
        extracted_fragments: List[str] = []
        for sm in re.finditer(rb"stream\r?\n(.*?)\r?\nendstream", body_bytes[:262144], re.DOTALL):
            raw_stream = sm.group(1)
            try:
                decomp = zlib.decompress(raw_stream)
            except Exception:
                continue
            # Buscar cadenas entre paréntesis en operadores Tj/TJ
            for txt_m in re.finditer(rb"\(([^()\\]{2,200})\)", decomp):
                s = txt_m.group(1).decode("latin-1", errors="ignore").strip()
                if sum(1 for c in s if c.isalnum() or c in " áéíóúÁÉÍÓÚñÑ.,-:") >= max(2, int(len(s) * 0.7)):
                    if s not in extracted_fragments:
                        extracted_fragments.append(s)
            if len(extracted_fragments) >= 40:
                break

        # Fuentes o metadatos adicionales visibles en el PDF
        fonts = []
        for fm in re.finditer(rb"/BaseFont\s*/([A-Za-z0-9+_-]+)", body_bytes[:131072]):
            fname = fm.group(1).decode("ascii", errors="ignore")
            if fname and fname not in fonts:
                fonts.append(fname)

        lines = [
            f"=== DOCUMENTO PDF DETECTADO EN CAPA 7 ({first_line} · {len(body_bytes)} bytes) ==="
        ]
        if meta_items:
            lines.append("Metadatos PDF: " + " | ".join(meta_items))
        if fonts:
            lines.append("Tipografías embebidas: " + ", ".join(fonts[:8]))
        if extracted_fragments:
            lines.append("\nTexto extraído de los objetos del PDF:")
            lines.append(" ".join(extracted_fragments[:40]))
        else:
            # Mostrar las primeras cadenas ASCII legibles de la estructura de objetos del PDF
            ascii_strings = [
                m.group(0).decode("ascii", errors="ignore").strip()
                for m in re.finditer(rb"[A-Za-z0-9/\-_.,:() ]{6,120}", body_bytes[:8192])
            ]
            clean_strs = [s for s in ascii_strings if any(k in s for k in ("PDF", "Obj", "Type", "Page", "Font", "Filter", "Length"))][:15]
            if clean_strs:
                lines.append("\nObjetos estructurales del PDF en el paquete:")
                lines.extend(clean_strs)

        return "\n".join(lines)
    except Exception:
        return None


def extract_readable_text(data: bytes, max_bytes: int = 16384) -> str:
    """
    Extrae texto legible en UTF-8 / ASCII preservando saltos de línea (\\n), tabulaciones y
    caracteres acentuados para que el usuario pueda leer documentos (.txt, .docx, .pdf, .html, .json, .csv)
    y cabeceras HTTP íntegramente en el Inspector Visual.
    """
    if not data:
        return ""

    # Si es una respuesta HTTP con cabeceras + cuerpo de archivo (.txt, .docx, .pdf, .html)
    if data.startswith(b"HTTP/") and b"\r\n\r\n" in data:
        hdr_bytes, body_bytes = data.split(b"\r\n\r\n", 1)
        hdr_text = _clean_utf8_text(hdr_bytes, max_bytes=4096)
        if body_bytes:
            docx_summary = _extract_docx_readable_summary(body_bytes)
            if docx_summary:
                return f"{hdr_text}\n\n{docx_summary}"
            pdf_summary = _extract_pdf_readable_summary(body_bytes)
            if pdf_summary:
                return f"{hdr_text}\n\n{pdf_summary}"
            body_text = _clean_utf8_text(body_bytes, max_bytes=max_bytes)
            return f"{hdr_text}\n\n{body_text}"
        return hdr_text

    # Si el segmento empieza directamente con un contenedor .docx o .pdf
    docx_direct = _extract_docx_readable_summary(data)
    if docx_direct:
        return docx_direct
    pdf_direct = _extract_pdf_readable_summary(data)
    if pdf_direct:
        return pdf_direct

    return _clean_utf8_text(data, max_bytes=max_bytes)


def format_hex_dump(data: bytes, max_bytes: int = 16384) -> str:
    """Convierte bytes a formato hexadecimal completo con pares separados por espacio."""
    if not data:
        return ""
    chunk = data[:max_bytes]
    return " ".join(f"{b:02x}" for b in chunk)


def format_mac(mac_str: Optional[str]) -> str:
    """Normaliza direcciones MAC al formato XX:XX:XX:XX:XX:XX en mayúsculas."""
    if not mac_str or not isinstance(mac_str, str):
        return "00:00:00:00:00:00"
    cleaned = mac_str.strip().replace("-", ":").upper()
    parts = cleaned.split(":")
    if len(parts) == 6:
        try:
            return ":".join(f"{int(p, 16):02X}" for p in parts)
        except ValueError:
            pass
    if re.match(r"^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$", cleaned):
        return cleaned.replace("-", ":")
    return "00:00:00:00:00:00"


def format_ethertype(type_val: Optional[int]) -> Tuple[str, str]:
    """Devuelve (ethertype_hex, ethertype_name)."""
    if type_val is None:
        return ("0x0800", "IPv4")
    hex_str = f"0x{type_val:04x}"
    names = {
        0x0800: "IPv4",
        0x0806: "ARP",
        0x86DD: "IPv6",
    }
    return (hex_str, names.get(type_val, f"Unknown ({hex_str})"))


HTTP_COMMON_PORTS = {80, 8000, 8080, 8008, 8081, 8888, 3000, 5000, 9000}
HTTPS_COMMON_PORTS = {443, 8443}
HTTP_SIGNATURE_PREFIXES = (
    b"GET ",
    b"POST ",
    b"PUT ",
    b"DELETE ",
    b"HEAD ",
    b"OPTIONS ",
    b"PATCH ",
    b"HTTP/1.",
    b"HTTP/2",
)


def infer_l7_protocol(
    src_port: Optional[int], dst_port: Optional[int], payload: bytes, l4_proto: str
) -> str:
    """Infiere el protocolo de Capa 7 a partir de puertos o contenido real del payload."""
    ports = {src_port, dst_port}
    if ports & HTTPS_COMMON_PORTS:
        return "HTTPS/TLS"
    if 53 in ports:
        return "DNS"
    if 22 in ports:
        return "SSH"

    if payload:
        sample = payload[:64]
        if any(sample.startswith(prefix) for prefix in HTTP_SIGNATURE_PREFIXES):
            return "HTTP"
        header_window = payload[:512]
        if any(
            hdr in header_window
            for hdr in (
                b"HTTP/1.",
                b"Host: ",
                b"Content-Type:",
                b"Content-type:",
                b"Content-Length:",
                b"Server: SimpleHTTP",
                b"User-Agent:",
            )
        ):
            return "HTTP"

    if ports & HTTP_COMMON_PORTS:
        return "HTTP"

    if l4_proto == "ICMP":
        return "ICMP Data"
    if l4_proto == "NONE":
        return "ARP Payload"

    return "RAW" if payload else "No Payload"


def parse_tcp_flags(flags_val: Any) -> Optional[str]:
    """Convierte banderas de Scapy TCP a cadena legible formateada."""
    if flags_val is None:
        return None
    flag_str = str(flags_val).strip()
    active = []
    if "S" in flag_str:
        active.append("SYN")
    if "A" in flag_str:
        active.append("ACK")
    if "F" in flag_str:
        active.append("FIN")
    if "R" in flag_str:
        active.append("RST")
    if "P" in flag_str:
        active.append("PSH")
    if "U" in flag_str:
        active.append("URG")

    return ", ".join(active) if active else (flag_str if flag_str else None)


def parse_icmp_flags(icmp_layer: ICMP) -> str:
    """Genera descripción legible del tipo y código ICMP."""
    t = getattr(icmp_layer, "type", 0)
    c = getattr(icmp_layer, "code", 0)
    types_map = {
        0: "Echo Reply",
        3: "Destination Unreachable",
        5: "Redirect",
        8: "Echo Request",
        11: "Time Exceeded",
    }
    desc = types_map.get(t, f"Type {t}")
    return f"{desc} (Type {t}, Code {c})"


def _extract_transport_payload_bytes(pkt: Any) -> bytes:
    """
    Extrae los bytes crudos de Capa 7 tanto si Scapy los deja en Raw como si
    disecta una capa superior (por ejemplo DNS o HTTP).
    """
    if pkt.haslayer(scapy.Raw):
        return bytes(pkt[scapy.Raw].load)

    for transport_cls in (TCP, UDP, ICMP):
        if pkt.haslayer(transport_cls):
            layer_payload = pkt[transport_cls].payload
            if (
                layer_payload is not None
                and not isinstance(layer_payload, scapy.NoPayload)
                and not isinstance(layer_payload, scapy.Padding)
            ):
                try:
                    return bytes(layer_payload)
                except Exception:
                    pass

    return b""


def parse_scapy_packet(
    pkt: Any,
    packet_id: int,
    start_time: float,
    mode: str = "real",
    iface_meta: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Transforma un paquete Scapy nativo al Contrato Global JSON CapturedPacket.
    Cumple rigurosamente con los 10 criterios de validación de Spec01CaptureTest.tsx
    y soporta tramas Ethernet II, Loopback y sockets L3 nativos.
    """
    now = datetime.datetime.now(datetime.timezone.utc)
    timestamp = now.isoformat()
    relative_time = max(0.0, round(time.time() - start_time, 3))
    payload_bytes_early = _extract_transport_payload_bytes(pkt)
    try:
        total_length = len(pkt) if hasattr(pkt, "__len__") else (len(payload_bytes_early) + 54)
    except Exception:
        total_length = len(payload_bytes_early) + 54

    # 1. Capa 3 - Red (evaluada primero para auxiliar inferencia de Capa 2 en Loopback/L3)
    src_ip = "0.0.0.0"
    dst_ip = "0.0.0.0"
    ttl: Optional[int] = None
    protocol_id: Optional[int] = None
    l3_protocol = "IPv4"

    if pkt.haslayer(IP):
        ip = pkt[IP]
        src_ip = str(ip.src) if getattr(ip, "src", None) else "0.0.0.0"
        dst_ip = str(ip.dst) if getattr(ip, "dst", None) else "0.0.0.0"
        ttl_val = getattr(ip, "ttl", None)
        ttl = max(1, min(255, int(ttl_val))) if ttl_val is not None else 64
        protocol_id = int(ip.proto) if getattr(ip, "proto", None) is not None else 6
        l3_protocol = "IPv4"
        ip_len = getattr(ip, "len", None)
        if ip_len is not None:
            total_length = max(total_length, int(ip_len))
    elif pkt.haslayer(IPv6):
        ip6 = pkt[IPv6]
        src_ip = str(ip6.src) if getattr(ip6, "src", None) else "::1"
        dst_ip = str(ip6.dst) if getattr(ip6, "dst", None) else "::1"
        hlim_val = getattr(ip6, "hlim", None)
        ttl = max(1, min(255, int(hlim_val))) if hlim_val is not None else 64
        protocol_id = int(ip6.nh) if getattr(ip6, "nh", None) is not None else 6
        l3_protocol = "IPv6"
        plen = getattr(ip6, "plen", None)
        if plen is not None:
            total_length = max(total_length, int(plen) + 40)
    elif pkt.haslayer(ARP):
        arp = pkt[ARP]
        src_ip = str(arp.psrc) if getattr(arp, "psrc", None) else "0.0.0.0"
        dst_ip = str(arp.pdst) if getattr(arp, "pdst", None) else "0.0.0.0"
        ttl = None
        protocol_id = None
        l3_protocol = "ARP"

    # 2. Capa 2 - Enlace de Datos
    is_loopback_pkt = (
        src_ip in ("127.0.0.1", "::1")
        or dst_ip in ("127.0.0.1", "::1")
        or bool(iface_meta and iface_meta.get("is_loopback"))
    )

    if pkt.haslayer(Ether):
        eth = pkt[Ether]
        src_mac = format_mac(getattr(eth, "src", None))
        dst_mac = format_mac(getattr(eth, "dst", None))
        ethertype_hex, ethertype_name = format_ethertype(getattr(eth, "type", 0x0800))
        l2_proto = "Ethernet II"
    elif pkt.haslayer(ARP):
        arp = pkt[ARP]
        src_mac = format_mac(getattr(arp, "hwsrc", None))
        dst_mac = format_mac(getattr(arp, "hwdst", None))
        ethertype_hex = "0x0806"
        ethertype_name = "ARP"
        l2_proto = "Ethernet II"
    else:
        # Paquete capturado en interfaz Loopback o socket L3 nativo del sistema operativo
        if l3_protocol == "IPv6":
            ethertype_hex, ethertype_name = ("0x86dd", "IPv6")
        else:
            ethertype_hex, ethertype_name = ("0x0800", "IPv4")

        if is_loopback_pkt:
            src_mac = "00:00:00:00:00:00"
            dst_mac = "00:00:00:00:00:00"
            l2_proto = "Loopback"
        else:
            iface_mac = format_mac(iface_meta.get("mac")) if iface_meta else "00:00:00:00:00:00"
            iface_ip = iface_meta.get("ip") if iface_meta else None
            if iface_ip and src_ip == iface_ip:
                src_mac = iface_mac
                dst_mac = "FF:FF:FF:FF:FF:FF" if dst_ip.endswith(".255") else "00:00:00:00:00:00"
            elif iface_ip and dst_ip == iface_ip:
                src_mac = "00:00:00:00:00:00"
                dst_mac = iface_mac
            else:
                src_mac = iface_mac
                dst_mac = "00:00:00:00:00:00"
            l2_proto = "Ethernet II"

    layer2 = {
        "protocol": l2_proto,
        "src_mac": src_mac,
        "dst_mac": dst_mac,
        "ethertype": ethertype_hex,
        "ethertype_name": ethertype_name,
    }

    layer3 = {
        "protocol": l3_protocol,
        "src_ip": src_ip,
        "dst_ip": dst_ip,
        "ttl": ttl,
        "length": max(1, total_length),
        "protocol_id": protocol_id,
    }

    # 3. Capa 4 - Transporte
    l4_proto: str = "NONE"
    src_port: Optional[int] = None
    dst_port: Optional[int] = None
    flags: Optional[str] = None
    checksum: Optional[str] = None
    seq_num: Optional[int] = None
    ack_num: Optional[int] = None

    if pkt.haslayer(TCP):
        tcp = pkt[TCP]
        l4_proto = "TCP"
        src_port = int(tcp.sport)
        dst_port = int(tcp.dport)
        flags = parse_tcp_flags(tcp.flags)
        checksum = (
            f"0x{int(tcp.chksum):04x}"
            if hasattr(tcp, "chksum") and tcp.chksum is not None
            else "0x0000"
        )
        seq_num = int(tcp.seq) if hasattr(tcp, "seq") else None
        ack_num = int(tcp.ack) if hasattr(tcp, "ack") else None
    elif pkt.haslayer(UDP):
        udp = pkt[UDP]
        l4_proto = "UDP"
        src_port = int(udp.sport)
        dst_port = int(udp.dport)
        flags = None
        checksum = (
            f"0x{int(udp.chksum):04x}"
            if hasattr(udp, "chksum") and udp.chksum is not None
            else "0x0000"
        )
    elif pkt.haslayer(ICMP):
        icmp = pkt[ICMP]
        l4_proto = "ICMP"
        src_port = None
        dst_port = None
        flags = parse_icmp_flags(icmp)
        checksum = (
            f"0x{int(icmp.chksum):04x}"
            if hasattr(icmp, "chksum") and icmp.chksum is not None
            else "0x0000"
        )
    elif l3_protocol == "ARP":
        l4_proto = "NONE"

    if l4_proto != "NONE":
        layer4 = {
            "protocol": l4_proto,
            "src_port": src_port,
            "dst_port": dst_port,
            "flags": flags,
            "checksum": checksum,
            "seq_num": seq_num,
            "ack_num": ack_num,
        }
    else:
        layer4 = {
            "protocol": "NONE",
            "src_port": None,
            "dst_port": None,
            "flags": None,
            "checksum": None,
        }

    # 4. Capa 7 - Aplicación y Payload
    payload_bytes = _extract_transport_payload_bytes(pkt)
    payload_size = len(payload_bytes)
    protocol_hint = infer_l7_protocol(src_port, dst_port, payload_bytes, l4_proto)

    hex_dump = format_hex_dump(payload_bytes) if payload_size > 0 else ""
    ascii_preview = sanitize_ascii(payload_bytes) if payload_size > 0 else ""
    readable_text = extract_readable_text(payload_bytes) if payload_size > 0 else ""

    layer7 = {
        "protocol_hint": protocol_hint,
        "payload_size": payload_size,
        "hex_dump": hex_dump,
        "ascii_preview": ascii_preview,
        "readable_text": readable_text,
    }

    # Resumen rápido y clasificación de alto nivel
    summary_proto = "OTHER"
    if protocol_hint in ["HTTP", "HTTPS", "DNS"]:
        summary_proto = protocol_hint
    elif protocol_hint.startswith("HTTPS"):
        summary_proto = "HTTPS"
    elif l4_proto in ["TCP", "UDP", "ICMP"]:
        summary_proto = l4_proto
    elif l3_protocol == "ARP":
        summary_proto = "ARP"

    if l4_proto == "TCP":
        payload_summary = ""
        if payload_bytes:
            sep = b"\r\n" if b"\r\n" in payload_bytes else b"\n"
            first_line = payload_bytes.split(sep)[0]
            clean_first = sanitize_ascii(first_line[:140]).strip()
            if clean_first:
                payload_summary = f" {clean_first}"
        info = f"{src_port} → {dst_port} [{flags or 'TCP'}]{payload_summary} Seq={seq_num or 0} Len={payload_size}"
    elif l4_proto == "UDP":
        info = f"{src_port} → {dst_port} Len={payload_size}"
    elif l4_proto == "ICMP":
        info = f"{flags or 'ICMP'} Len={payload_size}"
    elif l3_protocol == "ARP":
        info = f"Who has {dst_ip}? Tell {src_ip}"
    else:
        info = f"{l3_protocol} Packet Len={layer3['length']}"

    return {
        "id": packet_id,
        "timestamp": timestamp,
        "relative_time": relative_time,
        "captured_mode": mode,
        "summary": {
            "src_ip": src_ip,
            "dst_ip": dst_ip,
            "protocol": summary_proto,
            "length": layer3["length"],
            "info": info,
        },
        "osi_layers": {
            "layer2_datalink": layer2,
            "layer3_network": layer3,
            "layer4_transport": layer4,
            "layer7_application": layer7,
        },
    }


# =====================================================================
# DESCUBRIMIENTO DE INTERFACES DE RED REALES (SCAPY)
# =====================================================================

_FILTER_NOISE_KEYWORDS = (
    "lightweight filter",
    "packet scheduler",
    "native wifi filter",
    "virtual wifi filter",
    "wan miniport",
    "teredo",
    "6to4",
    "ip-https",
    "kernel debug",
)


def list_network_interfaces() -> Dict[str, Any]:
    """
    Enumera las interfaces de red reales detectadas por Scapy en el sistema operativo,
    identificando la interfaz activa predeterminada (Wi-Fi / Ethernet) y el adaptador Loopback.
    """
    interfaces: List[Dict[str, Any]] = []
    default_iface_obj = getattr(scapy.conf, "iface", None)
    default_name = getattr(default_iface_obj, "name", str(default_iface_obj)) if default_iface_obj else ""
    seen_names = set()

    try:
        for _, iface_val in scapy.conf.ifaces.items():
            name = str(getattr(iface_val, "name", str(iface_val))).strip()
            desc = str(getattr(iface_val, "description", name)).strip()
            ip = str(getattr(iface_val, "ip", "") or "").strip()
            mac_raw = str(getattr(iface_val, "mac", "") or "").strip()

            if not name or name in seen_names:
                continue

            lower_desc = f"{name} {desc}".lower()
            if any(noise in lower_desc for noise in _FILTER_NOISE_KEYWORDS):
                continue

            is_loopback = (
                ip == "127.0.0.1"
                or "loopback" in lower_desc
                or name.lower() in ("lo", "lo0")
            )
            if is_loopback and not ip:
                ip = "127.0.0.1"

            is_default = (iface_val == default_iface_obj) or (name == default_name)

            # Descartar adaptadores desconectados sin IP excepto el predeterminado o Loopback
            if not ip and not is_default and not is_loopback:
                continue

            seen_names.add(name)
            mac = format_mac(mac_raw) if mac_raw else "00:00:00:00:00:00"
            is_apipa = ip.startswith("169.254.")

            if is_loopback:
                label = f"Loopback ({ip}) · {desc}"
            elif ip:
                label = f"{name} ({ip}) · {desc}"
            else:
                label = f"{name} · {desc}"

            interfaces.append(
                {
                    "id": name,
                    "name": name,
                    "description": desc,
                    "ip": ip or "0.0.0.0",
                    "mac": mac,
                    "is_default": bool(is_default and not is_apipa),
                    "is_loopback": is_loopback,
                    "is_apipa": is_apipa,
                    "label": label,
                }
            )
    except Exception:
        pass

    # Ordenar: 1) Default activo, 2) Interfaces con IP LAN real (no APIPA), 3) Loopback, 4) Resto
    def _sort_key(item: Dict[str, Any]):
        if item["is_default"]:
            return (0, item["name"])
        if not item["is_loopback"] and not item["is_apipa"] and item["ip"] != "0.0.0.0":
            return (1, item["name"])
        if item["is_loopback"]:
            return (2, item["name"])
        return (3, item["name"])

    interfaces.sort(key=_sort_key)

    # Si ninguna quedó marcada como default pero hay interfaces, marcar la primera
    if interfaces and not any(i["is_default"] for i in interfaces):
        interfaces[0]["is_default"] = True

    default_id = next((i["id"] for i in interfaces if i["is_default"]), None)
    return {
        "status": "ok",
        "default_interface": default_id,
        "pcap_available": bool(getattr(scapy.conf, "use_pcap", False)),
        "interfaces": interfaces,
    }


def resolve_interface_metadata(iface_id: Optional[str]) -> Dict[str, Any]:
    """Devuelve metadatos (id, name, description, ip, mac, is_loopback, scapy_obj) de la interfaz solicitada."""
    catalog = list_network_interfaces()
    interfaces = catalog.get("interfaces", [])

    selected: Optional[Dict[str, Any]] = None
    if iface_id and iface_id not in ("auto", "Default Interface", "eth0 (Simulated)"):
        target = iface_id.strip().lower()
        for item in interfaces:
            if (
                item["id"].lower() == target
                or item["name"].lower() == target
                or item["description"].lower() == target
                or item["ip"].lower() == target
                or (target == "loopback" and item["is_loopback"])
            ):
                selected = item
                break

    if not selected and interfaces:
        selected = next((i for i in interfaces if i["is_default"]), interfaces[0])

    if not selected:
        return {
            "id": iface_id or "Default Interface",
            "name": iface_id or "Default Interface",
            "description": iface_id or "Default Interface",
            "ip": "127.0.0.1",
            "mac": "00:00:00:00:00:00",
            "is_loopback": False,
            "label": iface_id or "Default Interface",
            "scapy_iface": None,
        }

    # Buscar objeto nativo en scapy.conf.ifaces para pasarlo a sniff/L3socket
    scapy_iface_obj = None
    try:
        for _, v in scapy.conf.ifaces.items():
            v_name = str(getattr(v, "name", "")).strip()
            v_desc = str(getattr(v, "description", "")).strip()
            if v_name == selected["name"] or v_desc == selected["description"]:
                scapy_iface_obj = v
                break
    except Exception:
        scapy_iface_obj = selected["name"]

    result = dict(selected)
    result["scapy_iface"] = scapy_iface_obj or selected["name"]
    return result


def get_default_active_interface() -> Tuple[Optional[str], str, str]:
    """Retorna (iface_id, display_label, ip_address) de la interfaz predeterminada."""
    meta = resolve_interface_metadata(None)
    return (meta["id"], meta["label"], meta["ip"])


class MockPacketGenerator:
    """Generador sintético de paquetes OSI exclusivamente para el modo 'mock' (Tráfico Simulado) y suites QA."""

    TEMPLATES = [
        "http_get",
        "https_handshake",
        "dns_query",
        "icmp_ping",
        "arp_request",
    ]

    def __init__(self):
        self.idx = 0

    def generate(self, packet_id: int, start_time: float) -> Dict[str, Any]:
        template = self.TEMPLATES[self.idx % len(self.TEMPLATES)]
        self.idx += 1
        now = datetime.datetime.now(datetime.timezone.utc)
        timestamp = now.isoformat()
        rel_time = max(0.0, round(time.time() - start_time, 3))

        if template == "http_get":
            raw_payload = b"GET /index.html HTTP/1.1\r\nHost: example.com\r\nUser-Agent: MiniWireshark/1.0\r\n\r\n"
            return {
                "id": packet_id,
                "timestamp": timestamp,
                "relative_time": rel_time,
                "captured_mode": "mock",
                "summary": {
                    "src_ip": "192.168.1.105",
                    "dst_ip": "93.184.216.34",
                    "protocol": "HTTP",
                    "length": len(raw_payload) + 54,
                    "info": "51842 → 80 [PSH, ACK] GET /index.html HTTP/1.1",
                },
                "osi_layers": {
                    "layer2_datalink": {
                        "protocol": "Ethernet II",
                        "src_mac": "00:1A:2B:3C:4D:5E",
                        "dst_mac": "AA:BB:CC:DD:EE:FF",
                        "ethertype": "0x0800",
                        "ethertype_name": "IPv4",
                    },
                    "layer3_network": {
                        "protocol": "IPv4",
                        "src_ip": "192.168.1.105",
                        "dst_ip": "93.184.216.34",
                        "ttl": 64,
                        "length": len(raw_payload) + 54,
                        "protocol_id": 6,
                    },
                    "layer4_transport": {
                        "protocol": "TCP",
                        "src_port": 51842,
                        "dst_port": 80,
                        "flags": "PSH, ACK",
                        "checksum": "0x7c21",
                        "seq_num": 1,
                        "ack_num": 1,
                    },
                    "layer7_application": {
                        "protocol_hint": "HTTP",
                        "payload_size": len(raw_payload),
                        "hex_dump": format_hex_dump(raw_payload),
                        "ascii_preview": sanitize_ascii(raw_payload),
                    },
                },
            }

        elif template == "https_handshake":
            return {
                "id": packet_id,
                "timestamp": timestamp,
                "relative_time": rel_time,
                "captured_mode": "mock",
                "summary": {
                    "src_ip": "192.168.1.105",
                    "dst_ip": "142.250.190.46",
                    "protocol": "HTTPS",
                    "length": 64,
                    "info": "53120 → 443 [SYN] Seq=0 Win=64240 Len=0",
                },
                "osi_layers": {
                    "layer2_datalink": {
                        "protocol": "Ethernet II",
                        "src_mac": "00:1A:2B:3C:4D:5E",
                        "dst_mac": "AA:BB:CC:DD:EE:FF",
                        "ethertype": "0x0800",
                        "ethertype_name": "IPv4",
                    },
                    "layer3_network": {
                        "protocol": "IPv4",
                        "src_ip": "192.168.1.105",
                        "dst_ip": "142.250.190.46",
                        "ttl": 128,
                        "length": 64,
                        "protocol_id": 6,
                    },
                    "layer4_transport": {
                        "protocol": "TCP",
                        "src_port": 53120,
                        "dst_port": 443,
                        "flags": "SYN",
                        "checksum": "0xa1b2",
                        "seq_num": 0,
                        "ack_num": 0,
                    },
                    "layer7_application": {
                        "protocol_hint": "HTTPS/TLS",
                        "payload_size": 0,
                        "hex_dump": "",
                        "ascii_preview": "",
                    },
                },
            }

        elif template == "dns_query":
            raw_payload = b"\x1a\x2b\x01\x00\x00\x01\x00\x00\x00\x00\x00\x00\x0funiversidad\x03edu\x00\x00\x01\x00\x01"
            return {
                "id": packet_id,
                "timestamp": timestamp,
                "relative_time": rel_time,
                "captured_mode": "mock",
                "summary": {
                    "src_ip": "192.168.1.105",
                    "dst_ip": "8.8.8.8",
                    "protocol": "DNS",
                    "length": len(raw_payload) + 42,
                    "info": "Standard query 0x1a2b A universidad.edu",
                },
                "osi_layers": {
                    "layer2_datalink": {
                        "protocol": "Ethernet II",
                        "src_mac": "00:1A:2B:3C:4D:5E",
                        "dst_mac": "AA:BB:CC:DD:EE:FF",
                        "ethertype": "0x0800",
                        "ethertype_name": "IPv4",
                    },
                    "layer3_network": {
                        "protocol": "IPv4",
                        "src_ip": "192.168.1.105",
                        "dst_ip": "8.8.8.8",
                        "ttl": 64,
                        "length": len(raw_payload) + 42,
                        "protocol_id": 17,
                    },
                    "layer4_transport": {
                        "protocol": "UDP",
                        "src_port": 54321,
                        "dst_port": 53,
                        "flags": None,
                        "checksum": "0x3f1a",
                    },
                    "layer7_application": {
                        "protocol_hint": "DNS",
                        "payload_size": len(raw_payload),
                        "hex_dump": format_hex_dump(raw_payload),
                        "ascii_preview": sanitize_ascii(raw_payload),
                    },
                },
            }

        elif template == "icmp_ping":
            raw_payload = b"abcdefghijklmnopqrstuvwabcdefghi"
            return {
                "id": packet_id,
                "timestamp": timestamp,
                "relative_time": rel_time,
                "captured_mode": "mock",
                "summary": {
                    "src_ip": "192.168.1.105",
                    "dst_ip": "1.1.1.1",
                    "protocol": "ICMP",
                    "length": len(raw_payload) + 42,
                    "info": "Echo (ping) request id=0x0042, seq=1/256, ttl=64",
                },
                "osi_layers": {
                    "layer2_datalink": {
                        "protocol": "Ethernet II",
                        "src_mac": "00:1A:2B:3C:4D:5E",
                        "dst_mac": "AA:BB:CC:DD:EE:FF",
                        "ethertype": "0x0800",
                        "ethertype_name": "IPv4",
                    },
                    "layer3_network": {
                        "protocol": "IPv4",
                        "src_ip": "192.168.1.105",
                        "dst_ip": "1.1.1.1",
                        "ttl": 64,
                        "length": len(raw_payload) + 42,
                        "protocol_id": 1,
                    },
                    "layer4_transport": {
                        "protocol": "ICMP",
                        "src_port": None,
                        "dst_port": None,
                        "flags": "Echo Request (Type 8, Code 0)",
                        "checksum": "0x4d5a",
                    },
                    "layer7_application": {
                        "protocol_hint": "ICMP Data",
                        "payload_size": len(raw_payload),
                        "hex_dump": format_hex_dump(raw_payload),
                        "ascii_preview": sanitize_ascii(raw_payload),
                    },
                },
            }

        else:  # arp_request
            return {
                "id": packet_id,
                "timestamp": timestamp,
                "relative_time": rel_time,
                "captured_mode": "mock",
                "summary": {
                    "src_ip": "192.168.1.105",
                    "dst_ip": "192.168.1.1",
                    "protocol": "ARP",
                    "length": 42,
                    "info": "Who has 192.168.1.1? Tell 192.168.1.105",
                },
                "osi_layers": {
                    "layer2_datalink": {
                        "protocol": "Ethernet II",
                        "src_mac": "00:1A:2B:3C:4D:5E",
                        "dst_mac": "FF:FF:FF:FF:FF:FF",
                        "ethertype": "0x0806",
                        "ethertype_name": "ARP",
                    },
                    "layer3_network": {
                        "protocol": "ARP",
                        "src_ip": "192.168.1.105",
                        "dst_ip": "192.168.1.1",
                        "ttl": None,
                        "length": 42,
                        "protocol_id": None,
                    },
                    "layer4_transport": {
                        "protocol": "NONE",
                        "src_port": None,
                        "dst_port": None,
                        "flags": None,
                        "checksum": None,
                    },
                    "layer7_application": {
                        "protocol_hint": "ARP Payload",
                        "payload_size": 0,
                        "hex_dump": "",
                        "ascii_preview": "",
                    },
                },
            }


mock_generator = MockPacketGenerator()


def generate_mock_packet(packet_id: int, start_time: float) -> Dict[str, Any]:
    """Genera un paquete sintético conforme al contrato CapturedPacket."""
    return mock_generator.generate(packet_id, start_time)
