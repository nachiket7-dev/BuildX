import React, { useState, useEffect, useRef, useCallback } from 'react';

interface CodePreviewSplitProps {
  codeElement: React.ReactNode;
  previewElement: React.ReactNode;
}

export function CodePreviewSplit({ codeElement, previewElement }: CodePreviewSplitProps) {
  const [splitWidth, setSplitWidth] = useState(50); // percentage for code element
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const startDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDrag = useCallback((e: MouseEvent) => {
    if (!isDragging || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const relativeX = e.clientX - rect.left;
    const percentage = Math.max(20, Math.min(80, (relativeX / rect.width) * 100));
    setSplitWidth(percentage);
  }, [isDragging]);

  const stopDrag = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', onDrag);
      window.addEventListener('mouseup', stopDrag);
    } else {
      window.removeEventListener('mousemove', onDrag);
      window.removeEventListener('mouseup', stopDrag);
    }
    return () => {
      window.removeEventListener('mousemove', onDrag);
      window.removeEventListener('mouseup', stopDrag);
    };
  }, [isDragging, onDrag, stopDrag]);

  return (
    <div 
      ref={containerRef} 
      className="w-full flex flex-col lg:flex-row gap-4 lg:gap-0 select-none relative"
      style={{ minHeight: '580px' }}
    >
      {/* Code Studio Pane */}
      <div 
        className="w-full lg:h-full min-w-0 transition-all duration-75"
        style={{ flexBasis: `${splitWidth}%`, flexShrink: 0 }}
      >
        {codeElement}
      </div>

      {/* Draggable Divider Handle (Desktop only) */}
      <div
        onMouseDown={startDrag}
        className={`hidden lg:flex w-2 items-center justify-center cursor-col-resize hover:bg-purple-500/30 transition-all select-none z-20 relative self-stretch ${
          isDragging ? 'bg-purple-500' : 'bg-transparent'
        }`}
      >
        <div className="w-1 h-8 rounded-full bg-white/20 hover:bg-white/40" />
      </div>

      {/* Live Preview Sandbox Pane */}
      <div 
        className="w-full lg:h-full min-w-0 transition-all duration-75 lg:pl-4"
        style={{ flex: 1 }}
      >
        {previewElement}
      </div>
    </div>
  );
}
