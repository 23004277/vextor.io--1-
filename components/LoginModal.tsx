import React, { useCallback, useRef, useState } from 'react';
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
    const canDismiss = !googleLoading;

    const guardedClose = useCallback(() => {
        if (!canDismiss) return;
        onClose();
    }, [canDismiss, onClose]);

    useCommandDialog({
        containerRef: dialogRef,
        onClose: guardedClose,
        autoFocusSelector: '[data-login-primary="true"]',
    });

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
    const routeSummary = isLoginView
        ? 'Sign in to restore cloud progress, unlocked boss loadouts, medals, and long-run stats.'
        : 'Create a VEXTOR account to sync progress, carry unlocks across devices, and keep your command history safe.';
    const routeLabel = isLoginView ? 'Returning Commander' : 'New Commander';
    const submitLabel = loading
        ? (isLoginView ? 'Authenticating' : 'Creating Account')
        : (isLoginView ? 'Log In' : 'Create Account');
    const heroHighlights = isLoginView
        ? ['Cloud progression', 'Sandbox and boss unlocks', 'Achievement and stat sync']
        : ['Fast account setup', 'Cross-device continuation', 'Secure Firebase sign-in'];
    const formTitle = isLoginView ? 'Sign in to your command profile' : 'Create your command profile';
    const formCopy = isLoginView
        ? 'Use your existing email or callsign and password, or jump in with Google below.'
        : 'Pick the identity you want to use in VEXTOR and secure it with a password you can remember.';
    const googleActionLabel = googleLoading ? 'Redirecting to Google' : 'Continue with Google';
    const togglePrompt = isLoginView ? 'New to VEXTOR?' : 'Already have an account?';
    const toggleLabel = isLoginView ? 'Create account' : 'Back to login';

    return (
        <CommandOverlay onBackdropClick={canDismiss ? guardedClose : undefined}>
            <CommandShell
                ref={dialogRef}
                className="relative flex max-h-[min(92vh,54rem)] w-full max-w-[min(68rem,100%)] min-w-0 flex-col overflow-hidden"
                onMouseDown={(event) => event.stopPropagation()}
            >
                <div className="pointer-events-none absolute inset-0 overflow-hidden">
                    <div className="absolute -left-16 top-8 h-44 w-44 rounded-full bg-cyan-400/10 blur-3xl" />
                    <div className="absolute right-[-3rem] top-1/3 h-56 w-56 rounded-full bg-violet-400/8 blur-3xl" />
                    <div className="absolute bottom-[-3rem] left-1/4 h-56 w-56 rounded-full bg-teal-400/10 blur-3xl" />
                    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/70 to-transparent" />
                </div>

                <CommandHeader
                    eyebrow="Commander Access"
                    title={isLoginView ? 'Pilot Login' : 'Pilot Sign-Up'}
                    description={isLoginView
                        ? 'Get back into your synced profile quickly and keep the account flow simple.'
                        : 'Create a clean command profile for cloud saves, unlock persistence, and account-wide rewards.'}
                    onClose={canDismiss ? guardedClose : undefined}
                    icon={(
                        <svg className="h-6 w-6 text-cyan-100" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 3l7.5 4.2v5.6c0 4.1-3 7.9-7.5 8.9-4.5-1-7.5-4.8-7.5-8.9V7.2L12 3z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M9.5 11.5l1.7 1.7 3.3-3.7" />
                        </svg>
                    )}
                    status={(
                        <div className={commandCx(COMMAND_THEME_CLASS.pillMuted, 'px-3 py-2 text-[10px] font-black uppercase tracking-[0.22em]')}>
                            Secure Auth
                        </div>
                    )}
                />

                <div className="grid min-h-0 flex-1 xl:grid-cols-[minmax(20rem,0.92fr)_minmax(0,1.08fr)]">
                    <aside className={commandCx(COMMAND_THEME_CLASS.shellMuted, COMMAND_THEME_CLASS.scrollArea, 'min-h-0 min-w-0 border-r-0 border-t border-cyan-300/10 p-5 xl:border-r xl:border-t-0 xl:p-7')}>
                        <div className="flex h-full min-h-0 flex-col gap-4">
                            <div className={commandCx(COMMAND_THEME_CLASS.shellInset, 'rounded-[1.75rem] p-5 md:p-6')}>
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className={COMMAND_THEME_CLASS.eyebrow}>Current Route</div>
                                        <div className="mt-2 text-xl font-black uppercase tracking-[0.08em] text-cyan-50">
                                            {routeLabel}
                                        </div>
                                        <p className="mt-3 max-w-md text-sm leading-6 text-cyan-50/70">
                                            {routeSummary}
                                        </p>
                                    </div>
                                    <div className={commandCx(COMMAND_THEME_CLASS.pill, 'shrink-0 px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em]')}>
                                        {isLoginView ? 'Sync Ready' : 'Account Setup'}
                                    </div>
                                </div>

                                <div className="mt-5 grid gap-2.5">
                                    {heroHighlights.map((item) => (
                                        <div key={item} className="flex min-w-0 items-center gap-3 rounded-2xl border border-cyan-300/10 bg-white/[0.025] px-3.5 py-3">
                                            <div className="h-2.5 w-2.5 shrink-0 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(103,232,249,0.42)]" />
                                            <p className="min-w-0 text-sm leading-5 text-cyan-50/74">{item}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className={commandCx(COMMAND_THEME_CLASS.shellInset, 'rounded-[1.75rem] p-5')}>
                                <div className={COMMAND_THEME_CLASS.eyebrow}>Why Sign In</div>
                                <div className="mt-3 space-y-3 text-sm leading-6 text-cyan-50/68">
                                    <p>Keep progression, achievements, cosmetics, and sandbox unlocks tied to one account.</p>
                                    <p>Switch devices or come back later without losing your profile state.</p>
                                </div>
                            </div>
                        </div>
                    </aside>

                    <section className="native-cursor min-h-0 min-w-0 border-t border-cyan-300/10 p-5 xl:border-t-0 xl:p-7">
                        <div className="flex h-full min-h-0 flex-col">
                            <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                <div className="min-w-0">
                                    <div className={COMMAND_THEME_CLASS.eyebrow}>Access Mode</div>
                                    <div className="mt-2 text-sm leading-6 text-cyan-50/64">
                                        Choose one path and get moving.
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2 rounded-[1.2rem] border border-cyan-300/10 bg-white/[0.02] p-1">
                                    {[true, false].map((isLogin) => {
                                        const active = isLoginView === isLogin;
                                        return (
                                            <button
                                                key={String(isLogin)}
                                                type="button"
                                                onClick={() => switchView(isLogin)}
                                                className={commandCx(
                                                    'native-cursor rounded-[0.95rem] px-4 py-3 text-[11px] font-black uppercase tracking-[0.18em] transition',
                                                    active ? COMMAND_THEME_CLASS.tabActive : COMMAND_THEME_CLASS.tab,
                                                )}
                                            >
                                                {isLogin ? 'Log In' : 'Sign Up'}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col gap-4">
                                <div className={commandCx(COMMAND_THEME_CLASS.shellInset, 'rounded-[1.75rem] p-5 md:p-6')}>
                                    <div className="flex flex-col gap-5">
                                        <div className="min-w-0">
                                            <div className={COMMAND_THEME_CLASS.eyebrow}>{isLoginView ? 'Manual Login' : 'Account Creation'}</div>
                                            <div className="mt-2 text-xl font-black uppercase tracking-[0.08em] text-cyan-50">
                                                {formTitle}
                                            </div>
                                            <p className="mt-3 max-w-2xl text-sm leading-6 text-cyan-50/66">
                                                {formCopy}
                                            </p>
                                        </div>

                                        <div className="grid gap-4">
                                            <div>
                                                <label htmlFor="login-username" className={commandCx(COMMAND_THEME_CLASS.eyebrow, 'mb-2 block')}>
                                                    Email Or Callsign
                                                </label>
                                                <input
                                                    id="login-username"
                                                    data-login-primary="true"
                                                    type="text"
                                                    required
                                                    value={username}
                                                    onChange={(e) => setUsername(e.target.value)}
                                                    placeholder="Enter email or callsign"
                                                    autoComplete="username"
                                                    className={commandCx(COMMAND_THEME_CLASS.input, 'native-cursor relative z-10 pointer-events-auto')}
                                                />
                                            </div>

                                            <div>
                                                <div className="mb-2 flex items-center justify-between gap-3">
                                                    <label htmlFor="login-password" className={COMMAND_THEME_CLASS.eyebrow}>
                                                        Password
                                                    </label>
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowPassword((value) => !value)}
                                                        className="native-cursor text-[10px] font-black uppercase tracking-[0.18em] text-cyan-100/46 transition hover:text-cyan-50"
                                                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                                                    >
                                                        {showPassword ? 'Hide' : 'Show'}
                                                    </button>
                                                </div>
                                                <input
                                                    id="login-password"
                                                    type={showPassword ? 'text' : 'password'}
                                                    required
                                                    value={password}
                                                    onChange={(e) => setPassword(e.target.value)}
                                                    placeholder={isLoginView ? 'Enter your password' : 'Create a secure password'}
                                                    autoComplete={isLoginView ? 'current-password' : 'new-password'}
                                                    className={commandCx(COMMAND_THEME_CLASS.input, 'native-cursor relative z-10 pointer-events-auto', showPassword ? 'tracking-[0.04em]' : 'tracking-[0.16em]')}
                                                />
                                            </div>
                                        </div>

                                        {error && (
                                            <div className="rounded-2xl border border-rose-300/24 bg-rose-500/10 px-4 py-4 text-sm text-rose-100">
                                                <div className="flex items-start gap-3">
                                                    <svg className="mt-0.5 h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                                    </svg>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="break-words">{error}</p>
                                                        <div className="mt-3 flex flex-wrap gap-3 text-[10px] font-black uppercase tracking-[0.18em]">
                                                            <button type="button" onClick={() => setError(null)} className="native-cursor text-rose-100/80 transition hover:text-rose-50">
                                                                Dismiss
                                                            </button>
                                                            {isLoginView && (
                                                                <button type="button" onClick={() => switchView(false)} className="native-cursor text-cyan-100/80 transition hover:text-cyan-50">
                                                                    Create Account Instead
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                                            <div className="min-w-0 text-sm leading-6 text-cyan-50/62">
                                                {isLoginView
                                                    ? 'Fastest path back into your saved profile.'
                                                    : 'We will create the account immediately once your details check out.'}
                                            </div>
                                            <CommandButton type="submit" variant="primary" disabled={isAnyLoading} className="w-full min-w-0 justify-center sm:min-w-[220px]">
                                                {submitLabel}
                                            </CommandButton>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 px-1 pt-1">
                                    <div className="h-px flex-1 bg-cyan-300/10" />
                                    <div className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-100/34">Or Continue With Google</div>
                                    <div className="h-px flex-1 bg-cyan-300/10" />
                                </div>

                                <button
                                    type="button"
                                    onClick={handleGoogleLogin}
                                    disabled={isAnyLoading}
                                    className={commandCx(
                                        COMMAND_THEME_CLASS.shellInset,
                                        'native-cursor group flex w-full min-w-0 items-center gap-4 rounded-[1.5rem] px-5 py-4 text-left transition hover:border-cyan-300/24 hover:bg-cyan-400/[0.08] disabled:cursor-not-allowed disabled:opacity-50',
                                    )}
                                >
                                    {googleLoading ? (
                                        <svg className="h-5 w-5 shrink-0 animate-spin text-cyan-50/80" fill="none" viewBox="0 0 24 24">
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
                                        <div className="break-words text-[11px] font-black uppercase tracking-[0.2em] text-cyan-50">
                                            {googleActionLabel}
                                        </div>
                                        <div className="mt-1 break-words text-sm leading-6 text-cyan-50/58">
                                            Use the faster Google route if you want a quicker handoff into your synced account.
                                        </div>
                                    </div>
                                </button>

                                <div className="mt-auto flex flex-col gap-3 border-t border-cyan-300/10 pt-5 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-100/40 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="min-w-0">
                                        <span className="text-cyan-100/36">{togglePrompt}</span>{' '}
                                        <button
                                            type="button"
                                            onClick={() => switchView(!isLoginView)}
                                            className="native-cursor text-cyan-100/72 transition hover:text-cyan-50"
                                        >
                                            {toggleLabel}
                                        </button>
                                    </div>
                                    <div>ESC to close</div>
                                </div>
                            </form>
                        </div>
                    </section>
                </div>

                {googleLoading && (
                    <div className="absolute inset-0 z-30 flex items-center justify-center bg-[rgba(1,6,16,0.68)] backdrop-blur-md">
                        <div className={commandCx(COMMAND_THEME_CLASS.shellSoft, 'mx-6 w-full max-w-md rounded-[1.7rem] px-6 py-6 text-center')}>
                            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-cyan-200/18 border-t-cyan-200/90" />
                            <div className="mt-4 text-[11px] font-black uppercase tracking-[0.28em] text-cyan-200/72">
                                Redirect Handoff
                            </div>
                            <div className="mt-3 text-xl font-black uppercase tracking-[0.08em] text-cyan-50">
                                Redirecting To Google
                            </div>
                            <p className="mt-3 text-sm leading-6 text-cyan-50/70">
                                Hold position while we open the secure Google sign-in route.
                            </p>
                        </div>
                    </div>
                )}
            </CommandShell>
        </CommandOverlay>
    );
};
