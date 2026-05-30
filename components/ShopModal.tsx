import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, Variants } from 'motion/react';
import { User, ShopItem, TankClass } from '../types';
import { SHOP_ITEMS } from '../constants';
import { BackendService } from '../services/BackendService';
import { TankPreview } from './TankPreview';

interface ShopModalProps {
  user: User | null;
  onClose: () => void;
  onUpdateUser: (user: User) => void;
  darkMode: boolean;
  playSound?: () => void;
}

type ShopTab = 'classic' | 'elite';
type RarityKey = 'common' | 'rare' | 'epic' | 'legendary' | 'elite';

type RarityVisual = {
  label: string;
  text: string;
  ring: string;
  badge: string;
  glow: string;
  softBg: string;
  particle: string;
};

const modalVariants: Variants = {
  hidden: { opacity: 0, scale: 0.94, y: 18, filter: 'blur(10px)' },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { type: 'spring', stiffness: 260, damping: 28, mass: 0.7 },
  },
  exit: {
    opacity: 0,
    scale: 0.94,
    y: 18,
    filter: 'blur(10px)',
    transition: { duration: 0.18 },
  },
};

const gridVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.035, delayChildren: 0.04 },
  },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 20, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 260, damping: 24 },
  },
};

const tabs: Array<{
  id: ShopTab;
  label: string;
  eyebrow: string;
  description: string;
}> = [
  {
    id: 'classic',
    label: 'Classic Skins',
    eyebrow: 'Chassis Market',
    description: 'Purchase and equip cosmetic tank finishes using earned credits.',
  },
  {
    id: 'elite',
    label: 'Elite Variants',
    eyebrow: 'Boss Trophies',
    description: 'Unlock rare metallic chassis variants by defeating elite bosses.',
  },
];

const rarityVisuals: Record<RarityKey, RarityVisual> = {
  common: {
    label: 'Common',
    text: 'text-slate-300',
    ring: 'border-white/15',
    badge: 'bg-white/8 text-white/55 border-white/10',
    glow: 'shadow-white/5',
    softBg: 'from-white/[0.04] to-transparent',
    particle: 'bg-slate-300',
  },
  rare: {
    label: 'Rare',
    text: 'text-cyan-300',
    ring: 'border-cyan-400/45',
    badge: 'bg-cyan-400/10 text-cyan-300 border-cyan-400/20',
    glow: 'shadow-cyan-400/20',
    softBg: 'from-cyan-400/10 to-transparent',
    particle: 'bg-cyan-300',
  },
  epic: {
    label: 'Epic',
    text: 'text-purple-300',
    ring: 'border-purple-400/45',
    badge: 'bg-purple-400/10 text-purple-300 border-purple-400/20',
    glow: 'shadow-purple-400/20',
    softBg: 'from-purple-400/10 to-transparent',
    particle: 'bg-purple-300',
  },
  legendary: {
    label: 'Legendary',
    text: 'text-amber-300',
    ring: 'border-amber-400/45',
    badge: 'bg-amber-400/10 text-amber-300 border-amber-400/20',
    glow: 'shadow-amber-400/20',
    softBg: 'from-amber-400/10 to-transparent',
    particle: 'bg-amber-300',
  },
  elite: {
    label: 'Elite',
    text: 'text-red-300',
    ring: 'border-red-500/45',
    badge: 'bg-red-500/10 text-red-300 border-red-500/20',
    glow: 'shadow-red-500/20',
    softBg: 'from-red-500/12 to-transparent',
    particle: 'bg-red-400',
  },
};

function getRarityKey(rarity?: string): RarityKey {
  const key = (rarity || 'common').toLowerCase();
  if (key === 'rare' || key === 'epic' || key === 'legendary' || key === 'elite') return key;
  return 'common';
}

function formatCredits(value: number): string {
  return new Intl.NumberFormat('en-GB').format(Math.max(0, Math.floor(value || 0)));
}

function getFocusableElements(container: HTMLElement | null): HTMLElement[] {
  if (!container) return [];
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
  ).filter((el) => !el.hasAttribute('disabled') && !el.getAttribute('aria-hidden'));
}

const Spinner: React.FC = () => (
  <svg className="h-4 w-4 animate-spin text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    />
  </svg>
);

const EmptyState: React.FC<{ darkMode: boolean; label: string; description: string }> = ({ darkMode, label, description }) => (
  <div
    className={`col-span-full flex min-h-[20rem] items-center justify-center rounded-[2rem] border p-8 text-center ${
      darkMode ? 'border-white/5 bg-white/[0.02]' : 'border-slate-200 bg-white'
    }`}
  >
    <div className="max-w-md">
      <div className={`mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl ${darkMode ? 'bg-white/5' : 'bg-slate-100'}`}>
        <svg className={darkMode ? 'h-8 w-8 text-white/25' : 'h-8 w-8 text-slate-400'} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4m16 0-4-4m4 4-4 4" />
        </svg>
      </div>
      <h3 className="text-xl font-black uppercase italic tracking-tight">{label}</h3>
      <p className={`mt-2 text-sm font-semibold leading-relaxed ${darkMode ? 'text-white/35' : 'text-slate-500'}`}>{description}</p>
    </div>
  </div>
);

export const ShopModal: React.FC<ShopModalProps> = ({ user, onClose, onUpdateUser, darkMode, playSound }) => {
  const modalRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ShopTab>('classic');
  const [celebrationItem, setCelebrationItem] = useState<ShopItem | null>(null);

  const ownedItemIds = user?.inventory || [];
  const equippedItemId = user?.equippedItem || null;
  const credits = user?.currency || 0;
  const eliteSkins = user?.unlockedEliteSkins || [];

  const sortedShopItems = useMemo(() => {
    return [...SHOP_ITEMS].sort((a, b) => {
      const aOwned = ownedItemIds.includes(a.id) ? 1 : 0;
      const bOwned = ownedItemIds.includes(b.id) ? 1 : 0;
      if (aOwned !== bOwned) return bOwned - aOwned;
      return a.price - b.price;
    });
  }, [ownedItemIds]);

  const eliteClasses = useMemo(() => Object.values(TankClass) as TankClass[], []);
  const eliteSkinsCount = eliteSkins.length;
  const totalEliteSkins = Math.max(1, eliteClasses.length);
  const progressPercentage = Math.min(100, Math.round((eliteSkinsCount / totalEliteSkins) * 100));
  const classicOwnedCount = sortedShopItems.filter((item) => ownedItemIds.includes(item.id)).length;

  const activeTabMeta = tabs.find((tab) => tab.id === activeTab) || tabs[0];
  const panelBg = darkMode ? 'bg-[#050507] text-white' : 'bg-[#f7f8fb] text-slate-950';
  const shellBg = darkMode ? 'bg-black/80' : 'bg-slate-950/55';
  const surface = darkMode ? 'bg-white/[0.035] border-white/7' : 'bg-white border-slate-200/80';
  const mutedSurface = darkMode ? 'bg-white/[0.025] border-white/5' : 'bg-slate-100/80 border-slate-200/70';
  const softText = darkMode ? 'text-white/45' : 'text-slate-500';

  useEffect(() => {
    if (!error) return;
    const timer = window.setTimeout(() => setError(null), 3200);
    return () => window.clearTimeout(timer);
  }, [error]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.setTimeout(() => closeButtonRef.current?.focus(), 0);
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (celebrationItem) {
          setCelebrationItem(null);
          return;
        }
        onClose();
        return;
      }

      if (event.key === 'Tab' && !celebrationItem) {
        const focusable = getFocusableElements(modalRef.current);
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement as HTMLElement | null;

        if (event.shiftKey && active === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && active === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [celebrationItem, onClose]);

  const selectTab = useCallback(
    (tab: ShopTab) => {
      playSound?.();
      setActiveTab(tab);
    },
    [playSound]
  );

  const handleTabKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
      if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft' && event.key !== 'Home' && event.key !== 'End') return;
      event.preventDefault();

      let nextIndex = index;
      if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length;
      if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length;
      if (event.key === 'Home') nextIndex = 0;
      if (event.key === 'End') nextIndex = tabs.length - 1;
      selectTab(tabs[nextIndex].id);
    },
    [selectTab]
  );

  const handleEquip = useCallback(
    async (item: ShopItem) => {
      if (!user || loadingId) return;
      playSound?.();
      setLoadingId(item.id);
      setError(null);

      try {
        const res = await BackendService.equipItem(user.username, item.id);
        if (res.success && res.user) onUpdateUser(res.user);
        else setError(res.error || 'Equip failed. Try again.');
      } catch {
        setError('Equip failed. Backend did not respond.');
      } finally {
        setLoadingId(null);
      }
    },
    [loadingId, onUpdateUser, playSound, user]
  );

  const handlePurchase = useCallback(
    async (item: ShopItem) => {
      if (!user || loadingId) return;
      playSound?.();
      setLoadingId(item.id);
      setError(null);

      try {
        const res = await BackendService.purchaseItem(user.username, item.id);
        if (res.success && res.user) {
          onUpdateUser(res.user);
          setCelebrationItem(item);
        } else {
          setError(res.error || 'Purchase failed. Check your credits.');
        }
      } catch {
        setError('Purchase failed. Backend did not respond.');
      } finally {
        setLoadingId(null);
      }
    },
    [loadingId, onUpdateUser, playSound, user]
  );

  const renderPrimaryAction = (item: ShopItem) => {
    const isOwned = ownedItemIds.includes(item.id);
    const isEquipped = equippedItemId === item.id;
    const canAfford = credits >= item.price;
    const isLoading = loadingId === item.id;

    if (isEquipped) {
      return {
        label: 'Equipped',
        disabled: true,
        className: darkMode
          ? 'bg-emerald-500/10 text-emerald-300 border-emerald-400/25 cursor-default'
          : 'bg-emerald-50 text-emerald-700 border-emerald-200 cursor-default',
        onClick: () => undefined,
      };
    }

    if (isOwned) {
      return {
        label: 'Equip',
        disabled: isLoading,
        className: 'bg-cyan-500 text-black border-cyan-300 hover:bg-cyan-300 shadow-[0_0_24px_rgba(6,182,212,0.22)]',
        onClick: () => handleEquip(item),
      };
    }

    return {
      label: canAfford ? `Buy ${formatCredits(item.price)}` : `Need ${formatCredits(Math.max(0, item.price - credits))}`,
      disabled: isLoading || !canAfford || !user,
      className: canAfford
        ? darkMode
          ? 'bg-white text-black border-white hover:bg-cyan-100 shadow-[0_0_24px_rgba(255,255,255,0.12)]'
          : 'bg-slate-950 text-white border-slate-950 hover:bg-slate-800'
        : darkMode
          ? 'bg-white/5 text-white/25 border-white/5 cursor-not-allowed'
          : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed',
      onClick: () => handlePurchase(item),
    };
  };

  return (
    <motion.div
      initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
      animate={{ opacity: 1, backdropFilter: 'blur(28px)' }}
      exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
      className={`fixed inset-0 z-[1000] flex items-center justify-center ${shellBg} p-3 md:p-6`}
      onMouseDown={onClose}
    >
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -18, scale: 0.96 }}
            className="fixed top-5 z-[1300] flex max-w-[calc(100vw-2rem)] items-center gap-3 rounded-2xl border border-red-400/30 bg-red-500 px-5 py-3 text-sm font-black text-white shadow-[0_20px_60px_rgba(239,68,68,0.3)]"
            role="alert"
          >
            <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="truncate">{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {celebrationItem && (
          <CelebrationOverlay item={celebrationItem} onClose={() => setCelebrationItem(null)} />
        )}
      </AnimatePresence>

      <motion.div
        ref={modalRef}
        variants={modalVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shop-modal-title"
        aria-describedby="shop-modal-description"
        className={`relative flex h-[94vh] w-full max-w-[92rem] overflow-hidden rounded-[2rem] border shadow-[0_30px_120px_rgba(0,0,0,0.55)] md:rounded-[2.75rem] ${panelBg} ${
          darkMode ? 'border-white/8' : 'border-white/80'
        }`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <aside className={`hidden w-[22rem] shrink-0 flex-col border-r p-7 lg:flex ${darkMode ? 'border-white/7 bg-white/[0.025]' : 'border-slate-200 bg-white/70'}`}>
          <div className="mb-8">
            <div className="mb-4 flex items-center gap-3">
              <div className="h-1.5 w-14 rounded-full bg-cyan-400 shadow-[0_0_22px_rgba(34,211,238,0.65)]" />
              <span className="text-[0.65rem] font-black uppercase italic tracking-[0.42em] text-cyan-400">Armory</span>
            </div>
            <h2 id="shop-modal-title" className="text-5xl font-black uppercase italic leading-[0.88] tracking-tight">
              Tank<br />Market
            </h2>
            <p id="shop-modal-description" className={`mt-5 max-w-[16rem] text-xs font-bold uppercase leading-relaxed tracking-[0.18em] ${softText}`}>
              Browse cosmetic chassis finishes and elite boss trophy variants.
            </p>
          </div>

          <div className={`mb-6 rounded-[1.5rem] border p-5 ${surface}`}>
            <p className={`text-[0.65rem] font-black uppercase tracking-[0.22em] ${softText}`}>Available Credits</p>
            <div className="mt-2 flex items-end gap-2">
              <span className="text-4xl font-black tracking-tight text-amber-300">{formatCredits(credits)}</span>
              <span className={`pb-1 text-xs font-black uppercase tracking-widest ${softText}`}>CR</span>
            </div>
          </div>

          <nav className="space-y-3" role="tablist" aria-label="Shop sections">
            {tabs.map((tab, index) => {
              const active = activeTab === tab.id;
              const stat = tab.id === 'classic' ? `${classicOwnedCount}/${SHOP_ITEMS.length}` : `${eliteSkinsCount}/${totalEliteSkins}`;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-controls={`shop-panel-${tab.id}`}
                  id={`shop-tab-${tab.id}`}
                  tabIndex={active ? 0 : -1}
                  onClick={() => selectTab(tab.id)}
                  onKeyDown={(event) => handleTabKeyDown(event, index)}
                  className={`group relative flex w-full items-center justify-between rounded-2xl border p-4 text-left transition-all duration-300 ${
                    active
                      ? darkMode
                        ? 'border-white bg-white text-black shadow-[0_20px_50px_rgba(255,255,255,0.1)]'
                        : 'border-slate-950 bg-slate-950 text-white shadow-[0_20px_50px_rgba(15,23,42,0.18)]'
                      : `${mutedSurface} ${softText} hover:border-cyan-400/25 hover:text-current`
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-[0.7rem] font-black uppercase italic tracking-[0.22em]">{tab.label}</p>
                    <p className={`mt-1 truncate text-[0.58rem] font-black uppercase tracking-[0.18em] ${active ? 'opacity-55' : 'opacity-65'}`}>{tab.eyebrow}</p>
                  </div>
                  <span className={`ml-3 rounded-full px-3 py-1 text-[0.65rem] font-black ${active ? 'bg-black/8 text-inherit' : darkMode ? 'bg-white/5 text-white/35' : 'bg-white text-slate-500'}`}>
                    {stat}
                  </span>
                </button>
              );
            })}
          </nav>

          <div className={`mt-auto rounded-[1.5rem] border p-5 ${darkMode ? 'border-cyan-400/10 bg-cyan-400/[0.035]' : 'border-cyan-100 bg-cyan-50'}`}>
            <div className="mb-3 flex items-center justify-between">
              <span className={`text-[0.62rem] font-black uppercase tracking-[0.22em] ${softText}`}>Elite Sync</span>
              <span className="text-lg font-black text-red-300">{progressPercentage}%</span>
            </div>
            <div className={`h-2 overflow-hidden rounded-full ${darkMode ? 'bg-white/8' : 'bg-white'}`}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progressPercentage}%` }}
                transition={{ type: 'spring', stiffness: 130, damping: 24 }}
                className="h-full rounded-full bg-gradient-to-r from-red-500 to-cyan-300 shadow-[0_0_18px_rgba(239,68,68,0.45)]"
              />
            </div>
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          <header className={`shrink-0 border-b px-5 py-5 md:px-8 md:py-6 ${darkMode ? 'border-white/7 bg-black/25' : 'border-slate-200 bg-white/80'}`}>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="mb-3 flex items-center gap-3 lg:hidden">
                  <div className="h-1.5 w-12 rounded-full bg-cyan-400" />
                  <span className="text-[0.62rem] font-black uppercase italic tracking-[0.35em] text-cyan-400">Armory</span>
                </div>
                <p className={`text-[0.68rem] font-black uppercase tracking-[0.28em] ${softText}`}>{activeTabMeta.eyebrow}</p>
                <h3 className="mt-1 truncate text-3xl font-black uppercase italic tracking-tight md:text-5xl">{activeTabMeta.label}</h3>
                <p className={`mt-2 max-w-2xl text-sm font-semibold leading-relaxed ${softText}`}>{activeTabMeta.description}</p>
              </div>

              <div className="flex shrink-0 items-center gap-3">
                {user && (
                  <div className={`hidden rounded-2xl border px-4 py-3 text-right sm:block ${surface}`}>
                    <p className={`text-[0.58rem] font-black uppercase tracking-[0.18em] ${softText}`}>Credits</p>
                    <p className="text-xl font-black text-amber-300">{formatCredits(credits)}</p>
                  </div>
                )}
                <button
                  ref={closeButtonRef}
                  type="button"
                  onClick={() => {
                    playSound?.();
                    onClose();
                  }}
                  aria-label="Close shop"
                  className={`flex h-12 w-12 items-center justify-center rounded-2xl border transition-all duration-300 hover:rotate-90 hover:scale-105 ${
                    darkMode ? 'border-white/8 bg-white/5 text-white/50 hover:bg-white/10 hover:text-white' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-100 hover:text-slate-950'
                  }`}
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="mt-5 flex gap-2 overflow-x-auto pb-1 custom-scrollbar lg:hidden" role="tablist" aria-label="Shop sections">
              {tabs.map((tab, index) => {
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    aria-controls={`shop-panel-${tab.id}`}
                    id={`shop-tab-mobile-${tab.id}`}
                    onClick={() => selectTab(tab.id)}
                    onKeyDown={(event) => handleTabKeyDown(event, index)}
                    className={`relative shrink-0 rounded-full border px-5 py-3 text-[0.68rem] font-black uppercase tracking-[0.18em] transition-all ${
                      active
                        ? darkMode
                          ? 'border-white bg-white text-black'
                          : 'border-slate-950 bg-slate-950 text-white'
                        : darkMode
                          ? 'border-white/7 bg-white/[0.03] text-white/45'
                          : 'border-slate-200 bg-white text-slate-500'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </header>

          <section className="min-h-0 flex-1 overflow-y-auto p-5 md:p-8 custom-scrollbar">
            <AnimatePresence mode="wait">
              {activeTab === 'classic' ? (
                <motion.div
                  key="classic"
                  id="shop-panel-classic"
                  role="tabpanel"
                  aria-labelledby="shop-tab-classic"
                  variants={gridVariants}
                  initial="hidden"
                  animate="visible"
                  exit={{ opacity: 0, x: -18 }}
                  className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
                >
                  {sortedShopItems.length === 0 ? (
                    <EmptyState darkMode={darkMode} label="No skins available" description="Add items to SHOP_ITEMS to populate the armory market." />
                  ) : (
                    sortedShopItems.map((item) => {
                      const rarity = rarityVisuals[getRarityKey(item.rarity)];
                      const isOwned = ownedItemIds.includes(item.id);
                      const isEquipped = equippedItemId === item.id;
                      const canAfford = credits >= item.price;
                      const action = renderPrimaryAction(item);
                      const isLoading = loadingId === item.id;

                      return (
                        <motion.article
                          key={item.id}
                          variants={cardVariants}
                          whileHover={{ y: -6 }}
                          className={`group relative flex min-h-[26rem] flex-col overflow-hidden rounded-[1.75rem] border p-4 transition-all duration-300 ${
                            darkMode ? 'border-white/6 bg-white/[0.035] shadow-black/30 hover:bg-white/[0.055]' : 'border-slate-200/80 bg-white shadow-sm hover:shadow-xl'
                          } ${isEquipped ? 'ring-2 ring-cyan-400/50' : ''}`}
                        >
                          <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${rarity.softBg}`} />

                          <div className={`relative mb-4 flex aspect-square items-center justify-center overflow-hidden rounded-[1.4rem] border ${darkMode ? 'border-white/5 bg-black/30' : 'border-slate-100 bg-slate-50'}`}>
                            <div className={`absolute left-3 top-3 rounded-full border px-3 py-1 text-[0.58rem] font-black uppercase tracking-[0.16em] backdrop-blur-xl ${rarity.badge}`}>
                              {item.rarity || 'Common'}
                            </div>
                            {isOwned && (
                              <div className="absolute right-3 top-3 rounded-full bg-emerald-400 px-3 py-1 text-[0.58rem] font-black uppercase tracking-[0.16em] text-black">
                                Owned
                              </div>
                            )}
                            <motion.div
                              animate={{ y: [0, -7, 0], rotate: [0, -1.5, 0] }}
                              transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
                              className="drop-shadow-[0_24px_35px_rgba(0,0,0,0.35)]"
                            >
                              <TankPreview tankClass={TankClass.BASIC} color={item.value} size={120} />
                            </motion.div>
                          </div>

                          <div className="relative flex min-h-0 flex-1 flex-col">
                            <div className="mb-4">
                              <h4 className="text-xl font-black uppercase italic tracking-tight">{item.name}</h4>
                              <p className={`mt-2 line-clamp-3 min-h-[3.1rem] text-sm font-semibold leading-relaxed ${softText}`}>{item.description}</p>
                            </div>

                            <div className="mt-auto space-y-3">
                              <div className={`flex items-center justify-between rounded-2xl border px-4 py-3 ${mutedSurface}`}>
                                <span className={`text-[0.62rem] font-black uppercase tracking-[0.18em] ${softText}`}>Price</span>
                                <span className={`text-sm font-black ${isOwned ? 'text-emerald-300' : canAfford ? 'text-amber-300' : softText}`}>
                                  {isOwned ? 'Unlocked' : `${formatCredits(item.price)} CR`}
                                </span>
                              </div>

                              <motion.button
                                type="button"
                                disabled={action.disabled}
                                onClick={action.onClick}
                                whileTap={!action.disabled ? { scale: 0.96 } : undefined}
                                className={`flex w-full items-center justify-center gap-2 rounded-2xl border px-4 py-4 text-[0.72rem] font-black uppercase tracking-[0.18em] transition-all ${action.className}`}
                              >
                                {isLoading ? <Spinner /> : action.label}
                              </motion.button>
                            </div>
                          </div>
                        </motion.article>
                      );
                    })
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="elite"
                  id="shop-panel-elite"
                  role="tabpanel"
                  aria-labelledby="shop-tab-elite"
                  initial={{ opacity: 0, x: 18 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 18 }}
                  transition={{ type: 'spring', stiffness: 220, damping: 26 }}
                  className="space-y-6"
                >
                  <section className={`relative overflow-hidden rounded-[2rem] border p-6 md:p-8 ${darkMode ? 'border-red-500/15 bg-gradient-to-br from-red-950/30 via-white/[0.025] to-black' : 'border-red-100 bg-gradient-to-br from-red-50 via-white to-white'}`}>
                    <div className="pointer-events-none absolute right-0 top-0 h-72 w-72 rounded-full bg-red-500/10 blur-[90px]" />
                    <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
                      <div className="max-w-2xl">
                        <p className="text-[0.68rem] font-black uppercase italic tracking-[0.34em] text-red-300">Elite Collection</p>
                        <h4 className="mt-2 text-3xl font-black uppercase italic tracking-tight md:text-5xl">Boss Trophy Arsenal</h4>
                        <p className={`mt-3 text-sm font-semibold leading-relaxed ${softText}`}>
                          Defeat elite tanks to unlock premium metallic variants. Locked cards reveal their target class so progression stays readable without becoming cluttered.
                        </p>
                      </div>
                      <div className="min-w-[14rem]">
                        <div className="mb-3 flex items-end justify-between gap-4">
                          <span className={`text-[0.62rem] font-black uppercase tracking-[0.2em] ${softText}`}>Collected</span>
                          <span className="text-4xl font-black text-red-300">
                            {eliteSkinsCount}<span className={`text-lg ${softText}`}>/{totalEliteSkins}</span>
                          </span>
                        </div>
                        <div className={`h-3 overflow-hidden rounded-full ${darkMode ? 'bg-black/45' : 'bg-white'}`}>
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${progressPercentage}%` }}
                            transition={{ duration: 0.9, ease: 'easeOut' }}
                            className="h-full rounded-full bg-gradient-to-r from-red-600 via-red-400 to-cyan-300"
                          />
                        </div>
                      </div>
                    </div>
                  </section>

                  <motion.div variants={gridVariants} initial="hidden" animate="visible" className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                    {eliteClasses.map((cls) => {
                      const isUnlocked = eliteSkins.includes(cls);
                      const skinId = `elite_skin_${cls}`;
                      const isEquipped = equippedItemId === skinId;
                      const isLoading = loadingId === skinId;
                      const eliteItem = {
                        id: skinId,
                        name: `Elite ${cls}`,
                        type: 'elite_skin',
                        value: cls as string,
                        price: 0,
                        description: `Elite chassis trophy for ${cls}.`,
                        rarity: 'elite',
                      } as ShopItem;

                      return (
                        <motion.article
                          key={cls}
                          variants={cardVariants}
                          whileHover={isUnlocked ? { y: -6 } : undefined}
                          className={`group relative overflow-hidden rounded-[1.75rem] border p-4 transition-all duration-300 ${
                            isUnlocked
                              ? darkMode
                                ? 'border-red-500/25 bg-white/[0.04] shadow-[0_0_32px_rgba(239,68,68,0.08)]'
                                : 'border-red-100 bg-white shadow-sm hover:shadow-xl'
                              : darkMode
                                ? 'border-white/5 bg-white/[0.025] opacity-75'
                                : 'border-slate-200 bg-slate-100/70 opacity-85'
                          } ${isEquipped ? 'ring-2 ring-red-400/60' : ''}`}
                        >
                          <div className={`relative mb-4 flex aspect-square items-center justify-center overflow-hidden rounded-[1.4rem] border ${isUnlocked ? 'border-red-500/15 bg-gradient-to-b from-red-500/12 to-transparent' : darkMode ? 'border-white/5 bg-black/30' : 'border-slate-200 bg-slate-200/70'}`}>
                            {!isUnlocked && (
                              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/45 p-5 text-center backdrop-blur-md">
                                <svg className="mb-3 h-11 w-11 text-red-300 drop-shadow-[0_0_18px_rgba(248,113,113,0.45)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 15v2m-6 4h12a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2Zm10-10V7a4 4 0 0 0-8 0v4h8Z" />
                                </svg>
                                <span className="text-[0.68rem] font-black uppercase leading-relaxed tracking-[0.2em] text-white">
                                  Defeat Elite<br />{String(cls).replace(' Tank', '')}
                                </span>
                              </div>
                            )}
                            <motion.div
                              animate={isUnlocked ? { y: [0, -7, 0], scale: [1, 1.03, 1] } : undefined}
                              transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
                              className={isUnlocked ? 'drop-shadow-[0_0_30px_rgba(239,68,68,0.45)]' : 'scale-90 grayscale opacity-35'}
                            >
                              <TankPreview tankClass={cls} color={isUnlocked ? '#202020' : '#595959'} size={120} />
                            </motion.div>
                          </div>

                          <div className="space-y-3 text-center">
                            <div>
                              <p className="text-[0.62rem] font-black uppercase tracking-[0.22em] text-red-300">Elite Variant</p>
                              <h4 className="mt-1 truncate text-lg font-black uppercase italic tracking-tight">{String(cls)}</h4>
                            </div>
                            <motion.button
                              type="button"
                              disabled={!isUnlocked || isLoading || isEquipped}
                              onClick={() => isUnlocked && handleEquip(eliteItem)}
                              whileTap={isUnlocked && !isEquipped ? { scale: 0.95 } : undefined}
                              className={`flex w-full items-center justify-center gap-2 rounded-2xl border px-4 py-4 text-[0.72rem] font-black uppercase tracking-[0.18em] transition-all ${
                                isEquipped
                                  ? darkMode
                                    ? 'border-emerald-400/25 bg-emerald-500/10 text-emerald-300'
                                    : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                  : isUnlocked
                                    ? 'border-red-400 bg-red-500 text-white hover:bg-red-400 shadow-[0_0_24px_rgba(239,68,68,0.18)]'
                                    : darkMode
                                      ? 'border-white/5 bg-white/5 text-white/20 cursor-not-allowed'
                                      : 'border-slate-200 bg-slate-200 text-slate-400 cursor-not-allowed'
                              }`}
                            >
                              {isLoading ? <Spinner /> : isEquipped ? 'Equipped' : isUnlocked ? 'Equip' : 'Locked'}
                            </motion.button>
                          </div>
                        </motion.article>
                      );
                    })}
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        </main>
      </motion.div>
    </motion.div>
  );
};

const CelebrationOverlay: React.FC<{ item: ShopItem; onClose: () => void }> = ({ item, onClose }) => {
  const rarity = rarityVisuals[getRarityKey(item.rarity)];
  const particles = useMemo(
    () =>
      Array.from({ length: 34 }, (_, i) => ({
        id: i,
        x: (Math.random() - 0.5) * 760,
        y: (Math.random() - 0.5) * 520,
        delay: Math.random() * 0.5,
        duration: 1.25 + Math.random() * 1.2,
        scale: 0.6 + Math.random() * 2.4,
      })),
    []
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[1400] flex items-center justify-center overflow-hidden bg-black/95 p-6 backdrop-blur-3xl"
      onMouseDown={(event) => {
        event.stopPropagation();
        onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={`${item.name} acquired`}
    >
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          initial={{ x: 0, y: 0, scale: 0, opacity: 1 }}
          animate={{ x: particle.x, y: particle.y, scale: particle.scale, opacity: 0 }}
          transition={{ duration: particle.duration, delay: particle.delay, repeat: Infinity, ease: 'easeOut' }}
          className={`absolute h-1.5 w-1.5 rounded-full ${rarity.particle}`}
        />
      ))}

      <motion.div
        initial={{ scale: 0.86, opacity: 0, y: 30 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.86, opacity: 0, y: 30 }}
        transition={{ type: 'spring', stiffness: 220, damping: 22 }}
        className="relative flex w-full max-w-3xl flex-col items-center text-center"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className={`absolute -z-10 h-[38rem] w-[38rem] rounded-full bg-gradient-to-br ${rarity.softBg} opacity-70 blur-[90px]`} />

        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 28, repeat: Infinity, ease: 'linear' }}
          className={`absolute -z-10 h-[28rem] w-[28rem] rounded-[6rem] border ${rarity.ring} opacity-35`}
        />

        <div className={`relative mb-8 flex h-72 w-72 items-center justify-center rounded-[3rem] border bg-black/45 shadow-[0_0_100px_rgba(255,255,255,0.08)] ${rarity.ring} ${rarity.glow}`}>
          <motion.div
            animate={{ scale: [1, 1.35], opacity: [0.55, 0] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
            className={`absolute inset-0 rounded-[3rem] border-2 ${rarity.ring}`}
          />
          <motion.div animate={{ y: [0, -14, 0], rotate: [0, -2, 0] }} transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}>
            <TankPreview tankClass={TankClass.BASIC} color={item.value} size={178} />
          </motion.div>
          <div className="absolute -top-4 right-6 rounded-full bg-white px-5 py-2 text-[0.7rem] font-black uppercase tracking-[0.22em] text-black shadow-2xl">
            Acquired
          </div>
        </div>

        <p className={`text-sm font-black uppercase italic tracking-[0.45em] ${rarity.text}`}>{item.rarity || 'Common'} Unlocked</p>
        <h2 className="mt-3 max-w-full break-words text-5xl font-black uppercase italic tracking-tighter text-white drop-shadow-2xl md:text-7xl">{item.name}</h2>
        <p className="mt-4 max-w-xl text-sm font-semibold leading-relaxed text-white/45">The chassis has been added to your armory and can now be equipped from the shop.</p>

        <motion.button
          type="button"
          initial={{ y: 18, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.25 }}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          onClick={onClose}
          className="mt-9 rounded-2xl bg-white px-12 py-5 text-sm font-black uppercase italic tracking-[0.34em] text-black shadow-[0_20px_60px_rgba(255,255,255,0.12)]"
        >
          Continue
        </motion.button>
      </motion.div>
    </motion.div>
  );
};
