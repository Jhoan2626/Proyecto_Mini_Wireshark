import React, { useRef, useEffect } from 'react';
import { CapturedPacket, PacketProtocol } from '../tests/Spec01CaptureTest';
import { QuickProtocolFilter } from './AppHeader';
import { formatPacketTime } from './TrafficPacketTable';

/**
 * Semántica de colores pastel para protocolos según Sección 2.3 de /specs/05-rediseño-frontend-claro-unificado.md
 */
export function getLightProtocolBadgeClasses(protocol: PacketProtocol | string): string {
  switch (protocol) {
    case 'HTTP':
    case 'HTTPS':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'TCP':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'UDP':
      return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    case 'DNS':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'ICMP':
      return 'bg-rose-50 text-rose-700 border-rose-200';
    case 'ARP':
      return 'bg-cyan-50 text-cyan-700 border-cyan-200';
    default:
      return 'bg-slate-100 text-slate-600 border-slate-200';
  }
}

/**
 * Traducción pedagógica obligatoria de cada paquete a lenguaje claro en español (Sección 4.2)
 */
export function translatePacketActivity(packet: CapturedPacket): string {
  const proto = packet.summary.protocol;
  const info = packet.summary.info || '';
  const l3 = packet.osi_layers.layer3_network;
  const l4 = packet.osi_layers.layer4_transport;
  const l7 = packet.osi_layers.layer7_application;

  switch (proto) {
    case 'DNS': {
      const domainMatch = info.match(/([a-zA-Z0-9-]+\.[a-zA-Z0-9.-]+)/);
      const domain = domainMatch ? domainMatch[1] : 'google.com';
      if (info.toLowerCase().includes('response')) {
        return `Respuesta de nombre de dominio (DNS: ${domain})`;
      }
      return `Consulta de nombre de dominio (DNS: ${domain})`;
    }
    case 'HTTP':
    case 'HTTPS': {
      const methodMatch =
        l7?.ascii_preview?.match(/(GET|POST|PUT|DELETE|HEAD)\s+([^\s]+)/) ||
        info.match(/(GET|POST|PUT|DELETE|HEAD)\s+([^\s]+)/);
      if (methodMatch) {
        return `Petición de página web (${methodMatch[1]} ${methodMatch[2]})`;
      }
      if (proto === 'HTTPS') {
        return 'Comunicación web cifrada segura (HTTPS / TLS)';
      }
      return 'Petición de página web (HTTP)';
    }
    case 'TCP': {
      const flags = l4?.flags || 'SYN/ACK';
      return `Conexión Web Segura / Establecimiento de Canal (${flags})`;
    }
    case 'ICMP': {
      if (info.toLowerCase().includes('reply')) {
        return 'Respuesta de diagnóstico de conectividad (Echo Reply / Ping)';
      }
      return 'Comprobación de conectividad (Echo Request / Ping)';
    }
    case 'ARP': {
      return `¿Quién tiene ${l3?.dst_ip || packet.summary.dst_ip}? Responder a ${
        l3?.src_ip || packet.summary.src_ip
      }`;
    }
    case 'UDP': {
      if (info.toUpperCase().includes('DNS') || l4?.src_port === 53 || l4?.dst_port === 53) {
        return 'Transmisión de datagrama de resolución o datos rápidos (UDP/DNS)';
      }
      return 'Transmisión de datagrama de audio/video o datos rápidos';
    }
    default:
      return info || 'Transmisión de trama de red local';
  }
}

/**
 * Formatea IP con puerto opcional para las píldoras monoespaciadas de Origen y Destino
 */
export function formatEndpointAddress(
  ip: string,
  port: number | null | undefined
): string {
  if (typeof port === 'number' && port > 0) {
    return `${ip}:${port}`;
  }
  return ip;
}

/**
 * Filtrado universal en tiempo real por protocolo rápido y buscador (IP, puerto, protocolo o actividad)
 */
export function filterUnifiedPackets(
  packets: CapturedPacket[],
  selectedProtocol: QuickProtocolFilter,
  searchQuery: string
): CapturedPacket[] {
  const q = searchQuery.trim().toLowerCase();

  return packets.filter((pkt) => {
    const matchesProtocol =
      selectedProtocol === 'ALL' ||
      pkt.summary.protocol === selectedProtocol ||
      (selectedProtocol === 'HTTP' &&
        (pkt.summary.protocol === 'HTTP' || pkt.summary.protocol === 'HTTPS'));

    if (!matchesProtocol) return false;
    if (q === '') return true;

    const l4 = pkt.osi_layers.layer4_transport;
    const srcEndpoint = formatEndpointAddress(pkt.summary.src_ip, l4?.src_port).toLowerCase();
    const dstEndpoint = formatEndpointAddress(pkt.summary.dst_ip, l4?.dst_port).toLowerCase();
    const activity = translatePacketActivity(pkt).toLowerCase();

    return (
      srcEndpoint.includes(q) ||
      dstEndpoint.includes(q) ||
      pkt.summary.protocol.toLowerCase().includes(q) ||
      pkt.summary.info.toLowerCase().includes(q) ||
      activity.includes(q)
    );
  });
}

export interface LiveTrafficPanelProps {
  packets: CapturedPacket[];
  totalPacketsCount: number;
  selectedPacketId: number | null;
  onSelectPacket: (packet: CapturedPacket) => void;
  autoScroll: boolean;
  onToggleAutoScroll: () => void;
}

export const LiveTrafficPanel: React.FC<LiveTrafficPanelProps> = ({
  packets,
  totalPacketsCount,
  selectedPacketId,
  onSelectPacket,
  autoScroll,
  onToggleAutoScroll,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (autoScroll && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [packets.length, autoScroll]);

  return (
    <section
      data-testid="live-traffic-panel"
      aria-label="Tabla de tráfico de red en vivo"
      className="flex-1 flex flex-col bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden m-3 mr-1.5 min-w-0"
    >
      {/* Barra de Estado del Panel */}
      <div className="bg-slate-50/80 border-b border-slate-200 px-4 py-2.5 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-slate-900 font-semibold tracking-tight text-sm">
            Tráfico de Red en Vivo
          </h2>
          <span
            data-testid="unified-packet-counter"
            className="text-slate-500 text-xs font-medium pl-2 border-l border-slate-200"
          >
            Mostrando <strong className="text-slate-800">{packets.length}</strong> de{' '}
            <strong className="text-slate-800">{totalPacketsCount}</strong> paquetes capturados
          </span>
        </div>

        <button
          type="button"
          onClick={onToggleAutoScroll}
          aria-pressed={autoScroll}
          data-testid="unified-autoscroll-toggle"
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
            autoScroll
              ? 'bg-blue-50 text-blue-700 border-blue-200'
              : 'bg-white text-slate-500 border-slate-200 hover:text-slate-800'
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              autoScroll ? 'bg-blue-600' : 'bg-slate-300'
            }`}
          />
          <span>
            {autoScroll ? 'Auto-desplazamiento activado' : 'Auto-desplazamiento en pausa'}
          </span>
        </button>
      </div>

      {/* Tabla Scrollable con Encabezados Fijos (Sticky) y Contenedor Accesible */}
      <div
        ref={scrollContainerRef}
        tabIndex={0}
        role="region"
        aria-label="Lista interactiva de paquetes capturados"
        style={{ containerType: 'inline-size' }}
        className="flex-1 overflow-auto focus:outline-none"
      >
        <table className="w-full border-separate border-spacing-0 text-left">
          <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur-xs border-b border-slate-200">
            <tr>
              <th
                scope="col"
                className="w-12 py-2.5 px-3 text-slate-500 text-xs font-medium border-b border-slate-200"
              >
                #
              </th>
              <th
                scope="col"
                className="w-24 py-2.5 px-3 text-slate-500 text-xs font-medium border-b border-slate-200"
              >
                Hora / Delta
              </th>
              <th
                scope="col"
                className="py-2.5 px-3 text-slate-500 text-xs font-medium border-b border-slate-200"
              >
                Origen
              </th>
              <th
                scope="col"
                className="py-2.5 px-3 text-slate-500 text-xs font-medium border-b border-slate-200"
              >
                Destino
              </th>
              <th
                scope="col"
                className="w-24 py-2.5 px-3 text-slate-500 text-xs font-medium border-b border-slate-200"
              >
                Protocolo
              </th>
              <th
                scope="col"
                className="py-2.5 px-3 text-slate-500 text-xs font-medium border-b border-slate-200"
              >
                Actividad en la Red
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100 text-slate-800 text-sm font-normal">
            {packets.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 px-6 text-center text-slate-500 text-sm">
                  {totalPacketsCount === 0
                    ? 'Aún no hay paquetes en la sesión. Haz clic en "Iniciar captura" para analizar el tráfico en vivo.'
                    : 'Ningún paquete coincide con el filtro o término de búsqueda actual.'}
                </td>
              </tr>
            ) : (
              packets.map((pkt) => {
                const isSelected = selectedPacketId === pkt.id;
                const l4 = pkt.osi_layers.layer4_transport;
                const srcFormatted = formatEndpointAddress(pkt.summary.src_ip, l4?.src_port);
                const dstFormatted = formatEndpointAddress(pkt.summary.dst_ip, l4?.dst_port);
                const activityText = translatePacketActivity(pkt);

                return (
                  <tr
                    key={pkt.id}
                    onClick={() => onSelectPacket(pkt)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelectPacket(pkt);
                      }
                    }}
                    tabIndex={0}
                    aria-selected={isSelected}
                    data-testid={`unified-packet-row-${pkt.id}`}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-blue-50/70 border-l-4 border-blue-600 font-medium'
                        : 'hover:bg-slate-50/80'
                    }`}
                  >
                    <td
                      className={`w-12 py-2.5 px-3 font-mono text-xs ${
                        isSelected
                          ? 'border-l-4 border-blue-600 text-blue-700 font-semibold'
                          : 'text-slate-400'
                      }`}
                    >
                      {pkt.id}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-xs text-slate-500 whitespace-nowrap">
                      +{formatPacketTime(pkt)}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="font-mono text-xs text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/60">
                        {srcFormatted}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="font-mono text-xs text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/60">
                        {dstFormatted}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold border ${getLightProtocolBadgeClasses(
                          pkt.summary.protocol
                        )}`}
                      >
                        {pkt.summary.protocol}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-800 text-xs leading-snug">
                      <div className="font-medium text-slate-800">{activityText}</div>
                      <div className="text-[11px] text-slate-400 font-mono truncate max-w-md">
                        {pkt.summary.info} · {pkt.summary.length} bytes
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default LiveTrafficPanel;

