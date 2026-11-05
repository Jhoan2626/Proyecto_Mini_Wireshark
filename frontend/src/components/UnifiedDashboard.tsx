import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { CapturedPacket, CaptureMode, NetworkInterfaceItem } from '../tests/Spec01CaptureTest';
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

const IS_TEST_ENV =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.MODE === 'test') ||
  (typeof process !== 'undefined' && (process as any).env?.NODE_ENV === 'test');

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
  const [interfaces, setInterfaces] = useState<NetworkInterfaceItem[]>([]);
  const [selectedInterface, setSelectedInterface] = useState<string>('');
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [selectedProtocol, setSelectedProtocol] = useState<QuickProtocolFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [isQaLabOpen, setIsQaLabOpen] = useState<boolean>(false);

  const lastPacketIdRef = useRef<number>(
    initialPackets.length > 0 ? initialPackets[initialPackets.length - 1].id : 0
  );
  const backendSessionIdRef = useRef<string | null>(null);

  // Cargar interfaces de red reales detectadas por Scapy en el computador
  const fetchNetworkInterfaces = useCallback(async () => {
    if (typeof fetch !== 'function') return;
    try {
      const response = await Promise.resolve(fetch(`${apiBaseUrl}/api/interfaces`));
      if (response && response.ok) {
        const data = await response.json();
        if (Array.isArray(data?.interfaces)) {
          setInterfaces(data.interfaces);
          setSelectedInterface(
            (prev) => prev || data.default_interface || data.interfaces[0]?.id || ''
          );
        }
      }
    } catch {
      // Silencioso en entornos de prueba aislados sin servidor Flask activo
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    fetchNetworkInterfaces();
  }, [fetchNetworkInterfaces]);

  // En el navegador de producción/desarrollo, sincronizar con el estado activo del Backend Scapy al cargar
  useEffect(() => {
    if (IS_TEST_ENV || typeof fetch !== 'function') return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${apiBaseUrl}/api/status`);
        if (!res.ok || cancelled) return;
        const statusData = await res.json();
        if (statusData?.mode === 'real' && statusData?.is_capturing) {
          setCaptureMode('real');
          setIsCapturing(true);
          lastPacketIdRef.current = 0;
          setPackets([]);
          setSelectedPacketId(null);
        }
      } catch {
        // Silencioso si el backend aún no responde
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl]);

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

  const appendSimulatedPacket = useCallback((modeToUse: CaptureMode) => {
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
  }, []);

  // Función de sondeo inmediato de paquetes desde el backend
  const pollBackendPackets = useCallback(async () => {
    let fetchedFromApi = false;
    if (typeof fetch === 'function') {
      try {
        const response = await Promise.resolve(
          fetch(`${apiBaseUrl}/api/packets?since_id=${lastPacketIdRef.current}&limit=100`)
        );
        if (response && response.ok) {
          fetchedFromApi = true;
          const data = await response.json();

          if (captureMode === 'real' && data?.last_error && !data?.is_capturing) {
            setIsCapturing(false);
            setCaptureError(String(data.last_error));
            return true;
          }

          // Detectar si el backend fue reiniciado en la terminal local del usuario (nuevo session_id o contador menor)
          const incomingSessionId = typeof data?.session_id === 'string' ? data.session_id : null;
          const backendCounterReset =
            (incomingSessionId &&
              backendSessionIdRef.current &&
              incomingSessionId !== backendSessionIdRef.current) ||
            (typeof data?.max_id === 'number' && data.max_id < lastPacketIdRef.current) ||
            (typeof data?.total_captured === 'number' &&
              data.total_captured < lastPacketIdRef.current &&
              (!Array.isArray(data?.packets) || data.packets.length === 0));

          if (incomingSessionId) {
            backendSessionIdRef.current = incomingSessionId;
          }

          if (backendCounterReset) {
            lastPacketIdRef.current = 0;
            const retryRes = await Promise.resolve(
              fetch(`${apiBaseUrl}/api/packets?since_id=0&limit=100`)
            );
            if (retryRes && retryRes.ok) {
              const retryData = await retryRes.json();
              const freshPackets: CapturedPacket[] = Array.isArray(retryData?.packets)
                ? retryData.packets
                : [];
              if (freshPackets.length > 0) {
                lastPacketIdRef.current = freshPackets[freshPackets.length - 1].id;
                setPackets(freshPackets);
                setSelectedPacketId(freshPackets[0].id);
              } else {
                setPackets([]);
                setSelectedPacketId(null);
              }
            }
            return true;
          }

          if (Array.isArray(data?.packets) && data.packets.length > 0) {
            const incoming: CapturedPacket[] = data.packets;
            lastPacketIdRef.current = incoming[incoming.length - 1].id;
            setPackets((prev) => {
              const existingIds = new Set(prev.map((p) => p.id));
              const uniqueNew = incoming.filter((p) => !existingIds.has(p.id));
              return uniqueNew.length > 0 ? [...prev, ...uniqueNew] : prev;
            });
            setSelectedPacketId((prevSelected) => prevSelected ?? incoming[0].id);
          }
        }
      } catch {
        // Error de red al consultar Flask
      }
    }
    return fetchedFromApi;
  }, [apiBaseUrl, captureMode]);

  // Ciclo de captura en tiempo real (consulta API Flask)
  useEffect(() => {
    if (!isCapturing) return;

    // Ejecutar una consulta inmediata al activar captura en modo real
    if (captureMode === 'real') {
      pollBackendPackets();
    }

    const interval = setInterval(async () => {
      const fetchedFromApi = await pollBackendPackets();

      // PROHIBIDO simular paquetes si el usuario seleccionó "Red Local (Scapy)" (modo real)
      if (!fetchedFromApi && captureMode === 'mock') {
        appendSimulatedPacket('mock');
      }
    }, 500);

    return () => clearInterval(interval);
  }, [isCapturing, captureMode, pollBackendPackets, appendSimulatedPacket]);

  const startRealCaptureOnBackend = useCallback(
    async (ifaceToUse: string) => {
      setCaptureError(null);
      if (typeof fetch !== 'function') return;

      try {
        const response = await Promise.resolve(
          fetch(`${apiBaseUrl}/api/capture/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              mode: 'real',
              interface: ifaceToUse || undefined,
            }),
          })
        );
        if (response && response.ok) {
          const data = await response.json();
          if (data?.status === 'error') {
            setIsCapturing(false);
            setCaptureError(
              data.message ||
                'No fue posible iniciar la captura real con Scapy. Verifica permisos de Administrador o instalación de Npcap.'
            );
            return;
          }
          setIsCapturing(true);
          setCaptureError(null);
        } else {
          setIsCapturing(false);
          setCaptureError(
            'El servidor devolvió un error al iniciar la captura en modo Red Local (Scapy).'
          );
        }
      } catch {
        setIsCapturing(false);
        setCaptureError(
          'No hay conexión con el servidor Backend de Scapy (puerto 5000). Ejecuta start_dev.bat para capturar paquetes reales de tu tarjeta de red.'
        );
      }
    },
    [apiBaseUrl]
  );

  const handleStartCapture = () => {
    setCaptureError(null);
    if (captureMode === 'real') {
      // En modo real eliminamos únicamente paquetes simulados previos sin borrar los reales
      setPackets((prev) => {
        const onlyReal = prev.filter((p) => p.captured_mode === 'real');
        if (onlyReal.length === 0) {
          lastPacketIdRef.current = 0;
        }
        return onlyReal;
      });
      startRealCaptureOnBackend(selectedInterface);
    } else {
      setIsCapturing(true);
      triggerBackendEndpoint('/api/capture/start', { mode: 'mock' });
      appendSimulatedPacket('mock');
    }
  };

  const handlePauseCapture = () => {
    setIsCapturing(false);
    triggerBackendEndpoint('/api/capture/stop');
  };

  const handleClearPackets = () => {
    triggerBackendEndpoint('/api/capture/clear');
    lastPacketIdRef.current = 0;
    setPackets([]);
    setSelectedPacketId(null);
    setCaptureError(null);
  };

  const handleModeChange = (mode: CaptureMode) => {
    setCaptureMode(mode);
    setCaptureError(null);

    if (mode === 'real') {
      fetchNetworkInterfaces();
      // Limpiar los paquetes simulados para no mezclarlos con la captura real
      setPackets((prev) => prev.filter((p) => p.captured_mode === 'real'));
      setSelectedPacketId(null);
      lastPacketIdRef.current = 0;
      if (!IS_TEST_ENV) {
        startRealCaptureOnBackend(selectedInterface);
      } else if (isCapturing) {
        setIsCapturing(false);
      }
    } else if (isCapturing) {
      triggerBackendEndpoint('/api/capture/start', { mode: 'mock' });
    }
  };

  const handleSelectInterface = (ifaceId: string) => {
    setSelectedInterface(ifaceId);
    setCaptureError(null);
    if (captureMode === 'real' && (isCapturing || !IS_TEST_ENV)) {
      startRealCaptureOnBackend(ifaceId);
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
      className="h-screen overflow-hidden flex flex-col bg-slate-50 text-slate-900 font-sans antialiased"
    >
      {/* Zona A: Barra Superior Unificada (AppHeader) */}
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
        interfaces={interfaces}
        selectedInterface={selectedInterface}
        onSelectInterface={handleSelectInterface}
        onOpenQaLab={() => setIsQaLabOpen(true)}
        isQaLabOpen={isQaLabOpen}
      />

      {/* Aviso Diagnóstico Claro si falta Npcap o Permisos de Administrador en Modo Real */}
      {captureMode === 'real' && captureError && (
        <div
          data-testid="real-capture-error-banner"
          role="alert"
          className="mx-3 mt-2.5 px-4 py-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between gap-3 shrink-0"
        >
          <div className="flex items-center gap-2">
            <span className="font-semibold px-2 py-0.5 rounded bg-rose-100 text-rose-900 border border-rose-200">
              Captura Real Scapy
            </span>
            <span>{captureError}</span>
          </div>
          <button
            type="button"
            onClick={() => setCaptureError(null)}
            className="text-rose-700 hover:text-rose-900 font-medium px-2 py-0.5 rounded hover:bg-rose-100 transition-colors shrink-0"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* Cuerpo Principal: Split-Pane 58% Izquierda (Tabla en Vivo) / 42% Derecha (Inspector OSI) */}
      <main className="flex-1 flex overflow-hidden min-h-0">
        {/* Zona B: Panel Izquierdo (58% width) */}
        <LiveTrafficPanel
          packets={filteredPackets}
          totalPacketsCount={packets.length}
          selectedPacketId={selectedPacketId}
          onSelectPacket={(pkt) => setSelectedPacketId(pkt.id)}
          autoScroll={autoScroll}
          onToggleAutoScroll={() => setAutoScroll((prev) => !prev)}
        />

        {/* Zona C: Panel Derecho (42% width) */}
        <OsiInspectorPanel packet={selectedPacket} />
      </main>

      {/* Modal / Vista Confinada del Laboratorio de Certificación QA */}
      {isQaLabOpen && (
        <div
          data-testid="qa-lab-modal-view"
          role="dialog"
          aria-modal="true"
          aria-label="Laboratorio de Certificación QA"
          className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex flex-col p-6 overflow-y-auto"
        >
          <div className="max-w-7xl w-full mx-auto bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden flex flex-col max-h-full">
            <div className="bg-slate-50 border-b border-slate-200 px-6 py-3.5 flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Laboratorio de Certificación QA (Entorno de Auditoría SDD)
                </h2>
                <p className="text-xs text-slate-500">
                  Validación de contratos técnicos y suites de prueba aisladas de la vista principal
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsQaLabOpen(false)}
                data-testid="qa-lab-return-btn"
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition-colors"
              >
                Volver a Mini-Wireshark
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <TestSuiteRunner />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UnifiedDashboard;
