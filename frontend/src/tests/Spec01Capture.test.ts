import { describe, it, expect } from 'vitest';
import { validateOsiPacketContract, FIXTURE_PACKETS } from './Spec01CaptureTest';
import backendPackets from './backend_generated_packets.json';

describe('Certificación Formal Spec01CaptureTest (10 Reglas SDD)', () => {
  it('debe validar exitosamente todos los fixtures base (HTTP, HTTPS, DNS, ICMP, ARP)', () => {
    Object.entries(FIXTURE_PACKETS).forEach(([key, pkt]) => {
      const results = validateOsiPacketContract(pkt);
      const failures = results.filter((r) => !r.passed);
      expect(failures, `Fallo en fixture ${key}: ${failures.map((f) => f.detail).join('; ')}`).toEqual([]);
      expect(results.length).toBe(10);
    });
  });

  it('debe validar con 10/10 PASS cada paquete generado por el backend implementado (packet_engine.py)', () => {
    backendPackets.forEach((pkt, index) => {
      const results = validateOsiPacketContract(pkt);
      const failures = results.filter((r) => !r.passed);
      expect(
        failures,
        `Fallo en paquete backend #${index + 1} (${pkt.summary?.protocol}): ${failures.map((f) => f.detail).join('; ')}`
      ).toEqual([]);
      expect(results.every((r) => r.passed)).toBe(true);
    });
  });

  it('debe rechazar correctamente paquetes malformados', () => {
    const invalidPacket = {
      id: -1, // id inválido
      timestamp: '',
      summary: {},
      osi_layers: {},
    };
    const results = validateOsiPacketContract(invalidPacket);
    expect(results.some((r) => !r.passed)).toBe(true);
  });
});

