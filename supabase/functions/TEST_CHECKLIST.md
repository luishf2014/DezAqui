# ✅ Checklist de Testes - Edge Functions Asaas

## 🧪 Testes Locais (Desenvolvimento)

### Pré-requisitos

- [ ] Supabase CLI instalado e configurado
- [ ] Projeto Supabase inicializado (`supabase init`)
- [ ] Secrets configurados localmente
- [ ] Conta Asaas (sandbox ou produção) configurada
- [ ] Frontend rodando localmente

### 1. Configuração Inicial

#### 1.1 Configurar Secrets Locais

```bash
# Verificar secrets existentes
supabase secrets list

# Configurar secrets necessários
supabase secrets set ASAAS_API_KEY=your_sandbox_api_key
supabase secrets set ASAAS_BASE_URL=https://sandbox.asaas.com/api/v3
supabase secrets set ASAAS_WEBHOOK_TOKEN=your_webhook_token_here
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

#### 1.2 Verificar Variáveis de Ambiente do Supabase

```bash
# O Supabase fornece automaticamente:
# - SUPABASE_URL (ou SUPABASE_PROJECT_URL)
# - SUPABASE_ANON_KEY (pode precisar configurar manualmente)
```

### 2. Deploy Local das Edge Functions

```bash
# Deploy da função de criação de pagamento
supabase functions deploy asaas-create-pix

# Deploy da função de webhook
supabase functions deploy asaas-webhook

# Verificar se foram deployadas
supabase functions list
```

### 3. Testes da Edge Function `asaas-create-pix`

#### 3.1 Teste Manual via cURL

```bash
# Obter token JWT do usuário (do frontend ou via login)
TOKEN="seu_jwt_token_aqui"

# Testar criação de pagamento
curl -X POST \
  http://localhost:54321/functions/v1/asaas-create-pix \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "participationId": "uuid-da-participacao",
    "ticketCode": "TK-ABC123",
    "amount": 10.00,
    "description": "Teste de pagamento",
    "customerName": "João Silva",
    "customerEmail": "joao@example.com",
    "customerPhone": "11999999999"
  }'
```

#### 3.2 Cenários de Teste

- [ ] **Teste 1: Criação bem-sucedida**
  - Criar participação no banco
  - Chamar Edge Function com dados válidos
  - Verificar retorno com QR Code e ID do pagamento
  - Verificar que payment foi criado no banco com `status='pending'`

- [ ] **Teste 2: Usuário não autenticado**
  - Chamar sem token Authorization
  - Verificar erro 401

- [ ] **Teste 3: Participação não pertence ao usuário**
  - Criar participação de outro usuário
  - Tentar criar pagamento para essa participação
  - Verificar erro 403

- [ ] **Teste 4: Dados inválidos**
  - Chamar com `amount <= 0`
  - Chamar sem campos obrigatórios
  - Verificar erro 400

- [ ] **Teste 5: Participação não encontrada**
  - Chamar com `participationId` inexistente
  - Verificar erro 404

- [ ] **Teste 6: Erro na API do Asaas**
  - Usar API key inválida
  - Verificar tratamento de erro adequado

### 4. Testes da Edge Function `asaas-webhook`

#### 4.1 Configurar Webhook Local (usando ngrok ou similar)

```bash
# Expor webhook local via ngrok
ngrok http 54321

# URL gerada: https://xxxxx.ngrok.io/functions/v1/asaas-webhook
# Configurar esta URL no painel do Asaas (sandbox)
```

#### 4.2 Teste Manual via cURL

```bash
# Simular webhook do Asaas
curl -X POST \
  http://localhost:54321/functions/v1/asaas-webhook \
  -H "X-Webhook-Token: your_webhook_token_here" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "PAYMENT_CONFIRMED",
    "payment": {
      "id": "pay_123456789",
      "status": "CONFIRMED",
      "paymentDate": "2025-01-24T10:30:00Z",
      "externalReference": "TK-ABC123",
      "value": 10.00
    }
  }'
```

#### 4.3 Cenários de Teste

- [ ] **Teste 1: Webhook bem-sucedido**
  - Criar payment no banco com `status='pending'` e `external_id`
  - Enviar webhook com status `CONFIRMED`
  - Verificar que payment foi atualizado para `status='paid'` e `paid_at` preenchido
  - Verificar que participation foi ativada (`status='active'`)

- [ ] **Teste 2: Token inválido**
  - Enviar webhook sem token ou com token errado
  - Verificar erro 401

- [ ] **Teste 3: Idempotência**
  - Enviar webhook para payment já com `status='paid'`
  - Verificar que não duplica processamento (retorna 200 com mensagem)

- [ ] **Teste 4: Payment não encontrado**
  - Enviar webhook com `external_id` inexistente
  - Verificar retorno 200 (para não ficar reentregando) mas com log de warning

- [ ] **Teste 5: Evento ignorado**
  - Enviar webhook com status diferente de `CONFIRMED` ou `RECEIVED`
  - Verificar que retorna 200 mas não processa

- [ ] **Teste 6: Fallback por ticket_code**
  - Criar payment sem `external_id` preenchido
  - Enviar webhook com `externalReference` (ticket_code)
  - Verificar que encontra payment e atualiza `external_id`

### 5. Testes de Integração Frontend

#### 5.1 Fluxo Completo de Pagamento

- [ ] **Teste 1: Fluxo completo**
  1. Usuário seleciona números no checkout
  2. Clica em "Gerar QR Code Pix"
  3. Verificar que `createPixPayment()` é chamado
  4. Verificar que Edge Function é invocada
  5. Verificar que QR Code é exibido
  6. Verificar que payment é criado no banco com `status='pending'`
  7. Simular pagamento no Asaas (sandbox)
  8. Verificar que webhook é recebido
  9. Verificar que payment é atualizado para `status='paid'`
  10. Verificar que participation é ativada

- [ ] **Teste 2: Aplicação de desconto**
  - Aplicar código de desconto no checkout
  - Verificar que valor final é calculado corretamente
  - Verificar que pagamento é criado com valor descontado

- [ ] **Teste 3: Erro na criação de pagamento**
  - Simular erro na Edge Function
  - Verificar que erro é exibido ao usuário
  - Verificar que payment não é criado no banco

## 🚀 Testes de Homologação (Staging/Produção)

### Pré-requisitos

- [ ] Ambiente de staging/produção configurado no Supabase
- [ ] Secrets configurados no ambiente de produção
- [ ] Webhook configurado no painel do Asaas (produção)
- [ ] Acesso ao dashboard do Supabase para ver logs

### 1. Configuração de Produção

#### 1.1 Configurar Secrets em Produção

```bash
# Conectar ao projeto de produção
supabase link --project-ref your-project-ref

# Configurar secrets
supabase secrets set ASAAS_API_KEY=your_production_api_key --project-ref your-project-ref
supabase secrets set ASAAS_BASE_URL=https://api.asaas.com/v3 --project-ref your-project-ref
supabase secrets set ASAAS_WEBHOOK_TOKEN=your_production_webhook_token --project-ref your-project-ref
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_production_service_role_key --project-ref your-project-ref
```

#### 1.2 Deploy em Produção

```bash
# Deploy das functions
supabase functions deploy asaas-create-pix --project-ref your-project-ref
supabase functions deploy asaas-webhook --project-ref your-project-ref
```

#### 1.3 Configurar Webhook no Asaas (Produção)

1. Acesse: Configurações > Webhooks
2. URL: `https://your-project-ref.supabase.co/functions/v1/asaas-webhook`
3. Header: `X-Webhook-Token` = valor de `ASAAS_WEBHOOK_TOKEN`
4. Eventos: `PAYMENT_CONFIRMED`, `PAYMENT_RECEIVED`

### 2. Testes de Produção

#### 2.1 Teste End-to-End Real

- [ ] **Teste 1: Pagamento real (valor mínimo)**
  1. Criar participação real no sistema
  2. Gerar QR Code Pix
  3. Realizar pagamento real via app do banco
  4. Aguardar confirmação (pode levar alguns minutos)
  5. Verificar logs da Edge Function no dashboard
  6. Verificar que payment foi atualizado
  7. Verificar que participation foi ativada

- [ ] **Teste 2: Múltiplos pagamentos simultâneos**
  - Criar 3-5 participações diferentes
  - Gerar QR Codes para todas
  - Realizar pagamentos em sequência
  - Verificar que todos são processados corretamente

- [ ] **Teste 3: Webhook duplicado**
  - Após pagamento confirmado, simular reenvio do webhook
  - Verificar idempotência (não duplica processamento)

#### 2.2 Monitoramento

- [ ] Verificar logs das Edge Functions no dashboard do Supabase
- [ ] Verificar métricas de performance
- [ ] Verificar se há erros recorrentes
- [ ] Verificar tempo de resposta das functions

### 3. Validações de Segurança

- [ ] **Teste 1: Tentativa de acesso sem autenticação**
  - Tentar chamar `asaas-create-pix` sem token
  - Verificar erro 401

- [ ] **Teste 2: Tentativa de acesso com token inválido**
  - Tentar chamar `asaas-create-pix` com token expirado/inválido
  - Verificar erro 401

- [ ] **Teste 3: Tentativa de webhook sem token**
  - Enviar webhook sem header `X-Webhook-Token`
  - Verificar erro 401

- [ ] **Teste 4: Tentativa de webhook com token errado**
  - Enviar webhook com token incorreto
  - Verificar erro 401

- [ ] **Teste 5: Verificar que ASAAS_API_KEY não está exposta**
  - Inspecionar código do frontend (bundle)
  - Verificar que não há referências a `VITE_ASAAS_API_KEY`
  - Verificar que não há chamadas diretas à API do Asaas

## 📊 Checklist de Validação Final

### Funcionalidades

- [ ] Criação de pagamento PIX funciona corretamente
- [ ] QR Code é gerado e exibido corretamente
- [ ] Payment é criado no banco com dados corretos
- [ ] Webhook recebe e processa confirmações
- [ ] Payment é atualizado corretamente após confirmação
- [ ] Participation é ativada automaticamente
- [ ] Idempotência funciona (não duplica processamento)
- [ ] Descontos são aplicados corretamente no valor do pagamento

### Segurança

- [ ] ASAAS_API_KEY nunca exposta no frontend
- [ ] Autenticação do usuário validada na Edge Function
- [ ] Ownership da participação validada
- [ ] Token do webhook validado
- [ ] Service Role usado apenas no webhook
- [ ] Logs não contêm dados sensíveis

### Performance

- [ ] Tempo de resposta da criação de pagamento < 3s
- [ ] Tempo de processamento do webhook < 1s
- [ ] Sem memory leaks ou problemas de performance

### Tratamento de Erros

- [ ] Erros são tratados adequadamente
- [ ] Mensagens de erro são claras para o usuário
- [ ] Logs de erro são úteis para debugging
- [ ] Sistema não quebra com erros inesperados

## 🐛 Troubleshooting

### Problemas Comuns

1. **Erro: "ASAAS_API_KEY não configurado"**
   - Solução: Verificar se secret foi configurado e fazer deploy novamente

2. **Webhook não está sendo chamado**
   - Solução: Verificar URL no painel do Asaas e logs do Supabase

3. **Payment não está sendo atualizado**
   - Solução: Verificar se `external_id` corresponde ao ID do Asaas

4. **CORS errors no frontend**
   - Solução: Verificar headers CORS na Edge Function

5. **Erro 401 ao chamar Edge Function**
   - Solução: Verificar se token JWT está sendo enviado corretamente

## 📝 Notas Finais

- Sempre teste em ambiente de staging antes de produção
- Monitore logs após deploy em produção
- Mantenha backups dos secrets em local seguro
- Documente qualquer configuração específica do ambiente
