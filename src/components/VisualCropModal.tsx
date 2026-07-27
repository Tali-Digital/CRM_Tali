import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Crop, Check, X, RotateCcw, ZoomIn, ZoomOut, Move, Maximize } from 'lucide-react';

interface VisualCropModalProps {
  isOpen: boolean;
  imageUrl: string;
  initialZoom?: number;
  initialOffsetX?: number;
  initialOffsetY?: number;
  onClose: () => void;
  onSave: (zoom: number, offsetX: number, offsetY: number) => void;
}

export const VisualCropModal: React.FC<VisualCropModalProps> = ({
  isOpen,
  imageUrl,
  initialZoom = 1.25,
  initialOffsetX = 0,
  initialOffsetY = 0,
  onClose,
  onSave
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Quadro de recorte (em porcentagem 0-100 do container)
  // Exemplo: { x: 10, y: 10, w: 80, h: 80 }
  const [cropRect, setCropRect] = useState<{ x: number; y: number; w: number; h: number }>({
    x: 10,
    y: 10,
    w: 80,
    h: 80
  });

  const [activeAction, setActiveAction] = useState<'move' | 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'w' | 'e' | null>(null);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; rect: typeof cropRect }>({
    mouseX: 0,
    mouseY: 0,
    rect: { x: 10, y: 10, w: 80, h: 80 }
  });

  // Converte initialZoom e offsets de volta para rect inicial ao abrir
  useEffect(() => {
    if (isOpen) {
      const zoom = initialZoom || 1;
      const w = Math.max(20, Math.min(100, (1 / zoom) * 100));
      const h = w;
      const x = Math.max(0, Math.min(100 - w, 50 - (w / 2) - (initialOffsetX * (w / 100))));
      const y = Math.max(0, Math.min(100 - h, 50 - (h / 2) - (initialOffsetY * (h / 100))));
      setCropRect({ x, y, w, h });
    }
  }, [isOpen, initialZoom, initialOffsetX, initialOffsetY]);

  const handleMouseDown = (
    e: React.MouseEvent,
    action: 'move' | 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'w' | 'e'
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveAction(action);
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      rect: { ...cropRect }
    };
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!activeAction || !containerRef.current) return;

    const bounds = containerRef.current.getBoundingClientRect();
    const deltaXPercent = ((e.clientX - dragStartRef.current.mouseX) / bounds.width) * 100;
    const deltaYPercent = ((e.clientY - dragStartRef.current.mouseY) / bounds.height) * 100;
    const initial = dragStartRef.current.rect;

    let newX = initial.x;
    let newY = initial.y;
    let newW = initial.w;
    let newH = initial.h;

    const minSize = 15; // Tamanho mínimo do quadro em %

    if (activeAction === 'move') {
      newX = Math.max(0, Math.min(100 - initial.w, initial.x + deltaXPercent));
      newY = Math.max(0, Math.min(100 - initial.h, initial.y + deltaYPercent));
    } else {
      if (activeAction.includes('w')) {
        const proposedW = initial.w - deltaXPercent;
        if (proposedW >= minSize && initial.x + deltaXPercent >= 0) {
          newW = proposedW;
          newX = initial.x + deltaXPercent;
        }
      }
      if (activeAction.includes('e')) {
        const proposedW = initial.w + deltaXPercent;
        if (proposedW >= minSize && initial.x + proposedW <= 100) {
          newW = proposedW;
        }
      }
      if (activeAction.includes('n')) {
        const proposedH = initial.h - deltaYPercent;
        if (proposedH >= minSize && initial.y + deltaYPercent >= 0) {
          newH = proposedH;
          newY = initial.y + deltaYPercent;
        }
      }
      if (activeAction.includes('s')) {
        const proposedH = initial.h + deltaYPercent;
        if (proposedH >= minSize && initial.y + proposedH <= 100) {
          newH = proposedH;
        }
      }
    }

    setCropRect({ x: newX, y: newY, w: newW, h: newH });
  }, [activeAction]);

  const handleMouseUp = useCallback(() => {
    setActiveAction(null);
  }, []);

  useEffect(() => {
    if (activeAction) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [activeAction, handleMouseMove, handleMouseUp]);

  if (!isOpen) return null;

  // Calcula os valores de zoom e offset resultantes do quadro
  const finalZoom = Number((100 / Math.min(cropRect.w, cropRect.h)).toFixed(2));
  const centerX = cropRect.x + cropRect.w / 2;
  const centerY = cropRect.y + cropRect.h / 2;
  const finalOffsetX = Number(((50 - centerX) * (100 / cropRect.w)).toFixed(1));
  const finalOffsetY = Number(((50 - centerY) * (100 / cropRect.h)).toFixed(1));

  const handleApply = () => {
    onSave(finalZoom, finalOffsetX, finalOffsetY);
    onClose();
  };

  const handleReset = () => {
    setCropRect({ x: 0, y: 0, w: 100, h: 100 });
  };

  const handlePresetCropMargins = () => {
    setCropRect({ x: 12.5, y: 12.5, w: 75, h: 75 });
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in" onClick={onClose}>
      <div
        className="bg-[#0f111a] w-full max-w-4xl rounded-2xl border border-gray-700 shadow-2xl flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between bg-[#161926]">
          <div className="flex items-center gap-2">
            <Crop className="text-indigo-400" size={20} />
            <h3 className="text-lg font-black text-white">Recorte & Redimensionamento Visual</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-gray-800 transition-all">
            <X size={18} />
          </button>
        </div>

        {/* Instruções Rápidas */}
        <div className="bg-indigo-950/40 px-6 py-2 border-b border-indigo-800/30 text-xs text-indigo-200 flex items-center justify-between">
          <span>💡 <strong>Dica:</strong> Arraste os cantos ou bordas da caixa para redimensionar. Arraste o meio para reposicionar o corte.</span>
          <div className="flex items-center gap-2">
            <button onClick={handlePresetCropMargins} className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-2.5 py-1 rounded text-[11px] transition-all cursor-pointer">
              ✂️ Cortar Margens (25%)
            </button>
            <button onClick={handleReset} className="bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold px-2.5 py-1 rounded text-[11px] transition-all cursor-pointer">
              <RotateCcw size={11} className="inline mr-1" /> Resetar (100%)
            </button>
          </div>
        </div>

        {/* Área de Visualização e Edição com Canvas de Arraste */}
        <div className="p-6 flex-1 flex items-center justify-center bg-[#090a10]">
          <div
            ref={containerRef}
            className="relative select-none max-w-full max-h-[60vh] overflow-hidden rounded-xl border border-gray-800 shadow-2xl flex items-center justify-center"
            style={{ touchAction: 'none' }}
          >
            <img
              src={imageUrl}
              alt="Imagem para recortar"
              className="max-h-[60vh] w-auto object-contain pointer-events-none block"
            />

            {/* Mascara de fundo escuro para fora da seleção */}
            <div className="absolute inset-0 pointer-events-none" style={{
              background: `polygon(
                0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%,
                ${cropRect.x}% ${cropRect.y}%,
                ${cropRect.x}% ${cropRect.y + cropRect.h}%,
                ${cropRect.x + cropRect.w}% ${cropRect.y + cropRect.h}%,
                ${cropRect.x + cropRect.w}% ${cropRect.y}%,
                ${cropRect.x}% ${cropRect.y}%
              )`
            }}>
              <div className="absolute inset-0 bg-black/65" />
            </div>

            {/* Quadro de Recorte Interativo */}
            <div
              onMouseDown={e => handleMouseDown(e, 'move')}
              className="absolute border-2 border-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.5)] cursor-move group"
              style={{
                left: `${cropRect.x}%`,
                top: `${cropRect.y}%`,
                width: `${cropRect.w}%`,
                height: `${cropRect.h}%`
              }}
            >
              {/* Rótulo de dimensões */}
              <div className="absolute -top-7 left-0 bg-indigo-600 text-white text-[10px] font-black px-2 py-0.5 rounded shadow">
                {Math.round(finalZoom * 100)}% Zoom | Corte Ativo
              </div>

              {/* Linhas Guia da Regra dos Terços */}
              <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none opacity-40">
                <div className="border-r border-b border-indigo-300/40" />
                <div className="border-r border-b border-indigo-300/40" />
                <div className="border-b border-indigo-300/40" />
                <div className="border-r border-b border-indigo-300/40" />
                <div className="border-r border-b border-indigo-300/40" />
                <div className="border-b border-indigo-300/40" />
                <div className="border-r border-indigo-300/40" />
                <div className="border-r border-indigo-300/40" />
                <div />
              </div>

              {/* Hastes e Pontos de Redimensionamento (Handles nos Cantos e Bordas) */}
              {/* Cantos */}
              <div onMouseDown={e => handleMouseDown(e, 'nw')} className="absolute -left-2 -top-2 w-4 h-4 bg-white border-2 border-indigo-600 rounded-sm cursor-nwse-resize shadow-md hover:scale-125 transition-transform" />
              <div onMouseDown={e => handleMouseDown(e, 'ne')} className="absolute -right-2 -top-2 w-4 h-4 bg-white border-2 border-indigo-600 rounded-sm cursor-nesw-resize shadow-md hover:scale-125 transition-transform" />
              <div onMouseDown={e => handleMouseDown(e, 'sw')} className="absolute -left-2 -bottom-2 w-4 h-4 bg-white border-2 border-indigo-600 rounded-sm cursor-nesw-resize shadow-md hover:scale-125 transition-transform" />
              <div onMouseDown={e => handleMouseDown(e, 'se')} className="absolute -right-2 -bottom-2 w-4 h-4 bg-white border-2 border-indigo-600 rounded-sm cursor-nwse-resize shadow-md hover:scale-125 transition-transform" />

              {/* Bordas centralizadas */}
              <div onMouseDown={e => handleMouseDown(e, 'n')} className="absolute left-1/2 -top-2 -translate-x-1/2 w-6 h-3 bg-white border-2 border-indigo-600 rounded-sm cursor-ns-resize shadow-md hover:scale-125 transition-transform" />
              <div onMouseDown={e => handleMouseDown(e, 's')} className="absolute left-1/2 -bottom-2 -translate-x-1/2 w-6 h-3 bg-white border-2 border-indigo-600 rounded-sm cursor-ns-resize shadow-md hover:scale-125 transition-transform" />
              <div onMouseDown={e => handleMouseDown(e, 'w')} className="absolute -left-2 top-1/2 -translate-y-1/2 w-3 h-6 bg-white border-2 border-indigo-600 rounded-sm cursor-ew-resize shadow-md hover:scale-125 transition-transform" />
              <div onMouseDown={e => handleMouseDown(e, 'e')} className="absolute -right-2 top-1/2 -translate-y-1/2 w-3 h-6 bg-white border-2 border-indigo-600 rounded-sm cursor-ew-resize shadow-md hover:scale-125 transition-transform" />
            </div>
          </div>
        </div>

        {/* Rodapé com Botão Aplicar */}
        <div className="px-6 py-4 border-t border-gray-800 bg-[#161926] flex items-center justify-between">
          <div className="text-xs text-gray-400 font-mono">
            Zoom resultante: <strong className="text-white">{Math.round(finalZoom * 100)}%</strong> | Pos X: <strong className="text-white">{finalOffsetX}%</strong> | Pos Y: <strong className="text-white">{finalOffsetY}%</strong>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl font-bold text-xs transition-all cursor-pointer"
            >
              Cancelar
            </button>

            <button
              onClick={handleApply}
              className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs shadow-lg shadow-emerald-600/30 flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
            >
              <Check size={16} /> Aplicar Recorte Visual
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
