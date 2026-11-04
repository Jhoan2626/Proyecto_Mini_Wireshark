import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import {
  OsiInspector,
  OsiStackVisualizer,
  OsiLayerAccordionCard,
  HexAsciiPayloadViewer,
  OSI_PEDAGOGICAL_GUIDES,
} from '../components';
import { Spec04OsiInspectorTest } from './Spec04OsiInspectorTest';
import { FIXTURE_PACKETS, CapturedPacket } from './Spec01CaptureTest';
import { TestSuiteRunner } from './TestSuiteRunner';

describe('Spec 04 — Inspector Visual Interactivo de Capas del Modelo OSI (/frontend/src/components/)', () => {
  it('1. [Estado Vacío (Sin Selección)]: muestra estado instructivo cuando packet es null sin producir TypeError', () => {
    render(<OsiInspector packet={null} />);

    const emptyState = screen.getByTestId('osi-inspector-empty');
    expect(emptyState).toBeInTheDocument();
    expect(
      screen.getByText(/Ningún paquete seleccionado para inspección OSI/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/haz clic en una fila de la Tabla de Tráfico/i)
    ).toBeInTheDocument();
    expect(screen.queryByTestId('osi-stack-visualizer')).not.toBeInTheDocument();
  });

  it('2. [Desglose Completo de 4 Capas]: renderiza todos los atributos de Capas 2, 3, 4 y 7 para HTTP/TCP y DNS/UDP', () => {
    const httpPkt = FIXTURE_PACKETS.http_tcp;
    const dnsPkt = FIXTURE_PACKETS.dns_udp;

    const { rerender } = render(<OsiInspector packet={httpPkt} />);

    // Verificar Pila Visual OsiStackVisualizer
    expect(screen.getByTestId('osi-stack-visualizer')).toBeInTheDocument();
    expect(
      screen.getByText(`Tamaño Total Trama: ${httpPkt.summary.length} bytes`)
    ).toBeInTheDocument();

    // Capa 2 (Enlace): protocol, src_mac, dst_mac, ethertype
    expect(screen.getByTestId('layer2-src-mac')).toHaveTextContent(
      httpPkt.osi_layers.layer2_datalink.src_mac
    );
    expect(screen.getByTestId('layer2-dst-mac')).toHaveTextContent(
      httpPkt.osi_layers.layer2_datalink.dst_mac
    );
    expect(screen.getByTestId('layer2-ethertype')).toHaveTextContent(
      `${httpPkt.osi_layers.layer2_datalink.protocol} (${httpPkt.osi_layers.layer2_datalink.ethertype})`
    );

    // Capa 3 (Red): protocol, src_ip, dst_ip, ttl, length
    expect(screen.getByTestId('layer3-src-ip')).toHaveTextContent(
      httpPkt.osi_layers.layer3_network.src_ip
    );
    expect(screen.getByTestId('layer3-dst-ip')).toHaveTextContent(
      httpPkt.osi_layers.layer3_network.dst_ip
    );
    expect(screen.getByTestId('layer3-ttl')).toHaveTextContent(
      `${httpPkt.osi_layers.layer3_network.ttl} saltos`
    );
    expect(screen.getByTestId('layer3-length')).toHaveTextContent(
      `${httpPkt.osi_layers.layer3_network.length} bytes (${httpPkt.osi_layers.layer3_network.protocol})`
    );

    // Capa 4 (Transporte): protocol, src_port, dst_port, flags, checksum
    expect(screen.getByTestId('layer4-ports')).toHaveTextContent(
      `TCP: ${httpPkt.osi_layers.layer4_transport!.src_port} → ${httpPkt.osi_layers.layer4_transport!.dst_port}`
    );
    expect(screen.getByTestId('layer4-flags')).toHaveTextContent(
      httpPkt.osi_layers.layer4_transport!.flags!
    );
    expect(screen.getByTestId('layer4-checksum')).toHaveTextContent(
      httpPkt.osi_layers.layer4_transport!.checksum!
    );

    // Capa 7 (Aplicación): protocol_hint, payload_size, hex_dump, ascii_preview
    expect(screen.getByTestId('layer7-protocol-hint')).toHaveTextContent(
      `Protocolo Inferido: ${httpPkt.osi_layers.layer7_application.protocol_hint}`
    );
    expect(screen.getByTestId('layer7-payload-size')).toHaveTextContent(
      `Tamaño de Carga Útil: ${httpPkt.osi_layers.layer7_application.payload_size} bytes`
    );
    expect(screen.getByTestId('hex-dump-content')).toHaveTextContent(
      httpPkt.osi_layers.layer7_application.hex_dump
    );
    expect(screen.getByTestId('ascii-preview-content')).toHaveTextContent(
      httpPkt.osi_layers.layer7_application.ascii_preview
    );

    // Re-renderizar con DNS/UDP y verificar sus campos
    rerender(<OsiInspector packet={dnsPkt} />);
    expect(screen.getByTestId('layer3-dst-ip')).toHaveTextContent('8.8.8.8');
    expect(screen.getByTestId('layer3-ttl')).toHaveTextContent('128 saltos');
    expect(screen.getByTestId('layer4-ports')).toHaveTextContent('UDP: 59312 → 53');
    expect(screen.getByTestId('layer4-flags')).toHaveTextContent('Ninguno (UDP sin estado)');
    expect(screen.getByTestId('layer4-checksum')).toHaveTextContent('0x9a10');
    expect(screen.getByTestId('layer7-protocol-hint')).toHaveTextContent('Protocolo Inferido: DNS');
    expect(screen.getByTestId('hex-dump-content')).toHaveTextContent(
      dnsPkt.osi_layers.layer7_application.hex_dump
    );
    expect(screen.getByTestId('ascii-preview-content')).toHaveTextContent(
      dnsPkt.osi_layers.layer7_application.ascii_preview
    );
  });

  it('3. [Manejo de Casos Especiales (ARP e ICMP)]: gestiona Broadcast MAC, ausencia de Capa 4 en ARP y puertos nulos en ICMP sin mostrar undefined ni NaN', () => {
    const arpPkt = FIXTURE_PACKETS.arp_broadcast;
    const icmpPkt = FIXTURE_PACKETS.icmp_ping;

    const { rerender, container } = render(<OsiInspector packet={arpPkt} />);

    // Verificar Broadcast MAC FF:FF:FF:FF:FF:FF y etiqueta BROADCAST en Capa 2
    expect(screen.getByTestId('layer2-dst-mac')).toHaveTextContent('FF:FF:FF:FF:FF:FF');
    expect(screen.getByTestId('layer2-broadcast-badge')).toHaveTextContent('BROADCAST');

    // Verificar TTL nulo en ARP en Capa 3
    expect(screen.getByTestId('layer3-ttl')).toHaveTextContent('N/A (Trama ARP local)');

    // Verificar ausencia de puertos / cabecera de Capa 4 en ARP tanto en la pila como en el acordeón
    expect(screen.getByTestId('osi-stack-layer4')).toHaveTextContent('No Aplicable (ARP)');
    expect(screen.getByTestId('osi-stack-layer4')).toHaveTextContent(
      'No aplicable / Sin cabecera de Transporte'
    );
    expect(screen.getByTestId('layer4-not-applicable')).toHaveTextContent(
      /no posee cabecera de Capa 4/i
    );
    expect(screen.getByTestId('layer4-not-applicable')).toHaveTextContent(
      /ni utiliza puertos TCP\/UDP/i
    );

    // También probar ARP con layer4_transport === null explícitamente
    const arpWithNullL4: CapturedPacket = {
      ...arpPkt,
      osi_layers: {
        ...arpPkt.osi_layers,
        layer4_transport: null,
      },
    };
    rerender(<OsiInspector packet={arpWithNullL4} />);
    expect(screen.getByTestId('layer4-not-applicable')).toBeInTheDocument();

    // Probar paquete ICMP Ping (src_port: null, dst_port: null, flags con tipo ICMP)
    rerender(<OsiInspector packet={icmpPkt} />);
    expect(screen.getByTestId('layer4-ports')).toHaveTextContent(
      'ICMP: Sin puertos (Control ICMP)'
    );
    expect(screen.getByTestId('layer4-flags')).toHaveTextContent(
      'Echo Request (Type 8, Code 0)'
    );
    expect(screen.getByTestId('layer4-checksum')).toHaveTextContent('0x4d5a');

    // Asegurar que no aparece 'undefined' ni 'NaN' en ningún lugar del DOM renderizado
    expect(container.textContent).not.toContain('undefined');
    expect(container.textContent).not.toContain('NaN');
  });

  it('4. [Interactividad de Acordeones y Guías Pedagógicas]: expande/colapsa individualmente o en bloque y alterna las explicaciones educativas', () => {
    const httpPkt = FIXTURE_PACKETS.http_tcp;

    // Probar defaultExpandedLayers inicializando solo layer2 y layer4 abiertas
    const { unmount } = render(
      <OsiInspector
        packet={httpPkt}
        defaultExpandedLayers={['layer2', 'layer4']}
        showPedagogicalGuides={true}
      />
    );

    expect(screen.getByTestId('osi-layer-content-layer2')).toBeInTheDocument();
    expect(screen.queryByTestId('osi-layer-content-layer3')).not.toBeInTheDocument();
    expect(screen.getByTestId('osi-layer-content-layer4')).toBeInTheDocument();
    expect(screen.queryByTestId('osi-layer-content-layer7')).not.toBeInTheDocument();

    // Expandir individualmente Capa 3 haciendo clic en su encabezado de acordeón
    fireEvent.click(screen.getByTestId('osi-layer-toggle-layer3'));
    expect(screen.getByTestId('osi-layer-content-layer3')).toBeInTheDocument();

    // Colapsar individualmente Capa 2
    fireEvent.click(screen.getByTestId('osi-layer-toggle-layer2'));
    expect(screen.queryByTestId('osi-layer-content-layer2')).not.toBeInTheDocument();

    // Colapsar Todo en bloque
    fireEvent.click(screen.getByRole('button', { name: /Colapsar Todo/i }));
    expect(screen.queryByTestId('osi-layer-content-layer2')).not.toBeInTheDocument();
    expect(screen.queryByTestId('osi-layer-content-layer3')).not.toBeInTheDocument();
    expect(screen.queryByTestId('osi-layer-content-layer4')).not.toBeInTheDocument();
    expect(screen.queryByTestId('osi-layer-content-layer7')).not.toBeInTheDocument();

    // Expandir Todo en bloque
    fireEvent.click(screen.getByRole('button', { name: /Expandir Todo/i }));
    expect(screen.getByTestId('osi-layer-content-layer2')).toBeInTheDocument();
    expect(screen.getByTestId('osi-layer-content-layer3')).toBeInTheDocument();
    expect(screen.getByTestId('osi-layer-content-layer4')).toBeInTheDocument();
    expect(screen.getByTestId('osi-layer-content-layer7')).toBeInTheDocument();

    // Verificar que las guías pedagógicas están visibles cuando showPedagogicalGuides = true
    expect(screen.getByTestId('pedagogical-role-layer2')).toHaveTextContent(
      OSI_PEDAGOGICAL_GUIDES.layer2.role
    );
    expect(
      screen.getByText(OSI_PEDAGOGICAL_GUIDES.layer3.fields.ttl)
    ).toBeInTheDocument();

    // Alternar Guías Pedagógicas a OFF
    fireEvent.click(screen.getByRole('button', { name: /Guías Pedagógicas/i }));
    expect(screen.queryByTestId('pedagogical-role-layer2')).not.toBeInTheDocument();
    expect(
      screen.queryByText(OSI_PEDAGOGICAL_GUIDES.layer3.fields.ttl)
    ).not.toBeInTheDocument();

    unmount();
  });

  it('5. [Visor Hexadecimal y ASCII Sincronizado]: muestra paneles monoespaciados cuando payload_size > 0 y aviso de control cuando payload_size === 0', () => {
    const httpPkt = FIXTURE_PACKETS.http_tcp;
    const arpZeroPayload = FIXTURE_PACKETS.arp_broadcast;

    const { rerender } = render(
      <HexAsciiPayloadViewer layer7={httpPkt.osi_layers.layer7_application} />
    );

    // Con payload_size > 0
    const viewer = screen.getByTestId('hex-ascii-viewer');
    expect(viewer).toHaveClass('font-mono');
    const hexContent = screen.getByTestId('hex-dump-content');
    const asciiContent = screen.getByTestId('ascii-preview-content');

    expect(hexContent).toHaveClass('font-mono');
    expect(asciiContent).toHaveClass('font-mono');
    expect(hexContent).toHaveTextContent(httpPkt.osi_layers.layer7_application.hex_dump);
    expect(asciiContent).toHaveTextContent(httpPkt.osi_layers.layer7_application.ascii_preview);
    expect(screen.queryByTestId('empty-payload-notice')).not.toBeInTheDocument();

    // Con payload_size === 0 (paquete de control sin datos de aplicación)
    rerender(<HexAsciiPayloadViewer layer7={arpZeroPayload.osi_layers.layer7_application} />);
    expect(screen.queryByTestId('hex-ascii-viewer')).not.toBeInTheDocument();
    const emptyNotice = screen.getByTestId('empty-payload-notice');
    expect(emptyNotice).toBeInTheDocument();
    expect(emptyNotice).toHaveTextContent(/payload_size = 0/i);
    expect(emptyNotice).toHaveTextContent(/exclusivamente de control en capas inferiores/i);
  });

  it('6. [Certificación SDD Spec04OsiInspectorTest]: recorre los 5 escenarios, sincroniza externalPacket y aprueba los 5 criterios de aceptación', async () => {
    let validationPassed = false;
    const onValidationChange = vi.fn((passed: boolean) => {
      validationPassed = passed;
    });

    const { rerender } = render(
      <Spec04OsiInspectorTest onValidationChange={onValidationChange} />
    );

    // Inicialmente escenario 1 (HTTP/TCP) activo -> 1/4 verificados
    expect(screen.getByTestId('verified-scenarios-count')).toHaveTextContent('1/4');
    expect(validationPassed).toBe(false);

    // Seleccionar escenario 2: DNS / UDP
    fireEvent.click(screen.getByRole('button', { name: /2\. DNS \/ UDP/i }));
    expect(screen.getByTestId('verified-scenarios-count')).toHaveTextContent('2/4');
    expect(screen.getByTestId('layer4-ports')).toHaveTextContent('UDP: 59312 → 53');

    // Seleccionar escenario 3: ICMP Ping
    fireEvent.click(screen.getByRole('button', { name: /3\. ICMP Ping/i }));
    expect(screen.getByTestId('verified-scenarios-count')).toHaveTextContent('3/4');
    expect(screen.getByTestId('layer4-ports')).toHaveTextContent(
      'ICMP: Sin puertos (Control ICMP)'
    );

    // Seleccionar escenario 4: ARP Broadcast
    fireEvent.click(screen.getByRole('button', { name: /4\. ARP Broadcast/i }));
    expect(screen.getByTestId('verified-scenarios-count')).toHaveTextContent('4/4');
    expect(screen.getByTestId('layer4-not-applicable')).toBeInTheDocument();

    // Seleccionar escenario 5: Estado Vacío (null)
    fireEvent.click(screen.getByRole('button', { name: /5\. Estado Vacío/i }));
    expect(screen.getByTestId('osi-inspector-empty')).toBeInTheDocument();

    // Verificar que todos los criterios de Spec 04 están en ✓ VERIFICADO y onValidationChange notificó true
    await waitFor(() => {
      expect(validationPassed).toBe(true);
    });
    const verifiedBadges = screen.getAllByText('✓ VERIFICADO');
    expect(verifiedBadges.length).toBe(5);

    // Verificar recepción de externalPacket desde la Tabla de Tráfico (Fase 3 -> Fase 4)
    rerender(
      <Spec04OsiInspectorTest
        onValidationChange={onValidationChange}
        externalPacket={FIXTURE_PACKETS.dns_udp}
      />
    );
    expect(screen.getByTestId('layer3-dst-ip')).toHaveTextContent('8.8.8.8');
  });

  it('7. [Integración End-to-End Fase 3 → Fase 4 en TestSuiteRunner]: seleccionar un paquete en la tabla de Fase 3 actualiza el Inspector OSI en Fase 4', () => {
    render(<TestSuiteRunner />);

    // Ir a la pestaña Fase 3 (Tabla de Tráfico)
    fireEvent.click(screen.getByRole('button', { name: /Tabla de Tráfico & Filtros/i }));

    // Seleccionar la fila #4 (ARP Broadcast) en la tabla de tráfico
    fireEvent.click(screen.getByTestId('packet-row-4'));

    // Cambiar a la pestaña Fase 4 (Inspector Visual Modelo OSI)
    fireEvent.click(screen.getByRole('button', { name: /Inspector Visual Modelo OSI/i }));

    // Verificar que el paquete #4 (ARP Broadcast) aparece cargado en el Inspector OSI
    expect(
      screen.getByText(/Pila Visual de Encapsulamiento del Paquete #4 \(ARP\)/i)
    ).toBeInTheDocument();
    expect(screen.getByTestId('layer2-broadcast-badge')).toHaveTextContent('BROADCAST');
    expect(screen.getByTestId('layer4-not-applicable')).toBeInTheDocument();
  });
});
