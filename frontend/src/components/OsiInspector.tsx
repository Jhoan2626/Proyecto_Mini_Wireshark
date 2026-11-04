import React, { useState, useEffect } from 'react';
import { CapturedPacket } from '../tests/Spec01CaptureTest';
import { OSI_PEDAGOGICAL_GUIDES, OsiLayerKey } from './osiPedagogicalGuides';
import OsiStackVisualizer from './OsiStackVisualizer';
import OsiLayerAccordionCard from './OsiLayerAccordionCard';
import HexAsciiPayloadViewer from './HexAsciiPayloadViewer';

const ALL_LAYERS: OsiLayerKey[] = ['layer2', 'layer3', 'layer4', 'layer7'];

function buildExpandedMap(
  defaultExpandedLayers?: OsiLayerKey[]
): Record<OsiLayerKey, boolean> {
  const initialSet = new Set<OsiLayerKey>(defaultExpandedLayers ?? ALL_LAYERS);
  return {
    layer2: initialSet.has('layer2'),
    layer3: initialSet.has('layer3'),
    layer4: initialSet.has('layer4'),
    layer7: initialSet.has('layer7'),
  };
}

/**
 * Contrato oficial de propiedades según Sección 3 de /specs/04-inspector-visual-osi.md
 */
export interface OsiInspectorProps {
  packet: CapturedPacket | null;
  defaultExpandedLayers?: Array<'layer2' | 'layer3' | 'layer4' | 'layer7'>;
  showPedagogicalGuides?: boolean;
  // Propiedades opcionales para control sincronizado desde el arnés Spec04OsiInspectorTest
  expandedLayers?: Record<'layer2' | 'layer3' | 'layer4' | 'layer7', boolean>;
  onToggleLayer?: (layer: 'layer2' | 'layer3' | 'layer4' | 'layer7') => void;
  onExpandAllChange?: (expand: boolean) => void;
  onShowPedagogicalGuidesChange?: (show: boolean) => void;
  showControlsToolbar?: boolean;
}

export const OsiInspector: React.FC<OsiInspectorProps> = ({
  packet,
  defaultExpandedLayers,
  showPedagogicalGuides = true,
  expandedLayers: controlledExpanded,
  onToggleLayer,
  onExpandAllChange,
  onShowPedagogicalGuidesChange,
  showControlsToolbar = true,
}) => {
  const [internalExpanded, setInternalExpanded] = useState<Record<OsiLayerKey, boolean>>(() =>
    buildExpandedMap(defaultExpandedLayers)
  );
  const [internalShowGuides, setInternalShowGuides] = useState<boolean>(showPedagogicalGuides);

  useEffect(() => {
    setInternalShowGuides(showPedagogicalGuides);
  }, [showPedagogicalGuides]);

  useEffect(() => {
    if (defaultExpandedLayers) {
      setInternalExpanded(buildExpandedMap(defaultExpandedLayers));
    }
  }, [defaultExpandedLayers]);

  const activeExpanded = controlledExpanded ?? internalExpanded;
  const activeShowGuides = internalShowGuides;

  const handleToggleLayer = (layerKey: OsiLayerKey) => {
    if (!controlledExpanded) {
      setInternalExpanded((prev) => ({ ...prev, [layerKey]: !prev[layerKey] }));
    }
    onToggleLayer?.(layerKey);
  };

  const handleSetAllExpanded = (expand: boolean) => {
    if (!controlledExpanded) {
      setInternalExpanded({
        layer2: expand,
        layer3: expand,
        layer4: expand,
        layer7: expand,
      });
    }
    onExpandAllChange?.(expand);
  };

  const handleTogglePedagogicalGuides = () => {
    const next = !activeShowGuides;
    setInternalShowGuides(next);
    onShowPedagogicalGuidesChange?.(next);
  };

  if (!packet) {
    return (
      <div
        data-testid="osi-inspector-empty"
        className="rounded-xl border border-dashed border-slate-700 bg-slate-900/60 p-12 text-center"
      >
        <div className="text-lg font-bold text-slate-300">
          Ningún paquete seleccionado para inspección OSI
        </div>
        <p className="mt-1 text-xs text-slate-400">
          Selecciona cualquiera de los escenarios superiores o haz clic en una fila de la Tabla de
          Tráfico (Fase 3) para visualizar el desencapsulamiento capa por capa.
        </p>
      </div>
    );
  }

  const l2 = packet.osi_layers.layer2_datalink;
  const l3 = packet.osi_layers.layer3_network;
  const l4 = packet.osi_layers.layer4_transport;
  const l7 = packet.osi_layers.layer7_application;

  const hasTransportPorts = Boolean(l4 && (l4.protocol === 'TCP' || l4.protocol === 'UDP'));
  const isArpPacket = l3?.protocol === 'ARP' || !l4 || l4.protocol === 'NONE';

  return (
    <div className="space-y-4" data-testid="osi-inspector">
      {showControlsToolbar && (
        <div
          data-testid="osi-inspector-toolbar"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/90 px-4 py-2.5"
        >
          <span className="text-xs font-bold tracking-wider text-slate-400 uppercase">
            Inspector Interactivo del Modelo OSI • Paquete #{packet.id}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleTogglePedagogicalGuides}
              aria-pressed={activeShowGuides}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                activeShowGuides
                  ? 'border-emerald-500/40 bg-emerald-950/40 text-emerald-300'
                  : 'border-slate-700 bg-slate-800 text-slate-400'
              }`}
            >
              {activeShowGuides ? '🎓 Guías Pedagógicas: ON' : '🎓 Guías Pedagógicas: OFF'}
            </button>
            <button
              type="button"
              onClick={() => handleSetAllExpanded(true)}
              className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700"
            >
              Expandir Todo
            </button>
            <button
              type="button"
              onClick={() => handleSetAllExpanded(false)}
              className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700"
            >
              Colapsar Todo
            </button>
          </div>
        </div>
      )}

      {/* 2.1 Diagrama de Pila de Encapsulamiento OSI */}
      <OsiStackVisualizer
        packet={packet}
        onSelectLayer={(layerKey) => {
          if (!activeExpanded[layerKey]) {
            handleToggleLayer(layerKey);
          }
        }}
      />

      {/* 2.2 Tarjetas Desplegables por Capa con Código de Color */}
      <div className="space-y-4">
        {/* CAPA 2: ENLACE DE DATOS */}
        <OsiLayerAccordionCard
          layerKey="layer2"
          isExpanded={activeExpanded.layer2}
          onToggle={handleToggleLayer}
          showPedagogicalGuides={activeShowGuides}
        >
          {l2 && (
            <div className="grid grid-cols-1 gap-3 font-mono text-xs sm:grid-cols-3">
              <div
                data-testid="layer2-src-mac"
                className="rounded-lg border border-slate-800 bg-slate-950 p-3"
              >
                <div className="text-slate-400">MAC Origen (`src_mac`)</div>
                <div className="mt-1 text-sm font-bold text-amber-300">{l2.src_mac}</div>
                {activeShowGuides && (
                  <div className="mt-1.5 font-sans text-[11px] text-slate-400">
                    {OSI_PEDAGOGICAL_GUIDES.layer2.fields.src_mac}
                  </div>
                )}
              </div>

              <div
                data-testid="layer2-dst-mac"
                className="rounded-lg border border-slate-800 bg-slate-950 p-3"
              >
                <div className="text-slate-400">MAC Destino (`dst_mac`)</div>
                <div className="mt-1 text-sm font-bold text-amber-300">
                  <span>{l2.dst_mac}</span>
                  {l2.dst_mac.toUpperCase() === 'FF:FF:FF:FF:FF:FF' && (
                    <span
                      data-testid="layer2-broadcast-badge"
                      className="ml-1.5 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px]"
                    >
                      BROADCAST
                    </span>
                  )}
                </div>
                {activeShowGuides && (
                  <div className="mt-1.5 font-sans text-[11px] text-slate-400">
                    {OSI_PEDAGOGICAL_GUIDES.layer2.fields.dst_mac}
                  </div>
                )}
              </div>

              <div
                data-testid="layer2-ethertype"
                className="rounded-lg border border-slate-800 bg-slate-950 p-3"
              >
                <div className="text-slate-400">Protocolo / EtherType</div>
                <div className="mt-1 text-sm font-bold text-amber-300">
                  {l2.protocol} ({l2.ethertype})
                </div>
                {activeShowGuides && (
                  <div className="mt-1.5 font-sans text-[11px] text-slate-400">
                    {OSI_PEDAGOGICAL_GUIDES.layer2.fields.ethertype}
                  </div>
                )}
              </div>
            </div>
          )}
        </OsiLayerAccordionCard>

        {/* CAPA 3: RED */}
        <OsiLayerAccordionCard
          layerKey="layer3"
          isExpanded={activeExpanded.layer3}
          onToggle={handleToggleLayer}
          showPedagogicalGuides={activeShowGuides}
        >
          {l3 && (
            <div className="grid grid-cols-1 gap-3 font-mono text-xs sm:grid-cols-4">
              <div
                data-testid="layer3-src-ip"
                className="rounded-lg border border-slate-800 bg-slate-950 p-3"
              >
                <div className="text-slate-400">IP Origen (`src_ip`)</div>
                <div className="mt-1 text-sm font-bold text-emerald-300">{l3.src_ip}</div>
                {activeShowGuides && (
                  <div className="mt-1.5 font-sans text-[11px] text-slate-400">
                    {OSI_PEDAGOGICAL_GUIDES.layer3.fields.src_ip}
                  </div>
                )}
              </div>

              <div
                data-testid="layer3-dst-ip"
                className="rounded-lg border border-slate-800 bg-slate-950 p-3"
              >
                <div className="text-slate-400">IP Destino (`dst_ip`)</div>
                <div className="mt-1 text-sm font-bold text-emerald-300">{l3.dst_ip}</div>
                {activeShowGuides && (
                  <div className="mt-1.5 font-sans text-[11px] text-slate-400">
                    {OSI_PEDAGOGICAL_GUIDES.layer3.fields.dst_ip}
                  </div>
                )}
              </div>

              <div
                data-testid="layer3-ttl"
                className="rounded-lg border border-slate-800 bg-slate-950 p-3"
              >
                <div className="text-slate-400">TTL (`ttl`)</div>
                <div className="mt-1 text-sm font-bold text-emerald-300">
                  {l3.ttl !== null ? `${l3.ttl} saltos` : 'N/A (Trama ARP local)'}
                </div>
                {activeShowGuides && (
                  <div className="mt-1.5 font-sans text-[11px] text-slate-400">
                    {OSI_PEDAGOGICAL_GUIDES.layer3.fields.ttl}
                  </div>
                )}
              </div>

              <div
                data-testid="layer3-length"
                className="rounded-lg border border-slate-800 bg-slate-950 p-3"
              >
                <div className="text-slate-400">Longitud (`length`)</div>
                <div className="mt-1 text-sm font-bold text-emerald-300">
                  {l3.length} bytes ({l3.protocol})
                </div>
                {activeShowGuides && (
                  <div className="mt-1.5 font-sans text-[11px] text-slate-400">
                    {OSI_PEDAGOGICAL_GUIDES.layer3.fields.length}
                  </div>
                )}
              </div>
            </div>
          )}
        </OsiLayerAccordionCard>

        {/* CAPA 4: TRANSPORTE */}
        <OsiLayerAccordionCard
          layerKey="layer4"
          isExpanded={activeExpanded.layer4}
          onToggle={handleToggleLayer}
          showPedagogicalGuides={activeShowGuides}
        >
          {isArpPacket || !l4 ? (
            <div
              data-testid="layer4-not-applicable"
              className="rounded-lg border border-slate-800 bg-slate-950 p-4 text-xs text-slate-300"
            >
              <div className="mb-1 font-mono text-xs font-bold text-blue-300">
                Estado: No aplicable / Sin cabecera de Transporte
              </div>
              ℹ️ <strong>Nota Pedagógica:</strong> Este paquete es de tipo{' '}
              <code className="text-purple-300">ARP</code> (Resolución de Direcciones MAC en Capa
              2/3), por lo que <strong>no posee cabecera de Capa 4</strong> ni utiliza puertos
              TCP/UDP.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 font-mono text-xs sm:grid-cols-3">
              <div
                data-testid="layer4-ports"
                className="rounded-lg border border-slate-800 bg-slate-950 p-3"
              >
                <div className="text-slate-400">Protocolo y Puertos (`src_port` / `dst_port`)</div>
                <div className="mt-1 text-sm font-bold text-blue-300">
                  {l4.protocol}:{' '}
                  {hasTransportPorts
                    ? `${l4.src_port} → ${l4.dst_port}`
                    : 'Sin puertos (Control ICMP)'}
                </div>
                {hasTransportPorts && (
                  <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-blue-200/80">
                    <span>Origen: {l4.src_port}</span>
                    <span>•</span>
                    <span>Destino: {l4.dst_port}</span>
                  </div>
                )}
                {activeShowGuides && (
                  <div className="mt-1.5 font-sans text-[11px] text-slate-400">
                    {OSI_PEDAGOGICAL_GUIDES.layer4.fields.ports}
                  </div>
                )}
              </div>

              <div
                data-testid="layer4-flags"
                className="rounded-lg border border-slate-800 bg-slate-950 p-3"
              >
                <div className="text-slate-400">Flags / Control (`flags`)</div>
                <div className="mt-1 text-sm font-bold text-blue-300">
                  {l4.flags ?? 'Ninguno (UDP sin estado)'}
                </div>
                {activeShowGuides && (
                  <div className="mt-1.5 font-sans text-[11px] text-slate-400">
                    {OSI_PEDAGOGICAL_GUIDES.layer4.fields.flags}
                  </div>
                )}
              </div>

              <div
                data-testid="layer4-checksum"
                className="rounded-lg border border-slate-800 bg-slate-950 p-3"
              >
                <div className="text-slate-400">Checksum (`checksum`)</div>
                <div className="mt-1 text-sm font-bold text-blue-300">{l4.checksum ?? 'N/A'}</div>
                {activeShowGuides && (
                  <div className="mt-1.5 font-sans text-[11px] text-slate-400">
                    {OSI_PEDAGOGICAL_GUIDES.layer4.fields.checksum}
                  </div>
                )}
              </div>
            </div>
          )}
        </OsiLayerAccordionCard>

        {/* CAPA 7: APLICACIÓN Y VISOR HEX/ASCII */}
        <OsiLayerAccordionCard
          layerKey="layer7"
          isExpanded={activeExpanded.layer7}
          onToggle={handleToggleLayer}
          showPedagogicalGuides={activeShowGuides}
        >
          {l7 && (
            <HexAsciiPayloadViewer layer7={l7} showPedagogicalGuides={activeShowGuides} />
          )}
        </OsiLayerAccordionCard>
      </div>
    </div>
  );
};

export default OsiInspector;

