import EfiPay from 'sdk-node-apis-efi';

type VercelRequest = any;
type VercelResponse = any;

export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*');

    const clientId = (process.env.EFI_CLIENT_ID || '').trim();
    const clientSecret = (process.env.EFI_CLIENT_SECRET || '').trim();
    const cert = (process.env.EFI_CERTIFICATE_BASE64 || '').trim();
    const pixKey = process.env.EFI_PIX_KEY || '';

    const results: any = {
        credentials: {
            clientId: clientId.substring(0, 8) + '...' + clientId.substring(clientId.length - 4),
            clientSecret: clientSecret.substring(0, 8) + '...' + clientSecret.substring(clientSecret.length - 4),
            certLength: cert.length,
            certStart: cert.substring(0, 15),
            certEnd: cert.substring(cert.length - 15),
            pixKey: pixKey,
        },
        tests: {},
    };

    // TESTE 1: Produção (sandbox=false)
    try {
        const efipay = new EfiPay({
            sandbox: false,
            client_id: clientId,
            client_secret: clientSecret,
            certificate: cert,
            cert_base64: true,
            validateMtls: false,
        });

        const params = {
            inicio: new Date(Date.now() - 86400000).toISOString(),
            fim: new Date().toISOString(),
        };
        const response = await efipay.pixListCharges(params);
        results.tests.production = { success: true, message: 'Autenticação em PRODUÇÃO OK!', charges: response?.cobs?.length || 0 };
    } catch (error: any) {
        results.tests.production = {
            success: false,
            error: error.message || 'Erro desconhecido',
            errorType: error.name || error.tipo || null,
            fullError: typeof error === 'object' ? JSON.stringify(error).substring(0, 500) : String(error),
        };
    }

    // TESTE 2: Sandbox (sandbox=true)
    try {
        const efipay = new EfiPay({
            sandbox: true,
            client_id: clientId,
            client_secret: clientSecret,
            certificate: cert,
            cert_base64: true,
            validateMtls: false,
        });

        const params = {
            inicio: new Date(Date.now() - 86400000).toISOString(),
            fim: new Date().toISOString(),
        };
        const response = await efipay.pixListCharges(params);
        results.tests.sandbox = { success: true, message: 'Autenticação em SANDBOX OK!', charges: response?.cobs?.length || 0 };
    } catch (error: any) {
        results.tests.sandbox = {
            success: false,
            error: error.message || 'Erro desconhecido',
            fullError: typeof error === 'object' ? JSON.stringify(error).substring(0, 500) : String(error),
        };
    }

    return res.status(200).json(results);
}
