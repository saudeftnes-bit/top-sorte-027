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

    try {
        // Log das configurações (sem expor dados sensíveis)
        console.log('🔧 [Setup Webhook] Iniciando...');
        console.log('🔧 [Setup Webhook] Sandbox:', process.env.EFI_SANDBOX);
        console.log('🔧 [Setup Webhook] Client ID existe:', !!process.env.EFI_CLIENT_ID);
        console.log('🔧 [Setup Webhook] Client Secret existe:', !!process.env.EFI_CLIENT_SECRET);
        console.log('🔧 [Setup Webhook] Certificate existe:', !!process.env.EFI_CERTIFICATE_BASE64);
        console.log('🔧 [Setup Webhook] Certificate tamanho:', (process.env.EFI_CERTIFICATE_BASE64 || '').length);
        console.log('🔧 [Setup Webhook] PIX Key:', process.env.EFI_PIX_KEY);

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
        // A EFI adiciona /pix automaticamente ao final da URL do webhook
        // Então registramos sem /pix e criamos um handler para /api/efi-webhook/pix
        const webhookUrl = `${protocol}://${host}/api/efi-webhook`;

        console.log('� [Setup Webhook] URL do webhook:', webhookUrl);

        // PASSO 1: Testar autenticação primeiro - listar cobranças
        console.log('🔑 [Setup Webhook] Testando autenticação...');
        try {
            const testParams = {
                inicio: new Date(Date.now() - 86400000).toISOString(),
                fim: new Date().toISOString(),
            };
            await efipay.pixListCharges(testParams);
            console.log('✅ [Setup Webhook] Autenticação OK!');
        } catch (authError: any) {
            console.error('❌ [Setup Webhook] Erro de autenticação:', JSON.stringify(authError, null, 2));
            return res.status(401).json({
                success: false,
                step: 'authentication',
                error: 'Falha na autenticação com a EFI',
                details: authError.message || authError.mensagem || JSON.stringify(authError),
                config: {
                    sandbox: process.env.EFI_SANDBOX,
                    clientIdLength: (process.env.EFI_CLIENT_ID || '').length,
                    clientSecretLength: (process.env.EFI_CLIENT_SECRET || '').length,
                    certLength: (process.env.EFI_CERTIFICATE_BASE64 || '').length,
                    pixKey: process.env.EFI_PIX_KEY,
                },
            });
        }

        // PASSO 2: Registrar webhook
        console.log('🔗 [Setup Webhook] Registrando webhook para chave:', process.env.EFI_PIX_KEY);

        const params = {
            chave: process.env.EFI_PIX_KEY || '',
        };

        const body = {
            webhookUrl: webhookUrl,
        };

        try {
            const response = await efipay.pixConfigWebhook(params, body);
            console.log('✅ [Setup Webhook] Webhook configurado!', JSON.stringify(response));

            return res.status(200).json({
                success: true,
                message: 'Webhook configurado com sucesso!',
                webhookUrl: webhookUrl,
                pixKey: process.env.EFI_PIX_KEY,
                response: response,
                note: 'A EFI vai adicionar /pix ao final da URL automaticamente. O endpoint completo será: ' + webhookUrl + '/pix',
            });
        } catch (webhookError: any) {
            console.error('❌ [Setup Webhook] Erro ao registrar webhook:', JSON.stringify(webhookError, null, 2));

            // Tentar obter webhook atual
            let currentWebhook = null;
            try {
                currentWebhook = await efipay.pixDetailWebhook({ chave: process.env.EFI_PIX_KEY || '' });
                console.log('📋 [Setup Webhook] Webhook atual:', JSON.stringify(currentWebhook));
            } catch (e) {
                console.log('📋 [Setup Webhook] Nenhum webhook configurado atualmente');
            }

            return res.status(500).json({
                success: false,
                step: 'webhook_registration',
                error: 'Erro ao registrar webhook na EFI',
                details: webhookError.message || webhookError.mensagem || JSON.stringify(webhookError),
                errorFull: webhookError.nome || webhookError.name || null,
                webhookUrl: webhookUrl,
                currentWebhook: currentWebhook,
                tip: 'Certifique-se que a chave PIX está cadastrada na mesma conta EFI das credenciais.',
            });
        }
    } catch (error: any) {
        console.error('❌ [Setup Webhook] Erro geral:', JSON.stringify(error, null, 2));

        return res.status(500).json({
            success: false,
            step: 'general',
            error: error.message || 'Erro desconhecido',
            stack: error.stack?.split('\n').slice(0, 3),
            details: error.response?.data || error.mensagem || null,
        });
    }
}
