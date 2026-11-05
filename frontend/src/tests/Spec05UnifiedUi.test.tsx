import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import App from '../App';
import {
  UnifiedDashboard,
  getLightProtocolBadgeClasses,
  translatePacketActivity,
  filterUnifiedPackets,
} from '../components';
import { Spec05UnifiedUiTest } from './Spec05UnifiedUiTest';
import { FIXTURE_PACKETS } from './Spec01CaptureTest';

describe('Spec 05 — Rediseño Frontend Unificado y Tema Claro Profesional (/specs/05-rediseño-frontend-claro-unificado.md)', () => {
  it('1. [Tema Claro Puro y Cero Regresiones Oscuras]: utiliza superficies claras bg-slate-50, bg-white, text-slate-900 y border-slate-200 sin clases oscuras heredadas', () => {
    const { container } = render(<App />);

    const root = screen.getByTestId('unified-dashboard-root');
    expect(root).toHaveClass('bg-slate-50', 'text-slate-900', 'h-screen', 'overflow-hidden');

    const header = screen.getByTestId('app-header');
    expect(header).toHaveClass('bg-white', 'border-slate-200');

    const trafficPanel = screen.getByTestId('live-traffic-panel');
    expect(trafficPanel).toHaveClass('bg-white', 'border-slate-200');

    const inspectorPanel = screen.getByTestId('osi-inspector-panel');
    expect(inspectorPanel).toHaveClass('bg-white', 'border-slate-200');

    // Verificar ausencia de fondos oscuros heredados en el DOM principal de usuario final
    expect(container.querySelector('.bg-slate-900')).toBeNull();
    expect(container.querySelector('.bg-slate-950')).toBeNull();
    expect(container.querySelector('.bg-gray-800')).toBeNull();

    // Verificar paleta pastel semántica de la Sección 2.3
    expect(getLightProtocolBadgeClasses('HTTP')).toContain('bg-emerald-50 text-emerald-700 border-emerald-200');
    expect(getLightProtocolBadgeClasses('TCP')).toContain('bg-blue-50 text-blue-700 border-blue-200');
    expect(getLightProtocolBadgeClasses('UDP')).toContain('bg-indigo-50 text-indigo-700 border-indigo-200');
    expect(getLightProtocolBadgeClasses('DNS')).toContain('bg-amber-50 text-amber-700 border-amber-200');
    expect(getLightProtocolBadgeClasses('ICMP')).toContain('bg-rose-50 text-rose-700 border-rose-200');
    expect(getLightProtocolBadgeClasses('ARP')).toContain('bg-cyan-50 text-cyan-700 border-cyan-200');
  });

  it('2. [Cero Ruido de Testing en Vista Principal]: prohíbe etiquetas de fase, personas, rutas de archivos o controles crudos de depuración', () => {
    const { container } = render(<UnifiedDashboard />);
    const fullText = container.textContent || '';

    expect(fullText).not.toContain('Fase 1');
    expect(fullText).not.toContain('Fase 2');
    expect(fullText).not.toContain('Persona 1');
    expect(fullText).not.toContain('Persona 2');
    expect(fullText).not.toContain('SDD Test Suite Runner');
    expect(fullText).not.toContain('.md');
    expect(fullText).not.toContain('.tsx');
    expect(fullText).not.toContain('http://127.0.0.1:5000');
    expect(fullText).not.toContain('Inyectar Ráfaga');
  });

  it('3. [Layout de 3 Zonas Operativo en Pantalla Única]: renderiza simultáneamente Zona A (AppHeader), Zona B (LiveTrafficPanel) y Zona C (OsiInspectorPanel)', () => {
    render(<UnifiedDashboard />);

    expect(screen.getByTestId('app-header')).toBeInTheDocument();
    expect(screen.getByTestId('live-traffic-panel')).toBeInTheDocument();
    expect(screen.getByTestId('osi-inspector-panel')).toBeInTheDocument();

    // Verifica que la tabla tiene las 6 columnas amigables de la Sección 4.2
    const columnHeaders = screen.getAllByRole('columnheader').map((th) => th.textContent?.trim());
    expect(columnHeaders).toEqual([
      '#',
      'Hora / Delta',
      'Origen',
      'Destino',
      'Protocolo',
      'Actividad en la Red',
    ]);
  });

  it('4. [Flujo de Interacción Extremo a Extremo]: iniciar captura incrementa el conteo, filtrar actualiza al instante y seleccionar fila actualiza la Zona C en <100ms', () => {
    render(<UnifiedDashboard />);

    // Inicialmente hay 6 paquetes precargados
    expect(screen.getByTestId('unified-packet-counter')).toHaveTextContent(
      'Mostrando 6 de 6 paquetes capturados'
    );

    // Iniciar captura incrementa el conteo en vivo inmediatamente y cambia estado a "Capturando en vivo"
    fireEvent.click(screen.getByTestId('unified-start-capture-btn'));
    expect(screen.getByTestId('unified-capture-status')).toHaveTextContent('Capturando en vivo');
    expect(screen.getByTestId('unified-packet-counter')).toHaveTextContent(
      'Mostrando 7 de 7 paquetes capturados'
    );

    // Pausar captura
    fireEvent.click(screen.getByTestId('unified-pause-capture-btn'));
    expect(screen.getByTestId('unified-capture-status')).toHaveTextContent('Captura en pausa');

    // Filtrar por chip rápido de protocolo DNS (paquete #2 inicial + paquete #7 capturado = 2)
    fireEvent.click(screen.getByTestId('unified-filter-chip-DNS'));
    expect(screen.getByTestId('unified-packet-counter')).toHaveTextContent(
      'Mostrando 2 de 7 paquetes capturados'
    );

    // Filtrar por chip rápido ARP (solo paquete #4 = 1)
    fireEvent.click(screen.getByTestId('unified-filter-chip-ARP'));
    expect(screen.getByTestId('unified-packet-counter')).toHaveTextContent(
      'Mostrando 1 de 7 paquetes capturados'
    );

    // Volver a Todos y filtrar por buscador universal
    fireEvent.click(screen.getByTestId('unified-filter-chip-ALL'));
    const searchInput = screen.getByTestId('unified-search-input');
    fireEvent.change(searchInput, { target: { value: '1.1.1.1' } });
    expect(screen.getByTestId('unified-packet-counter')).toHaveTextContent(
      'Mostrando 1 de 7 paquetes capturados'
    );

    // Limpiar búsqueda y seleccionar fila #4 (ARP) midiendo tiempo < 100ms
    fireEvent.change(searchInput, { target: { value: '' } });
    const t0 = performance.now();
    fireEvent.click(screen.getByTestId('unified-packet-row-4'));
    const elapsedMs = performance.now() - t0;

    expect(elapsedMs).toBeLessThan(100);
    expect(screen.getByTestId('unified-inspector-header')).toHaveTextContent(
      /Paquete #4 · Resolución Físico-Lógica ARP/i
    );
  });

  it('5. [Pedagogía del Modelo OSI Presente y Clara]: muestra notas explicativas en las 4 capas, gestiona ARP/ICMP sin undefined y mantiene Hex/ASCII colapsado por defecto', () => {
    const { container } = render(<UnifiedDashboard />);

    // Verificar traducciones pedagógicas de la columna "Actividad en la Red"
    expect(translatePacketActivity(FIXTURE_PACKETS.dns_udp)).toContain(
      'Consulta de nombre de dominio'
    );
    expect(translatePacketActivity(FIXTURE_PACKETS.http_tcp)).toContain(
      'Petición de página web (GET /index.html)'
    );
    expect(translatePacketActivity(FIXTURE_PACKETS.icmp_ping)).toContain(
      'Comprobación de conectividad (Echo Request / Ping)'
    );
    expect(translatePacketActivity(FIXTURE_PACKETS.arp_broadcast)).toContain('¿Quién tiene');

    // Verificar notas pedagógicas de las 4 capas para el paquete #1 (HTTP/TCP)
    expect(screen.getByTestId('unified-pedagogy-note-2')).toHaveTextContent(
      /identifica los adaptadores de red físicos/i
    );
    expect(screen.getByTestId('unified-pedagogy-note-3')).toHaveTextContent(
      /El TTL evita que viaje en bucles infinitos/i
    );
    expect(screen.getByTestId('unified-pedagogy-note-4')).toHaveTextContent(
      /utiliza puertos para entregar la información a la aplicación correcta/i
    );
    expect(screen.getByTestId('unified-pedagogy-note-7')).toBeInTheDocument();

    // Verificar que el visor Hex/ASCII está colapsado por defecto y se expande con un clic
    expect(screen.queryByTestId('unified-raw-payload-content')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('unified-raw-payload-toggle'));
    expect(screen.getByTestId('unified-raw-payload-content')).toBeInTheDocument();
    expect(screen.getByTestId('unified-hex-dump')).toHaveTextContent(
      FIXTURE_PACKETS.http_tcp.osi_layers.layer7_application.hex_dump
    );
    expect(screen.getByTestId('unified-ascii-preview')).toHaveTextContent(
      FIXTURE_PACKETS.http_tcp.osi_layers.layer7_application.ascii_preview
    );

    // Seleccionar fila #4 (ARP) y verificar ausencia de puertos en Capa 4, ruta omitida y aviso de payload 0
    fireEvent.click(screen.getByTestId('unified-packet-row-4'));
    expect(screen.getByTestId('osi-pathway-layer4-omitted')).toHaveTextContent(
      /Omitida por diseño del protocolo/i
    );
    expect(screen.getByTestId('unified-layer4-no-ports')).toHaveTextContent(
      /no utiliza puertos ni sockets de transporte/i
    );
    expect(screen.getByTestId('unified-empty-payload-notice')).toHaveTextContent(
      /Paquete de control y señalización: no contiene datos de usuario en Capa 7/i
    );
    expect(container.textContent).not.toContain('undefined');

    // Probar botón Limpiar para verificar el Estado Vacío Amigable de la Zona C
    fireEvent.click(screen.getByTestId('unified-clear-packets-btn'));
    expect(screen.getByTestId('unified-osi-empty-state')).toHaveTextContent(
      /Selecciona un paquete de la tabla para desglosar sus cabeceras en el Modelo OSI/i
    );
  });

  it('6. [Aislamiento y Conmutación al Laboratorio QA]: conmuta al TestSuiteRunner con las 5 fases y regresa sin perder el estado de captura', () => {
    render(<UnifiedDashboard />);

    // Iniciar captura para tener 7 paquetes y seleccionar paquete #2
    fireEvent.click(screen.getByTestId('unified-start-capture-btn'));
    fireEvent.click(screen.getByTestId('unified-packet-row-2'));
    expect(screen.getByTestId('unified-packet-counter')).toHaveTextContent(
      'Mostrando 7 de 7 paquetes capturados'
    );

    // Abrir Laboratorio QA desde el botón discreto del Header
    fireEvent.click(screen.getByTestId('qa-lab-toggle-btn'));
    expect(screen.getByTestId('qa-lab-modal-view')).toBeInTheDocument();
    expect(screen.getByText(/SDD Test Suite Runner/i)).toBeInTheDocument();

    // Verificar que la pestaña de Fase 5 (Spec05UnifiedUiTest) está presente en el Runner y pasa 6/6
    fireEvent.click(screen.getByRole('button', { name: /Rediseño Unificado Clean Light UI/i }));
    expect(screen.getByTestId('spec05-unified-ui-test')).toBeInTheDocument();
    expect(screen.getByTestId('spec05-compliance-badge')).toHaveTextContent(
      '✓ 6/6 CRITERIOS VERIFICADOS'
    );

    // Regresar a Mini-Wireshark y comprobar que los 7 paquetes y el paquete #2 seleccionado siguen intactos
    fireEvent.click(screen.getByTestId('qa-lab-return-btn'));
    expect(screen.queryByTestId('qa-lab-modal-view')).not.toBeInTheDocument();
    expect(screen.getByTestId('unified-packet-counter')).toHaveTextContent(
      'Mostrando 7 de 7 paquetes capturados'
    );
    expect(screen.getByTestId('unified-inspector-header')).toHaveTextContent(/Paquete #2/i);
  });

  it('7. [Arnés Spec05UnifiedUiTest independiente]: certifica los 6 puntos de control de la Especificación 05', () => {
    let passed = false;
    render(
      <Spec05UnifiedUiTest
        onValidationChange={(ok) => {
          passed = ok;
        }}
      />
    );
    expect(passed).toBe(true);
    expect(screen.getAllByText('✓ VERIFICADO').length).toBe(6);
  });

  it('8. [Modo Red Local (Scapy), Selector de Interfaz Real y Filtro de Payload/Puerto]: muestra selector de interfaz en modo real, no simula paquetes falsos y filtra por puerto 8000 o contenido del payload', () => {
    render(<UnifiedDashboard />);

    // Al cambiar a modo Red Local (Scapy), aparece el selector de interfaz de red real y se limpian los mocks
    fireEvent.click(screen.getByTestId('mode-real-btn'));
    expect(screen.getByTestId('network-interface-select')).toBeInTheDocument();
    expect(screen.getByTestId('unified-packet-counter')).toHaveTextContent(
      'Mostrando 0 de 0 paquetes capturados'
    );

    // Verificar que filterUnifiedPackets filtra por puerto (ej. 8000) y por texto dentro del payload de Capa 7
    const realFilePacket = {
      ...FIXTURE_PACKETS.http_tcp,
      id: 901,
      captured_mode: 'real' as const,
      osi_layers: {
        ...FIXTURE_PACKETS.http_tcp.osi_layers,
        layer4_transport: {
          ...FIXTURE_PACKETS.http_tcp.osi_layers.layer4_transport!,
          src_port: 8000,
          dst_port: 54120,
        },
        layer7_application: {
          protocol_hint: 'HTTP',
          payload_size: 85,
          hex_dump: '55 4e 49 56 45 52 53 49 44 41 44',
          ascii_preview: 'HTTP/1.0 200 OK Content-type: text/plain Informe_Final_Redes_Universidad.txt',
          readable_text: 'HTTP/1.0 200 OK\nContent-type: text/plain\n\nInforme_Final_Redes_Universidad.txt',
        },
      },
    };

    const byPort = filterUnifiedPackets([realFilePacket, FIXTURE_PACKETS.dns_udp], 'ALL', '8000');
    expect(byPort.length).toBe(1);
    expect(byPort[0].id).toBe(901);

    const byPayloadKeyword = filterUnifiedPackets(
      [realFilePacket, FIXTURE_PACKETS.dns_udp],
      'ALL',
      'Informe_Final_Redes'
    );
    expect(byPayloadKeyword.length).toBe(1);
    expect(byPayloadKeyword[0].id).toBe(901);
  });
});
