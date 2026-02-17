# 🌐 Configurar Webhook na EFI - Passo a Passo

## 📋 O que é o Webhook?

O webhook permite que a EFI **notifique automaticamente** seu sistema quando um PIX é pago. Sem ele, os pagamentos não confirmarão automaticamente!

---

## 🔗 Sua URL do Webhook

Substitua `SEU-DOMINIO` pelo domínio real do seu projeto no Vercel:

```
https://SEU-DOMINIO.vercel.app/api/efi-webhook
```

**Exemplo:**
```
https://top-sorte.vercel.app/api/efi-webhook
```

**📝 Onde encontrar seu domínio:**
1. Vá no Vercel → Seu projeto
2. Veja o domínio em **Deployments** → último deploy
3. Ou em **Settings** → **Domains**

---

## 🚀 Passo 1: Acessar Painel EFI

1. Acesse: **https://sejaefi.com.br**
2. Faça login
3. No menu lateral, vá em: **API**

---

## 🔧 Passo 2: Configurar Webhook PIX

1. Dentro de **API**, clique em **Webhooks**
2. Procure pela seção **PIX** ou **Notificações PIX**
3. Clique em **Configurar Webhook** ou **+ Novo Webhook**

---

## 📝 Passo 3: Preencher Configurações

### URL do Webhook:
```
https://SEU-DOMINIO.vercel.app/api/efi-webhook
```

**⚠️ IMPORTANTE:** 
- Use **HTTPS** (não HTTP)
- Substitua `SEU-DOMINIO` pelo domínio real
- A URL deve terminar com `/api/efi-webhook`

### Eventos para Monitora:

Marque os seguintes eventos:

- ✅ **PIX Recebido** (ou **pix.received**)
- ✅ **Cobrança Paga** (ou **charge.paid**)

**Opcional (se disponível):**
- ☐ PIX Devolvido
- ☐ Cobrança Cancelada

---

## 🧪 Passo 4: Testar Webhook

A EFI geralmente tem um botão **"Testar Webhook"** ou **"Enviar Teste"**.

1. Clique em **Testar**
2. Aguarde a resposta
3. Deve retornar:
   - ✅ **Status: 200 OK** ou **Sucesso**

**Se der erro:**
- Verifique se a URL está correta
- Certifique-se que o deploy no Vercel terminou
- Verifique se não tem espaços ou erros de digitação

---

## ✅ Passo 5: Salvar Configuração

1. Clique em **Salvar** ou **Confirmar**
2. O webhook agora está ativo! 🎉

---

## 🐛 Troubleshooting

### Erro 404 (Not Found):
- Verifique se a URL está correta
- Certifique-se que o deploy foi bem-sucedido
- A rota deve ser `/api/efi-webhook` (exatamente assim)

### Erro 500 (Server Error):
- Verifique se todas as 5 variáveis estão no Vercel
- Veja os logs do Vercel: `vercel logs --follow`
- Pode haver erro nas credenciais

### Teste retorna erro:
- Aguarde alguns minutos após o deploy
- Tente novamente
- Verifique os logs do Vercel

---

## 📊 Verificar se está funcionando

Depois de configurar o webhook:

1. No painel EFI, vá em **Webhooks**
2. Você deve ver o webhook configurado
3. Status deve estar **Ativo** ou similar

---

## 🎯 Próximos Passos

Após configurar o webhook:

1. ✅ Testar geração de QR Code no site
2. ✅ Fazer um pagamento teste (valor baixo, ex: R$ 1,00)
3. ✅ Verificar se confirma automaticamente em segundos
4. ✅ Conferir no admin panel se aparece a transação

---

## 📞 Precisa de Ajuda?

**Ver logs em tempo real:**
```powershell
vercel logs --follow
```

Procure por mensagens como:
- `[Webhook Efi]` - Notificações recebidas
- `💰 Pagamento confirmado` - Pagamento processado

**Suporte EFI:**
- Email: suporte@efipay.com.br
- Tel: (31) 3256-0578

---

## ✅ Checklist Final:

- [ ] URL do webhook configurada na EFI
- [ ] Eventos "PIX Recebido" selecionados
- [ ] Teste do webhook retornou 200 OK
- [ ] Webhook salvo e ativo no painel EFI

**Me avise quando terminar de configurar o webhook para fazermos um teste real!** 🚀
