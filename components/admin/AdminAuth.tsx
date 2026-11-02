import React, { useState, useEffect } from 'react';

interface AdminAuthProps {
    onAuthenticated: () => void;
}

// Rate limiting constants
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 5 * 60 * 1000; // 5 minutes
// Session constants
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000; // 8 hours

interface LockData {
    attempts: number;
    lockedUntil: number | null;
}

const getLockData = (): LockData => {
    try {
        const raw = localStorage.getItem('admin_lock');
        if (!raw) return { attempts: 0, lockedUntil: null };
        return JSON.parse(raw) as LockData;
    } catch {
        return { attempts: 0, lockedUntil: null };
    }
};

const saveLockData = (data: LockData) => {
    localStorage.setItem('admin_lock', JSON.stringify(data));
};

const AdminAuth: React.FC<AdminAuthProps> = ({ onAuthenticated }) => {
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // Rate limiting / lockout state
    const [isLocked, setIsLocked] = useState(false);
    const [lockCountdown, setLockCountdown] = useState(0);

    // Check and update lockout state on mount and via interval
    useEffect(() => {
        const checkLock = () => {
            const lockData = getLockData();
            if (lockData.lockedUntil && Date.now() < lockData.lockedUntil) {
                setIsLocked(true);
                setLockCountdown(Math.ceil((lockData.lockedUntil - Date.now()) / 1000));
            } else if (lockData.lockedUntil && Date.now() >= lockData.lockedUntil) {
                // Lockout expired — reset
                saveLockData({ attempts: 0, lockedUntil: null });
                setIsLocked(false);
                setLockCountdown(0);
            } else {
                setIsLocked(false);
                setLockCountdown(0);
            }
        };

        checkLock();
        const interval = setInterval(checkLock, 1000);
        return () => clearInterval(interval);
    }, []);

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();

        // Abort if still locked
        const lockData = getLockData();
        if (lockData.lockedUntil && Date.now() < lockData.lockedUntil) {
            return;
        }

        setIsLoading(true);
        setError('');

        // Use only the environment variable — no hardcoded fallback
        const adminPassword = import.meta.env.VITE_ADMIN_PASSWORD;

        if (!adminPassword) {
            setError('Configuração de senha ausente. Contate o administrador do sistema.');
            setIsLoading(false);
            return;
        }

        if (password === adminPassword) {
            // Success: reset lock data and create session with expiry
            saveLockData({ attempts: 0, lockedUntil: null });

            const token = btoa(password + Date.now());
            const session = { token, expires: Date.now() + SESSION_DURATION_MS };
            localStorage.setItem('admin_session', JSON.stringify(session));

            onAuthenticated();
        } else {
            // Failed attempt
            const currentAttempts = lockData.attempts + 1;

            if (currentAttempts >= MAX_ATTEMPTS) {
                // Lock account
                const lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
                saveLockData({ attempts: currentAttempts, lockedUntil });
                setIsLocked(true);
                setLockCountdown(Math.ceil(LOCKOUT_DURATION_MS / 1000));
                setError('');
            } else {
                saveLockData({ attempts: currentAttempts, lockedUntil: null });
                const remaining = MAX_ATTEMPTS - currentAttempts;
                setError(`Senha incorreta. ${remaining} tentativa${remaining !== 1 ? 's' : ''} restante${remaining !== 1 ? 's' : ''} antes do bloqueio.`);
            }

            setIsLoading(false);
        }
    };

    // Format countdown as MM:SS
    const formatCountdown = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-700 via-purple-800 to-slate-900 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md">
                {/* Logo + Título */}
                <div className="text-center mb-8">
                    <div className="flex justify-center mb-4">
                        <img
                            src="/logo.png"
                            alt="Top Sorte"
                            className="w-24 h-24 rounded-2xl object-cover shadow-xl border-4 border-purple-100"
                            onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                            }}
                        />
                    </div>
                    <h1 className="text-3xl font-black text-slate-900 mb-1">Painel Admin</h1>
                    <p className="text-purple-600 font-bold text-sm uppercase tracking-widest">Top Sorte 027</p>
                    <p className="text-slate-400 text-xs mt-1">Área restrita — somente administradores</p>
                </div>

                {/* Lockout notice */}
                {isLocked ? (
                    <div className="bg-red-50 border-2 border-red-300 rounded-2xl p-6 text-center space-y-3">
                        <div className="text-4xl">🔒</div>
                        <h2 className="text-lg font-black text-red-700">Acesso Bloqueado</h2>
                        <p className="text-sm text-red-600">
                            Muitas tentativas incorretas. Tente novamente em:
                        </p>
                        <div className="text-3xl font-black text-red-700 font-mono">
                            {formatCountdown(lockCountdown)}
                        </div>
                        <p className="text-xs text-red-400">
                            O bloqueio expira automaticamente.
                        </p>
                    </div>
                ) : (
                    <form onSubmit={handleLogin} className="space-y-5">
                        <div>
                            <label htmlFor="password" className="block text-sm font-bold text-slate-700 mb-2">
                                Senha de Administrador
                            </label>
                            <div className="relative">
                                <input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full px-4 py-3 pr-12 rounded-xl border-2 border-slate-200 focus:border-purple-600 focus:outline-none transition-colors font-medium text-slate-800"
                                    placeholder="Digite sua senha"
                                    required
                                    autoComplete="current-password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(prev => !prev)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-purple-600 transition-colors p-1 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300"
                                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                                >
                                    {showPassword ? (
                                        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                        </svg>
                                    ) : (
                                        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                        </svg>
                                    )}
                                </button>
                            </div>
                        </div>

                        {error && (
                            <div className="bg-red-50 border-2 border-red-200 rounded-xl p-3 flex items-center gap-2">
                                <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                </svg>
                                <p className="text-sm font-bold text-red-700">{error}</p>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isLoading || !password}
                            className="w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-black py-4 rounded-xl shadow-lg transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isLoading ? (
                                <>
                                    <svg className="animate-spin w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                    Verificando...
                                </>
                            ) : (
                                <>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14" />
                                    </svg>
                                    ENTRAR
                                </>
                            )}
                        </button>
                    </form>
                )}

                <div className="mt-6 text-center">
                    <p className="text-xs text-slate-400">
                        🔒 Acesso protegido • Top Sorte 027
                    </p>
                </div>
            </div>
        </div>
    );
};

export default AdminAuth;
