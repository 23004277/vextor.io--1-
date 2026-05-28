import React, { useState, useEffect, useRef } from 'react';
import { BackendService } from '../services/BackendService';
import { User } from '../types';

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
    const [mounted, setMounted] = useState(false);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animRef = useRef<number>(0);

    // Mount animation
    useEffect(() => {
        const t = setTimeout(() => setMounted(true), 10);
        return () => clearTimeout(t);
    }, []);

    // Escape key
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onClose]);

    // Animated grid background
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const resize = () => {
            canvas.width = canvas.offsetWidth;
            canvas.height = canvas.offsetHeight;
        };
        resize();

        let frame = 0;
        const particles: { x: number; y: number; vx: number; vy: number; life: number; maxLife: number }[] = [];

        for (let i = 0; i < 24; i++) {
            particles.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                vx: (Math.random() - 0.5) * 0.3,
                vy: (Math.random() - 0.5) * 0.3,
                life: Math.random() * 200,
                maxLife: 200 + Math.random() * 200
            });
        }

        const draw = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            frame++;

            // Grid lines
            ctx.strokeStyle = 'rgba(0, 210, 255, 0.03)';
            ctx.lineWidth = 1;
            const gridSize = 40;
            for (let x = 0; x < canvas.width; x += gridSize) {
                ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
            }
            for (let y = 0; y < canvas.height; y += gridSize) {
                ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
            }

            // Particles
            particles.forEach(p => {
                p.x += p.vx; p.y += p.vy; p.life++;
                if (p.life > p.maxLife) {
                    p.x = Math.random() * canvas.width;
                    p.y = Math.random() * canvas.height;
                    p.life = 0;
                }
                const alpha = Math.sin((p.life / p.maxLife) * Math.PI) * 0.6;
                ctx.beginPath();
                ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(0, 210, 255, ${alpha})`;
                ctx.fill();
            });

            // Connect nearby particles
            for (let i = 0; i < particles.length; i++) {
                for (let j = i + 1; j < particles.length; j++) {
                    const dx = particles[i].x - particles[j].x;
                    const dy = particles[i].y - particles[j].y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < 100) {
                        ctx.beginPath();
                        ctx.moveTo(particles[i].x, particles[i].y);
                        ctx.lineTo(particles[j].x, particles[j].y);
                        ctx.strokeStyle = `rgba(0, 210, 255, ${(1 - dist / 100) * 0.08})`;
                        ctx.lineWidth = 1;
                        ctx.stroke();
                    }
                }
            }

            animRef.current = requestAnimationFrame(draw);
        };
        draw();

        return () => cancelAnimationFrame(animRef.current);
    }, []);

    const handleGoogleLogin = async () => {
        setError(null);
        setGoogleLoading(true);
        try {
            const response = await BackendService.loginWithGoogle();
            if (response.success && response.user) {
                onLoginSuccess(response.user);
                onClose();
            } else {
                setError(response.error || 'Google authentication failed.');
            }
        } catch {
            setError('Google sign-in failed. Please try again.');
        } finally {
            setGoogleLoading(false);
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
        <div
            className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
            style={{
                background: 'radial-gradient(ellipse at 50% 40%, rgba(0,20,40,0.97) 0%, rgba(0,5,15,0.99) 100%)',
                backdropFilter: 'blur(24px)',
                opacity: mounted ? 1 : 0,
                transition: 'opacity 0.25s ease',
            }}
            onClick={onClose}
        >
            {/* Full-screen canvas background */}
            <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full pointer-events-none"
                style={{ opacity: 0.8 }}
            />

            {/* Ambient glow orbs */}
            <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full pointer-events-none"
                style={{ background: 'radial-gradient(circle, rgba(0,180,255,0.06) 0%, transparent 70%)', filter: 'blur(40px)' }} />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full pointer-events-none"
                style={{ background: 'radial-gradient(circle, rgba(0,80,255,0.05) 0%, transparent 70%)', filter: 'blur(40px)' }} />

            {/* Modal Card */}
            <div
                className="relative w-full max-w-[440px] rounded-[28px] overflow-hidden"
                style={{
                    background: 'linear-gradient(145deg, rgba(10,18,35,0.98) 0%, rgba(5,10,22,0.99) 100%)',
                    border: '1px solid rgba(0,180,255,0.15)',
                    boxShadow: '0 0 0 1px rgba(0,0,0,0.5), 0 40px 80px rgba(0,0,0,0.8), 0 0 60px rgba(0,180,255,0.06), inset 0 1px 0 rgba(255,255,255,0.04)',
                    transform: mounted ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.97)',
                    transition: 'transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
                onClick={e => e.stopPropagation()}
            >
                {/* Top accent line */}
                <div className="absolute top-0 left-0 right-0 h-px"
                    style={{ background: 'linear-gradient(90deg, transparent, rgba(0,210,255,0.6), rgba(60,120,255,0.4), transparent)' }} />

                {/* Corner brackets — decorative */}
                <div className="absolute top-4 left-4 w-5 h-5 pointer-events-none"
                    style={{ borderTop: '2px solid rgba(0,210,255,0.3)', borderLeft: '2px solid rgba(0,210,255,0.3)', borderRadius: '3px 0 0 0' }} />
                <div className="absolute top-4 right-4 w-5 h-5 pointer-events-none"
                    style={{ borderTop: '2px solid rgba(0,210,255,0.3)', borderRight: '2px solid rgba(0,210,255,0.3)', borderRadius: '0 3px 0 0' }} />
                <div className="absolute bottom-4 left-4 w-5 h-5 pointer-events-none"
                    style={{ borderBottom: '2px solid rgba(0,210,255,0.15)', borderLeft: '2px solid rgba(0,210,255,0.15)', borderRadius: '0 0 0 3px' }} />
                <div className="absolute bottom-4 right-4 w-5 h-5 pointer-events-none"
                    style={{ borderBottom: '2px solid rgba(0,210,255,0.15)', borderRight: '2px solid rgba(0,210,255,0.15)', borderRadius: '0 0 3px 0' }} />

                <div className="px-8 pt-10 pb-8 relative z-10">

                    {/* Close button */}
                    <button
                        onClick={onClose}
                        className="absolute top-6 right-6 w-8 h-8 flex items-center justify-center rounded-lg transition-all"
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,60,60,0.15)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                    >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="rgba(255,255,255,0.3)" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>

                    {/* Header */}
                    <div className="mb-8">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="flex gap-1">
                                <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#00d2ff', boxShadow: '0 0 6px #00d2ff' }} />
                                <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'rgba(0,210,255,0.3)' }} />
                                <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'rgba(0,210,255,0.15)' }} />
                            </div>
                            <span style={{
                                fontSize: '9px',
                                fontFamily: '"Courier New", monospace',
                                letterSpacing: '0.25em',
                                color: 'rgba(0,210,255,0.5)',
                                textTransform: 'uppercase',
                            }}>
                                COMMANDER_ACCESS
                            </span>
                        </div>

                        <h1 style={{
                            fontSize: '30px',
                            fontFamily: '"Arial Black", "Arial Bold", sans-serif',
                            fontWeight: 900,
                            fontStyle: 'italic',
                            letterSpacing: '-0.02em',
                            lineHeight: 1,
                            textTransform: 'uppercase',
                            color: '#fff',
                            marginBottom: '8px',
                        }}>
                            {isLoginView ? 'Welcome\nBack' : 'Enlist\nNow'}
                        </h1>

                        <p style={{
                            fontSize: '11px',
                            fontFamily: '"Courier New", monospace',
                            color: 'rgba(255,255,255,0.3)',
                            letterSpacing: '0.05em',
                        }}>
                            {isLoginView
                                ? 'Sign in to sync your stats, tank, and rewards.'
                                : 'Create your account to save progress and unlock cloud rewards.'}
                        </p>
                    </div>

                    {/* Tab switcher */}
                    <div className="flex mb-7 p-1 rounded-xl gap-1"
                        style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.05)' }}>
                        {[true, false].map((isLogin) => (
                            <button
                                key={String(isLogin)}
                                onClick={() => switchView(isLogin)}
                                className="flex-1 py-2.5 rounded-lg transition-all"
                                style={{
                                    fontSize: '10px',
                                    fontFamily: '"Courier New", monospace',
                                    fontWeight: 700,
                                    letterSpacing: '0.15em',
                                    textTransform: 'uppercase',
                                    ...(isLoginView === isLogin
                                        ? {
                                            background: 'linear-gradient(135deg, rgba(0,160,220,0.25), rgba(0,80,200,0.2))',
                                            border: '1px solid rgba(0,180,255,0.25)',
                                            color: '#00d2ff',
                                            boxShadow: '0 0 20px rgba(0,180,255,0.1)',
                                        }
                                        : {
                                            background: 'transparent',
                                            border: '1px solid transparent',
                                            color: 'rgba(255,255,255,0.25)',
                                        }),
                                }}
                            >
                                {isLogin ? 'Login' : 'Create Account'}
                            </button>
                        ))}
                    </div>

                    {/* Google button */}
                    <button
                        onClick={handleGoogleLogin}
                        disabled={isAnyLoading}
                        className="w-full flex items-center justify-center gap-3 py-3.5 rounded-xl mb-5 transition-all relative overflow-hidden group"
                        style={{
                            background: googleLoading
                                ? 'rgba(255,255,255,0.05)'
                                : 'rgba(255,255,255,0.06)',
                            border: '1px solid rgba(255,255,255,0.12)',
                            boxShadow: googleLoading ? 'none' : '0 0 0 0 rgba(255,255,255,0)',
                            cursor: isAnyLoading ? 'not-allowed' : 'pointer',
                            opacity: isAnyLoading && !googleLoading ? 0.5 : 1,
                        }}
                        onMouseEnter={e => {
                            if (!isAnyLoading) {
                                e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.22)';
                                e.currentTarget.style.boxShadow = '0 0 30px rgba(255,255,255,0.05)';
                            }
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)';
                            e.currentTarget.style.boxShadow = 'none';
                        }}
                    >
                        {googleLoading ? (
                            <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.4)" strokeWidth="4" />
                                <path className="opacity-75" fill="rgba(255,255,255,0.8)" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                        ) : (
                            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z" />
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.85c.87-2.6 3.3-4.53 6.16-4.53z" />
                            </svg>
                        )}
                        <span style={{
                            fontSize: '12px',
                            fontFamily: '"Arial Black", sans-serif',
                            fontWeight: 900,
                            letterSpacing: '0.08em',
                            color: googleLoading ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.85)',
                            textTransform: 'uppercase',
                        }}>
                            {googleLoading ? 'Authenticating...' : 'Continue with Google'}
                        </span>
                    </button>

                    {/* Divider */}
                    <div className="flex items-center gap-3 mb-5">
                        <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.07)' }} />
                        <span style={{ fontSize: '9px', fontFamily: '"Courier New", monospace', color: 'rgba(255,255,255,0.2)', letterSpacing: '0.2em' }}>
                            OR
                        </span>
                        <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.07)' }} />
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-4">

                        {/* Username field */}
                        <div>
                            <label style={{
                                display: 'block',
                                fontSize: '9px',
                                fontFamily: '"Courier New", monospace',
                                letterSpacing: '0.2em',
                                color: 'rgba(0,210,255,0.5)',
                                textTransform: 'uppercase',
                                marginBottom: '8px',
                            }}>
                                Pilot Identity
                            </label>
                            <input
                                type="text"
                                required
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                                placeholder="email or callsign"
                                autoComplete="username"
                                className="w-full transition-all outline-none"
                                style={{
                                    padding: '13px 16px',
                                    borderRadius: '12px',
                                    background: 'rgba(0,0,0,0.5)',
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    color: 'rgba(255,255,255,0.9)',
                                    fontSize: '14px',
                                    fontFamily: '"Courier New", monospace',
                                    letterSpacing: '0.05em',
                                }}
                                onFocus={e => {
                                    e.target.style.borderColor = 'rgba(0,180,255,0.4)';
                                    e.target.style.background = 'rgba(0,20,40,0.7)';
                                    e.target.style.boxShadow = '0 0 0 3px rgba(0,180,255,0.07), inset 0 0 20px rgba(0,180,255,0.03)';
                                }}
                                onBlur={e => {
                                    e.target.style.borderColor = 'rgba(255,255,255,0.08)';
                                    e.target.style.background = 'rgba(0,0,0,0.5)';
                                    e.target.style.boxShadow = 'none';
                                }}
                            />
                        </div>

                        {/* Password field */}
                        <div>
                            <label style={{
                                display: 'block',
                                fontSize: '9px',
                                fontFamily: '"Courier New", monospace',
                                letterSpacing: '0.2em',
                                color: 'rgba(0,210,255,0.5)',
                                textTransform: 'uppercase',
                                marginBottom: '8px',
                            }}>
                                Security Key
                            </label>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    required
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    autoComplete={isLoginView ? 'current-password' : 'new-password'}
                                    className="w-full transition-all outline-none"
                                    style={{
                                        padding: '13px 48px 13px 16px',
                                        borderRadius: '12px',
                                        background: 'rgba(0,0,0,0.5)',
                                        border: '1px solid rgba(255,255,255,0.08)',
                                        color: 'rgba(255,255,255,0.9)',
                                        fontSize: '14px',
                                        fontFamily: '"Courier New", monospace',
                                        letterSpacing: showPassword ? '0.05em' : '0.15em',
                                    }}
                                    onFocus={e => {
                                        e.target.style.borderColor = 'rgba(0,180,255,0.4)';
                                        e.target.style.background = 'rgba(0,20,40,0.7)';
                                        e.target.style.boxShadow = '0 0 0 3px rgba(0,180,255,0.07), inset 0 0 20px rgba(0,180,255,0.03)';
                                    }}
                                    onBlur={e => {
                                        e.target.style.borderColor = 'rgba(255,255,255,0.08)';
                                        e.target.style.background = 'rgba(0,0,0,0.5)';
                                        e.target.style.boxShadow = 'none';
                                    }}
                                />
                                <button
                                    type="button"
                                    tabIndex={-1}
                                    onClick={() => setShowPassword(v => !v)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 transition-opacity"
                                    style={{ opacity: 0.35, color: '#fff' }}
                                    onMouseEnter={e => (e.currentTarget.style.opacity = '0.8')}
                                    onMouseLeave={e => (e.currentTarget.style.opacity = '0.35')}
                                >
                                    {showPassword ? (
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                        </svg>
                                    ) : (
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                        </svg>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Error banner */}
                        {error && (
                            <div
                                className="rounded-xl px-4 py-3 flex items-start gap-3"
                                style={{
                                    background: 'rgba(255,40,40,0.08)',
                                    border: '1px solid rgba(255,60,60,0.25)',
                                    animation: 'slideDown 0.2s ease',
                                }}
                            >
                                <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="rgba(255,80,80,0.9)" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                <div className="flex-1">
                                    <p style={{ fontSize: '11px', fontFamily: '"Courier New", monospace', color: 'rgba(255,100,100,0.9)', letterSpacing: '0.04em' }}>
                                        {error}
                                    </p>
                                    <div className="flex gap-2 mt-2">
                                        <button
                                            type="button"
                                            onClick={() => setError(null)}
                                            style={{ fontSize: '9px', fontFamily: '"Courier New", monospace', color: 'rgba(255,120,120,0.7)', letterSpacing: '0.1em', textTransform: 'uppercase', textDecoration: 'underline' }}
                                        >
                                            Dismiss
                                        </button>
                                        {isLoginView && (
                                            <button
                                                type="button"
                                                onClick={() => switchView(false)}
                                                style={{ fontSize: '9px', fontFamily: '"Courier New", monospace', color: 'rgba(0,200,255,0.7)', letterSpacing: '0.1em', textTransform: 'uppercase', textDecoration: 'underline' }}
                                            >
                                                Create Account Instead
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Submit button */}
                        <button
                            type="submit"
                            disabled={isAnyLoading}
                            className="w-full py-4 rounded-xl transition-all relative overflow-hidden"
                            style={{
                                background: loading
                                    ? 'rgba(0,100,180,0.3)'
                                    : isLoginView
                                        ? 'linear-gradient(135deg, #0099cc, #0055bb)'
                                        : 'linear-gradient(135deg, #00aa66, #005533)',
                                border: isLoginView
                                    ? '1px solid rgba(0,180,255,0.3)'
                                    : '1px solid rgba(0,200,120,0.3)',
                                boxShadow: loading
                                    ? 'none'
                                    : isLoginView
                                        ? '0 0 30px rgba(0,150,220,0.2), inset 0 1px 0 rgba(255,255,255,0.1)'
                                        : '0 0 30px rgba(0,180,100,0.2), inset 0 1px 0 rgba(255,255,255,0.1)',
                                cursor: isAnyLoading ? 'not-allowed' : 'pointer',
                                opacity: isAnyLoading && !loading ? 0.5 : 1,
                                transform: 'translateY(0)',
                            }}
                            onMouseEnter={e => { if (!isAnyLoading) e.currentTarget.style.transform = 'translateY(-1px)'; }}
                            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
                            onMouseDown={e => { if (!isAnyLoading) e.currentTarget.style.transform = 'translateY(1px)'; }}
                            onMouseUp={e => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
                        >
                            <span style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '10px',
                                fontSize: '13px',
                                fontFamily: '"Arial Black", sans-serif',
                                fontWeight: 900,
                                letterSpacing: '0.15em',
                                textTransform: 'uppercase',
                                color: loading ? 'rgba(255,255,255,0.5)' : '#fff',
                            }}>
                                {loading ? (
                                    <>
                                        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                        </svg>
                                        {isLoginView ? 'Authenticating...' : 'Creating Account...'}
                                    </>
                                ) : (
                                    isLoginView ? 'Login' : 'Create Account'
                                )}
                            </span>
                        </button>
                    </form>

                    {/* Footer */}
                    <div className="mt-6 flex items-center justify-between">
                        <button
                            type="button"
                            onClick={() => switchView(!isLoginView)}
                            style={{
                                fontSize: '10px',
                                fontFamily: '"Courier New", monospace',
                                color: 'rgba(0,180,255,0.45)',
                                letterSpacing: '0.05em',
                                transition: 'color 0.2s',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.color = 'rgba(0,210,255,0.8)')}
                            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(0,180,255,0.45)')}
                        >
                            {isLoginView ? "New commander? Create account →" : "Already enlisted? Login →"}
                        </button>
                        <span style={{
                            fontSize: '8px',
                            fontFamily: '"Courier New", monospace',
                            color: 'rgba(255,255,255,0.1)',
                            letterSpacing: '0.15em',
                        }}>
                            ENC//ACTIVE
                        </span>
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes slideDown {
                    from { opacity: 0; transform: translateY(-6px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
};