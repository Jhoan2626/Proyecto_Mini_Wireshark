import React from 'react';
import { CaptureMode } from '../tests/Spec01CaptureTest';

export interface CaptureControlBarProps {
  isCapturing: boolean;
  captureMode: CaptureMode;
  onModeChange: (mode: CaptureMode) => void;
  onStartCapture: (mode: CaptureMode) => void;
  onStopCapture: () => void;
  onClearPackets: () => void;
  totalPackets: number;
  visiblePackets: number;
  autoScroll?: boolean;
  onToggleAutoScroll?: () => void;
  apiBaseUrl?: string;
}

export const CaptureControlBar: React.FC<CaptureControlBarProps> = ({
  isCapturing,
  captureMode,
  onModeChange,
  onStartCapture,
  onStopCapture,
  onClearPackets,
  totalPackets,
  visiblePackets,
  autoScroll = true,
  onToggleAutoScroll,
  apiBaseUrl = '',
}) => {
  const triggerApiEndpoint = (path: string, body?: Record<string, unknown>) => {
    if (typeof fetch !== 'function') return;
    try {
      Promise.resolve(
        fetch(`${apiBaseUrl}${path}`, {
          method: 'POST',
          headers: body ? { 'Content-Type': 'application/json' } : undefined,
          body: body ? JSON.stringify(body) : undefined,
        })
      ).catch(() => {
        // Silencia errores de red cuando se ejecuta en entorno de pruebas aislado sin servidor Flask activo
      });
    } catch {
      // Ignorar errores síncronos en entornos de prueba sin red
    }
  };

  const handleStart = () => {
    if (isCapturing) return;
    triggerApiEndpoint('/api/capture/start', { mode: captureMode });
    onStartCapture(captureMode);
  };

  const handleStop = () => {
    if (!isCapturing) return;
    triggerApiEndpoint('/api/capture/stop');
    onStopCapture();
  };

  const handleClear = () => {
    triggerApiEndpoint('/api/capture/clear');
    onClearPackets();
  };

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/95 px-4 py-3 shadow-md"
      role="toolbar"
      aria-label="Barra de control de captura de tráfico"
    >
      {/* Bloque Izquierdo: Indicador de Estado en Vivo + Selector de Modo */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Indicador de Estado en Vivo */}
        <div
          data-testid="capture-status-badge"
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold tracking-wider uppercase transition ${
            isCapturing
              ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
              : 'border-amber-500/30 bg-slate-800/90 text-amber-300'
          }`}
        >
          <span className="relative flex h-2.5 w-2.5">
            {isCapturing && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            )}
            <span
              className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
                isCapturing ? 'bg-emerald-400' : 'bg-amber-400'
              }`}
            />
          </span>
          <span>{isCapturing ? 'CAPTURANDO' : 'DETENIDO / EN PAUSA'}</span>
        </div>

        {/* Selector de Modo (Segmented Toggle: Real vs Mock) */}
        <div
          className="inline-flex items-center rounded-lg border border-slate-800 bg-slate-950 p-0.5"
          role="group"
          aria-label="Selector de modo de captura"
        >
          <button
            type="button"
            onClick={() => onModeChange('mock')}
            aria-pressed={captureMode === 'mock'}
            className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
              captureMode === 'mock'
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Modo Mock
          </button>
          <button
            type="button"
            onClick={() => onModeChange('real')}
            aria-pressed={captureMode === 'real'}
            className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
              captureMode === 'real'
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Modo Real
          </button>
        </div>
      </div>

      {/* Bloque Central: Botones Operativos (Start, Stop, Clear, Auto-Scroll) */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleStart}
          disabled={isCapturing}
          aria-label="Iniciar Captura"
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span>▶</span>
          <span>Iniciar Captura</span>
        </button>

        <button
          type="button"
          onClick={handleStop}
          disabled={!isCapturing}
          aria-label="Detener Captura"
          className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span>⏸</span>
          <span>Detener</span>
        </button>

        <button
          type="button"
          onClick={handleClear}
          aria-label="Limpiar Paquetes"
          className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-950/60 px-3.5 py-1.5 text-xs font-semibold text-rose-300 transition hover:bg-rose-900/60"
        >
          <span>🗑</span>
          <span>Limpiar</span>
        </button>

        {onToggleAutoScroll && (
          <button
            type="button"
            onClick={onToggleAutoScroll}
            aria-pressed={autoScroll}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
              autoScroll
                ? 'border-blue-500/40 bg-blue-500/15 text-blue-300'
                : 'border-slate-700 bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>⬇</span>
            <span>Auto-Scroll: {autoScroll ? 'ON' : 'OFF'}</span>
          </button>
        )}
      </div>

      {/* Bloque Derecho: Contadores de Sesión */}
      <div className="flex items-center gap-2 font-mono text-xs">
        <div
          className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 text-slate-300"
          data-testid="session-packet-counters"
        >
          <span className="text-slate-500">Visibles: </span>
          <span className="font-bold text-blue-400" data-testid="visible-packets-count">
            {visiblePackets}
          </span>
          <span className="mx-1.5 text-slate-600">/</span>
          <span className="text-slate-500">Total: </span>
          <span className="font-bold text-emerald-400" data-testid="total-packets-count">
            {totalPackets}
          </span>
        </div>
      </div>
    </div>
  );
};

export default CaptureControlBar;
