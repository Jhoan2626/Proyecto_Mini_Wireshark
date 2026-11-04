"""
Servidor Flask para Mini-Wireshark: API REST, concurrencia y streaming de paquetes.
Fase 2 - Especificación: /specs/02-api-flask-streaming.md
Contrato: /PROJECT_CONTEXT.md
"""

import collections
import datetime
import threading
import time
from typing import Any, Dict, List, Optional

from flask import Flask, jsonify, request
from flask_cors import CORS

import scapy.all as scapy
from packet_engine import generate_mock_packet, parse_scapy_packet


class CaptureManager:
    """Administrador central del ciclo de vida de captura, concurrencia y buffer circular."""

    def __init__(self, max_packets: int = 2000):
        self.max_packets = max_packets
        self.lock = threading.Lock()
        self.packets_buffer = collections.deque(maxlen=max_packets)
        
        self.is_capturing: bool = False
        self.mode: str = "mock"
        self.interface: Optional[str] = None
        self.bpf_filter: str = ""
        self.started_at: Optional[str] = None
        self.start_timestamp: float = 0.0
        self.seq_counter: int = 0
        
        # Concurrencia
        self.stop_event = threading.Event()
        self.worker_thread: Optional[threading.Thread] = None
        self.async_sniffer: Optional[Any] = None

    def get_status(self) -> Dict[str, Any]:
        with self.lock:
            uptime = round(time.time() - self.start_timestamp, 1) if self.is_capturing else 0.0
            return {
                "status": "ok",
                "is_capturing": self.is_capturing,
                "mode": self.mode,
                "interface": self.interface or ("eth0 (Simulated)" if self.mode == "mock" else "Default Interface"),
                "packet_count": len(self.packets_buffer),
                "started_at": self.started_at,
                "uptime_seconds": uptime,
            }

    def start_capture(self, mode: str = "mock", interface: Optional[str] = None, bpf_filter: str = "") -> Dict[str, Any]:
        with self.lock:
            if self.is_capturing:
                return {
                    "status": "already_running",
                    "is_capturing": True,
                    "mode": self.mode,
                    "message": "La captura ya se encuentra en ejecución.",
                }

            self.mode = mode
            self.interface = interface
            self.bpf_filter = bpf_filter
            self.start_timestamp = time.time()
            self.started_at = datetime.datetime.now(datetime.timezone.utc).isoformat()
            self.is_capturing = True
            self.stop_event.clear()

        # Iniciar captura según el modo
        if self.mode == "real":
            try:
                def scapy_callback(pkt):
                    if self.stop_event.is_set():
                        return
                    with self.lock:
                        self.seq_counter += 1
                        pkt_id = self.seq_counter
                    parsed = parse_scapy_packet(pkt, pkt_id, self.start_timestamp, mode="real")
                    with self.lock:
                        self.packets_buffer.append(parsed)

                self.async_sniffer = scapy.AsyncSniffer(
                    prn=scapy_callback,
                    store=False,
                    iface=self.interface if self.interface else None,
                    filter=self.bpf_filter if self.bpf_filter else None
                )
                self.async_sniffer.start()
            except Exception as e:
                # Fallback automático a mock si faltan permisos o drivers libpcap/Npcap
                print(f"[Aviso] No fue posible capturar en modo real ({e}). Activando fallback a modo mock.")
                with self.lock:
                    self.mode = "mock"
                self._start_mock_thread()
        else:
            self._start_mock_thread()

        return {
            "status": "started",
            "is_capturing": True,
            "mode": self.mode,
            "message": f"Captura iniciada correctamente en modo {self.mode}.",
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

                # Intervalo realista entre 0.3s y 0.7s (1 a 3 paquetes/segundo)
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

        if self.async_sniffer is not None:
            try:
                self.async_sniffer.stop()
            except Exception:
                pass
            self.async_sniffer = None

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
            count = len(self.packets_buffer)

        return {
            "status": "cleared",
            "packet_count": count,
            "message": "Buffer de paquetes vaciado correctamente.",
        }

    def get_packets(self, since_id: int = 0, limit: int = 200, protocol: Optional[str] = None) -> Dict[str, Any]:
        limit = max(1, min(limit, 1000))
        protocol_filter = protocol.upper().strip() if protocol else None

        with self.lock:
            is_cap = self.is_capturing
            current_mode = self.mode
            total_captured = len(self.packets_buffer)
            
            # Filtrado rápido incremental
            matched: List[Dict[str, Any]] = []
            for pkt in self.packets_buffer:
                if pkt["id"] > since_id:
                    if protocol_filter:
                        p_summary = pkt.get("summary", {}).get("protocol", "").upper()
                        l4_proto = pkt.get("osi_layers", {}).get("layer4_transport", {}).get("protocol", "").upper() if pkt.get("osi_layers", {}).get("layer4_transport") else ""
                        if protocol_filter not in (p_summary, l4_proto):
                            continue
                    matched.append(pkt)
                    if len(matched) >= limit:
                        break

        return {
            "status": "ok",
            "is_capturing": is_cap,
            "mode": current_mode,
            "total_captured": total_captured,
            "returned_count": len(matched),
            "packets": matched,
        }


# Instancia Flask y Administrador de Captura
app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})
manager = CaptureManager(max_packets=2000)


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


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=False, threaded=True)

