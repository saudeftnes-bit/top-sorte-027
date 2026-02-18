import EfiPay from 'sdk-node-apis-efi';

type VercelRequest = any;
type VercelResponse = any;

export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*');

    const results: any = { steps: {} };

    const clientId = (process.env.EFI_CLIENT_ID || '').trim();
    const clientSecret = (process.env.EFI_CLIENT_SECRET || '').trim();
    const cert = (process.env.EFI_CERTIFICATE_BASE64 || '').trim();
    const pixKey = process.env.EFI_PIX_KEY || '';

    // Step 1: Criar cliente EFI
    let efipay: any;
    try {
        efipay = new EfiPay({
            sandbox: process.env.EFI_SANDBOX === 'true',
            client_id: clientId,
            client_secret: clientSecret,
            certificate: cert,
            cert_base64: true,
            validateMtls: false,
        });
        results.steps.createClient = { success: true };
    } catch (e: any) {
        results.steps.createClient = { success: false, error: e.message };
        return res.status(200).json(results);
    }

    // Step 2: Criar cobrança PIX SEM devedor (permitido pela EFI)
    const txid = 'TESTE' + Date.now().toString(36).toUpperCase();
    try {
        const body = {
            calendario: { expiracao: 300 },
            valor: { original: '0.01' },
            chave: pixKey,
            solicitacaoPagador: 'Teste diagnostico Top Sorte',
        };

        const chargeResponse = await efipay.pixCreateImmediateCharge({ txid }, body);
        results.steps.createCharge = {
            success: true,
            txid: chargeResponse.txid,
            status: chargeResponse.status,
            locId: chargeResponse.loc?.id,
        };

        // Step 3: Gerar QR Code
        if (chargeResponse.loc?.id) {
            try {
                const qrCode = await efipay.pixGenerateQRCode({ id: chargeResponse.loc.id });
                results.steps.generateQR = {
                    success: true,
                    hasQrCode: !!qrCode.qrcode,
                    hasImage: !!qrCode.imagemQrcode,
                };
            } catch (e: any) {
                results.steps.generateQR = { success: false, error: e.message || JSON.stringify(e).substring(0, 300) };
            }
        }
    } catch (e: any) {
        results.steps.createCharge = {
            success: false,
            error: e.message || 'Erro desconhecido',
            fullError: typeof e === 'object' ? JSON.stringify(e).substring(0, 500) : String(e),
        };
    }

    return res.status(200).json(results);
}
