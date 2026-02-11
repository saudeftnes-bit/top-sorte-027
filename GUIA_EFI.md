# Guia de Configuração Efi (Gerencianet)

## 1. Obter Credenciais

### Sandbox (Testes)
1. Acesse: https://sejaefi.com.br
2. Crie uma conta de desenvolvedor
3. No painel, vá em **API** → **MinhasAplicações** → **Criar Aplicação**
4. Baixe o certificado de desenvolvimento (.p12)
5. Anote o **Client ID** e **Client Secret**

### Produção
1. Após validar no sandbox, solicite credenciais de produção
2. Configure certificado de produção
3. Cadastre sua chave PIX na conta Efi

---

## 2. Configurar Variáveis de Ambiente

### Local (.env.local)
Copie `.env.local.example` para `.env.local`:

```bash
cp .env.local.example .env.local
```

Edite `.env.local` e preencha:

```env
EFI_CLIENT_ID=Client_Id_...
EFI_CLIENT_SECRET=Client_Secret_...
EFI_CERTIFICATE_BASE64=MIIQiwIBAzCCEE...
EFI_PIX_KEY=suachave@email.com
EFI_SANDBOX=true
```

### Converter Certificado para Base64

**Windows (PowerShell):**
```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("certificado.p12"))
```

**Linux/Mac:**
```bash
base64 -i certificado.p12 | tr -d '\n' > certificado_base64.txt
cat certificado_base64.txt
```

Copie a saída e cole em `EFI_CERTIFICATE_BASE64`.

---

## 3. Configurar no Vercel

### Via Dashboard
1. Acesse: https://vercel.com
2. Selecione seu projeto
3. Vá em **Settings** → **Environment Variables**
4. Adicione cada variável:
   - `EFI_CLIENT_ID`
   - `EFI_CLIENT_SECRET`
   - `EFI_CERTIFICATE_BASE64`
   - `EFI_PIX_KEY`
   - `EFI_SANDBOX` (true ou false)

### Via CLI
```bash
vercel env add EFI_CLIENT_ID
vercel env add EFI_CLIENT_SECRET
vercel env add EFI_CERTIFICATE_BASE64
vercel env add EFI_PIX_KEY
vercel env add EFI_SANDBOX
```

---

## 4. Configurar Webhook na Efi

Após deploy no Vercel:

1. Copie a URL do seu app: `https://seu-app.vercel.app`
2. No painel Efi, vá em **API** → **Configurações de Webhook**
3. Adicione o endpoint:
   ```
   https://seu-app.vercel.app/api/efi-webhook
   ```
4. Selecione eventos: **PIX** → **Cobrança paga**
5. Salve

---

## 5. Executar Migração do Banco de Dados

Execute o script SQL no Supabase:

1. Abra o Supabase Dashboard
2. Vá em **SQL Editor**
3. Cole o conteúdo de `add-efi-integration.sql`
4. Execute

Isso criará:
- Campos Efi na tabela `reservations`
- Tabela `efi_transactions`
- Índices para performance

---

## 6. Testar Integração

### Sandbox (Desenvolvimento)
1. Inicie o servidor local:
   ```bash
   npm run dev
   ```

2. Selecione números em uma rifa

3. Preencha dados e clique em "Prosseguir para Pagamento"

4. Deverá aparecer:
   - QR Code PIX (Efi Sandbox)
   - Código PIX Copia e Cola

5. Use o app de simulação Efi para pagar

6. Em ~3 segundos, status deve mudar para "PAGO" automaticamente

### Produção
1. Configure `EFI_SANDBOX=false` no Vercel
2. Faça um pagamento real de teste (valor mínimo)
3. Confirme no admin que apareceu como "PAGO" com badge "🤖 EFI"

---

## 7. Verificar Logs

### Vercel Logs
```bash
vercel logs --follow
```

Ou no dashboard: **Deployments** → **Functions** → Ver logs

### Buscar Problemas
- `[Efi Service]` - Logs do serviço Efi
- `[API Efi Charge]` - Logs de criação de cobrança
- `[Webhook Efi]` - Logs de webhook recebido

---

## 8. Troubleshooting

### Erro: "Certificado inválido"
- Verifique se o base64 está completo (sem quebras de linha)
- Confirme que está usando certificado correto (sandbox vs produção)

### Erro: "Client ID/Secret inválidos"
- Verifique se copiou corretamente do painel Efi
- Confirme que está no ambiente correto (sandbox/produção)

### Webhook não está sendo chamado
- Verifique URL no painel Efi
- Confirme que está em HTTPS (Vercel fornece automaticamente)
- Veja logs da Efi para erros

### Pagamento não confirma automaticamente
- Verifique logs do webhook
- Confirme que a tabela `reservations` tem campo `efi_txid` preenchido
- Execute query SQL para debug:
  ```sql
  SELECT * FROM reservations WHERE efi_txid IS NOT NULL;
  SELECT * FROM efi_transactions ORDER BY created_at DESC LIMIT 10;
  ```

---

## 9. Documentação Útil

- [Efi - Documentação PIX](https://dev.efipay.com.br/docs/api-pix)
- [Efi - Webhooks](https://dev.efipay.com.br/docs/api-pix/webhooks)
- [Efi - Ambiente Sandbox](https://dev.efipay.com.br/docs)
- [Vercel - Serverless Functions](https://vercel.com/docs/functions/serverless-functions)
- [Supabase - SQL Editor](https://supabase.com/docs/guides/database)

---

## 10. Contato Suporte Efi

- Email: suporte@efipay.com.br
- Telefone: (31) 3256-0578
- Chat: https://sejaefi.com.br (dentro do painel)
