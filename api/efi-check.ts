import EfiPay from 'sdk-node-apis-efi';

type VercelRequest = any;
type VercelResponse = any;

export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*');

    const clientId = (process.env.EFI_CLIENT_ID || '').trim();
    const clientSecret = (process.env.EFI_CLIENT_SECRET || '').trim();
    const cert = (process.env.EFI_CERTIFICATE_BASE64 || '').trim();

    const results: any = { tests: {} };

    // TESTE 1: SEM prefixo (como está agora)
    try {
        const efipay = new EfiPay({
            sandbox: false,
            client_id: clientId,
            client_secret: clientSecret,
            certificate: cert,
            cert_base64: true,
            validateMtls: false,
        });
        const params = { inicio: new Date(Date.now() - 86400000).toISOString(), fim: new Date().toISOString() };
        await efipay.pixListCharges(params);
        results.tests.semPrefixo = { success: true, message: 'OK sem prefixo!' };
    } catch (e: any) {
        results.tests.semPrefixo = { success: false, error: e.message || JSON.stringify(e).substring(0, 200) };
    }

    // TESTE 2: COM prefixo Client_Id_ e Client_Secret_
    try {
        const efipay = new EfiPay({
            sandbox: false,
            client_id: 'Client_Id_' + clientId,
            client_secret: 'Client_Secret_' + clientSecret,
            certificate: cert,
            cert_base64: true,
            validateMtls: false,
        });
        const params = { inicio: new Date(Date.now() - 86400000).toISOString(), fim: new Date().toISOString() };
        await efipay.pixListCharges(params);
        results.tests.comPrefixo = { success: true, message: 'OK com prefixo!' };
    } catch (e: any) {
        results.tests.comPrefixo = { success: false, error: e.message || JSON.stringify(e).substring(0, 200) };
    }

    // TESTE 3: Credenciais invertidas (client_id como secret e vice-versa)
    try {
        const efipay = new EfiPay({
            sandbox: false,
            client_id: clientSecret,
            client_secret: clientId,
            certificate: cert,
            cert_base64: true,
            validateMtls: false,
        });
        const params = { inicio: new Date(Date.now() - 86400000).toISOString(), fim: new Date().toISOString() };
        await efipay.pixListCharges(params);
        results.tests.invertido = { success: true, message: 'OK com credenciais invertidas!' };
    } catch (e: any) {
        results.tests.invertido = { success: false, error: e.message || JSON.stringify(e).substring(0, 200) };
    }

    return res.status(200).json(results);
}
