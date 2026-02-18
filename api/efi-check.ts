type VercelRequest = any;
type VercelResponse = any;

export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*');

    const clientId = process.env.EFI_CLIENT_ID || '';
    const clientSecret = process.env.EFI_CLIENT_SECRET || '';
    const cert = process.env.EFI_CERTIFICATE_BASE64 || '';

    return res.status(200).json({
        message: 'Diagnóstico de variáveis EFI',
        EFI_CLIENT_ID: {
            exists: !!clientId,
            length: clientId.length,
            preview: clientId.substring(0, 8) + '...' + clientId.substring(clientId.length - 4),
        },
        EFI_CLIENT_SECRET: {
            exists: !!clientSecret,
            length: clientSecret.length,
            preview: clientSecret.substring(0, 8) + '...' + clientSecret.substring(clientSecret.length - 4),
        },
        EFI_CERTIFICATE_BASE64: {
            exists: !!cert,
            length: cert.length,
            preview: cert.substring(0, 10) + '...' + cert.substring(cert.length - 10),
        },
        EFI_PIX_KEY: process.env.EFI_PIX_KEY || 'NÃO DEFINIDA',
        EFI_SANDBOX: process.env.EFI_SANDBOX || 'NÃO DEFINIDA',
        expected: {
            clientId: 'a858a4f3...' + 'c3bc',
            clientSecret: 'fe6c7290...' + 'b03',
            certStart: 'MIIKXQIBAz...',
        },
    });
}
