// Webhook EFI - versão simplificada para registro
// A lógica de processamento será feita por polling no efi-charge.ts

type VercelRequest = any;
type VercelResponse = any;

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    console.log('🔔 [Webhook Efi] Requisição recebida:', req.method, JSON.stringify(req.body || {}));

    // Sempre retornar 200 para qualquer método
    // A EFI precisa receber 200 para registrar o webhook
    return res.status(200).json({ status: 'ok' });
}
