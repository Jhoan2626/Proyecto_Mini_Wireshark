import React from 'react';
import { CapturedPacket } from '../tests/Spec01CaptureTest';
import { OsiLayerKey } from './osiPedagogicalGuides';

export interface OsiStackVisualizerProps {
  packet: CapturedPacket;
  onSelectLayer?: (layer: OsiLayerKey) => void;
}

/**
 * Componente 2.1: Diagrama de Pila de Encapsulamiento OSI (OsiStackVisualizer)
 * Muestra visualmente el flujo jerárquico Capa 2 Enlace → Capa 3 Red → Capa 4 Transporte → Capa 7 Aplicación.
 */
export const OsiStackVisualizer: React.FC<OsiStackVisualizerProps> = ({
  packet,
  onSelectLayer,
}) => {
  const l2 = packet.osi_layers.layer2_datalink;
  const l3 = packet.osi_layers.layer3_network;
  const l4 = packet.osi_layers.layer4_transport;
  const l7 = packet.osi_layers.layer7_application;

  const hasTransportPorts = Boolean(l4 && (l4.protocol === 'TCP' || l4.protocol === 'UDP'));
  const isArpPacket = l3?.protocol === 'ARP' || !l4 || l4.protocol === 'NONE';

  return (
    <div
      data-testid="osi-stack-visualizer"
      className="rounded-xl border border-slate-800 bg-slate-900/90 p-4 shadow-md"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold tracking-wider text-slate-400 uppercase">
            Pila Visual de Encapsulamiento del Paquete #{packet.id} ({packet.summary.protocol})
          </span>
          <span className="rounded border border-slate-700 bg-slate-950 px-2 py-0.5 font-mono text-[10px] text-slate-400">
            Capa 2 Enlace → Capa 3 Red → Capa 4 Transporte → Capa 7 Aplicación
          </span>
        </div>
        <span className="font-mono text-xs text-slate-400">
          Tamaño Total Trama: {packet.summary.length} bytes
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        {/* CAPA 2 • ENLACE DE DATOS */}
        <div
          data-testid="osi-stack-layer2"
          onClick={() => onSelectLayer?.('layer2')}
          className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 transition hover:border-amber-400/60"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-amber-300 uppercase">
              CAPA 2 • ENLACE DE DATOS
            </span>
            <span className="rounded bg-amber-500/20 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-amber-200">
              Trama
            </span>
          </div>
          <div className="mt-1 font-mono text-xs font-bold text-white">
            {l2?.protocol} ({l2?.ethertype})
          </div>
          <div className="mt-0.5 font-mono text-[11px] text-amber-200/80">
            {l2?.src_mac} → {l2?.dst_mac}
          </div>
        </div>

        {/* CAPA 3 • RED */}
        <div
          data-testid="osi-stack-layer3"
          onClick={() => onSelectLayer?.('layer3')}
          className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 transition hover:border-emerald-400/60"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-emerald-300 uppercase">
              CAPA 3 • RED
            </span>
            <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-emerald-200">
              Paquete
            </span>
          </div>
          <div className="mt-1 font-mono text-xs font-bold text-white">
            {l3?.protocol} (TTL: {l3?.ttl ?? 'N/A'})
          </div>
          <div className="mt-0.5 font-mono text-[11px] text-emerald-200/80">
            {l3?.src_ip} → {l3?.dst_ip}
          </div>
        </div>

        {/* CAPA 4 • TRANSPORTE */}
        <div
          data-testid="osi-stack-layer4"
          onClick={() => onSelectLayer?.('layer4')}
          className={`rounded-lg border p-3 transition ${
            isArpPacket
              ? 'border-slate-700 bg-slate-900/50 opacity-70'
              : 'border-blue-500/40 bg-blue-500/10 hover:border-blue-400/60'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-blue-300 uppercase">
              CAPA 4 • TRANSPORTE
            </span>
            <span className="rounded bg-blue-500/20 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-blue-200">
              {isArpPacket ? 'N/A' : l4?.protocol === 'UDP' ? 'Datagrama' : 'Segmento'}
            </span>
          </div>
          <div className="mt-1 font-mono text-xs font-bold text-white">
            {isArpPacket ? 'No Aplicable (ARP)' : l4?.protocol}
          </div>
          <div className="mt-0.5 font-mono text-[11px] text-blue-200/80">
            {isArpPacket
              ? 'No aplicable / Sin cabecera de Transporte'
              : hasTransportPorts
              ? `Puerto ${l4?.src_port} → ${l4?.dst_port}`
              : l4?.flags || 'Sin puertos'}
          </div>
        </div>

        {/* CAPA 7 • APLICACIÓN / PAYLOAD */}
        <div
          data-testid="osi-stack-layer7"
          onClick={() => onSelectLayer?.('layer7')}
          className="rounded-lg border border-purple-500/40 bg-purple-500/10 p-3 transition hover:border-purple-400/60"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-purple-300 uppercase">
              CAPA 7 • APLICACIÓN / PAYLOAD
            </span>
            <span className="rounded bg-purple-500/20 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-purple-200">
              Datos
            </span>
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
  );
};

export default OsiStackVisualizer;

