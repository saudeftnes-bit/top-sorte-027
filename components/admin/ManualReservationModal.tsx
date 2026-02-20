import React, { useState } from 'react';

interface ManualReservationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (data: { name: string; phone: string; paymentAmount: number; numbers: string[]; status: 'paid' | 'pending' }) => Promise<boolean>;
}

// Phone mask: (xx) xxxxx-xxxx
function formatPhone(value: string): string {
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
    const [paymentAmount, setPaymentAmount] = useState('');
    const [numbersInput, setNumbersInput] = useState('');
    const [reservationStatus, setReservationStatus] = useState<'paid' | 'pending'>('paid');
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
        const amount = parseFloat(paymentAmount) || 0;
        const success = await onConfirm({
            name, phone,
            paymentAmount: amount,
            numbers: parsedNumbers,
            status: reservationStatus
        });
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
        setPhone('');
        setPaymentAmount('');
        setNumbersInput('');
        setReservationStatus('paid');
        setErrorMsg('');
        setStep('form');
        setParsedNumbers([]);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            {/* max-h + overflow-y-auto prevents the modal from going off-screen on desktop */}
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh]">

                {/* Header — fixed inside modal */}
                <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 to-purple-50 rounded-t-3xl flex-shrink-0">
                    <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
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

                {/* Scrollable body */}
                <div className="overflow-y-auto flex-1">

                    {/* ── STEP: FORM ── */}
                    {step === 'form' && (
                        <form onSubmit={handleNext} className="p-5 space-y-4">

                            {/* Status Selector */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Status da Reserva</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setReservationStatus('paid')}
                                        className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-sm border-2 transition-all ${reservationStatus === 'paid'
                                            ? 'bg-green-500 border-green-500 text-white shadow-md shadow-green-200'
                                            : 'bg-white border-slate-200 text-slate-600 hover:border-green-300'
                                            }`}
                                    >
                                        <span>✅</span> Pago
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setReservationStatus('pending')}
                                        className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-sm border-2 transition-all ${reservationStatus === 'pending'
                                            ? 'bg-yellow-400 border-yellow-400 text-white shadow-md shadow-yellow-200'
                                            : 'bg-white border-slate-200 text-slate-600 hover:border-yellow-300'
                                            }`}
                                    >
                                        <span>⏳</span> Pendente
                                    </button>
                                </div>
                                <p className="text-[10px] text-slate-400 mt-1">
                                    {reservationStatus === 'paid'
                                        ? 'Número marcado como PAGO — sem expiração.'
                                        : 'Número marcado como PENDENTE — expira em 24h se não confirmado.'}
                                </p>
                            </div>

                            {/* Error */}
                            {errorMsg && (
                                <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2">
                                    <span className="text-red-500">❌</span>
                                    <p className="text-sm text-red-700 font-semibold">{errorMsg}</p>
                                </div>
                            )}

                            {/* Nome */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome do Comprador *</label>
                                <input
                                    type="text"
                                    required
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full px-4 py-2.5 rounded-xl border-2 border-slate-200 focus:border-purple-600 focus:outline-none font-bold text-slate-900 transition-colors"
                                    placeholder="Ex: João da Silva"
                                />
                            </div>

                            {/* Telefone */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Telefone (WhatsApp) *</label>
                                <input
                                    type="tel"
                                    required
                                    value={phone}
                                    onChange={handlePhoneChange}
                                    className="w-full px-4 py-2.5 rounded-xl border-2 border-slate-200 focus:border-purple-600 focus:outline-none font-bold text-slate-900 tracking-wider transition-colors"
                                    placeholder="(xx) xxxxx-xxxx"
                                    inputMode="numeric"
                                />
                            </div>



                            {/* Valor Pago — só aparece quando status = paid */}
                            {reservationStatus === 'paid' && (
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Valor Recebido (R$)</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">R$</span>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={paymentAmount}
                                            onChange={(e) => setPaymentAmount(e.target.value)}
                                            className="w-full pl-10 pr-4 py-2.5 rounded-xl border-2 border-slate-200 focus:border-green-500 focus:outline-none font-bold text-slate-900 transition-colors"
                                            placeholder="0,00"
                                        />
                                    </div>
                                    <p className="text-[10px] text-slate-400 mt-1">Deixe em 0 se não quiser registrar o valor.</p>
                                </div>
                            )}

                            {/* Números */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Números (separados por vírgula) *</label>
                                <textarea
                                    required
                                    value={numbersInput}
                                    onChange={(e) => setNumbersInput(e.target.value)}
                                    className="w-full px-4 py-2.5 rounded-xl border-2 border-slate-200 focus:border-purple-600 focus:outline-none font-bold text-slate-900 min-h-[80px] transition-colors"
                                    placeholder="Ex: 01, 05, 10, 23"
                                />
                                <p className="text-[10px] text-slate-400 mt-1 text-right">* Separe por vírgula ou espaço</p>
                            </div>

                            <div className="flex gap-3 pt-1">
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
                                    Revisar
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                </button>
                            </div>
                        </form>
                    )}

                    {/* ── STEP: CONFIRM ── */}
                    {step === 'confirm' && (
                        <div className="p-5 space-y-4">
                            <p className="text-sm text-slate-500 font-medium">Confira os dados antes de salvar:</p>

                            <div className="bg-slate-50 rounded-2xl p-4 space-y-3 border border-slate-200">
                                {/* Nome */}
                                <div className="flex items-center gap-3">
                                    <span className="text-xl">👤</span>
                                    <div>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase">Nome</p>
                                        <p className="text-slate-900 font-black">{name}</p>
                                    </div>
                                </div>
                                {/* Telefone */}
                                <div className="flex items-center gap-3">
                                    <span className="text-xl">📱</span>
                                    <div>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase">Telefone</p>
                                        <p className="text-slate-900 font-black">{phone}</p>
                                    </div>
                                </div>
                                {/* Email removido */}
                                {/* Status */}
                                <div className="flex items-center gap-3">
                                    <span className="text-xl">{reservationStatus === 'paid' ? '✅' : '⏳'}</span>
                                    <div>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase">Status</p>
                                        <p className={`font-black ${reservationStatus === 'paid' ? 'text-green-600' : 'text-yellow-600'}`}>
                                            {reservationStatus === 'paid' ? 'PAGO' : 'PENDENTE'}
                                        </p>
                                    </div>
                                </div>
                                {/* Valor */}
                                {reservationStatus === 'paid' && parseFloat(paymentAmount) > 0 && (
                                    <div className="flex items-center gap-3">
                                        <span className="text-xl">💰</span>
                                        <div>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase">Valor Recebido</p>
                                            <p className="text-green-700 font-black">
                                                R$ {parseFloat(paymentAmount).toFixed(2).replace('.', ',')}
                                            </p>
                                        </div>
                                    </div>
                                )}
                                {/* Números */}
                                <div className="flex items-start gap-3">
                                    <span className="text-xl mt-0.5">🎟️</span>
                                    <div>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase">Números ({parsedNumbers.length})</p>
                                        <div className="flex flex-wrap gap-1.5 mt-1">
                                            {parsedNumbers.map(n => (
                                                <span key={n} className="bg-purple-100 text-purple-800 font-black text-xs px-2 py-1 rounded-lg">
                                                    {n}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                                <p className="text-xs text-amber-800 font-semibold text-center">
                                    ⚠️ Esta ação irá reservar os números acima como <strong>{reservationStatus === 'paid' ? 'PAGOS' : 'PENDENTES'}</strong>.
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
                                        <><span>✅</span> Confirmar e Salvar</>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ── STEP: SUCCESS ── */}
                    {step === 'success' && (
                        <div className="p-8 flex flex-col items-center text-center gap-4">
                            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center text-3xl">
                                🎉
                            </div>
                            <div>
                                <h4 className="text-xl font-black text-slate-900">Reserva Criada!</h4>
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

                </div>{/* end scrollable body */}
            </div>
        </div>
    );
};

export default ManualReservationModal;
