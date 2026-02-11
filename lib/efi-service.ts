import EfiPay from 'sdk-node-apis-efi';

// Configuração do cliente Efi
const getEfiClient = () => {
    const options = {
        sandbox: process.env.EFI_SANDBOX === 'true',
        client_id: process.env.EFI_CLIENT_ID || '',
        client_secret: process.env.EFI_CLIENT_SECRET || '',
        certificate: process.env.EFI_CERTIFICATE_BASE64 || '',
        cert_base64: true,
        validateMtls: false,
    };

    return new EfiPay(options);
};

export interface PixChargeData {
    value: number;
    customerName: string;
    customerCpf?: string;
    customerEmail?: string;
    txid?: string;
    expirationSeconds?: number;
}

export interface PixChargeResponse {
    txid: string;
    status: string;
    pixCopiaCola: string;
    qrCodeImage: string;
    expiresAt: string;
    location: string;
}

/**
 * Cria uma cobrança PIX imediata na Efi
 */
export async function createPixCharge(data: PixChargeData): Promise<PixChargeResponse> {
    const efipay = getEfiClient();

    // Gera txid único se não fornecido
    const txid = data.txid || generateTxid();

    // Tempo de expiração (padrão: 30 minutos)
    const expirationSeconds = data.expirationSeconds || 1800;

    const body = {
        calendario: {
            expiracao: expirationSeconds,
        },
        devedor: {
            nome: data.customerName,
            ...(data.customerCpf && { cpf: data.customerCpf }),
        },
        valor: {
            original: data.value.toFixed(2),
        },
        chave: process.env.EFI_PIX_KEY,
        solicitacaoPagador: 'Pagamento Top Sorte - Rifas',
        infoAdicionais: [
            {
                nome: 'Cliente',
                valor: data.customerName,
            },
        ],
    };

    try {
        console.log('🔄 [Efi Service] Criando cobrança PIX:', { txid, value: data.value });

        // Criar cobrança PIX
        const chargeResponse = await efipay.pixCreateImmediateCharge(txid, body);

        console.log('✅ [Efi Service] Cobrança criada:', chargeResponse);

        // Gerar QR Code
        const qrCodeResponse = await efipay.pixGenerateQRCode({
            id: chargeResponse.loc.id,
        });

        console.log('✅ [Efi Service] QR Code gerado');

        // Calcular data de expiração
        const expiresAt = new Date();
        expiresAt.setSeconds(expiresAt.getSeconds() + expirationSeconds);

        return {
            txid: chargeResponse.txid,
            status: chargeResponse.status,
            pixCopiaCola: qrCodeResponse.qrcode,
            qrCodeImage: qrCodeResponse.imagemQrcode,
            expiresAt: expiresAt.toISOString(),
            location: chargeResponse.loc.location,
        };
    } catch (error: any) {
        console.error('❌ [Efi Service] Erro ao criar cobrança:', error);
        throw new Error(`Erro Efi: ${error.message || 'Falha ao criar cobrança PIX'}`);
    }
}

/**
 * Consulta o status de uma cobrança PIX
 */
export async function getChargeStatus(txid: string) {
    const efipay = getEfiClient();

    try {
        console.log('🔍 [Efi Service] Consultando status:', txid);

        const params = {
            txid,
        };

        const response = await efipay.pixDetailCharge(params);

        console.log('✅ [Efi Service] Status obtido:', response.status);

        return {
            txid: response.txid,
            status: response.status,
            value: parseFloat(response.valor?.original || '0'),
            paidValue: response.pix ? parseFloat(response.pix[0]?.valor || '0') : 0,
            paidAt: response.pix?.[0]?.horario || null,
            customer: response.devedor,
        };
    } catch (error: any) {
        console.error('❌ [Efi Service] Erro ao consultar status:', error);
        throw new Error(`Erro ao consultar status: ${error.message}`);
    }
}

/**
 * Gera um txid único (máximo 35 caracteres alfanuméricos)
 */
function generateTxid(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 15);
    return `TS${timestamp}${random}`.substring(0, 35).toUpperCase();
}

/**
 * Valida webhook da Efi (verificação básica)
 */
export function validateWebhook(payload: any): boolean {
    // A Efi não envia assinatura por padrão, então validamos a estrutura
    return payload && (payload.pix || payload.pixQrcode);
}
