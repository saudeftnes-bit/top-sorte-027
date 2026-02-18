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

    results.config = {
        clientId: clientId.substring(0, 15) + '...',
        pixKey,
        sandbox: process.env.EFI_SANDBOX,
    };

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

    // Step 2: Criar cobrança PIX de teste (R$ 0.01)
    const txid = 'TESTE' + Date.now().toString(36).toUpperCase();
    try {
        const body = {
            calendario: { expiracao: 300 },
            devedor: { nome: 'Teste Diagnostico' },
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

    // Step 4: Testar Supabase
    try {
        const { createClient } = await import('@supabase/supabase-js');
        const supaUrl = process.env.VITE_SUPABASE_URL || '';
        const supaKey = process.env.VITE_SUPABASE_ANON_KEY || '';
        const supabase = createClient(supaUrl, supaKey);

        // Verificar se tabela efi_transactions existe
        const { data, error } = await supabase.from('efi_transactions').select('id').limit(1);
        results.steps.supabase = {
            success: !error,
            error: error ? error.message : null,
            tableExists: !error,
        };
    } catch (e: any) {
        results.steps.supabase = { success: false, error: e.message };
    }

    return res.status(200).json(results);
}
