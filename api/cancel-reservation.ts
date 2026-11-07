import { createClient } from '@supabase/supabase-js';

type VercelRequest = any;
type VercelResponse = any;

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST,PUT,DELETE');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    // Responder OPTIONS para preflight CORS
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        let body = req.body;
        if (typeof body === 'string') {
            try {
                body = JSON.parse(body);
            } catch (e) {
                console.warn('⚠️ [API Cancel Reservation] Não foi possível parsear body como JSON puro:', body);
            }
        }

        const { raffleId, numbers, sessionId } = body || {};

        if (!raffleId || !Array.isArray(numbers) || numbers.length === 0) {
            return res.status(200).json({ success: true, message: 'Nenhum número para cancelar.' });
        }

        const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
        const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

        if (!supabaseUrl || !supabaseKey) {
            console.error('❌ [API Cancel Reservation] Credenciais do Supabase ausentes no ambiente.');
            return res.status(500).json({ error: 'Supabase credentials missing' });
        }

        const supabase = createClient(supabaseUrl, supabaseKey);

        console.log(`🛑 [API Cancel Reservation] Liberando ${numbers.length} número(s): ${numbers.join(', ')} para rifa ${raffleId} (sessão: ${sessionId || 'N/A'})`);

        // 1. Tentar cancelamento via RPC atômica
        const { data: rpcData, error: rpcErr } = await supabase.rpc('cancel_reservation_atomic', {
            p_raffle_id: raffleId,
            p_numbers: numbers,
            p_session_id: sessionId || ''
        });

        if (rpcErr) {
            console.warn('⚠️ [API Cancel Reservation] RPC cancel_reservation_atomic falhou, aplicando fallback:', rpcErr.message);
        } else {
            console.log('✅ [API Cancel Reservation] Cancelado com sucesso via RPC:', rpcData);
        }

        // 2. Fallback de garantia:
        // A) Deletar seleções temporárias sem PIX
        const { error: delErr } = await supabase
            .from('reservations')
            .delete()
            .eq('raffle_id', raffleId)
            .in('number', numbers)
            .eq('status', 'pending')
            .is('efi_txid', null);

        if (delErr) {
            console.warn('⚠️ [API Cancel Reservation] Erro fallback delete:', delErr.message);
        }

        // B) Marcar como canceladas reservas pendentes com PIX gerado (NUNCA altera reservas pagas)
        const { error: updateErr } = await supabase
            .from('reservations')
            .update({
                status: 'cancelled',
                updated_at: new Date().toISOString()
            })
            .eq('raffle_id', raffleId)
            .in('number', numbers)
            .eq('status', 'pending');

        if (updateErr) {
            console.warn('⚠️ [API Cancel Reservation] Erro fallback update:', updateErr.message);
        }

        return res.status(200).json({
            success: true,
            released: numbers,
            raffleId
        });

    } catch (error: any) {
        console.error('❌ [API Cancel Reservation] Exceção crítica:', error);
        return res.status(500).json({ error: error.message || 'Erro interno ao cancelar reservas' });
    }
}
