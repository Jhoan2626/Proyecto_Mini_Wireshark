import React, { useState, useEffect } from 'react';
import { CapturedPacket } from '../tests/Spec01CaptureTest';
import { getLightProtocolBadgeClasses } from './LiveTrafficPanel';

export interface OsiInspectorPanelProps {
  packet: CapturedPacket | null;
}

function getEtherTypeLabel(ethertype: string, ethertypeName?: string): string {
  if (ethertypeName) {
    return `${ethertype} - ${ethertypeName}`;
  }
  const normalized = ethertype.toLowerCase();
  if (normalized === '0x0800') return '0x0800 - IPv4';
  if (normalized === '0x0806') return '0x0806 - ARP';
  if (normalized === '0x86dd') return '0x86DD - IPv6';
  return ethertype;
}

function getPacketContextTitle(packet: CapturedPacket): string {
  const proto = packet.summary.protocol;
  const { src_ip, dst_ip } = packet.summary;
  switch (proto) {
    case 'HTTP':
    case 'HTTPS':
      return `Paquete #${packet.id} · Comunicación Web entre ${src_ip} y ${dst_ip}`;
    case 'DNS':
      return `Paquete #${packet.id} · Consulta de Dominio DNS entre ${src_ip} y ${dst_ip}`;
    case 'TCP':
      return `Paquete #${packet.id} · Sesión de Transporte TCP entre ${src_ip} y ${dst_ip}`;
    case 'UDP':
      return `Paquete #${packet.id} · Datagrama UDP entre ${src_ip} y ${dst_ip}`;
    case 'ICMP':
      return `Paquete #${packet.id} · Diagnóstico ICMP entre ${src_ip} y ${dst_ip}`;
    case 'ARP':
      return `Paquete #${packet.id} · Resolución Físico-Lógica ARP entre ${src_ip} y ${dst_ip}`;
    default:
      return `Paquete #${packet.id} · Tráfico de Red entre ${src_ip} y ${dst_ip}`;
  }
}

export const OsiInspectorPanel: React.FC<OsiInspectorPanelProps> = ({ packet }) => {
  // El acordeón de datos crudos (Hex/ASCII) inicia colapsado por defecto (Sección 4.3)
  const [isRawPayloadExpanded, setIsRawPayloadExpanded] = useState<boolean>(false);

  // Al cambiar de paquete seleccionado, vuelve a colapsarse por defecto para no saturar visualmente
  useEffect(() => {
    setIsRawPayloadExpanded(false);
  }, [packet?.id]);

  if (!packet) {
    return (
      <aside
        data-testid="osi-inspector-panel"
        aria-label="Inspector del Modelo OSI"
        className="w-[42%] flex flex-col bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden m-3 ml-1.5"
      >
        <div
          data-testid="unified-osi-empty-state"
          className="flex-1 flex flex-col items-center justify-center p-8 text-center"
        >
          <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 mb-3">
            <svg
              className="w-6 h-6"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polygon points="12 2 2 7 12 12 22 7 12 2" />
              <polyline points="2 17 12 22 22 17" />
              <polyline points="2 12 12 17 22 12" />
            </svg>
          </div>
          <h3 className="text-slate-900 font-semibold tracking-tight text-sm">
            Inspector Pedagógico del Modelo OSI
          </h3>
          <p className="mt-1.5 text-slate-500 text-xs max-w-xs leading-relaxed">
            Selecciona un paquete de la tabla para desglosar sus cabeceras en el Modelo OSI
          </p>
        </div>
      </aside>
    );
  }

  const l2 = packet.osi_layers.layer2_datalink;
  const l3 = packet.osi_layers.layer3_network;
  const l4 = packet.osi_layers.layer4_transport;
  const l7 = packet.osi_layers.layer7_application;

  const isArpPacket = l3?.protocol === 'ARP' || !l4 || l4.protocol === 'NONE';
  const hasTransportPorts = Boolean(
    l4 &&
      (l4.protocol === 'TCP' || l4.protocol === 'UDP') &&
      typeof l4.src_port === 'number' &&
      typeof l4.dst_port === 'number'
  );

  return (
    <aside
      data-testid="osi-inspector-panel"
      aria-label="Inspector del Modelo OSI"
      className="w-[42%] flex flex-col bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden m-3 ml-1.5"
    >
      {/* Cabecera del Inspector */}
      <div className="bg-slate-50/80 border-b border-slate-200 px-4 py-3 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <h2
            data-testid="unified-inspector-header"
            className="text-slate-900 font-semibold tracking-tight text-sm truncate"
          >
            {getPacketContextTitle(packet)}
          </h2>
          <div className="flex items-center gap-2 shrink-0">
            <span
              className={`px-2 py-0.5 rounded-md text-xs font-semibold border ${getLightProtocolBadgeClasses(
                packet.summary.protocol
              )}`}
            >
              {packet.summary.protocol}
            </span>
            <span className="font-mono text-xs text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/60">
              {packet.summary.length} bytes
            </span>
          </div>
        </div>

        {/* Ruta Visual de Encapsulación OSI (OsiPathwayBar) */}
        <div
          data-testid="osi-pathway-bar"
          className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[11px]"
        >
          <span className="px-2 py-0.5 rounded-md font-medium bg-cyan-50 text-cyan-700 border border-cyan-200">
            Capa 2: Enlace
          </span>
          <span className="text-slate-400">→</span>
          <span className="px-2 py-0.5 rounded-md font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            Capa 3: Red
          </span>
          <span className="text-slate-400">→</span>
          {isArpPacket ? (
            <span
              data-testid="osi-pathway-layer4-omitted"
              className="px-2 py-0.5 rounded-md font-medium bg-slate-100 text-slate-500 border border-slate-200"
              title="Omitida por diseño del protocolo"
            >
              Capa 4: Transporte (Omitida por diseño del protocolo)
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-md font-medium bg-blue-50 text-blue-700 border border-blue-200">
              Capa 4: Transporte ({l4?.protocol})
            </span>
          )}
          <span className="text-slate-400">→</span>
          <span className="px-2 py-0.5 rounded-md font-medium bg-purple-50 text-purple-700 border border-purple-200">
            Capa 7: Aplicación
          </span>
        </div>
      </div>

      {/* Cuerpo Scrollable: 4 Tarjetas Desglosadas por Capa con Lenguaje Pedagógico */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* 1. CAPA 2 · ENLACE DE DATOS */}
        <article
          data-testid="unified-layer-card-2"
          className="rounded-xl border border-cyan-200 bg-white p-3.5 shadow-2xs"
        >
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-cyan-50 text-cyan-700 border border-cyan-200">
                Capa 2
              </span>
              <h3 className="text-slate-900 font-semibold text-xs">
                Enlace de Datos (Conexión Física / Red Local)
              </h3>
            </div>
            <span className="text-slate-500 text-xs font-medium">{l2.protocol}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 my-2">
            <div className="bg-slate-50 rounded-lg p-2 border border-slate-200/70">
              <div className="text-slate-500 text-xs font-medium mb-1">
                MAC Origen → MAC Destino
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-mono text-xs text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/60">
                  {l2.src_mac}
                </span>
                <span className="text-slate-400 text-xs">→</span>
                <span className="font-mono text-xs text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/60">
                  {l2.dst_mac}
                </span>
                {l2.dst_mac.toUpperCase() === 'FF:FF:FF:FF:FF:FF' && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                    Broadcast
                  </span>
                )}
              </div>
            </div>

            <div className="bg-slate-50 rounded-lg p-2 border border-slate-200/70">
              <div className="text-slate-500 text-xs font-medium mb-1">EtherType</div>
              <span className="font-mono text-xs text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/60">
                {getEtherTypeLabel(l2.ethertype, l2.ethertype_name)}
              </span>
            </div>
          </div>

          <p
            data-testid="unified-pedagogy-note-2"
            className="text-slate-600 text-xs bg-cyan-50/50 border border-cyan-100 rounded-lg px-2.5 py-1.5 leading-relaxed"
          >
            Esta capa identifica los adaptadores de red físicos (tarjetas Wi-Fi o Ethernet)
            involucrados en el salto actual dentro de la red local.
          </p>
        </article>

        {/* 2. CAPA 3 · RED */}
        <article
          data-testid="unified-layer-card-3"
          className="rounded-xl border border-emerald-200 bg-white p-3.5 shadow-2xs"
        >
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Capa 3
              </span>
              <h3 className="text-slate-900 font-semibold text-xs">
                Red (Enrutamiento Lógico Global)
              </h3>
            </div>
            <span className="text-slate-500 text-xs font-medium">{l3.protocol}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 my-2">
            <div className="sm:col-span-2 bg-slate-50 rounded-lg p-2 border border-slate-200/70">
              <div className="text-slate-500 text-xs font-medium mb-1">
                IP Origen → IP Destino
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-mono text-xs text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/60">
                  {l3.src_ip}
                </span>
                <span className="text-slate-400 text-xs">→</span>
                <span className="font-mono text-xs text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/60">
                  {l3.dst_ip}
                </span>
              </div>
            </div>

            <div className="bg-slate-50 rounded-lg p-2 border border-slate-200/70 flex flex-col justify-between">
              <div className="text-slate-500 text-xs font-medium mb-1">
                TTL y Longitud Total
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-mono text-xs text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/60">
                  TTL: {l3.ttl !== null ? `${l3.ttl} saltos` : 'Local (ARP)'}
                </span>
                <span className="font-mono text-xs text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/60">
                  {l3.length} B
                </span>
              </div>
            </div>
          </div>

          <p
            data-testid="unified-pedagogy-note-3"
            className="text-slate-600 text-xs bg-emerald-50/50 border border-emerald-100 rounded-lg px-2.5 py-1.5 leading-relaxed"
          >
            Guía el paquete a través de enrutadores desde el equipo emisor hasta su destino final
            en Internet o en otra subred. El TTL evita que viaje en bucles infinitos.
          </p>
        </article>

        {/* 3. CAPA 4 · TRANSPORTE */}
        <article
          data-testid="unified-layer-card-4"
          className="rounded-xl border border-blue-200 bg-white p-3.5 shadow-2xs"
        >
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                Capa 4
              </span>
              <h3 className="text-slate-900 font-semibold text-xs">
                Transporte (Canales, Puertos y Confiabilidad)
              </h3>
            </div>
            <span className="text-slate-500 text-xs font-medium">
              {isArpPacket ? 'Sin Transporte (ARP)' : l4?.protocol}
            </span>
          </div>

          {!hasTransportPorts ? (
            <div
              data-testid="unified-layer4-no-ports"
              className="my-2 bg-slate-50 rounded-lg p-3 border border-slate-200 text-xs text-slate-700 space-y-1.5"
            >
              <div className="font-medium text-slate-800">
                Este protocolo opera a nivel de control de red local; no utiliza puertos ni sockets
                de transporte.
              </div>
              {l4 && l4.protocol === 'ICMP' && (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="font-mono text-xs text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/60">
                    Control: {l4.flags || 'ICMP Echo'}
                  </span>
                  <span className="font-mono text-xs text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/60">
                    Checksum: {l4.checksum || 'Verificado'}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 my-2">
              <div className="bg-slate-50 rounded-lg p-2 border border-slate-200/70">
                <div className="text-slate-500 text-xs font-medium mb-1">
                  Puerto Origen → Destino
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  <span className="font-mono text-xs text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/60">
                    {l4?.src_port}
                  </span>
                  <span className="text-slate-400 text-xs">→</span>
                  <span className="font-mono text-xs text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/60">
                    {l4?.dst_port}
                  </span>
                </div>
              </div>

              <div className="bg-slate-50 rounded-lg p-2 border border-slate-200/70">
                <div className="text-slate-500 text-xs font-medium mb-1">Banderas (Flags)</div>
                <span className="font-mono text-xs text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/60">
                  {l4?.flags ?? 'Sin estado (UDP)'}
                </span>
              </div>

              <div className="bg-slate-50 rounded-lg p-2 border border-slate-200/70">
                <div className="text-slate-500 text-xs font-medium mb-1">Checksum</div>
                <span className="font-mono text-xs text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/60">
                  {l4?.checksum ?? 'Verificado'}
                </span>
              </div>
            </div>
          )}

          <p
            data-testid="unified-pedagogy-note-4"
            className="text-slate-600 text-xs bg-blue-50/50 border border-blue-100 rounded-lg px-2.5 py-1.5 leading-relaxed"
          >
            Segmenta el flujo de datos y utiliza puertos para entregar la información a la
            aplicación correcta dentro del computador (ej. Puerto 80/443 para navegación web).
          </p>
        </article>

        {/* 4. CAPA 7 · APLICACIÓN Y DATOS (PAYLOAD) */}
        <article
          data-testid="unified-layer-card-7"
          className="rounded-xl border border-purple-200 bg-white p-3.5 shadow-2xs"
        >
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                Capa 7
              </span>
              <h3 className="text-slate-900 font-semibold text-xs">
                Aplicación y Datos (Payload)
              </h3>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-xs text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/60">
                Servicio: {l7.protocol_hint}
              </span>
              <span className="font-mono text-xs text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/60">
                {l7.payload_size} bytes
              </span>
            </div>
          </div>

          <p
            data-testid="unified-pedagogy-note-7"
            className="text-slate-600 text-xs bg-purple-50/50 border border-purple-100 rounded-lg px-2.5 py-1.5 leading-relaxed mb-2.5"
          >
            Representa el contenido real del protocolo de aplicación (peticiones HTTP, consultas
            DNS o datos cifrados) que recibe o envía directamente el software del usuario.
          </p>

          {/* Acordeón Desplegable de Datos Crudos (Colapsado por defecto) */}
          {l7.payload_size === 0 ? (
            <div
              data-testid="unified-empty-payload-notice"
              className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-600"
            >
              Paquete de control y señalización: no contiene datos de usuario en Capa 7
            </div>
          ) : (
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setIsRawPayloadExpanded((prev) => !prev)}
                aria-expanded={isRawPayloadExpanded}
                data-testid="unified-raw-payload-toggle"
                className="w-full bg-slate-50 hover:bg-slate-100/80 px-3 py-2 flex items-center justify-between text-xs font-medium text-slate-700 transition-colors"
              >
                <span>Ver datos crudos (Hexadecimal / ASCII)</span>
                <span className="font-mono text-slate-500">
                  {isRawPayloadExpanded ? '▲ Ocultar' : '▼ Expandir'}
                </span>
              </button>

              {isRawPayloadExpanded && (
                <div
                  data-testid="unified-raw-payload-content"
                  className="p-3 bg-white border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-2.5"
                >
                  <div>
                    <div className="text-slate-500 text-xs font-medium mb-1">
                      Hexadecimal
                    </div>
                    <div
                      data-testid="unified-hex-dump"
                      className="font-mono text-xs text-slate-800 bg-slate-100/80 p-3 rounded-lg border border-slate-200 break-words leading-relaxed"
                    >
                      {l7.hex_dump}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500 text-xs font-medium mb-1">
                      ASCII Imprimible
                    </div>
                    <div
                      data-testid="unified-ascii-preview"
                      className="font-mono text-xs text-slate-800 bg-slate-100/80 p-3 rounded-lg border border-slate-200 break-all leading-relaxed"
                    >
                      {l7.ascii_preview}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </article>
      </div>
    </aside>
  );
};

export default OsiInspectorPanel;

