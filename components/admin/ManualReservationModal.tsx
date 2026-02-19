import React, { useState } from 'react';

interface ManualReservationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (data: { name: string; phone: string; numbers: string[] }) => Promise<boolean>;
}

// Phone mask: (xx) xxxxx-xxxx
function formatPhone(value: string): string {
    // Remove everything that's not a digit
    const digits = value.replace(/\D/g, '').slice(0, 11);

    if (digits.length === 0) return '';
    if (digits.length <= 2) return `(${digits}`;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

type Step = 'form' | 'confirm' | 'success';

const ManualReservationModal: React.FC<ManualReservationModalProps> = ({ isOpen, onClose, onConfirm }) => {
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [numbersInput, setNumbersInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [step, setStep] = useState<Step>('form');
    const [parsedNumbers, setParsedNumbers] = useState<string[]>([]);

    if (!isOpen) return null;

    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setPhone(formatPhone(e.target.value));
    };

    const handleNext = (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg('');

        const numbers = numbersInput
            .split(/[\s,]+/)
            .map(n => n.trim())
            .filter(n => n.length > 0)
            .map(n => n.padStart(2, '0'));

        if (numbers.length === 0) {
            setErrorMsg('Por favor, insira pelo menos um número.');
            return;
        }

        if (phone.replace(/\D/g, '').length < 10) {
            setErrorMsg('Telefone inválido. Use o formato (xx) xxxxx-xxxx.');
            return;
        }

        setParsedNumbers(numbers);
        setStep('confirm');
    };

    const handleConfirm = async () => {
        setIsLoading(true);
        setErrorMsg('');
        const success = await onConfirm({ name, phone, numbers: parsedNumbers });
        setIsLoading(false);

        if (success) {
            setStep('success');
        } else {
            setErrorMsg('Erro ao salvar reserva. Tente novamente.');
            setStep('form');
        }
    };

    const handleClose = () => {
        setName('');
        setPhone('');
        setNumbersInput('');
        setErrorMsg('');
        setStep('form');
        setParsedNumbers([]);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">

                {/* Header */}
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 to-purple-50">
                    <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                        <span>📝</span>
                        {step === 'form' && 'Nova Reserva Manual'}
                        {step === 'confirm' && 'Confirmar Reserva'}
                        {step === 'success' && 'Reserva Criada!'}
                    </h3>
                    <button
                        onClick={handleClose}
                        disabled={isLoading}
                        className="text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-50"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* ── STEP: FORM ── */}
                {step === 'form' && (
                    <form onSubmit={handleNext} className="p-6 space-y-4">
                        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                            <p className="text-xs text-yellow-800 font-medium">
                                ⚠️ Reservas manuais são criadas como <span className="font-black">PAGAS</span> e os números ficarão indisponíveis para outros usuários.
                            </p>
                        </div>

                        {/* Error */}
                        {errorMsg && (
                            <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2">
                                <span className="text-red-500 text-lg">❌</span>
                                <p className="text-sm text-red-700 font-semibold">{errorMsg}</p>
                            </div>
                        )}

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome do Comprador</label>
                            <input
                                type="text"
                                required
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-purple-600 focus:outline-none font-bold text-slate-900 transition-colors"
                                placeholder="Ex: João da Silva"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Telefone (WhatsApp)</label>
                            <input
                                type="tel"
                                required
                                value={phone}
                                onChange={handlePhoneChange}
                                className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-purple-600 focus:outline-none font-bold text-slate-900 tracking-wider transition-colors"
                                placeholder="(xx) xxxxx-xxxx"
                                inputMode="numeric"
                            />
                            <p className="text-[10px] text-slate-400 mt-1 font-medium">Formato: (xx) xxxxx-xxxx</p>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Números (separados por vírgula)</label>
                            <textarea
                                required
                                value={numbersInput}
                                onChange={(e) => setNumbersInput(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-purple-600 focus:outline-none font-bold text-slate-900 min-h-[90px] transition-colors"
                                placeholder="Ex: 01, 05, 10, 23"
                            />
                            <p className="text-[10px] text-slate-400 mt-1 font-medium text-right">
                                * Separe os números por vírgula ou espaço
                            </p>
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button
                                type="button"
                                onClick={handleClose}
                                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-3 rounded-xl transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-purple-200 transition-all active:scale-95 flex items-center justify-center gap-2"
                            >
                                <span>Revisar</span>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </button>
                        </div>
                    </form>
                )}

                {/* ── STEP: CONFIRM ── */}
                {step === 'confirm' && (
                    <div className="p-6 space-y-5">
                        <p className="text-sm text-slate-500 font-medium">Confira os dados antes de salvar:</p>

                        <div className="bg-slate-50 rounded-2xl p-5 space-y-3 border border-slate-200">
                            <div className="flex items-center gap-3">
                                <span className="text-2xl">👤</span>
                                <div>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase">Nome</p>
                                    <p className="text-slate-900 font-black text-lg">{name}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-2xl">📱</span>
                                <div>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase">Telefone</p>
                                    <p className="text-slate-900 font-black text-lg">{phone}</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <span className="text-2xl mt-1">🎟️</span>
                                <div>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase">Números ({parsedNumbers.length})</p>
                                    <div className="flex flex-wrap gap-1.5 mt-1">
                                        {parsedNumbers.map(n => (
                                            <span key={n} className="bg-purple-100 text-purple-800 font-black text-sm px-2.5 py-1 rounded-lg">
                                                {n}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                            <p className="text-xs text-amber-800 font-semibold text-center">
                                ⚠️ Esta ação irá marcar os números acima como <strong>PAGOS</strong>. Isso não pode ser facilmente desfeito.
                            </p>
                        </div>

                        {errorMsg && (
                            <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                                <p className="text-sm text-red-700 font-semibold text-center">❌ {errorMsg}</p>
                            </div>
                        )}

                        <div className="flex gap-3">
                            <button
                                onClick={() => setStep('form')}
                                disabled={isLoading}
                                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                                Editar
                            </button>
                            <button
                                onClick={handleConfirm}
                                disabled={isLoading}
                                className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-green-200 transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {isLoading ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        Salvando...
                                    </>
                                ) : (
                                    <>
                                        <span>✅</span> Confirmar e Salvar
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}

                {/* ── STEP: SUCCESS ── */}
                {step === 'success' && (
                    <div className="p-8 flex flex-col items-center text-center gap-4">
                        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center text-4xl">
                            🎉
                        </div>
                        <div>
                            <h4 className="text-2xl font-black text-slate-900">Reserva Criada!</h4>
                            <p className="text-slate-500 font-medium mt-1">
                                {parsedNumbers.length} número{parsedNumbers.length !== 1 ? 's' : ''} reservado{parsedNumbers.length !== 1 ? 's' : ''} para <strong>{name}</strong>.
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-1.5 justify-center">
                            {parsedNumbers.map(n => (
                                <span key={n} className="bg-green-100 text-green-800 font-black text-sm px-2.5 py-1 rounded-lg">
                                    {n}
                                </span>
                            ))}
                        </div>
                        <button
                            onClick={handleClose}
                            className="mt-2 w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-xl transition-all active:scale-95"
                        >
                            Fechar
                        </button>
                    </div>
                )}

            </div>
        </div>
    );
};

export default ManualReservationModal;
