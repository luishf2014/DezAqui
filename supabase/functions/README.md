# Edge Functions - Configuração e Deploy

## 📋 Visão Geral

Este diretório contém as Edge Functions do Supabase para integração segura com a API Asaas:

- **`asaas-create-pix`**: Cria pagamentos PIX no Asaas via Edge Function (seguro, sem expor API key no frontend)
- **`asaas-webhook`**: Recebe webhooks do Asaas e processa confirmações de pagamento automaticamente

## 🔐 Secrets Necessários

### Para `asaas-create-pix`:
- **`ASAAS_API_KEY`** (obrigatório): Chave de API do Asaas
- **`ASAAS_BASE_URL`** (opcional): URL base da API do Asaas
  - Padrão: `https://sandbox.asaas.com/api/v3` (sandbox)
  - Produção: `https://api.asaas.com/v3`
- **`SUPABASE_URL`** (geralmente já configurado): URL do projeto Supabase
- **`SUPABASE_ANON_KEY`** (geralmente já configurado): Chave anônima do Supabase

### Para `asaas-webhook`:
- **`ASAAS_WEBHOOK_TOKEN`** (obrigatório): Token compartilhado para validar webhooks do Asaas
- **`SUPABASE_URL`** (geralmente já configurado): URL do projeto Supabase
- **`SUPABASE_SERVICE_ROLE_KEY`** (obrigatório): Chave de service role para bypass RLS

## ⚙️ Como Configurar Secrets

Use o comando `supabase secrets set` para configurar cada secret:

```bash
# Secrets para asaas-create-pix
supabase secrets set ASAAS_API_KEY=your_asaas_api_key_here
supabase secrets set ASAAS_BASE_URL=https://api.asaas.com/v3  # Opcional, padrão é sandbox

# Secrets para asaas-webhook
supabase secrets set ASAAS_WEBHOOK_TOKEN=your_webhook_token_here
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Secrets compartilhados (geralmente já configurados automaticamente pelo Supabase)
# Se necessário configurar manualmente:
supabase secrets set SUPABASE_URL=https://your-project.supabase.co
supabase secrets set SUPABASE_ANON_KEY=your_anon_key_here
```

## 🚀 Deploy das Edge Functions

### Deploy Individual

```bash
# Deploy da função de criação de pagamento
supabase functions deploy asaas-create-pix

# Deploy da função de webhook
supabase functions deploy asaas-webhook
```

### Deploy de Todas as Functions

```bash
supabase functions deploy
```

## 🔗 Configuração do Webhook no Asaas

Para o webhook funcionar corretamente, configure no painel do Asaas:

1. **Acesse**: Configurações > Webhooks (ou Integrações > Webhooks)
2. **Adicione nova URL de webhook**:
   ```
   https://<PROJECT_REF>.supabase.co/functions/v1/asaas-webhook
   ```
   Substitua `<PROJECT_REF>` pelo identificador do seu projeto Supabase.

3. **Configure o header de autenticação**:
   - **Nome do header**: `X-Webhook-Token`
   - **Valor**: O mesmo valor configurado em `ASAAS_WEBHOOK_TOKEN` nos secrets do Supabase

4. **Selecione os eventos**:
   - ✅ `PAYMENT_CONFIRMED` (Pagamento Confirmado)
   - ✅ `PAYMENT_RECEIVED` (Pagamento Recebido)

5. **Salve a configuração**

### Exemplo de URL do Webhook

```
https://abcdefghijklmnop.supabase.co/functions/v1/asaas-webhook
```

Onde `abcdefghijklmnop` é o PROJECT_REF do seu projeto Supabase (encontrado na URL do dashboard).

## ✅ Verificação de Secrets

Para verificar se os secrets estão configurados:

```bash
supabase secrets list
```

## 🔒 Segurança

### Regras Importantes:

- ✅ **NUNCA** commite secrets no código
- ✅ **NUNCA** exponha `ASAAS_API_KEY` ou `SUPABASE_SERVICE_ROLE_KEY` no frontend
- ✅ Use diferentes tokens para desenvolvimento e produção
- ✅ Rotacione tokens periodicamente
- ✅ Valide sempre o token do webhook antes de processar
- ✅ Use Service Role apenas no webhook (nunca no frontend)

### Validações Implementadas:

- **asaas-create-pix**: Valida autenticação do usuário e ownership da participação
- **asaas-webhook**: Valida token do webhook antes de processar
- Ambas as functions são idempotentes (não duplicam processamento)

## 📝 Fluxo Completo

1. **Frontend** chama `createPixPayment()` → invoca `asaas-create-pix`
2. **Edge Function** cria pagamento no Asaas e retorna QR Code
3. **Frontend** grava payment no banco com `status='pending'` e `external_id`
4. **Usuário** paga via Pix
5. **Asaas** envia webhook → `asaas-webhook`
6. **Edge Function** atualiza payment (`status='paid'`) e ativa participation (`status='active'`)

## 🐛 Troubleshooting

### Erro: "ASAAS_API_KEY não configurado"
- Verifique se o secret foi configurado: `supabase secrets list`
- Certifique-se de fazer deploy após configurar secrets

### Erro: "Token de webhook inválido"
- Verifique se `ASAAS_WEBHOOK_TOKEN` está configurado corretamente
- Confirme que o header `X-Webhook-Token` está configurado no Asaas com o mesmo valor

### Webhook não está sendo chamado
- Verifique a URL do webhook no painel do Asaas
- Confirme que os eventos estão selecionados corretamente
- Verifique os logs da Edge Function no dashboard do Supabase

### Pagamento não está sendo atualizado
- Verifique se o `external_id` do payment corresponde ao `id` do pagamento no Asaas
- Confirme que o webhook está sendo recebido (ver logs)
- Verifique se o payment já não está com `status='paid'` (idempotência)
