import React from 'react';
import { CaptureMode, NetworkInterfaceItem, PacketProtocol } from '../tests/Spec01CaptureTest';

export type QuickProtocolFilter = 'ALL' | PacketProtocol;

export interface QuickFilterChip {
  id: QuickProtocolFilter;
  label: string;
}

export const QUICK_PROTOCOL_CHIPS: QuickFilterChip[] = [
  { id: 'ALL', label: 'Todos' },
  { id: 'HTTP', label: 'Web (HTTP)' },
  { id: 'TCP', label: 'TCP' },
  { id: 'UDP', label: 'UDP' },
  { id: 'DNS', label: 'DNS' },
  { id: 'ICMP', label: 'Ping (ICMP)' },
  { id: 'ARP', label: 'Red Local (ARP)' },
];

export const QUICK_PORT_FILTERS = ['8000', '80', '443', '8080'];

export interface AppHeaderProps {
  isCapturing: boolean;
  captureMode: CaptureMode;
  onModeChange: (mode: CaptureMode) => void;
  onStartCapture: () => void;
  onPauseCapture: () => void;
  onClearPackets: () => void;
  selectedProtocol: QuickProtocolFilter;
  onSelectProtocol: (protocol: QuickProtocolFilter) => void;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  interfaces?: NetworkInterfaceItem[];
  selectedInterface?: string;
  onSelectInterface?: (ifaceId: string) => void;
  onOpenQaLab?: () => void;
  isQaLabOpen?: boolean;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  isCapturing,
  captureMode,
  onModeChange,
  onStartCapture,
  onPauseCapture,
  onClearPackets,
  selectedProtocol,
  onSelectProtocol,
  searchQuery,
  onSearchQueryChange,
  interfaces = [],
  selectedInterface = '',
  onSelectInterface,
  onOpenQaLab,
  isQaLabOpen = false,
}) => {
  return (
    <header
      data-testid="app-header"
      className="bg-white border-b border-slate-200 shrink-0 shadow-xs"
    >
      {/* Fila Principal: Identidad de Marca, Estado en Vivo, Controles Operativos y Laboratorio QA */}
      <div className="h-16 px-6 flex items-center justify-between gap-4">
        {/* Identidad de Marca + Estado de Captura en Vivo */}
        <div className="flex items-center gap-4 min-w-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shrink-0">
              <svg
                className="w-5 h-5 text-blue-600"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M2 12h4l3-9 6 18 3-9h4" />
              </svg>
            </div>
            <div className="flex items-baseline">
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">
                Mini-Wireshark
              </h1>
              <span className="text-xs text-slate-500 hidden md:inline ml-2 pl-2 border-l border-slate-200">
                Analizador Visual del Modelo OSI
              </span>
            </div>
          </div>

          {/* Píldora de Estado de Captura en Vivo */}
          <div
            data-testid="unified-capture-status"
            className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              isCapturing
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-slate-100 text-slate-600 border-slate-200'
            }`}
          >
            <span className="relative flex h-2 w-2">
              {isCapturing && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
              )}
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  isCapturing ? 'bg-emerald-500' : 'bg-slate-400'
                }`}
              />
            </span>
            <span>{isCapturing ? 'Capturando en vivo' : 'Captura en pausa'}</span>
          </div>
        </div>

        {/* Controles Operativos de Captura y Acceso QA */}
        <div className="flex items-center gap-2.5">
          {/* Selector de Origen Segmentado */}
          <div
            className="bg-slate-100 p-0.5 rounded-lg border border-slate-200 inline-flex items-center"
            role="group"
            aria-label="Selector de origen de tráfico"
          >
            <button
              type="button"
              onClick={() => onModeChange('real')}
              aria-pressed={captureMode === 'real'}
              data-testid="mode-real-btn"
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                captureMode === 'real'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Red Local (Scapy)
            </button>
            <button
              type="button"
              onClick={() => onModeChange('mock')}
              aria-pressed={captureMode === 'mock'}
              data-testid="mode-mock-btn"
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                captureMode === 'mock'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tráfico Simulado
            </button>
          </div>

          {/* Selector de Interfaz de Red Real (visible cuando está activo "Red Local (Scapy)") */}
          {captureMode === 'real' && (
            <div className="flex items-center gap-1.5">
              <select
                aria-label="Seleccionar interfaz de red real"
                data-testid="network-interface-select"
                value={selectedInterface}
                onChange={(e) => onSelectInterface?.(e.target.value)}
                className="bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 focus:border-blue-500 focus:outline-none rounded-lg text-xs font-medium text-slate-700 px-2.5 py-1.5 max-w-64 truncate transition-colors"
              >
                {interfaces.length === 0 ? (
                  <option value="">Interfaz Activa (Auto-detectar Wi-Fi / Ethernet)</option>
                ) : (
                  interfaces.map((iface) => (
                    <option key={iface.id} value={iface.id}>
                      {iface.label}
                    </option>
                  ))
                )}
              </select>
            </div>
          )}

          {/* Botón Primario de Acción (Iniciar / Pausar) */}
          {!isCapturing ? (
            <button
              type="button"
              onClick={onStartCapture}
              data-testid="unified-start-capture-btn"
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg text-sm shadow-xs transition-colors inline-flex items-center gap-1.5"
            >
              <svg
                className="w-3.5 h-3.5 fill-current"
                viewBox="0 0 20 20"
                aria-hidden="true"
              >
                <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
              </svg>
              <span>Iniciar captura</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onPauseCapture}
              data-testid="unified-pause-capture-btn"
              className="bg-amber-600 hover:bg-amber-700 text-white font-medium px-4 py-2 rounded-lg text-sm shadow-xs transition-colors inline-flex items-center gap-1.5"
            >
              <svg
                className="w-3.5 h-3.5 fill-current"
                viewBox="0 0 20 20"
                aria-hidden="true"
              >
                <path d="M5.75 3a.75.75 0 00-.75.75v12.5c0 .414.336.75.75.75h1.5a.75.75 0 00.75-.75V3.75A.75.75 0 007.25 3h-1.5zM12.75 3a.75.75 0 00-.75.75v12.5c0 .414.336.75.75.75h1.5a.75.75 0 00.75-.75V3.75a.75.75 0 00-.75-.75h-1.5z" />
              </svg>
              <span>Pausar captura</span>
            </button>
          )}

          {/* Botón Secundario: Limpiar */}
          <button
            type="button"
            onClick={onClearPackets}
            data-testid="unified-clear-packets-btn"
            className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-medium px-3 py-2 rounded-lg text-sm transition-colors"
          >
            Limpiar
          </button>

          {/* Separador vertical */}
          {onOpenQaLab && (
            <>
              <div className="h-6 w-px bg-slate-200 mx-0.5" aria-hidden="true" />
              <button
                type="button"
                onClick={onOpenQaLab}
                data-testid="qa-lab-toggle-btn"
                aria-pressed={isQaLabOpen}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition-colors"
              >
                <svg
                  className="w-4 h-4 text-slate-500"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M10 2v7.31" />
                  <path d="M14 9.3V1.99" />
                  <path d="M8.5 2h7" />
                  <path d="M14 9.3a6.5 6.5 0 1 1-4 0" />
                  <path d="M5.52 16h12.96" />
                </svg>
                <span>Laboratorio QA</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Subheader Integrado: Barra de Filtrado Intuitiva por Protocolo, Puertos y Buscador de Payload */}
      <div className="bg-slate-50/80 border-t border-slate-200 px-6 py-2 flex flex-wrap items-center justify-between gap-3">
        {/* Píldoras de Filtro Rápido por Protocolo y Puertos Frecuentes */}
        <div className="flex flex-wrap items-center gap-3">
          <div
            className="flex flex-wrap items-center gap-1.5"
            role="group"
            aria-label="Filtros rápidos por protocolo"
          >
            <span className="text-slate-500 text-xs font-medium mr-1">
              Protocolos:
            </span>
            {QUICK_PROTOCOL_CHIPS.map((chip) => {
              const isActive = selectedProtocol === chip.id;
              return (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => onSelectProtocol(chip.id)}
                  aria-pressed={isActive}
                  data-testid={`unified-filter-chip-${chip.id}`}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                    isActive
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>

          <div
            className="hidden xl:flex items-center gap-1 pl-3 border-l border-slate-200"
            role="group"
            aria-label="Filtros rápidos por puerto"
          >
            <span className="text-slate-500 text-xs font-medium mr-0.5">
              Puerto:
            </span>
            {QUICK_PORT_FILTERS.map((port) => {
              const isPortActive = searchQuery.trim() === port || searchQuery.trim() === `:${port}`;
              return (
                <button
                  key={port}
                  type="button"
                  onClick={() => onSearchQueryChange(isPortActive ? '' : port)}
                  data-testid={`quick-port-chip-${port}`}
                  className={`px-2 py-0.5 rounded-md font-mono text-xs border transition-colors ${
                    isPortActive
                      ? 'bg-blue-50 text-blue-700 border-blue-300 font-semibold'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  :{port}
                </button>
              );
            })}
          </div>
        </div>

        {/* Buscador Universal en Tiempo Real (IP, Puerto, Nombre de Documento o Contenido de Payload) */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <svg
              className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              placeholder="Buscar por IP, puerto (8000) o texto en payload..."
              aria-label="Buscar por IP, puerto, protocolo o texto en payload"
              data-testid="unified-search-input"
              className="bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 focus:outline-none rounded-lg text-xs text-slate-800 placeholder:text-slate-400 pl-8 pr-3 py-1.5 w-72 transition-colors"
            />
          </div>
          {(selectedProtocol !== 'ALL' || searchQuery.trim() !== '') && (
            <button
              type="button"
              onClick={() => {
                onSelectProtocol('ALL');
                onSearchQueryChange('');
              }}
              data-testid="unified-clear-filters-btn"
              className="text-xs font-medium text-slate-500 hover:text-slate-800 px-2 py-1 rounded hover:bg-slate-200/60 transition-colors"
            >
              Restablecer filtro
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

export default AppHeader;
