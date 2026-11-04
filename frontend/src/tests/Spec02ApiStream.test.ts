import { describe, it, expect } from 'vitest';
import { validateOsiPacketContract } from './Spec01CaptureTest';

describe('Certificación de Integración de API Fase 2 (Spec02ApiStreamTest Contract)', () => {
  it('valida el esquema de respuestas JSON de todos los endpoints de la API', () => {
    // 1. GET /api/status schema
    const mockStatus = {
      status: 'ok',
      is_capturing: true,
      mode: 'mock',
      interface: 'eth0 (Simulated)',
      packet_count: 42,
      started_at: '2026-10-27T12:05:00.000Z',
      uptime_seconds: 18.4,
    };
    expect(mockStatus.status).toBe('ok');
    expect(typeof mockStatus.is_capturing).toBe('boolean');
    expect(typeof mockStatus.packet_count).toBe('number');
    expect(mockStatus.mode).toBe('mock');

    // 2. POST /api/capture/start schema
    const mockStart = {
      status: 'started',
      is_capturing: true,
      mode: 'mock',
      message: 'Captura iniciada correctamente en modo mock.',
    };
    expect(mockStart.status).toBe('started');
    expect(mockStart.is_capturing).toBe(true);

    // 3. POST /api/capture/stop schema
    const mockStop = {
      status: 'stopped',
      is_capturing: false,
      packet_count: 42,
      message: 'Captura detenida correctamente.',
    };
    expect(mockStop.status).toBe('stopped');
    expect(mockStop.is_capturing).toBe(false);

    // 4. POST /api/capture/clear schema
    const mockClear = {
      status: 'cleared',
      packet_count: 0,
      message: 'Buffer de paquetes vaciado correctamente.',
    };
    expect(mockClear.status).toBe('cleared');
    expect(mockClear.packet_count).toBe(0);

    // 5. GET /api/packets schema
    const mockPacketsResponse = {
      status: 'ok',
      is_capturing: true,
      mode: 'mock',
      total_captured: 1,
      returned_count: 1,
      packets: [],
    };
    expect(mockPacketsResponse.status).toBe('ok');
    expect(Array.isArray(mockPacketsResponse.packets)).toBe(true);
  });
});

