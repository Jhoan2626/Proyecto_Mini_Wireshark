"""
Mini-Wireshark: Motor de Captura Scapy y Transformación al Modelo OSI
Fase 1 - Especificación: /specs/01-motor-captura-osi.md
Contrato: /PROJECT_CONTEXT.md
"""

import datetime
import random
import re
import socket
import struct
import threading
import time
from typing import Any, Dict, Optional, Tuple

import scapy.all as scapy
from scapy.layers.inet import ICMP, IP, TCP, UDP
from scapy.layers.inet6 import IPv6
from scapy.layers.l2 import ARP, Ether


def sanitize_ascii(data: bytes) -> str:
    """Convierte bytes a representación ASCII segura (códigos 32-126, otros como '.')."""
    if not data:
        return ""
    return "".join(chr(b) if 32 <= b <= 126 else "." for b in data)


def format_hex_dump(data: bytes, max_bytes: int = 128) -> str:
    """Convierte bytes a formato hexadecimal con pares separados por espacio."""
    if not data:
        return ""
    chunk = data[:max_bytes]
    return " ".join(f"{b:02x}" for b in chunk)


def format_mac(mac_str: Optional[str]) -> str:
    """Normaliza direcciones MAC al formato XX:XX:XX:XX:XX:XX en mayúsculas."""
    if not mac_str:
        return "00:00:00:00:00:00"
    cleaned = mac_str.strip().replace("-", ":").upper()
    parts = cleaned.split(":")
    if len(parts) == 6 and all(len(p) <= 2 for p in parts):
        return ":".join(f"{int(p, 16):02X}" for p in parts)
    # Si viene en formato raw u otro
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


def infer_l7_protocol(src_port: Optional[int], dst_port: Optional[int], payload: bytes, l4_proto: str) -> str:
    """Infiere el protocolo de Capa 7 a partir de puertos o contenido del payload."""
    ports = {src_port, dst_port}
    if 80 in ports:
        return "HTTP"
    if 443 in ports:
        return "HTTPS/TLS"
    if 53 in ports:
        return "DNS"
    if 22 in ports:
        return "SSH"
    
    # Comprobar si parece HTTP por texto
    if payload:
        sample = payload[:16]
        if any(sample.startswith(verb) for verb in [b"GET ", b"POST ", b"HTTP/", b"PUT ", b"HEAD ", b"DELETE"]):
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
    # En Scapy flags puede ser FlagValue o entero o string
    flag_str = str(flags_val).strip()
    active = []
    # Scapy flag codes: S=SYN, A=ACK, F=FIN, R=RST, P=PSH, U=URG, E=ECE, C=CWR
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


def parse_scapy_packet(pkt: Any, packet_id: int, start_time: float, mode: str = "real") -> Dict[str, Any]:
    """
    Transforma un paquete Scapy nativo al Contrato Global JSON CapturedPacket.
    Cumple rigurosamente con los 10 criterios de validación de Spec01CaptureTest.tsx.
    """
    now = datetime.datetime.now(datetime.timezone.utc)
    timestamp = now.isoformat()
    relative_time = max(0.0, round(time.time() - start_time, 3))
    total_length = len(pkt) if hasattr(pkt, "__len__") else 0

    # 1. Capa 2 - Enlace de Datos
    if pkt.haslayer(Ether):
        eth = pkt[Ether]
        src_mac = format_mac(eth.src)
        dst_mac = format_mac(eth.dst)
        ethertype_hex, ethertype_name = format_ethertype(getattr(eth, "type", 0x0800))
        l2_proto = "Ethernet II"
    else:
        src_mac = "00:00:00:00:00:00"
        dst_mac = "00:00:00:00:00:00"
        ethertype_hex = "0x0800"
        ethertype_name = "IPv4"
        l2_proto = "Loopback"

    layer2 = {
        "protocol": l2_proto,
        "src_mac": src_mac,
        "dst_mac": dst_mac,
        "ethertype": ethertype_hex,
        "ethertype_name": ethertype_name,
    }

    # 2. Capa 3 - Red
    src_ip = "0.0.0.0"
    dst_ip = "0.0.0.0"
    ttl: Optional[int] = None
    protocol_id: Optional[int] = None
    l3_protocol = "IPv4"

    if pkt.haslayer(IP):
        ip = pkt[IP]
        src_ip = ip.src or "0.0.0.0"
        dst_ip = ip.dst or "0.0.0.0"
        ttl = int(ip.ttl) if getattr(ip, "ttl", None) is not None else 64
        protocol_id = int(ip.proto) if getattr(ip, "proto", None) is not None else 6
        l3_protocol = "IPv4"
        ip_len = getattr(ip, "len", None)
        if ip_len is not None:
            total_length = max(total_length, int(ip_len))
    elif pkt.haslayer(IPv6):
        ip6 = pkt[IPv6]
        src_ip = ip6.src or "::"
        dst_ip = ip6.dst or "::"
        ttl = int(ip6.hlim) if getattr(ip6, "hlim", None) is not None else 64
        protocol_id = int(ip6.nh) if getattr(ip6, "nh", None) is not None else 6
        l3_protocol = "IPv6"
        plen = getattr(ip6, "plen", None)
        if plen is not None:
            total_length = max(total_length, int(plen) + 40)
    elif pkt.haslayer(ARP):
        arp = pkt[ARP]
        src_ip = arp.psrc or "0.0.0.0"
        dst_ip = arp.pdst or "0.0.0.0"
        ttl = None
        protocol_id = None
        l3_protocol = "ARP"
        if not pkt.haslayer(Ether):
            src_mac = format_mac(getattr(arp, "hwsrc", None))
            dst_mac = format_mac(getattr(arp, "hwdst", None))
            layer2["src_mac"] = src_mac
            layer2["dst_mac"] = dst_mac
            layer2["ethertype"] = "0x0806"
            layer2["ethertype_name"] = "ARP"

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
        checksum = f"0x{int(tcp.chksum):04x}" if hasattr(tcp, "chksum") and tcp.chksum is not None else "0x0000"
        seq_num = int(tcp.seq) if hasattr(tcp, "seq") else None
        ack_num = int(tcp.ack) if hasattr(tcp, "ack") else None
    elif pkt.haslayer(UDP):
        udp = pkt[UDP]
        l4_proto = "UDP"
        src_port = int(udp.sport)
        dst_port = int(udp.dport)
        flags = None
        checksum = f"0x{int(udp.chksum):04x}" if hasattr(udp, "chksum") and udp.chksum is not None else "0x0000"
    elif pkt.haslayer(ICMP):
        icmp = pkt[ICMP]
        l4_proto = "ICMP"
        src_port = None
        dst_port = None
        flags = parse_icmp_flags(icmp)
        checksum = f"0x{int(icmp.chksum):04x}" if hasattr(icmp, "chksum") and icmp.chksum is not None else "0x0000"
    elif l3_protocol == "ARP":
        l4_proto = "NONE"

    layer4: Optional[Dict[str, Any]] = None
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
        # Para ARP u otros protocolos L2/L3 sin transporte
        layer4 = {
            "protocol": "NONE",
            "src_port": None,
            "dst_port": None,
            "flags": None,
            "checksum": None,
        }

    # 4. Capa 7 - Aplicación y Payload
    payload_bytes = b""
    if pkt.haslayer(scapy.Raw):
        payload_bytes = bytes(pkt[scapy.Raw].load)
    elif pkt.haslayer(scapy.Padding):
        payload_bytes = bytes(pkt[scapy.Padding].load)

    payload_size = len(payload_bytes)
    protocol_hint = infer_l7_protocol(src_port, dst_port, payload_bytes, l4_proto)

    hex_dump = format_hex_dump(payload_bytes) if payload_size > 0 else ""
    ascii_preview = sanitize_ascii(payload_bytes) if payload_size > 0 else ""

    layer7 = {
        "protocol_hint": protocol_hint,
        "payload_size": payload_size,
        "hex_dump": hex_dump,
        "ascii_preview": ascii_preview,
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
        info = f"{src_port} → {dst_port} [{flags or 'TCP'}] Seq={seq_num or 0} Win=64240 Len={payload_size}"
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


class MockPacketGenerator:
    """Generador sintético realista de paquetes OSI sin requerir permisos de administrador."""

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
            # SYN packet
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
                        "src_port": null_val(),
                        "dst_port": null_val(),
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


def null_val():
    return None


mock_generator = MockPacketGenerator()


def generate_mock_packet(packet_id: int, start_time: float) -> Dict[str, Any]:
    """Genera un paquete sintético conforme al contrato CapturedPacket."""
    return mock_generator.generate(packet_id, start_time)
