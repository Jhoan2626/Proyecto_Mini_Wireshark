import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Spec02ApiStreamTest } from './Spec02ApiStreamTest';
import { validateOsiPacketContract } from './Spec01CaptureTest';

describe('Spec02ApiStreamTest - Suite de Certificación Frontend de API y Streaming', () => {
  it('renderiza la consola de diagnóstico de Fase 2 correctamente', () => {
    render(<Spec02ApiStreamTest />);
    expect(screen.getByText(/FASE 2 • PERSONA 1/i)).toBeInTheDocument();
    expect(screen.getByText(/Spec 02 — Consola de Diagnóstico de API REST y Streaming/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /GET \/api\/status/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /POST \/start/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /POST \/stop/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /POST \/clear/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /GET \/packets/i })).toBeInTheDocument();
  });

  it('ejecuta el ciclo de vida completo de captura en modo simulado y pasa todos los checks', async () => {
    let validationPassed = false;
    render(
      <Spec02ApiStreamTest
        onValidationChange={(allPassed) => {
          validationPassed = allPassed;
        }}
      />
    );

    // Activar Simulador Local API
    const checkbox = screen.getByLabelText(/Simulador Local API/i);
    fireEvent.click(checkbox);

    // 1. GET /api/status
    fireEvent.click(screen.getByRole('button', { name: /GET \/api\/status/i }));

    // 2. POST /start
    fireEvent.click(screen.getByRole('button', { name: /POST \/start/i }));

    // 3. GET /packets
    fireEvent.click(screen.getByRole('button', { name: /GET \/packets/i }));

    // 4. POST /stop
    fireEvent.click(screen.getByRole('button', { name: /POST \/stop/i }));

    // 5. POST /clear
    fireEvent.click(screen.getByRole('button', { name: /POST \/clear/i }));

    // Verificar que los 6 checks del checklist están aprobados (PASS)
    await waitFor(
      () => {
        expect(validationPassed).toBe(true);
      },
      { timeout: 3000 }
    );
  });

  it('verifica que los paquetes devueltos por la API cumplan con el contrato CapturedPacket de Spec 01', async () => {
    const mockApiResponse = {
      status: 'ok',
      is_capturing: true,
      mode: 'mock',
      total_captured: 1,
      returned_count: 1,
      packets: [
        {
          id: 1,
          timestamp: '2026-10-27T12:05:14.128Z',
          relative_time: 0.128,
          captured_mode: 'mock',
          summary: {
            src_ip: '192.168.1.105',
            dst_ip: '93.184.216.34',
            protocol: 'HTTP',
            length: 214,
            info: '51842 → 80 [PSH, ACK] GET /index.html HTTP/1.1',
          },
          osi_layers: {
            layer2_datalink: {
              protocol: 'Ethernet II',
              src_mac: '00:1A:2B:3C:4D:5E',
              dst_mac: 'AA:BB:CC:DD:EE:FF',
              ethertype: '0x0800',
              ethertype_name: 'IPv4',
            },
            layer3_network: {
              protocol: 'IPv4',
              src_ip: '192.168.1.105',
              dst_ip: '93.184.216.34',
              ttl: 64,
              length: 214,
              protocol_id: 6,
            },
            layer4_transport: {
              protocol: 'TCP',
              src_port: 51842,
              dst_port: 80,
              flags: 'PSH, ACK',
              checksum: '0x7c21',
              seq_num: 1,
              ack_num: 1,
            },
            layer7_application: {
              protocol_hint: 'HTTP',
              payload_size: 160,
              hex_dump: '47 45 54 20 2f 20 48 54 54 50 2f 31 2e 31',
              ascii_preview: 'GET / HTTP/1.1',
            },
          },
        },
      ],
    };

    const packet = mockApiResponse.packets[0];
    const validationResults = validateOsiPacketContract(packet);
    expect(validationResults.every((r) => r.passed)).toBe(true);
    expect(validationResults.length).toBe(10);
  });
});
