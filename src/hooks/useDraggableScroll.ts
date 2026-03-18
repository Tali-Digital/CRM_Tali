import React, { useRef, useCallback, useState } from 'react';

export const useDraggableScroll = () => {
  const ref = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const isDown = useRef(false);
  const moved = useRef(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const scrollLeft = useRef(0);
  const scrollTop = useRef(0);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (!ref.current) return;
    // Only allow left click
    if (e.button !== 0) return;
    
    // Prevent dragging if clicking a card or button
    if ((e.target as HTMLElement).closest('button, .card-draggable, input, select, a, [role="button"]')) {
      return;
    }

    const rect = ref.current.getBoundingClientRect();
    isDown.current = true;
    moved.current = false;
    startX.current = e.clientX - rect.left;
    startY.current = e.clientY - rect.top;
    scrollLeft.current = ref.current.scrollLeft;
    scrollTop.current = ref.current.scrollTop;
  }, []);

  const onMouseLeave = useCallback(() => {
    if (isDown.current) {
      isDown.current = false;
      setIsDragging(false);
    }
  }, []);

  const onMouseUp = useCallback((e: React.MouseEvent) => {
    if (isDown.current && moved.current) {
      // Prevent click events if we actually dragged
      const preventClick = (event: MouseEvent) => {
        event.stopImmediatePropagation();
        ref.current?.removeEventListener('click', preventClick, true);
      };
      ref.current?.addEventListener('click', preventClick, true);
    }
    
    isDown.current = false;
    setIsDragging(false);
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDown.current || !ref.current) return;
    
    const rect = ref.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const walkX = (x - startX.current);
    const walkY = (y - startY.current);

    // Threshold 3px to start dragging
    if (!moved.current && (Math.abs(walkX) > 3 || Math.abs(walkY) > 3)) {
      moved.current = true;
      setIsDragging(true);
    }

    if (moved.current) {
      ref.current.scrollLeft = scrollLeft.current - walkX * 1.5;
      // ref.current.scrollTop = scrollTop.current - walkY * 1.5;
    }
  }, []);

  return { 
    ref, 
    props: { onMouseDown, onMouseLeave, onMouseUp, onMouseMove }, 
    dragClassName: isDragging ? 'dragging-active cursor-grabbing select-none transition-none' : 'cursor-grab' 
  };
};
