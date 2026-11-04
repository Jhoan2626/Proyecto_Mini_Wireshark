import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import {
  CaptureControlBar,
  TrafficFilterBar,
  TrafficPacketTable,
  getProtocolBadgeClasses,
  filterPackets,
  formatPacketTime,
} from '../components';
import { Spec03TrafficTableTest, INITIAL_STREAM_PACKETS } from './Spec03TrafficTableTest';
import { CapturedPacket, validateOsiPacketContract } from './Spec01CaptureTest';

describe('Spec 03 — Componentes de Tabla de Tráfico en Tiempo Real y Controles (/frontend/src/components/)', () => {
  it('1. [Renderizado de las 7 Columnas]: muestra No., Tiempo, IP Origen, IP Destino, Protocolo, Longitud e Info con colores semánticos', () => {
    const onSelectPacket = vi.fn();
    render(
      <TrafficPacketTable
        packets={INITIAL_STREAM_PACKETS}
        selectedPacketId={1}
        onSelectPacket={onSelectPacket}
      />
    );

    // Verificar las 7 cabeceras obligatorias
    const headers = screen.getAllByRole('columnheader').map((th) => th.textContent?.trim());
    expect(headers).toEqual([
      'No.',
      'Tiempo',
      'IP Origen',
      'IP Destino',
      'Protocolo',
      'Longitud',
      'Info',
    ]);

    // Verificar que se renderizan las 6 filas iniciales de paquetes heterogéneos
    INITIAL_STREAM_PACKETS.forEach((pkt) => {
      const row = screen.getByTestId(`packet-row-${pkt.id}`);
      expect(row).toBeInTheDocument();
      expect(within(row).getByText(String(pkt.id))).toBeInTheDocument();
      expect(within(row).getByText(pkt.summary.src_ip)).toBeInTheDocument();
      expect(within(row).getByText(pkt.summary.dst_ip)).toBeInTheDocument();
      expect(within(row).getByText(pkt.summary.protocol)).toBeInTheDocument();
      expect(within(row).getByText(`${pkt.summary.length} B`)).toBeInTheDocument();
      expect(within(row).getByText(pkt.summary.info)).toBeInTheDocument();
    });

    // Verificar clases de colorimetría estilo Wireshark según Spec 03 Sección 3.1
    expect(getProtocolBadgeClasses('TCP')).toContain('bg-indigo-500/15');
    expect(getProtocolBadgeClasses('UDP')).toContain('bg-cyan-500/15');
    expect(getProtocolBadgeClasses('DNS')).toContain('bg-cyan-500/15');
    expect(getProtocolBadgeClasses('HTTP')).toContain('bg-emerald-500/15');
    expect(getProtocolBadgeClasses('HTTPS')).toContain('bg-emerald-500/15');
    expect(getProtocolBadgeClasses('ICMP')).toContain('bg-amber-500/15');
    expect(getProtocolBadgeClasses('ARP')).toContain('bg-purple-500/15');
  });

  it('2. [Filtrado por Protocolo]: filtra exactamente por protocolo seleccionado y actualiza contadores de sesión', () => {
    const onSelectPacket = vi.fn();
    render(
      <TrafficPacketTable
        packets={INITIAL_STREAM_PACKETS}
        selectedPacketId={null}
        onSelectPacket={onSelectPacket}
      />
    );

    // Inicialmente 6 visibles de 6 totales
    expect(screen.getByTestId('visible-packets-count')).toHaveTextContent('6');
    expect(screen.getByTestId('total-packets-count')).toHaveTextContent('6');

    // Filtrar por ICMP
    fireEvent.click(screen.getByRole('button', { name: 'ICMP' }));
    expect(screen.getByTestId('visible-packets-count')).toHaveTextContent('1');
    expect(screen.getByTestId('packet-row-3')).toBeInTheDocument();
    expect(screen.queryByTestId('packet-row-1')).not.toBeInTheDocument();

    // Filtrar por ARP
    fireEvent.click(screen.getByRole('button', { name: 'ARP' }));
    expect(screen.getByTestId('visible-packets-count')).toHaveTextContent('1');
    expect(screen.getByTestId('packet-row-4')).toBeInTheDocument();
    expect(screen.queryByTestId('packet-row-3')).not.toBeInTheDocument();

    // Filtrar por TCP (solo fila #5 tiene summary.protocol === 'TCP')
    fireEvent.click(screen.getByRole('button', { name: 'TCP' }));
    expect(screen.getByTestId('visible-packets-count')).toHaveTextContent('1');
    expect(screen.getByTestId('packet-row-5')).toBeInTheDocument();

    // Resetear filtros con el botón Limpiar Filtros
    fireEvent.click(screen.getByRole('button', { name: /Resetear filtros/i }));
    expect(screen.getByTestId('visible-packets-count')).toHaveTextContent('6');
  });

  it('3. [Filtrado por IP / Búsqueda]: filtra en tiempo real por src_ip, dst_ip o info', () => {
    const onSelectPacket = vi.fn();
    render(
      <TrafficPacketTable
        packets={INITIAL_STREAM_PACKETS}
        selectedPacketId={null}
        onSelectPacket={onSelectPacket}
      />
    );

    const searchInput = screen.getByPlaceholderText(/Filtrar IP o Info/i);

    // Buscar IP destino de ARP (192.168.1.1) -> precaución: 192.168.1.105 también empieza por 192.168.1.1, probemos con 8.8.8.8
    fireEvent.change(searchInput, { target: { value: '8.8.8.8' } });
    expect(screen.getByTestId('visible-packets-count')).toHaveTextContent('2');
    expect(screen.getByTestId('packet-row-2')).toBeInTheDocument();
    expect(screen.getByTestId('packet-row-6')).toBeInTheDocument();

    // Buscar IP 1.1.1.1 (ICMP Ping)
    fireEvent.change(searchInput, { target: { value: '1.1.1.1' } });
    expect(screen.getByTestId('visible-packets-count')).toHaveTextContent('1');
    expect(screen.getByTestId('packet-row-3')).toBeInTheDocument();

    // Buscar por texto en columna Info ("GET /index.html")
    fireEvent.change(searchInput, { target: { value: 'GET /index.html' } });
    expect(screen.getByTestId('visible-packets-count')).toHaveTextContent('1');
    expect(screen.getByTestId('packet-row-1')).toBeInTheDocument();
  });

  it('4. [Evento onSelectPacket y Estado Activo]: entrega el objeto CapturedPacket íntegro con sus 4 capas OSI intactas y marca la fila activa', () => {
    let selectedPkt: CapturedPacket | null = null;
    const handleSelect = vi.fn((pkt: CapturedPacket) => {
      selectedPkt = pkt;
    });

    const { rerender } = render(
      <TrafficPacketTable
        packets={INITIAL_STREAM_PACKETS}
        selectedPacketId={1}
        onSelectPacket={handleSelect}
      />
    );

    // La fila 1 debe estar marcada como activa inicialmente
    expect(screen.getByTestId('packet-row-1')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('packet-row-4')).toHaveAttribute('aria-selected', 'false');

    // Hacer clic en la fila 4 (ARP Broadcast)
    fireEvent.click(screen.getByTestId('packet-row-4'));
    expect(handleSelect).toHaveBeenCalledTimes(1);
    expect(selectedPkt).not.toBeNull();
    expect(selectedPkt!.id).toBe(4);

    // Validar que las 4 capas OSI del paquete entregado cumplen las 10 reglas del contrato global
    const contractCheck = validateOsiPacketContract(selectedPkt);
    expect(contractCheck.every((r) => r.passed)).toBe(true);

    // Actualizar selectedPacketId y verificar estado activo visual
    rerender(
      <TrafficPacketTable
        packets={INITIAL_STREAM_PACKETS}
        selectedPacketId={4}
        onSelectPacket={handleSelect}
      />
    );
    expect(screen.getByTestId('packet-row-4')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('packet-row-1')).toHaveAttribute('aria-selected', 'false');
  });

  it('5. [CaptureControlBar]: gestiona estados CAPTURANDO / DETENIDO, selector de modo Real/Mock y llamadas a API REST', () => {
    const onModeChange = vi.fn();
    const onStart = vi.fn();
    const onStop = vi.fn();
    const onClear = vi.fn();
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok' }),
    } as Response);

    const { rerender } = render(
      <CaptureControlBar
        isCapturing={false}
        captureMode="mock"
        onModeChange={onModeChange}
        onStartCapture={onStart}
        onStopCapture={onStop}
        onClearPackets={onClear}
        totalPackets={10}
        visiblePackets={5}
        apiBaseUrl="http://127.0.0.1:5000"
      />
    );

    // Estado inicial detenido
    expect(screen.getByTestId('capture-status-badge')).toHaveTextContent('DETENIDO / EN PAUSA');
    const startBtn = screen.getByRole('button', { name: /Iniciar Captura/i });
    const stopBtn = screen.getByRole('button', { name: /Detener Captura/i });
    const clearBtn = screen.getByRole('button', { name: /Limpiar Paquetes/i });

    expect(startBtn).not.toBeDisabled();
    expect(stopBtn).toBeDisabled();

    // Cambiar modo a Real
    fireEvent.click(screen.getByRole('button', { name: 'Modo Real' }));
    expect(onModeChange).toHaveBeenCalledWith('real');

    // Iniciar captura
    fireEvent.click(startBtn);
    expect(onStart).toHaveBeenCalledWith('mock');
    expect(fetchSpy).toHaveBeenCalledWith(
      'http://127.0.0.1:5000/api/capture/start',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ mode: 'mock' }),
      })
    );

    // Re-renderizar en estado capturando
    rerender(
      <CaptureControlBar
        isCapturing={true}
        captureMode="real"
        onModeChange={onModeChange}
        onStartCapture={onStart}
        onStopCapture={onStop}
        onClearPackets={onClear}
        totalPackets={12}
        visiblePackets={12}
        apiBaseUrl="http://127.0.0.1:5000"
      />
    );

    expect(screen.getByTestId('capture-status-badge')).toHaveTextContent('CAPTURANDO');
    expect(screen.getByRole('button', { name: /Iniciar Captura/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Detener Captura/i })).not.toBeDisabled();

    // Detener y Limpiar
    fireEvent.click(screen.getByRole('button', { name: /Detener Captura/i }));
    expect(onStop).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith(
      'http://127.0.0.1:5000/api/capture/stop',
      expect.objectContaining({ method: 'POST' })
    );

    fireEvent.click(clearBtn);
    expect(onClear).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith(
      'http://127.0.0.1:5000/api/capture/clear',
      expect.objectContaining({ method: 'POST' })
    );

    fetchSpy.mockRestore();
  });

  it('6. [Rendimiento de Flujo Continuo y Certificación SDD Spec03TrafficTableTest]: soporta ráfagas sin perder filtro ni selección y aprueba los 5 checks', async () => {
    let validationPassed = false;
    let inspectedPacket: CapturedPacket | null = null;

    render(
      <Spec03TrafficTableTest
        onValidationChange={(passed) => {
          validationPassed = passed;
        }}
        onPacketSelectedForInspection={(pkt) => {
          inspectedPacket = pkt;
        }}
      />
    );

    // 1. Seleccionar fila #2 (DNS)
    fireEvent.click(screen.getByTestId('packet-row-2'));
    expect((inspectedPacket as CapturedPacket | null)?.id).toBe(2);

    // 2. Activar filtro por protocolo DNS
    fireEvent.click(screen.getByRole('button', { name: 'DNS' }));
    expect(screen.getByTestId('visible-packets-count')).toHaveTextContent('1');

    // 3. Filtrar por IP 8.8.8.8
    const searchInput = screen.getByPlaceholderText(/Filtrar IP o Info/i);
    fireEvent.change(searchInput, { target: { value: '8.8.8.8' } });
    expect(screen.getByTestId('visible-packets-count')).toHaveTextContent('1');

    // 4. Inyectar ráfaga de +25 paquetes simulados
    fireEvent.click(screen.getByRole('button', { name: /Inyectar Ráfaga \(\+25 Paquetes\)/i }));

    // Verificar que el total subió a 31 (6 + 25), el filtro DNS + 8.8.8.8 sigue activo y el paquete #2 sigue seleccionado
    expect(screen.getByTestId('total-packets-count')).toHaveTextContent('31');
    expect(screen.getByTestId('packet-row-2')).toHaveAttribute('aria-selected', 'true');

    // Verificar que los 5 criterios de aceptación de Spec 03 están en estado ✓ VERIFICADO
    await waitFor(() => {
      expect(validationPassed).toBe(true);
    });
    const verifiedBadges = screen.getAllByText('✓ VERIFICADO');
    expect(verifiedBadges.length).toBe(5);
  });

  it('7. [Funciones utilitarias]: formatPacketTime y filterPackets manejan casos borde correctamente', () => {
    const samplePkt: CapturedPacket = {
      ...INITIAL_STREAM_PACKETS[0],
      relative_time: undefined,
      timestamp: '2026-10-27T14:22:09.456Z',
    };
    expect(formatPacketTime(samplePkt)).toBe('14:22:09.456');
    expect(formatPacketTime({ ...samplePkt, relative_time: 1.5 })).toBe('1.500s');

    const filtered = filterPackets(INITIAL_STREAM_PACKETS, 'ALL', '   ');
    expect(filtered.length).toBe(INITIAL_STREAM_PACKETS.length);
  });
});
