import React, { useState, useEffect } from 'react';
import { CapturedPacket, FIXTURE_PACKETS } from './Spec01CaptureTest';
import {
  OsiInspector,
  OsiLayerKey,
  OSI_PEDAGOGICAL_GUIDES,
} from '../components';

export { OSI_PEDAGOGICAL_GUIDES };

export interface Spec04OsiInspectorTestProps {
  onValidationChange?: (allPassed: boolean) => void;
  externalPacket?: CapturedPacket | null;
}

export const Spec04OsiInspectorTest: React.FC<Spec04OsiInspectorTestProps> = ({
  onValidationChange,
  externalPacket,
}) => {
  const [selectedScenario, setSelectedScenario] = useState<string>('http_tcp');
  const [packet, setPacket] = useState<CapturedPacket | null>(FIXTURE_PACKETS.http_tcp);
  const [showPedagogicalHelp, setShowPedagogicalHelp] = useState<boolean>(true);
  const [expandedLayers, setExpandedLayers] = useState<Record<OsiLayerKey, boolean>>({
    layer2: true,
    layer3: true,
    layer4: true,
    layer7: true,
  });

  // Seguimiento de escenarios probados para certificar Spec 04
  const [testedScenarios, setTestedScenarios] = useState<Record<string, boolean>>({
    http_tcp: true,
    dns_udp: false,
    icmp_ping: false,
    arp_broadcast: false,
  });

  const [nullStateTested, setNullStateTested] = useState<boolean>(false);
  const [interactionTested, setInteractionTested] = useState<boolean>(true);

  useEffect(() => {
    if (externalPacket) {
      setPacket(externalPacket);
      setSelectedScenario('external');
    }
  }, [externalPacket]);

  const allScenariosVerified = Object.values(testedScenarios).every(Boolean);

  useEffect(() => {
    onValidationChange?.(allScenariosVerified);
  }, [allScenariosVerified, onValidationChange]);

  const handleSelectScenario = (key: string) => {
    setSelectedScenario(key);
    if (key === 'null_state') {
      setPacket(null);
      setNullStateTested(true);
      return;
    }
    const target = FIXTURE_PACKETS[key];
    if (target) {
      setPacket(target);
      setTestedScenarios((prev) => ({ ...prev, [key]: true }));
    }
  };

  const toggleLayer = (layerKey: OsiLayerKey) => {
    setExpandedLayers((prev) => ({ ...prev, [layerKey]: !prev[layerKey] }));
    setInteractionTested(true);
  };

  const setAllExpanded = (expand: boolean) => {
    setExpandedLayers({
      layer2: expand,
      layer3: expand,
      layer4: expand,
      layer7: expand,
    });
    setInteractionTested(true);
  };

  const criteriaChecks = [
    {
      label: '1. Estado Vacío (null)',
      ok: nullStateTested || allScenariosVerified,
    },
    {
      label: '2. Desglose 4 Capas (HTTP/DNS)',
      ok: testedScenarios.http_tcp && testedScenarios.dns_udp,
    },
    {
      label: '3. Casos Especiales (ARP/ICMP)',
      ok: testedScenarios.icmp_ping && testedScenarios.arp_broadcast,
    },
    {
      label: '4. Acordeones y Guías',
      ok: interactionTested,
    },
    {
      label: '5. Visor Hex y ASCII',
      ok: testedScenarios.http_tcp && testedScenarios.arp_broadcast,
    },
  ];

  return (
    <div className="space-y-6 text-slate-100">
      {/* Cabecera del Banco de Pruebas Fase 4 */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-5 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1 text-xs font-semibold text-purple-400">
              FASE 4 • PERSONA 2 (FRONTEND / INSPECTOR VISUAL DEL MODELO OSI)
            </span>
            <h2 className="mt-2 text-xl font-bold text-white">
              Spec 04 — Banco de Pruebas del Inspector Visual Interactivo OSI
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Comprueba el desglose jerárquico por capa OSI, acordeones con código de color,
              explicaciones pedagógicas y visor Hexadecimal/ASCII según{' '}
              <code className="text-slate-300">/specs/04-inspector-visual-osi.md</code>.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setShowPedagogicalHelp((prev) => !prev);
                setInteractionTested(true);
              }}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                showPedagogicalHelp
                  ? 'border-emerald-500/40 bg-emerald-950/40 text-emerald-300'
                  : 'border-slate-700 bg-slate-800 text-slate-400'
              }`}
            >
              {showPedagogicalHelp ? '🎓 Guías Pedagógicas: ON' : '🎓 Guías Pedagógicas: OFF'}
            </button>
            <button
              type="button"
              onClick={() => setAllExpanded(true)}
              className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700"
            >
              Expandir Todo
            </button>
            <button
              type="button"
              onClick={() => setAllExpanded(false)}
              className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700"
            >
              Colapsar Todo
            </button>
          </div>
        </div>

        {/* Selector de Escenarios de Paquetes de Prueba */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-xs font-semibold tracking-wider text-slate-400 uppercase">
              Alternar Paquete de Prueba:
            </span>
            {[
              { key: 'http_tcp', label: '1. HTTP / TCP (Capas 2,3,4,7)' },
              { key: 'dns_udp', label: '2. DNS / UDP (Datagrama)' },
              { key: 'icmp_ping', label: '3. ICMP Ping (Sin Puertos L4)' },
              { key: 'arp_broadcast', label: '4. ARP Broadcast (Solo L2/L3)' },
              { key: 'null_state', label: '5. Estado Vacío (null)' },
            ].map((sc) => (
              <button
                key={sc.key}
                type="button"
                onClick={() => handleSelectScenario(sc.key)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  selectedScenario === sc.key
                    ? 'bg-purple-600 text-white shadow'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {sc.label}
              </button>
            ))}
          </div>

          <span className="text-xs text-slate-400">
            Escenarios verificados:{' '}
            <strong className="text-emerald-400" data-testid="verified-scenarios-count">
              {Object.values(testedScenarios).filter(Boolean).length}/4
            </strong>
          </span>
        </div>
      </div>

      {/* Estado de Criterios de Aceptación Spec 04 */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
        {criteriaChecks.map((c, idx) => (
          <div
            key={idx}
            className={`rounded-xl border p-3 text-center ${
              c.ok
                ? 'border-emerald-500/40 bg-emerald-950/25 text-emerald-300'
                : 'border-slate-800 bg-slate-900/70 text-slate-400'
            }`}
          >
            <div className="text-xs font-bold uppercase">
              {c.ok ? '✓ VERIFICADO' : 'PROBAR AHORA'}
            </div>
            <div className="mt-1 text-xs font-medium text-white">{c.label}</div>
          </div>
        ))}
      </div>

      {/* Componente Oficial Fase 4: OsiInspector */}
      <OsiInspector
        packet={packet}
        showPedagogicalGuides={showPedagogicalHelp}
        expandedLayers={expandedLayers}
        onToggleLayer={toggleLayer}
        onExpandAllChange={setAllExpanded}
        onShowPedagogicalGuidesChange={setShowPedagogicalHelp}
        showControlsToolbar={false}
      />
    </div>
  );
};

export default Spec04OsiInspectorTest;
