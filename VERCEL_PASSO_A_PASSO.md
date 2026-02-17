# 🚀 Configurar Vercel - Passo a Passo Visual

## 📋 Suas Credenciais (para copiar):

```
Client ID: a858a4f3b44a94f63da1cbc5ea0b9bffb719c3bc
Client Secret: fe6c72907cfd483c20a141e35441c594e96feb03
Chave PIX: +5527992838803
Certificado Base64: Ver arquivo certificado-novo-base64.txt
```

---

## 🌐 Passo 1: Acessar Dashboard do Vercel

1. Abra: **https://vercel.com**
2. Faça login
3. Selecione o projeto **top-sorte**
4. Clique em **Settings** (no menu superior)
5. No menu lateral esquerdo, clique em **Environment Variables**

---

## 🗑️ Passo 2: Remover Variáveis Antigas (se existirem)

Procure por estas variáveis antigas e **delete** cada uma:

- `EFI_CLIENT_ID` (antiga)
- `EFI_CLIENT_SECRET` (antiga)
- `EFI_CERTIFICATE_BASE64` (antiga)

**Como deletar:**
- Clique nos **3 pontinhos** (⋮) à direita da variável
- Clique em **Delete**
- Confirme

---

## ➕ Passo 3: Adicionar NOVAS Variáveis

Clique no botão **Add New** (ou **Add Environment Variable**) e preencha:

### Variável 1: EFI_CLIENT_ID

```
Name: EFI_CLIENT_ID
Value: a858a4f3b44a94f63da1cbc5ea0b9bffb719c3bc
Environment: 
  ☑ Production
  ☐ Preview
  ☐ Development
```

Clique em **Save**

---

### Variável 2: EFI_CLIENT_SECRET

```
Name: EFI_CLIENT_SECRET
Value: fe6c72907cfd483c20a141e35441c594e96feb03
Environment: 
  ☑ Production
  ☐ Preview
  ☐ Development
```

Clique em **Save**

---

### Variável 3: EFI_CERTIFICATE_BASE64

```
Name: EFI_CERTIFICATE_BASE64
Value: [COLE O CONTEÚDO DO ARQUIVO certificado-novo-base64.txt]
Environment: 
  ☑ Production
  ☐ Preview
  ☐ Development
```

**IMPORTANTE:** 
- Abra o arquivo `certificado-novo-base64.txt`
- Selecione TUDO (Ctrl+A)
- Copie (Ctrl+C)
- Cole no campo Value
- **NÃO pode ter quebras de linha ou espaços!**

Clique em **Save**

---

### Variável 4: EFI_PIX_KEY

```
Name: EFI_PIX_KEY
Value: +5527992838803
Environment: 
  ☑ Production
  ☐ Preview
  ☐ Development
```

Clique em **Save**

---

### Variável 5: EFI_SANDBOX

```
Name: EFI_SANDBOX
Value: false
Environment: 
  ☑ Production
  ☐ Preview
  ☐ Development
```

**⚠️ ATENÇÃO:** Valor é `false` (modo produção - pagamentos reais!)

Clique em **Save**

---

## ✅ Passo 4: Verificar

Depois de adicionar todas, você deve ver **5 variáveis**:

1. ✅ `EFI_CLIENT_ID`
2. ✅ `EFI_CLIENT_SECRET`
3. ✅ `EFI_CERTIFICATE_BASE64`
4. ✅ `EFI_PIX_KEY`
5. ✅ `EFI_SANDBOX`

Todas devem estar marcadas como **Production**.

---

## 🚀 Passo 5: Fazer Deploy

Agora que as variáveis estão configuradas, vamos fazer o deploy:

### Opção A - Forçar Redeploy (Recomendado):

1. No Vercel, vá em **Deployments**
2. Clique nos **3 pontinhos** (⋮) do último deploy
3. Clique em **Redeploy**
4. Marque "Use existing build cache" se aparecer
5. Clique em **Redeploy**

### Opção B - Git Push:

```powershell
git add .
git commit -m "chore: atualizar credenciais EFI para produção"
git push origin main
```

O Vercel detecta automaticamente e faz o deploy!

---

## ⏱️ Passo 6: Aguardar Deploy

1. Vá em **Deployments** no Vercel
2. Você verá o deploy em andamento (status: **Building**)
3. Aguarde até aparecer **Ready** (1-2 minutos)
4. Se houver erro, clique no deploy e veja os logs

---

## 📊 Próximos Passos

Depois que o deploy estiver **Ready**:

1. ✅ Configurar Webhook na EFI
2. ✅ Testar pagamento em produção

---

## 🐛 Se algo der errado:

### Erro no deploy:
- Veja os logs clicando no deployment com erro
- Verifique se todas as 5 variáveis foram adicionadas
- Verifique se `EFI_SANDBOX=false` (sem aspas)

### Variável não aparece:
- Certifique-se de marcar **Production**
- Salve cada variável antes de adicionar a próxima

---

## 📝 Checklist Final:

- [ ] 5 variáveis adicionadas no Vercel
- [ ] Todas em "Production"
- [ ] Deploy concluído com sucesso (status Ready)
- [ ] Sem erros nos logs

**Depois me avise quando o deploy estiver pronto para configurarmos o webhook!** 🎉
