import EfiPay from 'sdk-node-apis-efi';

type VercelRequest = any;
type VercelResponse = any;

// Configuração do cliente Efi
const getEfiClient = () => {
    const options = {
        sandbox: process.env.EFI_SANDBOX === 'true',
        client_id: process.env.EFI_CLIENT_ID || '',
        client_secret: process.env.EFI_CLIENT_SECRET || '',
        certificate: (process.env.EFI_CERTIFICATE_BASE64 || '').trim(),
        cert_base64: true,
        validateMtls: false,
    };
    return new EfiPay(options);
};

// Gera txid único
function generateTxid(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 15);
    return `TS${timestamp}${random}`.substring(0, 35).toUpperCase();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { raffleId, numbers, buyer, totalPrice } = req.body;

        // Validação
        if (!raffleId || !numbers || !buyer || !totalPrice) {
            return res.status(400).json({ error: 'Dados incompletos' });
        }

        console.log('💳 [API Efi Charge] Criando cobrança PIX:', { raffleId, numbers, totalPrice });

        // Criar cobrança PIX na Efi
        const efipay = getEfiClient();
        const txid = generateTxid();
        const expirationSeconds = 1800; // 30 minutos

        const body: any = {
            calendario: {
                expiracao: expirationSeconds,
            },
            valor: {
                original: totalPrice.toFixed(2),
            },
            chave: process.env.EFI_PIX_KEY,
            solicitacaoPagador: 'Pagamento Top Sorte - Rifas',
            infoAdicionais: [
                {
                    nome: 'Cliente',
                    valor: buyer.name,
                },
            ],
        };

        // Adicionar devedor apenas se CPF ou CNPJ estiver disponível
        // Em produção, a EFI exige cpf ou cnpj no devedor
        if (buyer.cpf) {
            body.devedor = {
                cpf: buyer.cpf.replace(/\D/g, ''),
                nome: buyer.name,
            };
        } else if (buyer.cnpj) {
            body.devedor = {
                cnpj: buyer.cnpj.replace(/\D/g, ''),
                nome: buyer.name,
            };
        }

        // Criar cobrança PIX
        const chargeResponse = await efipay.pixCreateImmediateCharge({ txid }, body);

        // Gerar QR Code
        const qrCodeResponse = await efipay.pixGenerateQRCode({
            id: chargeResponse.loc.id,
        });

        // Calcular data de expiração
        const expiresAt = new Date();
        expiresAt.setSeconds(expiresAt.getSeconds() + expirationSeconds);

        const pixCharge = {
            txid: chargeResponse.txid,
            status: chargeResponse.status,
            pixCopiaCola: qrCodeResponse.qrcode,
            qrCodeImage: qrCodeResponse.imagemQrcode,
            expiresAt: expiresAt.toISOString(),
        };

        console.log('✅ [API Efi Charge] Cobrança criada:', pixCharge.txid);

        // Importar Supabase - inline para evitar problemas de módulo
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(
            process.env.VITE_SUPABASE_URL || '',
            process.env.VITE_SUPABASE_ANON_KEY || ''
        );

        let reservationIds: string[] = [];

        // 3. Tentar salvar transação EFI (não bloqueia se falhar)
        try {
            await supabase
                .from('efi_transactions')
                .insert({
                    txid: pixCharge.txid,
                    raffle_id: raffleId,
                    amount: totalPrice,
                    status: pixCharge.status,
                    pix_copia_cola: pixCharge.pixCopiaCola,
                    qr_code_url: pixCharge.qrCodeImage,
                    buyer_name: buyer.name,
                    buyer_email: buyer.email || '',
                    buyer_phone: buyer.phone || '',
                });
        } catch (e: any) {
            console.error('⚠️ [API Efi Charge] Erro ao salvar transação (não crítico):', e);
        }

        // 4. Limpar reservas temporárias existentes para estes números antes de criar as definitivas
        // Isso evita o erro de duplicidade UNIQUE(raffle_id, number)
        try {
            console.log('🧹 [API Efi Charge] Limpando reservas temporárias para números:', numbers);
            const { error: deleteError } = await supabase
                .from('reservations')
                .delete()
                .eq('raffle_id', raffleId)
                .in('number', numbers)
                .eq('status', 'pending');

            if (deleteError) {
                console.warn('⚠️ [API Efi Charge] Aviso ao deletar reservas temporárias:', deleteError);
            }
        } catch (e: any) {
            console.error('⚠️ [API Efi Charge] Exceção ao deletar temporárias:', e);
        }

        // 5. Criar reservas com colunas básicas apenas
        try {
            const reservationsData = numbers.map((number: string) => ({
                raffle_id: raffleId,
                number,
                buyer_name: buyer.name,
                buyer_phone: buyer.phone || '',
                buyer_email: buyer.email || '',
                status: 'pending',
                payment_amount: totalPrice / numbers.length,
                payment_method: 'efi',
                efi_txid: pixCharge.txid,
            }));

            const { data: reservations, error: reservationsError } = await supabase
                .from('reservations')
                .insert(reservationsData)
                .select();

            if (reservationsError) {
                console.error('⚠️ [API Efi Charge] Erro ao criar reservas (tentando sem colunas EFI):', reservationsError);

                // Fallback: tentar sem colunas EFI
                const basicReservations = numbers.map((number: string) => ({
                    raffle_id: raffleId,
                    number,
                    buyer_name: buyer.name,
                    buyer_phone: buyer.phone || '',
                    buyer_email: buyer.email || '',
                    status: 'pending',
                    payment_amount: totalPrice / numbers.length,
                }));

                const { data: fallbackReservations, error: fallbackError } = await supabase
                    .from('reservations')
                    .insert(basicReservations)
                    .select();

                if (fallbackError) {
                    console.error('❌ [API Efi Charge] Erro no fallback de reservas:', fallbackError);
                } else {
                    reservationIds = fallbackReservations?.map(r => r.id) || [];
                }
            } else {
                reservationIds = reservations?.map(r => r.id) || [];
            }
        } catch (e: any) {
            console.error('❌ [API Efi Charge] Erro geral em reservas:', e);
        }

        console.log('✅ [API Efi Charge] Reservas criadas:', reservationIds);

        // Retornar dados do PIX (SEMPRE retorna, mesmo se reservas falharem)
        return res.status(200).json({
            success: true,
            txid: pixCharge.txid,
            qrCode: pixCharge.qrCodeImage,
            pixCopiaCola: pixCharge.pixCopiaCola,
            expiresAt: pixCharge.expiresAt,
            reservationIds,
        });
    } catch (error: any) {
        console.error('❌ [API Efi Charge] Erro:', error);
        return res.status(500).json({
            error: error.message || 'Erro ao processar pagamento',
            details: error.response?.data || error.mensagem || null,
            fullError: typeof error === 'object' ? JSON.stringify(error).substring(0, 500) : String(error),
        });
    }
}
