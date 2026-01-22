# Migrações do Banco de Dados

Este diretório contém as migrações SQL do banco de dados PostgreSQL (Supabase).

## Ordem de Aplicação (Obrigatória)

As migrações devem ser aplicadas nesta ordem exata:

1. **`001_init.sql`** - Estrutura inicial do banco (FASE 1)
   - Cria todas as tabelas: profiles, contests, participations, draws, payments

2. **`002_rls_profiles.sql`** - Row Level Security para tabela profiles (FASE 2)

3. **`003_rls_contests.sql`** - Row Level Security para tabela contests (FASE 2)

4. **`004_rls_draws.sql`** - Row Level Security para tabela draws (FASE 2)

5. **`005_rls_payments.sql`** - Row Level Security para tabela payments (FASE 2)

6. **`006_rls_participations.sql`** - Row Level Security para tabela participations (FASE 2)

## Migrações Opcionais

- **`002_auth_profiles_trigger.sql`** - Sincronização automática Auth -> Profiles (FASE 1)
  - ⚠️ **Opcional**: Pode falhar por permissões em `auth.users` dependendo da configuração do Supabase
  - Se falhar, você pode criar perfis manualmente ou ajustar permissões


## Aplicação das Migrações

### Via Supabase Dashboard

1. Acesse o Supabase Dashboard
2. Vá em SQL Editor
3. Execute cada arquivo de migração em ordem

### Via Supabase CLI

```bash
supabase db push
```

## Importante

- **Nunca modifique migrações já aplicadas** em produção
- Crie novas migrações para alterações
- Teste sempre em ambiente de desenvolvimento primeiro
- Faça backup antes de aplicar migrações em produção
