import React, { useEffect } from 'react';

interface ConfirmModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: () => void;
    onCancel: () => void;
    variant?: 'danger' | 'warning' | 'info';
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
    isOpen,
    title,
    message,
    confirmLabel = 'Confirmar',
    cancelLabel = 'Cancelar',
    onConfirm,
    onCancel,
    variant = 'warning'
}) => {
    // Handle ESC key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onCancel();
            }
        };

        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isOpen, onCancel]);

    // Prevent body scroll when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    if (!isOpen) return null;

    const iconByVariant = {
        danger: '🚨',
        warning: '⚠️',
        info: 'ℹ️'
    };

    const confirmButtonColors = {
        danger: 'bg-red-600 hover:bg-red-700',
        warning: 'bg-orange-600 hover:bg-orange-700',
        info: 'bg-purple-600 hover:bg-purple-700'
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fadeIn"
            onClick={onCancel}
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>

            {/* Modal */}
            <div
                className="relative bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 animate-scaleIn"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Icon */}
                <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="text-4xl">{iconByVariant[variant]}</span>
                    </div>
                    <h2 className="text-2xl font-black text-slate-900 mb-2">{title}</h2>
                    <p className="text-slate-600 font-medium leading-relaxed">{message}</p>
                </div>

                {/* Buttons */}
                <div className="flex gap-3">
                    {cancelLabel && (
                        <button
                            onClick={onCancel}
                            className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl transition-all active:scale-95"
                        >
                            {cancelLabel}
                        </button>
                    )}
                    <button
                        onClick={onConfirm}
                        className={`${cancelLabel ? 'flex-1' : 'w-full'} ${confirmButtonColors[variant]} text-white font-bold py-3 rounded-xl transition-all active:scale-95 shadow-lg`}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>

            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes scaleIn {
                    from { 
                        opacity: 0;
                        transform: scale(0.9);
                    }
                    to { 
                        opacity: 1;
                        transform: scale(1);
                    }
                }
                .animate-fadeIn {
                    animation: fadeIn 0.2s ease-out;
                }
                .animate-scaleIn {
                    animation: scaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
                }
            `}</style>
        </div>
    );
};

export default ConfirmModal;
