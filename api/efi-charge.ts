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
        const { raffleId, numbers, buyer, totalPrice, paymentTimeout } = req.body;

        // Validação
        const price = parseFloat(totalPrice);
        if (!raffleId || !numbers || !buyer || isNaN(price) || price <= 0) {
            console.error('❌ [API Efi Charge] Dados inválidos ou preço zerado:', { raffleId, numbers, price });
            return res.status(400).json({ error: 'Dados inválidos ou preço zerado. Verifique as configurações do sorteio.' });
        }

        console.log('💳 [API Efi Charge] Criando cobrança PIX:', { raffleId, numbers, totalPrice, paymentTimeout });

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

        // 3. Tentar salvar transação EFI
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
            // We continue because even if transaction log fails, the reservation is more important
        }

        // 4. Limpar e Criar reservas (CRÍTICO)
        // Substituímos as temporárias por oficiais. NÃO usamos delete cego para evitar race conditions.
        try {
            console.log('🧹 [API Efi Charge] Oficializando reservas para:', numbers);

            // 1. Limpar apenas o que era deste mesmo comprador (pelo telefone ou nome da sessão original se disponível)
            // Isso evita que a gente delete por engano a reserva de outra pessoa que ganhou no milissegundo.
            const { error: cleanupError } = await supabase
                .from('reservations')
                .delete()
                .eq('raffle_id', raffleId)
                .in('number', numbers)
                .eq('buyer_name', buyer.name); // Garante que só deleta o que ele acha que é dele

            if (cleanupError) {
                console.warn('⚠️ [API Efi Charge] Aviso ao limpar temporárias (não crítico):', cleanupError);
            }

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
            }));

            // 2. Inserir reservas finais. O UNIQUE(raffle_id, number) vai barrar se alguém "roubou" o número nesse meio tempo.
            const { data: inserted, error: insertError } = await supabase
                .from('reservations')
                .insert(reservationsData)
                .select();

            if (insertError) {
                console.error('❌ [API Efi Charge] Erro fatal ao inserir reservas oficiais:', insertError);
                // Se der erro de duplicidade (P23505), é porque alguém pegou os números.
                throw new Error('Um dos números escolhidos não está mais disponível. Por favor, escolha outros números.');
            }

            reservationIds = inserted?.map(r => r.id) || [];
            console.log('✅ [API Efi Charge] Reservas finais criadas com sucesso:', reservationIds);

        } catch (e: any) {
            console.error('❌ [API Efi Charge] Erro crítico no fluxo de persistência:', e);
            return res.status(500).json({
                error: 'Erro de persistência no banco de dados',
                message: e.message || 'Não foi possível garantir sua reserva. Tente novamente.'
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
