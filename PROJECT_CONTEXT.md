# PROJECT_CONTEXT.md — Base de Conocimiento Maestra: Mini-Wireshark (Analizador OSI)

> **DIRECTIVA OBLIGatoria PARA AGENTES DE IA Y DESARROLLADORES:**
> Este documento constituye la fuente única de verdad (Single Source of Truth) arquitectónica del proyecto **Mini-Wireshark**. Cualquier agente de IA o desarrollador humano que intervenga en este repositorio debe leer y respetar estrictamente los contratos, roles y restricciones aquí definidos antes de crear o modificar código.

---

## 1. Resumen del Proyecto

**Mini-Wireshark** es un analizador pedagógico y técnico de tráfico de red local en tiempo real con desglose visual interactivo basado en el **Modelo OSI (Open Systems Interconnection)**.

Su propósito es interceptar tramas de red reales (o simuladas en entornos sin privilegios de superusuario) desde la interfaz de red de la máquina host, desencapsular sus cabeceras protocolo por protocolo y clasificar cada fragmento de información dentro de su capa correspondiente del Modelo OSI:

- **Capa 2 — Enlace de Datos (Data Link Layer):** Direccionamiento físico (MAC Origen, MAC Destino), tipo de trama (`EtherType`) y protocolo de enlace (`Ethernet II`, `802.1Q`, etc.).
- **Capa 3 — Red (Network Layer):** Direccionamiento lógico y enrutamiento (`IP Origen`, `IP Destino`, versión IPv4/IPv6 o resolución `ARP`, `TTL`, longitud total del paquete, identificador de protocolo superior).
- **Capa 4 — Transporte (Transport Layer):** Comunicación extremo a extremo (`TCP`, `UDP`, `ICMP`), puertos de origen y destino, banderas de control (`SYN`, `ACK`, `FIN`, `PSH`, `RST`), números de secuencia/acuse y suma de verificación (`Checksum`).
- **Capa 7 — Aplicación / Datos (Application & Payload Layer):** Identificación del protocolo de aplicación inferido (`HTTP`, `HTTPS/TLS`, `DNS`, `SSH`, `RAW`), tamaño de la carga útil (`Payload`) en bytes y representación segura en formato Hexadecimal y ASCII imprimible.

*(Nota arquitectónica: En el modelo práctico TCP/IP–OSI híbrido para análisis de paquetes de red, las responsabilidades de sesión y presentación [Capas 5 y 6] se consolidan junto con los datos de aplicación en el bloque `layer7_application`).*

---

## 2. Stack Tecnológico

### Backend (Intercepción, Desencapsulado y Streaming)
- **Lenguaje:** Python 3.10+
- **Motor de Captura y Parseo:** **Scapy** (`scapy.all`) para sniffing asíncrono de paquetes en vivo (`AsyncSniffer`), disección de capas (`Ether`, `IP`, `IPv6`, `ARP`, `TCP`, `UDP`, `ICMP`, `Raw`) y generador determinista de tráfico Mock.
- **Servidor Web y API:** **Flask** + **Flask-CORS** para exponer endpoints REST de control del sniffer y consulta/transmisión en tiempo real de los paquetes capturados con soporte CORS habilitado para el cliente React.

### Frontend y Entorno de Pruebas (Visualización y Certificación SDD)
- **Framework UI:** **React 18+** con **TypeScript** estricto.
- **Estilos:** **Tailwind CSS** para el diseño de paneles de alta densidad de información, etiquetas de protocolos con código de color por capa OSI y vistas responsivas oscuras/claras.
- **Entornos de Pruebas SDD:** Arneses interactivos en `/frontend/src/tests/*.tsx` con validadores de esquema en tiempo de ejecución, sondas HTTP y generadores de flujos de prueba (fixtures).

---

## 3. Metodología de Trabajo: SDD (Specification-Driven Development)

El proyecto se rige bajo **Desarrollo Orientado por Especificaciones (SDD)** con las siguientes reglas inquebrantables:

1. **Primacía de la Especificación (`/specs/`):**
   - Todo desarrollo nace exclusivamente de su archivo de especificación formal en `/specs/0X-*.md`.
   - **Prohibición de deriva de contrato:** Ningún agente ni desarrollador puede alterar nombres de campos JSON, rutas de endpoints, códigos de respuesta o props de componentes sin actualizar primero la especificación correspondiente y el contrato global en este documento.
2. **Vinculación 1:1 con Entornos de Pruebas (`/frontend/src/tests/`):**
   - Cada especificación `.md` está emparejada 1:1 con un entorno de pruebas ejecutable en TypeScript:
     - `/specs/01-motor-captura-osi.md` ↔ `/frontend/src/tests/Spec01CaptureTest.tsx`
     - `/specs/02-api-flask-streaming.md` ↔ `/frontend/src/tests/Spec02ApiStreamTest.tsx`
     - `/specs/03-tabla-trafico-tiempo-real.md` ↔ `/frontend/src/tests/Spec03TrafficTableTest.tsx`
     - `/specs/04-inspector-visual-osi.md` ↔ `/frontend/src/tests/Spec04OsiInspectorTest.tsx`
   - Una fase solo se considera **COMPLETADA** cuando todos los checks automáticos y criterios de aceptación de su arnés `.tsx` correspondiente pasan al 100%.
3. **Auditoría Integral Final:**
   - Al concluir las 4 fases secuenciales, un agente de IA auditor ejecutará una validación extremo a extremo (End-to-End) utilizando `TestSuiteRunner.tsx` para certificar la integración entre el backend de la Persona 1 y el frontend de la Persona 2.

---

## 4. División de Roles y Fases Secuenciales

| Fase | Responsable | Dominio | Especificación | Entorno de Prueba | Entregables Esperados (en Implementación) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Fase 1** | **Persona 1** | Backend / Datos | [`/specs/01-motor-captura-osi.md`](./specs/01-motor-captura-osi.md) | [`Spec01CaptureTest.tsx`](./frontend/src/tests/Spec01CaptureTest.tsx) | Motor Scapy, traductor de paquetes al contrato JSON OSI y generador Mock sin privilegios root/admin. |
| **Fase 2** | **Persona 1** | Backend / API | [`/specs/02-api-flask-streaming.md`](./specs/02-api-flask-streaming.md) | [`Spec02ApiStreamTest.tsx`](./frontend/src/tests/Spec02ApiStreamTest.tsx) | Servidor Flask multihilo no bloqueante, buffer circular seguro (thread-safe), CORS y endpoints `/api/*`. |
| **Fase 3** | **Persona 2** | Frontend / UI | [`/specs/03-tabla-trafico-tiempo-real.md`](./specs/03-tabla-trafico-tiempo-real.md) | [`Spec03TrafficTableTest.tsx`](./frontend/src/tests/Spec03TrafficTableTest.tsx) | Barra de control de captura, barra de filtros por protocolo/IP y tabla de tráfico en vivo con selección de fila. |
| **Fase 4** | **Persona 2** | Frontend / OSI | [`/specs/04-inspector-visual-osi.md`](./specs/04-inspector-visual-osi.md) | [`Spec04OsiInspectorTest.tsx`](./frontend/src/tests/Spec04OsiInspectorTest.tsx) | Inspector visual interactivo del Modelo OSI con tarjetas desplegables por capa, glosario pedagógico y visor Hex/ASCII. |

---

## 5. Contrato Global del Paquete (JSON Schema Unificado)

Todo paquete procesado por el Backend (Persona 1) y consumido por el Frontend (Persona 2) **DEBE** cumplir estrictamente con la siguiente interfaz TypeScript y estructura JSON:

### 5.1 Definición Formal en TypeScript

```typescript
/**
 * Protocolos de alto nivel clasificados para filtrado rápido y resumen en tabla.
 */
export type PacketProtocol = 'TCP' | 'UDP' | 'ICMP' | 'ARP' | 'HTTP' | 'HTTPS' | 'DNS' | 'OTHER';

/**
 * Modo de operación del motor de captura.
 * - 'real': Captura de interfaz de red real mediante Npcap/libpcap (requiere privilegios de administrador/root).
 * - 'mock': Generación sintética realista de paquetes OSI para desarrollo y pruebas sin privilegios.
 */
export type CaptureMode = 'real' | 'mock';

/**
 * Capa 2: Enlace de Datos (Data Link Layer - Estándar IEEE 802.3 / Ethernet II)
 */
export interface OsiLayer2DataLink {
  protocol: string;          // Ej. "Ethernet II"
  src_mac: string;           // Formato hexadecimal XX:XX:XX:XX:XX:XX (ej. "00:1A:2B:3C:4D:5E")
  dst_mac: string;           // Formato hexadecimal XX:XX:XX:XX:XX:XX o Broadcast "FF:FF:FF:FF:FF:FF"
  ethertype: string;         // Hexadecimal con prefijo 0x (ej. "0x0800" para IPv4, "0x0806" para ARP, "0x86DD" para IPv6)
  ethertype_name?: string;   // Nombre legible opcional (ej. "IPv4", "ARP", "IPv6")
}

/**
 * Capa 3: Red (Network Layer - IPv4 / IPv6 / ARP)
 */
export interface OsiLayer3Network {
  protocol: string;          // Ej. "IPv4", "IPv6", "ARP"
  src_ip: string;            // Dirección IP origen (ej. "192.168.1.15")
  dst_ip: string;            // Dirección IP destino (ej. "142.250.190.46")
  ttl: number | null;        // Time To Live / Hop Limit (0-255, o null si es ARP)
  length: number;            // Longitud total del paquete en bytes (entero >= 0)
  protocol_id?: number | null; // Número de protocolo IANA (ej. 6=TCP, 17=UDP, 1=ICMP, null en ARP)
}

/**
 * Capa 4: Transporte (Transport Layer - TCP / UDP / ICMP)
 * Puede ser null si el paquete es exclusivamente de Capa 2/3 (por ejemplo, ARP).
 */
export interface OsiLayer4Transport {
  protocol: 'TCP' | 'UDP' | 'ICMP' | 'NONE';
  src_port: number | null;   // Puerto origen (1-65535) para TCP/UDP, null para ICMP/NONE
  dst_port: number | null;   // Puerto destino (1-65535) para TCP/UDP, null para ICMP/NONE
  flags: string | null;      // Flags TCP (ej. "SYN", "SYN, ACK", "PSH, ACK", "FIN, ACK") o tipo/código ICMP (ej. "Echo Request (Type 8)"), null en UDP
  checksum: string | null;   // Suma de verificación en formato hexadecimal (ej. "0x4f2a")
  seq_num?: number | null;   // Número de secuencia TCP opcional
  ack_num?: number | null;   // Número de acuse de recibo TCP opcional
}

/**
 * Capa 7: Aplicación y Carga Útil (Application Layer & Payload)
 */
export interface OsiLayer7Application {
  protocol_hint: string;     // Protocolo inferido por puerto/contenido (ej. "HTTPS/TLS", "HTTP", "DNS", "ICMP Data", "ARP Payload", "RAW")
  payload_size: number;      // Tamaño de la carga útil de aplicación en bytes (entero >= 0)
  hex_dump: string;          // Bytes en hexadecimal separados por espacio (ej. "47 45 54 20 2f 20 48 54 54 50 2f 31 2e 31")
  ascii_preview: string;     // Vista previa ASCII segura (caracteres no imprimibles reemplazados por '.')
}

/**
 * Resumen rápido del paquete para renderizado de alto rendimiento en la tabla de tráfico (Fase 3).
 */
export interface PacketSummary {
  src_ip: string;
  dst_ip: string;
  protocol: PacketProtocol;
  length: number;
  info: string;              // Descripción sintética estilo Wireshark (ej. "54321 → 443 [SYN] Seq=0 Win=64240 Len=0")
}

/**
 * CONTRATO PRINCIPAL DEL PAQUETE (CapturedPacket)
 */
export interface CapturedPacket {
  id: number;                // Identificador secuencial único (1, 2, 3...)
  timestamp: string;         // Marca de tiempo ISO 8601 o HH:mm:ss.SSS (ej. "2026-10-27T12:00:01.234Z")
  relative_time?: number;    // Segundos transcurridos desde el inicio de la captura (ej. 1.245)
  captured_mode?: CaptureMode; // Indica si provino de captura 'real' o 'mock'
  summary: PacketSummary;
  osi_layers: {
    layer2_datalink: OsiLayer2DataLink;
    layer3_network: OsiLayer3Network;
    layer4_transport: OsiLayer4Transport | null;
    layer7_application: OsiLayer7Application;
  };
}
```

### 5.2 Ejemplo de Payload JSON Válido

```json
{
  "id": 1,
  "timestamp": "2026-10-27T12:05:14.128Z",
  "relative_time": 0.128,
  "captured_mode": "mock",
  "summary": {
    "src_ip": "192.168.1.105",
    "dst_ip": "93.184.216.34",
    "protocol": "HTTP",
    "length": 214,
    "info": "51842 → 80 [PSH, ACK] GET /index.html HTTP/1.1"
  },
  "osi_layers": {
    "layer2_datalink": {
      "protocol": "Ethernet II",
      "src_mac": "00:1A:2B:3C:4D:5E",
      "dst_mac": "AA:BB:CC:DD:EE:FF",
      "ethertype": "0x0800",
      "ethertype_name": "IPv4"
    },
    "layer3_network": {
      "protocol": "IPv4",
      "src_ip": "192.168.1.105",
      "dst_ip": "93.184.216.34",
      "ttl": 64,
      "length": 214,
      "protocol_id": 6
    },
    "layer4_transport": {
      "protocol": "TCP",
      "src_port": 51842,
      "dst_port": 80,
      "flags": "PSH, ACK",
      "checksum": "0x7c21",
      "seq_num": 1,
      "ack_num": 1
    },
    "layer7_application": {
      "protocol_hint": "HTTP",
      "payload_size": 160,
      "hex_dump": "47 45 54 20 2f 69 6e 64 65 78 2e 68 74 6d 6c 20 48 54 54 50 2f 31 2e 31",
      "ascii_preview": "GET /index.html HTTP/1.1"
    }
  }
}
```

---

## 6. Estructura Oficial del Repositorio

```text
/
├── PROJECT_CONTEXT.md                  # Base de conocimiento maestra y contrato global
├── specs/                              # Especificaciones técnicas SDD (Fases 1 a 4)
│   ├── 01-motor-captura-osi.md         # Especificación Fase 1 (Persona 1)
│   ├── 02-api-flask-streaming.md       # Especificación Fase 2 (Persona 1)
│   ├── 03-tabla-trafico-tiempo-real.md # Especificación Fase 3 (Persona 2)
│   └── 04-inspector-visual-osi.md      # Especificación Fase 4 (Persona 2)
├── backend/                            # Reservado para motor Scapy + servidor Flask (Persona 1)
└── frontend/
    └── src/
        ├── components/                 # Reservado para componentes UI finales (Persona 2)
        └── tests/                      # Entornos de prueba y validación SDD (.tsx)
            ├── Spec01CaptureTest.tsx
            ├── Spec02ApiStreamTest.tsx
            ├── Spec03TrafficTableTest.tsx
            ├── Spec04OsiInspectorTest.tsx
            └── TestSuiteRunner.tsx
```

