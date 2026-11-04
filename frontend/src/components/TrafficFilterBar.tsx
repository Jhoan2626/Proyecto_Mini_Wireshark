import React from 'react';
import { PacketProtocol } from '../tests/Spec01CaptureTest';

export const PROTOCOL_FILTER_OPTIONS: Array<'ALL' | PacketProtocol> = [
  'ALL',
  'TCP',
  'UDP',
  'HTTP',
  'HTTPS',
  'DNS',
  'ICMP',
  'ARP',
];

export interface TrafficFilterBarProps {
  selectedProtocol: 'ALL' | PacketProtocol;
  onSelectProtocol: (protocol: 'ALL' | PacketProtocol) => void;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  onResetFilters: () => void;
  visibleCount?: number;
  totalCount?: number;
}

export const TrafficFilterBar: React.FC<TrafficFilterBarProps> = ({
  selectedProtocol,
  onSelectProtocol,
  searchQuery,
  onSearchQueryChange,
  onResetFilters,
}) => {
  const hasActiveFilters = selectedProtocol !== 'ALL' || searchQuery.trim().length > 0;

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/90 px-4 py-2.5"
      role="search"
      aria-label="Barra de filtrado rápido de paquetes"
    >
      {/* Filtro por Protocolo (Píldoras / Botones rápidos) */}
      <div className="flex flex-wrap items-center gap-1 rounded-lg border border-slate-800 bg-slate-950 p-1">
        {PROTOCOL_FILTER_OPTIONS.map((proto) => {
          const isActive = selectedProtocol === proto;
          return (
            <button
              key={proto}
              type="button"
              onClick={() => onSelectProtocol(proto)}
              aria-pressed={isActive}
              className={`rounded px-2.5 py-1 font-mono text-xs font-semibold transition ${
                isActive
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:bg-slate-900 hover:text-white'
              }`}
            >
              {proto}
            </button>
          );
        })}
      </div>

      {/* Buscador por Dirección IP o Info + Botón de Reseteo */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            placeholder="Filtrar IP o Info (ej. 8.8.8.8, ARP)..."
            aria-label="Filtrar por dirección IP o texto de información"
            className="w-64 rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 font-mono text-xs text-slate-200 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
          />
        </div>

        <button
          type="button"
          onClick={onResetFilters}
          disabled={!hasActiveFilters}
          aria-label="Resetear filtros"
          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
            hasActiveFilters
              ? 'border-amber-500/40 bg-amber-500/15 text-amber-300 hover:bg-amber-500/25'
              : 'cursor-not-allowed border-slate-800 bg-slate-950 text-slate-600 opacity-60'
          }`}
        >
          ✕ Limpiar Filtros
        </button>
      </div>
    </div>
  );
};

export default TrafficFilterBar;

