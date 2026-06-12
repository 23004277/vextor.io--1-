import React from 'react';
import { motion } from 'motion/react';

type ClickToPlayGateProps = {
  activating: boolean;
  onActivate: () => void | Promise<void>;
};

const GATE_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

export function ClickToPlayGate({ activating, onActivate }: ClickToPlayGateProps) {
  return (
    <motion.button
      type="button"
      aria-label="Click to play"
      onClick={() => void onActivate()}
      disabled={activating}
      initial={{ opacity: 1 }}
      animate={{
        opacity: activating ? 0 : 1,
        scale: activating ? 1.04 : 1,
      }}
      exit={{
        opacity: 0,
        transition: { duration: 0.32, ease: GATE_EASE },
      }}
      transition={{
        duration: activating ? 0.46 : 0.28,
        ease: GATE_EASE,
      }}
      className="absolute inset-0 z-[120] flex cursor-pointer items-center justify-center overflow-hidden bg-[#020617] outline-none disabled:cursor-default"
    >
      <motion.div
        aria-hidden="true"
        className="absolute inset-0"
        animate={{
          background: activating
            ? [
                'radial-gradient(circle at center, rgba(34,211,238,0.16), rgba(2,6,23,1) 58%)',
                'radial-gradient(circle at center, rgba(129,140,248,0.30), rgba(2,6,23,1) 72%)',
                'radial-gradient(circle at center, rgba(255,255,255,0.92), rgba(34,211,238,0.24) 18%, rgba(2,6,23,1) 76%)',
              ]
            : 'radial-gradient(circle at center, rgba(34,211,238,0.12), rgba(2,6,23,1) 62%)',
        }}
        transition={{ duration: 0.72, ease: 'easeOut' }}
      />

      <div className="pointer-events-none absolute inset-0 opacity-[0.18] [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:44px_44px]" />

      <motion.div
        aria-hidden="true"
        className="absolute h-[34rem] w-[34rem] rounded-full border border-cyan-300/20"
        animate={{
          scale: activating ? [1, 1.38, 2.4] : [1, 1.06, 1],
          opacity: activating ? [0.55, 0.88, 0] : [0.35, 0.62, 0.35],
        }}
        transition={{
          duration: activating ? 0.78 : 2.4,
          repeat: activating ? 0 : Infinity,
          ease: 'easeInOut',
        }}
      />

      <motion.div
        aria-hidden="true"
        className="absolute h-[21rem] w-[21rem] rounded-full border border-indigo-300/20"
        animate={{
          scale: activating ? [1, 0.78, 2.1] : [1.04, 1, 1.04],
          opacity: activating ? [0.4, 0.96, 0] : [0.22, 0.44, 0.22],
        }}
        transition={{
          duration: activating ? 0.68 : 2,
          repeat: activating ? 0 : Infinity,
          ease: 'easeInOut',
        }}
      />

      <motion.div
        className="relative flex max-w-[90vw] flex-col items-center gap-6 px-6 text-center"
        animate={{
          scale: activating ? [1, 0.97, 1.14] : [1, 1.02, 1],
          opacity: activating ? [1, 1, 0] : 1,
          filter: activating ? ['blur(0px)', 'blur(0px)', 'blur(12px)'] : 'blur(0px)',
        }}
        transition={{
          duration: activating ? 0.7 : 2,
          repeat: activating ? 0 : Infinity,
          ease: GATE_EASE,
        }}
      >
        <div className="rounded-full border border-cyan-300/25 bg-cyan-300/5 px-5 py-2 text-[11px] font-black uppercase tracking-[0.5em] text-cyan-100/80 shadow-[0_0_45px_rgba(34,211,238,0.14)]">
          VEXTOR ONLINE
        </div>

        <h1 className="select-none text-[clamp(3rem,8vw,6.5rem)] font-black uppercase tracking-[0.22em] text-white drop-shadow-[0_0_32px_rgba(34,211,238,0.55)]">
          Click To Play
        </h1>

        <p className="max-w-[42rem] text-[clamp(0.95rem,1.2vw,1.08rem)] leading-7 text-cyan-100/62">
          Unlock the soundtrack and bring the command deck online.
        </p>

        <div className="h-[2px] w-[28rem] max-w-[70vw] overflow-hidden rounded-full bg-white/10">
          <motion.div
            className="h-full w-1/3 rounded-full bg-cyan-200 shadow-[0_0_24px_rgba(34,211,238,0.9)]"
            animate={{ x: ['-120%', '330%'] }}
            transition={{
              duration: 1.4,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        </div>

        <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-white/42">
          Click anywhere or press Enter / Space
        </div>
      </motion.div>

      {activating && (
        <motion.div
          className="absolute inset-0 bg-white"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.9, 0] }}
          transition={{ duration: 0.4, ease: 'easeOut', delay: 0.18 }}
        />
      )}
    </motion.button>
  );
}
