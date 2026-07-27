import React, { useState, useEffect, useRef } from 'react';
import { Trash2, AlignLeft, AlignCenter, AlignRight, ZoomIn, ZoomOut, Scissors, RotateCcw } from 'lucide-react';

interface InlineImageCropperOverlayProps {
  targetImage: HTMLImageElement | null;
  editorContainer: HTMLElement | null;
  onUpdate: () => void;
  onDeselect: () => void;
}

export const InlineImageCropperOverlay: React.FC<InlineImageCropperOverlayProps> = ({
  targetImage,
  editorContainer,
  onUpdate,
  onDeselect
}) => {
  const [rect, setRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const isDraggingHandle = useRef<string | null>(null);
  const startDragPos = useRef<{ x: number; y: number; width: number; height: number }>({
    x: 0, y: 0, width: 0, height: 0
  });

  // Atualiza posição da caixa ao selecionar ou dar scroll
  const updateRect = () => {
    if (!targetImage || !editorContainer) {
      setRect(null);
      return;
    }
    const imgBounds = targetImage.getBoundingClientRect();
    const containerBounds = editorContainer.getBoundingClientRect();

    setRect({
      top: imgBounds.top - containerBounds.top + editorContainer.scrollTop,
      left: imgBounds.left - containerBounds.left + editorContainer.scrollLeft,
      width: imgBounds.width,
      height: imgBounds.height
    });
  };

  useEffect(() => {
    updateRect();
    if (!editorContainer) return;
    editorContainer.addEventListener('scroll', updateRect);
    window.addEventListener('resize', updateRect);
    return () => {
      editorContainer.removeEventListener('scroll', updateRect);
      window.removeEventListener('resize', updateRect);
    };
  }, [targetImage, editorContainer]);

  if (!targetImage || !rect) return null;

  // ── Alinhamento ──
  const setAlignment = (align: 'left' | 'center' | 'right') => {
    targetImage.style.display = 'block';
    if (align === 'center') {
      targetImage.style.margin = '12px auto';
    } else if (align === 'right') {
      targetImage.style.margin = '12px 0 12px auto';
    } else {
      targetImage.style.margin = '12px auto 12px 0';
    }
    updateRect();
    onUpdate();
  };

  // ── Redimensionamento Direto de Largura ──
  const changeSize = (delta: number) => {
    const currentW = targetImage.clientWidth || 300;
    const newW = Math.max(100, Math.min(800, currentW + delta));
    targetImage.style.width = `${newW}px`;
    targetImage.style.height = 'auto';
    updateRect();
    onUpdate();
  };

  // ── Recorte de Margens (Crop In-Place) ──
  const cropMargins = () => {
    targetImage.style.objectFit = 'cover';
    targetImage.style.objectPosition = 'center';
    const currentH = targetImage.clientHeight || 300;
    targetImage.style.height = `${Math.round(currentH * 0.75)}px`;
    updateRect();
    onUpdate();
  };

  // ── Resetar ──
  const resetImage = () => {
    targetImage.style.width = '100%';
    targetImage.style.maxWidth = '100%';
    targetImage.style.height = 'auto';
    targetImage.style.objectFit = 'initial';
    targetImage.style.objectPosition = 'initial';
    targetImage.style.transform = 'none';
    updateRect();
    onUpdate();
  };

  // ── Remover Imagem ──
  const deleteImage = () => {
    targetImage.remove();
    onDeselect();
    onUpdate();
  };

  // ── Handler dos Cantos para Arraste Visual no Editor ──
  const handleCornerMouseDown = (e: React.MouseEvent, handle: string) => {
    e.preventDefault();
    e.stopPropagation();
    isDraggingHandle.current = handle;
    startDragPos.current = {
      x: e.clientX,
      y: e.clientY,
      width: targetImage.clientWidth,
      height: targetImage.clientHeight
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingHandle.current || !targetImage) return;
      const dx = moveEvent.clientX - startDragPos.current.x;
      const dy = moveEvent.clientY - startDragPos.current.y;

      if (handle === 'se' || handle === 'e') {
        const newW = Math.max(100, startDragPos.current.width + dx);
        targetImage.style.width = `${newW}px`;
      } else if (handle === 'sw' || handle === 'w') {
        const newW = Math.max(100, startDragPos.current.width - dx);
        targetImage.style.width = `${newW}px`;
      } else if (handle === 's') {
        const newH = Math.max(60, startDragPos.current.height + dy);
        targetImage.style.height = `${newH}px`;
        targetImage.style.objectFit = 'cover';
      } else if (handle === 'n') {
        const newH = Math.max(60, startDragPos.current.height - dy);
        targetImage.style.height = `${newH}px`;
        targetImage.style.objectFit = 'cover';
      }

      updateRect();
      onUpdate();
    };

    const handleMouseUp = () => {
      isDraggingHandle.current = null;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div
      className="absolute z-[9999] pointer-events-none"
      style={{
        top: `${rect.top}px`,
        left: `${rect.left}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`
      }}
    >
      {/* Moldura de Seleção Azul com Sombra */}
      <div className="absolute inset-0 border-2 border-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)] pointer-events-none rounded-lg" />

      {/* Mini Barra de Ferramentas Flutuante Superior no Editor */}
      <div className="absolute -top-11 left-1/2 -translate-x-1/2 bg-[#0f172a] text-white p-1 rounded-xl shadow-2xl border border-indigo-500/50 flex items-center gap-1 text-xs pointer-events-auto z-[10000]">
        <button
          type="button"
          onClick={cropMargins}
          className="p-1.5 hover:bg-indigo-600 rounded-lg text-indigo-300 hover:text-white font-bold text-[11px] flex items-center gap-1 transition-all"
          title="Cortar Margens (Recorte de Altura)"
        >
          <Scissors size={13} /> Recortar
        </button>

        <div className="w-[1px] h-4 bg-gray-700 mx-0.5" />

        <button
          type="button"
          onClick={() => changeSize(30)}
          className="p-1.5 hover:bg-gray-800 rounded-lg text-gray-300 hover:text-white transition-all"
          title="Aumentar Imagem"
        >
          <ZoomIn size={14} />
        </button>
        <button
          type="button"
          onClick={() => changeSize(-30)}
          className="p-1.5 hover:bg-gray-800 rounded-lg text-gray-300 hover:text-white transition-all"
          title="Diminuir Imagem"
        >
          <ZoomOut size={14} />
        </button>

        <div className="w-[1px] h-4 bg-gray-700 mx-0.5" />

        <button
          type="button"
          onClick={() => setAlignment('left')}
          className="p-1.5 hover:bg-gray-800 rounded-lg text-gray-300 hover:text-white transition-all"
          title="Alinhar à Esquerda"
        >
          <AlignLeft size={14} />
        </button>
        <button
          type="button"
          onClick={() => setAlignment('center')}
          className="p-1.5 hover:bg-gray-800 rounded-lg text-gray-300 hover:text-white transition-all"
          title="Centralizar Imagem"
        >
          <AlignCenter size={14} />
        </button>
        <button
          type="button"
          onClick={() => setAlignment('right')}
          className="p-1.5 hover:bg-gray-800 rounded-lg text-gray-300 hover:text-white transition-all"
          title="Alinhar à Direita"
        >
          <AlignRight size={14} />
        </button>

        <div className="w-[1px] h-4 bg-gray-700 mx-0.5" />

        <button
          type="button"
          onClick={resetImage}
          className="p-1.5 hover:bg-gray-800 rounded-lg text-gray-300 hover:text-white transition-all"
          title="Resetar Tamanho"
        >
          <RotateCcw size={13} />
        </button>

        <button
          type="button"
          onClick={deleteImage}
          className="p-1.5 hover:bg-red-600 rounded-lg text-red-400 hover:text-white transition-all"
          title="Excluir Imagem"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {/* HASTES DE ARRASTE VISUAL DIRETO NA PÁGINA (CANTOS E BORDAS) */}
      <div
        onMouseDown={e => handleCornerMouseDown(e, 'se')}
        className="absolute -right-2 -bottom-2 w-4 h-4 bg-white border-2 border-indigo-600 rounded-full cursor-nwse-resize shadow-xl pointer-events-auto hover:scale-125 transition-transform"
        title="Clique e arraste para redimensionar no texto"
      />
      <div
        onMouseDown={e => handleCornerMouseDown(e, 'sw')}
        className="absolute -left-2 -bottom-2 w-4 h-4 bg-white border-2 border-indigo-600 rounded-full cursor-nesw-resize shadow-xl pointer-events-auto hover:scale-125 transition-transform"
        title="Clique e arraste para redimensionar no texto"
      />
      <div
        onMouseDown={e => handleCornerMouseDown(e, 's')}
        className="absolute left-1/2 -bottom-2 -translate-x-1/2 w-7 h-3 bg-indigo-600 border-2 border-white rounded-full cursor-ns-resize shadow-xl pointer-events-auto hover:scale-125 transition-transform flex items-center justify-center"
        title="Clique e arraste para recortar altura"
      />
      <div
        onMouseDown={e => handleCornerMouseDown(e, 'n')}
        className="absolute left-1/2 -top-2 -translate-x-1/2 w-7 h-3 bg-indigo-600 border-2 border-white rounded-full cursor-ns-resize shadow-xl pointer-events-auto hover:scale-125 transition-transform flex items-center justify-center"
        title="Clique e arraste para recortar altura"
      />
      <div
        onMouseDown={e => handleCornerMouseDown(e, 'e')}
        className="absolute -right-2 top-1/2 -translate-y-1/2 w-3 h-7 bg-indigo-600 border-2 border-white rounded-full cursor-ew-resize shadow-xl pointer-events-auto hover:scale-125 transition-transform"
        title="Clique e arraste para redimensionar largura"
      />
      <div
        onMouseDown={e => handleCornerMouseDown(e, 'w')}
        className="absolute -left-2 top-1/2 -translate-y-1/2 w-3 h-7 bg-indigo-600 border-2 border-white rounded-full cursor-ew-resize shadow-xl pointer-events-auto hover:scale-125 transition-transform"
        title="Clique e arraste para redimensionar largura"
      />
    </div>
  );
};
