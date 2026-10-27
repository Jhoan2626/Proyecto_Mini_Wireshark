import React, { useState, useEffect, useRef } from 'react';
import {
  CapturedPacket,
  CaptureMode,
  FIXTURE_PACKETS,
  validateOsiPacketContract,
} from './Spec01CaptureTest';

// ============================================================================
// TIPOS DE DIAGNÓSTICO DE API PARA LA FASE 2 (/specs/02-api-flask-streaming.md)
// ============================================================================

interface ApiLogEntry {
  id: number;
  timestamp: string;
  method: 'GET' | 'POST';
  endpoint: string;
  statusCode: number | 'NET_ERR';
  latencyMs: number;
  ok: boolean;
  summary: string;
  rawPayload?: unknown;
}

export interface Spec02ApiStreamTestProps {
  onValidationChange?: (allPassed: boolean) => void;
}

export const Spec02ApiStreamTest: React.FC<Spec02ApiStreamTestProps> = ({
  onValidationChange,
}) => {
  const [baseUrl, setBaseUrl] = useState<string>('http://127.0.0.1:5000');
  const [captureMode, setCaptureMode] = useState<CaptureMode>('mock');
  const [useSimulatedAdapter, setUseSimulatedAdapter] = useState<boolean>(false);
  const [isPolling, setIsPolling] = useState<boolean>(false);

  // Estado reportado por el backend o el adaptador simulado
  const [serverStatus, setServerStatus] = useState<{
    online: boolean;
    is_capturing: boolean;
    mode: CaptureMode;
    packet_count: number;
  }>({
    online: false,
    is_capturing: false,
    mode: 'mock',
    packet_count: 0,
  });

  const [receivedPackets, setReceivedPackets] = useState<CapturedPacket[]>([]);
  const [apiLogs, setApiLogs] = useState<ApiLogEntry[]>([]);
  const [lastLatencyMs, setLastLatencyMs] = useState<number | null>(null);

  // Checklist de endpoints probados
  const [endpointChecks, setEndpointChecks] = useState<{
    statusOk: boolean;
    startOk: boolean;
    packetsOk: boolean;
    stopOk: boolean;
    clearOk: boolean;
    latencyOk: boolean;
  }>({
    statusOk: false,
    startOk: false,
    packetsOk: false,
    stopOk: false,
    clearOk: false,
    latencyOk: false,
  });

  const logIdRef = useRef<number>(1);
  const simulatedStoreRef = useRef<{
    isCapturing: boolean;
    mode: CaptureMode;
    packets: CapturedPacket[];
    seq: number;
  }>({
    isCapturing: false,
    mode: 'mock',
    packets: [],
    seq: 1,
  });

  const allChecksPassed =
    endpointChecks.statusOk &&
    endpointChecks.startOk &&
    endpointChecks.packetsOk &&
    endpointChecks.stopOk &&
    endpointChecks.clearOk &&
    endpointChecks.latencyOk;

  useEffect(() => {
    onValidationChange?.(allChecksPassed);
  }, [allChecksPassed, onValidationChange]);

  const appendLog = (entry: Omit<ApiLogEntry, 'id' | 'timestamp'>) => {
    const newEntry: ApiLogEntry = {
      ...entry,
      id: logIdRef.current++,
      timestamp: new Date().toISOString().split('T')[1].slice(0, 12),
    };
    setApiLogs((prev) => [newEntry, ...prev.slice(0, 29)]);
  };

  // Generador sintético para el modo Sandbox de diagnóstico (cuando Flask aún no está corriendo)
  const createSyntheticPacket = (): CapturedPacket => {
    const keys = Object.keys(FIXTURE_PACKETS);
    const templateKey = keys[simulatedStoreRef.current.seq % keys.length];
    const template = FIXTURE_PACKETS[templateKey];
    const nextId = simulatedStoreRef.current.seq++;
    return {
      ...template,
      id: nextId,
      timestamp: new Date().toISOString(),
      relative_time: Number((nextId * 0.45).toFixed(3)),
      captured_mode: simulatedStoreRef.current.mode,
    };
  };

  // Ejecutor unificado de peticiones HTTP o Sandbox
  const executeApiRequest = async (
    method: 'GET' | 'POST',
    path: string,
    body?: Record<string, unknown>
  ) => {
    const startPerf = performance.now();

    if (useSimulatedAdapter) {
      await new Promise((r) => setTimeout(r, 28)); // Simula latencia local ~28ms
      const latency = Math.round(performance.now() - startPerf);
      setLastLatencyMs(latency);

      const store = simulatedStoreRef.current;
      let responsePayload: any = {};

      if (path === '/api/status') {
        responsePayload = {
          status: 'ok',
          is_capturing: store.isCapturing,
          mode: store.mode,
          packet_count: store.packets.length,
        };
        setServerStatus({
          online: true,
          is_capturing: store.isCapturing,
          mode: store.mode,
          packet_count: store.packets.length,
        });
        setEndpointChecks((prev) => ({
          ...prev,
          statusOk: true,
          latencyOk: latency < 250,
        }));
      } else if (path === '/api/capture/start') {
        store.isCapturing = true;
        store.mode = (body?.mode as CaptureMode) || 'mock';
        store.packets.push(createSyntheticPacket(), createSyntheticPacket());
        responsePayload = {
          status: 'started',
          is_capturing: true,
          mode: store.mode,
          message: 'Captura iniciada en adaptador de prueba.',
        };
        setServerStatus({
          online: true,
          is_capturing: true,
          mode: store.mode,
          packet_count: store.packets.length,
        });
        setEndpointChecks((prev) => ({
          ...prev,
          startOk: true,
          latencyOk: latency < 250,
        }));
      } else if (path === '/api/capture/stop') {
        store.isCapturing = false;
        responsePayload = {
          status: 'stopped',
          is_capturing: false,
          packet_count: store.packets.length,
        };
        setServerStatus((prev) => ({ ...prev, is_capturing: false }));
        setEndpointChecks((prev) => ({ ...prev, stopOk: true, latencyOk: latency < 250 }));
      } else if (path === '/api/capture/clear') {
        store.packets = [];
        store.seq = 1;
        responsePayload = {
          status: 'cleared',
          packet_count: 0,
        };
        setReceivedPackets([]);
        setServerStatus((prev) => ({ ...prev, packet_count: 0 }));
        setEndpointChecks((prev) => ({ ...prev, clearOk: true, latencyOk: latency < 250 }));
      } else if (path.startsWith('/api/packets')) {
        if (store.isCapturing) {
          store.packets.push(createSyntheticPacket());
        }
        responsePayload = {
          status: 'ok',
          is_capturing: store.isCapturing,
          mode: store.mode,
          total_captured: store.packets.length,
          returned_count: store.packets.length,
          packets: [...store.packets],
        };
        setReceivedPackets([...store.packets]);
        setServerStatus((prev) => ({
          ...prev,
          online: true,
          packet_count: store.packets.length,
        }));
        const validSchema =
          store.packets.length === 0 ||
          validateOsiPacketContract(store.packets[0]).every((r) => r.passed);
        setEndpointChecks((prev) => ({
          ...prev,
          packetsOk: validSchema,
          latencyOk: latency < 250,
        }));
      }

      appendLog({
        method,
        endpoint: `${path} (Sandbox)`,
        statusCode: 200,
        latencyMs: latency,
        ok: true,
        summary: JSON.stringify(responsePayload).slice(0, 110) + '...',
        rawPayload: responsePayload,
      });
      return;
    }

    // Petición HTTP Real al servidor Flask de Persona 1
    try {
      const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const latency = Math.round(performance.now() - startPerf);
      setLastLatencyMs(latency);

      const data = await response.json();

      if (response.ok) {
        if (path === '/api/status') {
          setServerStatus({
            online: true,
            is_capturing: Boolean(data.is_capturing),
            mode: (data.mode as CaptureMode) || 'mock',
            packet_count: Number(data.packet_count ?? 0),
          });
          setEndpointChecks((prev) => ({
            ...prev,
            statusOk: true,
            latencyOk: latency < 250,
          }));
        } else if (path === '/api/capture/start') {
          setServerStatus((prev) => ({
            ...prev,
            online: true,
            is_capturing: true,
            mode: (data.mode as CaptureMode) || captureMode,
          }));
          setEndpointChecks((prev) => ({
            ...prev,
            startOk: true,
            latencyOk: latency < 250,
          }));
        } else if (path === '/api/capture/stop') {
          setServerStatus((prev) => ({
            ...prev,
            online: true,
            is_capturing: false,
          }));
          setEndpointChecks((prev) => ({
            ...prev,
            stopOk: true,
            latencyOk: latency < 250,
          }));
        } else if (path === '/api/capture/clear') {
          setReceivedPackets([]);
          setServerStatus((prev) => ({
            ...prev,
            online: true,
            packet_count: 0,
          }));
          setEndpointChecks((prev) => ({
            ...prev,
            clearOk: true,
            latencyOk: latency < 250,
          }));
        } else if (path.startsWith('/api/packets')) {
          const pkts: CapturedPacket[] = Array.isArray(data.packets)
            ? data.packets
            : Array.isArray(data)
            ? data
            : [];
          setReceivedPackets(pkts);
          setServerStatus((prev) => ({
            ...prev,
            online: true,
            packet_count: Number(data.total_captured ?? pkts.length),
          }));
          const validContract =
            pkts.length === 0 || validateOsiPacketContract(pkts[0]).every((r) => r.passed);
          setEndpointChecks((prev) => ({
            ...prev,
            packetsOk: validContract,
            latencyOk: latency < 250,
          }));
        }
      }

      appendLog({
        method,
        endpoint: path,
        statusCode: response.status,
        latencyMs: latency,
        ok: response.ok,
        summary: JSON.stringify(data).slice(0, 110),
        rawPayload: data,
      });
    } catch (err: any) {
      const latency = Math.round(performance.now() - startPerf);
      setServerStatus((prev) => ({ ...prev, online: false }));
      appendLog({
        method,
        endpoint: path,
        statusCode: 'NET_ERR',
        latencyMs: latency,
        ok: false,
        summary: `Error de conexión CORS/Red hacia ${baseUrl}${path}: ${
          err?.message || 'Servidor Flask apagado'
        }`,
      });
    }
  };

  // Polling automático para probar streaming / no bloqueo
  useEffect(() => {
    if (!isPolling) return;
    const timer = setInterval(() => {
      executeApiRequest('GET', '/api/packets?limit=50');
    }, 1000);
    return () => clearInterval(timer);
  }, [isPolling, baseUrl, useSimulatedAdapter]);

  return (
    <div className="space-y-6 text-slate-100">
      {/* Cabecera de Fase 2 */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-5 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400 border border-emerald-500/30">
              FASE 2 • PERSONA 1 (SERVIDOR FLASK + CONCURRENCIA + CORS)
            </span>
            <h2 className="mt-2 text-xl font-bold text-white">
              Spec 02 — Consola de Diagnóstico de API REST y Streaming
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Evalúa los endpoints de control de captura, tiempos de respuesta bajo concurrencia y
              política CORS según <code className="text-slate-300">/specs/02-api-flask-streaming.md</code>.
            </p>
          </div>

          {/* Medidores de Estado y Latencia */}
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-center">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Latencia HTTP
              </div>
              <div
                className={`text-lg font-mono font-bold ${
                  lastLatencyMs === null
                    ? 'text-slate-500'
                    : lastLatencyMs < 100
                    ? 'text-emerald-400'
                    : lastLatencyMs < 250
                    ? 'text-amber-400'
                    : 'text-rose-400'
                }`}
              >
                {lastLatencyMs !== null ? `${lastLatencyMs} ms` : '— ms'}
              </div>
            </div>

            <div
              className={`rounded-xl border px-4 py-2.5 ${
                serverStatus.online
                  ? 'border-emerald-500/40 bg-emerald-950/30 text-emerald-300'
                  : 'border-slate-700 bg-slate-950 text-slate-400'
              }`}
            >
              <div className="text-[10px] font-bold uppercase tracking-wider">Estado Backend</div>
              <div className="text-sm font-bold">
                {serverStatus.online
                  ? serverStatus.is_capturing
                    ? `CAPTURANDO (${serverStatus.mode.toUpperCase()})`
                    : 'CONECTADO (IDLE)'
                  : 'SIN CONEXIÓN'}
              </div>
            </div>
          </div>
        </div>

        {/* Configuración de Endpoint y Controles de Petición */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-slate-800 pt-4">
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-xs font-semibold text-slate-400">URL Servidor Flask:</label>
            <input
              type="text"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              disabled={useSimulatedAdapter}
              className="w-56 rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs font-mono text-slate-200 disabled:opacity-50"
            />

            <select
              value={captureMode}
              onChange={(e) => setCaptureMode(e.target.value as CaptureMode)}
              className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200"
            >
              <option value="mock">Modo: Mock (Sin Root)</option>
              <option value="real">Modo: Real (Scapy NIC)</option>
            </select>

            <label className="flex items-center gap-2 cursor-pointer rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={useSimulatedAdapter}
                onChange={(e) => setUseSimulatedAdapter(e.target.checked)}
                className="rounded text-blue-500"
              />
              Simulador Local API (Sandbox sin Flask activo)
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => executeApiRequest('GET', '/api/status')}
              className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition border border-slate-700"
            >
              GET /api/status
            </button>
            <button
              type="button"
              onClick={() =>
                executeApiRequest('POST', '/api/capture/start', { mode: captureMode })
              }
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 transition"
            >
              POST /start
            </button>
            <button
              type="button"
              onClick={() => executeApiRequest('POST', '/api/capture/stop')}
              className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-500 transition"
            >
              POST /stop
            </button>
            <button
              type="button"
              onClick={() => executeApiRequest('POST', '/api/capture/clear')}
              className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-500 transition"
            >
              POST /clear
            </button>
            <button
              type="button"
              onClick={() => executeApiRequest('GET', '/api/packets?limit=50')}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 transition"
            >
              GET /packets
            </button>
            <button
              type="button"
              onClick={() => setIsPolling((prev) => !prev)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition border ${
                isPolling
                  ? 'border-purple-400 bg-purple-600 text-white animate-pulse'
                  : 'border-slate-700 bg-slate-800 text-slate-300'
              }`}
            >
              {isPolling ? 'Detener Stream (1s)' : 'Stream Auto-Poll'}
            </button>
          </div>
        </div>
      </div>

      {/* Checklist de Criterios de Aceptación Spec 02 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { key: 'statusOk', label: 'GET /api/status', ok: endpointChecks.statusOk },
          { key: 'startOk', label: 'POST /capture/start', ok: endpointChecks.startOk },
          { key: 'packetsOk', label: 'GET /api/packets', ok: endpointChecks.packetsOk },
          { key: 'stopOk', label: 'POST /capture/stop', ok: endpointChecks.stopOk },
          { key: 'clearOk', label: 'POST /capture/clear', ok: endpointChecks.clearOk },
          { key: 'latencyOk', label: 'Latencia < 250ms', ok: endpointChecks.latencyOk },
        ].map((item) => (
          <div
            key={item.key}
            className={`rounded-xl border p-3 text-center ${
              item.ok
                ? 'border-emerald-500/40 bg-emerald-950/25 text-emerald-300'
                : 'border-slate-800 bg-slate-900/70 text-slate-400'
            }`}
          >
            <div className="text-lg font-bold">{item.ok ? '✓ PASS' : 'PENDIENTE'}</div>
            <div className="mt-1 font-mono text-[11px]">{item.label}</div>
          </div>
        ))}
      </div>

      {/* Paneles Inferiores: Consola de Peticiones HTTP y Visor de Paquetes Recibidos */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Registro de Tráfico HTTP API */}
        <div className="lg:col-span-6 rounded-xl border border-slate-800 bg-slate-900/90 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Monitor de Peticiones HTTP & Latencia
            </h3>
            <button
              type="button"
              onClick={() => setApiLogs([])}
              className="text-xs text-slate-400 hover:text-white"
            >
              Limpiar consola
            </button>
          </div>

          <div className="max-h-96 overflow-y-auto space-y-2 pr-1">
            {apiLogs.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-800 p-8 text-center text-xs text-slate-500">
                Dispara cualquiera de los botones superiores para registrar la telemetría HTTP.
              </div>
            ) : (
              apiLogs.map((log) => (
                <div
                  key={log.id}
                  className={`rounded-lg border p-2.5 font-mono text-xs ${
                    log.ok
                      ? 'border-slate-800 bg-slate-950/90 text-slate-200'
                      : 'border-rose-500/40 bg-rose-950/30 text-rose-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                          log.method === 'POST'
                            ? 'bg-amber-500/20 text-amber-300'
                            : 'bg-blue-500/20 text-blue-300'
                        }`}
                      >
                        {log.method}
                      </span>
                      <span className="font-semibold text-white">{log.endpoint}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                          log.ok
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-rose-500/30 text-rose-200'
                        }`}
                      >
                        {log.statusCode}
                      </span>
                      <span className="text-slate-400">{log.latencyMs} ms</span>
                      <span className="text-slate-500">{log.timestamp}</span>
                    </div>
                  </div>
                  <div className="mt-1.5 truncate text-[11px] text-slate-400">{log.summary}</div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Visor de Paquetes Recibidos desde el Stream */}
        <div className="lg:col-span-6 rounded-xl border border-slate-800 bg-slate-900/90 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Visor de Paquetes Recibidos (`GET /api/packets`)
            </h3>
            <span className="rounded-full bg-blue-500/20 px-2.5 py-0.5 text-xs font-mono text-blue-300">
              {receivedPackets.length} paquetes en buffer
            </span>
          </div>

          <div className="max-h-96 overflow-y-auto space-y-2 pr-1">
            {receivedPackets.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-800 p-8 text-center text-xs text-slate-500">
                No hay paquetes cargados. Pulsa <strong>POST /start</strong> seguido de{' '}
                <strong>GET /packets</strong>.
              </div>
            ) : (
              receivedPackets.map((pkt) => (
                <div
                  key={pkt.id}
                  className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-xs font-mono"
                >
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="font-bold text-emerald-400">
                      #{pkt.id} [{pkt.summary.protocol}]
                    </span>
                    <span>
                      {pkt.summary.src_ip} → {pkt.summary.dst_ip} ({pkt.summary.length} B)
                    </span>
                  </div>
                  <div className="mt-1 text-slate-400">{pkt.summary.info}</div>
                  <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
                    <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-amber-300">
                      L2: {pkt.osi_layers.layer2_datalink.src_mac}
                    </span>
                    <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-emerald-300">
                      L3: {pkt.osi_layers.layer3_network.protocol} (TTL:{' '}
                      {pkt.osi_layers.layer3_network.ttl ?? 'N/A'})
                    </span>
                    <span className="rounded bg-blue-500/15 px-1.5 py-0.5 text-blue-300">
                      L4: {pkt.osi_layers.layer4_transport?.protocol ?? 'NONE'}
                    </span>
                    <span className="rounded bg-purple-500/15 px-1.5 py-0.5 text-purple-300">
                      L7: {pkt.osi_layers.layer7_application.protocol_hint} (
                      {pkt.osi_layers.layer7_application.payload_size}B)
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Spec02ApiStreamTest;

