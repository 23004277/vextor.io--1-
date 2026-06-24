import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { GameSettings } from '../types';
import { CommandButton } from './menu-ui/CommandButton';
import { CommandHeader } from './menu-ui/CommandHeader';
import { CommandOverlay } from './menu-ui/CommandOverlay';
import { CommandShell } from './menu-ui/CommandShell';
import { useCommandDialog } from './menu-ui/useCommandDialog';
import { COMMAND_THEME_CLASS, commandCx } from './uiTheme';

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
  subtitle: string;
  description: string;
  accent: string;
  accentSoft: string;
};

const TAB_META: TabMeta[] = [
  {
    id: 'Audio',
    label: 'Audio',
    subtitle: 'Sound Field',
    description: 'Tune mix levels and combat feedback.',
    accent: '#22d3ee',
    accentSoft: 'rgba(34, 211, 238, 0.18)',
  },
  {
    id: 'Video',
    label: 'Video',
    subtitle: 'Visual Stack',
    description: 'Clarity, effects, and camera feel.',
    accent: '#c084fc',
    accentSoft: 'rgba(192, 132, 252, 0.2)',
  },
  {
    id: 'Gameplay',
    label: 'Gameplay',
    subtitle: 'HUD & Info',
    description: 'Battlefield readability and overlays.',
    accent: '#4ade80',
    accentSoft: 'rgba(74, 222, 128, 0.2)',
  },
  {
    id: 'Controls',
    label: 'Controls',
    subtitle: 'Input Map',
    description: 'Quick keyboard and action reference.',
    accent: '#fbbf24',
    accentSoft: 'rgba(251, 191, 36, 0.2)',
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

const rowWrap = commandCx(COMMAND_THEME_CLASS.shellInset, 'rounded-2xl p-5 md:p-6');

const formatPercent = (v: number, scale = 100) => `${Math.round(v * scale)}%`;

const Row = ({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) => (
  <div className={rowWrap}>
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-[0.72rem] font-black uppercase tracking-[0.2em] text-white/78">{title}</p>
        <p className="mt-2 text-[0.67rem] font-bold uppercase tracking-[0.14em] text-white/35">{desc}</p>
      </div>
      <div>{children}</div>
    </div>
  </div>
);

const Toggle = ({
  active,
  onToggle,
  disabled,
  accent,
  label,
}: {
  active: boolean;
  onToggle: () => void;
  disabled?: boolean;
  accent: string;
  label: string;
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={active}
    aria-label={label}
    disabled={disabled}
    onClick={onToggle}
    className="relative h-8 w-16 rounded-full p-1 ring-1 ring-white/15 transition disabled:opacity-45 disabled:cursor-not-allowed"
    style={{ background: active ? `${accent}2f` : 'rgba(255,255,255,0.06)' }}
  >
    <motion.span
      animate={{ x: active ? 32 : 0 }}
      transition={{ type: 'spring', stiffness: 420, damping: 28 }}
      className="block h-6 w-6 rounded-full"
      style={{ background: active ? accent : 'rgba(255,255,255,0.45)', boxShadow: active ? `0 0 14px ${accent}` : 'none' }}
    />
  </button>
);

const Slider = ({
  id, label, desc, value, min, max, step, onChange, accent, badge,
}: {
  id: string;
  label: string;
  desc: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  accent: string;
  badge: string;
}) => {
  const width = ((value - min) / Math.max(0.0001, max - min)) * 100;
  return (
    <div className={rowWrap}>
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <label htmlFor={id} className="text-[0.72rem] font-black uppercase tracking-[0.2em] text-white/78">{label}</label>
          <p className="mt-2 text-[0.67rem] font-bold uppercase tracking-[0.14em] text-white/35">{desc}</p>
        </div>
        <span className="rounded-xl px-3 py-1.5 text-xs font-black tabular-nums ring-1" style={{ color: accent, borderColor: `${accent}55`, background: `${accent}22` }}>
          {badge}
        </span>
      </div>
      <div className="relative">
        <div className="pointer-events-none absolute left-0 top-1/2 h-1.5 w-full -translate-y-1/2 rounded-full bg-white/10">
          <motion.div animate={{ width: `${Math.max(0, Math.min(100, width))}%` }} className="h-full rounded-full" style={{ background: accent, boxShadow: `0 0 14px ${accent}` }} />
        </div>
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.currentTarget.value))}
          className="relative z-10 h-8 w-full appearance-none bg-transparent cursor-pointer"
          style={{ accentColor: accent }}
        />
      </div>
    </div>
  );
};

export const SettingsModal: React.FC<SettingsModalProps> = ({ settings, setSettings, onClose, playSound, onVolumeChange }) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('Audio');
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const activeMeta = useMemo(() => TAB_META.find((x) => x.id === activeTab) ?? TAB_META[0], [activeTab]);
  const handleClose = () => {
    playSound();
    onClose();
  };

  const updateSetting = <K extends keyof GameSettings>(key: K, value: GameSettings[K]) =>
    setSettings((prev) => ({ ...prev, [key]: value }));

  useCommandDialog({ containerRef: dialogRef, onClose: handleClose });

  return (
    <CommandOverlay onBackdropClick={handleClose}>
      <CommandShell
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        className="flex h-[92vh] w-full max-w-6xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id="settings-title" className="sr-only">System Settings</h2>

        <aside className={commandCx(COMMAND_THEME_CLASS.shellInset, 'hidden w-[21rem] shrink-0 border-r border-cyan-300/10 p-6 lg:flex lg:flex-col')}>
          <div className="mb-7">
            <div className="mb-4 h-1.5 w-14 rounded-full" style={{ background: activeMeta.accent, boxShadow: `0 0 16px ${activeMeta.accent}` }} />
            <p className="text-4xl font-black uppercase italic leading-[0.92] text-cyan-50">
              System
              <br />
              <span className="text-cyan-100/25">Settings</span>
            </p>
            <p className="mt-4 text-[0.67rem] font-bold uppercase tracking-[0.17em] text-cyan-100/35">
              Menu shell stays on command-deck theme. These options still affect gameplay, HUD, and sound.
            </p>
          </div>
          <div role="tablist" className="space-y-2">
            {TAB_META.map((tab) => {
              const active = tab.id === activeTab;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => { playSound(); setActiveTab(tab.id); }}
                  className={commandCx('w-full rounded-2xl border p-3.5 text-left transition', active ? COMMAND_THEME_CLASS.tabActive : COMMAND_THEME_CLASS.tab)}
                  style={{
                    color: active ? '#0b1118' : 'rgba(255,255,255,0.72)',
                    background: active ? tab.accent : 'rgba(255,255,255,0.03)',
                    borderColor: active ? `${tab.accent}99` : 'rgba(255,255,255,0.08)',
                  }}
                >
                  <p className="text-[0.66rem] font-black uppercase tracking-[0.2em]">{tab.label}</p>
                  <p className={`mt-1 text-[0.58rem] font-bold uppercase tracking-[0.14em] ${active ? 'text-black/55' : 'text-white/32'}`}>{tab.subtitle}</p>
                </button>
              );
            })}
          </div>
          <div className={commandCx(COMMAND_THEME_CLASS.shellMuted, 'mt-auto rounded-2xl p-4')} style={{ background: `linear-gradient(180deg, ${activeMeta.accentSoft}, rgba(2,7,20,0.92))`, borderColor: `${activeMeta.accent}44` }}>
            <p className="text-[0.58rem] font-black uppercase tracking-[0.2em] text-cyan-100/45">Active</p>
            <p className="mt-2 text-sm font-black uppercase text-cyan-50">{activeMeta.label}</p>
            <p className="mt-2 text-xs font-semibold text-cyan-50/55">{activeMeta.description}</p>
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          <CommandHeader
            eyebrow="Configuration"
            title={`${activeMeta.label} Settings`}
            description={activeTab === 'Video' ? 'Gameplay `dark mode` remains a runtime preference. The menu shell stays on the unified command-deck theme.' : activeMeta.description}
            onClose={handleClose}
            closeLabel="Close settings"
          />
          <div className="px-6 pb-4 md:px-8 lg:hidden">
            <div className="mt-4 flex gap-2 overflow-x-auto lg:hidden">
              {TAB_META.map((tab) => {
                const active = tab.id === activeTab;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => { playSound(); setActiveTab(tab.id); }}
                    className={commandCx('rounded-xl px-4 py-2 text-[0.62rem] font-black uppercase tracking-[0.16em] transition', active ? COMMAND_THEME_CLASS.tabActive : COMMAND_THEME_CLASS.tab)}
                    style={{
                      color: active ? '#0b1118' : 'rgba(255,255,255,0.72)',
                      background: active ? tab.accent : 'rgba(255,255,255,0.03)',
                      borderColor: active ? `${tab.accent}99` : 'rgba(255,255,255,0.08)',
                    }}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          <main className={commandCx(COMMAND_THEME_CLASS.scrollArea, 'min-h-0 flex-1 px-6 py-7 md:px-8')}>
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.18 }}
                className="space-y-5"
              >
                {activeTab === 'Audio' && (
                  <>
                    <Slider
                      id="settings-master-volume"
                      label="Master Volume"
                      desc="Global combat, UI, impact, and weapon output."
                      value={settings.volume}
                      min={0}
                      max={0.5}
                      step={0.01}
                      onChange={(v) => { updateSetting('volume', v); onVolumeChange(v); }}
                      accent={activeMeta.accent}
                      badge={formatPercent(settings.volume, 200)}
                    />
                    <Slider
                      id="settings-music-volume"
                      label="Music Atmosphere"
                      desc="Background soundtrack and ambient layer mix."
                      value={settings.musicVolume}
                      min={0}
                      max={1}
                      step={0.05}
                      onChange={(v) => updateSetting('musicVolume', v)}
                      accent={activeMeta.accent}
                      badge={formatPercent(settings.musicVolume)}
                    />
                    <Row title="Spatial Effects" desc="3D sound field virtualization.">
                      <Toggle active disabled onToggle={() => undefined} accent={activeMeta.accent} label="Spatial effects" />
                    </Row>
                  </>
                )}

                {activeTab === 'Video' && (
                  <>
                    <Row title="Dark Protocol" desc="High contrast visual mode.">
                      <Toggle active={settings.darkMode} onToggle={() => { playSound(); updateSetting('darkMode', !settings.darkMode); }} accent={activeMeta.accent} label="Dark mode" />
                    </Row>
                    <Row title="Structural Shake" desc="Kinetic camera response to impacts and heavy fire.">
                      <Toggle active={settings.shakeEnabled} onToggle={() => { playSound(); updateSetting('shakeEnabled', !settings.shakeEnabled); }} accent={activeMeta.accent} label="Camera shake" />
                    </Row>
                    {settings.shakeEnabled && (
                      <Slider
                        id="settings-shake-intensity"
                        label="Shake Intensity"
                        desc="Strength of camera recoil during explosions and impacts."
                        value={settings.shakeIntensity}
                        min={0.1}
                        max={2}
                        step={0.1}
                        onChange={(v) => updateSetting('shakeIntensity', v)}
                        accent={activeMeta.accent}
                        badge={formatPercent(settings.shakeIntensity)}
                      />
                    )}
                    <Row title="Telemetry Overlay" desc="Real-time performance metrics and FPS readout.">
                      <Toggle active={settings.showFps} onToggle={() => { playSound(); updateSetting('showFps', !settings.showFps); }} accent={activeMeta.accent} label="Show FPS" />
                    </Row>
                  </>
                )}

                {activeTab === 'Gameplay' && (
                  <>
                    <Row title="Tactical Minimap" desc="Real-time sector mapping and positional awareness.">
                      <Toggle active={settings.showMinimap} onToggle={() => { playSound(); updateSetting('showMinimap', !settings.showMinimap); }} accent={activeMeta.accent} label="Show minimap" />
                    </Row>
                    <Row title="Rank Leaderboard" desc="Active pilot standing hierarchy.">
                      <Toggle active={settings.showLeaderboard} onToggle={() => { playSound(); updateSetting('showLeaderboard', !settings.showLeaderboard); }} accent={activeMeta.accent} label="Show leaderboard" />
                    </Row>
                    <Row title="Compact Scores" desc="Display large score values as k, m, b, and t notation.">
                      <Toggle active={settings.compactScoreNotation} onToggle={() => { playSound(); updateSetting('compactScoreNotation', !settings.compactScoreNotation); }} accent={activeMeta.accent} label="Compact score notation" />
                    </Row>
                    <Slider
                      id="settings-interface-scale"
                      label="Interface Scale"
                      desc="Overall HUD scale and readability."
                      value={settings.uiScale}
                      min={0.8}
                      max={1.2}
                      step={0.05}
                      onChange={(v) => updateSetting('uiScale', v)}
                      accent={activeMeta.accent}
                      badge={formatPercent(settings.uiScale)}
                    />
                  </>
                )}

                {activeTab === 'Controls' && (
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {SHORTCUTS.map((item) => (
                      <div key={item.key} className={commandCx(COMMAND_THEME_CLASS.shellInset, 'rounded-2xl p-4 flex items-center gap-4')}>
                        <div className={commandCx(COMMAND_THEME_CLASS.shellMuted, 'h-12 w-14 rounded-xl text-xs font-black text-cyan-50/85 flex items-center justify-center')}>{item.key}</div>
                        <div>
                          <p className="text-xs font-black uppercase tracking-[0.14em] text-cyan-50/75">{item.title}</p>
                          <p className="mt-1 text-[0.6rem] font-bold uppercase tracking-[0.14em] text-cyan-100/30">{item.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </main>

          <footer className={commandCx(COMMAND_THEME_CLASS.footer, 'px-6 py-5 md:px-8')}>
            <div className="flex items-center justify-between gap-3">
              <p className="text-[0.6rem] font-black uppercase tracking-[0.22em] text-cyan-100/28">System Protocol v4.3.0</p>
              <CommandButton
                type="button"
                variant="primary"
                onClick={handleClose}
                className="shadow-[0_12px_30px_rgba(34,211,238,0.16)]"
              >
                Save Settings
              </CommandButton>
            </div>
          </footer>
        </section>
      </CommandShell>
    </CommandOverlay>
  );
};
