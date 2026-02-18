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

        const body = {
            calendario: {
                expiracao: expirationSeconds,
            },
            devedor: {
                nome: buyer.name,
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

        // Criar cobrança PIX
        const chargeResponse = await efipay.pixCreateImmediateCharge(txid, body);

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

        // Criar registro de transação no Supabase
        const { data: transaction, error: transactionError } = await supabase
            .from('efi_transactions')
            .insert({
                txid: pixCharge.txid,
                raffle_id: raffleId,
                amount: totalPrice,
                status: pixCharge.status,
                pix_copia_cola: pixCharge.pixCopiaCola,
                qr_code_url: pixCharge.qrCodeImage,
                buyer_name: buyer.name,
                buyer_email: buyer.email,
                buyer_phone: buyer.phone,
            })
            .select()
            .single();

        if (transactionError) {
            console.error('❌ [API Efi Charge] Erro ao criar transação:', transactionError);
            throw new Error('Erro ao salvar transação');
        }

        // Criar reservas com status 'pending' e vincular ao txid
        const reservationsData = numbers.map((number: string) => ({
            raffle_id: raffleId,
            number,
            buyer_name: buyer.name,
            buyer_phone: buyer.phone,
            buyer_email: buyer.email,
            status: 'pending',
            payment_amount: totalPrice / numbers.length,
            payment_method: 'efi',
            efi_txid: pixCharge.txid,
            efi_status: pixCharge.status,
            efi_pix_copia_cola: pixCharge.pixCopiaCola,
            efi_qr_code_url: pixCharge.qrCodeImage,
            expires_at: pixCharge.expiresAt,
        }));

        const { data: reservations, error: reservationsError } = await supabase
            .from('reservations')
            .insert(reservationsData)
            .select();

        if (reservationsError) {
            console.error('❌ [API Efi Charge] Erro ao criar reservas:', reservationsError);
            throw new Error('Erro ao criar reservas');
        }

        // Atualizar transaction com IDs das reservas
        const reservationIds = reservations?.map(r => r.id) || [];
        await supabase
            .from('efi_transactions')
            .update({ reservation_ids: reservationIds })
            .eq('id', transaction.id);

        console.log('✅ [API Efi Charge] Reservas criadas:', reservationIds);

        // Retornar dados do PIX
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
        });
    }
}
