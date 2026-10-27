import React, { useState } from 'react';
import Spec01CaptureTest, { CapturedPacket } from './Spec01CaptureTest';
import Spec02ApiStreamTest from './Spec02ApiStreamTest';
import Spec03TrafficTableTest from './Spec03TrafficTableTest';
import Spec04OsiInspectorTest from './Spec04OsiInspectorTest';

// ============================================================================
// CONTENEDOR UNIFICADO DE CERTIFICACIÓN SDD (FASES 1 A 4 - MINI-WIRESHARK)
// ============================================================================

type SpecTabId = 'spec01' | 'spec02' | 'spec03' | 'spec04';

interface SpecTabMeta {
  id: SpecTabId;
  phase: string;
  owner: 'Persona 1 (Backend)' | 'Persona 2 (Frontend)';
  title: string;
  specFile: string;
}

const SPEC_TABS: SpecTabMeta[] = [
  {
    id: 'spec01',
    phase: 'Fase 1',
    owner: 'Persona 1 (Backend)',
    title: 'Motor Scapy & Contrato OSI',
    specFile: '/specs/01-motor-captura-osi.md',
  },
  {
    id: 'spec02',
    phase: 'Fase 2',
    owner: 'Persona 1 (Backend)',
    title: 'API Flask & Streaming',
    specFile: '/specs/02-api-flask-streaming.md',
  },
  {
    id: 'spec03',
    phase: 'Fase 3',
    owner: 'Persona 2 (Frontend)',
    title: 'Tabla de Tráfico & Filtros',
    specFile: '/specs/03-tabla-trafico-tiempo-real.md',
  },
  {
    id: 'spec04',
    phase: 'Fase 4',
    owner: 'Persona 2 (Frontend)',
    title: 'Inspector Visual Modelo OSI',
    specFile: '/specs/04-inspector-visual-osi.md',
  },
];

export const TestSuiteRunner: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SpecTabId>('spec01');
  const [sharedSelectedPacket, setSharedSelectedPacket] = useState<CapturedPacket | null>(null);

  // Estado de cumplimiento certificado por cada arnés de pruebas
  const [phaseCompliance, setPhaseCompliance] = useState<Record<SpecTabId, boolean>>({
    spec01: true,
    spec02: false,
    spec03: false,
    spec04: false,
  });

  const updatePhaseStatus = (tabId: SpecTabId, passed: boolean) => {
    setPhaseCompliance((prev) => {
      if (prev[tabId] === passed) return prev;
      return { ...prev, [tabId]: passed };
    });
  };

  const completedPhasesCount = Object.values(phaseCompliance).filter(Boolean).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Cabecera Global del Suite Runner SDD */}
        <header className="rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 p-6 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-blue-600 px-2.5 py-0.5 text-xs font-black uppercase tracking-wider text-white">
                  SDD Test Suite Runner
                </span>
                <span className="text-xs font-mono text-slate-400">
                  /PROJECT_CONTEXT.md • Modelo OSI (Capas 2, 3, 4, 7)
                </span>
              </div>
              <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                Mini-Wireshark — Centro de Certificación por Especificaciones
              </h1>
              <p className="mt-1 text-sm text-slate-400">
                Entorno maestro para validar secuencialmente los entregables de la{' '}
                <strong className="text-amber-300">Persona 1 (Backend Python/Scapy/Flask)</strong> y
                la <strong className="text-blue-300">Persona 2 (Frontend React/Tailwind)</strong>.
              </p>
            </div>

            {/* Indicador Global de Progreso SDD */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/90 px-5 py-3 text-right">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Cumplimiento Global SDD
              </div>
              <div className="mt-1 flex items-baseline justify-end gap-2">
                <span className="text-2xl font-black text-emerald-400">
                  {completedPhasesCount} / 4
                </span>
                <span className="text-xs text-slate-400">Fases Certificadas</span>
              </div>
            </div>
          </div>

          {/* Barra de Navegación por Pestañas (Tabs) */}
          <nav className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {SPEC_TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              const isPassed = phaseCompliance[tab.id];
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex flex-col justify-between rounded-xl border p-3.5 text-left transition ${
                    isActive
                      ? 'border-blue-500 bg-blue-950/30 shadow-lg ring-1 ring-blue-500/50'
                      : 'border-slate-800 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-900'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs font-bold uppercase tracking-wider text-blue-400">
                      {tab.phase} • {tab.owner}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                        isPassed
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                      }`}
                    >
                      {isPassed ? '✓ READY' : 'EN PRUEBA'}
                    </span>
                  </div>

                  <div className="mt-2 text-sm font-bold text-white">{tab.title}</div>
                  <div className="mt-1 font-mono text-[11px] text-slate-400">{tab.specFile}</div>
                </button>
              );
            })}
          </nav>
        </header>

        {/* Contenedor Activo del Entorno de Prueba Seleccionado */}
        <main>
          {activeTab === 'spec01' && (
            <Spec01CaptureTest
              onValidationChange={(passed) => updatePhaseStatus('spec01', passed)}
            />
          )}

          {activeTab === 'spec02' && (
            <Spec02ApiStreamTest
              onValidationChange={(passed) => updatePhaseStatus('spec02', passed)}
            />
          )}

          {activeTab === 'spec03' && (
            <Spec03TrafficTableTest
              onValidationChange={(passed) => updatePhaseStatus('spec03', passed)}
              onPacketSelectedForInspection={(pkt) => {
                setSharedSelectedPacket(pkt);
              }}
            />
          )}

          {activeTab === 'spec04' && (
            <Spec04OsiInspectorTest
              onValidationChange={(passed) => updatePhaseStatus('spec04', passed)}
              externalPacket={sharedSelectedPacket}
            />
          )}
        </main>
      </div>
    </div>
  );
};

export default TestSuiteRunner;

