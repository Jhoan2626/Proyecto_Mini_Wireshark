import React from 'react';
import { OsiLayer7Application } from '../tests/Spec01CaptureTest';

export interface HexAsciiPayloadViewerProps {
  layer7: OsiLayer7Application;
  showPedagogicalGuides?: boolean;
}

/**
 * Componente 2.4: Visor Dual de Carga Útil (HexAsciiPayloadViewer)
 * Muestra lado a lado los pares hexadecimales en fuente monoespaciada y su traducción ASCII segura,
 * o un aviso informativo cuando payload_size === 0.
 */
export const HexAsciiPayloadViewer: React.FC<HexAsciiPayloadViewerProps> = ({
  layer7,
  showPedagogicalGuides = true,
}) => {
  return (
    <div className="space-y-3" data-testid="layer7-payload-container">
      {/* Metadatos de Capa 7: protocol_hint y payload_size */}
      <div className="flex flex-wrap items-center gap-3 font-mono text-xs">
        <span
          data-testid="layer7-protocol-hint"
          className="rounded border border-purple-500/30 bg-purple-500/20 px-2.5 py-1 font-bold text-purple-300"
        >
          Protocolo Inferido: {layer7.protocol_hint}
        </span>
        <span
          data-testid="layer7-payload-size"
          className="rounded border border-slate-700 bg-slate-800 px-2.5 py-1 text-slate-300"
        >
          Tamaño de Carga Útil: {layer7.payload_size} bytes
        </span>
      </div>

      {showPedagogicalGuides && (
        <div
          data-testid="pedagogical-guide-layer7-fields"
          className="rounded-lg border border-slate-800 bg-slate-950/80 px-3 py-2 font-sans text-[11px] text-slate-400"
        >
          <strong className="text-purple-300">Protocol Hint y Payload Size:</strong> Indica cómo los
          bytes crudos transportados representan comandos o estructuras de datos del protocolo de
          aplicación ({layer7.protocol_hint}) o tráfico cifrado en sesiones seguras (TLS/HTTPS).
        </div>
      )}

      {/* Visor Dual o Estado sin Payload */}
      {layer7.payload_size === 0 ? (
        <div
          data-testid="empty-payload-notice"
          className="rounded-lg border border-slate-800 bg-slate-950 p-4 text-xs text-slate-400"
        >
          Este paquete no transporta carga útil de aplicación (<code>payload_size = 0</code>). Sus
          funciones son exclusivamente de control en capas inferiores (solo contiene cabeceras de
          control sin carga útil de Capa 7).
        </div>
      ) : (
        <div
          data-testid="hex-ascii-viewer"
          className="grid grid-cols-1 gap-4 font-mono text-xs lg:grid-cols-2"
        >
          <div
            data-testid="hex-dump-panel"
            className="rounded-lg border border-slate-800 bg-slate-950 p-3"
          >
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase">
                Volcado Hexadecimal (`hex_dump`)
              </span>
              <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-300">
                Base 16 • font-mono
              </span>
            </div>
            <div
              data-testid="hex-dump-content"
              className="font-mono leading-relaxed break-words text-amber-300"
            >
              {layer7.hex_dump}
            </div>
          </div>

          <div
            data-testid="ascii-preview-panel"
            className="rounded-lg border border-slate-800 bg-slate-950 p-3"
          >
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase">
                Vista Previa ASCII Sanitizada (`ascii_preview`)
              </span>
              <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] text-emerald-300">
                ASCII Imprimible • font-mono
              </span>
            </div>
            <div
              data-testid="ascii-preview-content"
              className="font-mono leading-relaxed break-all text-emerald-300"
            >
              {layer7.ascii_preview}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HexAsciiPayloadViewer;

