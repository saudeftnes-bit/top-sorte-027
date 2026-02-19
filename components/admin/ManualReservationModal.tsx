import React, { useState } from 'react';

interface ManualReservationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (data: { name: string; phone: string; numbers: string[] }) => Promise<boolean>;
}

const ManualReservationModal: React.FC<ManualReservationModalProps> = ({ isOpen, onClose, onConfirm }) => {
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [numbersInput, setNumbersInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Parse numbers
        const numbers = numbersInput
            .split(/[\s,]+/) // Split by comma or whitespace
            .map(n => n.trim())
            .filter(n => n.length > 0)
            .map(n => n.padStart(2, '0')); // Ensure 2 digits if needed (adjust logic if 3 or 4 digits/animals)

        if (numbers.length === 0) {
            alert('Por favor, insira pelo menos um número.');
            return;
        }

        setIsLoading(true);
        const success = await onConfirm({ name, phone, numbers });
        setIsLoading(false);

        if (success) {
            // Reset form
            setName('');
            setPhone('');
            setNumbersInput('');
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                    <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                        <span>📝</span> Nova Reserva Manual
                    </h3>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-4">
                        <p className="text-xs text-yellow-800 font-medium">
                            ⚠️ Atenção: Reservas manuais são criadas automaticamente como <span className="font-bold">PAGAS</span> e os números ficarão indisponíveis para outros usuários.
                        </p>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome do Comprador</label>
                        <input
                            type="text"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-purple-600 focus:outline-none font-bold text-slate-900"
                            placeholder="Ex: João da Silva"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Telefone (WhatsApp)</label>
                        <input
                            type="tel"
                            required
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-purple-600 focus:outline-none font-bold text-slate-900"
                            placeholder="Ex: 27999998888"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Números (separados por vírgula)</label>
                        <textarea
                            required
                            value={numbersInput}
                            onChange={(e) => setNumbersInput(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-purple-600 focus:outline-none font-bold text-slate-900 min-h-[100px]"
                            placeholder="Ex: 01, 05, 10, 23"
                        />
                        <p className="text-[10px] text-slate-400 mt-1 font-medium text-right">
                            * Separe os números por vírgula ou espaço
                        </p>
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isLoading}
                            className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-3 rounded-xl transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-purple-200 transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isLoading ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    Salvando...
                                </>
                            ) : (
                                <>
                                    <span>💾</span> Confirmar Reserva
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ManualReservationModal;
