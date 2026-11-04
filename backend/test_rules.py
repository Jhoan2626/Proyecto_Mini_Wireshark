"""
Test de validación exacta según los 10 criterios de Spec01CaptureTest.tsx
"""
import re
from packet_engine import generate_mock_packet, parse_scapy_packet
import scapy.all as scapy
from scapy.layers.l2 import Ether, ARP
from scapy.layers.inet import IP, TCP, UDP, ICMP

IPV4_REGEX = re.compile(r"^(\d{1,3}\.){3}\d{1,3}$")
IPV6_REGEX = re.compile(r"^[0-9a-fA-F:]+$")
MAC_REGEX = re.compile(r"^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$")
HEX_PREFIX_REGEX = re.compile(r"^0x[0-9a-fA-F]+$")

def is_valid_ip(ip):
    if not isinstance(ip, str) or len(ip.strip()) == 0:
        return False
    if IPV4_REGEX.match(ip):
        parts = ip.split(".")
        return all(0 <= int(p) <= 255 for p in parts)
    return ":" in ip and bool(IPV6_REGEX.match(ip))

def validate_osi_packet_contract(pkt):
    summary = pkt.get("summary")
    layers = pkt.get("osi_layers")
    l2 = layers.get("layer2_datalink") if layers else None
    l3 = layers.get("layer3_network") if layers else None
    l4 = layers.get("layer4_transport") if layers else None
    l7 = layers.get("layer7_application") if layers else None

    # Regla 1: Metadatos Raiz
    assert isinstance(pkt.get("id"), int) and pkt["id"] > 0, "Regla 1 fallo: id"
    assert isinstance(pkt.get("timestamp"), str) and len(pkt["timestamp"].strip()) > 0, "Regla 1 fallo: timestamp"
    assert summary is not None, "Regla 1 fallo: summary"
    assert isinstance(summary.get("protocol"), str), "Regla 1 fallo: summary.protocol"
    assert isinstance(summary.get("info"), str) and len(summary["info"].strip()) > 0, "Regla 1 fallo: summary.info"

    # Regla 2: Existencia de las 4 capas
    assert layers is not None, "Regla 2 fallo: layers"
    assert l2 is not None, "Regla 2 fallo: l2"
    assert l3 is not None, "Regla 2 fallo: l3"
    assert (l4 is None or isinstance(l4, dict)), "Regla 2 fallo: l4"
    assert l7 is not None, "Regla 2 fallo: l7"

    # Regla 3: Capa 2 MACs
    assert isinstance(l2.get("src_mac"), str) and MAC_REGEX.match(l2["src_mac"]), f"Regla 3 fallo src_mac: {l2.get('src_mac')}"
    assert isinstance(l2.get("dst_mac"), str) and MAC_REGEX.match(l2["dst_mac"]), f"Regla 3 fallo dst_mac: {l2.get('dst_mac')}"

    # Regla 4: Capa 2 EtherType
    assert isinstance(l2.get("ethertype"), str) and HEX_PREFIX_REGEX.match(l2["ethertype"]), "Regla 4 fallo ethertype"
    assert isinstance(l2.get("protocol"), str) and len(l2["protocol"].strip()) > 0, "Regla 4 fallo protocol"

    # Regla 5: Capa 3 Direcciones IP
    assert is_valid_ip(l3.get("src_ip")), f"Regla 5 fallo src_ip: {l3.get('src_ip')}"
    assert is_valid_ip(l3.get("dst_ip")), f"Regla 5 fallo dst_ip: {l3.get('dst_ip')}"

    # Regla 6: Capa 3 TTL y Longitud
    is_arp = l3.get("protocol") == "ARP"
    if is_arp:
        assert l3.get("ttl") is None, "Regla 6 fallo: TTL debe ser None en ARP"
    else:
        assert isinstance(l3.get("ttl"), int) and 1 <= l3["ttl"] <= 255, f"Regla 6 fallo TTL: {l3.get('ttl')}"
    assert isinstance(l3.get("length"), int) and l3["length"] > 0, "Regla 6 fallo length"

    # Regla 7: Capa 4 Puertos
    if l4 is None:
        assert is_arp, "Regla 7 fallo: l4 is None solo valido en ARP"
    elif isinstance(l4, dict):
        proto = l4.get("protocol")
        if proto in ["TCP", "UDP"]:
            assert isinstance(l4.get("src_port"), int) and 1 <= l4["src_port"] <= 65535, "Regla 7 fallo src_port"
            assert isinstance(l4.get("dst_port"), int) and 1 <= l4["dst_port"] <= 65535, "Regla 7 fallo dst_port"
        elif proto in ["ICMP", "NONE"]:
            assert l4.get("src_port") is None and l4.get("dst_port") is None, f"Regla 7 fallo ports en {proto}"
        else:
            raise AssertionError(f"Regla 7 fallo proto desconocido {proto}")

    # Regla 8: Checksum y Flags
    if l4 is not None:
        chk = l4.get("checksum")
        assert chk is None or (isinstance(chk, str) and HEX_PREFIX_REGEX.match(chk)), f"Regla 8 fallo checksum: {chk}"

    # Regla 9: Capa 7 Payload
    assert isinstance(l7.get("payload_size"), int) and l7["payload_size"] >= 0, "Regla 9 fallo payload_size"
    assert isinstance(l7.get("protocol_hint"), str) and len(l7["protocol_hint"].strip()) > 0, "Regla 9 fallo hint"
    if l7["payload_size"] > 0:
        assert isinstance(l7.get("hex_dump"), str) and len(l7["hex_dump"].strip()) > 0, "Regla 9 fallo hex_dump"
        assert isinstance(l7.get("ascii_preview"), str) and len(l7["ascii_preview"]) > 0, "Regla 9 fallo ascii_preview"

    # Regla 10: Sanitizacion ASCII segura
    assert isinstance(l7.get("ascii_preview"), str), "Regla 10 fallo string"
    for ch in l7["ascii_preview"]:
        assert 32 <= ord(ch) <= 126, f"Regla 10 fallo caracter invalido {ord(ch)}"

    return True

# Ejecutamos las 10 reglas contra los 5 mocks
import time
start = time.time()
for i in range(1, 10):
    p = generate_mock_packet(i, start)
    validate_osi_packet_contract(p)

print("CERTIFICACION 10/10 REGLAS APROBADA CON EXITO!")

