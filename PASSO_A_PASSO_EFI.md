# Passo a Passo - Configurar Credenciais Efi

## 📋 O que você precisa ter em mãos

- ✅ Client ID da Efi
- ✅ Client Secret da Efi  
- ✅ Certificado digital (.p12)
- ✅ Chave PIX cadastrada na Efi

---

## 🚀 Passo 1: Converter Certificado para Base64

### Windows (PowerShell):

1. Abra o PowerShell onde está o arquivo certificado.p12

2. Execute:
```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("certificado.p12"))
```

3. **Copie toda a saída** (é uma string longa)

### Linux/Mac:

```bash
base64 -i certificado.p12 | tr -d '\n'
```

---

## 🔧 Passo 2: Configurar Localmente (.env.local)

1. Abra o arquivo `.env.local` no seu projeto (se não existir, crie)

2. Adicione estas linhas (substitua pelos seus valores):

```env
# Suas credenciais existentes do Supabase (mantenha)
VITE_SUPABASE_URL=sua-url-atual
VITE_SUPABASE_ANON_KEY=sua-key-atual
VITE_GEMINI_API_KEY=sua-key-atual

# Novas credenciais EFI (adicione)
EFI_CLIENT_ID=Cole_Seu_Client_Id_Aqui
EFI_CLIENT_SECRET=Cole_Seu_Client_Secret_Aqui
EFI_CERTIFICATE_BASE64=Cole_O_Base64_Do_Certificado_Aqui
EFI_PIX_KEY=SuaChavePix@email.com
EFI_SANDBOX=true
```

**⚠️ ATENÇÃO:**
- `EFI_SANDBOX=true` → Para testes (ambiente sandbox)
- `EFI_SANDBOX=false` → Para produção (pagamentos reais)

3. Salve o arquivo

---

## 💾 Passo 3: Executar Migração SQL no Supabase

1. Acesse: https://supabase.com/dashboard

2. Selecione seu projeto

3. Vá em **SQL Editor** (menu lateral esquerdo)

4. Abra o arquivo `add-efi-integration.sql` do seu projeto

5. **Copie todo o conteúdo** do arquivo

6. **Cole no SQL Editor** do Supabase

7. Clique em **Run** (ou pressione Ctrl+Enter)

8. Aguarde mensagem de sucesso ✅

---

## ☁️ Passo 4: Configurar no Vercel

### Via Dashboard (Mais fácil):

1. Acesse: https://vercel.com

2. Entre no seu projeto

3. Vá em **Settings** → **Environment Variables**

4. Adicione **um por um** clicando em "Add New":

| Name | Value | Environment |
|------|-------|-------------|
| `EFI_CLIENT_ID` | Seu Client ID | Production |
| `EFI_CLIENT_SECRET` | Seu Client Secret | Production |
| `EFI_CERTIFICATE_BASE64` | Base64 do certificado | Production |
| `EFI_PIX_KEY` | Sua chave PIX | Production |
| `EFI_SANDBOX` | `true` (ou `false` para produção) | Production |

5. Clique em **Save** em cada uma

---

## 🔄 Passo 5: Deploy

```bash
git add .
git commit -m "feat: Configuração Efi"
git push origin main
```

O Vercel fará deploy automaticamente quando você fizer push.

---

## 🌐 Passo 6: Configurar Webhook na Efi

1. Acesse o painel da Efi: https://sejaefi.com.br

2. Vá em **API** → **Webhooks** → **PIX**

3. Clique em **Configurar Webhook**

4. Cole a URL do webhook (substitua pelo seu domínio):
```
https://SEU-APP.vercel.app/api/efi-webhook
```

5. Marque: **PIX** → **Cobrança paga**

6. Salve

---

## ✅ Passo 7: Testar

### Teste Local (antes do deploy):

```bash
npm run dev
```

1. Acesse: http://localhost:5173
2. Selecione números de uma rifa
3. Preencha seus dados
4. Clique em "Prosseguir para Pagamento"
5. Deve aparecer **QR Code** e **PIX Copia e Cola**

**Se deu erro:** Verifique o console do navegador (F12)

### Teste em Produção:

1. Acesse seu site no Vercel
2. Repita o processo acima
3. Use app bancário para pagar (sandbox ou produção)
4. Em ~3 segundos deve confirmar automaticamente

---

## 🐛 Problemas Comuns

### Erro: "Certificado inválido"
- Verifique se o base64 está **completo** (sem quebras de linha)
- Confirme que usou o certificado correto (sandbox vs produção)

### Erro: "Client ID/Secret inválidos"
- Copie novamente do painel Efi
- Verifique se não tem espaços extras

### QR Code não aparece
- Abra o console do navegador (F12)
- Procure por erros em vermelho
- Verifique se as variáveis estão no Vercel

### Pagamento não confirma automaticamente
- Verifique se o webhook está configurado corretamente na Efi
- Veja os logs: `vercel logs --follow`
- Confirme que usou HTTPS (não HTTP)

---

## 📞 Precisa de Ajuda?

**Logs do Vercel:**
```bash
vercel logs --follow
```

Procure por:
- `[Efi Service]` - Problemas na criação de cobrança
- `[API Efi Charge]` - Erros na API
- `[Webhook Efi]` - Problemas no webhook

**Suporte Efi:**
- Email: suporte@efipay.com.br
- Tel: (31) 3256-0578

---

## 🎯 Resumo Rápido

```
1. Converter certificado para base64 (PowerShell)
2. Adicionar credenciais no .env.local
3. Executar SQL no Supabase
4. Adicionar credenciais no Vercel
5. git push (deploy automático)
6. Configurar webhook na Efi
7. Testar!
```

**Pronto! Agora os usuários podem pagar pelo app e você recebe direto na Efi** 💰
