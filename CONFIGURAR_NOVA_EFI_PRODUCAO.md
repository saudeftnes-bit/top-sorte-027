# 🚀 Configurar Nova Aplicação EFI - Modo Produção

> **⚠️ IMPORTANTE**: Este guia é para configuração em **MODO PRODUÇÃO** com pagamentos REAIS.

## 📋 Pré-requisitos

Antes de começar, você precisa ter em mãos:

- ✅ **Client ID de Produção** (da nova aplicação EFI)
- ✅ **Client Secret de Produção** (da nova aplicação EFI)
- ✅ **Certificado Digital de Produção** (.p12 ou .pem)
- ✅ **Chave PIX** cadastrada e ativa na EFI
- ✅ Conta EFI verificada e aprovada para produção

---

## 🎯 Passo 1: Criar Nova Aplicação na EFI

1. Acesse: https://sejaefi.com.br
2. Faça login na sua conta
3. Vá em: **API** → **Minhas Aplicações**
4. Clique em **"+ Nova Aplicação"**
5. Preencha:
   - **Nome**: `Top Sorte Produção`
   - **Ambiente**: **Produção** (não marque sandbox)
   - **Tipo**: API Pix
6. Clique em **Criar**

### Anotações importantes:

```
Client ID: _________________________________
Client Secret: _____________________________
```

> 💾 **Guarde essas credenciais em local seguro!**

---

## 🔐 Passo 2: Gerar e Baixar Certificado

### Na página da aplicação criada:

1. Vá na aba **"Certificados"**
2. Clique em **"Gerar Certificado de Produção"**
3. Baixe o arquivo `.p12`
4. **Anote a senha** se solicitada

### Converter para Base64:

#### No Windows (PowerShell):

```powershell
# Navegue até a pasta onde está o certificado
cd C:\Users\Edvaldo\Downloads

# Execute (substitua 'certificado.p12' pelo nome real do arquivo)
[Convert]::ToBase64String([IO.File]::ReadAllBytes("certificado.p12"))
```

#### Linux/Mac:

```bash
base64 -i certificado.p12 | tr -d '\n'
```

**📝 Copie TODA a saída** (será uma string longa sem espaços ou quebras de linha)

---

## 🔧 Passo 3: Configurar Ambiente Local

### 3.1 - Criar/Atualizar `.env.local`

No diretório do projeto, crie ou edite o arquivo `.env.local`:

```env
# ========================================
# SUPABASE (mantenha as existentes)
# ========================================
VITE_SUPABASE_URL=sua-url-supabase
VITE_SUPABASE_ANON_KEY=sua-key-supabase
VITE_GEMINI_API_KEY=sua-key-gemini

# ========================================
# EFI - PRODUÇÃO (NOVAS CREDENCIAIS)
# ========================================
EFI_CLIENT_ID=Cole_Seu_Client_Id_De_Producao_Aqui
EFI_CLIENT_SECRET=Cole_Seu_Client_Secret_De_Producao_Aqui
EFI_CERTIFICATE_BASE64=Cole_O_Base64_Completo_Do_Certificado_Aqui
EFI_PIX_KEY=SuaChavePix@email.com
EFI_SANDBOX=false
```

### ⚠️ ATENÇÃO - Configuração de Produção:

- ✅ `EFI_SANDBOX=false` → **Pagamentos REAIS**
- ❌ Nunca commite este arquivo no git
- 🔒 Certificado deve estar completo (sem quebras de linha)
- 📧 Use a chave PIX cadastrada na sua conta EFI

### 3.2 - Verificar `.gitignore`

Certifique-se que `.env.local` está no `.gitignore`:

```bash
# Verificar
cat .gitignore | findstr env.local
```

Se não estiver, adicione:

```
.env.local
.env*.local
*.p12
*.pem
```

---

## ☁️ Passo 4: Configurar Variáveis no Vercel

### Via Dashboard Vercel (Recomendado):

1. Acesse: https://vercel.com
2. Selecione seu projeto **Top Sorte**
3. Vá em: **Settings** → **Environment Variables**

### 4.1 - Remover variáveis antigas (se existirem):

Procure e **delete** as variáveis antigas da EFI:
- `EFI_CLIENT_ID` (antiga)
- `EFI_CLIENT_SECRET` (antiga)
- `EFI_CERTIFICATE_BASE64` (antiga)

### 4.2 - Adicionar NOVAS variáveis:

Clique em **"Add New"** para cada variável:

| Variable Name | Value | Environments |
|---------------|-------|--------------|
| `EFI_CLIENT_ID` | Seu novo Client ID de produção | Production, Preview |
| `EFI_CLIENT_SECRET` | Seu novo Client Secret de produção | Production, Preview |
| `EFI_CERTIFICATE_BASE64` | Base64 completo do certificado | Production, Preview |
| `EFI_PIX_KEY` | Sua chave PIX (email, CPF, etc) | Production, Preview |
| `EFI_SANDBOX` | `false` | Production, Preview |

### ⚠️ Checklist de Segurança:

- [ ] Certificate Base64 está completo (sem quebras)
- [ ] Client ID e Secret são de PRODUÇÃO (não sandbox)
- [ ] EFI_SANDBOX está como `false`
- [ ] Chave PIX está cadastrada na conta EFI
- [ ] Variáveis estão em "Production" e "Preview"

---

## 🔄 Passo 5: Fazer Deploy

### 5.1 - Commit e Push:

```bash
# Verificar status
git status

# Se houver alterações no código (não commite .env.local!)
git add .
git commit -m "chore: atualizar configuração EFI para produção"
git push origin main
```

### 5.2 - Monitorar Deploy:

1. Acesse: https://vercel.com/seu-projeto
2. Vá em **Deployments**
3. Aguarde o deploy concluir (1-2 minutos)
4. Verifique se não há erros

### 5.3 - Forçar Rebuild (se necessário):

Se já estava deployado:

1. Vercel Dashboard → Deployments
2. Clique nos 3 pontinhos do último deploy
3. **Redeploy**

Ou via CLI:

```bash
vercel --prod
```

---

## 🌐 Passo 6: Configurar Webhook na EFI

> **Webhook** permite que a EFI notifique automaticamente quando um PIX é pago.

### 6.1 - Obter URL do Webhook:

Sua URL será:
```
https://SEU-DOMINIO.vercel.app/api/efi-webhook
```

Exemplo:
```
https://top-sorte.vercel.app/api/efi-webhook
```

### 6.2 - Configurar no Painel EFI:

1. Acesse: https://sejaefi.com.br
2. Vá em: **API** → **Webhooks**
3. Clique em **"Configurar Webhook PIX"**
4. Cole sua URL: `https://SEU-DOMINIO.vercel.app/api/efi-webhook`
5. Selecione eventos:
   - ✅ **PIX Recebido**
   - ✅ **PIX Devolvido** (opcional)
6. Clique em **Salvar**

### 6.3 - Testar Webhook:

Na mesma tela, clique em **"Testar Webhook"**

Deve retornar:
```
✅ Status: 200 OK
```

---

## ✅ Passo 7: Testar em Produção

### 7.1 - Teste de Geração de Cobrança:

1. Acesse seu site: `https://SEU-DOMINIO.vercel.app`
2. Selecione uma rifa
3. Escolha números
4. Preencha dados do comprador
5. Clique em **"Prosseguir para Pagamento"**

**Resultado esperado:**
- ✅ QR Code PIX aparece
- ✅ Código "PIX Copia e Cola" é exibido
- ✅ Timer de expiração (30 minutos) está ativo
- ✅ Números ficam "reservados" (status amarelo)

### 7.2 - Teste de Pagamento REAL:

> ⚠️ **Este será um pagamento REAL!** Use um valor baixo (R$ 1,00) para teste.

1. Abra o app do seu banco
2. Escaneie o QR Code **OU** copie o código PIX
3. Confirme o pagamento

**Resultado esperado em ~3-10 segundos:**
- ✅ Números mudam para "Pago" (verde)
- ✅ Admin panel mostra a transação
- ✅ Email de confirmação (se configurado)

### 7.3 - Verificar no Admin:

1. Acesse: `https://SEU-DOMINIO.vercel.app/admin`
2. Faça login
3. Vá em **Transações** ou **Rifas**
4. Verifique se a compra aparece com:
   - Status: **Pago**
   - Nome do comprador
   - Números reservados
   - Valor correto

---

## 🐛 Troubleshooting

### ❌ Erro: "Certificado inválido"

**Possíveis causas:**
- Certificado de sandbox sendo usado em produção (ou vice-versa)
- Base64 incompleto ou com quebras de linha
- Arquivo corrompido

**Solução:**
1. Baixe novamente o certificado de **produção**
2. Converta novamente para Base64 sem quebras
3. Atualize no Vercel
4. Force um redeploy

### ❌ Erro: "Client ID/Secret inválidos"

**Solução:**
1. Volte ao painel EFI
2. Vá em **Minhas Aplicações** → Sua aplicação
3. Copie novamente Client ID e Secret
4. Verifique se não tem espaços extras
5. Atualize no Vercel

### ❌ QR Code não aparece

**Debug:**
1. Abra Console do navegador (F12)
2. Vá na aba **Console**
3. Procure erros em vermelho

**Checklist:**
- [ ] Variáveis estão no Vercel?
- [ ] `EFI_SANDBOX=false` no Vercel?
- [ ] Deploy foi feito após adicionar variáveis?
- [ ] Certificado está completo?

### ❌ Pagamento não confirma automaticamente

**Possíveis causas:**
- Webhook não configurado ou com URL errada
- Webhook retornando erro 500/404
- Eventos não selecionados

**Debug:**
1. Verifique logs do Vercel:
   ```bash
   vercel logs --follow
   ```

2. Procure por `[Webhook Efi]` nos logs

3. Teste webhook manualmente no painel EFI

---

## 📊 Monitoramento

### Logs do Vercel:

```bash
# Tempo real
vercel logs --follow

# Últimos 100 logs
vercel logs
```

### Procure por:

- `✅ [API Efi Charge]` → Cobrança criada com sucesso
- `❌ [API Efi Charge]` → Erro ao criar cobrança
- `💰 [Webhook Efi]` → Pagamento recebido
- `⚠️ [Webhook Efi]` → Erro no webhook

### Painel EFI:

1. https://sejaefi.com.br
2. **Dashboard** → **Transações PIX**
3. Verifique pagamentos recebidos em tempo real

---

## 🔒 Checklist de Segurança Final

Antes de ir para produção completa, verifique:

- [ ] Certificado de **PRODUÇÃO** (não sandbox)
- [ ] `EFI_SANDBOX=false` no Vercel
- [ ] Client ID e Secret de **PRODUÇÃO**
- [ ] Chave PIX válida e cadastrada
- [ ] `.env.local` está no `.gitignore`
- [ ] Nunca commitou credenciais no git
- [ ] Webhook configurado com HTTPS
- [ ] Teste de pagamento real foi bem-sucedido
- [ ] Admin panel mostra transações corretamente
- [ ] Logs do Vercel não mostram erros

---

## 📞 Suporte

### Documentação EFI:
- https://dev.efipay.com.br/docs/api-pix/

### Logs detalhados:
```bash
vercel logs --follow
```

### Suporte EFI:
- Email: suporte@efipay.com.br
- Telefone: (31) 3256-0578
- WhatsApp: Disponível no painel

---

## 🎯 Resumo dos 7 Passos

```
1. ✅ Criar nova aplicação na EFI (Produção)
2. ✅ Baixar certificado e converter para Base64
3. ✅ Configurar .env.local com novas credenciais
4. ✅ Atualizar variáveis no Vercel (remover antigas)
5. ✅ Fazer deploy (git push)
6. ✅ Configurar webhook na EFI
7. ✅ Testar com pagamento real
```

---

## 💰 Pronto!

Sua integração EFI em **modo de produção** está configurada!

Agora os clientes podem:
- ✅ Ver QR Code PIX em tempo real
- ✅ Pagar via app bancário
- ✅ Ter confirmação automática em segundos
- ✅ Você recebe direto na conta EFI

**Boa sorte com as vendas! 🎉**
