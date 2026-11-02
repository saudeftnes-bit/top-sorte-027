import React, { useState } from 'react';

interface PasswordValidation {
    minLength: boolean;
    hasUppercase: boolean;
    hasLowercase: boolean;
    hasNumber: boolean;
    hasSymbol: boolean;
}

const validatePassword = (pwd: string): PasswordValidation => ({
    minLength: pwd.length >= 12,
    hasUppercase: /[A-Z]/.test(pwd),
    hasLowercase: /[a-z]/.test(pwd),
    hasNumber: /[0-9]/.test(pwd),
    hasSymbol: /[^A-Za-z0-9]/.test(pwd),
});

const isPasswordValid = (v: PasswordValidation): boolean =>
    Object.values(v).every(Boolean);

const ValidationItem: React.FC<{ ok: boolean; label: string }> = ({ ok, label }) => (
    <li className={`flex items-center gap-2 text-sm font-medium ${ok ? 'text-green-600' : 'text-slate-400'}`}>
        <span className={`w-4 h-4 flex-shrink-0 flex items-center justify-center rounded-full ${ok ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'}`}>
            {ok ? (
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
            ) : (
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                </svg>
            )}
        </span>
        {label}
    </li>
);

const AdminSecurity: React.FC = () => {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [error, setError] = useState('');
    const [showInstructions, setShowInstructions] = useState(false);
    const [savedNewPassword, setSavedNewPassword] = useState('');
    const [copied, setCopied] = useState(false);

    const validation = validatePassword(newPassword);

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        // Validate current password against env var
        const adminPassword = import.meta.env.VITE_ADMIN_PASSWORD;
        if (!adminPassword) {
            setError('Configuração de senha ausente. Verifique o arquivo .env.local.');
            return;
        }
        if (currentPassword !== adminPassword) {
            setError('Senha atual incorreta.');
            return;
        }

        // Validate new password requirements
        if (!isPasswordValid(validation)) {
            setError('A nova senha não atende todos os requisitos de segurança.');
            return;
        }

        // Validate confirmation
        if (newPassword !== confirmPassword) {
            setError('A confirmação da senha não coincide.');
            return;
        }

        // All good — show instructions
        setSavedNewPassword(newPassword);
        setShowInstructions(true);
    };

    const handleCopyPassword = () => {
        navigator.clipboard.writeText(savedNewPassword).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    const PasswordField = ({
        id,
        label,
        value,
        onChange,
        show,
        onToggleShow,
        placeholder,
    }: {
        id: string;
        label: string;
        value: string;
        onChange: (v: string) => void;
        show: boolean;
        onToggleShow: () => void;
        placeholder?: string;
    }) => (
        <div>
            <label htmlFor={id} className="block text-sm font-bold text-slate-700 mb-1.5">
                {label}
            </label>
            <div className="relative">
                <input
                    id={id}
                    type={show ? 'text' : 'password'}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="w-full px-4 py-3 pr-12 rounded-xl border-2 border-slate-200 focus:border-purple-600 focus:outline-none transition-colors font-medium text-slate-800"
                    placeholder={placeholder || 'Digite a senha'}
                    autoComplete="new-password"
                />
                <button
                    type="button"
                    onClick={onToggleShow}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-purple-600 transition-colors p-1 rounded-lg focus:outline-none"
                    aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}
                >
                    {show ? (
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
    );

    if (showInstructions) {
        return (
            <div className="space-y-6 max-w-2xl mx-auto">
                {/* Success header */}
                <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-6 text-center">
                    <div className="text-4xl mb-2">✅</div>
                    <h2 className="text-xl font-black text-green-800">Nova senha pronta!</h2>
                    <p className="text-green-700 text-sm mt-1">
                        Agora siga os passos abaixo para aplicar a mudança.
                    </p>
                </div>

                {/* Warning banner */}
                <div className="bg-yellow-50 border-2 border-yellow-300 rounded-2xl p-5 flex gap-3">
                    <span className="text-2xl flex-shrink-0">⚠️</span>
                    <div>
                        <p className="font-black text-yellow-800 text-sm">ATENÇÃO</p>
                        <p className="text-yellow-700 text-sm mt-1">
                            A senha <strong>ainda não foi trocada</strong>. O app não salva senhas diretamente — você precisa atualizar a variável de ambiente e fazer novo deploy.
                        </p>
                    </div>
                </div>

                {/* New password display */}
                <div className="bg-slate-900 rounded-2xl p-5">
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Nova senha gerada</p>
                    <div className="flex items-center gap-3">
                        <code className="text-green-400 font-mono text-sm flex-1 break-all">{savedNewPassword}</code>
                        <button
                            onClick={handleCopyPassword}
                            className="flex-shrink-0 bg-slate-700 hover:bg-slate-600 text-white px-3 py-2 rounded-lg text-xs font-bold transition-colors"
                        >
                            {copied ? '✅ Copiado!' : '📋 Copiar'}
                        </button>
                    </div>
                </div>

                {/* Step-by-step instructions */}
                <div className="bg-white border-2 border-slate-200 rounded-2xl overflow-hidden">
                    <div className="bg-slate-50 border-b border-slate-200 px-5 py-4">
                        <h3 className="font-black text-slate-800 text-base">📋 Passo a passo para aplicar</h3>
                    </div>
                    <div className="divide-y divide-slate-100">
                        {/* Step 1 */}
                        <div className="p-5 flex gap-4">
                            <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white font-black text-sm flex-shrink-0">1</div>
                            <div>
                                <p className="font-bold text-slate-800 text-sm">Atualizar o arquivo <code className="bg-slate-100 px-1.5 py-0.5 rounded text-purple-700">.env.local</code></p>
                                <p className="text-slate-500 text-sm mt-1">Abra o arquivo <code className="bg-slate-100 px-1 rounded">.env.local</code> na raiz do projeto e atualize a linha:</p>
                                <div className="mt-2 bg-slate-900 rounded-lg p-3">
                                    <code className="text-green-400 font-mono text-xs">VITE_ADMIN_PASSWORD=<span className="text-yellow-300">{savedNewPassword}</span></code>
                                </div>
                            </div>
                        </div>
                        {/* Step 2 */}
                        <div className="p-5 flex gap-4">
                            <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white font-black text-sm flex-shrink-0">2</div>
                            <div>
                                <p className="font-bold text-slate-800 text-sm">Atualizar a variável de ambiente no Vercel</p>
                                <p className="text-slate-500 text-sm mt-1">
                                    Acesse o painel do Vercel, vá em <strong>Settings → Environment Variables</strong>, encontre <code className="bg-slate-100 px-1 rounded">VITE_ADMIN_PASSWORD</code> e atualize o valor.
                                </p>
                                <a
                                    href="https://vercel.com/dashboard"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 mt-3 bg-black hover:bg-slate-800 text-white text-sm font-bold px-4 py-2 rounded-lg transition-colors"
                                >
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M12 1L24 22H0L12 1z" />
                                    </svg>
                                    Abrir Vercel Dashboard
                                </a>
                            </div>
                        </div>
                        {/* Step 3 */}
                        <div className="p-5 flex gap-4">
                            <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white font-black text-sm flex-shrink-0">3</div>
                            <div>
                                <p className="font-bold text-slate-800 text-sm">Fazer novo deploy</p>
                                <p className="text-slate-500 text-sm mt-1">
                                    Após atualizar a variável no Vercel, clique em <strong>Redeploy</strong> no último deployment para aplicar as mudanças. Ou faça um novo <code className="bg-slate-100 px-1 rounded">git push</code>.
                                </p>
                            </div>
                        </div>
                        {/* Step 4 */}
                        <div className="p-5 flex gap-4">
                            <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center text-white font-black text-sm flex-shrink-0">✓</div>
                            <div>
                                <p className="font-bold text-slate-800 text-sm">Após o deploy, teste o login</p>
                                <p className="text-slate-500 text-sm mt-1">
                                    Faça logout e entre novamente com a nova senha para confirmar que tudo está funcionando.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <button
                    onClick={() => {
                        setShowInstructions(false);
                        setCurrentPassword('');
                        setNewPassword('');
                        setConfirmPassword('');
                        setSavedNewPassword('');
                        setError('');
                    }}
                    className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl transition-colors"
                >
                    ← Voltar
                </button>
            </div>
        );
    }

    return (
        <div className="max-w-lg mx-auto space-y-6">
            {/* Header */}
            <div className="bg-white rounded-2xl border-2 border-slate-200 p-6">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center text-xl">🔐</div>
                    <div>
                        <h2 className="text-xl font-black text-slate-900">Segurança do Admin</h2>
                        <p className="text-slate-400 text-sm">Alterar senha de acesso ao painel</p>
                    </div>
                </div>
            </div>

            {/* Password change form */}
            <div className="bg-white rounded-2xl border-2 border-slate-200 p-6">
                <form onSubmit={handleSave} className="space-y-5">
                    <PasswordField
                        id="currentPassword"
                        label="Senha Atual"
                        value={currentPassword}
                        onChange={setCurrentPassword}
                        show={showCurrent}
                        onToggleShow={() => setShowCurrent(p => !p)}
                        placeholder="Digite a senha atual"
                    />

                    <PasswordField
                        id="newPassword"
                        label="Nova Senha"
                        value={newPassword}
                        onChange={setNewPassword}
                        show={showNew}
                        onToggleShow={() => setShowNew(p => !p)}
                        placeholder="Mínimo 12 caracteres"
                    />

                    {/* Password strength checklist */}
                    {newPassword.length > 0 && (
                        <div className="bg-slate-50 rounded-xl p-4">
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Requisitos da nova senha</p>
                            <ul className="space-y-1.5">
                                <ValidationItem ok={validation.minLength} label="Mínimo 12 caracteres" />
                                <ValidationItem ok={validation.hasUppercase} label="Pelo menos uma letra maiúscula (A-Z)" />
                                <ValidationItem ok={validation.hasLowercase} label="Pelo menos uma letra minúscula (a-z)" />
                                <ValidationItem ok={validation.hasNumber} label="Pelo menos um número (0-9)" />
                                <ValidationItem ok={validation.hasSymbol} label="Pelo menos um símbolo (!@#$%...)" />
                            </ul>
                        </div>
                    )}

                    <PasswordField
                        id="confirmPassword"
                        label="Confirmar Nova Senha"
                        value={confirmPassword}
                        onChange={setConfirmPassword}
                        show={showConfirm}
                        onToggleShow={() => setShowConfirm(p => !p)}
                        placeholder="Repita a nova senha"
                    />

                    {/* Match indicator */}
                    {confirmPassword.length > 0 && (
                        <p className={`text-sm font-bold flex items-center gap-1.5 ${newPassword === confirmPassword ? 'text-green-600' : 'text-red-500'}`}>
                            {newPassword === confirmPassword ? '✅ Senhas coincidem' : '❌ Senhas não coincidem'}
                        </p>
                    )}

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
                        disabled={!currentPassword || !newPassword || !confirmPassword}
                        className="w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-black py-4 rounded-xl shadow-lg transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        🔐 Gerar Instruções de Troca
                    </button>
                </form>
            </div>

            {/* Info card */}
            <div className="bg-yellow-50 border-2 border-yellow-200 rounded-2xl p-5 flex gap-3">
                <span className="text-xl flex-shrink-0">ℹ️</span>
                <div className="text-sm text-yellow-800 space-y-1">
                    <p className="font-bold">Como funciona a troca de senha?</p>
                    <p>A senha é armazenada como variável de ambiente (<code className="bg-yellow-100 px-1 rounded">VITE_ADMIN_PASSWORD</code>). Após gerar as instruções, você precisará atualizar o arquivo <code className="bg-yellow-100 px-1 rounded">.env.local</code> e a configuração no Vercel, depois fazer um novo deploy.</p>
                </div>
            </div>
        </div>
    );
};

export default AdminSecurity;
