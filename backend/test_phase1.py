import json
import time
import sys
from packet_engine import generate_mock_packet, parse_scapy_packet, sanitize_ascii
import scapy.all as scapy
from scapy.layers.l2 import Ether, ARP
from scapy.layers.inet import IP, TCP, UDP, ICMP

start_time = time.time()
print("1. Probando generacion de paquetes Mock (5 plantillas)...")
for i in range(1, 6):
    pkt = generate_mock_packet(i, start_time)
    print(f"  Mock {i}: {pkt['summary']['protocol']} | ID: {pkt['id']} | L4: {pkt['osi_layers']['layer4_transport']['protocol']}")
    assert pkt['id'] == i
    assert 'osi_layers' in pkt
    assert pkt['summary']['protocol'] in ['HTTP', 'HTTPS', 'DNS', 'ICMP', 'ARP']

print("2. Probando parse_scapy_packet con paquetes sinteticos de Scapy...")

# TCP Packet
raw_tcp = Ether(src="00:11:22:33:44:55", dst="66:77:88:99:AA:BB") / IP(src="192.168.1.50", dst="10.0.0.1") / TCP(sport=12345, dport=80, flags="PA", chksum=0x1234) / scapy.Raw(load=b"GET / HTTP/1.1\r\n\r\n")
parsed_tcp = parse_scapy_packet(raw_tcp, 10, start_time, mode="mock")
print("  Parsed TCP protocolo:", parsed_tcp['summary']['protocol'])
assert parsed_tcp['osi_layers']['layer4_transport']['protocol'] == 'TCP'
assert parsed_tcp['osi_layers']['layer4_transport']['src_port'] == 12345
assert parsed_tcp['osi_layers']['layer4_transport']['dst_port'] == 80
assert parsed_tcp['osi_layers']['layer7_application']['protocol_hint'] == 'HTTP'

# ARP Packet
raw_arp = Ether(src="00:11:22:33:44:55", dst="FF:FF:FF:FF:FF:FF") / ARP(psrc="192.168.1.1", pdst="192.168.1.200")
parsed_arp = parse_scapy_packet(raw_arp, 11, start_time, mode="mock")
print("  Parsed ARP protocolo:", parsed_arp['summary']['protocol'])
assert parsed_arp['osi_layers']['layer3_network']['protocol'] == 'ARP'
assert parsed_arp['osi_layers']['layer3_network']['ttl'] is None
assert parsed_arp['osi_layers']['layer4_transport']['protocol'] == 'NONE'
assert parsed_arp['osi_layers']['layer4_transport']['src_port'] is None

# ICMP Packet
raw_icmp = Ether() / IP(src="192.168.1.1", dst="8.8.8.8") / ICMP(type=8, code=0) / scapy.Raw(load=b"pingtest")
parsed_icmp = parse_scapy_packet(raw_icmp, 12, start_time, mode="mock")
print("  Parsed ICMP protocolo:", parsed_icmp['summary']['protocol'])
assert parsed_icmp['osi_layers']['layer4_transport']['protocol'] == 'ICMP'
assert parsed_icmp['osi_layers']['layer4_transport']['src_port'] is None

print("TODAS LAS PRUEBAS DE LA FASE 1 PASARON EXITOSAMENTE!")

