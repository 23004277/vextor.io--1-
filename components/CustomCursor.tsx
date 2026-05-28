import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';

const CustomCursor: React.FC<{ isPlaying: boolean }> = ({ isPlaying }) => {
  const cursorRef = useRef<HTMLDivElement>(null);
  const [isClicking, setIsClicking] = useState(false);
  const [isPointer, setIsPointer] = useState(false);

  useEffect(() => {
    const cursor = cursorRef.current;
    if (!cursor) return;

    const handleMouseMove = (e: MouseEvent) => {
      // Use requestAnimationFrame for buttery smooth movement
      requestAnimationFrame(() => {
        if (cursor) {
          cursor.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0) translate(-50%, -50%)`;
        }
      });
      
      // Check if hovering over interactive elements
      const target = e.target as HTMLElement;
      if (!target) return;

      const computedCursor = window.getComputedStyle(target).cursor;
      setIsPointer(
        computedCursor === 'pointer' ||
        target.tagName === 'BUTTON' ||
        target.tagName === 'A' ||
        target.closest('button') !== null ||
        target.closest('a') !== null
      );
    };

    const handleMouseDown = () => setIsClicking(true);
    const handleMouseUp = () => setIsClicking(false);

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const variant = isPointer ? 'pointer' : isPlaying ? 'playing' : 'default';

  return (
    <div
      ref={cursorRef}
      className="fixed top-0 left-0 pointer-events-none z-[9999] flex items-center justify-center will-change-transform"
      style={{
        transform: 'translate3d(0, 0, 0) translate(-50%, -50%)'
      }}
    >
      <motion.div
        animate={{ scale: isClicking ? 0.65 : 1 }}
        transition={{ type: 'spring', stiffness: 800, damping: 20 }}
        className="relative flex items-center justify-center"
      >
        <AnimatePresence>
          {variant === 'playing' && (
            <motion.div
              key="playing"
              initial={{ opacity: 0, scale: 0.2, rotate: -90 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              exit={{ opacity: 0, scale: 0.2, rotate: 90 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="absolute flex items-center justify-center w-7 h-7"
            >
              <div className="absolute w-full h-[2px] bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)] rounded-full" />
              <div className="absolute h-full w-[2px] bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)] rounded-full" />
              <div className="absolute w-1.5 h-1.5 bg-white rounded-full shadow-[0_0_5px_rgba(255,255,255,1)]" />
            </motion.div>
          )}

          {variant === 'pointer' && (
            <motion.div
              key="pointer"
              initial={{ opacity: 0, scale: 0.2 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.2 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="absolute flex items-center justify-center w-10 h-10"
            >
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0 border-[2px] border-dashed border-yellow-400/90 rounded-full shadow-[0_0_10px_rgba(250,204,21,0.4)]"
              />
              <div className="w-2.5 h-2.5 bg-yellow-400 rounded-full shadow-[0_0_8px_rgba(250,204,21,0.9)]" />
            </motion.div>
          )}

          {variant === 'default' && (
            <motion.div
              key="default"
              initial={{ opacity: 0, scale: 0.2 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.2 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="absolute flex items-center justify-center w-8 h-8"
            >
              <div className="absolute inset-0 border-[1.5px] border-white/50 rounded-full" />
              <div className="w-1.5 h-1.5 bg-white rounded-full shadow-[0_0_5px_rgba(255,255,255,0.8)]" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default CustomCursor;
