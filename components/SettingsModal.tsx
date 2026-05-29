import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { GameSettings } from '../types';

interface SettingsModalProps {
  settings: GameSettings;
  setSettings: React.Dispatch<React.SetStateAction<GameSettings>>;
  onClose: () => void;
  playSound: () => void;
  onVolumeChange: (v: number) => void;
}

type SettingsTab = 'Audio' | 'Video' | 'Gameplay' | 'Controls';

type TabMeta = {
  id: SettingsTab;
  label: string;
  eyebrow: string;
  description: string;
  accent: string;
};

type ControlRowProps = {
  label: string;
  desc: string;
  children: React.ReactNode;
  badge?: string;
};

type SliderRowProps = {
  id: string;
  label: string;
  desc: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  unit?: string;
  scale?: number;
};

type ToggleProps = {
  id: string;
  active: boolean;
  onToggle: () => void;
  playSound: () => void;
  disabled?: boolean;
  label: string;
};

const SETTINGS_TABS: TabMeta[] = [
  {
    id: 'Audio',
    label: 'Audio',
    eyebrow: 'Sound Field',
    description: 'Balance volume, atmosphere, and battle feedback.',
    accent: 'from-cyan-500/20 to-blue-500/5',
  },
  {
    id: 'Video',
    label: 'Graphics',
    eyebrow: 'Visual Stack',
    description: 'Control clarity, effects, camera response, and telemetry.',
    accent: 'from-violet-500/20 to-fuchsia-500/5',
  },
  {
    id: 'Gameplay',
    label: 'Gameplay',
    eyebrow: 'Interface',
    description: 'Tune HUD readability and battlefield information density.',
    accent: 'from-emerald-500/20 to-lime-500/5',
  },
  {
    id: 'Controls',
    label: 'Controls',
    eyebrow: 'Input Map',
    description: 'Review the core movement and combat bindings.',
    accent: 'from-amber-500/20 to-orange-500/5',
  },
];

const SHORTCUTS = [
  { key: 'WASD', title: 'Movement', desc: 'Tank locomotion' },
  { key: 'LMB', title: 'Fire', desc: 'Primary engagement' },
  { key: 'SPACE', title: 'Burst', desc: 'Evasive burst' },
  { key: 'SHIFT', title: 'Auto Fire', desc: 'Hold engagement' },
  { key: 'C', title: 'Auto Spin', desc: 'Gyro mode' },
  { key: 'K', title: 'Self Kill', desc: 'Reset pilot' },
  { key: 'O', title: 'Almanac', desc: 'Intel archive' },
  { key: 'P', title: 'Leaderboard', desc: 'Rank feed' },
  { key: 'ESC', title: 'Menu', desc: 'System menu' },
  { key: 'M', title: 'Mute', desc: 'Audio toggle' },
];

const formatPercent = (value: number, scale = 100): string => `${Math.round(value * scale)}%`;

const SectionHeader = ({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) => (
  <div className="mb-8">
    <div className="flex items-center gap-3 mb-4">
      <div className="h-1.5 w-12 rounded-full bg-cyan-400 shadow-[0_0_22px_rgba(34,211,238,0.55)]" />
      <span className="text-[0.65rem] font-black uppercase italic tracking-[0.38em] text-cyan-300/90">
        {eyebrow}
      </span>
    </div>
    <h3 className="text-3xl md:text-4xl font-black uppercase italic tracking-tight text-white leading-none">
      {title}
    </h3>
    <p className="mt-3 max-w-2xl text-sm font-semibold leading-relaxed text-white/42">
      {description}
    </p>
  </div>
);

const ControlRow = ({ label, desc, children, badge }: ControlRowProps) => (
  <div className="group rounded-[1.5rem] bg-white/[0.035] p-5 md:p-6 shadow-[0_18px_45px_rgba(0,0,0,0.22)] ring-1 ring-white/[0.055] transition-all duration-300 hover:bg-white/[0.055] hover:ring-white/10">
    <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[0.7rem] font-black uppercase italic tracking-[0.25em] text-white/68">
            {label}
          </span>
          {badge && (
            <span className="rounded-full bg-cyan-400/10 px-2.5 py-1 text-[0.6rem] font-black uppercase tracking-[0.18em] text-cyan-200 ring-1 ring-cyan-300/15">
              {badge}
            </span>
          )}
        </div>
        <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-white/28">
          {desc}
        </p>
      </div>
      <div className="flex shrink-0 items-center justify-start sm:justify-end">
        {children}
      </div>
    </div>
  </div>
);

const SliderRow = ({
  id,
  label,
  desc,
  value,
  min,
  max,
  step,
  onChange,
  unit = '%',
  scale = 100,
}: SliderRowProps) => {
  const safeRange = Math.max(0.0001, max - min);
  const percent = Math.max(0, Math.min(100, ((value - min) / safeRange) * 100));
  const renderedValue = unit === '%' ? formatPercent(value, scale) : `${Math.round(value * scale)}${unit}`;

  return (
    <div className="rounded-[1.5rem] bg-white/[0.035] p-5 md:p-6 shadow-[0_18px_45px_rgba(0,0,0,0.22)] ring-1 ring-white/[0.055]">
      <div className="mb-6 flex items-start justify-between gap-5">
        <div className="min-w-0">
          <label
            htmlFor={id}
            className="block text-[0.7rem] font-black uppercase italic tracking-[0.25em] text-white/68"
          >
            {label}
          </label>
          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-white/28">
            {desc}
          </p>
        </div>
        <span className="shrink-0 rounded-2xl bg-cyan-400/10 px-4 py-2 text-sm font-black tabular-nums text-cyan-200 ring-1 ring-cyan-300/15">
          {renderedValue}
        </span>
      </div>

      <div className="relative">
        <div className="pointer-events-none absolute left-0 top-1/2 h-1.5 w-full -translate-y-1/2 overflow-hidden rounded-full bg-white/7">
          <motion.div
            className="h-full rounded-full bg-cyan-400 shadow-[0_0_18px_rgba(34,211,238,0.7)]"
            animate={{ width: `${percent}%` }}
            transition={{ type: 'spring', stiffness: 180, damping: 24 }}
          />
        </div>
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.currentTarget.value))}
          className="relative z-10 h-8 w-full cursor-pointer appearance-none bg-transparent accent-cyan-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70"
        />
      </div>
    </div>
  );
};

const Toggle = ({ id, active, onToggle, playSound, disabled = false, label }: ToggleProps) => (
  <button
    id={id}
    type="button"
    role="switch"
    aria-label={label}
    aria-checked={active}
    disabled={disabled}
    onClick={() => {
      if (disabled) return;
      playSound();
      onToggle();
    }}
    className={`relative h-8 w-16 rounded-full p-1 transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70 disabled:cursor-not-allowed disabled:opacity-45 ${
      active
        ? 'bg-cyan-400/20 ring-1 ring-cyan-300/45'
        : 'bg-white/[0.055] ring-1 ring-white/10'
    }`}
  >
    <motion.span
      aria-hidden="true"
      animate={{ x: active ? 32 : 0 }}
      transition={{ type: 'spring', stiffness: 420, damping: 28 }}
      className={`block h-6 w-6 rounded-full ${
        active
          ? 'bg-cyan-300 shadow-[0_0_18px_rgba(34,211,238,0.8)]'
          : 'bg-white/35'
      }`}
    />
  </button>
);

const SegmentedDensity = ({
  value,
  onChange,
  playSound,
}: {
  value: number;
  onChange: (v: number) => void;
  playSound: () => void;
}) => {
  const levels = [
    { label: 'Low', value: 0.25, desc: 'Performance' },
    { label: 'Mid', value: 0.5, desc: 'Balanced' },
    { label: 'Max', value: 1.0, desc: 'Cinematic' },
  ];

  return (
    <div className="grid w-full grid-cols-3 gap-2 rounded-[1.25rem] bg-black/35 p-1.5 ring-1 ring-white/[0.06]">
      {levels.map((level) => {
        const active = value === level.value;
        return (
          <button
            key={level.label}
            type="button"
            onClick={() => {
              playSound();
              onChange(level.value);
            }}
            className={`rounded-2xl px-3 py-3 text-center transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70 ${
              active
                ? 'bg-cyan-300 text-black shadow-[0_0_22px_rgba(34,211,238,0.35)]'
                : 'text-white/42 hover:bg-white/[0.045] hover:text-white'
            }`}
          >
            <span className="block text-[0.65rem] font-black uppercase tracking-[0.2em]">
              {level.label}
            </span>
            <span className={`mt-1 block text-[0.55rem] font-black uppercase tracking-[0.16em] ${active ? 'text-black/55' : 'text-white/20'}`}>
              {level.desc}
            </span>
          </button>
        );
      })}
    </div>
  );
};

const ShortcutCard = ({ item }: { item: (typeof SHORTCUTS)[number] }) => (
  <div className="group flex min-h-[6rem] items-center gap-4 rounded-[1.5rem] bg-white/[0.035] p-5 shadow-[0_18px_45px_rgba(0,0,0,0.18)] ring-1 ring-white/[0.055] transition-all duration-300 hover:bg-white/[0.055] hover:ring-white/10">
    <div className="flex h-14 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/[0.06] text-xs font-black text-cyan-200 ring-1 ring-white/10 transition-transform duration-300 group-hover:scale-105">
      {item.key}
    </div>
    <div className="min-w-0">
      <p className="text-sm font-black uppercase italic tracking-[0.12em] text-white/75">
        {item.title}
      </p>
      <p className="mt-1 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-white/25">
        {item.desc}
      </p>
    </div>
  </div>
);

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  setSettings,
  onClose,
  playSound,
  onVolumeChange,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('Audio');
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const tabRefs = useRef<Record<SettingsTab, HTMLButtonElement | null>>({
    Audio: null,
    Video: null,
    Gameplay: null,
    Controls: null,
  });

  const activeMeta = useMemo(
    () => SETTINGS_TABS.find((tab) => tab.id === activeTab) || SETTINGS_TABS[0],
    [activeTab]
  );

  const updateSetting = <K extends keyof GameSettings>(key: K, value: GameSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const selectTab = (tab: SettingsTab) => {
    playSound();
    setActiveTab(tab);
  };

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const previousActive = document.activeElement as HTMLElement | null;
    const closeButton = dialog.querySelector<HTMLButtonElement>('[data-autofocus="true"]');
    closeButton?.focus();

    const getFocusable = () =>
      Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), [href], select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((node) => !node.hasAttribute('aria-hidden'));

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        playSound();
        onClose();
        return;
      }

      if (event.key !== 'Tab') return;

      const focusable = getFocusable();
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previousActive?.focus?.();
    };
  }, [onClose, playSound]);

  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const currentIndex = SETTINGS_TABS.findIndex((tab) => tab.id === activeTab);
    let nextIndex = currentIndex;

    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      event.preventDefault();
      nextIndex = (currentIndex + 1) % SETTINGS_TABS.length;
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      event.preventDefault();
      nextIndex = (currentIndex - 1 + SETTINGS_TABS.length) % SETTINGS_TABS.length;
    } else if (event.key === 'Home') {
      event.preventDefault();
      nextIndex = 0;
    } else if (event.key === 'End') {
      event.preventDefault();
      nextIndex = SETTINGS_TABS.length - 1;
    } else {
      return;
    }

    const nextTab = SETTINGS_TABS[nextIndex].id;
    setActiveTab(nextTab);
    tabRefs.current[nextTab]?.focus();
    playSound();
  };

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/95 p-3 backdrop-blur-[56px] md:p-6"
      onClick={onClose}
    >
      <motion.div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-modal-title"
        initial={{ scale: 0.92, opacity: 0, y: 18, filter: 'blur(10px)' }}
        animate={{ scale: 1, opacity: 1, y: 0, filter: 'blur(0px)' }}
        exit={{ scale: 0.92, opacity: 0, y: 18, filter: 'blur(10px)' }}
        transition={{ type: 'spring', damping: 25, stiffness: 220 }}
        className="flex h-[92vh] w-full max-w-6xl overflow-hidden rounded-[2rem] bg-[#050505] shadow-[0_0_140px_rgba(0,0,0,1)] ring-1 ring-white/[0.08] md:rounded-[3rem]"
        onClick={(event) => event.stopPropagation()}
      >
        <aside className="hidden w-[21rem] shrink-0 flex-col bg-white/[0.018] p-6 ring-1 ring-white/[0.05] lg:flex xl:w-[23rem] xl:p-8">
          <div className="mb-8 shrink-0">
            <div className="mb-5 h-1.5 w-14 rounded-full bg-cyan-400 shadow-[0_0_22px_rgba(34,211,238,0.65)]" />
            <h2
              id="settings-modal-title"
              className="text-4xl font-black uppercase italic leading-[0.9] tracking-tight text-white xl:text-5xl"
            >
              System<br />
              <span className="text-white/20">Settings</span>
            </h2>
            <p className="mt-5 border-l border-white/10 pl-4 text-[0.68rem] font-bold uppercase leading-relaxed tracking-[0.2em] text-white/30">
              Configure the combat interface without digging through a massive vertical list.
            </p>
          </div>

          <div
            role="tablist"
            aria-label="Settings categories"
            onKeyDown={handleTabKeyDown}
            className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1 custom-scrollbar"
          >
            {SETTINGS_TABS.map((tab) => {
              const active = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  ref={(node) => {
                    tabRefs.current[tab.id] = node;
                  }}
                  type="button"
                  role="tab"
                  id={`settings-tab-${tab.id}`}
                  aria-selected={active}
                  aria-controls={`settings-panel-${tab.id}`}
                  tabIndex={active ? 0 : -1}
                  onClick={() => selectTab(tab.id)}
                  className={`group w-full rounded-[1.35rem] p-4 text-left transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70 ${
                    active
                      ? 'bg-white text-black shadow-[0_0_35px_rgba(255,255,255,0.12)]'
                      : 'bg-white/[0.025] text-white/42 ring-1 ring-white/[0.055] hover:bg-white/[0.045] hover:text-white'
                  }`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-[0.68rem] font-black uppercase italic tracking-[0.23em]">
                        {tab.label}
                      </p>
                      <p className={`mt-1 text-[0.58rem] font-black uppercase tracking-[0.15em] ${active ? 'text-black/45' : 'text-white/22'}`}>
                        {tab.eyebrow}
                      </p>
                    </div>
                    <span className={`h-2.5 w-2.5 rounded-full ${active ? 'bg-black' : 'bg-white/14 group-hover:bg-cyan-300/70'}`} />
                  </div>
                </button>
              );
            })}
          </div>

          <div className={`mt-6 rounded-[1.5rem] bg-gradient-to-br ${activeMeta.accent} p-5 ring-1 ring-white/[0.055]`}>
            <p className="text-[0.6rem] font-black uppercase tracking-[0.25em] text-white/35">
              Active Section
            </p>
            <p className="mt-2 text-lg font-black uppercase italic text-white">
              {activeMeta.label}
            </p>
            <p className="mt-2 text-xs font-semibold leading-relaxed text-white/35">
              {activeMeta.description}
            </p>
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          <header className="shrink-0 border-b border-white/[0.055] bg-black/28 px-6 py-5 md:px-8 lg:px-10">
            <div className="flex items-start justify-between gap-5">
              <div className="min-w-0 lg:hidden">
                <div className="mb-3 flex items-center gap-3">
                  <div className="h-1.5 w-12 rounded-full bg-cyan-400 shadow-[0_0_18px_rgba(34,211,238,0.55)]" />
                  <span className="text-[0.62rem] font-black uppercase italic tracking-[0.34em] text-cyan-300">
                    Configuration
                  </span>
                </div>
                <h2
                  id="settings-modal-title-mobile"
                  className="text-2xl font-black uppercase italic tracking-tight text-white md:text-4xl"
                >
                  System Settings
                </h2>
              </div>

              <div className="hidden min-w-0 lg:block">
                <p className="text-[0.65rem] font-black uppercase italic tracking-[0.35em] text-cyan-300/85">
                  Configuration Interface
                </p>
                <h2 className="mt-2 text-2xl font-black uppercase italic tracking-tight text-white">
                  {activeMeta.label} Controls
                </h2>
              </div>

              <button
                type="button"
                data-autofocus="true"
                onClick={() => {
                  playSound();
                  onClose();
                }}
                aria-label="Close settings"
                className="ml-auto flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/[0.045] text-white/45 ring-1 ring-white/10 transition-all duration-300 hover:bg-white/[0.08] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div
              role="tablist"
              aria-label="Settings categories"
              onKeyDown={handleTabKeyDown}
              className="mt-5 flex gap-2 overflow-x-auto rounded-[1.5rem] bg-white/[0.035] p-1.5 custom-scrollbar lg:hidden"
            >
              {SETTINGS_TABS.map((tab) => {
                const active = activeTab === tab.id;

                return (
                  <button
                    key={tab.id}
                    ref={(node) => {
                      tabRefs.current[tab.id] = node;
                    }}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    aria-controls={`settings-panel-${tab.id}`}
                    tabIndex={active ? 0 : -1}
                    onClick={() => selectTab(tab.id)}
                    className={`relative shrink-0 rounded-[1.15rem] px-5 py-3 text-[0.65rem] font-black uppercase tracking-[0.18em] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70 ${
                      active ? 'text-black' : 'text-white/38 hover:text-white'
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="settings-mobile-tab-bg"
                        className="absolute inset-0 rounded-[1.15rem] bg-white"
                        transition={{ type: 'spring', stiffness: 260, damping: 26 }}
                      />
                    )}
                    <span className="relative z-10">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </header>

          <main className="min-h-0 flex-1 overflow-y-auto px-6 py-7 custom-scrollbar md:px-8 md:py-9 lg:px-10 xl:px-12">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                role="tabpanel"
                id={`settings-panel-${activeTab}`}
                aria-labelledby={`settings-tab-${activeTab}`}
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ type: 'spring', damping: 25, stiffness: 210 }}
              >
                {activeTab === 'Audio' && (
                  <>
                    <SectionHeader
                      eyebrow="Audio Stack"
                      title="Sound Calibration"
                      description="Keep combat feedback sharp without turning every shot into a speaker warcrime."
                    />

                    <div className="grid gap-5 xl:grid-cols-2">
                      <SliderRow
                        id="settings-master-volume"
                        label="Master Volume"
                        desc="Global combat, UI, impact, and weapon output."
                        value={settings.volume}
                        min={0}
                        max={0.5}
                        step={0.01}
                        scale={200}
                        onChange={(v) => {
                          updateSetting('volume', v);
                          onVolumeChange(v);
                        }}
                      />
                      <SliderRow
                        id="settings-music-volume"
                        label="Music Atmosphere"
                        desc="Background soundtrack and ambient layer mix."
                        value={settings.musicVolume}
                        min={0}
                        max={1}
                        step={0.05}
                        onChange={(v) => updateSetting('musicVolume', v)}
                      />
                      <ControlRow
                        label="Spatial Effects"
                        desc="3D sound field virtualization. Visual-only placeholder until exposed in settings."
                        badge="Preview"
                      >
                        <Toggle
                          id="settings-spatial-toggle"
                          active={true}
                          disabled
                          onToggle={() => undefined}
                          playSound={playSound}
                          label="Spatial effects"
                        />
                      </ControlRow>
                      <ControlRow
                        label="Tactical Feedback"
                        desc="Extra engagement response for hits, shields, and nearby impacts."
                        badge="Preview"
                      >
                        <Toggle
                          id="settings-tactical-feedback-toggle"
                          active={true}
                          disabled
                          onToggle={() => undefined}
                          playSound={playSound}
                          label="Tactical feedback"
                        />
                      </ControlRow>
                    </div>
                  </>
                )}

                {activeTab === 'Video' && (
                  <>
                    <SectionHeader
                      eyebrow="Visual Stack"
                      title="Graphics & Clarity"
                      description="Control how intense, readable, and noisy the battlefield feels during fights."
                    />

                    <div className="grid gap-5 xl:grid-cols-2">
                      <ControlRow label="Dark Protocol" desc="High contrast ocular safety mode.">
                        <Toggle
                          id="settings-dark-mode-toggle"
                          active={settings.darkMode}
                          onToggle={() => updateSetting('darkMode', !settings.darkMode)}
                          playSound={playSound}
                          label="Dark mode"
                        />
                      </ControlRow>

                      <ControlRow label="Structural Shake" desc="Kinetic camera response to impacts and heavy fire.">
                        <Toggle
                          id="settings-shake-toggle"
                          active={settings.shakeEnabled}
                          onToggle={() => updateSetting('shakeEnabled', !settings.shakeEnabled)}
                          playSound={playSound}
                          label="Camera shake"
                        />
                      </ControlRow>

                      <AnimatePresence initial={false}>
                        {settings.shakeEnabled && (
                          <motion.div
                            className="xl:col-span-2"
                            initial={{ opacity: 0, y: -8, height: 0 }}
                            animate={{ opacity: 1, y: 0, height: 'auto' }}
                            exit={{ opacity: 0, y: -8, height: 0 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 210 }}
                          >
                            <SliderRow
                              id="settings-shake-intensity"
                              label="Shake Intensity"
                              desc="Strength of camera recoil during explosions and impacts."
                              value={settings.shakeIntensity}
                              min={0.1}
                              max={2}
                              step={0.1}
                              scale={100}
                              onChange={(v) => updateSetting('shakeIntensity', v)}
                            />
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <ControlRow label="Telemetry Overlay" desc="Real-time performance metrics and FPS readout.">
                        <Toggle
                          id="settings-fps-toggle"
                          active={settings.showFps}
                          onToggle={() => updateSetting('showFps', !settings.showFps)}
                          playSound={playSound}
                          label="Show FPS"
                        />
                      </ControlRow>

                      <ControlRow label="Particle Resolution" desc="Impact debris, exhaust trails, and combat effect density.">
                        <SegmentedDensity
                          value={settings.particleDensity}
                          playSound={playSound}
                          onChange={(v) => updateSetting('particleDensity', v)}
                        />
                      </ControlRow>
                    </div>
                  </>
                )}

                {activeTab === 'Gameplay' && (
                  <>
                    <SectionHeader
                      eyebrow="HUD & Gameplay"
                      title="Interface Behaviour"
                      description="Tune battlefield information so the UI helps you play instead of suffocating the screen."
                    />

                    <div className="grid gap-5 xl:grid-cols-2">
                      <ControlRow label="Tactical Minimap" desc="Real-time sector mapping and positional awareness.">
                        <Toggle
                          id="settings-minimap-toggle"
                          active={settings.showMinimap}
                          onToggle={() => updateSetting('showMinimap', !settings.showMinimap)}
                          playSound={playSound}
                          label="Show minimap"
                        />
                      </ControlRow>

                      <ControlRow label="Rank Leaderboard" desc="Active pilot standing hierarchy.">
                        <Toggle
                          id="settings-leaderboard-toggle"
                          active={settings.showLeaderboard}
                          onToggle={() => updateSetting('showLeaderboard', !settings.showLeaderboard)}
                          playSound={playSound}
                          label="Show leaderboard"
                        />
                      </ControlRow>

                      <ControlRow label="Compact Scores" desc="Display large score values as k, m, b, and t notation.">
                        <Toggle
                          id="settings-compact-score-toggle"
                          active={settings.compactScoreNotation}
                          onToggle={() => updateSetting('compactScoreNotation', !settings.compactScoreNotation)}
                          playSound={playSound}
                          label="Compact score notation"
                        />
                      </ControlRow>

                      <ControlRow
                        label="Auto Fire System"
                        desc="Smart turret engagement preference. Visual-only placeholder until exposed in settings."
                        badge="Input"
                      >
                        <Toggle
                          id="settings-autofire-toggle"
                          active={false}
                          disabled
                          onToggle={() => undefined}
                          playSound={playSound}
                          label="Auto fire system"
                        />
                      </ControlRow>

                      <div className="xl:col-span-2">
                        <SliderRow
                          id="settings-interface-scale"
                          label="Interface Scale"
                          desc="Overall HUD scale and readability."
                          value={settings.uiScale}
                          min={0.8}
                          max={1.2}
                          step={0.05}
                          scale={100}
                          onChange={(v) => updateSetting('uiScale', v)}
                        />
                      </div>
                    </div>
                  </>
                )}

                {activeTab === 'Controls' && (
                  <>
                    <SectionHeader
                      eyebrow="Input Map"
                      title="Control Reference"
                      description="A cleaner keyboard reference with enough breathing room to read during setup."
                    />

                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                      {SHORTCUTS.map((item) => (
                        <ShortcutCard key={item.key} item={item} />
                      ))}
                    </div>
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          </main>

          <footer className="shrink-0 border-t border-white/[0.055] bg-black/45 px-6 py-5 md:px-8 lg:px-10">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[0.62rem] font-black uppercase italic tracking-[0.28em] text-white/18">
                System Protocol v4.2.0
              </p>
              <button
                type="button"
                onClick={() => {
                  playSound();
                  onClose();
                }}
                className="rounded-2xl bg-white px-7 py-4 text-[0.7rem] font-black uppercase italic tracking-[0.28em] text-black shadow-[0_18px_45px_rgba(255,255,255,0.11)] transition-all duration-300 hover:scale-[1.02] active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80"
              >
                Save Configurations
              </button>
            </div>
          </footer>
        </section>
      </motion.div>
    </div>
  );
};
