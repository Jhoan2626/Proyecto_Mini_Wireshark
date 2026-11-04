import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  CapturedPacket,
  CaptureMode,
  PacketProtocol,
} from '../tests/Spec01CaptureTest';
import CaptureControlBar from './CaptureControlBar';
import TrafficFilterBar from './TrafficFilterBar';

/**
 * Contrato oficial de propiedades según Sección 4 de /specs/03-tabla-trafico-tiempo-real.md
 */
export interface TrafficTableProps {
  packets: CapturedPacket[];
  selectedPacketId: number | null;
  onSelectPacket: (packet: CapturedPacket) => void;
  isCapturing?: boolean;
  captureMode?: CaptureMode;
  onStartCapture?: (mode: CaptureMode) => void;
  onStopCapture?: () => void;
  onClearPackets?: () => void;
  // Propiedades opcionales para sincronización con arneses de prueba o contenedores externos
  selectedProtocol?: 'ALL' | PacketProtocol;
  onProtocolChange?: (protocol: 'ALL' | PacketProtocol) => void;
  searchQuery?: string;
  onSearchQueryChange?: (query: string) => void;
  onCaptureModeChange?: (mode: CaptureMode) => void;
  showControlBar?: boolean;
  showFilterBar?: boolean;
  initialAutoScroll?: boolean;
}

/**
 * Codificación cromática por protocolo según Sección 3.1 de /specs/03-tabla-trafico-tiempo-real.md
 */
export function getProtocolBadgeClasses(protocol: PacketProtocol): string {
  switch (protocol) {
    case 'TCP':
      return 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30';
    case 'UDP':
    case 'DNS':
      return 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30';
    case 'HTTP':
    case 'HTTPS':
      return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
    case 'ICMP':
      return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
    case 'ARP':
      return 'bg-purple-500/15 text-purple-300 border-purple-500/30';
    default:
      return 'bg-slate-700/40 text-slate-300 border-slate-600/40';
  }
}

/**
 * Formatea el tiempo relativo en segundos con milisegundos o extrae HH:mm:ss.SSS del timestamp ISO.
 */
export function formatPacketTime(packet: CapturedPacket): string {
  if (typeof packet.relative_time === 'number' && !Number.isNaN(packet.relative_time)) {
    return `${packet.relative_time.toFixed(3)}s`;
  }
  if (packet.timestamp) {
    const timePart = packet.timestamp.split('T')[1];
    if (timePart) {
      return timePart.replace('Z', '').slice(0, 12);
    }
    return packet.timestamp;
  }
  return '0.000s';
}

/**
 * Función pura de filtrado en tiempo real por protocolo y dirección IP / texto libre.
 */
export function filterPackets(
  packets: CapturedPacket[],
  selectedProtocol: 'ALL' | PacketProtocol,
  searchQuery: string
): CapturedPacket[] {
  const normalizedQuery = searchQuery.trim().toLowerCase();

  return packets.filter((pkt) => {
    const matchesProtocol =
      selectedProtocol === 'ALL' || pkt.summary.protocol === selectedProtocol;

    const matchesQuery =
      normalizedQuery === '' ||
      pkt.summary.src_ip.toLowerCase().includes(normalizedQuery) ||
      pkt.summary.dst_ip.toLowerCase().includes(normalizedQuery) ||
      pkt.summary.info.toLowerCase().includes(normalizedQuery);

    return matchesProtocol && matchesQuery;
  });
}

export const TrafficPacketTable: React.FC<TrafficTableProps> = ({
  packets,
  selectedPacketId,
  onSelectPacket,
  isCapturing = false,
  captureMode: controlledMode,
  onStartCapture,
  onStopCapture,
  onClearPackets,
  selectedProtocol: controlledProtocol,
  onProtocolChange,
  searchQuery: controlledQuery,
  onSearchQueryChange,
  onCaptureModeChange,
  showControlBar = true,
  showFilterBar = true,
  initialAutoScroll = false,
}) => {
  const [internalProtocol, setInternalProtocol] = useState<'ALL' | PacketProtocol>('ALL');
  const [internalQuery, setInternalQuery] = useState<string>('');
  const [internalMode, setInternalMode] = useState<CaptureMode>(controlledMode ?? 'mock');
  const [autoScroll, setAutoScroll] = useState<boolean>(initialAutoScroll);

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const activeProtocol = controlledProtocol !== undefined ? controlledProtocol : internalProtocol;
  const activeQuery = controlledQuery !== undefined ? controlledQuery : internalQuery;
  const activeMode = controlledMode !== undefined ? controlledMode : internalMode;

  const handleProtocolSelect = (proto: 'ALL' | PacketProtocol) => {
    if (controlledProtocol === undefined) {
      setInternalProtocol(proto);
    }
    onProtocolChange?.(proto);
  };

  const handleQueryChange = (query: string) => {
    if (controlledQuery === undefined) {
      setInternalQuery(query);
    }
    onSearchQueryChange?.(query);
  };

  const handleResetFilters = () => {
    handleProtocolSelect('ALL');
    handleQueryChange('');
  };

  const handleModeChange = (mode: CaptureMode) => {
    if (controlledMode === undefined) {
      setInternalMode(mode);
    }
    onCaptureModeChange?.(mode);
  };

  const filteredPackets = useMemo(
    () => filterPackets(packets, activeProtocol, activeQuery),
    [packets, activeProtocol, activeQuery]
  );

  // Auto-scroll inteligente cuando ingresan nuevos paquetes y autoScroll está activo
  useEffect(() => {
    if (autoScroll && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [filteredPackets.length, autoScroll]);

  return (
    <div className="space-y-3">
      {showControlBar && (
        <CaptureControlBar
          isCapturing={isCapturing}
          captureMode={activeMode}
          onModeChange={handleModeChange}
          onStartCapture={(mode) => onStartCapture?.(mode)}
          onStopCapture={() => onStopCapture?.()}
          onClearPackets={() => onClearPackets?.()}
          totalPackets={packets.length}
          visiblePackets={filteredPackets.length}
          autoScroll={autoScroll}
          onToggleAutoScroll={() => setAutoScroll((prev) => !prev)}
        />
      )}

      {showFilterBar && (
        <TrafficFilterBar
          selectedProtocol={activeProtocol}
          onSelectProtocol={handleProtocolSelect}
          searchQuery={activeQuery}
          onSearchQueryChange={handleQueryChange}
          onResetFilters={handleResetFilters}
          visibleCount={filteredPackets.length}
          totalCount={packets.length}
        />
      )}

      {/* Contenedor accesible con encabezados fijos (sticky) para tabla de alta densidad */}
      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/90 shadow-lg">
        <div
          ref={scrollContainerRef}
          tabIndex={0}
          role="region"
          aria-label="Tabla de paquetes capturados en tiempo real"
          className="max-h-96 overflow-auto focus:outline-none focus:ring-1 focus:ring-blue-500/50"
        >
          <table className="w-full border-separate border-spacing-0 text-left">
            <thead className="sticky top-0 z-10 bg-slate-950 text-[11px] font-bold tracking-wider text-slate-400 uppercase">
              <tr>
                <th scope="col" className="border-b border-slate-800 py-2.5 px-3">
                  No.
                </th>
                <th scope="col" className="border-b border-slate-800 py-2.5 px-3">
                  Tiempo
                </th>
                <th scope="col" className="border-b border-slate-800 py-2.5 px-3">
                  IP Origen
                </th>
                <th scope="col" className="border-b border-slate-800 py-2.5 px-3">
                  IP Destino
                </th>
                <th scope="col" className="border-b border-slate-800 py-2.5 px-3">
                  Protocolo
                </th>
                <th scope="col" className="border-b border-slate-800 py-2.5 px-3">
                  Longitud
                </th>
                <th scope="col" className="border-b border-slate-800 py-2.5 px-3">
                  Info
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70 font-mono text-xs">
              {filteredPackets.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    {packets.length === 0
                      ? 'No hay paquetes capturados en la sesión actual. Inicia la captura para visualizar tráfico.'
                      : `Ningún paquete coincide con el filtro actual (${activeProtocol} / "${activeQuery}").`}
                  </td>
                </tr>
              ) : (
                filteredPackets.map((pkt) => {
                  const isSelected = selectedPacketId === pkt.id;
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
                      data-testid={`packet-row-${pkt.id}`}
                      className={`cursor-pointer transition ${
                        isSelected
                          ? 'bg-blue-600/20 text-white ring-1 ring-inset ring-blue-500'
                          : 'text-slate-300 hover:bg-slate-800/60'
                      }`}
                    >
                      <td
                        className={`py-2 px-3 font-mono font-bold ${
                          isSelected
                            ? 'border-l-2 border-l-blue-400 text-blue-300'
                            : 'text-slate-400'
                        }`}
                      >
                        {pkt.id}
                      </td>
                      <td className="py-2 px-3 font-mono text-slate-400">
                        {formatPacketTime(pkt)}
                      </td>
                      <td className="py-2 px-3 font-mono">{pkt.summary.src_ip}</td>
                      <td className="py-2 px-3 font-mono">{pkt.summary.dst_ip}</td>
                      <td className="py-2 px-3">
                        <span
                          className={`inline-block rounded border px-2 py-0.5 font-mono text-[10px] font-bold ${getProtocolBadgeClasses(
                            pkt.summary.protocol
                          )}`}
                        >
                          {pkt.summary.protocol}
                        </span>
                      </td>
                      <td className="py-2 px-3 font-mono text-slate-400">
                        {pkt.summary.length} B
                      </td>
                      <td
                        className="max-w-xs truncate py-2 px-3 font-mono text-ellipsis text-slate-300"
                        title={pkt.summary.info}
                      >
                        {pkt.summary.info}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default TrafficPacketTable;

