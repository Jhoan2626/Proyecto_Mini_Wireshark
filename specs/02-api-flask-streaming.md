# Especificación 02: Servidor Flask, API REST y Streaming en Tiempo Real

- **Fase:** 2 de 4
- **Responsable:** Persona 1 (Backend y Datos)
- **Entorno de Prueba Vinculado:** [`/frontend/src/tests/Spec02ApiStreamTest.tsx`](../frontend/src/tests/Spec02ApiStreamTest.tsx)
- **Estado Inicial:** Pendiente de Implementación
- **Dependencias:** [`/specs/01-motor-captura-osi.md`](./01-motor-captura-osi.md)

---

## 1. Objetivo y Alcance

Construir el servidor HTTP en **Flask** (dentro de `/backend/app.py` o equivalente) que exponga el motor de captura Scapy/Mock de la Fase 1 hacia el cliente web React mediante una API REST JSON con soporte de transmisión continua en tiempo real, manejo seguro de concurrencia (hilos en segundo plano) y política **CORS** habilitada.

---

## 2. Configuración del Servidor y CORS

- **Host y Puerto por Defecto:** `http://127.0.0.1:5000` (o `0.0.0.0:5000`).
- **Política CORS:** Debe habilitarse `flask_cors.CORS(app, resources={r"/api/*": {"origins": "*"}})` para permitir peticiones `GET`, `POST` y `OPTIONS` desde el servidor de desarrollo del frontend (ej. `http://localhost:5173` o `http://localhost:3000`).
- **Formato de Respuesta:** Todas las respuestas (incluidos los errores `4xx` y `5xx`) deben retornar cabecera `Content-Type: application/json`.

---

## 3. Especificación de Endpoints Requeridos

### 3.1 `GET /api/status`
Devuelve el estado operativo actual del motor de captura y las métricas acumuladas de la sesión.

- **Respuesta Exitosa (`200 OK`):**
```json
{
  "status": "ok",
  "is_capturing": true,
  "mode": "mock",
  "interface": "eth0 (Simulated)",
  "packet_count": 42,
  "started_at": "2026-10-27T12:05:00.000Z",
  "uptime_seconds": 18.4
}
```

### 3.2 `POST /api/capture/start`
Inicia el hilo de captura de paquetes en segundo plano si no está activo.

- **Cuerpo de Petición (`application/json`, opcional):**
```json
{
  "mode": "mock",
  "interface": null,
  "bpf_filter": ""
}
```
  - `mode`: `"real"` | `"mock"` (por defecto `"mock"` si no se especifica o si `"real"` falla por permisos, salvo que se pida error explícito).
  - `interface`: Nombre de interfaz de red opcional (ej. `"Wi-Fi"`, `"eth0"`).
  - `bpf_filter`: Filtro Berkeley Packet Filter opcional (ej. `"tcp or udp"`).

- **Respuesta Exitosa (`200 OK`):**
```json
{
  "status": "started",
  "is_capturing": true,
  "mode": "mock",
  "message": "Captura iniciada correctamente en modo mock."
}
```
- **Idempotencia:** Si la captura ya estaba activa, debe responder `200 OK` indicando `"status": "already_running"` con el estado actual sin duplicar hilos de captura.

### 3.3 `POST /api/capture/stop`
Detiene de forma limpia (`graceful stop`) el hilo de captura en segundo plano conservando en memoria los paquetes capturados hasta ese instante.

- **Respuesta Exitosa (`200 OK`):**
```json
{
  "status": "stopped",
  "is_capturing": false,
  "packet_count": 42,
  "message": "Captura detenida correctamente."
}
```

### 3.4 `POST /api/capture/clear`
Vacía el buffer en memoria de paquetes capturados y reinicia el contador secuencial de `id` a `0`. Puede ejecutarse tanto con la captura detenida como en curso.

- **Respuesta Exitosa (`200 OK`):**
```json
{
  "status": "cleared",
  "packet_count": 0,
  "message": "Buffer de paquetes vaciado correctamente."
}
```

### 3.5 `GET /api/packets` (Consulta Paginada / Incremental y Streaming)
Entrega la lista de paquetes capturados que cumplen el contrato `CapturedPacket`.

- **Parámetros Query Soportados (`GET /api/packets?since_id=10&limit=100`):**
  - `since_id` (`int`, opcional, default `0`): Retorna únicamente los paquetes cuyo `id > since_id`. Esto permite al frontend hacer *polling* incremental de baja latencia sin volver a transferir paquetes ya recibidos.
  - `limit` (`int`, opcional, default `200`, máx `1000`): Cantidad máxima de paquetes a devolver en una sola respuesta.
  - `protocol` (`string`, opcional): Filtro opcional por protocolo (`TCP`, `UDP`, `ICMP`, `ARP`, `HTTP`, `DNS`).

- **Respuesta Exitosa (`200 OK`):**
```json
{
  "status": "ok",
  "is_capturing": true,
  "mode": "mock",
  "total_captured": 45,
  "returned_count": 2,
  "packets": [
    {
      "id": 44,
      "timestamp": "2026-10-27T12:05:14.128Z",
      "summary": { "...": "..." },
      "osi_layers": { "...": "..." }
    },
    {
      "id": 45,
      "timestamp": "2026-10-27T12:05:14.640Z",
      "summary": { "...": "..." },
      "osi_layers": { "...": "..." }
    }
  ]
}
```

*(Opcionalmente, el backend puede exponer `GET /api/packets/stream` mediante Server-Sent Events `text/event-stream`, pero `GET /api/packets` es obligatorio como contrato base universal).*

---

## 4. Arquitectura de Concurrencia y Seguridad de Hilos (Thread-Safety)

El sniffing de red es una operación de entrada/salida continua que **NUNCA** debe ejecutarse en el hilo principal de atención de peticiones HTTP de Flask:

1. **Hilo / Sniffer en Segundo Plano:**
   - En modo `"real"`, utilizar `scapy.all.AsyncSniffer(prn=callback, store=False)` que gestiona su propio hilo daemon interno.
   - En modo `"mock"`, utilizar un `threading.Thread(target=mock_loop, daemon=True)` controlado por un `threading.Event()` (`stop_event`) que emita entre 1 y 3 paquetes simulados por segundo.
2. **Sincronización con `threading.Lock`:**
   - El almacenamiento en memoria (`collections.deque(maxlen=2000)`) debe estar protegido por un `threading.Lock()` tanto al insertar nuevos paquetes desde el hilo productor como al leer o limpiar (`clear`) desde las rutas HTTP de Flask.
3. **Límite de Memoria (Ring Buffer):**
   - El buffer debe tener una capacidad máxima configurable (ej. `MAX_PACKETS = 2000`) para evitar fugas de memoria (`MemoryError`) durante capturas prolongadas.

---

## 5. Criterios de Aceptación (Validación en `Spec02ApiStreamTest.tsx`)

El entorno de diagnóstico `Spec02ApiStreamTest.tsx` certificará esta fase verificando:

1. **[Conectividad y CORS]:** Las peticiones `fetch` desde el navegador hacia `http://localhost:5000/api/status` responden con HTTP `200 OK` sin errores de bloqueo CORS.
2. **[Ciclo de Vida de Captura]:**
   - `POST /api/capture/start` cambia `is_capturing` a `true`.
   - `POST /api/capture/stop` cambia `is_capturing` a `false` inmediatamente sin colgar el servidor.
   - `POST /api/capture/clear` restablece `packet_count` a `0` y vacía la lista devuelta por `/api/packets`.
3. **[No Bloqueo y Latencia]:** Mientras la captura está activa (`is_capturing: true`), los endpoints `/api/status` y `/api/packets` responden en un tiempo menor a `250 ms`.
4. **[Flujo Incremental (`since_id`)]:** Llamadas sucesivas a `GET /api/packets?since_id=X` entregan únicamente paquetes nuevos con `id > X` y cada paquete cumple el contrato `CapturedPacket` de la Fase 1.

