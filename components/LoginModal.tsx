import React, { useRef, useState } from 'react';
import { BackendService } from '../services/BackendService';
import { User } from '../types';
import { CommandButton } from './menu-ui/CommandButton';
import { CommandHeader } from './menu-ui/CommandHeader';
import { CommandOverlay } from './menu-ui/CommandOverlay';
import { CommandShell } from './menu-ui/CommandShell';
import { useCommandDialog } from './menu-ui/useCommandDialog';
import { COMMAND_THEME_CLASS, commandCx } from './uiTheme';

interface LoginModalProps {
    onClose: () => void;
    onLoginSuccess: (user: User) => void;
    darkMode: boolean;
}

export const LoginModal: React.FC<LoginModalProps> = ({ onClose, onLoginSuccess }) => {
    const [isLoginView, setIsLoginView] = useState(true);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const dialogRef = useRef<HTMLDivElement>(null);
    const googleActionRef = useRef(false);

    useCommandDialog({ containerRef: dialogRef, onClose });

    const handleGoogleLogin = async () => {
        if (googleActionRef.current) return;
        googleActionRef.current = true;
        setError(null);
        setGoogleLoading(true);

        try {
            const response = await BackendService.loginWithGoogle();
            if (response.success && response.user) {
                onLoginSuccess(response.user);
                onClose();
            } else if (response.error) {
                setError(response.error);
            }
        } catch {
            setError('Google sign-in failed. Please try again.');
        } finally {
            setGoogleLoading(false);
            googleActionRef.current = false;
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);
        try {
            const response = isLoginView
                ? await BackendService.login(username, password)
                : await BackendService.register(username, password);

            if (response.success && response.user) {
                onLoginSuccess(response.user);
                onClose();
            } else {
                const msg = response.error || 'An unknown error occurred.';
                setError(msg);
                if (isLoginView && msg.toLowerCase().includes('no account found')) {
                    setIsLoginView(false);
                }
            }
        } catch {
            setError('Connection failure. Please retry.');
        } finally {
            setLoading(false);
        }
    };

    const switchView = (view: boolean) => {
        setIsLoginView(view);
        setError(null);
    };

    const isAnyLoading = loading || googleLoading;

    return (
        <CommandOverlay onBackdropClick={onClose}>
            <CommandShell
                ref={dialogRef}
                className="relative w-full max-w-2xl"
                onMouseDown={(event) => event.stopPropagation()}
            >
                <div className="pointer-events-none absolute inset-0 overflow-hidden">
                    <div className="absolute -left-20 top-10 h-48 w-48 rounded-full bg-cyan-400/10 blur-3xl" />
                    <div className="absolute -right-10 bottom-0 h-56 w-56 rounded-full bg-teal-400/10 blur-3xl" />
                    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/70 to-transparent" />
                </div>

                <CommandHeader
                    eyebrow="Commander Access"
                    title={isLoginView ? 'Pilot Login' : 'Pilot Registration'}
                    description={isLoginView
                        ? 'Sign in to sync your progression, loadout unlocks, and command history.'
                        : 'Create a command account to store your progress and unlock cloud-linked rewards.'}
                    onClose={onClose}
                    icon={
                        <svg className="h-6 w-6 text-cyan-100" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 3l7.5 4.2v5.6c0 4.1-3 7.9-7.5 8.9-4.5-1-7.5-4.8-7.5-8.9V7.2L12 3z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M9.5 11.5l1.7 1.7 3.3-3.7" />
                        </svg>
                    }
                    status={
                        <div className={commandCx(COMMAND_THEME_CLASS.pillMuted, 'px-3 py-2 text-[10px] font-black uppercase tracking-[0.22em]')}>
                            ENC ACTIVE
                        </div>
                    }
                />

                <div className="grid gap-0 lg:grid-cols-[0.94fr_1.06fr]">
                    <aside className={commandCx(COMMAND_THEME_CLASS.shellMuted, 'border-r-0 border-t border-cyan-300/10 p-6 lg:border-r lg:border-t-0 lg:p-8')}>
                        <div className="space-y-6">
                            <div className={commandCx(COMMAND_THEME_CLASS.shellInset, 'rounded-3xl p-4')}>
                                <div className={COMMAND_THEME_CLASS.eyebrow}>Route</div>
                                <div className="mt-3 grid grid-cols-2 gap-2">
                                    {[true, false].map((isLogin) => {
                                        const active = isLoginView === isLogin;
                                        return (
                                            <button
                                                key={String(isLogin)}
                                                type="button"
                                                onClick={() => switchView(isLogin)}
                                                className={commandCx(
                                                    'rounded-2xl px-4 py-3 text-left text-[11px] font-black uppercase tracking-[0.18em] transition',
                                                    active ? COMMAND_THEME_CLASS.tabActive : COMMAND_THEME_CLASS.tab,
                                                )}
                                            >
                                                <div>{isLogin ? 'Login' : 'Register'}</div>
                                                <div className="mt-1 text-[9px] tracking-[0.16em] text-cyan-100/42">
                                                    {isLogin ? 'Resume sortie' : 'Open dossier'}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className={commandCx(COMMAND_THEME_CLASS.shellInset, 'rounded-3xl p-4')}>
                                <div className={COMMAND_THEME_CLASS.eyebrow}>Benefits</div>
                                <div className="mt-4 space-y-3">
                                    {[
                                        'Cloud-synced progression and medals',
                                        'Saved boss loadouts and sandbox unlocks',
                                        'Persistent achievements, cosmetics, and stats',
                                    ].map((item) => (
                                        <div key={item} className="flex items-start gap-3">
                                            <div className="mt-1 h-2.5 w-2.5 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(103,232,249,0.45)]" />
                                            <p className="text-sm leading-6 text-cyan-50/72">{item}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={handleGoogleLogin}
                                disabled={isAnyLoading}
                                className={commandCx(
                                    COMMAND_THEME_CLASS.shellInset,
                                    'group flex w-full items-center justify-center gap-3 rounded-3xl px-5 py-4 text-left transition hover:border-cyan-300/28 hover:bg-cyan-400/[0.08] disabled:cursor-not-allowed disabled:opacity-50',
                                )}
                            >
                                {googleLoading ? (
                                    <svg className="h-5 w-5 animate-spin text-cyan-50/80" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                ) : (
                                    <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24">
                                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z" />
                                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.85c.87-2.6 3.3-4.53 6.16-4.53z" />
                                    </svg>
                                )}
                                <div className="min-w-0 flex-1">
                                    <div className="text-[11px] font-black uppercase tracking-[0.2em] text-cyan-50">
                                        {googleLoading ? 'Authenticating' : 'Continue With Google'}
                                    </div>
                                    <div className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-100/42">
                                        One-tap secure sign-in route
                                    </div>
                                </div>
                            </button>
                        </div>
                    </aside>

                    <section className="border-t border-cyan-300/10 p-6 lg:border-t-0 lg:p-8">
                        <div className="mb-5 flex items-center gap-3">
                            <div className="h-px flex-1 bg-cyan-300/10" />
                            <div className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-100/35">Manual Link</div>
                            <div className="h-px flex-1 bg-cyan-300/10" />
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div>
                                <label className={commandCx(COMMAND_THEME_CLASS.eyebrow, 'mb-2 block')}>
                                    Pilot Identity
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="email or callsign"
                                    autoComplete="username"
                                    className={COMMAND_THEME_CLASS.input}
                                />
                            </div>

                            <div>
                                <label className={commandCx(COMMAND_THEME_CLASS.eyebrow, 'mb-2 block')}>
                                    Security Key
                                </label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Enter password"
                                        autoComplete={isLoginView ? 'current-password' : 'new-password'}
                                        className={commandCx(COMMAND_THEME_CLASS.input, 'pr-12', showPassword ? 'tracking-[0.06em]' : 'tracking-[0.22em]')}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword((value) => !value)}
                                        className="absolute inset-y-0 right-3 flex items-center justify-center text-cyan-100/48 transition hover:text-cyan-50"
                                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                                    >
                                        {showPassword ? (
                                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                                            </svg>
                                        ) : (
                                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                            </svg>
                                        )}
                                    </button>
                                </div>
                            </div>

                            {error && (
                                <div className="rounded-2xl border border-rose-300/24 bg-rose-500/10 px-4 py-4 text-sm text-rose-100">
                                    <div className="flex items-start gap-3">
                                        <svg className="mt-0.5 h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                        </svg>
                                        <div className="flex-1">
                                            <p>{error}</p>
                                            <div className="mt-3 flex flex-wrap gap-3 text-[10px] font-black uppercase tracking-[0.18em]">
                                                <button type="button" onClick={() => setError(null)} className="text-rose-100/80 transition hover:text-rose-50">
                                                    Dismiss
                                                </button>
                                                {isLoginView && (
                                                    <button type="button" onClick={() => switchView(false)} className="text-cyan-100/80 transition hover:text-cyan-50">
                                                        Create Account Instead
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className={commandCx(COMMAND_THEME_CLASS.shellInset, 'rounded-2xl p-4')}>
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <div className={COMMAND_THEME_CLASS.eyebrow}>Current Route</div>
                                        <div className="mt-2 text-sm font-bold uppercase tracking-[0.12em] text-cyan-50">
                                            {isLoginView ? 'Returning Commander' : 'New Commander'}
                                        </div>
                                        <p className="mt-2 text-sm leading-6 text-cyan-50/64">
                                            {isLoginView
                                                ? 'Resume synced progression, cosmetics, sandbox presets, and boss unlocks.'
                                                : 'Open a new command record and start storing account-wide rewards.'}
                                        </p>
                                    </div>
                                    <div className={commandCx(COMMAND_THEME_CLASS.pill, 'px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em]')}>
                                        {isLoginView ? 'SYNC' : 'CREATE'}
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
                                <CommandButton type="submit" variant="primary" disabled={isAnyLoading} className="min-w-[220px] justify-center">
                                    {loading ? (isLoginView ? 'Authenticating' : 'Creating Account') : (isLoginView ? 'Login' : 'Create Account')}
                                </CommandButton>

                                <button
                                    type="button"
                                    onClick={() => switchView(!isLoginView)}
                                    className="text-left text-[10px] font-black uppercase tracking-[0.18em] text-cyan-100/48 transition hover:text-cyan-50"
                                >
                                    {isLoginView ? 'New commander? Open registration' : 'Already enlisted? Return to login'}
                                </button>
                            </div>
                        </form>
                    </section>
                </div>
            </CommandShell>
        </CommandOverlay>
    );
};
