# Especificación 03: Tabla de Tráfico en Tiempo Real y Controles de Captura

- **Fase:** 3 de 4
- **Responsable:** Persona 2 (Frontend y Visualización)
- **Entorno de Prueba Vinculado:** [`/frontend/src/tests/Spec03TrafficTableTest.tsx`](../frontend/src/tests/Spec03TrafficTableTest.tsx)
- **Estado Inicial:** Pendiente de Implementación
- **Dependencias:** [`/specs/02-api-flask-streaming.md`](./02-api-flask-streaming.md) y Contrato Global en [`/PROJECT_CONTEXT.md`](../PROJECT_CONTEXT.md)

---

## 1. Objetivo y Alcance

Construir en **React + TypeScript + Tailwind CSS** (dentro de `/frontend/src/components/`) el panel principal de monitoreo de tráfico en tiempo real. Este módulo permite al usuario controlar el estado de la captura (Iniciar, Pausar/Detener, Limpiar y alternar entre modo Real y Mock), filtrar paquetes instantáneamente por protocolo o dirección IP, visualizar la lista continua de paquetes entrantes con codificación cromática y seleccionar cualquier paquete para su análisis profundo en la Fase 4.

---

## 2. Componentes Arquitectónicos Especificados

Cuando la Persona 2 implemente esta fase en `/frontend/src/components/`, deberá estructurar la interfaz en tres bloques funcionales (integrados o modulares):

### 2.1 Barra de Control de Captura (`CaptureControlBar`)
Panel superior de acciones operativas:
- **Indicador de Estado en Vivo:** Badge visual que distingue claramente entre `"CAPTURANDO"` (indicador pulsante verde) y `"DETENIDO / EN PAUSA"` (indicador gris/ámbar).
- **Botón Iniciar Captura (`Start`):** Invoca `POST /api/capture/start` con el modo seleccionado (`real` o `mock`). Se deshabilita cuando `isCapturing === true`.
- **Botón Pausar / Detener (`Stop`):** Invoca `POST /api/capture/stop`. Se deshabilita cuando `isCapturing === false`.
- **Botón Limpiar (`Clear`):** Invoca `POST /api/capture/clear` y limpia el estado local de paquetes y la selección activa.
- **Selector de Modo (`Real` vs `Mock`):** Control tipo *Segmented Toggle* o `<select>` que permite elegir entre captura de red física (`real`) o simulación segura (`mock`).
- **Contadores de Sesión:** Muestra el total de paquetes capturados y el número de paquetes visibles tras aplicar filtros.

### 2.2 Barra de Filtrado Rápido (`TrafficFilterBar`)
Barra de búsqueda e inspección instantánea del lado del cliente:
- **Filtro por Protocolo (Píldoras / Botones rápidos o Select):**
  - Opciones: `ALL`, `TCP`, `UDP`, `HTTP`, `HTTPS`, `DNS`, `ICMP`, `ARP`.
- **Filtro por Dirección IP / Texto Libre (`Search Input`):**
  - Permite escribir una IP parcial o completa (ej. `"192.168.1."`, `"8.8.8.8"`) o texto de resumen (`"SYN"`, `"GET"`).
  - Filtra en tiempo real coincidiendo contra `summary.src_ip`, `summary.dst_ip` o `summary.info`.
- **Botón de Reseteo de Filtros:** Limpia inmediatamente cualquier filtro activo cuando hay criterios aplicados.

### 2.3 Tabla de Paquetes en Tiempo Real (`TrafficPacketTable`)
Tabla de alta densidad inspirada en Wireshark con las siguientes **7 columnas obligatorias**:

| Columna | Campo Origen (`CapturedPacket`) | Formato / Estilo Requerido |
| :--- | :--- | :--- |
| **1. No.** | `packet.id` | Entero monoespaciado alineado a la izquierda/derecha (`font-mono`). |
| **2. Tiempo** | `packet.relative_time` o `packet.timestamp` | Segundos relativos con milisegundos (`0.128s`) o hora `HH:mm:ss.SSS` (`font-mono`). |
| **3. IP Origen** | `packet.summary.src_ip` | Dirección IPv4/IPv6 de origen (`font-mono`). |
| **4. IP Destino** | `packet.summary.dst_ip` | Dirección IPv4/IPv6 de destino (`font-mono`). |
| **5. Protocolo** | `packet.summary.protocol` | Badge con color semántico según protocolo (`TCP`, `UDP`, `HTTP`, `DNS`, `ICMP`, `ARP`). |
| **6. Longitud** | `packet.summary.length` | Tamaño en bytes (ej. `214 B`, `font-mono`). |
| **7. Info** | `packet.summary.info` | Resumen técnico del paquete truncado con `text-ellipsis` si excede el ancho. |

---

## 3. Reglas de Interacción, Colorimetría y Rendimiento

1. **Codificación de Color por Protocolo (Estilo Wireshark):**
   - `TCP`: Tonos índigo/azul (`bg-indigo-500/15 text-indigo-300 border-indigo-500/30`).
   - `UDP` / `DNS`: Tonos cian/celeste (`bg-cyan-500/15 text-cyan-300 border-cyan-500/30`).
   - `HTTP` / `HTTPS`: Tonos esmeralda/verde (`bg-emerald-500/15 text-emerald-300 border-emerald-500/30`).
   - `ICMP`: Tonos ámbar/amarillo (`bg-amber-500/15 text-amber-300 border-amber-500/30`).
   - `ARP`: Tonos púrpura/violeta (`bg-purple-500/15 text-purple-300 border-purple-500/30`).
2. **Selección de Fila Activa (`selectedPacketId` y `onSelectPacket`):**
   - Hacer clic sobre cualquier fila dispara el callback `onSelectPacket(packet: CapturedPacket)`.
   - La fila actualmente seleccionada debe resaltarse visualmente (ej. borde izquierdo acentuado y fondo `bg-blue-600/20` o `ring-1 ring-blue-500`).
3. **Auto-Scroll Inteligente:**
   - Opcionalmente, proveer un toggle de *Auto-scroll* para seguir el último paquete capturado sin perder la selección si el usuario está inspeccionando un paquete específico.

---

## 4. Contrato de Props para Integración con el Arnés de Pruebas

El componente principal de tabla que desarrolle la Persona 2 deberá aceptar como mínimo la siguiente interfaz de propiedades para poder conectarse tanto al backend real como al banco de pruebas `Spec03TrafficTableTest.tsx`:

```typescript
export interface TrafficTableProps {
  packets: CapturedPacket[];
  selectedPacketId: number | null;
  onSelectPacket: (packet: CapturedPacket) => void;
  isCapturing?: boolean;
  captureMode?: CaptureMode;
  onStartCapture?: (mode: CaptureMode) => void;
  onStopCapture?: () => void;
  onClearPackets?: () => void;
}
```

---

## 5. Criterios de Aceptación (Validación en `Spec03TrafficTableTest.tsx`)

Para certificar la Fase 3 en `Spec03TrafficTableTest.tsx`, se comprobarán los siguientes escenarios:

1. **[Renderizado de las 7 Columnas]:** La tabla muestra correctamente `No.`, `Tiempo`, `IP Origen`, `IP Destino`, `Protocolo`, `Longitud` e `Info` para un flujo de paquetes heterogéneos (`TCP`, `UDP`, `HTTP`, `DNS`, `ICMP`, `ARP`).
2. **[Filtrado por Protocolo]:** Al activar el filtro de un protocolo específico (ej. `ICMP` o `ARP`), únicamente permanecen visibles las filas cuyo protocolo coincida exactamente, actualizando el contador de paquetes filtrados.
3. **[Filtrado por IP / Búsqueda]:** Al introducir una dirección IP (ej. `192.168.1.1`) en el buscador, se filtran en tiempo real las filas que contengan dicha IP en `src_ip` o `dst_ip`.
4. **[Evento `onSelectPacket` y Estado Activo]:** Al hacer clic en una fila de la tabla, se invoca `onSelectPacket` entregando el objeto `CapturedPacket` íntegro (con sus 4 capas OSI intactas) y la fila queda marcada como activa.
5. **[Rendimiento de Flujo Continuo]:** La tabla soporta la inyección periódica de ráfagas de paquetes simulados sin congelar la interfaz ni perder el filtro o el paquete seleccionado por el usuario.

