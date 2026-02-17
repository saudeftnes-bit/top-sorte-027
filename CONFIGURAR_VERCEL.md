# Script para Configurar Variáveis no Vercel

## Comandos para executar:

### 1. Remover variáveis antigas (se existirem):

```powershell
vercel env rm EFI_CLIENT_ID production
vercel env rm EFI_CLIENT_SECRET production
vercel env rm EFI_CERTIFICATE_BASE64 production
```

### 2. Adicionar novas variáveis:

#### EFI_CLIENT_ID:
```powershell
vercel env add EFI_CLIENT_ID production
# Quando solicitado, cole: a858a4f3b44a94f63da1cbc5ea0b9bffb719c3bc
```

#### EFI_CLIENT_SECRET:
```powershell
vercel env add EFI_CLIENT_SECRET production
# Quando solicitado, cole: fe6c72907cfd483c20a141e35441c594e96feb03
```

#### EFI_CERTIFICATE_BASE64:
```powershell
vercel env add EFI_CERTIFICATE_BASE64 production
# Quando solicitado, cole o conteúdo do arquivo certificado-base64.txt
```

#### EFI_PIX_KEY:
```powershell
vercel env add EFI_PIX_KEY production
# Quando solicitado, cole: +5527992838803
```

#### EFI_SANDBOX:
```powershell
vercel env add EFI_SANDBOX production
# Quando solicitado, cole: false
```

---

## OU use o Dashboard do Vercel (mais fácil):

1. Acesse: https://vercel.com
2. Entre no projeto: **top-sorte**
3. Vá em: **Settings** → **Environment Variables**
4. **REMOVA as variáveis antigas da EFI** (se existirem)
5. **Adicione** cada variável clicando em "Add New":

| Name | Value | Environment |
|------|-------|-------------|
| `EFI_CLIENT_ID` | `a858a4f3b44a94f63da1cbc5ea0b9bffb719c3bc` | Production |
| `EFI_CLIENT_SECRET` | `fe6c72907cfd483c20a141e35441c594e96feb03` | Production |
| `EFI_CERTIFICATE_BASE64` | Ver arquivo `certificado-base64.txt` | Production |
| `EFI_PIX_KEY` | `+5527992838803` | Production |
| `EFI_SANDBOX` | `false` | Production |

6. Clique em **Save** em cada uma

---

## ✅ Após configurar:

```powershell
# Fazer deploy
git add .
git commit -m "chore: atualizar credenciais EFI para produção"
git push origin main
```

O Vercel fará deploy automaticamente!
