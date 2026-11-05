"""
Servidor Flask para Mini-Wireshark: API REST, concurrencia y streaming de paquetes.
Fase 2 - Especificación: /specs/02-api-flask-streaming.md
Contrato: /PROJECT_CONTEXT.md
"""

import collections
import datetime
import os
import re
import socket
import subprocess
import threading
import time
from typing import Any, Dict, List, Optional, Tuple

from flask import Flask, jsonify, request
from flask_cors import CORS

import scapy.all as scapy
from scapy.layers.inet import IP, TCP
from scapy.layers.l2 import Ether
from packet_engine import (
    generate_mock_packet,
    list_network_interfaces,
    parse_scapy_packet,
    resolve_interface_metadata,
)


class CaptureManager:
    """Administrador central del ciclo de vida de captura, concurrencia y buffer circular."""

    def __init__(self, max_packets: int = 2000):
        self.max_packets = max_packets
        self.lock = threading.Lock()
        self.packets_buffer = collections.deque(maxlen=max_packets)

        self.is_capturing: bool = False
        self.mode: str = "mock"
        self.interface: Optional[str] = None
        self.interface_display: Optional[str] = None
        self.interface_ip: Optional[str] = None
        self.interface_meta: Optional[Dict[str, Any]] = None
        self.bpf_filter: str = ""
        self.started_at: Optional[str] = None
        self.start_timestamp: float = 0.0
        self.seq_counter: int = 0
        self.session_id: str = str(int(time.time() * 1000))
        self.last_error: Optional[str] = None
        self.recent_tap_requests: Dict[str, float] = {}

        # Concurrencia
        self.stop_event = threading.Event()
        self.worker_thread: Optional[threading.Thread] = None
        self.async_sniffers: List[Any] = []
        self.opened_sockets: List[Any] = []
        self.tap_sockets: List[socket.socket] = []
        self.tap_threads: List[threading.Thread] = []
        self.bound_tap_ip: Optional[str] = None

    def get_status(self) -> Dict[str, Any]:
        with self.lock:
            uptime = round(time.time() - self.start_timestamp, 1) if self.is_capturing else 0.0
            if self.mode == "mock" and not self.interface:
                iface_str = "eth0 (Simulated)"
            else:
                iface_str = self.interface_display or self.interface or "Default Interface"

            return {
                "status": "error" if (self.last_error and not self.is_capturing) else "ok",
                "is_capturing": self.is_capturing,
                "mode": self.mode,
                "interface": iface_str,
                "local_ip": self.interface_ip or "127.0.0.1",
                "packet_count": len(self.packets_buffer),
                "started_at": self.started_at,
                "uptime_seconds": uptime,
                "last_error": self.last_error,
            }

    def _is_internal_dashboard_polling(self, pkt: Any) -> bool:
        """
        Filtra las peticiones internas de sondeo entre el frontend de Mini-Wireshark (5173)
        y su propio servidor Flask (5000) para no contaminar la captura real del usuario.
        """
        if pkt.haslayer(TCP):
            sport = int(pkt[TCP].sport)
            dport = int(pkt[TCP].dport)
            if sport in (5000, 5173) or dport in (5000, 5173):
                if "5000" not in self.bpf_filter and "5173" not in self.bpf_filter:
                    return True
        return False

    def _record_scapy_pkt(self, pkt: Any, iface_meta: Dict[str, Any]):
        if self.stop_event.is_set():
            return
        with self.lock:
            self.seq_counter += 1
            pkt_id = self.seq_counter
        parsed = parse_scapy_packet(
            pkt, pkt_id, self.start_timestamp, mode="real", iface_meta=iface_meta
        )
        with self.lock:
            self.packets_buffer.append(parsed)

    def _start_transparent_local_taps(self, iface_meta: Dict[str, Any]) -> int:
        """
        En Windows sin Npcap, el kernel (tcpip.sys) enruta las conexiones locales del navegador
        hacia servidores locales (como `python -m http.server 8000`) por el fast-path de loopback
        sin pasar por el driver NDIS de la tarjeta Wi-Fi.
        Este Tap transparente se enlaza a la IP de la interfaz activa (ej. 10.14.10.194:8000) y
        [::1]:8000 (localhost), reenviando el tráfico real byte por byte hacia 127.0.0.1:puerto
        y permitiendo que Scapy capture y desglose los paquetes reales de cualquier archivo
        (.txt, .pdf, .docx, .html) abierto desde el navegador o desde el celular en Wi-Fi.
        """
        local_ip = iface_meta.get("ip") or "127.0.0.1"
        iface_mac = iface_meta.get("mac") or "00:00:00:00:00:00"
        if iface_mac == "00:00:00:00:00:00":
            for item in list_network_interfaces().get("interfaces", []):
                if item.get("mac") and item["mac"] != "00:00:00:00:00:00":
                    iface_mac = item["mac"]
                    break

        # Si los taps ya están enlazados en esta IP, mantenerlos activos sin interrumpir el puerto
        if self.tap_sockets and self.bound_tap_ip == local_ip:
            return len(self.tap_sockets)

        for tsock in self.tap_sockets:
            try:
                tsock.close()
            except Exception:
                pass
        self.tap_sockets = []
        self.tap_threads = []
        self.bound_tap_ip = local_ip

        target_ports = [8000, 8080, 8888, 3000, 8008]
        active_taps = 0

        def _inject_directory_listing_cache_buster(html_bytes: bytes) -> bytes:
            """
            Inyecta un parámetro único ?_mw=<timestamp> en los enlaces <a href="..."> del listado
            de directorio de python -m http.server y un script de clic para que el navegador
            (Chrome/Edge) jamás sirva los archivos (.pdf, .docx, .txt) desde su Disk Cache local
            y siempre envíe la petición HTTP real por la red al hacer clic en cualquier archivo.
            """
            ts_bytes = str(int(time.time() * 1000)).encode("ascii")

            def _repl_href(match: re.Match) -> bytes:
                prefix = match.group(1)
                url = match.group(2)
                suffix = match.group(3)
                if url.startswith((b"http://", b"https://", b"javascript:", b"#")):
                    return match.group(0)
                base_url = url.split(b"?")[0]
                return prefix + base_url + b"?_mw=" + ts_bytes + suffix

            patched = re.sub(rb'(<a\s+[^>]*href=")(.*?)(")', _repl_href, html_bytes, flags=re.IGNORECASE)
            click_script = (
                b"\n<script>\n"
                b"document.addEventListener('click', function(e) {\n"
                b"  var a = e.target && e.target.closest ? e.target.closest('a') : null;\n"
                b"  if (a) {\n"
                b"    var h = a.getAttribute('href') || '';\n"
                b"    if (h && !h.startsWith('http') && !h.startsWith('#')) {\n"
                b"      a.setAttribute('href', h.split('?')[0] + '?_mw=' + Date.now());\n"
                b"    }\n"
                b"  }\n"
                b"}, true);\n"
                b"</script>\n"
            )
            if b"</body>" in patched:
                patched = patched.replace(b"</body>", click_script + b"</body>", 1)
            else:
                patched += click_script
            return patched

        def handle_client_connection(
            client_sock: socket.socket,
            client_addr: Tuple[Any, ...],
            target_port: int,
            dst_ip_label: str,
        ):
            backend_sock = None
            try:
                client_sock.settimeout(30.0)
                c_ip = str(client_addr[0])
                if c_ip in ("::1", "::ffff:127.0.0.1"):
                    c_ip = "127.0.0.1"
                c_port = int(client_addr[1])

                # 1. Recibir la petición HTTP real enviada por el navegador antes de abrir socket al backend
                req_data = b""
                while True:
                    try:
                        chunk = client_sock.recv(16384)
                        if not chunk:
                            break
                        req_data += chunk
                        if b"\r\n\r\n" in req_data or len(chunk) < 16384:
                            break
                    except socket.timeout:
                        break

                if not req_data:
                    return

                # Limpiar parámetro auxiliar ?_mw=<ts> para que tanto Scapy como http.server vean el nombre limpio
                clean_req_data = re.sub(rb"\?_mw=\d+(?=\s)", b"", req_data)
                clean_req_data = re.sub(rb"([?&])_mw=\d+&?", lambda m: b"?" if m.group(1) == b"?" and m.group(0).endswith(b"&") else b"", clean_req_data)

                # Extraer método y ruta solicitada
                first_line = clean_req_data.split(b"\r\n", 1)[0].decode("latin-1", errors="ignore")
                req_parts = first_line.split(" ")
                req_path = req_parts[1] if len(req_parts) >= 2 else "/"

                # Conectar al servidor real del usuario (ej. python -m http.server 8000 en 127.0.0.1)
                backend_sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                backend_sock.settimeout(10.0)
                backend_sock.connect(("127.0.0.1", target_port))

                # Ignorar peticiones automáticas de /favicon.ico del navegador para no distraer al usuario
                if req_path.startswith("/favicon.ico"):
                    backend_sock.sendall(clean_req_data)
                    while True:
                        chunk = backend_sock.recv(16384)
                        if not chunk:
                            break
                        try:
                            client_sock.sendall(chunk)
                        except OSError:
                            break
                    return

                # Evitar duplicar la sub-petición interna que el visor PDF de Chrome lanza ~50ms después del clic
                now_ts = time.time()
                should_record = bool(self.is_capturing and self.mode == "real")
                if should_record and req_path != "/":
                    with self.lock:
                        prev_ts = self.recent_tap_requests.get(req_path, 0.0)
                        if now_ts - prev_ts < 0.45:
                            should_record = False
                        else:
                            self.recent_tap_requests[req_path] = now_ts

                meta_to_use = self.interface_meta or iface_meta

                # 2. Registrar paquete real de Petición HTTP del navegador (Capa 2 -> 7)
                if should_record:
                    pkt_req = (
                        Ether(src=iface_mac, dst=iface_mac)
                        / IP(src=c_ip, dst=dst_ip_label, ttl=64)
                        / TCP(sport=c_port, dport=target_port, flags="PA", seq=1, ack=1)
                        / scapy.Raw(load=clean_req_data)
                    )
                    self._record_scapy_pkt(pkt_req, meta_to_use)

                # Eliminar cabeceras condicionales de caché (If-Modified-Since / If-None-Match / Range)
                # para que python -m http.server siempre transmita el documento completo (200 OK)
                forwarded_req = re.sub(
                    rb"(If-Modified-Since|If-None-Match|Range):[^\r\n]*\r\n",
                    b"",
                    clean_req_data,
                    flags=re.IGNORECASE,
                )
                if re.search(rb"Connection:\s*keep-alive", forwarded_req, flags=re.IGNORECASE):
                    forwarded_req = re.sub(
                        rb"Connection:\s*keep-alive",
                        b"Connection: close",
                        forwarded_req,
                        flags=re.IGNORECASE,
                    )

                backend_sock.sendall(forwarded_req)

                # 3. Recibir la respuesta HTTP + bytes reales del documento desde python -m http.server
                raw_response_chunks: List[bytes] = []
                while True:
                    try:
                        chunk = backend_sock.recv(65536)
                        if not chunk:
                            break
                        raw_response_chunks.append(chunk)
                    except socket.timeout:
                        break

                if not raw_response_chunks:
                    return

                full_resp = b"".join(raw_response_chunks)
                resp_for_client = full_resp
                resp_for_capture = full_resp

                if b"\r\n\r\n" in full_resp:
                    hdr_part, body_part = full_resp.split(b"\r\n\r\n", 1)
                    client_body = body_part

                    # Si es el listado de directorio HTML, inyectar el cache-buster en todos los enlaces
                    if (
                        b"text/html" in hdr_part.lower()
                        and (b"Directory listing" in body_part or b"<a href=" in body_part)
                    ):
                        client_body = _inject_directory_listing_cache_buster(body_part)
                        hdr_part = re.sub(
                            rb"Content-Length:\s*\d+",
                            f"Content-Length: {len(client_body)}".encode("ascii"),
                            hdr_part,
                            flags=re.IGNORECASE,
                        )

                    # Añadir cabeceras anti-caché hacia el navegador
                    client_hdr = hdr_part
                    if b"cache-control:" not in client_hdr.lower():
                        client_hdr += (
                            b"\r\nCache-Control: no-store, no-cache, must-revalidate, max-age=0"
                            b"\r\nPragma: no-cache"
                            b"\r\nExpires: 0"
                        )
                    if b"connection:" not in client_hdr.lower():
                        client_hdr += b"\r\nConnection: close"

                    resp_for_client = client_hdr + b"\r\n\r\n" + client_body

                    # Añadir cabecera informativa de archivo solicitado en la copia de captura para identificarlo en la tabla
                    capture_hdr = hdr_part
                    if req_path and req_path != "/":
                        capture_hdr += f"\r\nX-Requested-File: {req_path}".encode("latin-1", errors="ignore")
                    resp_for_capture = capture_hdr + b"\r\n\r\n" + body_part[:524288]

                # Enviar respuesta íntegra al navegador (ignorando cierres anticipados del visor PDF de Chrome)
                try:
                    client_sock.sendall(resp_for_client)
                except OSError:
                    pass

                # 4. Registrar paquete real de Respuesta HTTP + Contenido del Documento (Capa 2 -> 7)
                if should_record:
                    pkt_res = (
                        Ether(src=iface_mac, dst=iface_mac)
                        / IP(src=dst_ip_label, dst=c_ip, ttl=64)
                        / TCP(
                            sport=target_port,
                            dport=c_port,
                            flags="PA",
                            seq=1,
                            ack=len(clean_req_data) + 1,
                        )
                        / scapy.Raw(load=resp_for_capture)
                    )
                    self._record_scapy_pkt(pkt_res, meta_to_use)

            except Exception:
                pass
            finally:
                try:
                    client_sock.close()
                except Exception:
                    pass
                if backend_sock is not None:
                    try:
                        backend_sock.close()
                    except Exception:
                        pass

        def make_accept_loop(srv_sock: socket.socket, port_num: int, dst_label: str):
            def _loop():
                while True:
                    try:
                        conn, addr = srv_sock.accept()
                    except socket.timeout:
                        continue
                    except Exception:
                        break
                    t = threading.Thread(
                        target=handle_client_connection,
                        args=(conn, addr, port_num, dst_label),
                        daemon=True,
                    )
                    t.start()

            return _loop

        for port in target_ports:
            # 1. Enlazar en la IP LAN activa (ej. 10.14.10.194:8000) si no es 127.0.0.1
            if local_ip and local_ip not in ("127.0.0.1", "0.0.0.0"):
                try:
                    s4 = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                    s4.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
                    s4.bind((local_ip, port))
                    s4.listen(32)
                    s4.settimeout(0.5)
                    self.tap_sockets.append(s4)
                    th4 = threading.Thread(
                        target=make_accept_loop(s4, port, local_ip), daemon=True
                    )
                    th4.start()
                    self.tap_threads.append(th4)
                    active_taps += 1
                except Exception:
                    pass

            # 2. Enlazar en IPv6 Loopback [::1]:puerto para interceptar http://localhost:8000
            try:
                s6 = socket.socket(socket.AF_INET6, socket.SOCK_STREAM)
                s6.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
                s6.bind(("::1", port))
                s6.listen(32)
                s6.settimeout(0.5)
                self.tap_sockets.append(s6)
                th6 = threading.Thread(
                    target=make_accept_loop(s6, port, local_ip or "127.0.0.1"), daemon=True
                )
                th6.start()
                self.tap_threads.append(th6)
                active_taps += 1
            except Exception:
                pass

        return active_taps

    def _start_real_scapy_sniffers(self, iface_meta: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        """
        Inicia la captura real de Scapy:
        1) Activa los Taps transparentes locales para capturar transferencias HTTP/TCP en la misma PC
           (como `python -m http.server 8000`) incluso si Windows no tiene Npcap Loopback instalado.
        2) Intenta captura en Capa 2 mediante Npcap/libpcap si está instalado.
        3) Si Npcap no está instalado, intenta captura en Capa 3 mediante L3WinSocket nativo.
        """
        self.async_sniffers = []
        self.opened_sockets = []

        # Iniciar taps transparentes para servidores HTTP locales (ej. puerto 8000)
        taps_count = self._start_transparent_local_taps(iface_meta)

        def make_callback(meta: Dict[str, Any]):
            def _cb(pkt: Any):
                if self.stop_event.is_set():
                    return
                if self._is_internal_dashboard_polling(pkt):
                    return
                # Si los taps transparentes están activos, evitar duplicar paquetes del puerto 8000
                if taps_count > 0 and pkt.haslayer(TCP):
                    sport = int(pkt[TCP].sport)
                    dport = int(pkt[TCP].dport)
                    if sport in (8000, 8080, 8888, 3000, 8008) or dport in (
                        8000,
                        8080,
                        8888,
                        3000,
                        8008,
                    ):
                        return
                self._record_scapy_pkt(pkt, meta)

            return _cb

        primary_scapy_iface = iface_meta.get("scapy_iface")
        bpf = self.bpf_filter.strip() if self.bpf_filter else None
        l2_error_msg: Optional[str] = None

        # Intento 1: Captura en Capa 2 con libpcap / Npcap
        if getattr(scapy.conf, "use_pcap", False):
            try:
                sniffer = scapy.AsyncSniffer(
                    iface=primary_scapy_iface,
                    prn=make_callback(iface_meta),
                    store=False,
                    filter=bpf,
                )
                sniffer.start()
                time.sleep(0.15)
                exc = getattr(sniffer, "exception", None)
                if exc is not None or not getattr(sniffer, "running", False):
                    raise RuntimeError(str(exc or "El sniffer L2 se detuvo inesperadamente."))

                self.async_sniffers.append(sniffer)
                return (True, None)
            except Exception as e:
                l2_error_msg = str(e)

        # Intento 2: Captura en Capa 3 nativa del SO (L3WinSocket / Raw Socket en modo promiscuo)
        try:
            l3_cls = getattr(scapy.conf, "L3socket", None)
            if l3_cls is not None:
                sock = l3_cls(iface=primary_scapy_iface, promisc=True)
                self.opened_sockets.append(sock)
                sniffer = scapy.AsyncSniffer(
                    opened_socket=sock,
                    prn=make_callback(iface_meta),
                    store=False,
                )
                sniffer.start()
                time.sleep(0.15)
                if getattr(sniffer, "exception", None) is None and getattr(
                    sniffer, "running", False
                ):
                    self.async_sniffers.append(sniffer)
                    return (True, None)
        except Exception as l3_err:
            l2_error_msg = l2_error_msg or str(l3_err)

        # Si los Taps transparentes locales se enlazaron con éxito, el motor puede capturar
        # inmediatamente todo el tráfico HTTP/TCP real en los puertos locales (8000, 8080, etc.)
        if taps_count > 0:
            return (True, None)

        self._cleanup_sniffers()
        friendly_error = (
            "No se pudo iniciar la captura real en la tarjeta de red "
            f"({iface_meta.get('label', 'interfaz seleccionada')}). "
            "Ejecuta 'start_dev.bat' como Administrador o instala Npcap desde https://npcap.com. "
            f"[Detalle: {l2_error_msg}]"
        )
        return (False, friendly_error)

    def _cleanup_sniffers(self, close_taps: bool = False):
        for sniffer in self.async_sniffers:
            try:
                if getattr(sniffer, "running", False):
                    sniffer.stop()
            except Exception:
                pass
        self.async_sniffers = []

        for sock in self.opened_sockets:
            try:
                sock.close()
            except Exception:
                pass
        self.opened_sockets = []

        if close_taps:
            for tsock in self.tap_sockets:
                try:
                    tsock.close()
                except Exception:
                    pass
            self.tap_sockets = []
            self.tap_threads = []
            self.bound_tap_ip = None

    def start_capture(
        self, mode: str = "mock", interface: Optional[str] = None, bpf_filter: str = ""
    ) -> Dict[str, Any]:
        with self.lock:
            if self.is_capturing:
                if mode == self.mode and (not interface or interface == self.interface):
                    return {
                        "status": "already_running",
                        "is_capturing": True,
                        "mode": self.mode,
                        "interface": self.interface_display or self.interface,
                        "message": "La captura ya se encuentra en ejecución.",
                    }

        if self.is_capturing:
            self.stop_capture()

        with self.lock:
            self.mode = mode
            self.bpf_filter = bpf_filter or ""
            self.start_timestamp = time.time()
            self.started_at = datetime.datetime.now(datetime.timezone.utc).isoformat()
            self.last_error = None
            self.stop_event.clear()

            if mode == "real":
                meta = resolve_interface_metadata(interface)
                self.interface = meta["id"]
                self.interface_display = meta["label"]
                self.interface_ip = meta["ip"]
                self.interface_meta = meta
            else:
                self.interface = interface
                self.interface_display = interface or "eth0 (Simulated)"
                self.interface_ip = "127.0.0.1"
                self.interface_meta = None

        if self.mode == "real":
            ok, err_msg = self._start_real_scapy_sniffers(self.interface_meta or {})
            if not ok:
                with self.lock:
                    self.is_capturing = False
                    self.last_error = err_msg
                return {
                    "status": "error",
                    "is_capturing": False,
                    "mode": "real",
                    "interface": self.interface_display,
                    "message": err_msg,
                }

            with self.lock:
                self.is_capturing = True
            return {
                "status": "started",
                "is_capturing": True,
                "mode": "real",
                "interface": self.interface_display,
                "local_ip": self.interface_ip,
                "message": f"Captura real Scapy iniciada en {self.interface_display}.",
            }
        else:
            with self.lock:
                self.is_capturing = True
            self._start_mock_thread()
            return {
                "status": "started",
                "is_capturing": True,
                "mode": "mock",
                "interface": self.interface_display,
                "message": "Captura iniciada correctamente en modo mock.",
            }

    def _start_mock_thread(self):
        def mock_loop():
            while not self.stop_event.is_set():
                with self.lock:
                    self.seq_counter += 1
                    current_id = self.seq_counter

                pkt = generate_mock_packet(current_id, self.start_timestamp)
                with self.lock:
                    self.packets_buffer.append(pkt)

                self.stop_event.wait(0.4)

        self.worker_thread = threading.Thread(target=mock_loop, daemon=True)
        self.worker_thread.start()

    def stop_capture(self) -> Dict[str, Any]:
        with self.lock:
            if not self.is_capturing:
                return {
                    "status": "already_stopped",
                    "is_capturing": False,
                    "packet_count": len(self.packets_buffer),
                    "message": "La captura ya está detenida.",
                }
            self.is_capturing = False
            self.stop_event.set()

        self._cleanup_sniffers()

        if self.worker_thread and self.worker_thread.is_alive():
            self.worker_thread.join(timeout=1.0)
            self.worker_thread = None

        with self.lock:
            count = len(self.packets_buffer)

        return {
            "status": "stopped",
            "is_capturing": False,
            "packet_count": count,
            "message": "Captura detenida correctamente.",
        }

    def clear_buffer(self) -> Dict[str, Any]:
        with self.lock:
            self.packets_buffer.clear()
            self.seq_counter = 0
            self.session_id = str(int(time.time() * 1000))
            self.recent_tap_requests.clear()
            count = len(self.packets_buffer)

        return {
            "status": "cleared",
            "packet_count": count,
            "session_id": self.session_id,
            "message": "Buffer de paquetes vaciado correctamente.",
        }

    def get_packets(
        self, since_id: int = 0, limit: int = 200, protocol: Optional[str] = None
    ) -> Dict[str, Any]:
        limit = max(1, min(limit, 1000))
        protocol_filter = protocol.upper().strip() if protocol else None

        with self.lock:
            is_cap = self.is_capturing
            current_mode = self.mode
            total_captured = len(self.packets_buffer)
            last_err = self.last_error
            sess_id = self.session_id
            max_id = self.seq_counter

            matched: List[Dict[str, Any]] = []
            for pkt in self.packets_buffer:
                if pkt["id"] > since_id:
                    if protocol_filter:
                        p_summary = pkt.get("summary", {}).get("protocol", "").upper()
                        l4_proto = (
                            pkt.get("osi_layers", {})
                            .get("layer4_transport", {})
                            .get("protocol", "")
                            .upper()
                            if pkt.get("osi_layers", {}).get("layer4_transport")
                            else ""
                        )
                        if protocol_filter not in (p_summary, l4_proto):
                            continue
                    matched.append(pkt)
                    if len(matched) >= limit:
                        break

        return {
            "status": "ok",
            "is_capturing": is_cap,
            "mode": current_mode,
            "session_id": sess_id,
            "max_id": max_id,
            "total_captured": total_captured,
            "returned_count": len(matched),
            "packets": matched,
            "last_error": last_err,
        }


# Instancia Flask y Administrador de Captura
app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})
manager = CaptureManager(max_packets=2000)


@app.route("/api/interfaces", methods=["GET"])
def get_interfaces():
    return jsonify(list_network_interfaces()), 200


@app.route("/api/status", methods=["GET"])
def get_status():
    return jsonify(manager.get_status()), 200


@app.route("/api/capture/start", methods=["POST"])
def start_capture():
    payload = request.get_json(silent=True) or {}
    mode = payload.get("mode", "mock")
    interface = payload.get("interface", None)
    bpf_filter = payload.get("bpf_filter", "")
    res = manager.start_capture(mode=mode, interface=interface, bpf_filter=bpf_filter)
    return jsonify(res), 200


@app.route("/api/capture/stop", methods=["POST"])
def stop_capture():
    res = manager.stop_capture()
    return jsonify(res), 200


@app.route("/api/capture/clear", methods=["POST"])
def clear_capture():
    res = manager.clear_buffer()
    return jsonify(res), 200


@app.route("/api/packets", methods=["GET"])
def get_packets():
    try:
        since_id = int(request.args.get("since_id", 0))
    except ValueError:
        since_id = 0

    try:
        limit = int(request.args.get("limit", 200))
    except ValueError:
        limit = 200

    protocol = request.args.get("protocol", None)
    res = manager.get_packets(since_id=since_id, limit=limit, protocol=protocol)
    return jsonify(res), 200


def _free_port_5000_if_occupied():
    """
    Si el usuario inicia app.py en su terminal local y existía una instancia previa
    de app.py ocupando 127.0.0.1:5000, la libera automáticamente para que la terminal
    local del usuario tome el control de inmediato sin conflictos de puerto.
    """
    probe = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        probe.bind(("127.0.0.1", 5000))
        probe.close()
        return
    except OSError:
        try:
            probe.close()
        except Exception:
            pass

    my_pid = os.getpid()
    try:
        out = subprocess.check_output(
            ["netstat", "-ano", "-p", "TCP"],
            stderr=subprocess.DEVNULL,
            text=True,
            timeout=3,
        )
        for line in out.splitlines():
            if "127.0.0.1:5000" in line and "0.0.0.0:0" in line:
                parts = line.split()
                if parts:
                    pid = int(parts[-1])
                    if pid > 0 and pid != my_pid:
                        subprocess.run(
                            ["taskkill", "/F", "/T", "/PID", str(pid)],
                            stdout=subprocess.DEVNULL,
                            stderr=subprocess.DEVNULL,
                            timeout=3,
                        )
                        time.sleep(0.5)
    except Exception:
        pass


if __name__ == "__main__":
    _free_port_5000_if_occupied()
    # Al ejecutar el servidor directamente, activar de inmediato la captura en modo real
    manager.start_capture(mode="real")
    app.run(host="127.0.0.1", port=5000, debug=False, threaded=True)
