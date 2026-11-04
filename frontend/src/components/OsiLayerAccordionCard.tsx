import React from 'react';
import { OSI_PEDAGOGICAL_GUIDES, OsiLayerKey } from './osiPedagogicalGuides';

export interface OsiLayerAccordionCardProps {
  layerKey: OsiLayerKey;
  isExpanded: boolean;
  onToggle: (layerKey: OsiLayerKey) => void;
  showPedagogicalGuides?: boolean;
  children: React.ReactNode;
}

interface LayerColorTheme {
  cardBorder: string;
  headerBg: string;
  badgeBg: string;
  titleText: string;
  pduText: string;
  toggleText: string;
  guideBox: string;
}

const LAYER_THEMES: Record<OsiLayerKey, LayerColorTheme> = {
  layer2: {
    cardBorder: 'border-amber-500/30',
    headerBg: 'bg-amber-500/10 hover:bg-amber-500/15',
    badgeBg: 'bg-amber-500 text-slate-950',
    titleText: 'text-amber-300',
    pduText: 'text-amber-200/70',
    toggleText: 'text-amber-300',
    guideBox: 'border-amber-500/20 bg-amber-950/20 text-amber-200',
  },
  layer3: {
    cardBorder: 'border-emerald-500/30',
    headerBg: 'bg-emerald-500/10 hover:bg-emerald-500/15',
    badgeBg: 'bg-emerald-500 text-slate-950',
    titleText: 'text-emerald-300',
    pduText: 'text-emerald-200/70',
    toggleText: 'text-emerald-300',
    guideBox: 'border-emerald-500/20 bg-emerald-950/20 text-emerald-200',
  },
  layer4: {
    cardBorder: 'border-blue-500/30',
    headerBg: 'bg-blue-500/10 hover:bg-blue-500/15',
    badgeBg: 'bg-blue-500 text-slate-950',
    titleText: 'text-blue-300',
    pduText: 'text-blue-200/70',
    toggleText: 'text-blue-300',
    guideBox: 'border-blue-500/20 bg-blue-950/20 text-blue-200',
  },
  layer7: {
    cardBorder: 'border-purple-500/30',
    headerBg: 'bg-purple-500/10 hover:bg-purple-500/15',
    badgeBg: 'bg-purple-500 text-slate-950',
    titleText: 'text-purple-300',
    pduText: 'text-purple-200/70',
    toggleText: 'text-purple-300',
    guideBox: 'border-purple-500/20 bg-purple-950/20 text-purple-200',
  },
};

/**
 * Componente 2.2: Tarjeta Desplegable por Capa con Código de Color (OsiLayerAccordionCard)
 */
export const OsiLayerAccordionCard: React.FC<OsiLayerAccordionCardProps> = ({
  layerKey,
  isExpanded,
  onToggle,
  showPedagogicalGuides = true,
  children,
}) => {
  const guide = OSI_PEDAGOGICAL_GUIDES[layerKey];
  const theme = LAYER_THEMES[layerKey];

  return (
    <div
      data-testid={`osi-layer-card-${layerKey}`}
      className={`overflow-hidden rounded-xl border ${theme.cardBorder} bg-slate-900/90 shadow`}
    >
      <button
        type="button"
        onClick={() => onToggle(layerKey)}
        aria-expanded={isExpanded}
        data-testid={`osi-layer-toggle-${layerKey}`}
        className={`flex w-full items-center justify-between px-4 py-3 text-left transition ${theme.headerBg}`}
      >
        <div className="flex flex-wrap items-center gap-3">
          <span className={`rounded px-2 py-0.5 text-xs font-black ${theme.badgeBg}`}>
            {guide.badge}
          </span>
          <span className={`font-bold ${theme.titleText}`}>{guide.title}</span>
          <span className={`text-xs ${theme.pduText}`}>PDU: {guide.pdu}</span>
        </div>
        <span className={`font-mono text-xs ${theme.toggleText}`}>
          {isExpanded ? '▼ Colapsar' : '▶ Expandir'}
        </span>
      </button>

      {isExpanded && (
        <div data-testid={`osi-layer-content-${layerKey}`} className="space-y-3 p-4">
          {showPedagogicalGuides && (
            <p
              data-testid={`pedagogical-role-${layerKey}`}
              className={`rounded-lg border p-2.5 text-xs ${theme.guideBox}`}
            >
              💡 <strong>Función en el Modelo OSI:</strong> {guide.role}{' '}
              {layerKey === 'layer7' ? guide.fields.payload : ''}
            </p>
          )}
          {children}
        </div>
      )}
    </div>
  );
};

export default OsiLayerAccordionCard;

