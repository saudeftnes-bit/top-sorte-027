import { createPixCharge } from '../lib/efi-service';
import { supabase } from '../lib/supabase';

type VercelRequest = any;
type VercelResponse = any;

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
        const pixCharge = await createPixCharge({
            value: totalPrice,
            customerName: buyer.name,
            customerEmail: buyer.email,
        });

        console.log('✅ [API Efi Charge] Cobrança criada:', pixCharge.txid);

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
