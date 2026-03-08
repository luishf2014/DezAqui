# 🔍 DIAGNÓSTICO PRECISO - PAGAMENTO PIX NÃO FUNCIONANDO

## Status Atual
❌ **Problema**: Pagamento Pix feito, mas não redireciona para página de sucesso e não cria participação
❌ **Causa**: Webhook não está sendo chamado ou não está funcionando

## 📋 CHECKLIST DE DIAGNÓSTICO (Execute em ordem)

### 1. ✅ VERIFICAR SE AS EDGE FUNCTIONS ESTÃO DEPLOYADAS

```bash
# No terminal do projeto:
npx supabase functions list
```

**Deve aparecer:**
- `mercadopago-create-pix`
- `mercadopago-webhook`

**Se não aparecer, fazer deploy:**
```bash
npx supabase functions deploy mercadopago-create-pix --no-verify-jwt
npx supabase functions deploy mercadopago-webhook --no-verify-jwt
```

### 2. ✅ VERIFICAR SECRETS DO MERCADO PAGO

```bash
npx supabase secrets list
```

**Deve ter configurado:**
- `MERCADOPAGO_ACCESS_TOKEN` (token de produção/sandbox do MP)
- `MERCADOPAGO_NOTIFICATION_URL` (opcional)

**Se não tiver:**
```bash
npx supabase secrets set MERCADOPAGO_ACCESS_TOKEN="SEU_TOKEN_DO_MP_AQUI"
```

### 3. ✅ VERIFICAR SE PAGAMENTO FOI CRIADO NO BANCO

No Supabase Dashboard → SQL Editor:

```sql
-- Pagamentos das últimas 2 horas
SELECT 
  p.id as payment_id,
  p.external_id,
  p.status as payment_status,
  p.created_at,
  pi.status as intent_status,
  pi.asaas_payment_id as mp_payment_id
FROM payments p
LEFT JOIN pix_payment_intents pi ON p.intent_id = pi.id
WHERE p.created_at >= NOW() - INTERVAL '2 hours'
ORDER BY p.created_at DESC;
```

### 4. ✅ VERIFICAR LOGS DAS EDGE FUNCTIONS

Supabase Dashboard → Edge Functions → `mercadopago-create-pix` → **Logs**
- Deve mostrar chamadas recentes (status 200)
- Se mostrar 401, o problema é JWT (usar --no-verify-jwt no deploy)

### 5. ✅ TESTAR WEBHOOK MANUALMENTE

Supabase Dashboard → Edge Functions → `mercadopago-webhook` → **Logs**
- Deve mostrar chamadas do Mercado Pago quando o pagamento é aprovado
- **Se não aparece NENHUMA chamada = problema na URL do webhook**

### 6. ✅ VERIFICAR URL DO WEBHOOK NO MERCADO PAGO

A URL configurada no Mercado Pago deve ser:
```
https://jrzjcunipzdzkfwflkya.supabase.co/functions/v1/mercadopago-webhook
```

**Como verificar:**
1. Acesse o [painel do Mercado Pago](https://www.mercadopago.com.br/developers/panel)
2. Vá em **Webhooks** ou **Notificações**
3. Confirme se a URL está correta

### 7. ✅ VERIFICAR SE O POLLING ESTÁ FUNCIONANDO

Abra o console do navegador (F12) durante o pagamento Pix.
Deve aparecer logs de `checkPixPaymentStatus` a cada 3 segundos.

---

## 🎯 ORDEM DE PRIORIDADE PARA RESOLVER

### 1️⃣ **PRIMEIRO**: Deploy das funções
Se `npx supabase functions list` estiver vazio, esse é o problema principal.

### 2️⃣ **SEGUNDO**: Secrets do Mercado Pago
Sem o token, a função não consegue validar pagamentos.

### 3️⃣ **TERCEIRO**: URL do webhook
Se o webhook não for chamado, o pagamento nunca será confirmado.

---

## 🚀 RESOLUÇÃO RÁPIDA

Execute estes comandos na ordem:

```bash
# 1. Deploy das funções
npx supabase functions deploy mercadopago-create-pix --no-verify-jwt
npx supabase functions deploy mercadopago-webhook --no-verify-jwt

# 2. Configurar token (substitua pelo seu token real)
npx supabase secrets set MERCADOPAGO_ACCESS_TOKEN="TEST-123456789..."

# 3. Verificar se está tudo ok
npx supabase functions list
npx supabase secrets list
```

Depois teste um novo pagamento Pix.

---

## 📞 SE AINDA NÃO FUNCIONAR

Execute o diagnóstico completo acima e informe:
1. Resultado de `npx supabase functions list`
2. Resultado de `npx supabase secrets list` (sem mostrar o token)
3. Se aparecem logs em Edge Functions durante o pagamento
4. Se a URL do webhook está configurada no Mercado Pago