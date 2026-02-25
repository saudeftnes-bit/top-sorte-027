import React, { useRef, useState } from 'react';
import html2canvas from 'html2canvas';

interface PaymentReceiptProps {
    buyerName: string;
    buyerPhone: string;
    numbers: string[];
    totalPrice: number;
    txid?: string;
    raffleCode?: string;
    raffleName?: string;
    paymentDate?: Date;
}

const PaymentReceipt: React.FC<PaymentReceiptProps> = ({
    buyerName,
    buyerPhone,
    numbers,
    totalPrice,
    txid,
    raffleCode,
    raffleName,
    paymentDate,
}) => {
    const receiptRef = useRef<HTMLDivElement>(null);
    const [isGenerating, setIsGenerating] = useState(false);

    const date = paymentDate || new Date();
    const formattedDate = date.toLocaleDateString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
    });
    const formattedTime = date.toLocaleTimeString('pt-BR', {
        hour: '2-digit', minute: '2-digit', second: '2-digit',
    });

    // Protocolo legível: últimos 8 chars do txid ou timestamp
    const protocol = txid
        ? txid.replace(/-/g, '').slice(-8).toUpperCase()
        : Date.now().toString().slice(-8);

    const pricePerNumber = numbers.length > 0 ? totalPrice / numbers.length : 0;

    const handleDownload = async () => {
        if (!receiptRef.current || isGenerating) return;
        setIsGenerating(true);

        try {
            await new Promise(r => setTimeout(r, 100));
            const canvas = await html2canvas(receiptRef.current, {
                scale: 3,
                useCORS: true,
                backgroundColor: '#ffffff',
                logging: false,
            });

            const link = document.createElement('a');
            link.download = `comprovante-topsorte-${protocol}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        } catch (err) {
            console.error('Erro ao gerar comprovante:', err);
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <>
            {/* Download button */}
            <button
                onClick={handleDownload}
                disabled={isGenerating}
                className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black py-4 rounded-2xl shadow-lg transition-all active:scale-95 text-sm uppercase tracking-wider"
            >
                {isGenerating ? (
                    <>⌛ Gerando comprovante...</>
                ) : (
                    <><span>📄</span> Baixar Comprovante de Pagamento</>
                )}
            </button>

            {/* Hidden receipt template — rendered off-screen for html2canvas */}
            <div
                style={{
                    position: 'fixed',
                    top: '-9999px',
                    left: '-9999px',
                    zIndex: -1,
                    width: '420px',
                }}
            >
                <div
                    ref={receiptRef}
                    style={{
                        width: '420px',
                        backgroundColor: '#ffffff',
                        color: '#1a1a1a',
                        fontFamily: "'Courier New', Courier, monospace",
                        padding: '40px 32px',
                        boxSizing: 'border-box',
                    }}
                >
                    {/* Header */}
                    <div style={{ textAlign: 'center', marginBottom: '24px', borderBottom: '3px solid #001D3D', paddingBottom: '20px' }}>
                        <div style={{
                            display: 'inline-block',
                            backgroundColor: '#001D3D',
                            color: '#FFD60A',
                            fontWeight: '900',
                            fontSize: '22px',
                            letterSpacing: '0.15em',
                            padding: '10px 28px',
                            borderRadius: '8px',
                            marginBottom: '12px',
                            textTransform: 'uppercase',
                        }}>
                            TOPSORTE_027
                        </div>
                        <p style={{ fontSize: '11px', color: '#666', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                            Comprovante de Participação
                        </p>
                        <p style={{ fontSize: '10px', color: '#999', margin: 0 }}>
                            Este documento comprova a reserva dos números abaixo
                        </p>
                    </div>

                    {/* Dashed separator */}
                    <div style={{ borderTop: '2px dashed #ddd', margin: '0 0 20px' }} />

                    {/* Raffle Info */}
                    <div style={{ marginBottom: '20px' }}>
                        <Row label="Concurso" value={raffleName || 'Top Sorte'} />
                        <Row label="Código" value={raffleCode ? `#${raffleCode}` : '---'} />
                        <Row label="Data" value={formattedDate} />
                        <Row label="Hora" value={formattedTime} />
                    </div>

                    <div style={{ borderTop: '2px dashed #ddd', margin: '0 0 20px' }} />

                    {/* Buyer Info */}
                    <div style={{ marginBottom: '20px' }}>
                        <SectionTitle>Dados do Participante</SectionTitle>
                        <Row label="Nome" value={buyerName} />
                        <Row label="WhatsApp" value={buyerPhone} />
                    </div>

                    <div style={{ borderTop: '2px dashed #ddd', margin: '0 0 20px' }} />

                    {/* Numbers */}
                    <div style={{ marginBottom: '20px' }}>
                        <SectionTitle>Números Reservados ({numbers.length})</SectionTitle>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px' }}>
                            {numbers.map(n => (
                                <span key={n} style={{
                                    display: 'inline-block',
                                    backgroundColor: '#001D3D',
                                    color: '#FFD60A',
                                    fontWeight: '900',
                                    fontSize: '15px',
                                    padding: '5px 10px',
                                    borderRadius: '6px',
                                    letterSpacing: '0.05em',
                                    fontFamily: "'Courier New', monospace",
                                }}>
                                    {n}
                                </span>
                            ))}
                        </div>
                    </div>

                    <div style={{ borderTop: '2px dashed #ddd', margin: '0 0 20px' }} />

                    {/* Pricing */}
                    <div style={{ marginBottom: '20px' }}>
                        <SectionTitle>Valores</SectionTitle>
                        <Row label={`${numbers.length} número(s) × R$ ${pricePerNumber.toFixed(2)}`} value="" />
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', backgroundColor: '#001D3D', borderRadius: '8px', padding: '10px 14px' }}>
                            <span style={{ color: '#FFD60A', fontWeight: '900', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>TOTAL PAGO</span>
                            <span style={{ color: '#FFD60A', fontWeight: '900', fontSize: '20px' }}>
                                R$ {totalPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                        </div>
                    </div>

                    <div style={{ borderTop: '2px dashed #ddd', margin: '0 0 20px' }} />

                    {/* Protocol */}
                    <div style={{ marginBottom: '20px' }}>
                        <SectionTitle>Protocolo</SectionTitle>
                        <Row label="Nº Protocolo" value={protocol} />
                        {txid && <Row label="Trans. PIX" value={txid.slice(0, 20) + '...'} />}
                        <Row label="Método" value="PIX" />
                        <Row label="Status" value="✅ CONFIRMADO" />
                    </div>

                    <div style={{ borderTop: '2px dashed #ddd', margin: '0 0 20px' }} />

                    {/* Footer */}
                    <div style={{ textAlign: 'center', marginTop: '8px' }}>
                        <p style={{ fontSize: '10px', color: '#999', marginBottom: '6px' }}>
                            Guarde este comprovante. Em caso de dúvidas,
                        </p>
                        <p style={{ fontSize: '10px', color: '#999', marginBottom: '12px' }}>
                            entre em contato via Instagram @topsorte_027
                        </p>
                        <div style={{
                            display: 'inline-block',
                            border: '2px solid #001D3D',
                            borderRadius: '6px',
                            padding: '4px 14px',
                            fontSize: '11px',
                            fontWeight: '900',
                            color: '#001D3D',
                            letterSpacing: '0.05em',
                            textTransform: 'uppercase',
                        }}>
                            Boa Sorte! 🍀
                        </div>
                        <p style={{ fontSize: '9px', color: '#ccc', marginTop: '16px' }}>
                            {formattedDate} {formattedTime} · Prot. {protocol}
                        </p>
                    </div>
                </div>
            </div>
        </>
    );
};

// ─── helpers ────────────────────────────────────────────────────────────────

const Row: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '5px', gap: '8px' }}>
        <span style={{ color: '#666', whiteSpace: 'nowrap' }}>{label}</span>
        <span style={{ fontWeight: '700', textAlign: 'right', wordBreak: 'break-all' }}>{value}</span>
    </div>
);

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <p style={{
        fontSize: '10px',
        fontWeight: '900',
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        color: '#001D3D',
        marginBottom: '8px',
    }}>
        {children}
    </p>
);

export default PaymentReceipt;
