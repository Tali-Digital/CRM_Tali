import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Crop, Check, X, RotateCcw, ZoomIn, Move, Sparkles } from 'lucide-react';

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
  // Estado do Zoom (1.0 = 100%, 3.0 = 300%)
  const [zoom, setZoom] = useState<number>(initialZoom);

  // Offset X e Y em porcentagem (-50 a 50)
  const [offsetX, setOffsetX] = useState<number>(initialOffsetX);
  const [offsetY, setOffsetY] = useState<number>(initialOffsetY);

  // Sincroniza ao abrir
  useEffect(() => {
    if (isOpen) {
      setZoom(initialZoom || 1.25);
      setOffsetX(initialOffsetX || 0);
      setOffsetY(initialOffsetY || 0);
    }
  }, [isOpen, initialZoom, initialOffsetX, initialOffsetY]);

  // Controles de Arraste (Pan & Scale)
  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const isScalingRef = useRef(false);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; startX: number; startY: number; startZoom: number }>({
    mouseX: 0,
    mouseY: 0,
    startX: 0,
    startY: 0,
    startZoom: 1
  });

  // ── Arrastar a Foto (Pan) ──
  const handleMouseDownImage = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isDraggingRef.current = true;
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: offsetX,
      startY: offsetY,
      startZoom: zoom
    };
  };

  // ── Arrastar Cantos para Redimensionar / Zoom (Estilo Canva) ──
  const handleMouseDownCorner = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isScalingRef.current = true;
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: offsetX,
      startY: offsetY,
      startZoom: zoom
    };
  };

  const handleGlobalMouseMove = useCallback((e: MouseEvent) => {
    if (!isOpen) return;

    if (isDraggingRef.current && containerRef.current) {
      const bounds = containerRef.current.getBoundingClientRect();
      const dxPercent = ((e.clientX - dragStartRef.current.mouseX) / bounds.width) * 100;
      const dyPercent = ((e.clientY - dragStartRef.current.mouseY) / bounds.height) * 100;

      // Limita deslocamento para não sumir com a imagem
      const maxOffset = 50;
      const newX = Math.max(-maxOffset, Math.min(maxOffset, dragStartRef.current.startX + dxPercent));
      const newY = Math.max(-maxOffset, Math.min(maxOffset, dragStartRef.current.startY + dyPercent));

      setOffsetX(Number(newX.toFixed(1)));
      setOffsetY(Number(newY.toFixed(1)));
    } else if (isScalingRef.current) {
      const dx = e.clientX - dragStartRef.current.mouseX;
      const dy = e.clientY - dragStartRef.current.mouseY;
      const dist = (dx + dy) / 2; // movimento diagonal
      const deltaZoom = dist / 150;
      const newZoom = Math.max(1.0, Math.min(3.5, dragStartRef.current.startZoom + deltaZoom));
      setZoom(Number(newZoom.toFixed(2)));
    }
  }, [isOpen]);

  const handleGlobalMouseUp = useCallback(() => {
    isDraggingRef.current = false;
    isScalingRef.current = false;
  }, []);

  useEffect(() => {
    if (isOpen) {
      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('mouseup', handleGlobalMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleGlobalMouseMove);
        window.removeEventListener('mouseup', handleGlobalMouseUp);
      };
    }
  }, [isOpen, handleGlobalMouseMove, handleGlobalMouseUp]);

  // ── Aplicar ──
  const handleApply = () => {
    onSave(zoom, offsetX, offsetY);
    onClose();
  };

  // ── Atalhos de Presets ──
  const handlePresetMargins = () => {
    setZoom(1.35);
    setOffsetX(0);
    setOffsetY(0);
  };

  const handlePresetZoom = () => {
    setZoom(1.6);
    setOffsetX(0);
    setOffsetY(0);
  };

  const handlePresetReset = () => {
    setZoom(1.0);
    setOffsetX(0);
    setOffsetY(0);
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[99999] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#0b0d17] border-2 border-indigo-500/80 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Cabeçalho da Janela Estilo Canva */}
        <div className="px-6 py-4 border-b border-gray-800 bg-[#121524] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600/20 text-indigo-400 rounded-xl border border-indigo-500/30">
              <Crop size={20} />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-white flex items-center gap-2">
                Editor de Recorte Canva Interativo
              </h3>
              <p className="text-xs text-gray-400">
                Clique e arraste a imagem para enquadrar | Arraste os cantos <span className="text-indigo-400">○</span> para dar zoom
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-xl transition-all cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Barra de Ações Rápidas & Zoom */}
        <div className="px-6 py-3 bg-[#171a2c] border-b border-gray-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-gray-400 font-bold">Atalhos de Recorte:</span>
            <button
              type="button"
              onClick={handlePresetMargins}
              className={`px-3 py-1.5 rounded-lg font-bold border transition-all cursor-pointer ${zoom === 1.35 ? 'bg-indigo-600 text-white border-indigo-400 shadow-md' : 'bg-gray-800/80 text-gray-300 hover:text-white border-gray-700'}`}
            >
              ✂️ Cortar Margens (135%)
            </button>
            <button
              type="button"
              onClick={handlePresetZoom}
              className={`px-3 py-1.5 rounded-lg font-bold border transition-all cursor-pointer ${zoom === 1.6 ? 'bg-indigo-600 text-white border-indigo-400 shadow-md' : 'bg-gray-800/80 text-gray-300 hover:text-white border-gray-700'}`}
            >
              🔎 Zoom Central (160%)
            </button>
            <button
              type="button"
              onClick={handlePresetReset}
              className="px-3 py-1.5 rounded-lg font-bold bg-gray-800 text-gray-300 hover:text-white border border-gray-700 transition-all cursor-pointer flex items-center gap-1"
            >
              <RotateCcw size={12} /> Resetar (100%)
            </button>
          </div>

          {/* Controle de Slider de Zoom */}
          <div className="flex items-center gap-2 bg-gray-900/90 px-3 py-1.5 rounded-xl border border-gray-800">
            <ZoomIn size={14} className="text-indigo-400" />
            <span className="font-bold text-gray-300 w-16">Zoom ({Math.round(zoom * 100)}%):</span>
            <input
              type="range"
              min="1.0"
              max="3.0"
              step="0.05"
              value={zoom}
              onChange={e => setZoom(parseFloat(e.target.value))}
              className="w-28 accent-indigo-500 cursor-pointer"
            />
          </div>
        </div>

        {/* ÁREA CANVA INTERATIVA (MOLDURA + FOTO ARRASTÁVEL) */}
        <div className="p-6 flex-1 overflow-auto flex items-center justify-center bg-[#05060b]">
          <div
            ref={containerRef}
            className="relative w-full max-w-2xl h-[400px] bg-black/90 rounded-2xl overflow-hidden border-2 border-indigo-500/90 shadow-[0_0_30px_rgba(99,102,241,0.25)] select-none cursor-grab active:cursor-grabbing"
            onMouseDown={handleMouseDownImage}
          >
            {/* Foto Dinâmica com Transformação Estilo Canva */}
            <img
              src={imageUrl}
              alt="Recorte Canva"
              style={{
                transform: `scale(${zoom}) translate(${offsetX}%, ${offsetY}%)`,
                transition: isDraggingRef.current || isScalingRef.current ? 'none' : 'transform 0.1s ease-out',
                pointerEvents: 'none'
              }}
              className="w-full h-full object-contain rounded-2xl select-none"
            />

            {/* Guia Visual do Canva (Linhas de Terços) */}
            <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none opacity-25">
              <div className="border-r border-b border-white" />
              <div className="border-r border-b border-white" />
              <div className="border-b border-white" />
              <div className="border-r border-b border-white" />
              <div className="border-r border-b border-white" />
              <div className="border-b border-white" />
              <div className="border-r border-white" />
              <div className="border-r border-white" />
              <div />
            </div>

            {/* Rótulo Flutuante com Instruções */}
            <div className="absolute top-4 left-4 bg-black/80 backdrop-blur-md text-indigo-300 px-3 py-1.5 rounded-xl text-xs font-bold border border-indigo-500/40 flex items-center gap-2 pointer-events-none shadow-lg">
              <Move size={14} /> Clique e arraste para posicionar a foto
            </div>

            {/* HASTES DE CANTO ESTILO CANVA (CIRCULOS ○ DE ESCALA NAS 4 QUINAS) */}
            {/* Canto NW */}
            <div
              onMouseDown={handleMouseDownCorner}
              className="absolute -left-2.5 -top-2.5 w-5 h-5 bg-white border-2 border-indigo-600 rounded-full cursor-nwse-resize shadow-xl pointer-events-auto hover:scale-125 transition-transform flex items-center justify-center"
              title="Arraste para dar Zoom (Escala)"
            >
              <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full" />
            </div>

            {/* Canto NE */}
            <div
              onMouseDown={handleMouseDownCorner}
              className="absolute -right-2.5 -top-2.5 w-5 h-5 bg-white border-2 border-indigo-600 rounded-full cursor-nesw-resize shadow-xl pointer-events-auto hover:scale-125 transition-transform flex items-center justify-center"
              title="Arraste para dar Zoom (Escala)"
            >
              <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full" />
            </div>

            {/* Canto SW */}
            <div
              onMouseDown={handleMouseDownCorner}
              className="absolute -left-2.5 -bottom-2.5 w-5 h-5 bg-white border-2 border-indigo-600 rounded-full cursor-nesw-resize shadow-xl pointer-events-auto hover:scale-125 transition-transform flex items-center justify-center"
              title="Arraste para dar Zoom (Escala)"
            >
              <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full" />
            </div>

            {/* Canto SE */}
            <div
              onMouseDown={handleMouseDownCorner}
              className="absolute -right-2.5 -bottom-2.5 w-5 h-5 bg-white border-2 border-indigo-600 rounded-full cursor-nwse-resize shadow-xl pointer-events-auto hover:scale-125 transition-transform flex items-center justify-center"
              title="Arraste para dar Zoom (Escala)"
            >
              <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full" />
            </div>
          </div>
        </div>

        {/* Rodapé com Botão Salvar */}
        <div className="px-6 py-4 border-t border-gray-800 bg-[#121524] flex items-center justify-between">
          <div className="text-xs text-gray-400 font-mono">
            Zoom: <strong className="text-white">{Math.round(zoom * 100)}%</strong> | Pos X: <strong className="text-white">{offsetX}%</strong> | Pos Y: <strong className="text-white">{offsetY}%</strong>
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
              className="px-6 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl font-bold text-xs shadow-lg shadow-emerald-600/30 flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
            >
              <Check size={16} /> Aplicar Enquadramento Canva
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
