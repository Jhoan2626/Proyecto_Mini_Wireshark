# Especificación 01: Motor de Captura Scapy y Transformación al Modelo OSI

- **Fase:** 1 de 4
- **Responsable:** Persona 1 (Backend y Datos)
- **Entorno de Prueba Vinculado:** [`/frontend/src/tests/Spec01CaptureTest.tsx`](../frontend/src/tests/Spec01CaptureTest.tsx)
- **Estado Inicial:** Pendiente de Implementación
- **Dependencias:** Ninguna (Base del sistema)

---

## 1. Objetivo y Alcance

Diseñar e implementar el motor de bajo nivel en Python (dentro de `/backend/`) encargado de:
1. Interceptar tramas de red desde la interfaz local utilizando **Scapy** (`AsyncSniffer` o `sniff`).
2. Desencapsular las cabeceras del paquete capa por capa siguiendo el **Modelo OSI**.
3. Transformar cada paquete nativo de Scapy al **Contrato Global JSON (`CapturedPacket`)** definido en [`/PROJECT_CONTEXT.md`](../PROJECT_CONTEXT.md).
4. Proveer un **Modo Mock / Simulación** determinista y realista que funcione sin requerir permisos de superusuario (`root` / Administrador) ni drivers de captura (`Npcap` / `libpcap`).

---

## 2. Arquitectura del Módulo (Referencia para Implementación)

Cuando la Persona 1 implemente esta fase, deberá estructurar su módulo en `/backend/` (por ejemplo, `/backend/packet_engine.py` o `/backend/osi_parser.py`) exponiendo funciones puras de parseo y una clase controladora de captura:

- `parse_scapy_packet(packet, packet_id: int, start_time: float, mode: str) -> dict`: Recibe un objeto paquete de Scapy y retorna un diccionario serializable a JSON que cumple el contrato `CapturedPacket`.
- `generate_mock_packet(packet_id: int, start_time: float) -> dict`: Genera un paquete sintético variado (TCP, UDP, HTTP, DNS, ICMP, ARP) que cumple exactamente el mismo esquema JSON.

---

## 3. Desglose Técnico Requerido por Capa del Modelo OSI

### 3.1 Capa 2: Enlace de Datos (`osi_layers.layer2_datalink`)
Extraída de la cabecera `Ether` (IEEE 802.3 / Ethernet II) o capa de enlace equivalente:
- **`protocol`** (`string`): Nombre del protocolo de enlace, por defecto `"Ethernet II"` (o `"Loopback"` si se captura en interfaz loopback sin trama Ethernet, rellenando MACs con `"00:00:00:00:00:00"`).
- **`src_mac`** (`string`): Dirección MAC de origen normalizada en mayúsculas o minúsculas separada por dos puntos `XX:XX:XX:XX:XX:XX` (ej. `"00:1A:2B:3C:4D:5E"`). Validada mediante expresión regular `^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$`.
- **`dst_mac`** (`string`): Dirección MAC de destino en formato `XX:XX:XX:XX:XX:XX` (ej. `"FF:FF:FF:FF:FF:FF"` en tramas Broadcast ARP).
- **`ethertype`** (`string`): Valor hexadecimal con prefijo `0x` de 4 dígitos (ej. `"0x0800"` para IPv4, `"0x0806"` para ARP, `"0x86dd"` para IPv6).
- **`ethertype_name`** (`string`, opcional): Etiqueta descriptiva (`"IPv4"`, `"ARP"`, `"IPv6"`).

### 3.2 Capa 3: Red (`osi_layers.layer3_network`)
Extraída de las capas `IP` (IPv4), `IPv6` o `ARP`:
- **`protocol`** (`string`): `"IPv4"`, `"IPv6"` o `"ARP"`.
- **`src_ip`** (`string`):
  - En IPv4/IPv6: campo `ip.src`.
  - En ARP: campo `arp.psrc` (Protocol Source Address).
- **`dst_ip`** (`string`):
  - En IPv4/IPv6: campo `ip.dst`.
  - En ARP: campo `arp.pdst` (Protocol Destination Address).
- **`ttl`** (`number | null`):
  - En IPv4: `ip.ttl` (entero entre `1` y `255`).
  - En IPv6: `ipv6.hlim` (Hop Limit).
  - En ARP: `null` (ARP no posee campo TTL).
- **`length`** (`number`): Longitud total del paquete en bytes (`len(packet)` o `ip.len`), entero positivo.
- **`protocol_id`** (`number | null`, opcional): Identificador numérico IANA (`6` = TCP, `17` = UDP, `1` = ICMP, `null` en ARP).

### 3.3 Capa 4: Transporte (`osi_layers.layer4_transport`)
Extraída de las capas `TCP`, `UDP` o `ICMP`. Si el paquete es `ARP` u otro protocolo sin capa 4, puede establecerse en un objeto con `protocol: "NONE"` o `null` según el protocolo:
- **`protocol`** (`'TCP' | 'UDP' | 'ICMP' | 'NONE'`): Protocolo de transporte detectado.
- **`src_port`** (`number | null`):
  - En TCP/UDP: entero entre `1` y `65535` (`tcp.sport` / `udp.sport`).
  - En ICMP/ARP: `null`.
- **`dst_port`** (`number | null`):
  - En TCP/UDP: entero entre `1` y `65535` (`tcp.dport` / `udp.dport`).
  - En ICMP/ARP: `null`.
- **`flags`** (`string | null`):
  - En TCP: representación legible de banderas activas (ej. `"SYN"`, `"SYN, ACK"`, `"PSH, ACK"`, `"FIN, ACK"`, `"RST"`).
  - En ICMP: descripción del tipo y código (ej. `"Echo Request (Type 8, Code 0)"`, `"Echo Reply (Type 0, Code 0)"`).
  - En UDP/ARP: `null`.
- **`checksum`** (`string | null`): Suma de verificación de la cabecera de transporte formateada en hexadecimal con prefijo `0x` (ej. `"0x4f2a"`).
- **`seq_num` / `ack_num`** (`number | null`, opcional): Números de secuencia y acuse de recibo en segmentos TCP.

### 3.4 Capa 7: Aplicación y Carga Útil (`osi_layers.layer7_application`)
Extraída de la capa `Raw` (`packet[Raw].load`) e inferencia heurística por puertos/contenido:
- **`protocol_hint`** (`string`): Clasificación del protocolo de aplicación:
  - Puerto 80 o métodos HTTP (`GET`, `POST`, `HTTP/1.1`): `"HTTP"`
  - Puerto 443: `"HTTPS/TLS"`
  - Puerto 53: `"DNS"`
  - Puerto 22: `"SSH"`
  - Paquete ICMP: `"ICMP Data"`
  - Paquete ARP: `"ARP Payload"`
  - Cualquier otro con payload: `"RAW"` o `"No Payload"`
- **`payload_size`** (`number`): Cantidad de bytes en la carga útil de aplicación (`len(raw_bytes)`), o `0` si el paquete no contiene datos de capa 7 (por ejemplo, un `TCP SYN` puro).
- **`hex_dump`** (`string`): Primeros 64 a 128 bytes de la carga útil convertidos a pares hexadecimales separados por un espacio (ej. `"47 45 54 20 2f 20 48 54 54 50 2f 31 2e 31"`). Cadena vacía `""` si `payload_size == 0`.
- **`ascii_preview`** (`string`): Sanitización estricta de los bytes de carga útil:
  - Todo byte dentro del rango ASCII imprimible (`32 <= byte <= 126`) se conserva como su carácter correspondiente.
  - Todo byte fuera de ese rango (caracteres de control, saltos binarios, bytes nulos `0x00`) **DEBE** reemplazarse por un punto `"."` para evitar romper el renderizado DOM o inyectar caracteres inválidos en JSON.

---

## 4. Requisito Obligatorio: Modo Mock / Simulación (`mode: "mock"`)

Dado que la captura de paquetes reales mediante Scapy requiere privilegios elevados (`sudo` en Linux/macOS o consola de Administrador + Npcap en Windows), el motor **DEBE** incluir un generador de tráfico simulado (`MockPacketGenerator`) con las siguientes características:

1. **Activación explícita o por Fallback:**
   - Puede seleccionarse explícitamente cuando el usuario o el entorno de pruebas solicita `mode: "mock"`.
   - Si se solicita `mode: "real"` pero el sistema operativo lanza `PermissionError`, `Scapy_Exception` o ausencia de proveedor pcap, el motor debe reportar el aviso e informar la disponibilidad del modo `"mock"`.
2. **Diversidad de Tráfico Simulado:**
   - El generador Mock debe rotar o elegir entre plantillas realistas que cubran al menos:
     - **HTTP GET/POST** sobre TCP (Puerto 80, payload ASCII legible).
     - **HTTPS / TLS Handshake** sobre TCP (Puerto 443, flags `SYN` / `PSH, ACK`).
     - **Consulta DNS** sobre UDP (Puerto 53).
     - **Ping ICMP** (`Echo Request` y `Echo Reply`, sin puertos de Capa 4).
     - **Resolución ARP** (`Who has 192.168.1.1? Tell 192.168.1.105`, Broadcast MAC `FF:FF:FF:FF:FF:FF`).

---

## 5. Criterios de Aceptación (Validación en `Spec01CaptureTest.tsx`)

Para que la Fase 1 sea certificada como aprobada en el entorno `Spec01CaptureTest.tsx`, todo paquete JSON emitido por el motor de la Persona 1 debe superar los siguientes 10 controles automáticos:

1. **[Metadatos Raíz]:** Presencia de `id` (numérico > 0), `timestamp` (string no vacío) y objeto `summary` completo (`src_ip`, `dst_ip`, `protocol`, `length`, `info`).
2. **[Integridad de Capas OSI]:** Existencia del objeto contenedor `osi_layers` con las claves `layer2_datalink`, `layer3_network`, `layer4_transport` y `layer7_application`.
3. **[Capa 2 — Formato MAC]:** `src_mac` y `dst_mac` cumplen el patrón hexadecimal `XX:XX:XX:XX:XX:XX`.
4. **[Capa 2 — EtherType]:** `ethertype` tiene formato hexadecimal válido con prefijo `0x` (ej. `0x0800`, `0x0806`, `0x86DD`).
5. **[Capa 3 — Direccionamiento IP]:** `src_ip` y `dst_ip` son direcciones IPv4/IPv6 válidas y no vacías.
6. **[Capa 3 — Métricas de Red]:** `length` es un número entero mayor a 0, y `ttl` es un entero entre 1 y 255 (o `null` exclusivamente cuando el protocolo de Capa 3 es `ARP`).
7. **[Capa 4 — Coherencia de Puertos]:** Cuando `layer4_transport.protocol` es `TCP` o `UDP`, `src_port` y `dst_port` son enteros en el rango `1..65535`. Cuando es `ICMP` o `NONE`, ambos puertos son `null`.
8. **[Capa 4 — Checksum y Flags]:** `checksum` presenta formato hexadecimal `0x...` (o `null` si no aplica) y `flags` es string descriptivo o `null`.
9. **[Capa 7 — Consistencia de Payload]:** `payload_size` es un entero `>= 0`. Si `payload_size > 0`, `hex_dump` y `ascii_preview` no están vacíos.
10. **[Capa 7 — Sanitización ASCII Segura]:** `ascii_preview` contiene únicamente caracteres ASCII imprimibles (códigos 32 al 126) sin caracteres de control binarios crudos.

