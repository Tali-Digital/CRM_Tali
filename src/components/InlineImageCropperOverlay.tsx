import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Trash2, AlignLeft, AlignCenter, AlignRight, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

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

  const startDragPos = useRef<{
    x: number;
    y: number;
    width: number;
    height: number;
    cropTop: number;
    cropBottom: number;
    cropLeft: number;
    cropRight: number;
  }>({
    x: 0, y: 0, width: 0, height: 0, cropTop: 0, cropBottom: 0, cropLeft: 0, cropRight: 0
  });

  const getCropValues = (img: HTMLImageElement) => {
    const top = parseFloat(img.dataset.cropTop || '0');
    const bottom = parseFloat(img.dataset.cropBottom || '0');
    const left = parseFloat(img.dataset.cropLeft || '0');
    const right = parseFloat(img.dataset.cropRight || '0');
    return { top, bottom, left, right };
  };

  const getInitialRadius = (img: HTMLImageElement | null): number => {
    if (!img) return 0;
    const styleRad = img.style.borderRadius || img.dataset.borderRadius || '';
    if (!styleRad) return 0;
    if (styleRad.includes('%') || styleRad === '9999px' || styleRad === '50%') {
      return 99;
    }
    const parsed = parseInt(styleRad, 10);
    return isNaN(parsed) ? 0 : parsed;
  };

  const applyCrop = (img: HTMLImageElement, top: number, bottom: number, left: number, right: number, radOverride?: number) => {
    const cTop = Math.max(0, top);
    const cBottom = Math.max(0, bottom);
    const cLeft = Math.max(0, left);
    const cRight = Math.max(0, right);

    img.dataset.cropTop = cTop.toString();
    img.dataset.cropBottom = cBottom.toString();
    img.dataset.cropLeft = cLeft.toString();
    img.dataset.cropRight = cRight.toString();

    const currentRad = radOverride !== undefined ? radOverride : getInitialRadius(img);
    const radPx = currentRad === 99 ? 9999 : currentRad;

    if (cTop === 0 && cBottom === 0 && cLeft === 0 && cRight === 0) {
      img.style.clipPath = 'none';
      img.style.marginTop = '';
      img.style.marginBottom = '';
    } else {
      img.style.clipPath = `inset(${cTop}px ${cRight}px ${cBottom}px ${cLeft}px${radPx > 0 ? ` round ${radPx}px` : ''})`;
      img.style.marginTop = cTop > 0 ? `-${cTop}px` : '';
      img.style.marginBottom = cBottom > 0 ? `-${cBottom}px` : '';
    }
  };

  const updateRect = () => {
    if (!targetImage || !editorContainer) {
      setRect(null);
      return;
    }
    const imgBounds = targetImage.getBoundingClientRect();
    const containerBounds = editorContainer.getBoundingClientRect();
    const { top: cTop, bottom: cBottom, left: cLeft, right: cRight } = getCropValues(targetImage);

    // Área visível ajustada ao clip-path
    const visibleTop = imgBounds.top + cTop;
    const visibleLeft = imgBounds.left + cLeft;
    const visibleWidth = Math.max(20, imgBounds.width - cLeft - cRight);
    const visibleHeight = Math.max(20, imgBounds.height - cTop - cBottom);

    setRect({
      top: visibleTop - containerBounds.top + editorContainer.scrollTop,
      left: visibleLeft - containerBounds.left + editorContainer.scrollLeft,
      width: visibleWidth,
      height: visibleHeight
    });
  };

  const [radius, setRadius] = useState<number>(0);

  useEffect(() => {
    if (targetImage) {
      setRadius(getInitialRadius(targetImage));
    }
  }, [targetImage]);

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
      targetImage.style.marginLeft = 'auto';
      targetImage.style.marginRight = 'auto';
    } else if (align === 'right') {
      targetImage.style.marginLeft = 'auto';
      targetImage.style.marginRight = '0';
    } else {
      targetImage.style.marginLeft = '0';
      targetImage.style.marginRight = 'auto';
    }
    updateRect();
    onUpdate();
  };

  // ── Botões de Zoom (+ / -): Redimensiona a Imagem Proporcionalmente ──
  const changeSize = (delta: number) => {
    const currentW = targetImage.clientWidth || 300;
    const newW = Math.max(80, Math.min(950, currentW + delta));
    targetImage.style.width = `${newW}px`;
    targetImage.style.height = 'auto';
    updateRect();
    onUpdate();
  };

  // ── Radius (Arredondamento das 4 bordas) ──
  const handleRadiusChange = (newRadius: number) => {
    if (!targetImage) return;
    const clamped = Math.max(0, Math.min(99, newRadius));
    setRadius(clamped);

    const radiusVal = clamped === 99 ? '9999px' : `${clamped}px`;
    targetImage.style.borderRadius = radiusVal;
    targetImage.dataset.borderRadius = radiusVal;

    const { top, bottom, left, right } = getCropValues(targetImage);
    applyCrop(targetImage, top, bottom, left, right, clamped);

    updateRect();
    onUpdate();
  };

  // ── Resetar Recortes e Tamanhos ──
  const resetImage = () => {
    if (targetImage) {
      targetImage.style.borderRadius = '0px';
      delete targetImage.dataset.borderRadius;
    }
    setRadius(0);
    applyCrop(targetImage, 0, 0, 0, 0, 0);
    targetImage.style.width = '100%';
    targetImage.style.maxWidth = '100%';
    targetImage.style.height = 'auto';
    targetImage.style.objectFit = 'initial';
    targetImage.style.objectPosition = 'initial';
    targetImage.style.transform = 'none';
    updateRect();
    onUpdate();
  };

  // ── Excluir Imagem ──
  const deleteImage = () => {
    targetImage.remove();
    onDeselect();
    onUpdate();
  };

  // ── Handlers das Hastes ──
  // Cantos (se, sw, ne, nw) = AUMENTAR / DIMINUIR TAMANHO DA IMAGEM
  // Laterais (s, n, e, w) = RECORTE SEM DISTORCER A IMAGEM
  const handleCornerMouseDown = (e: React.MouseEvent, handle: string) => {
    e.preventDefault();
    e.stopPropagation();
    isDraggingHandle.current = handle;

    const crops = getCropValues(targetImage);
    startDragPos.current = {
      x: e.clientX,
      y: e.clientY,
      width: targetImage.clientWidth,
      height: targetImage.clientHeight,
      cropTop: crops.top,
      cropBottom: crops.bottom,
      cropLeft: crops.left,
      cropRight: crops.right
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingHandle.current || !targetImage) return;
      const dx = moveEvent.clientX - startDragPos.current.x;
      const dy = moveEvent.clientY - startDragPos.current.y;
      const { cropTop, cropBottom, cropLeft, cropRight } = startDragPos.current;

      if (handle === 'se' || handle === 'sw' || handle === 'ne' || handle === 'nw') {
        // CANTOS: Redimensionar tamanho da foto proporcionalmente
        const deltaX = (handle === 'se' || handle === 'ne') ? dx : -dx;
        const newW = Math.max(80, startDragPos.current.width + deltaX);
        targetImage.style.width = `${newW}px`;
        targetImage.style.height = 'auto';
      } else if (handle === 's') {
        // CORTE BASE (s): Aumenta o recorte inferior sem distorcer a imagem
        const newBottom = Math.max(0, cropBottom - dy);
        applyCrop(targetImage, cropTop, newBottom, cropLeft, cropRight);
      } else if (handle === 'n') {
        // CORTE TOPO (n): Aumenta o recorte superior sem distorcer a imagem
        const newTop = Math.max(0, cropTop + dy);
        applyCrop(targetImage, newTop, cropBottom, cropLeft, cropRight);
      } else if (handle === 'e') {
        // CORTE DIREITA (e): Recorta lado direito sem distorção
        const newRight = Math.max(0, cropRight - dx);
        applyCrop(targetImage, cropTop, cropBottom, cropLeft, newRight);
      } else if (handle === 'w') {
        // CORTE ESQUERDA (w): Recorta lado esquerdo sem distorção
        const newLeft = Math.max(0, cropLeft + dx);
        applyCrop(targetImage, cropTop, cropBottom, newLeft, cropRight);
      }

      updateRect();
      onUpdate();
    };

    const handleMouseUp = (upEvent: MouseEvent) => {
      upEvent.preventDefault();
      upEvent.stopPropagation();
      isDraggingHandle.current = null;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  if (!targetImage || !rect || !editorContainer) return null;

  return createPortal(
    <div
      className="absolute z-[9999] pointer-events-none inline-image-cropper-overlay"
      style={{
        top: `${rect.top}px`,
        left: `${rect.left}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`
      }}
    >
      {/* Moldura de Seleção Azul */}
      <div className="absolute inset-0 border-2 border-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.5)] pointer-events-none rounded-lg" />

      {/* Mini Barra Flutuante Ampliada sem Botão Recortar */}
      <div className="absolute -top-14 left-1/2 -translate-x-1/2 bg-[#0b0f19] text-white px-3 py-2 rounded-2xl shadow-2xl border-2 border-indigo-500/60 flex items-center gap-2 text-sm pointer-events-auto z-[10000]">
        {/* Zoom (+ / -) para Aumentar / Diminuir tamanho da imagem */}
        <button
          type="button"
          onClick={() => changeSize(40)}
          className="p-2 hover:bg-indigo-600/40 text-gray-200 hover:text-white rounded-xl transition-all cursor-pointer flex items-center gap-1 font-bold"
          title="Aumentar tamanho da imagem"
        >
          <ZoomIn size={18} />
        </button>
        <button
          type="button"
          onClick={() => changeSize(-40)}
          className="p-2 hover:bg-indigo-600/40 text-gray-200 hover:text-white rounded-xl transition-all cursor-pointer flex items-center gap-1 font-bold"
          title="Diminuir tamanho da imagem"
        >
          <ZoomOut size={18} />
        </button>

        <div className="w-[1px] h-5 bg-gray-700 mx-1" />

        {/* Alinhamento */}
        <button
          type="button"
          onClick={() => setAlignment('left')}
          className="p-2 hover:bg-gray-800 rounded-xl text-gray-300 hover:text-white transition-all cursor-pointer"
          title="Alinhar à Esquerda"
        >
          <AlignLeft size={18} />
        </button>
        <button
          type="button"
          onClick={() => setAlignment('center')}
          className="p-2 hover:bg-gray-800 rounded-xl text-gray-300 hover:text-white transition-all cursor-pointer"
          title="Centralizar no Texto"
        >
          <AlignCenter size={18} />
        </button>
        <button
          type="button"
          onClick={() => setAlignment('right')}
          className="p-2 hover:bg-gray-800 rounded-xl text-gray-300 hover:text-white transition-all cursor-pointer"
          title="Alinhar à Direita"
        >
          <AlignRight size={18} />
        </button>

        <div className="w-[1px] h-5 bg-gray-700 mx-1" />

        {/* Radius / Arredondamento das 4 Bordas */}
        <div className="flex items-center gap-1 bg-gray-900/90 px-2.5 py-1 rounded-xl border border-gray-700/70 shadow-inner select-none" title="Arredondamento das 4 bordas (Radius)">
          <div className="flex items-center gap-1.5 text-[11px] text-indigo-300 font-semibold shrink-0">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-400">
              <rect x="3" y="3" width="18" height="18" rx="5" ry="5" />
              <path d="M8 16h3a3 3 0 0 0 3-3V10" />
            </svg>
            <span className="hidden sm:inline">Radius:</span>
          </div>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => handleRadiusChange(Math.max(0, radius - 4))}
              className="w-5 h-5 flex items-center justify-center hover:bg-gray-700 rounded text-gray-300 hover:text-white text-xs font-bold transition-colors cursor-pointer"
              title="Diminuir radius (-4px)"
            >
              -
            </button>
            <input
              type="number"
              min="0"
              max="99"
              value={radius}
              onChange={(e) => handleRadiusChange(parseInt(e.target.value, 10) || 0)}
              className="w-9 bg-gray-950 text-center text-xs font-bold text-white border border-gray-700 rounded py-0.5 focus:outline-none focus:border-indigo-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <span className="text-[10px] text-gray-400 font-medium mr-1">px</span>
            <button
              type="button"
              onClick={() => handleRadiusChange(radius + 4)}
              className="w-5 h-5 flex items-center justify-center hover:bg-gray-700 rounded text-gray-300 hover:text-white text-xs font-bold transition-colors cursor-pointer"
              title="Aumentar radius (+4px)"
            >
              +
            </button>
          </div>
          <div className="flex items-center gap-0.5 ml-1 border-l border-gray-700/60 pl-1">
            {[0, 8, 16, 24, 99].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => handleRadiusChange(preset)}
                className={`px-1.5 py-0.5 text-[10px] font-bold rounded transition-all cursor-pointer ${
                  radius === preset
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
                title={preset === 99 ? 'Borda 100% Redonda (Círculo/Pílula)' : `Borda ${preset}px`}
              >
                {preset === 99 ? '100%' : preset}
              </button>
            ))}
          </div>
        </div>

        <div className="w-[1px] h-5 bg-gray-700 mx-1" />

        {/* Resetar */}
        <button
          type="button"
          onClick={resetImage}
          className="p-2 hover:bg-gray-800 rounded-xl text-gray-300 hover:text-white transition-all cursor-pointer"
          title="Resetar Recortes e Tamanhos"
        >
          <RotateCcw size={17} />
        </button>

        {/* Excluir */}
        <button
          type="button"
          onClick={deleteImage}
          className="p-2 hover:bg-red-600/80 text-red-400 hover:text-white rounded-xl transition-all cursor-pointer"
          title="Excluir Imagem"
        >
          <Trash2 size={17} />
        </button>
      </div>

      {/* 4 CANTOS (○): AUMENTAR E DIMINUIR O TAMANHO DA FOTO */}
      <div
        onMouseDown={e => handleCornerMouseDown(e, 'se')}
        className="absolute -right-2.5 -bottom-2.5 w-5 h-5 bg-white border-2 border-indigo-600 rounded-full cursor-nwse-resize shadow-2xl pointer-events-auto hover:scale-125 transition-transform"
        title="Arraste o canto para aumentar/diminuir a imagem"
      />
      <div
        onMouseDown={e => handleCornerMouseDown(e, 'sw')}
        className="absolute -left-2.5 -bottom-2.5 w-5 h-5 bg-white border-2 border-indigo-600 rounded-full cursor-nesw-resize shadow-2xl pointer-events-auto hover:scale-125 transition-transform"
        title="Arraste o canto para aumentar/diminuir a imagem"
      />
      <div
        onMouseDown={e => handleCornerMouseDown(e, 'ne')}
        className="absolute -right-2.5 -top-2.5 w-5 h-5 bg-white border-2 border-indigo-600 rounded-full cursor-nesw-resize shadow-2xl pointer-events-auto hover:scale-125 transition-transform"
        title="Arraste o canto para aumentar/diminuir a imagem"
      />
      <div
        onMouseDown={e => handleCornerMouseDown(e, 'nw')}
        className="absolute -left-2.5 -top-2.5 w-5 h-5 bg-white border-2 border-indigo-600 rounded-full cursor-nwse-resize shadow-2xl pointer-events-auto hover:scale-125 transition-transform"
        title="Arraste o canto para aumentar/diminuir a imagem"
      />

      {/* 4 LATERAIS (PÍLULAS): RECORTE DAS BORDAS SEM DISTORÇÃO */}
      <div
        onMouseDown={e => handleCornerMouseDown(e, 's')}
        className="absolute left-1/2 -bottom-2.5 -translate-x-1/2 w-9 h-4 bg-indigo-600 border-2 border-white rounded-full cursor-ns-resize shadow-2xl pointer-events-auto hover:scale-125 transition-transform flex items-center justify-center"
        title="Arraste para recortar a borda inferior"
      >
        <div className="w-3.5 h-0.5 bg-white rounded-full" />
      </div>

      <div
        onMouseDown={e => handleCornerMouseDown(e, 'n')}
        className="absolute left-1/2 -top-2.5 -translate-x-1/2 w-9 h-4 bg-indigo-600 border-2 border-white rounded-full cursor-ns-resize shadow-2xl pointer-events-auto hover:scale-125 transition-transform flex items-center justify-center"
        title="Arraste para recortar a borda superior"
      >
        <div className="w-3.5 h-0.5 bg-white rounded-full" />
      </div>

      <div
        onMouseDown={e => handleCornerMouseDown(e, 'e')}
        className="absolute -right-2.5 top-1/2 -translate-y-1/2 w-4 h-9 bg-indigo-600 border-2 border-white rounded-full cursor-ew-resize shadow-2xl pointer-events-auto hover:scale-125 transition-transform flex items-center justify-center"
        title="Arraste para recortar a borda direita"
      >
        <div className="w-0.5 h-3.5 bg-white rounded-full" />
      </div>

      <div
        onMouseDown={e => handleCornerMouseDown(e, 'w')}
        className="absolute -left-2.5 top-1/2 -translate-y-1/2 w-4 h-9 bg-indigo-600 border-2 border-white rounded-full cursor-ew-resize shadow-2xl pointer-events-auto hover:scale-125 transition-transform flex items-center justify-center"
        title="Arraste para recortar a borda esquerda"
      >
        <div className="w-0.5 h-3.5 bg-white rounded-full" />
      </div>
    </div>,
    editorContainer
  );
};
