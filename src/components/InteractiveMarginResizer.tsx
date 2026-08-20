import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface InteractiveMarginResizerProps {
  showMargins: boolean;
  editorRef: React.RefObject<HTMLDivElement>;
  onUpdate: () => void;
  onUpdateMargin?: (top: number, right: number, bottom: number, left: number) => void;
  balancePagesFrom: (startContent: HTMLElement | null) => void;
}

export const InteractiveMarginResizer: React.FC<InteractiveMarginResizerProps> = ({
  showMargins,
  editorRef,
  onUpdate,
  onUpdateMargin,
  balancePagesFrom
}) => {
  const [pages, setPages] = useState<{ pageEl: HTMLElement; contentEl: HTMLElement; top: number; right: number; bottom: number; left: number }[]>([]);
  const [activeDrag, setActiveDrag] = useState<{ handle: 'top' | 'bottom' | 'left' | 'right'; pageIndex: number; currentMm: number } | null>(null);

  const updatePageList = () => {
    if (!editorRef.current || !showMargins) {
      setPages([]);
      return;
    }
    const pageNodes = Array.from(editorRef.current.querySelectorAll<HTMLElement>(':scope > .a4-page'));
    const pageData = pageNodes.map(pageEl => {
      const contentEl = pageEl.querySelector<HTMLElement>(':scope > .a4-page-content');
      if (!contentEl) return null;
      const pxPerMm = (pageEl.getBoundingClientRect().width || 794) / 210;
      const styles = window.getComputedStyle(contentEl);
      const top = Math.round(parseFloat(styles.paddingTop || '0') / pxPerMm);
      const right = Math.round(parseFloat(styles.paddingRight || '0') / pxPerMm);
      const bottom = Math.round(parseFloat(styles.paddingBottom || '0') / pxPerMm);
      const left = Math.round(parseFloat(styles.paddingLeft || '0') / pxPerMm);
      return { pageEl, contentEl, top, right, bottom, left };
    }).filter(Boolean) as any[];

    setPages(pageData);
  };

  useEffect(() => {
    updatePageList();
    const interval = setInterval(updatePageList, 800);
    return () => clearInterval(interval);
  }, [showMargins, editorRef]);

  if (!showMargins || pages.length === 0) return null;

  const handleStartDrag = (e: React.MouseEvent, pageIndex: number, handle: 'top' | 'bottom' | 'left' | 'right') => {
    e.preventDefault();
    e.stopPropagation();

    const pageItem = pages[pageIndex];
    if (!pageItem) return;
    const { contentEl, top, right, bottom, left, pageEl } = pageItem;
    const pageBounds = pageEl.getBoundingClientRect();
    const pxPerMm = pageBounds.width / 210;

    const startX = e.clientX;
    const startY = e.clientY;

    const initialMap = { top, right, bottom, left };
    const startMm = initialMap[handle];

    let currentUpdatedMm = { top, right, bottom, left };
    setActiveDrag({ handle, pageIndex, currentMm: startMm });

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;

      let newMm = startMm;
      if (handle === 'top') {
        newMm = Math.max(0, Math.min(65, Math.round(startMm + dy / pxPerMm)));
      } else if (handle === 'bottom') {
        newMm = Math.max(0, Math.min(65, Math.round(startMm - dy / pxPerMm)));
      } else if (handle === 'left') {
        newMm = Math.max(0, Math.min(65, Math.round(startMm + dx / pxPerMm)));
      } else if (handle === 'right') {
        newMm = Math.max(0, Math.min(65, Math.round(startMm - dx / pxPerMm)));
      }

      currentUpdatedMm = {
        top: handle === 'top' ? newMm : top,
        right: handle === 'right' ? newMm : right,
        bottom: handle === 'bottom' ? newMm : bottom,
        left: handle === 'left' ? newMm : left
      };

      contentEl.style.padding = `${currentUpdatedMm.top}mm ${currentUpdatedMm.right}mm ${currentUpdatedMm.bottom}mm ${currentUpdatedMm.left}mm`;
      setPages(prev => prev.map((p, pIdx) => pIdx === pageIndex ? { ...p, ...currentUpdatedMm } : p));
      setActiveDrag({ handle, pageIndex, currentMm: newMm });
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      setActiveDrag(null);

      contentEl.style.padding = `${currentUpdatedMm.top}mm ${currentUpdatedMm.right}mm ${currentUpdatedMm.bottom}mm ${currentUpdatedMm.left}mm`;

      updatePageList();
      onUpdate();

      if (onUpdateMargin) {
        onUpdateMargin(currentUpdatedMm.top, currentUpdatedMm.right, currentUpdatedMm.bottom, currentUpdatedMm.left);
      }

      balancePagesFrom(contentEl);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <>
      {pages.map((p, idx) => {
        const isDraggingThis = activeDrag?.pageIndex === idx;

        return createPortal(
          <div
            key={idx}
            className="a4-margin-interactive-layer"
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              zIndex: 90
            }}
          >
            {/* Margem Superior */}
            <div
              onMouseDown={(e) => handleStartDrag(e, idx, 'top')}
              style={{
                position: 'absolute',
                top: `${p.top}mm`,
                left: 0,
                right: 0,
                height: '16px',
                marginTop: '-8px',
                cursor: 'ns-resize',
                pointerEvents: 'auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              className="group"
              title="Clique e arraste para alterar a margem superior"
            >
              <div className={`w-full h-[2px] transition-all ${
                isDraggingThis && activeDrag?.handle === 'top'
                  ? 'bg-blue-600 border-b border-dashed border-blue-400'
                  : 'bg-transparent group-hover:bg-blue-500/80 group-hover:border-b group-hover:border-dashed group-hover:border-blue-400'
              }`} />
              <div className={`absolute bg-blue-600 text-white font-mono text-[11px] font-black px-2.5 py-0.5 rounded-full shadow-xl pointer-events-none transition-opacity ${
                isDraggingThis && activeDrag?.handle === 'top' ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
              }`}>
                Margem Topo: {isDraggingThis && activeDrag?.handle === 'top' ? activeDrag.currentMm : p.top}mm
              </div>
            </div>

            {/* Margem Inferior */}
            <div
              onMouseDown={(e) => handleStartDrag(e, idx, 'bottom')}
              style={{
                position: 'absolute',
                bottom: `${p.bottom}mm`,
                left: 0,
                right: 0,
                height: '16px',
                marginBottom: '-8px',
                cursor: 'ns-resize',
                pointerEvents: 'auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              className="group"
              title="Clique e arraste para alterar a margem inferior"
            >
              <div className={`w-full h-[2px] transition-all ${
                isDraggingThis && activeDrag?.handle === 'bottom'
                  ? 'bg-blue-600 border-b border-dashed border-blue-400'
                  : 'bg-transparent group-hover:bg-blue-500/80 group-hover:border-b group-hover:border-dashed group-hover:border-blue-400'
              }`} />
              <div className={`absolute bg-blue-600 text-white font-mono text-[11px] font-black px-2.5 py-0.5 rounded-full shadow-xl pointer-events-none transition-opacity ${
                isDraggingThis && activeDrag?.handle === 'bottom' ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
              }`}>
                Margem Baixo: {isDraggingThis && activeDrag?.handle === 'bottom' ? activeDrag.currentMm : p.bottom}mm
              </div>
            </div>

            {/* Margem Esquerda */}
            <div
              onMouseDown={(e) => handleStartDrag(e, idx, 'left')}
              style={{
                position: 'absolute',
                left: `${p.left}mm`,
                top: 0,
                bottom: 0,
                width: '16px',
                marginLeft: '-8px',
                cursor: 'ew-resize',
                pointerEvents: 'auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              className="group"
              title="Clique e arraste para alterar a margem esquerda"
            >
              <div className={`h-full w-[2px] transition-all ${
                isDraggingThis && activeDrag?.handle === 'left'
                  ? 'bg-blue-600 border-r border-dashed border-blue-400'
                  : 'bg-transparent group-hover:bg-blue-500/80 group-hover:border-r group-hover:border-dashed group-hover:border-blue-400'
              }`} />
              <div className={`absolute bg-blue-600 text-white font-mono text-[11px] font-black px-2.5 py-0.5 rounded-full shadow-xl pointer-events-none transition-opacity whitespace-nowrap ${
                isDraggingThis && activeDrag?.handle === 'left' ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
              }`}>
                Margem Esquerda: {isDraggingThis && activeDrag?.handle === 'left' ? activeDrag.currentMm : p.left}mm
              </div>
            </div>

            {/* Margem Direita */}
            <div
              onMouseDown={(e) => handleStartDrag(e, idx, 'right')}
              style={{
                position: 'absolute',
                right: `${p.right}mm`,
                top: 0,
                bottom: 0,
                width: '16px',
                marginRight: '-8px',
                cursor: 'ew-resize',
                pointerEvents: 'auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              className="group"
              title="Clique e arraste para alterar a margem direita"
            >
              <div className={`h-full w-[2px] transition-all ${
                isDraggingThis && activeDrag?.handle === 'right'
                  ? 'bg-blue-600 border-r border-dashed border-blue-400'
                  : 'bg-transparent group-hover:bg-blue-500/80 group-hover:border-r group-hover:border-dashed group-hover:border-blue-400'
              }`} />
              <div className={`absolute bg-blue-600 text-white font-mono text-[11px] font-black px-2.5 py-0.5 rounded-full shadow-xl pointer-events-none transition-opacity whitespace-nowrap ${
                isDraggingThis && activeDrag?.handle === 'right' ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
              }`}>
                Margem Direita: {isDraggingThis && activeDrag?.handle === 'right' ? activeDrag.currentMm : p.right}mm
              </div>
            </div>
          </div>,
          p.pageEl
        );
      })}
    </>
  );
};
