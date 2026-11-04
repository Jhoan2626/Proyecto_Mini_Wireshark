import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { CapturedPacket, CaptureMode } from '../tests/Spec01CaptureTest';
import { INITIAL_STREAM_PACKETS } from '../tests/Spec03TrafficTableTest';
import AppHeader, { QuickProtocolFilter } from './AppHeader';
import LiveTrafficPanel, { filterUnifiedPackets } from './LiveTrafficPanel';
import OsiInspectorPanel from './OsiInspectorPanel';
import TestSuiteRunner from '../tests/TestSuiteRunner';

export interface UnifiedDashboardProps {
  initialPackets?: CapturedPacket[];
  initialSelectedPacketId?: number | null;
  initialCapturing?: boolean;
  initialMode?: CaptureMode;
  apiBaseUrl?: string;
}

export const UnifiedDashboard: React.FC<UnifiedDashboardProps> = ({
  initialPackets = INITIAL_STREAM_PACKETS,
  initialSelectedPacketId = INITIAL_STREAM_PACKETS[0]?.id ?? null,
  initialCapturing = false,
  initialMode = 'mock',
  apiBaseUrl = 'http://127.0.0.1:5000',
}) => {
  const [packets, setPackets] = useState<CapturedPacket[]>(initialPackets);
  const [selectedPacketId, setSelectedPacketId] = useState<number | null>(
    initialSelectedPacketId
  );
  const [isCapturing, setIsCapturing] = useState<boolean>(initialCapturing);
  const [captureMode, setCaptureMode] = useState<CaptureMode>(initialMode);
  const [selectedProtocol, setSelectedProtocol] = useState<QuickProtocolFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [isQaLabOpen, setIsQaLabOpen] = useState<boolean>(false);

  const lastPacketIdRef = useRef<number>(
    initialPackets.length > 0 ? initialPackets[initialPackets.length - 1].id : 0
  );

  const triggerBackendEndpoint = useCallback(
    (path: string, body?: Record<string, unknown>) => {
      if (typeof fetch !== 'function') return;
      try {
        Promise.resolve(
          fetch(`${apiBaseUrl}${path}`, {
            method: 'POST',
            headers: body ? { 'Content-Type': 'application/json' } : undefined,
            body: body ? JSON.stringify(body) : undefined,
          })
        ).catch(() => {
          // Modo autónomo silencioso si el servidor Flask local no está activo
        });
      } catch {
        // Ignorar errores síncronos en entornos de prueba
      }
    },
    [apiBaseUrl]
  );

  const appendSimulatedPacket = useCallback(
    (modeToUse: CaptureMode) => {
      setPackets((prev) => {
        const baseId = prev.length > 0 ? prev[prev.length - 1].id : lastPacketIdRef.current;
        const nextId = baseId + 1;
        lastPacketIdRef.current = nextId;
        const template = INITIAL_STREAM_PACKETS[nextId % INITIAL_STREAM_PACKETS.length];
        const nextPacket: CapturedPacket = {
          ...template,
          id: nextId,
          captured_mode: modeToUse,
          timestamp: new Date().toISOString(),
          relative_time: Number((nextId * 0.24).toFixed(3)),
        };
        return [...prev, nextPacket];
      });
    },
    []
  );

  // Ciclo de captura en tiempo real (consulta API Flask con respaldo automático local)
  useEffect(() => {
    if (!isCapturing) return;

    const interval = setInterval(async () => {
      let fetchedFromApi = false;
      if (typeof fetch === 'function') {
        try {
          const response = await Promise.resolve(
            fetch(`${apiBaseUrl}/api/packets?since_id=${lastPacketIdRef.current}&limit=25`)
          );
          if (response && response.ok) {
            const data = await response.json();
            if (Array.isArray(data?.packets) && data.packets.length > 0) {
              fetchedFromApi = true;
              const incoming: CapturedPacket[] = data.packets;
              lastPacketIdRef.current = incoming[incoming.length - 1].id;
              setPackets((prev) => {
                const existingIds = new Set(prev.map((p) => p.id));
                const uniqueNew = incoming.filter((p) => !existingIds.has(p.id));
                return uniqueNew.length > 0 ? [...prev, ...uniqueNew] : prev;
              });
            }
          }
        } catch {
          // Respaldo al generador en vivo local cuando Flask no está corriendo
        }
      }

      if (!fetchedFromApi) {
        appendSimulatedPacket(captureMode);
      }
    }, 700);

    return () => clearInterval(interval);
  }, [isCapturing, captureMode, apiBaseUrl, appendSimulatedPacket]);

  const handleStartCapture = () => {
    setIsCapturing(true);
    triggerBackendEndpoint('/api/capture/start', { mode: captureMode });
    appendSimulatedPacket(captureMode);
  };

  const handlePauseCapture = () => {
    setIsCapturing(false);
    triggerBackendEndpoint('/api/capture/stop');
  };

  const handleClearPackets = () => {
    triggerBackendEndpoint('/api/capture/clear');
    setPackets([]);
    setSelectedPacketId(null);
  };

  const handleModeChange = (mode: CaptureMode) => {
    setCaptureMode(mode);
    if (isCapturing) {
      triggerBackendEndpoint('/api/capture/start', { mode });
    }
  };

  const filteredPackets = useMemo(
    () => filterUnifiedPackets(packets, selectedProtocol, searchQuery),
    [packets, selectedProtocol, searchQuery]
  );

  const selectedPacket = useMemo(
    () => packets.find((p) => p.id === selectedPacketId) ?? null,
    [packets, selectedPacketId]
  );

  return (
    <div
      data-testid="unified-dashboard-root"
      className="h-screen bg-slate-50 text-slate-900 flex flex-col overflow-hidden"
    >
      {/* ZONA A: Barra Superior de Navegación, Controles y Filtros */}
      <AppHeader
        isCapturing={isCapturing}
        captureMode={captureMode}
        onModeChange={handleModeChange}
        onStartCapture={handleStartCapture}
        onPauseCapture={handlePauseCapture}
        onClearPackets={handleClearPackets}
        selectedProtocol={selectedProtocol}
        onSelectProtocol={setSelectedProtocol}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        onOpenQaLab={() => setIsQaLabOpen((prev) => !prev)}
        isQaLabOpen={isQaLabOpen}
      />

      {/* Conmutación al Entorno de Certificación ("Laboratorio QA") sin perder el estado de captura */}
      {isQaLabOpen ? (
        <div
          data-testid="qa-lab-modal-view"
          className="flex-1 overflow-y-auto bg-slate-100 border-t border-slate-200"
        >
          <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between sticky top-0 z-20 shadow-xs">
            <div className="flex items-center gap-2.5">
              <span className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                Modo Auditoría Técnica
              </span>
              <span className="text-sm font-semibold text-slate-900">
                Laboratorio QA — Verificación de Especificaciones SDD
              </span>
              <span className="text-xs text-slate-500 hidden sm:inline">
                (La captura principal continúa preservada en segundo plano:{' '}
                {packets.length} paquetes en memoria)
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsQaLabOpen(false)}
              data-testid="qa-lab-return-btn"
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-3.5 py-1.5 rounded-lg text-xs shadow-xs transition-colors"
            >
              ← Volver a Mini-Wireshark
            </button>
          </div>
          <TestSuiteRunner />
        </div>
      ) : (
        /* Layout Principal de Pantalla Única: ZONA B (Tabla en Vivo) + ZONA C (Inspector OSI) */
        <main
          data-testid="unified-main-workspace"
          className="flex-1 flex overflow-hidden min-h-0"
        >
          {/* ZONA B: Tabla de Tráfico en Tiempo Real (55% - 60% ancho) */}
          <LiveTrafficPanel
            packets={filteredPackets}
            totalPacketsCount={packets.length}
            selectedPacketId={selectedPacketId}
            onSelectPacket={(pkt) => setSelectedPacketId(pkt.id)}
            autoScroll={autoScroll}
            onToggleAutoScroll={() => setAutoScroll((prev) => !prev)}
          />

          {/* ZONA C: Inspector Visual y Pedagógico del Modelo OSI (40% - 45% ancho) */}
          <OsiInspectorPanel packet={selectedPacket} />
        </main>
      )}
    </div>
  );
};

export default UnifiedDashboard;

