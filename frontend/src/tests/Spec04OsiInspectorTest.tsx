import React, { useState, useEffect } from 'react';
import { CapturedPacket, FIXTURE_PACKETS } from './Spec01CaptureTest';

// ============================================================================
// DICCIONARIO PEDAGÓGICO DEL MODELO OSI PARA VALIDACIÓN DE SPEC 04
// ============================================================================

const OSI_PEDAGOGICAL_GUIDES = {
  layer2: {
    title: 'Capa 2 — Enlace de Datos (Data Link Layer)',
    pdu: 'Trama (Frame)',
    role: 'Entrega física nodo a nodo dentro de la misma red de área local (LAN) mediante direccionamiento MAC de 48 bits.',
    fields: {
      src_mac:
        'Dirección física de 6 bytes quemada en la tarjeta de red (NIC) del dispositivo emisor.',
      dst_mac:
        'Dirección física del receptor local o del gateway. Si es FF:FF:FF:FF:FF:FF indica difusión (Broadcast) a todos los equipos de la LAN.',
      ethertype:
        'Código de 16 bits que indica qué protocolo de Capa 3 viaja encapsulado (0x0800 = IPv4, 0x0806 = ARP, 0x86DD = IPv6).',
    },
  },
  layer3: {
    title: 'Capa 3 — Red (Network Layer)',
    pdu: 'Paquete (Packet)',
    role: 'Enrutamiento lógico extremo a extremo entre diferentes subredes e Internet mediante direcciones IP.',
    fields: {
      src_ip: 'Dirección lógica jerárquica del host que originó el paquete.',
      dst_ip: 'Dirección lógica del host destino final hacia donde los routers encaminan el paquete.',
      ttl: 'Time To Live (Tiempo de Vida): Contador de saltos que cada router disminuye en 1. Si llega a 0 el paquete se descarta evitando bucles infinitos.',
      length: 'Longitud total del paquete en bytes (incluyendo cabeceras y carga útil).',
    },
  },
  layer4: {
    title: 'Capa 4 — Transporte (Transport Layer)',
    pdu: 'Segmento (TCP) / Datagrama (UDP)',
    role: 'Comunicación lógica proceso a proceso (multiplexación por puertos), control de flujo y fiabilidad.',
    fields: {
      ports:
        'Los puertos (1–65535) identifican el proceso exacto en el cliente (puerto efímero) y el servicio en el servidor (ej. 80 HTTP, 443 HTTPS, 53 DNS).',
      flags:
        'Banderas de control de estado en TCP (SYN inicia conexión, ACK confirma recepción, PSH entrega inmediata a la app, FIN cierra sesión) o tipo de mensaje ICMP.',
      checksum:
        'Suma de comprobación matemática para detectar corrupción de bits durante la transmisión.',
    },
  },
  layer7: {
    title: 'Capa 7 — Aplicación y Carga Útil (Application Layer)',
    pdu: 'Datos / Mensaje (Payload)',
    role: 'Protocolos que interactúan directamente con el software del usuario (HTTP, DNS, TLS, SSH) y los bytes crudos transportados.',
    fields: {
      payload:
        'Representación dual en Hexadecimal (bytes exactos en la red) y ASCII seguro (caracteres imprimibles legibles por humanos).',
    },
  },
};

export interface Spec04OsiInspectorTestProps {
  onValidationChange?: (allPassed: boolean) => void;
  externalPacket?: CapturedPacket | null;
}

export const Spec04OsiInspectorTest: React.FC<Spec04OsiInspectorTestProps> = ({
  onValidationChange,
  externalPacket,
}) => {
  const [selectedScenario, setSelectedScenario] = useState<string>('http_tcp');
  const [packet, setPacket] = useState<CapturedPacket | null>(FIXTURE_PACKETS.http_tcp);
  const [showPedagogicalHelp, setShowPedagogicalHelp] = useState<boolean>(true);
  const [expandedLayers, setExpandedLayers] = useState<Record<string, boolean>>({
    layer2: true,
    layer3: true,
    layer4: true,
    layer7: true,
  });

  // Seguimiento de escenarios probados para certificar Spec 04
  const [testedScenarios, setTestedScenarios] = useState<Record<string, boolean>>({
    http_tcp: true,
    dns_udp: false,
    icmp_ping: false,
    arp_broadcast: false,
  });

  useEffect(() => {
    if (externalPacket) {
      setPacket(externalPacket);
      setSelectedScenario('external');
    }
  }, [externalPacket]);

  const allScenariosVerified = Object.values(testedScenarios).every(Boolean);

  useEffect(() => {
    onValidationChange?.(allScenariosVerified);
  }, [allScenariosVerified, onValidationChange]);

  const handleSelectScenario = (key: string) => {
    setSelectedScenario(key);
    if (key === 'null_state') {
      setPacket(null);
      return;
    }
    const target = FIXTURE_PACKETS[key];
    if (target) {
      setPacket(target);
      setTestedScenarios((prev) => ({ ...prev, [key]: true }));
    }
  };

  const toggleLayer = (layerKey: string) => {
    setExpandedLayers((prev) => ({ ...prev, [layerKey]: !prev[layerKey] }));
  };

  const setAllExpanded = (expand: boolean) => {
    setExpandedLayers({
      layer2: expand,
      layer3: expand,
      layer4: expand,
      layer7: expand,
    });
  };

  const l2 = packet?.osi_layers.layer2_datalink;
  const l3 = packet?.osi_layers.layer3_network;
  const l4 = packet?.osi_layers.layer4_transport;
  const l7 = packet?.osi_layers.layer7_application;

  const hasTransportPorts = l4 && (l4.protocol === 'TCP' || l4.protocol === 'UDP');
  const isArpPacket = l3?.protocol === 'ARP' || l4?.protocol === 'NONE';

  return (
    <div className="space-y-6 text-slate-100">
      {/* Cabecera del Banco de Pruebas Fase 4 */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-5 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-purple-500/10 px-3 py-1 text-xs font-semibold text-purple-400 border border-purple-500/30">
              FASE 4 • PERSONA 2 (FRONTEND / INSPECTOR VISUAL DEL MODELO OSI)
            </span>
            <h2 className="mt-2 text-xl font-bold text-white">
              Spec 04 — Banco de Pruebas del Inspector Visual Interactivo OSI
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Comprueba el desglose jerárquico por capa OSI, acordeones con código de color,
              explicaciones pedagógicas y visor Hexadecimal/ASCII según{' '}
              <code className="text-slate-300">/specs/04-inspector-visual-osi.md</code>.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowPedagogicalHelp((prev) => !prev)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                showPedagogicalHelp
                  ? 'border-emerald-500/40 bg-emerald-950/40 text-emerald-300'
                  : 'border-slate-700 bg-slate-800 text-slate-400'
              }`}
            >
              {showPedagogicalHelp ? '🎓 Guías Pedagógicas: ON' : '🎓 Guías Pedagógicas: OFF'}
            </button>
            <button
              type="button"
              onClick={() => setAllExpanded(true)}
              className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700"
            >
              Expandir Todo
            </button>
            <button
              type="button"
              onClick={() => setAllExpanded(false)}
              className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700"
            >
              Colapsar Todo
            </button>
          </div>
        </div>

        {/* Selector de Escenarios de Paquetes de Prueba */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 mr-1">
              Alternar Paquete de Prueba:
            </span>
            {[
              { key: 'http_tcp', label: '1. HTTP / TCP (Capas 2,3,4,7)' },
              { key: 'dns_udp', label: '2. DNS / UDP (Datagrama)' },
              { key: 'icmp_ping', label: '3. ICMP Ping (Sin Puertos L4)' },
              { key: 'arp_broadcast', label: '4. ARP Broadcast (Solo L2/L3)' },
              { key: 'null_state', label: '5. Estado Vacío (null)' },
            ].map((sc) => (
              <button
                key={sc.key}
                type="button"
                onClick={() => handleSelectScenario(sc.key)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  selectedScenario === sc.key
                    ? 'bg-purple-600 text-white shadow'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {sc.label}
              </button>
            ))}
          </div>

          <span className="text-xs text-slate-400">
            Escenarios verificados:{' '}
            <strong className="text-emerald-400">
              {Object.values(testedScenarios).filter(Boolean).length}/4
            </strong>
          </span>
        </div>
      </div>

      {/* Estado Vacío si packet === null */}
      {!packet ? (
        <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/60 p-12 text-center">
          <div className="text-lg font-bold text-slate-300">
            Ningún paquete seleccionado para inspección OSI
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Selecciona cualquiera de los escenarios superiores o haz clic en una fila de la Tabla de
            Tráfico (Fase 3) para visualizar el desencapsulamiento capa por capa.
          </p>
        </div>
      ) : (
        <>
          {/* Barra Visual de Encapsulamiento del Modelo OSI */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Pila Visual de Encapsulamiento del Paquete #{packet.id} ({packet.summary.protocol})
              </span>
              <span className="font-mono text-xs text-slate-400">
                Tamaño Total Trama: {packet.summary.length} bytes
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
                <div className="text-[10px] font-bold uppercase text-amber-300">
                  CAPA 2 • ENLACE DE DATOS
                </div>
                <div className="mt-1 font-mono text-xs font-bold text-white">
                  {l2?.protocol} ({l2?.ethertype})
                </div>
                <div className="mt-0.5 font-mono text-[11px] text-amber-200/80">
                  {l2?.src_mac} → {l2?.dst_mac}
                </div>
              </div>

              <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3">
                <div className="text-[10px] font-bold uppercase text-emerald-300">
                  CAPA 3 • RED
                </div>
                <div className="mt-1 font-mono text-xs font-bold text-white">
                  {l3?.protocol} (TTL: {l3?.ttl ?? 'N/A'})
                </div>
                <div className="mt-0.5 font-mono text-[11px] text-emerald-200/80">
                  {l3?.src_ip} → {l3?.dst_ip}
                </div>
              </div>

              <div
                className={`rounded-lg border p-3 ${
                  isArpPacket
                    ? 'border-slate-700 bg-slate-900/50 opacity-60'
                    : 'border-blue-500/40 bg-blue-500/10'
                }`}
              >
                <div className="text-[10px] font-bold uppercase text-blue-300">
                  CAPA 4 • TRANSPORTE
                </div>
                <div className="mt-1 font-mono text-xs font-bold text-white">
                  {isArpPacket ? 'No Aplicable (ARP)' : l4?.protocol}
                </div>
                <div className="mt-0.5 font-mono text-[11px] text-blue-200/80">
                  {hasTransportPorts
                    ? `Puerto ${l4?.src_port} → ${l4?.dst_port}`
                    : l4?.flags || 'Sin puertos'}
                </div>
              </div>

              <div className="rounded-lg border border-purple-500/40 bg-purple-500/10 p-3">
                <div className="text-[10px] font-bold uppercase text-purple-300">
                  CAPA 7 • APLICACIÓN / PAYLOAD
                </div>
                <div className="mt-1 font-mono text-xs font-bold text-white">
                  {l7?.protocol_hint}
                </div>
                <div className="mt-0.5 font-mono text-[11px] text-purple-200/80">
                  Carga útil: {l7?.payload_size} bytes
                </div>
              </div>
            </div>
          </div>

          {/* Acordeones Interactivos de las 4 Capas Analizadas */}
          <div className="space-y-4">
            {/* TARJETA CAPA 2: ENLACE DE DATOS */}
            <div className="rounded-xl border border-amber-500/30 bg-slate-900/90 overflow-hidden">
              <button
                type="button"
                onClick={() => toggleLayer('layer2')}
                className="flex w-full items-center justify-between bg-amber-500/10 px-4 py-3 text-left hover:bg-amber-500/15 transition"
              >
                <div className="flex items-center gap-3">
                  <span className="rounded bg-amber-500 px-2 py-0.5 text-xs font-black text-slate-950">
                    OSI L2
                  </span>
                  <span className="font-bold text-amber-300">
                    {OSI_PEDAGOGICAL_GUIDES.layer2.title}
                  </span>
                  <span className="text-xs text-amber-200/70">
                    PDU: {OSI_PEDAGOGICAL_GUIDES.layer2.pdu}
                  </span>
                </div>
                <span className="font-mono text-xs text-amber-300">
                  {expandedLayers.layer2 ? '▼ Colapsar' : '▶ Expandir'}
                </span>
              </button>

              {expandedLayers.layer2 && l2 && (
                <div className="p-4 space-y-3">
                  {showPedagogicalHelp && (
                    <p className="rounded-lg border border-amber-500/20 bg-amber-950/20 p-2.5 text-xs text-amber-200">
                      💡 <strong>Función en el Modelo OSI:</strong>{' '}
                      {OSI_PEDAGOGICAL_GUIDES.layer2.role}
                    </p>
                  )}

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 font-mono text-xs">
                    <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                      <div className="text-slate-400">MAC Origen (`src_mac`)</div>
                      <div className="mt-1 text-sm font-bold text-amber-300">{l2.src_mac}</div>
                      {showPedagogicalHelp && (
                        <div className="mt-1.5 font-sans text-[11px] text-slate-400">
                          {OSI_PEDAGOGICAL_GUIDES.layer2.fields.src_mac}
                        </div>
                      )}
                    </div>

                    <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                      <div className="text-slate-400">MAC Destino (`dst_mac`)</div>
                      <div className="mt-1 text-sm font-bold text-amber-300">
                        {l2.dst_mac}{' '}
                        {l2.dst_mac.toUpperCase() === 'FF:FF:FF:FF:FF:FF' && (
                          <span className="ml-1 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px]">
                            BROADCAST
                          </span>
                        )}
                      </div>
                      {showPedagogicalHelp && (
                        <div className="mt-1.5 font-sans text-[11px] text-slate-400">
                          {OSI_PEDAGOGICAL_GUIDES.layer2.fields.dst_mac}
                        </div>
                      )}
                    </div>

                    <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                      <div className="text-slate-400">Protocolo / EtherType</div>
                      <div className="mt-1 text-sm font-bold text-amber-300">
                        {l2.protocol} ({l2.ethertype})
                      </div>
                      {showPedagogicalHelp && (
                        <div className="mt-1.5 font-sans text-[11px] text-slate-400">
                          {OSI_PEDAGOGICAL_GUIDES.layer2.fields.ethertype}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* TARJETA CAPA 3: RED */}
            <div className="rounded-xl border border-emerald-500/30 bg-slate-900/90 overflow-hidden">
              <button
                type="button"
                onClick={() => toggleLayer('layer3')}
                className="flex w-full items-center justify-between bg-emerald-500/10 px-4 py-3 text-left hover:bg-emerald-500/15 transition"
              >
                <div className="flex items-center gap-3">
                  <span className="rounded bg-emerald-500 px-2 py-0.5 text-xs font-black text-slate-950">
                    OSI L3
                  </span>
                  <span className="font-bold text-emerald-300">
                    {OSI_PEDAGOGICAL_GUIDES.layer3.title}
                  </span>
                  <span className="text-xs text-emerald-200/70">
                    PDU: {OSI_PEDAGOGICAL_GUIDES.layer3.pdu}
                  </span>
                </div>
                <span className="font-mono text-xs text-emerald-300">
                  {expandedLayers.layer3 ? '▼ Colapsar' : '▶ Expandir'}
                </span>
              </button>

              {expandedLayers.layer3 && l3 && (
                <div className="p-4 space-y-3">
                  {showPedagogicalHelp && (
                    <p className="rounded-lg border border-emerald-500/20 bg-emerald-950/20 p-2.5 text-xs text-emerald-200">
                      💡 <strong>Función en el Modelo OSI:</strong>{' '}
                      {OSI_PEDAGOGICAL_GUIDES.layer3.role}
                    </p>
                  )}

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-4 font-mono text-xs">
                    <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                      <div className="text-slate-400">IP Origen (`src_ip`)</div>
                      <div className="mt-1 text-sm font-bold text-emerald-300">{l3.src_ip}</div>
                      {showPedagogicalHelp && (
                        <div className="mt-1.5 font-sans text-[11px] text-slate-400">
                          {OSI_PEDAGOGICAL_GUIDES.layer3.fields.src_ip}
                        </div>
                      )}
                    </div>

                    <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                      <div className="text-slate-400">IP Destino (`dst_ip`)</div>
                      <div className="mt-1 text-sm font-bold text-emerald-300">{l3.dst_ip}</div>
                      {showPedagogicalHelp && (
                        <div className="mt-1.5 font-sans text-[11px] text-slate-400">
                          {OSI_PEDAGOGICAL_GUIDES.layer3.fields.dst_ip}
                        </div>
                      )}
                    </div>

                    <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                      <div className="text-slate-400">TTL (`ttl`)</div>
                      <div className="mt-1 text-sm font-bold text-emerald-300">
                        {l3.ttl !== null ? `${l3.ttl} saltos` : 'N/A (Trama ARP local)'}
                      </div>
                      {showPedagogicalHelp && (
                        <div className="mt-1.5 font-sans text-[11px] text-slate-400">
                          {OSI_PEDAGOGICAL_GUIDES.layer3.fields.ttl}
                        </div>
                      )}
                    </div>

                    <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                      <div className="text-slate-400">Longitud (`length`)</div>
                      <div className="mt-1 text-sm font-bold text-emerald-300">
                        {l3.length} bytes ({l3.protocol})
                      </div>
                      {showPedagogicalHelp && (
                        <div className="mt-1.5 font-sans text-[11px] text-slate-400">
                          {OSI_PEDAGOGICAL_GUIDES.layer3.fields.length}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* TARJETA CAPA 4: TRANSPORTE */}
            <div className="rounded-xl border border-blue-500/30 bg-slate-900/90 overflow-hidden">
              <button
                type="button"
                onClick={() => toggleLayer('layer4')}
                className="flex w-full items-center justify-between bg-blue-500/10 px-4 py-3 text-left hover:bg-blue-500/15 transition"
              >
                <div className="flex items-center gap-3">
                  <span className="rounded bg-blue-500 px-2 py-0.5 text-xs font-black text-slate-950">
                    OSI L4
                  </span>
                  <span className="font-bold text-blue-300">
                    {OSI_PEDAGOGICAL_GUIDES.layer4.title}
                  </span>
                  <span className="text-xs text-blue-200/70">
                    PDU: {OSI_PEDAGOGICAL_GUIDES.layer4.pdu}
                  </span>
                </div>
                <span className="font-mono text-xs text-blue-300">
                  {expandedLayers.layer4 ? '▼ Colapsar' : '▶ Expandir'}
                </span>
              </button>

              {expandedLayers.layer4 && (
                <div className="p-4 space-y-3">
                  {showPedagogicalHelp && (
                    <p className="rounded-lg border border-blue-500/20 bg-blue-950/20 p-2.5 text-xs text-blue-200">
                      💡 <strong>Función en el Modelo OSI:</strong>{' '}
                      {OSI_PEDAGOGICAL_GUIDES.layer4.role}
                    </p>
                  )}

                  {isArpPacket || !l4 ? (
                    <div className="rounded-lg border border-slate-800 bg-slate-950 p-4 text-xs text-slate-300">
                      ℹ️ <strong>Nota Pedagógica:</strong> Este paquete es de tipo{' '}
                      <code className="text-purple-300">ARP</code> (Resolución de Direcciones MAC en
                      Capa 2/3), por lo que <strong>no posee cabecera de Capa 4</strong> ni utiliza
                      puertos TCP/UDP.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 font-mono text-xs">
                      <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                        <div className="text-slate-400">Protocolo y Puertos</div>
                        <div className="mt-1 text-sm font-bold text-blue-300">
                          {l4.protocol}:{' '}
                          {hasTransportPorts
                            ? `${l4.src_port} → ${l4.dst_port}`
                            : 'Sin puertos (Control ICMP)'}
                        </div>
                        {showPedagogicalHelp && (
                          <div className="mt-1.5 font-sans text-[11px] text-slate-400">
                            {OSI_PEDAGOGICAL_GUIDES.layer4.fields.ports}
                          </div>
                        )}
                      </div>

                      <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                        <div className="text-slate-400">Flags / Control (`flags`)</div>
                        <div className="mt-1 text-sm font-bold text-blue-300">
                          {l4.flags ?? 'Ninguno (UDP sin estado)'}
                        </div>
                        {showPedagogicalHelp && (
                          <div className="mt-1.5 font-sans text-[11px] text-slate-400">
                            {OSI_PEDAGOGICAL_GUIDES.layer4.fields.flags}
                          </div>
                        )}
                      </div>

                      <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                        <div className="text-slate-400">Checksum (`checksum`)</div>
                        <div className="mt-1 text-sm font-bold text-blue-300">
                          {l4.checksum ?? 'N/A'}
                        </div>
                        {showPedagogicalHelp && (
                          <div className="mt-1.5 font-sans text-[11px] text-slate-400">
                            {OSI_PEDAGOGICAL_GUIDES.layer4.fields.checksum}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* TARJETA CAPA 7: APLICACIÓN Y VISOR HEX/ASCII */}
            <div className="rounded-xl border border-purple-500/30 bg-slate-900/90 overflow-hidden">
              <button
                type="button"
                onClick={() => toggleLayer('layer7')}
                className="flex w-full items-center justify-between bg-purple-500/10 px-4 py-3 text-left hover:bg-purple-500/15 transition"
              >
                <div className="flex items-center gap-3">
                  <span className="rounded bg-purple-500 px-2 py-0.5 text-xs font-black text-slate-950">
                    OSI L7
                  </span>
                  <span className="font-bold text-purple-300">
                    {OSI_PEDAGOGICAL_GUIDES.layer7.title}
                  </span>
                  <span className="text-xs text-purple-200/70">
                    PDU: {OSI_PEDAGOGICAL_GUIDES.layer7.pdu}
                  </span>
                </div>
                <span className="font-mono text-xs text-purple-300">
                  {expandedLayers.layer7 ? '▼ Colapsar' : '▶ Expandir'}
                </span>
              </button>

              {expandedLayers.layer7 && l7 && (
                <div className="p-4 space-y-3">
                  {showPedagogicalHelp && (
                    <p className="rounded-lg border border-purple-500/20 bg-purple-950/20 p-2.5 text-xs text-purple-200">
                      💡 <strong>Función en el Modelo OSI:</strong>{' '}
                      {OSI_PEDAGOGICAL_GUIDES.layer7.role}{' '}
                      {OSI_PEDAGOGICAL_GUIDES.layer7.fields.payload}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
                    <span className="rounded bg-purple-500/20 px-2.5 py-1 text-purple-300 font-bold">
                      Protocolo Inferido: {l7.protocol_hint}
                    </span>
                    <span className="rounded bg-slate-800 px-2.5 py-1 text-slate-300">
                      Tamaño de Carga Útil: {l7.payload_size} bytes
                    </span>
                  </div>

                  {l7.payload_size === 0 ? (
                    <div className="rounded-lg border border-slate-800 bg-slate-950 p-4 text-xs text-slate-400">
                      Este paquete no transporta carga útil de aplicación (`payload_size = 0`). Sus
                      funciones son exclusivamente de control en capas inferiores.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 font-mono text-xs">
                      <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                        <div className="text-[11px] font-bold uppercase text-slate-400 mb-1.5">
                          Volcado Hexadecimal (`hex_dump`)
                        </div>
                        <div className="leading-relaxed text-amber-300 break-words">
                          {l7.hex_dump}
                        </div>
                      </div>

                      <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                        <div className="text-[11px] font-bold uppercase text-slate-400 mb-1.5">
                          Vista Previa ASCII Sanitizada (`ascii_preview`)
                        </div>
                        <div className="leading-relaxed text-emerald-300 break-all">
                          {l7.ascii_preview}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Spec04OsiInspectorTest;

