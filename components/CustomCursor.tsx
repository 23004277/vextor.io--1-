import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';

const CustomCursor: React.FC<{ isPlaying: boolean }> = ({ isPlaying }) => {
  const cursorRef = useRef<HTMLDivElement>(null);
  const [isClicking, setIsClicking] = useState(false);
  const [isPointer, setIsPointer] = useState(false);
  const [isTextEntry, setIsTextEntry] = useState(false);

  useEffect(() => {
    const cursor = cursorRef.current;
    if (!cursor) return;
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const supportsFinePointer = window.matchMedia('(pointer: fine)').matches;
    if (!supportsFinePointer) return;

    document.body.classList.add('vextor-custom-cursor');

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

      const insideNativeCursor = target.closest('.native-cursor') !== null;
      const isEditableTarget =
        insideNativeCursor ||
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable;

      setIsTextEntry(isEditableTarget);
      if (isEditableTarget) {
        setIsPointer(false);
        return;
      }

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
      document.body.classList.remove('vextor-custom-cursor');
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const variant = isTextEntry ? 'hidden' : isPointer ? 'pointer' : isPlaying ? 'playing' : 'default';

  return (
    <div
      ref={cursorRef}
      className="fixed top-0 left-0 pointer-events-none z-[9999] flex items-center justify-center will-change-transform"
      style={{
        transform: 'translate3d(0, 0, 0) translate(-50%, -50%)'
      }}
    >
      <motion.div
        animate={{ scale: isClicking ? 0.65 : 1, opacity: isTextEntry ? 0 : 1 }}
        transition={{ type: 'spring', stiffness: 800, damping: 20 }}
        className="relative flex items-center justify-center"
      >
        <motion.div
          aria-hidden
          animate={{
            scale: isPointer ? 1.18 : isPlaying ? 1.1 : 1,
            opacity: isClicking ? 0.9 : 0.7,
          }}
          transition={{ type: 'spring', stiffness: 360, damping: 24 }}
          className="absolute h-12 w-12 rounded-full border border-white/12 bg-white/[0.03] shadow-[0_0_24px_rgba(255,255,255,0.08)] backdrop-blur-[2px]"
        />

        <AnimatePresence>
          {variant === 'playing' && (
            <motion.div
              key="playing"
              initial={{ opacity: 0, scale: 0.2, rotate: -90 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              exit={{ opacity: 0, scale: 0.2, rotate: 90 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="absolute flex items-center justify-center w-10 h-10"
            >
              <div className="absolute inset-0 rounded-full border border-cyan-300/45 shadow-[0_0_18px_rgba(34,211,238,0.28)]" />
              <div className="absolute w-full h-[2px] bg-cyan-200 shadow-[0_0_10px_rgba(103,232,249,0.95)] rounded-full" />
              <div className="absolute h-full w-[2px] bg-cyan-200 shadow-[0_0_10px_rgba(103,232,249,0.95)] rounded-full" />
              <div className="absolute w-2 h-2 bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,1)]" />
              <div className="absolute w-4 h-4 rounded-full border border-cyan-100/70" />
            </motion.div>
          )}

          {variant === 'pointer' && (
            <motion.div
              key="pointer"
              initial={{ opacity: 0, scale: 0.2 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.2 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="absolute flex items-center justify-center w-12 h-12"
            >
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0 border-[2px] border-dashed border-yellow-300 rounded-full shadow-[0_0_14px_rgba(250,204,21,0.5)]"
              />
              <div className="absolute inset-[6px] rounded-full border border-yellow-100/45" />
              <div className="w-3 h-3 bg-yellow-300 rounded-full shadow-[0_0_12px_rgba(253,224,71,0.95)]" />
            </motion.div>
          )}

          {variant === 'default' && (
            <motion.div
              key="default"
              initial={{ opacity: 0, scale: 0.2 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.2 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="absolute flex items-center justify-center w-10 h-10"
            >
              <div className="absolute inset-0 rounded-full border-[1.5px] border-white/70 shadow-[0_0_16px_rgba(255,255,255,0.15)]" />
              <div className="absolute inset-[7px] rounded-full border border-cyan-100/18" />
              <div className="w-2 h-2 bg-white rounded-full shadow-[0_0_8px_rgba(255,255,255,0.95)]" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default CustomCursor;
