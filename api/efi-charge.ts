import { createClient } from '@supabase/supabase-js';
import EfiPay from 'sdk-node-apis-efi';

const getSupabaseServerClient = () => {
    const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
    return createClient(url, key);
};

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
        // PASSO 1: Inicializar Supabase e validar preço real da rifa no servidor
        // ════════════════════════════════════════════════════════════════════════
        const supabase = getSupabaseServerClient();

        const { data: raffle, error: raffleErr } = await supabase
            .from('raffles')
            .select('*')
            .eq('id', raffleId)
            .single();

        if (raffleErr) {
            console.error('❌ [API Efi Charge] Erro ao buscar rifa:', raffleErr);
        }

        if (!raffle) {
            return res.status(404).json({ error: 'Rifa não encontrada.' });
        }

        if (raffle.status !== 'active') {
            return res.status(400).json({ error: 'Esta rifa não está ativa para compras no momento.' });
        }

        if (raffle.raffle_type === 'brinde') {
            return res.status(400).json({ error: 'Rifas do tipo brinde não aceitam cobrança PIX.' });
        }

        const expectedTotal = Number((Number(raffle.price_per_number) * numbers.length).toFixed(2));
        if (isNaN(expectedTotal) || expectedTotal <= 0 || Math.abs(price - expectedTotal) > 0.01) {
            console.error('🚨 [API Efi Charge] Valor divergente detectado:', {
                sentPrice: price,
                expectedTotal,
                numbersCount: numbers.length,
                unitPrice: raffle.price_per_number
            });
            return res.status(400).json({
                error: 'O valor da cobrança não confere com o preço oficial das cotas.'
            });
        }

        const expirationSeconds = (paymentTimeout || 15) * 60;

        // ════════════════════════════════════════════════════════════════════════
        // PASSO 2: BLOQUEIO ATÔMICO via RPC lock_numbers_for_pix()
        //
        // CORREÇÃO DEFINITIVA (20/09/2026):
        // Esta RPC usa SELECT FOR UPDATE no banco — sem race condition possível.
        // Se falhar (função não existe ou erro), retorna 409 imediatamente.
        // NÃO HÁ FALLBACK — fallback era o que causava o bug.
        // ════════════════════════════════════════════════════════════════════════
        const { data: lockResult, error: lockErr } = await supabase.rpc('lock_numbers_for_pix', {
            p_raffle_id: raffleId,
            p_numbers: numbers,
            p_buyer_name: buyer.name,
            p_buyer_phone: buyer.phone || '',
            p_buyer_email: buyer.email || '',
            p_session_id: sessionId || '',
            p_timeout_seconds: expirationSeconds
        });

        if (lockErr) {
            console.error('❌ [API Efi Charge] RPC lock_numbers_for_pix falhou com erro:', lockErr);
            return res.status(409).json({
                error: 'Não foi possível reservar os números selecionados. Por favor, tente novamente.',
                code: 'LOCK_FAILED'
            });
        }

        if (!lockResult || lockResult.success === false) {
            const blocked = lockResult?.numbers || [];
            const list = blocked.join(', ');
            console.error(`❌ [API Efi Charge] Lock rejeitado — números bloqueados: ${list}`, lockResult);
            return res.status(409).json({
                error: blocked.length > 0
                    ? `Os números ${list} já estão ocupados por outro comprador. Por favor, selecione outros números.`
                    : 'Um ou mais números selecionados não estão mais disponíveis.',
                blockedNumbers: blocked,
                code: 'NUMBERS_TAKEN'
            });
        }

        console.log(`🔒 [API Efi Charge] Lock atômico obtido! Criando PIX para ${numbers.join(', ')}`);

        // ════════════════════════════════════════════════════════════════════════
        // PASSO 3: Criar cobrança PIX na EFI
        // (só chegamos aqui se o lock foi obtido com sucesso)
        // ════════════════════════════════════════════════════════════════════════
        const efipay = getEfiClient();
        const txid = generateTxid();

        const body: any = {
            calendario: {
                expiracao: expirationSeconds,
            },
            valor: {
                original: expectedTotal.toFixed(2),
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

        console.log('✅ [API Efi Charge] Cobrança EFI criada:', pixCharge.txid);

        // ════════════════════════════════════════════════════════════════════════
        // PASSO 4: Salvar transação EFI (obrigatório para auditoria + recovery)
        // ════════════════════════════════════════════════════════════════════════
        const numbersJsonStr = JSON.stringify(numbers);
        const txPayload = {
            txid: pixCharge.txid,
            raffle_id: raffleId,
            amount: expectedTotal,
            status: pixCharge.status,
            pix_copia_cola: pixCharge.pixCopiaCola,
            qr_code_url: pixCharge.qrCodeImage,
            buyer_name: buyer.name,
            buyer_email: buyer.email || '',
            buyer_phone: buyer.phone || '',
            numbers_json: numbersJsonStr,
        };

        let { error: txError } = await supabase.from('efi_transactions').insert(txPayload);
        if (txError) {
            console.warn('⚠️ [API Efi Charge] Tentando novamente salvar efi_transactions:', txError.message);
            const retryTx = await supabase.from('efi_transactions').insert(txPayload);
            txError = retryTx.error;
        }

        if (txError) {
            console.error('❌ [API Efi Charge] Falha crítica ao registrar efi_transactions:', txError.message);
            // Liberar reservas pending sem txid para não prender números de forma inconsistente
            await supabase
                .from('reservations')
                .delete()
                .eq('raffle_id', raffleId)
                .in('number', numbers)
                .eq('buyer_name', buyer.name)
                .eq('status', 'pending')
                .is('efi_txid', null);

            return res.status(500).json({
                error: 'Erro ao registrar transação de pagamento. Tente novamente.'
            });
        }

        // ════════════════════════════════════════════════════════════════════════
        // PASSO 5: Vincular o txid às reservas já criadas pelo lock
        // ════════════════════════════════════════════════════════════════════════
        let { error: updateErr } = await supabase
            .from('reservations')
            .update({
                efi_txid:   pixCharge.txid,
                expires_at: pixCharge.expiresAt,
                updated_at: new Date().toISOString()
            })
            .eq('raffle_id', raffleId)
            .in('number', numbers)
            .eq('buyer_name', buyer.name)
            .eq('status', 'pending');

        if (updateErr) {
            console.warn('⚠️ [API Efi Charge] Retry ao vincular txid às reservas:', updateErr.message);
            const retryUpd = await supabase
                .from('reservations')
                .update({
                    efi_txid:   pixCharge.txid,
                    expires_at: pixCharge.expiresAt,
                    updated_at: new Date().toISOString()
                })
                .eq('raffle_id', raffleId)
                .in('number', numbers)
                .eq('buyer_name', buyer.name)
                .eq('status', 'pending');
            updateErr = retryUpd.error;
        }

        if (updateErr) {
            console.error('❌ [API Efi Charge] Erro ao vincular txid às reservas:', updateErr);
        } else {
            console.log(`✅ [API Efi Charge] txid ${pixCharge.txid} vinculado às reservas de ${numbers.join(', ')}`);
        }

        // ════════════════════════════════════════════════════════════════════════
        // PASSO 6: Retornar dados do PIX ao frontend
        // ════════════════════════════════════════════════════════════════════════
        return res.status(200).json({
            success: true,
            txid: pixCharge.txid,
            qrCode: pixCharge.qrCodeImage,
            pixCopiaCola: pixCharge.pixCopiaCola,
            expiresAt: pixCharge.expiresAt,
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
