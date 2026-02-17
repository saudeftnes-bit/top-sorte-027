# ✅ Checklist Rápido - Nova Aplicação EFI Produção

## Antes de Começar

- [ ] Conta EFI verificada e aprovada para produção
- [ ] Chave PIX cadastrada e ativa
- [ ] Certificado antigo/sandbox guardado (backup)

---

## Passo a Passo

### 1. Criar Aplicação na EFI
- [ ] Acessei https://sejaefi.com.br
- [ ] Criei nova aplicação em modo **Produção**
- [ ] Copiei Client ID
- [ ] Copiei Client Secret
- [ ] Guardei as credenciais em local seguro

### 2. Certificado
- [ ] Baixei certificado de produção (.p12)
- [ ] Converti para Base64 usando PowerShell
- [ ] Copiei Base64 completo (sem quebras de linha)

### 3. Ambiente Local
- [ ] Criei/editei `.env.local`
- [ ] Colei Client ID de produção
- [ ] Colei Client Secret de produção
- [ ] Colei Certificate Base64 completo
- [ ] Adicionei chave PIX
- [ ] Configurei `EFI_SANDBOX=false`
- [ ] Verifiquei que `.env.local` está no `.gitignore`

### 4. Vercel
- [ ] Acessei dashboard do Vercel
- [ ] Removi variáveis antigas da EFI (se existiam)
- [ ] Adicionei `EFI_CLIENT_ID` (novo)
- [ ] Adicionei `EFI_CLIENT_SECRET` (novo)
- [ ] Adicionei `EFI_CERTIFICATE_BASE64` (novo)
- [ ] Adicionei `EFI_PIX_KEY`
- [ ] Adicionei `EFI_SANDBOX=false`
- [ ] Todas em "Production" e "Preview"

### 5. Deploy
- [ ] Fiz commit das alterações (se houver)
- [ ] Fiz push para main
- [ ] Deploy concluiu sem erros
- [ ] Verifiquei logs do Vercel

### 6. Webhook
- [ ] Configurei webhook no painel EFI
- [ ] URL: `https://MEU-DOMINIO.vercel.app/api/efi-webhook`
- [ ] Selecionei evento "PIX Recebido"
- [ ] Testei webhook (retornou 200 OK)

### 7. Testes
- [ ] QR Code aparece no site
- [ ] Código PIX Copia e Cola funciona
- [ ] Fiz pagamento teste (valor baixo)
- [ ] Pagamento confirmou automaticamente
- [ ] Admin panel mostra a transação
- [ ] Status mudou para "Pago"

---

## ✅ Verificação Final

- [ ] `EFI_SANDBOX=false` no Vercel
- [ ] Certificado é de PRODUÇÃO
- [ ] Client ID/Secret são de PRODUÇÃO
- [ ] Webhook configurado com HTTPS
- [ ] Teste real foi bem-sucedido
- [ ] Não commitei `.env.local` no git

---

## 🚀 Status: Pronto para Produção!

Data da configuração: ___/___/______

Aplicação EFI: ________________________

Primeiro pagamento real: ✅ / ⏳
