// Este arquivo lida com a rota /api/efi-webhook/pix
// A EFI adiciona /pix automaticamente à URL do webhook
// Então este handler recebe as notificações reais de pagamento PIX

import handler from './index';

export default handler;
