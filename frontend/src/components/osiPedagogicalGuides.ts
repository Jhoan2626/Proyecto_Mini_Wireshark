export type OsiLayerKey = 'layer2' | 'layer3' | 'layer4' | 'layer7';

export interface OsiPedagogicalLayerGuide {
  title: string;
  shortTitle: string;
  badge: string;
  pdu: string;
  role: string;
  fields: Record<string, string>;
}

/**
 * Diccionario pedagógico oficial del Modelo OSI según Sección 2.3 de /specs/04-inspector-visual-osi.md
 */
export const OSI_PEDAGOGICAL_GUIDES: Record<OsiLayerKey, OsiPedagogicalLayerGuide> = {
  layer2: {
    title: 'Capa 2 — Enlace de Datos (Data Link Layer)',
    shortTitle: 'CAPA 2 • ENLACE DE DATOS',
    badge: 'OSI L2',
    pdu: 'Trama (Frame)',
    role: 'Entrega física nodo a nodo (salto a salto) dentro de la misma red de área local (LAN) mediante direccionamiento físico MAC de 48 bits.',
    fields: {
      src_mac:
        'Dirección física de 48 bits (6 bytes) grabada en la tarjeta de red (NIC) del dispositivo emisor para entrega local en la LAN.',
      dst_mac:
        'Dirección física de 48 bits del receptor local o del gateway. Si es FF:FF:FF:FF:FF:FF indica difusión (Broadcast) a todos los nodos de la LAN.',
      ethertype:
        'Código de 16 bits que indica al sistema operativo qué protocolo de Capa 3 viaja encapsulado dentro de la trama Ethernet (0x0800 = IPv4, 0x0806 = ARP, 0x86DD = IPv6).',
    },
  },
  layer3: {
    title: 'Capa 3 — Red (Network Layer)',
    shortTitle: 'CAPA 3 • RED',
    badge: 'OSI L3',
    pdu: 'Paquete (Packet)',
    role: 'Direccionamiento lógico jerárquico y enrutamiento extremo a extremo a través de múltiples subredes e Internet mediante direcciones IP.',
    fields: {
      src_ip:
        'Dirección lógica jerárquica del host que originó el paquete para permitir su identificación entre subredes.',
      dst_ip:
        'Dirección lógica del host destino final hacia donde los routers encaminan el paquete a través de múltiples redes.',
      ttl:
        'Time To Live (Tiempo de Vida): Contador de saltos que cada router decrementa en 1 para evitar bucles infinitos de enrutamiento en la red.',
      length:
        'Tamaño total del paquete IP en bytes (incluyendo cabeceras y carga útil).',
    },
  },
  layer4: {
    title: 'Capa 4 — Transporte (Transport Layer)',
    shortTitle: 'CAPA 4 • TRANSPORTE',
    badge: 'OSI L4',
    pdu: 'Segmento (TCP) / Datagrama (UDP)',
    role: 'Comunicación lógica proceso a proceso (multiplexación por puertos), control de sesión extremo a extremo y verificación de integridad.',
    fields: {
      ports:
        'Multiplexación de procesos: los números de puerto (1–65535) identifican la aplicación exacta en el host origen (puerto efímero) y en el servidor destino (puerto bien conocido, ej. 80 HTTP, 443 HTTPS, 53 DNS).',
      flags:
        'Control de sesión en TCP (SYN inicio de conexión 3-way handshake, ACK confirmación, PSH entrega inmediata a capa 7, FIN cierre) o los mensajes de diagnóstico en ICMP.',
      checksum:
        'Verificación matemática de integridad contra corrupción de bits en tránsito.',
    },
  },
  layer7: {
    title: 'Capa 7 — Aplicación y Carga Útil (Application Layer)',
    shortTitle: 'CAPA 7 • APLICACIÓN / PAYLOAD',
    badge: 'OSI L7',
    pdu: 'Datos / Mensaje (Payload)',
    role: 'Protocolos que interactúan directamente con el software del usuario (HTTP, DNS, TLS/HTTPS, SSH) donde los bytes crudos representan mensajes del protocolo de aplicación o datos cifrados.',
    fields: {
      payload:
        'Los bytes crudos representan mensajes del protocolo de aplicación o datos cifrados (en TLS/HTTPS), mostrados en representación dual Hexadecimal y ASCII legible.',
    },
  },
};

