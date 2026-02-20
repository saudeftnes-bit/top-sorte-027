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
        const { raffleId, numbers, buyer, totalPrice, paymentTimeout, sessionId } = req.body;

        // Validação
        const price = parseFloat(totalPrice);
        if (!raffleId || !numbers || !buyer || isNaN(price) || price <= 0) {
            console.error('❌ [API Efi Charge] Dados inválidos ou preço zerado:', { raffleId, numbers, price });
            return res.status(400).json({ error: 'Dados inválidos ou preço zerado. Verifique as configurações do sorteio.' });
        }

        console.log('💳 [API Efi Charge] Criando cobrança PIX:', { raffleId, numbers, totalPrice, paymentTimeout, sessionId });

        // Criar cobrança PIX na Efi
        const efipay = getEfiClient();
        const txid = generateTxid();
        const expirationSeconds = (paymentTimeout || 15) * 60; // Dinâmico (minutos para segundos)

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

        // Importar Supabase
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(
            process.env.VITE_SUPABASE_URL || '',
            process.env.VITE_SUPABASE_ANON_KEY || ''
        );

        let reservationIds: string[] = [];

        // 3. Salvar transação EFI (Log de auditoria)
        try {
            const { error: txError } = await supabase
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
            if (txError) console.warn('⚠️ [API Efi Charge] Erro ao salvar log de transação:', txError.message);
        } catch (e: any) {
            console.error('⚠️ [API Efi Charge] Falha na tabela efi_transactions:', e.message);
        }

        // 4. Oficializar reservas (CRÍTICO - Usando UPSERT para atomicidade)
        try {
            console.log(`🚀 [API Efi Charge] Oficializando reservas via UPSERT para: ${numbers.join(', ')}`);

            const reservationsData = numbers.map((number: string) => ({
                raffle_id: raffleId,
                number,
                buyer_name: buyer.name,
                buyer_phone: buyer.phone || '',
                buyer_email: buyer.email || '',
                status: 'pending',
                payment_amount: price / numbers.length,
                payment_method: 'efi',
                efi_txid: pixCharge.txid,
                expires_at: pixCharge.expiresAt,
                updated_at: new Date().toISOString()
            }));

            // Usamos UPSERT baseado na restrição UNIQUE(raffle_id, number)
            // Isso substitui a reserva temporária (AMARELA) pela oficial (PENDENTE PIX)
            // sem precisar de permissão de DELETE e de forma atômica.
            const { data: inserted, error: insertError } = await supabase
                .from('reservations')
                .upsert(reservationsData, {
                    onConflict: 'raffle_id,number',
                    ignoreDuplicates: false // Queremos que ele SOBRESCREVA a temporária
                })
                .select();

            if (insertError) {
                console.error('❌ [API Efi Charge] Erro fatal no UPSERT:', insertError);

                // Se o erro for que o número já está PAGO, o banco pode barrar se houver um trigger ou check.
                // Mas aqui o upsert deve funcionar se a política permitir update.
                throw new Error(`Erro no Banco de Dados: ${insertError.message} (Código: ${insertError.code})`);
            }

            reservationIds = inserted?.map(r => r.id) || [];
            console.log('✅ [API Efi Charge] Reservas oficializadas com sucesso!');

        } catch (e: any) {
            console.error('❌ [API Efi Charge] Erro no fluxo de persistência:', e.message);
            return res.status(500).json({
                error: 'Erro de persistência no banco de dados',
                message: e.message || 'Houve um problema ao salvar sua reserva.',
                details: e.toString()
            });
        }

        // Retornar dados do PIX (Só chega aqui se as reservas foram salvas!)
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
