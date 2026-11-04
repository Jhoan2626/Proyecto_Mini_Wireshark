# Especificación 05: Rediseño Frontend Unificado y Tema Claro Profesional (Light Mode)

- **Fase:** 5 de 5 (Consolidación de Producción y Experiencia de Usuario)
- **Responsables:** Product Designer Senior (UI/UX) & Arquitecto de Software Frontend
- **Entorno de Prueba Vinculado:** [`/frontend/src/tests/Spec05UnifiedUiTest.tsx`](../frontend/src/tests/Spec05UnifiedUiTest.tsx)
- **Estado Actual:** Completada y Verificada (6/6 Criterios de Aceptación Aprobados)
- **Dependencias:** [`/specs/01-motor-captura-osi.md`](./01-motor-captura-osi.md), [`/specs/02-api-flask-streaming.md`](./02-api-flask-streaming.md), [`/specs/03-tabla-trafico-tiempo-real.md`](./03-tabla-trafico-tiempo-real.md), [`/specs/04-inspector-visual-osi.md`](./04-inspector-visual-osi.md) y Contrato Global en [`/PROJECT_CONTEXT.md`](../PROJECT_CONTEXT.md)

---

## 1. Objetivo y Alcance

### 1.1 Declaración de Propósito
Transformar la interfaz actual —actualmente fragmentada en cuatro pestañas de verificación técnica bajo un tema oscuro de arnés de prueba (`TestSuiteRunner.tsx` con "Fase 1", "Persona 1/2", badges de "PASS" y controles crudos de depuración)— en una **Aplicación Web Unificada de Producción con Tema Claro Profesional (Clean Light UI)**.

La nueva experiencia está concebida para:
1. **Presentación de Alto Impacto:** Brindar una estética moderna, limpia y pulcra inspirada en herramientas SaaS de primer nivel (como Stripe Dashboard, Vercel Light y Linear Light).
2. **Pedagogía Intuitiva:** Permitir que cualquier estudiante, profesor o evaluador técnico comprenda de forma inmediata qué está ocurriendo en la red local y cómo viaja y se encapsula la información a través de las capas del **Modelo OSI**, sin requerir explicaciones externas ni verse abrumado por jerga de testing.
3. **Flujo de Trabajo en Pantalla Única (Single-Screen Dashboard):** Consolidar la barra de controles, la tabla de captura en vivo y el inspector visual de capas en un único layout de 3 zonas interactivo y reactivo en tiempo real.
4. **Preservación Segura de Pruebas SDD:** Aislar el conjunto completo de arneses de certificación (`TestSuiteRunner`) bajo un botón discreto de acceso secundario (**"Laboratorio QA"**), garantizando que ningún componente de evaluación interna interfiera con la vista de usuario final.

---

## 2. Sistema de Diseño Visual: Clean Light UI

El diseño visual se rige estrictamente por una paleta clara, neutra, de alto contraste y con toques de color semántico pastel para evitar la fatiga visual y destacar la jerarquía de protocolos.

### 2.1 Superficies, Fondos y Bordes
| Elemento | Clase Tailwind CSS | Propósito y Sensación Visual |
| :--- | :--- | :--- |
| **Fondo Global (Canvas)** | `bg-slate-50` / `bg-zinc-50` | Base neutra, sutil y descansada que da soporte a los contenedores principales. |
| **Superficie de Paneles / Tarjetas** | `bg-white border border-slate-200 shadow-xs rounded-xl` | Contenedores blancos puros que separan nítidamente el contenido del fondo. |
| **Encabezados de Tablas y Paneles** | `bg-slate-50/80 border-b border-slate-200` | Delimitación clara con baja carga cognitiva. |
| **Divisores y Separadores** | `border-slate-200` / `divide-slate-100` | Líneas finas de 1 píxel sin bordes negros ni contrastes agresivos. |
| **Fila Hover (Tabla)** | `hover:bg-slate-50/80 transition-colors` | Retroalimentación sutil al desplazar el cursor. |
| **Fila Seleccionada (Tabla)** | `bg-blue-50/70 border-l-4 border-blue-600` | Resaltado nítido e inconfundible del paquete activo bajo inspección. |

### 2.2 Jerarquía Tipográfica y Contraste
| Nivel Tipográfico | Clases Tailwind CSS | Uso Específico |
| :--- | :--- | :--- |
| **Títulos Principales** | `text-slate-900 font-semibold tracking-tight` | Nombre de la aplicación, títulos de paneles y modales. |
| **Cuerpo y Lectura Principal** | `text-slate-800 text-sm font-normal` | Textos descriptivos, celdas de tabla y resúmenes de paquetes. |
| **Metadatos y Etiquetas** | `text-slate-500 text-xs font-medium` | Labels de cabecera de tabla, contadores y leyendas explicativas. |
| **Datos Técnicos (Píldoras)** | `font-mono text-xs text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/60` | Direcciones IP, direcciones MAC, puertos, flags, TTL y números de secuencia. |
| **Bloque Hexadecimal / ASCII** | `font-mono text-xs text-slate-800 bg-slate-100/80 p-3 rounded-lg border border-slate-200` | Visor de carga útil cruda (Payload dump). |

### 2.3 Semántica de Colores Pastel para Protocolos y Capas OSI
Para que la tabla y el inspector sean pedagógicos de un vistazo, cada protocolo y capa dispone de una tríada cromática armónica (fondo suave + texto saturado + borde sutil):

| Protocolo / Capa | Tríada de Estilo Tailwind | Color Perceptible | Significado Contextual |
| :--- | :--- | :--- | :--- |
| **HTTP / HTTPS** | `bg-emerald-50 text-emerald-700 border-emerald-200` | Verde Esmeralda Suave | Tráfico web de aplicación seguro / estándar. |
| **TCP** | `bg-blue-50 text-blue-700 border-blue-200` | Azul Corporativo Suave | Protocolo confiable orientado a conexión. |
| **UDP** | `bg-indigo-50 text-indigo-700 border-indigo-200` | Índigo / Violeta Suave | Datagramas rápidos para streaming y DNS. |
| **DNS** | `bg-amber-50 text-amber-700 border-amber-200` | Ámbar / Miel Suave | Resolución y consulta de nombres de dominio. |
| **ICMP** | `bg-rose-50 text-rose-700 border-rose-200` | Rosa / Coral Suave | Diagnóstico de red, control y eco (Ping). |
| **ARP** | `bg-cyan-50 text-cyan-700 border-cyan-200` | Cian Suave | Resolución de direcciones MAC en red local. |
| **Otros / Raw** | `bg-slate-100 text-slate-600 border-slate-200` | Gris Pizarra Suave | Protocolos no reconocidos o sin clasificar. |

---

## 3. Directiva Estricta: Eliminación de Ruido Visual ("Anti-Plantilla IA")

### 3.1 Prohibiciones Expresas en la Vista Principal de Producción
Queda terminantemente prohibido renderizar en la vista operativa principal de Mini-Wireshark los siguientes elementos:
- ❌ **Etiquetas de Metadatos de Proyecto:** Nombres de fases o desarrolladores como `"Fase 1"`, `"Fase 2"`, `"Persona 1 (Backend)"`, `"Persona 2 (Frontend)"`, o `"SDD Test Suite Runner"`.
- ❌ **Rutas de Archivos en Interfaz:** Menciones a archivos internos como `/specs/01-motor-captura-osi.md`, `Spec03TrafficTableTest.tsx`, o `CaptureEngine.py`.
- ❌ **Insignias de Test en Vista de Usuario:** Badges de `"PASS"`, `"VERIFICADO"`, `"10/10 Contrato Válido"`, `"PROBAR AHORA"` o porcentajes de cobertura en la pantalla principal.
- ❌ **Controles Crudos de Depuración:** Inputs manuales para modificar la URL del backend (`http://127.0.0.1:5000`), inyectores manuales de ráfagas sintéticas ("Inject 50 Packets") o monitores de volcado JSON sin formato.

### 3.2 Confinamiento del Entorno de Certificación ("Laboratorio QA")
Todo el código y los componentes de validación SDD (`TestSuiteRunner.tsx` y los arneses `Spec01` a `Spec05`) deben encapsularse y permanecer accesibles **exclusivamente** mediante:
- Un botón secundario, discreto y estilizado en la esquina superior derecha del `Header`:
  ```tsx
  <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition-colors">
    <BeakerIcon className="w-4 h-4 text-slate-500" />
    <span>Laboratorio QA</span>
  </button>
  ```
- Al hacer clic, se abre una vista modal o un panel conmutado que permite al equipo docente o auditor ejecutar y verificar las 5 suites de especificación sin contaminar la aplicación de usuario final.

---

## 4. Arquitectura de la Interfaz Unificada (Layout de 3 Zonas)

La vista principal de la aplicación ocupará el 100% de la ventana sin barras de desplazamiento globales innecesarias:
`h-screen bg-slate-50 text-slate-900 flex flex-col overflow-hidden`

```text
+---------------------------------------------------------------------------------------------------+
| ZONA A: HEADER Y BARRA DE CONTROL GLOBAL (Controles de captura, modos, filtros rápidos y QA)       |
+-----------------------------------------------------------------+---------------------------------+
| ZONA B: TABLA DE TRÁFICO EN VIVO (55% - 60% ancho)              | ZONA C: INSPECTOR MODELO OSI   |
| - Conteo y métricas en vivo                                     |         (40% - 45% ancho)       |
| - Tabla scrollable con columnas amigables:                      | - Resumen de paquete activo     |
|   [No.] [Tiempo] [Origen] [Destino] [Protocolo] [Actividad Red] | - Ruta de Encapsulación OSI     |
| - Fila seleccionada interactiva con destaque visual             | - Tarjetas Capas 2, 3, 4 y 7   |
|                                                                 | - Acordeón Hex/ASCII colapsado  |
+-----------------------------------------------------------------+---------------------------------+
```

### 4.1 Zona A: Barra Superior de Navegación y Control (`AppHeader.tsx`)
- **Contenedor:** `h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0 shadow-xs`.
- **Identidad de Marca:**
  - Icono de red moderno (estilo vector/SVG de pulsos o capas superpuestas en `text-blue-600`).
  - Nombre principal: **Mini-Wireshark** (`text-lg font-bold text-slate-900 tracking-tight`).
  - Subtítulo integrado: *"Analizador Visual del Modelo OSI"* (`text-xs text-slate-500 hidden md:inline ml-2 pl-2 border-l border-slate-200`).
- **Estado de Captura en Vivo:**
  - Píldora animada en tema claro:
    * Activo: `bg-emerald-50 text-emerald-700 border border-emerald-200` con punto parpadeante (`animate-ping bg-emerald-500`) + texto *"Capturando en vivo"*.
    * Pausado: `bg-slate-100 text-slate-600 border border-slate-200` + texto *"Captura en pausa"*.
- **Controles Operativos de Captura:**
  - **Selector de Origen Segmentado:** Píldora toggle de dos estados (`bg-slate-100 p-0.5 rounded-lg border border-slate-200`):
    * `Red Local (Scapy)` | `Tráfico Simulado`.
  - **Botón Primario de Acción:**
    * Iniciar: `bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg text-sm shadow-xs transition-colors`.
    * Pausar: `bg-amber-600 hover:bg-amber-700 text-white font-medium px-4 py-2 rounded-lg text-sm shadow-xs transition-colors`.
  - **Botón Secundario:**
    * Limpiar: `bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-medium px-3 py-2 rounded-lg text-sm transition-colors`.
- **Barra de Filtrado Intuitiva (Subheader o Barra Integrada):**
  - **Píldoras de Filtro Rápido por Protocolo:** Conjunto de chips clicables con estilo activo/inactivo (`Todos`, `Web (HTTP)`, `TCP`, `UDP`, `DNS`, `Ping (ICMP)`, `Red Local (ARP)`).
  - **Buscador Universal en Tiempo Real:** Input con icono de lupa SVG y placeholder amigable:
    `"Buscar por IP, puerto, protocolo o actividad..."` (`bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 rounded-lg text-xs px-3 py-1.5 w-64`).
- **Acceso Discreto a QA:** Botón *"Laboratorio QA"* en el extremo superior derecho.

---

### 4.2 Zona B: Tabla de Tráfico en Tiempo Real (`LiveTrafficPanel.tsx`)
- **Contenedor:** Panel izquierdo ocupando del 55% al 60% del ancho disponible, con margen y estructura contenida (`flex-1 flex flex-col bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden m-3 mr-1.5`).
- **Barra de Estado del Panel:**
  - Indicador numérico amigable: *"Mostrando 48 de 120 paquetes capturados"*.
  - Indicador de auto-scroll activable/desactivable con un clic (`"Auto-desplazamiento activado"`).
- **Columnas de la Tabla (Diseñadas para Claridad Pedagógica):**
  1. **`#` (No.):** Ancho fijo pequeño (`w-12 text-slate-400 font-mono text-xs`).
  2. **`Hora / Delta`:** Timestamp legible (`HH:MM:SS.mmm` o `+0.42s`, `font-mono text-xs text-slate-500`).
  3. **`Origen`:** Dirección IP origen con puerto opcional en píldora monoespaciada (`192.168.1.105:51842`).
  4. **`Destino`:** Dirección IP destino con puerto opcional en píldora monoespaciada (`93.184.216.34:80`).
  5. **`Protocolo`:** Badge semántico suave según sección 2.3 (`TCP`, `UDP`, `HTTP`, `DNS`, `ICMP`, `ARP`).
  6. **`Actividad en la Red` (Traducción Pedagógica Obligatoria):**
     En lugar de únicamente mostrar bytes o texto crudo críptico, esta columna traduce el paquete a una frase comprensible en español:
     - Para DNS: *"Consulta de nombre de dominio (DNS: google.com)"*
     - Para HTTP: *"Petición de página web (GET /index.html)"*
     - Para TCP: *"Conexión Web Segura / Establecimiento de Canal (SYN/ACK)"*
     - Para ICMP: *"Comprobación de conectividad (Echo Request / Ping)"*
     - Para ARP: *"¿Quién tiene 192.168.1.1? Responder a 192.168.1.105"*
     - Para UDP: *"Transmisión de datagrama de audio/video o datos rápidos"*
- **Interacción de Selección:**
  - Al hacer clic en cualquier fila, se actualiza instantáneamente el paquete activo en la Zona C sin recargas, saltos de scroll ni cambios de pantalla.
  - La fila seleccionada adopta la clase `bg-blue-50/70 border-l-4 border-blue-600 font-medium`.

---

### 4.3 Zona C: Inspector Visual y Pedagógico del Modelo OSI (`OsiInspectorPanel.tsx`)
- **Contenedor:** Panel derecho ocupando del 40% al 45% del ancho disponible (`w-[42%] flex flex-col bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden m-3 ml-1.5`).
- **Estado Vacío Amigable (Sin Selección):**
  - Si ningún paquete está seleccionado, renderiza una ilustración o icono sutil con el mensaje:
    *"Selecciona un paquete de la tabla para desglosar sus cabeceras en el Modelo OSI"*.

- **Cabecera del Inspector:**
  - Resumen contextual del paquete seleccionado:
    `"Paquete #14 · Comunicación Web entre 192.168.1.105 y 93.184.216.34"` con su badge de protocolo y tamaño total en bytes.

- **Ruta Visual de Encapsulación OSI (`OsiPathwayBar`):**
  - Una barra horizontal estilizada que muestra la secuencia lógica por la que transitó la información:
    `[Capa 2: Enlace] → [Capa 3: Red] → [Capa 4: Transporte] → [Capa 7: Aplicación]`
  - Las capas activas en el paquete se muestran iluminadas en su tono suave correspondiente; las capas no aplicables (como Capa 4 en tramas ARP) se muestran en gris tenue con la anotación *"Omitida por diseño del protocolo"*.

- **Tarjetas Desglosadas por Capa con Lenguaje Pedagógico:**
  
  #### 1. Capa 2 · Enlace de Datos (Conexión Física / Red Local)
  - **Borde / Identificador:** Borde suave cian/ámbar.
  - **Campos:** `MAC Origen → MAC Destino`, `EtherType` (con traducción: *0x0800 - IPv4*).
  - **Nota Pedagógica Visible:**
    > *"Esta capa identifica los adaptadores de red físicos (tarjetas Wi-Fi o Ethernet) involucrados en el salto actual dentro de la red local."*

  #### 2. Capa 3 · Red (Enrutamiento Lógico Global)
  - **Borde / Identificador:** Borde suave esmeralda/verde.
  - **Campos:** `IP Origen → IP Destino`, `TTL (Tiempo de Vida)`, `Longitud Total`.
  - **Nota Pedagógica Visible:**
    > *"Guía el paquete a través de enrutadores desde el equipo emisor hasta su destino final en Internet o en otra subred. El TTL evita que viaje en bucles infinitos."*

  #### 3. Capa 4 · Transporte (Canales, Puertos y Confiabilidad)
  - **Borde / Identificador:** Borde suave azul/índigo.
  - **Campos:** `Protocolo (TCP / UDP)`, `Puerto Origen (Cliente) → Puerto Destino (Servicio)`, `Banderas (Flags)`, `Checksum`.
  - **Nota Pedagógica Visible:**
    > *"Segmenta el flujo de datos y utiliza puertos para entregar la información a la aplicación correcta dentro del computador (ej. Puerto 80/443 para navegación web)."*
  - **Caso Especial ARP/ICMP:** Si no aplica puertos, muestra una tarjeta informativa clara:
    > *"Este protocolo opera a nivel de control de red local; no utiliza puertos ni sockets de transporte."*

  #### 4. Capa 7 · Aplicación y Datos (Payload)
  - **Borde / Identificador:** Borde suave púrpura/violeta.
  - **Campos:** `Servicio Inferido (HTTP, DNS, TLS, RAW)`, `Tamaño de Payload en Bytes`.
  - **Acordeón Desplegable de Datos Crudos (`"Ver datos crudos (Hexadecimal / ASCII)"`):**
    - Colapsado por defecto para no saturar visualmente al usuario.
    - Al expandirse, muestra el volcado en dos columnas limpias (Hex a la izquierda, caracteres ASCII imprimibles a la derecha) con fondo `bg-slate-100` y tipografía monoespaciada `text-xs text-slate-800`.
    - Si el paquete es de control puro sin carga útil (`payload_size: 0`), muestra un aviso educativo: *"Paquete de control y señalización: no contiene datos de usuario en Capa 7"*.

---

## 5. Criterios de Aceptación y Plan de Validación (`Spec05UnifiedUiTest.tsx`)

El nuevo arnés ejecutable `/frontend/src/tests/Spec05UnifiedUiTest.tsx` validará de manera automatizada y visual los siguientes 6 puntos de control:

1. **[Tema Claro Puro y Cero Regresiones Oscuras]:**
   - El contenedor raíz y sus paneles principales presentan clases `bg-slate-50`, `bg-white`, `text-slate-900` y `border-slate-200`.
   - No existen elementos con fondos oscuros heredados (`bg-slate-900`, `bg-gray-800`) en la vista del usuario final.
2. **[Cero Ruido de Testing en Vista Principal]:**
   - La pantalla principal no contiene textos como `"Fase 1"`, `"Persona 1"`, `"PASS"`, ni rutas `.md` o `.tsx`.
   - Los controles crudos de URL (`http://127.0.0.1:5000`) o botones de inyección masiva están completamente ausentes de la vista de producción.
3. **[Layout de 3 Zonas Operativo en Pantalla Única]:**
   - La cabecera superior (`AppHeader`), la tabla de tráfico (`LiveTrafficPanel`) y el inspector del Modelo OSI (`OsiInspectorPanel`) conviven simultáneamente en pantalla sin requerir navegación por pestañas para ver un paquete.
4. **[Flujo de Interacción Extremo a Extremo]:**
   - Iniciar la captura de paquetes incrementa el conteo en vivo.
   - Escribir en el buscador o seleccionar un chip de protocolo filtra la lista de paquetes de inmediato.
   - Hacer clic en una fila actualiza el inspector de la Zona C con las 4 capas del paquete correspondiente en menos de 100 ms.
5. **[Pedagogía del Modelo OSI Presente y Clara]:**
   - Cada una de las 4 tarjetas de capa presenta su nota explicativa en español.
   - Los paquetes ARP/ICMP gestionan la ausencia de puertos de Capa 4 sin mostrar errores ni campos `undefined`.
   - El visor Hex/ASCII se encuentra colapsado por defecto y se expande con un clic.
6. **[Aislamiento y Conmutación al Laboratorio QA]:**
   - Existe un botón accesible *"Laboratorio QA"* en la barra superior.
   - Al pulsarlo, se puede conmutar a la vista técnica de pruebas SDD (donde corren `Spec01CaptureTest`, `Spec02ApiStreamTest`, `Spec03TrafficTableTest`, `Spec04OsiInspectorTest` y `Spec05UnifiedUiTest`) y regresar a la aplicación unificada sin perder el estado de la captura.

---

## 6. Siguientes Pasos (Handoff a Implementación)

Una vez aprobada esta especificación formal:
1. Crear el componente raíz unificado de producción en `frontend/src/components/UnifiedDashboard.tsx` o refactorizar `App.tsx` para orquestar el Layout de 3 Zonas.
2. Adaptar y estilizar los componentes hijos (`CaptureControlBar`, `LiveTrafficTable`, `OsiInspector`, `OsiStackVisualizer`, `HexAsciiPayloadViewer`) bajo el nuevo sistema de diseño Clean Light UI.
3. Desarrollar el entorno de verificación formal en `frontend/src/tests/Spec05UnifiedUiTest.tsx` e integrarlo en `TestSuiteRunner.tsx`.

