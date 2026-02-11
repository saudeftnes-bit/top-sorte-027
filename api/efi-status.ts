import { getChargeStatus } from '../lib/efi-service';

type VercelRequest = any;
type VercelResponse = any;

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { txid } = req.query;

        if (!txid || typeof txid !== 'string') {
            return res.status(400).json({ error: 'txid is required' });
        }

        console.log('🔍 [API Efi Status] Consultando status:', txid);

        const status = await getChargeStatus(txid);

        return res.status(200).json({
            success: true,
            ...status,
        });
    } catch (error: any) {
        console.error('❌ [API Efi Status] Erro:', error);
        return res.status(500).json({
            error: error.message || 'Erro ao consultar status',
        });
    }
}
