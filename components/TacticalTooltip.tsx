
import React from 'react';

interface TacticalTooltipProps {
    label: string;
    desc?: string;
    x: number;
    y: number;
    visible: boolean;
}

export const TacticalTooltip: React.FC<TacticalTooltipProps> = ({ label, desc, x, y, visible }) => {
    if (!visible) return null;

    // Offset to prevent the tooltip from being directly under the cursor
    const offsetX = 20;
    const offsetY = 20;

    // Check if tooltip would overflow right side of screen
    const wouldOverflowRight = x + 250 > window.innerWidth;
    const finalX = wouldOverflowRight ? x - 270 : x + offsetX;
    const finalY = y + offsetY;

    return (
        <div 
            className="fixed z-[9999] pointer-events-none transition-opacity duration-150 ease-out animate-in fade-in zoom-in-95"
            style={{ 
                left: `${finalX}px`, 
                top: `${finalY}px`,
                opacity: visible ? 1 : 0
            }}
        >
            <div className="relative min-w-[220px] max-w-[300px] p-4 rounded-xl bg-black/90 border border-cyan-500/40 backdrop-blur-md shadow-[0_10px_40px_rgba(0,0,0,0.8)] overflow-hidden">
                {/* Decorative scanning line */}
                <div className="absolute top-0 left-0 w-full h-0.5 bg-cyan-500/20 animate-sweep"></div>
                
                <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-1.5">
                        <div className="w-1 h-3 bg-cyan-500 rounded-full"></div>
                        <span className="text-[10px] font-black text-cyan-400 uppercase tracking-[0.2em] font-mono leading-none">
                            {label}
                        </span>
                    </div>
                    {desc && (
                        <p className="text-[9px] font-bold text-white/50 leading-relaxed uppercase tracking-tight font-mono">
                            {desc}
                        </p>
                    )}
                </div>

                {/* Corner detail */}
                <div className="absolute bottom-1 right-1 opacity-20">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="cyan" strokeWidth="2">
                        <path d="M12 8V12H8" />
                    </svg>
                </div>
            </div>
        </div>
    );
};
