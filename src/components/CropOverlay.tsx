import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, Copy, X } from 'lucide-react';
import { isMac } from '../utils/platform';

type DragMode = 'move' | 'draw' | 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | null;

interface BoxRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const CropOverlay: React.FC = () => {
  // Parse origin offsets from URL search parameters if passed
  const searchParams = new URLSearchParams(window.location.search);
  const originX = parseInt(searchParams.get('originX') || '0', 10);
  const originY = parseInt(searchParams.get('originY') || '0', 10);

  // Initialize a sensible centered selection box
  const [box, setBox] = useState<BoxRect>(() => {
    const w = Math.min(720, Math.max(320, Math.round(window.innerWidth * 0.6)));
    const h = Math.min(460, Math.max(220, Math.round(window.innerHeight * 0.5)));
    return {
      x: Math.round((window.innerWidth - w) / 2),
      y: Math.round((window.innerHeight - h) / 2),
      width: w,
      height: h
    };
  });

  const [dragMode, setDragMode] = useState<DragMode>(null);
  const dragStartRef = useRef<{
    mouseX: number;
    mouseY: number;
    boxX: number;
    boxY: number;
    boxW: number;
    boxH: number;
  }>({ mouseX: 0, mouseY: 0, boxX: 0, boxY: 0, boxW: 0, boxH: 0 });

  const boxRef = useRef(box);
  boxRef.current = box;
  const isCapturingRef = useRef(false);

  const handleConfirm = useCallback(async (copyToClipboardOnly = false) => {
    if (isCapturingRef.current) return;
    const currentBox = boxRef.current;
    if (currentBox.width < 10 || currentBox.height < 10) return;
    isCapturingRef.current = true;

    const screenRect = {
      x: Math.round(originX + currentBox.x),
      y: Math.round(originY + currentBox.y),
      width: Math.round(currentBox.width),
      height: Math.round(currentBox.height)
    };

    if (window.electronAPI?.confirmCrop) {
      await window.electronAPI.confirmCrop(screenRect, copyToClipboardOnly);
    }
  }, [originX, originY]);

  const handleCancel = useCallback(async () => {
    if (isCapturingRef.current) return;
    isCapturingRef.current = true;
    if (window.electronAPI?.cancelCrop) {
      await window.electronAPI.cancelCrop();
    }
  }, []);

  // Global keyboard shortcuts (Enter, ⌘C / Ctrl+C, Esc, Arrow nudge)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleCancel();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleConfirm(false);
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        handleConfirm(true);
      } else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        setBox(prev => {
          let nx = prev.x;
          let ny = prev.y;
          if (e.key === 'ArrowUp') ny = Math.max(0, ny - step);
          if (e.key === 'ArrowDown') ny = Math.min(window.innerHeight - prev.height, ny + step);
          if (e.key === 'ArrowLeft') nx = Math.max(0, nx - step);
          if (e.key === 'ArrowRight') nx = Math.min(window.innerWidth - prev.width, nx + step);
          return { ...prev, x: nx, y: ny };
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleConfirm, handleCancel]);

  // Mouse move and mouse up listeners for move / resize / draw
  useEffect(() => {
    if (!dragMode) return;

    const handleMouseMove = (e: MouseEvent) => {
      const orig = dragStartRef.current;
      const dx = e.clientX - orig.mouseX;
      const dy = e.clientY - orig.mouseY;
      const winW = window.innerWidth;
      const winH = window.innerHeight;

      if (dragMode === 'move') {
        let nx = orig.boxX + dx;
        let ny = orig.boxY + dy;
        nx = Math.max(0, Math.min(winW - orig.boxW, nx));
        ny = Math.max(0, Math.min(winH - orig.boxH, ny));
        setBox({
          x: Math.round(nx),
          y: Math.round(ny),
          width: orig.boxW,
          height: orig.boxH
        });
      } else if (dragMode === 'draw') {
        const curX = Math.max(0, Math.min(winW, e.clientX));
        const curY = Math.max(0, Math.min(winH, e.clientY));
        const nx = Math.min(orig.mouseX, curX);
        const ny = Math.min(orig.mouseY, curY);
        const nw = Math.abs(curX - orig.mouseX);
        const nh = Math.abs(curY - orig.mouseY);
        setBox({
          x: Math.round(nx),
          y: Math.round(ny),
          width: Math.round(nw),
          height: Math.round(nh)
        });
      } else {
        // Resize handle
        const MIN_SIZE = 30;
        let nx = orig.boxX;
        let ny = orig.boxY;
        let nw = orig.boxW;
        let nh = orig.boxH;

        if (dragMode.includes('w')) {
          const maxLeft = orig.boxX + orig.boxW - MIN_SIZE;
          nx = Math.min(maxLeft, Math.max(0, orig.boxX + dx));
          nw = orig.boxW - (nx - orig.boxX);
        } else if (dragMode.includes('e')) {
          nw = Math.max(MIN_SIZE, Math.min(winW - orig.boxX, orig.boxW + dx));
        }

        if (dragMode.includes('n')) {
          const maxTop = orig.boxY + orig.boxH - MIN_SIZE;
          ny = Math.min(maxTop, Math.max(0, orig.boxY + dy));
          nh = orig.boxH - (ny - orig.boxY);
        } else if (dragMode.includes('s')) {
          nh = Math.max(MIN_SIZE, Math.min(winH - orig.boxY, orig.boxH + dy));
        }

        setBox({
          x: Math.round(nx),
          y: Math.round(ny),
          width: Math.round(nw),
          height: Math.round(nh)
        });
      }
    };

    const handleMouseUp = () => {
      // If draw was too small, restore a fallback centered box
      if (dragMode === 'draw' && (boxRef.current.width < 24 || boxRef.current.height < 24)) {
        const fallbackW = Math.min(600, Math.round(window.innerWidth * 0.5));
        const fallbackH = Math.min(380, Math.round(window.innerHeight * 0.45));
        setBox({
          x: Math.round((window.innerWidth - fallbackW) / 2),
          y: Math.round((window.innerHeight - fallbackH) / 2),
          width: fallbackW,
          height: fallbackH
        });
      }
      setDragMode(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragMode]);

  const handleBackdropMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setDragMode('draw');
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      boxX: e.clientX,
      boxY: e.clientY,
      boxW: 0,
      boxH: 0
    };
    setBox({
      x: e.clientX,
      y: e.clientY,
      width: 0,
      height: 0
    });
  };

  const handleBoxMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragMode('move');
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      boxX: box.x,
      boxY: box.y,
      boxW: box.width,
      boxH: box.height
    };
  };

  const handleHandleMouseDown = (e: React.MouseEvent, handle: DragMode) => {
    e.preventDefault();
    e.stopPropagation();
    setDragMode(handle);
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      boxX: box.x,
      boxY: box.y,
      boxW: box.width,
      boxH: box.height
    };
  };

  const handles: Array<{ type: DragMode; className: string; cursor: string }> = [
    { type: 'nw', className: '-top-1.5 -left-1.5', cursor: 'nwse-resize' },
    { type: 'n', className: '-top-1.5 left-1/2 -translate-x-1/2', cursor: 'ns-resize' },
    { type: 'ne', className: '-top-1.5 -right-1.5', cursor: 'nesw-resize' },
    { type: 'e', className: 'top-1/2 -translate-y-1/2 -right-1.5', cursor: 'ew-resize' },
    { type: 'se', className: '-bottom-1.5 -right-1.5', cursor: 'nwse-resize' },
    { type: 's', className: '-bottom-1.5 left-1/2 -translate-x-1/2', cursor: 'ns-resize' },
    { type: 'sw', className: '-bottom-1.5 -left-1.5', cursor: 'nesw-resize' },
    { type: 'w', className: 'top-1/2 -translate-y-1/2 -left-1.5', cursor: 'ew-resize' },
  ];

  // Calculate position of the floating control bar
  const isNearBottom = box.y + box.height + 64 > window.innerHeight;
  const toolbarTop = isNearBottom
    ? Math.max(12, box.y - 56)
    : Math.min(window.innerHeight - 56, box.y + box.height + 16);
  const toolbarLeft = Math.max(175, Math.min(window.innerWidth - 175, box.x + box.width / 2));

  // Position of live dimensions badge
  const showBadgeInside = box.y + box.height + 36 > window.innerHeight;

  return (
    <div
      className="fixed inset-0 w-full h-full select-none overflow-hidden cursor-crosshair"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.005)' }}
      onMouseDown={handleBackdropMouseDown}
    >
      {/* Framing selection box */}
      <div
        style={{
          transform: `translate3d(${box.x}px, ${box.y}px, 0)`,
          width: `${box.width}px`,
          height: `${box.height}px`,
          boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.44)',
        }}
        className="absolute top-0 left-0 border-[1.5px] border-white/95 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.35)] cursor-move"
        onMouseDown={handleBoxMouseDown}
      >
        {/* Rule of thirds grid lines (subtle macOS framing guide) */}
        <div className="absolute inset-0 pointer-events-none opacity-20">
          <div className="absolute top-1/3 left-0 right-0 h-px bg-white" />
          <div className="absolute top-2/3 left-0 right-0 h-px bg-white" />
          <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white" />
          <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white" />
        </div>

        {/* Live pixel dimensions badge */}
        <div
          className={`absolute left-1/2 -translate-x-1/2 pointer-events-none ${
            showBadgeInside ? 'top-2.5' : '-bottom-7'
          }`}
        >
          <div className="px-2.5 py-0.5 bg-black/80 backdrop-blur-md text-white font-mono text-[11px] font-semibold rounded-full shadow-lg border border-white/20 whitespace-nowrap tracking-wide">
            {Math.round(box.width)} × {Math.round(box.height)}
          </div>
        </div>

        {/* 8 Resizable Handles */}
        {handles.map((h) => (
          <div
            key={h.type}
            className={`absolute w-3 h-3 bg-white border border-neutral-800 rounded-[2px] shadow-sm z-20 hover:scale-125 transition-transform ${h.className}`}
            style={{ cursor: h.cursor }}
            onMouseDown={(e) => handleHandleMouseDown(e, h.type)}
          />
        ))}
      </div>

      {/* Floating Control Bar */}
      <div
        style={{
          position: 'absolute',
          top: `${toolbarTop}px`,
          left: `${toolbarLeft}px`,
          transform: 'translateX(-50%)',
          zIndex: 50
        }}
        onMouseDown={(e) => e.stopPropagation()}
        className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-neutral-900/90 backdrop-blur-xl border border-white/20 shadow-2xl text-white select-none animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Pixel badge inside bar */}
        <div className="px-2 py-1 mr-1 text-[11px] font-mono font-medium text-neutral-300 bg-white/10 rounded-md border border-white/10 shrink-0">
          {Math.round(box.width)} × {Math.round(box.height)}
        </div>

        <div className="w-px h-5 bg-white/20 mx-0.5 shrink-0" />

        {/* 📸 Capture (Enter) */}
        <button
          onClick={() => handleConfirm(false)}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-neutral-950 font-semibold text-xs transition-colors shadow-sm cursor-pointer shrink-0"
          title="Capture to Screenshot Stream (Enter)"
        >
          <Camera className="w-3.5 h-3.5" />
          <span>Capture</span>
          <kbd className="ml-1 text-[10px] bg-black/20 text-neutral-900 px-1 py-0.5 rounded font-mono font-normal">↵</kbd>
        </button>

        {/* 📋 Copy to Clipboard */}
        <button
          onClick={() => handleConfirm(true)}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 active:bg-white/25 text-white text-xs border border-white/10 transition-colors cursor-pointer shrink-0"
          title={`Copy to Clipboard (${isMac ? '⌘C' : 'Ctrl+C'})`}
        >
          <Copy className="w-3.5 h-3.5" />
          <span>Copy</span>
          <kbd className="ml-1 text-[10px] bg-white/15 text-white/90 px-1 py-0.5 rounded font-mono">{isMac ? '⌘C' : 'Ctrl+C'}</kbd>
        </button>

        {/* ❌ Cancel (Esc) */}
        <button
          onClick={handleCancel}
          className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors text-xs cursor-pointer shrink-0"
          title="Cancel framing (Esc)"
        >
          <X className="w-3.5 h-3.5" />
          <span>Cancel</span>
          <kbd className="ml-1 text-[10px] bg-white/10 text-neutral-300 px-1 py-0.5 rounded font-mono">Esc</kbd>
        </button>
      </div>
    </div>
  );
};
