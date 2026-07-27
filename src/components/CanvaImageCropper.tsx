import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Check, RotateCcw, ZoomIn, ZoomOut, Move, Crop, X } from 'lucide-react';

export interface CanvaCropData {
  scale: number;       // Factor de zoom (1.0 = 100%, 1.5 = 150%, etc.)
  positionX: number;   // Deslocamento X da imagem em px
  positionY: number;   // Deslocamento Y da imagem em px
  cropWidth?: number;  // Largura da moldura em % (opcional)
  cropHeight?: number; // Altura da moldura em % (opcional)
}

interface CanvaImageCropperProps {
  src: string;
  alt?: string;
  className?: string;
  initialData?: CanvaCropData;
  onSave?: (data: CanvaCropData) => void;
  aspectRatio?: number; // opcional
  editable?: boolean;   // se permite dar duplo clique para editar
}

export const CanvaImageCropper: React.FC<CanvaImageCropperProps> = ({
  src,
  alt = 'Imagem',
  className = '',
  initialData,
  onSave,
  editable = true
}) => {
  const [isEditing, setIsEditing] = useState(false);

  // Dados do recorte estilo Canva
  const [scale, setScale] = useState<number>(initialData?.scale ?? 1.25);
  const [posX, setPosX] = useState<number>(initialData?.positionX ?? 0);
  const [posY, setPosY] = useState<number>(initialData?.positionY ?? 0);
  const [cropW, setCropW] = useState<number>(initialData?.cropWidth ?? 100);
  const [cropH, setCropH] = useState<number>(initialData?.cropHeight ?? 100);

  // Atualiza estado interno se initialData mudar
  useEffect(() => {
    if (initialData) {
      setScale(initialData.scale ?? 1.25);
      setPosX(initialData.positionX ?? 0);
      setPosY(initialData.positionY ?? 0);
      setCropW(initialData.cropWidth ?? 100);
      setCropH(initialData.cropHeight ?? 100);
    }
  }, [initialData]);

  // Refs de controle de arraste
  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const isScalingRef = useRef(false);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; startX: number; startY: number; startScale: number }>({
    mouseX: 0,
    mouseY: 0,
    startX: 0,
    startY: 0,
    startScale: 1
  });

  // ── Iniciar Pan (arrastar foto) ──
  const handleMouseDownImage = (e: React.MouseEvent) => {
    if (!isEditing) return;
    e.preventDefault();
    e.stopPropagation();
    isDraggingRef.current = true;
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: posX,
      startY: posY,
      startScale: scale
    };
  };

  // ── Iniciar Redimensionamento por Canto (Scale) ──
  const handleMouseDownCorner = (e: React.MouseEvent) => {
    if (!isEditing) return;
    e.preventDefault();
    e.stopPropagation();
    isScalingRef.current = true;
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: posX,
      startY: posY,
      startScale: scale
    };
  };

  // ── Event Listener Global de MouseMove ──
  const handleGlobalMouseMove = useCallback((e: MouseEvent) => {
    if (!isEditing) return;

    if (isDraggingRef.current) {
      const dx = e.clientX - dragStartRef.current.mouseX;
      const dy = e.clientY - dragStartRef.current.mouseY;
      setPosX(dragStartRef.current.startX + dx);
      setPosY(dragStartRef.current.startY + dy);
    } else if (isScalingRef.current) {
      const dx = e.clientX - dragStartRef.current.mouseX;
      const dy = e.clientY - dragStartRef.current.mouseY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const deltaSign = (dx + dy) > 0 ? 1 : -1;
      const newScale = Math.max(1.0, Math.min(3.5, dragStartRef.current.startScale + (deltaSign * (dist / 200))));
      setScale(Number(newScale.toFixed(2)));
    }
  }, [isEditing]);

  const handleGlobalMouseUp = useCallback(() => {
    isDraggingRef.current = false;
    isScalingRef.current = false;
  }, []);

  useEffect(() => {
    if (isEditing) {
      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('mouseup', handleGlobalMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleGlobalMouseMove);
        window.removeEventListener('mouseup', handleGlobalMouseUp);
      };
    }
  }, [isEditing, handleGlobalMouseMove, handleGlobalMouseUp]);

  // ── Confirmar Recorte ──
  const handleConfirm = () => {
    setIsEditing(false);
    if (onSave) {
      onSave({
        scale,
        positionX: posX,
        positionY: posY,
        cropWidth: cropW,
        cropHeight: cropH
      });
    }
  };

  // ── Resetar ──
  const handleReset = () => {
    setScale(1.0);
    setPosX(0);
    setPosY(0);
    setCropW(100);
    setCropH(100);
  };

  // ── Atalho Cortar Margens ──
  const handleCropMargins = () => {
    setScale(1.35);
    setPosX(0);
    setPosY(0);
  };

  return (
    <div className="relative inline-block group" ref={containerRef}>
      {/* Visualização Normal (Modo de Exibição) */}
      {!isEditing ? (
        <div
          onDoubleClick={() => editable && setIsEditing(true)}
          className={`overflow-hidden relative cursor-pointer group ${className}`}
          style={{
            width: `${cropW}%`,
            height: `${cropH}%`,
            maxWidth: '100%'
          }}
          title={editable ? "Duplo clique para editar/recortar estilo Canva" : undefined}
        >
          <img
            src={src}
            alt={alt}
            style={{
              transform: `scale(${scale}) translate(${posX}px, ${posY}px)`,
              transition: 'transform 0.15s ease-out',
              maxWidth: '100%',
              display: 'block'
            }}
            className="w-full h-full object-cover rounded-xl"
          />

          {editable && (
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl backdrop-blur-[2px]">
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-3 py-1.5 rounded-lg shadow-lg flex items-center gap-1.5 transition-all transform hover:scale-105"
              >
                <Crop size={14} /> Recortar (Estilo Canva)
              </button>
            </div>
          )}
        </div>
      ) : (
        /* MODO DE RECORTE INTERATIVO ESTILO CANVA */
        <div className="relative z-[9999] bg-[#0b0d17] p-4 rounded-2xl border-2 border-indigo-500 shadow-2xl overflow-hidden max-w-2xl">
          
          {/* Barra de Ferramentas Estilo Canva Superior */}
          <div className="flex items-center justify-between gap-3 mb-3 bg-[#151828] p-2.5 rounded-xl border border-gray-800 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-indigo-400 font-black flex items-center gap-1">
                <Crop size={14} /> Modo Recorte Canva
              </span>
              <span className="text-gray-400 text-[11px] hidden sm:inline">
                (Arraste a foto para mover | Arraste os cantos para dar zoom)
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCropMargins}
                className="bg-indigo-950 hover:bg-indigo-900 text-indigo-300 border border-indigo-700/50 px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all"
                title="Corta 25% de margem branca inútil"
              >
                ✂️ Cortar Margens
              </button>

              <button
                type="button"
                onClick={handleReset}
                className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all"
              >
                <RotateCcw size={12} className="inline mr-1" /> Resetar
              </button>

              <button
                type="button"
                onClick={handleConfirm}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-1 rounded-lg font-bold text-xs shadow-md flex items-center gap-1 transition-all"
              >
                <Check size={14} /> Pronto
              </button>
            </div>
          </div>

          {/* Slider de Zoom Rápido */}
          <div className="flex items-center justify-between gap-3 px-2 mb-3 text-xs text-gray-300">
            <span className="font-bold flex items-center gap-1">
              <ZoomIn size={13} className="text-indigo-400" /> Zoom da Imagem ({Math.round(scale * 100)}%):
            </span>
            <input
              type="range"
              min="1.0"
              max="3.0"
              step="0.05"
              value={scale}
              onChange={e => setScale(parseFloat(e.target.value))}
              className="w-48 accent-indigo-500 cursor-pointer"
            />
          </div>

          {/* Canvas Interativo de Edição */}
          <div
            className="relative overflow-hidden rounded-xl bg-black/80 flex items-center justify-center border-2 border-dashed border-indigo-400/80 cursor-grab active:cursor-grabbing select-none h-[380px]"
            onMouseDown={handleMouseDownImage}
          >
            {/* Foto com Translação e Escala Dinâmicas */}
            <img
              src={src}
              alt={alt}
              style={{
                transform: `scale(${scale}) translate(${posX}px, ${posY}px)`,
                cursor: 'grab',
                userSelect: 'none',
                pointerEvents: 'none'
              }}
              className="max-h-full w-auto object-contain transition-none"
            />

            {/* Guia Central de Arraste (Instrução) */}
            <div className="absolute top-3 left-3 bg-black/70 text-indigo-200 px-2.5 py-1 rounded-lg text-[10px] font-bold border border-indigo-500/30 backdrop-blur pointer-events-none flex items-center gap-1">
              <Move size={11} /> Arraste para mover a imagem
            </div>

            {/* Moldura e Hastes estilo Canva nos Cantos */}
            <div className="absolute inset-0 border-2 border-indigo-500 pointer-events-none">
              {/* Canto NW */}
              <div
                onMouseDown={handleMouseDownCorner}
                className="absolute -left-2 -top-2 w-4 h-4 bg-white border-2 border-indigo-600 rounded-full cursor-nwse-resize shadow-lg pointer-events-auto hover:scale-125 transition-transform"
              />
              {/* Canto NE */}
              <div
                onMouseDown={handleMouseDownCorner}
                className="absolute -right-2 -top-2 w-4 h-4 bg-white border-2 border-indigo-600 rounded-full cursor-nesw-resize shadow-lg pointer-events-auto hover:scale-125 transition-transform"
              />
              {/* Canto SW */}
              <div
                onMouseDown={handleMouseDownCorner}
                className="absolute -left-2 -bottom-2 w-4 h-4 bg-white border-2 border-indigo-600 rounded-full cursor-nesw-resize shadow-lg pointer-events-auto hover:scale-125 transition-transform"
              />
              {/* Canto SE */}
              <div
                onMouseDown={handleMouseDownCorner}
                className="absolute -right-2 -bottom-2 w-4 h-4 bg-white border-2 border-indigo-600 rounded-full cursor-nwse-resize shadow-lg pointer-events-auto hover:scale-125 transition-transform"
              />
            </div>
          </div>

          {/* Footer do Editor */}
          <div className="mt-3 flex items-center justify-between text-[11px] text-gray-400">
            <span>Clique em <strong>"Pronto"</strong> para salvar o enquadramento.</span>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="text-gray-400 hover:text-white underline cursor-pointer"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
