# Especificación 04: Inspector Visual Interactivo de Capas del Modelo OSI

- **Fase:** 4 de 4
- **Responsable:** Persona 2 (Frontend y Visualización)
- **Entorno de Prueba Vinculado:** [`/frontend/src/tests/Spec04OsiInspectorTest.tsx`](../frontend/src/tests/Spec04OsiInspectorTest.tsx)
- **Estado Inicial:** Pendiente de Implementación
- **Dependencias:** [`/specs/03-tabla-trafico-tiempo-real.md`](./03-tabla-trafico-tiempo-real.md) y Contrato Global en [`/PROJECT_CONTEXT.md`](../PROJECT_CONTEXT.md)

---

## 1. Objetivo y Alcance

Construir en **React + TypeScript + Tailwind CSS** (dentro de `/frontend/src/components/`) el **Inspector Visual del Modelo OSI**, un panel interactivo y pedagógico que se actualiza al seleccionar cualquier paquete en la tabla de tráfico de la Fase 3.

A diferencia de un visor de texto plano, este inspector tiene como misión **enseñar visualmente** cómo funciona el encapsulamiento en redes de computadores: muestra la pila de capas del Modelo OSI, resalta las capas presentes en el paquete seleccionado, permite expandir/colapsar cada capa mediante tarjetas interactivas con código de color, explica pedagógicamente la función de cada campo de cabecera y presenta un visor dual Hexadecimal/ASCII de la carga útil.

---

## 2. Arquitectura Visual y Componentes del Inspector

### 2.1 Diagrama de Pila de Encapsulamiento OSI (`OsiStackVisualizer`)
En la parte superior del inspector debe mostrarse una barra o diagrama jerárquico horizontal/vertical de las capas del Modelo OSI (enfocado en las capas prácticas analizadas: **Capa 2 Enlace → Capa 3 Red → Capa 4 Transporte → Capa 7 Aplicación**):
- Muestra visualmente el flujo de encapsulamiento/desencapsulamiento.
- Si un paquete no utiliza Capa 4 (por ejemplo, un paquete **ARP** que opera entre Capa 2 y Capa 3), la tarjeta o indicador de **Capa 4 (Transporte)** debe mostrarse en estado **"No aplicable / Sin cabecera de Transporte"** de forma clara y educativa, explicando por qué ARP no emplea puertos TCP/UDP.

### 2.2 Tarjetas Desplegables por Capa con Código de Color (`OsiLayerAccordionCard`)
Cada capa debe representarse como una tarjeta interactiva (acordeón o árbol colapsable) con identidad cromática propia:

| Capa OSI | Nombre Técnico | Color Identificador Sugerido | Unidad de Datos (PDU) | Campos Obligatorios a Renderizar |
| :--- | :--- | :--- | :--- | :--- |
| **Capa 2** | **Enlace de Datos** (`layer2_datalink`) | **Ámbar / Naranja** (`amber-500`) | **Trama (Frame)** | `protocol`, `src_mac`, `dst_mac`, `ethertype` |
| **Capa 3** | **Red** (`layer3_network`) | **Esmeralda / Verde** (`emerald-500`) | **Paquete (Packet)** | `protocol`, `src_ip`, `dst_ip`, `ttl`, `length` |
| **Capa 4** | **Transporte** (`layer4_transport`) | **Azul / Índigo** (`blue-500`) | **Segmento / Datagrama** | `protocol`, `src_port`, `dst_port`, `flags`, `checksum` |
| **Capa 7** | **Aplicación / Payload** (`layer7_application`) | **Púrpura / Fucsia** (`purple-500`) | **Datos (Payload)** | `protocol_hint`, `payload_size`, `hex_dump`, `ascii_preview` |

### 2.3 Explicaciones Pedagógicas Integradas (`PedagogicalFieldTooltip / Description`)
Cada capa y cada campo clave dentro de las tarjetas desplegables debe incluir una breve descripción educativa pensada para estudiantes de Redes de Computadores:
- **En Capa 2 (Enlace):**
  - *MAC Origen / Destino:* Explica que son direcciones físicas de 48 bits grabadas en la tarjeta de red (NIC) utilizadas para la entrega salto a salto dentro de la misma red local (LAN). Destaca cuando `dst_mac` es `FF:FF:FF:FF:FF:FF` (Broadcast a todos los nodos de la LAN).
  - *EtherType:* Explica que indica al sistema operativo qué protocolo de Capa 3 viaja encapsulado dentro de la trama Ethernet (`0x0800` = IPv4, `0x0806` = ARP, `0x86DD` = IPv6).
- **En Capa 3 (Red):**
  - *IP Origen / Destino:* Explica el direccionamiento lógico jerárquico que permite enrutar paquetes a través de múltiples subredes e Internet.
  - *TTL (Time To Live):* Explica que es un contador de saltos que cada router decrementa en 1 para evitar bucles infinitos de enrutamiento en la red.
  - *Longitud:* Tamaño total del paquete IP en bytes (cabeceras + carga útil).
- **En Capa 4 (Transporte):**
  - *Puertos Origen / Destino:* Explica la multiplexación de procesos: cómo los números de puerto identifican la aplicación exacta en el host origen (puerto efímero) y en el servidor destino (puerto bien conocido, ej. `80` HTTP, `443` HTTPS, `53` DNS).
  - *Flags TCP / Tipo ICMP:* Explica el control de sesión en TCP (`SYN` inicio de conexión 3-way handshake, `ACK` confirmación, `PSH` entrega inmediata a capa 7, `FIN` cierre) o los mensajes de diagnóstico en ICMP.
  - *Checksum:* Explica la verificación de integridad contra corrupción de bits en tránsito.
- **En Capa 7 (Aplicación):**
  - *Protocol Hint y Payload Size:* Explica cómo los bytes crudos representan mensajes del protocolo de aplicación o datos cifrados (en TLS/HTTPS).

### 2.4 Visor Dual de Carga Útil (`HexAsciiPayloadViewer`)
Dentro de la tarjeta de **Capa 7**, debe incluirse un visor de bytes estilo analizador de protocolos:
- **Columna / Panel Hexadecimal (`hex_dump`):** Muestra los pares hexadecimales en fuente monoespaciada (`font-mono`).
- **Columna / Panel ASCII (`ascii_preview`):** Muestra la traducción segura a texto legible lado a lado.
- **Estado sin Payload (`payload_size === 0`):** Si el paquete no transporta datos de aplicación (ej. un segmento `TCP SYN` de establecimiento de conexión), muestra un aviso informativo explicando que el paquete solo contiene cabeceras de control sin carga útil de Capa 7.

---

## 3. Contrato de Props para Integración con el Arnés de Pruebas

El componente inspector que implemente la Persona 2 deberá aceptar como mínimo la siguiente interfaz de propiedades:

```typescript
export interface OsiInspectorProps {
  packet: CapturedPacket | null;
  defaultExpandedLayers?: Array<'layer2' | 'layer3' | 'layer4' | 'layer7'>;
  showPedagogicalGuides?: boolean;
}
```

---

## 4. Criterios de Aceptación (Validación en `Spec04OsiInspectorTest.tsx`)

El banco de pruebas `Spec04OsiInspectorTest.tsx` validará el cumplimiento de la Fase 4 mediante los siguientes controles:

1. **[Estado Vacío (Sin Selección)]:** Cuando `packet` es `null`, muestra un estado instructivo invitando al usuario a seleccionar un paquete de la tabla de tráfico sin producir errores de referencia nula (`TypeError`).
2. **[Desglose Completo de 4 Capas]:** Para un paquete `HTTP/TCP` o `DNS/UDP`, renderiza correctamente todos los atributos de Capa 2 (`src_mac`, `dst_mac`, `ethertype`), Capa 3 (`src_ip`, `dst_ip`, `ttl`, `length`), Capa 4 (`protocol`, `src_port`, `dst_port`, `flags`, `checksum`) y Capa 7 (`protocol_hint`, `payload_size`, `hex_dump`, `ascii_preview`).
3. **[Manejo de Casos Especiales (ARP e ICMP)]:**
   - Al inspeccionar un paquete `ARP` (`ttl: null`, sin puertos TCP/UDP), el inspector indica claramente la ausencia de puertos de Capa 4 y el uso de Broadcast MAC (`FF:FF:FF:FF:FF:FF`).
   - Al inspeccionar un paquete `ICMP`, muestra el tipo de mensaje en `flags` y gestiona `src_port: null` y `dst_port: null` sin mostrar `undefined` o `NaN`.
4. **[Interactividad de Acordeones y Guías Pedagógicas]:** Permite expandir y contraer individualmente o en bloque las tarjetas de cada capa OSI y alternar la visualización de las explicaciones pedagógicas de cada campo.
5. **[Visor Hexadecimal y ASCII Sincronizado]:** Muestra el volcado hexadecimal y la vista previa ASCII en formato monoespaciado cuando `payload_size > 0`, y el mensaje explicativo de paquete de control cuando `payload_size === 0`.

