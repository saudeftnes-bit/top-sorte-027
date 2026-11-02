import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Configurar cabeçalhos CORS e JSON
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Método não permitido' });
    }

    try {
        const { password } = req.body || {};

        if (!password || typeof password !== 'string') {
            return res.status(400).json({ success: false, message: 'Senha não fornecida' });
        }

        // Senha configurada no servidor (NUNCA exposta ao frontend)
        // Suporta tanto ADMIN_PASSWORD quanto VITE_ADMIN_PASSWORD no servidor
        const serverPassword = (process.env.ADMIN_PASSWORD || process.env.VITE_ADMIN_PASSWORD || '').trim();

        if (!serverPassword) {
            console.error('❌ [AdminAuth] ADMIN_PASSWORD não configurada no servidor Vercel');
            return res.status(500).json({ 
                success: false, 
                message: 'Variável de senha não configurada no servidor. Configure ADMIN_PASSWORD no Vercel.' 
            });
        }

        // Comparação segura de hashes para evitar timing attacks
        const providedHash = crypto.createHash('sha256').update(password.trim()).digest('hex');
        const expectedHash = crypto.createHash('sha256').update(serverPassword).digest('hex');

        if (providedHash !== expectedHash) {
            // Pequeno delay proposital para mitigar ataques de força bruta
            await new Promise(resolve => setTimeout(resolve, 800));
            return res.status(401).json({ success: false, message: 'Senha incorreta' });
        }

        // Sucesso: Gerar token de sessão assinado (válido por 8 horas)
        const expiresAt = Date.now() + 8 * 60 * 60 * 1000;
        const payload = JSON.stringify({
            role: 'admin',
            iat: Date.now(),
            exp: expiresAt
        });

        // Assinar o payload com HMAC usando a senha do servidor como segredo
        const signature = crypto.createHmac('sha256', serverPassword).update(payload).digest('hex');
        const token = Buffer.from(payload).toString('base64') + '.' + signature;

        return res.status(200).json({
            success: true,
            token,
            expiresAt,
            message: 'Autenticado com sucesso'
        });

    } catch (error: any) {
        console.error('❌ [AdminAuth] Erro interno:', error);
        return res.status(500).json({ success: false, message: 'Erro interno ao validar senha' });
    }
}
