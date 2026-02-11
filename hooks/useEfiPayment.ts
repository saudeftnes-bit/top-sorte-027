import { useState, useEffect, useRef } from 'react';

interface EfiPaymentStatus {
    txid: string;
    status: string;
    isPaid: boolean;
    isExpired: boolean;
    value: number;
}

interface UseEfiPaymentResult {
    status: EfiPaymentStatus | null;
    isLoading: boolean;
    error: string | null;
    stopPolling: () => void;
}

/**
 * Hook para monitorar status de pagamento Efi via polling
 */
export function useEfiPayment(txid: string | null, enabled: boolean = true): UseEfiPaymentResult {
    const [status, setStatus] = useState<EfiPaymentStatus | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const [pollingEnabled, setPollingEnabled] = useState(enabled);

    useEffect(() => {
        if (!txid || !pollingEnabled) {
            return;
        }

        const checkStatus = async () => {
            try {
                setIsLoading(true);
                setError(null);

                const response = await fetch(`/api/efi-status?txid=${encodeURIComponent(txid)}`);

                if (!response.ok) {
                    throw new Error('Erro ao consultar status');
                }

                const data = await response.json();

                const isPaid = data.status === 'CONCLUIDA';
                const isExpired = data.status === 'REMOVIDA_PELO_USUARIO_RECEBEDOR' ||
                    data.status === 'REMOVIDA_PELO_PSP';

                setStatus({
                    txid: data.txid,
                    status: data.status,
                    isPaid,
                    isExpired,
                    value: data.value,
                });

                // Parar polling se pago ou expirado
                if (isPaid || isExpired) {
                    console.log(`✅ [useEfiPayment] Status final: ${data.status}. Parando polling.`);
                    stopPolling();
                }

                setIsLoading(false);
            } catch (err: any) {
                console.error('❌ [useEfiPayment] Erro:', err);
                setError(err.message);
                setIsLoading(false);
            }
        };

        // Verificar imediatamente
        checkStatus();

        // Polling a cada 3 segundos
        intervalRef.current = setInterval(checkStatus, 3000);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [txid, pollingEnabled]);

    const stopPolling = () => {
        setPollingEnabled(false);
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
    };

    return {
        status,
        isLoading,
        error,
        stopPolling,
    };
}
