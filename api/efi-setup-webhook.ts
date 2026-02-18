import EfiPay from 'sdk-node-apis-efi';

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

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // Aceitar GET e POST
    if (req.method !== 'GET' && req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const options = {
            sandbox: process.env.EFI_SANDBOX === 'true',
            client_id: process.env.EFI_CLIENT_ID || '',
            client_secret: process.env.EFI_CLIENT_SECRET || '',
            certificate: process.env.EFI_CERTIFICATE_BASE64 || '',
            cert_base64: true,
            validateMtls: false,
        };

        const efipay = new EfiPay(options);

        // Determinar URL do webhook baseado no host
        const host = req.headers.host || req.headers['x-forwarded-host'] || '';
        const protocol = req.headers['x-forwarded-proto'] || 'https';
        const webhookUrl = `${protocol}://${host}/api/efi-webhook`;

        console.log('🔧 [Setup Webhook] Configurando webhook PIX...');
        console.log('📍 [Setup Webhook] URL:', webhookUrl);
        console.log('🔑 [Setup Webhook] Chave PIX:', process.env.EFI_PIX_KEY);

        // Registrar webhook na EFI
        const params = {
            chave: process.env.EFI_PIX_KEY || '',
        };

        const body = {
            webhookUrl: webhookUrl,
        };

        const response = await efipay.pixConfigWebhook(params, body);

        console.log('✅ [Setup Webhook] Webhook configurado com sucesso!', response);

        return res.status(200).json({
            success: true,
            message: 'Webhook configurado com sucesso!',
            webhookUrl: webhookUrl,
            pixKey: process.env.EFI_PIX_KEY,
            response: response,
        });
    } catch (error: any) {
        console.error('❌ [Setup Webhook] Erro:', error);

        return res.status(500).json({
            success: false,
            error: error.message || 'Erro ao configurar webhook',
            details: error.response?.data || error.mensagem || null,
            tip: 'Verifique se as credenciais EFI estão corretas e se o certificado é de produção.',
        });
    }
}
