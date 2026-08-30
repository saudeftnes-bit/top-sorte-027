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
        const { raffleId, numbers: rawNumbers, buyer, totalPrice, paymentTimeout, sessionId } = req.body;

        // Deduplicar e validar números obrigatoriamente
        const numbers = Array.from(new Set((rawNumbers || []).map((n: any) => String(n).trim()))).filter((n): n is string => Boolean(n));

        const price = parseFloat(totalPrice);
        if (!raffleId || numbers.length === 0 || !buyer || !buyer.name || isNaN(price) || price <= 0) {
            console.error('❌ [API Efi Charge] Dados inválidos ou lista de números vazia:', { raffleId, numbers, price });
            return res.status(400).json({ error: 'Dados inválidos ou nenhum número válido selecionado.' });
        }

        console.log('💳 [API Efi Charge] Iniciando fluxo de cobrança PIX:', { raffleId, numbers, count: numbers.length, price, paymentTimeout, sessionId });

        // ════════════════════════════════════════════════════════════════════════
        // PASSO 1: Inicializar Supabase ANTES de tudo
        // ════════════════════════════════════════════════════════════════════════
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(
            process.env.VITE_SUPABASE_URL || '',
            process.env.VITE_SUPABASE_ANON_KEY || ''
        );

        // ════════════════════════════════════════════════════════════════════════
        // PASSO 2: Bloqueio Atômico e Verificação de Conflitos ANTES do PIX
        // Se houver conflito, retorna 409 SEM criar cobrança na EFI.
        // ════════════════════════════════════════════════════════════════════════
        const nowMs = Date.now();
        const expirationSeconds = (paymentTimeout || 15) * 60;

        // ── TENTATIVA ATÔMICA VIA RPC (Trava no Banco) ─────────────────────────
        try {
            const { data: lockResult, error: lockErr } = await supabase.rpc('lock_numbers_for_pix', {
                p_raffle_id: raffleId,
                p_numbers: numbers,
                p_buyer_name: buyer.name,
                p_buyer_phone: buyer.phone || '',
                p_buyer_email: buyer.email || '',
                p_session_id: sessionId || '',
                p_timeout_seconds: expirationSeconds
            });

            if (!lockErr && lockResult) {
                if (lockResult.success === false) {
                    console.error(`❌ [API Efi Charge] RPC Lock rejeitou:`, lockResult);
                    return res.status(409).json({
                        error: lockResult.message || 'Um ou mais números selecionados já estão ocupados.',
                        blockedNumbers: lockResult.numbers || [],
                        code: 'NUMBERS_TAKEN'
                    });
                }
                console.log(`🔒 [API Efi Charge] Trava atômica obtida com sucesso via RPC!`);
            }
        } catch (rpcLockError: any) {
            console.warn('⚠️ [API Efi Charge] RPC lock falhou, usando fallback direto:', rpcLockError?.message);
        }

        // ── CHECK 1: Números já PAGOS → SEMPRE bloquear ──────────────────────
        const { data: paidNumbers, error: paidError } = await supabase
            .from('reservations')
            .select('number, buyer_name')
            .eq('raffle_id', raffleId)
            .in('number', numbers)
            .eq('status', 'paid');

        if (!paidError && paidNumbers && paidNumbers.length > 0) {
            const list = paidNumbers.map((r: any) => r.number).join(', ');
            console.error(`❌ [API Efi Charge] Números já PAGOS: ${list}`);
            return res.status(409).json({
                error: `Os números ${list} já foram comprados. Por favor, selecione outros números.`,
                blockedNumbers: paidNumbers.map((r: any) => r.number),
                code: 'NUMBERS_TAKEN'
            });
        }

        // ── CHECK 2: Reservas pending de outros compradores → bloquear ───────
        const { data: conflicting, error: conflictError } = await supabase
            .from('reservations')
            .select('number, efi_txid, expires_at, buyer_name, buyer_phone')
            .eq('raffle_id', raffleId)
            .in('number', numbers)
            .neq('status', 'cancelled')
            .neq('status', 'paid');

        if (conflictError) {
            console.warn('⚠️ [API Efi Charge] Erro ao verificar conflitos:', conflictError.message);
        }

        if (conflicting && conflicting.length > 0) {
            const blockedNumbers = conflicting.filter((r: any) => {
                const expiresAtMs = r.expires_at ? new Date(r.expires_at).getTime() : 0;
                const isNotExpired = expiresAtMs > nowMs;
                if (!isNotExpired) return false;

                // Se pertence à mesma pessoa/sessão, permite continuar
                const isSameBuyer = (buyer.phone && r.buyer_phone === buyer.phone) || (sessionId && r.buyer_name === sessionId);
                if (isSameBuyer) return false;

                return true;
            });

            if (blockedNumbers.length > 0) {
                const list = blockedNumbers.map((r: any) => r.number).join(', ');
                console.error(`❌ [API Efi Charge] Conflito: número(s) ${list} com reserva ativa de outro comprador`);
                return res.status(409).json({
                    error: `Os números ${list} já estão sendo pagos por outro comprador. Por favor, selecione outros números.`,
                    blockedNumbers: blockedNumbers.map((r: any) => r.number),
                    code: 'NUMBERS_TAKEN'
                });
            }
        }

        // ════════════════════════════════════════════════════════════════════════
        // PASSO 3: Criar cobrança PIX na EFI (só chega aqui se NÃO há conflito)
        // ════════════════════════════════════════════════════════════════════════
        const efipay = getEfiClient();
        const txid = generateTxid();

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

        // ════════════════════════════════════════════════════════════════════════
        // PASSO 4: Salvar transação EFI (log de auditoria + dados para recovery)
        // Inclui numbers_json para o webhook poder recuperar pagamentos perdidos.
        // ════════════════════════════════════════════════════════════════════════
        const numbersJsonStr = JSON.stringify(numbers);
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
                    numbers_json: numbersJsonStr, // ← RECOVERY: salva os números
                });
            if (txError) console.warn('⚠️ [API Efi Charge] Erro ao salvar log de transação:', txError.message);

            // Chamada RPC complementar para garantir gravação direta no banco
            try {
                await supabase.rpc('save_transaction_numbers', {
                    p_txid: pixCharge.txid,
                    p_numbers: numbersJsonStr
                });
            } catch (rpcErr: any) {
                console.warn('⚠️ [API Efi Charge] RPC save_transaction_numbers:', rpcErr?.message);
            }
        } catch (e: any) {
            console.error('⚠️ [API Efi Charge] Falha na tabela efi_transactions:', e.message);
        }

        // ════════════════════════════════════════════════════════════════════════
        // PASSO 5: Oficializar reservas via UPSERT
        // ════════════════════════════════════════════════════════════════════════
        let reservationIds: string[] = [];

        try {
            console.log(`🚀 [API Efi Charge] Oficializando reservas: ${numbers.join(', ')}`);

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

            const { data: inserted, error: insertError } = await supabase
                .from('reservations')
                .upsert(reservationsData, {
                    onConflict: 'raffle_id,number',
                    ignoreDuplicates: false
                })
                .select();

            if (insertError) {
                console.error('❌ [API Efi Charge] Erro fatal no UPSERT:', insertError);
                throw new Error(`Erro no Banco de Dados: ${insertError.message} (Código: ${insertError.code})`);
            }

            reservationIds = inserted?.map(r => r.id) || [];
            console.log('✅ [API Efi Charge] Reservas oficializadas com sucesso!');

        } catch (e: any) {
            if (res.headersSent) return;

            console.error('❌ [API Efi Charge] Erro no fluxo de persistência:', e.message);
            // PIX já foi criado, mas UPSERT falhou. O webhook tem recovery para recriar
            // as reservas quando o pagamento for confirmado. Retornar o QR Code assim mesmo.
            console.warn('⚠️ [API Efi Charge] UPSERT falhou mas PIX já criado — webhook fará recovery se cliente pagar');
        }

        // ════════════════════════════════════════════════════════════════════════
        // PASSO 6: Retornar dados do PIX ao frontend
        // Mesmo que o UPSERT tenha falhado, retornamos o QR Code.
        // O webhook tem lógica de recovery para reconstruir as reservas.
        // ════════════════════════════════════════════════════════════════════════
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
