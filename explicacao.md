# Explicação para testes — DezAqui (Indicação vs. cambista)

Este documento serve para **validar em ambiente de homologação** se o comportamento atual atende ao que combinámos. Pode partilhá-lo com equipa interna ou com quem for testar a plataforma.

---

## Antes de começar

- Ter **URL de testes** (ou ambiente local, se for o caso) já actualizado com a última versão da aplicação.
- Ter **migrações da base de dados** aplicadas até à versão que inclui o programa «Indique e Ganhe» separado da lógica de **cambistas** (vendedores com comissão).
- Dispor de pelo menos:
  - uma conta **administrador**;
  - uma conta de **cliente normal** (para indicação);
  - uma conta de **cambista** (`is_seller`), se quiser testar comissões.

---

## O que deve ficar claro no produto

| Perfil | Comportamento esperado |
|--------|-------------------------|
| **Cliente indicador** | Participa do programa **«Indique e Ganhe»** (metas por bolão, recompensa configurável no formulário do concurso: jogo grátis ou bónus Pix manual). **Não** tem fluxo de «carteira» nem comissão de cambista. |
| **Cambista** | **Não** usa «Indique e Ganhe». Só entra **comissão percentual** após venda paga, conforme percentual do perfil e, se existir, **substituição por bolão** no concurso. |
| **Administrador** | Concursos com campos separados para meta de indicação / tipo de prémio e, quando aplicável, **% de comissão específica do bolão**; área de parceiros para acompanhar indicadores, cambistas, bónus Pix e comissões. |

---

## Roteiro sugerido de testes

### 1. Concurso (admin)

1. Criar ou editar um bolão e preencher a secção **«Indique e Ganhe»** (meta de vendas, tipo de recompensa, valor se for Pix manual, quando existir).
2. Se usar cambistas nesse bolão, definir **percentual de comissão no bolão** (override), se fizer sentido para o teste.
3. Guardar e confirmar que os dados aparecem ao reabrir o formulário.

### 2. Cliente — link com `?ref=`

1. Entrar com um **cliente que não é cambista**, abrir **«Indique e Ganhe»** (ou equivalente no menu) e copiar o **link com `?ref=`**.
2. Noutro dispositivo ou em navegação privada, abrir o link, escolher números e **pagar** (ou simular fluxo até pagamento confirmado, conforme o vosso ambiente).
3. Confirmar que a venda entra na lógica de **metas** / prémios de indicação **apenas** para quem não é cambista.

### 3. Cambista — «Meu link de venda»

1. Entrar com conta **cambista** e abrir **«Área do vendedor — Meu link»**.
2. Verificar que o texto deixa explícito: **sem** «Indique e Ganhe» de cliente; **comissão** após pgto confirmado.
3. Gerar partilha (WhatsApp/Telegram) e testar uma venda; confirmar que surge **comissão pendente** onde o admin consulta cambistas (não o fluxo de metas de cliente).

### 4. Painel administrativo — parceiros / financeiro

1. Rever listagens que separam **indicadores** de **cambistas**, quando existir.
2. Para **bónus Pix manual** de indicação: confirmar estados (pendente / pago) e que o admin pode registar nota ou data de pagamento, conforme implementado.
3. Para **comissões de cambista**: confirmar marcação de pago / notas, conforme o vosso processo.

---

## Bilhete bonificado — **opcional e só para si (administração)**

A opção de **criar um bilhete bonificado** (participação sem cobrança normal ao utilizador final, criada pelo painel administrativo — por exemplo em **Parceiros** / área afim) existe como **ferramenta de apoio**.

- **Não é obrigatório** usar no dia-a-dia.
- **Quem decide** se recorre a ela é **a vossa equipa / administrador**, consoante política interna (cortesias, correcções pontuais, testes controlados, etc.).
- Os participantes **não** têm no site um botão «quero bilhete bonificado»; isso continua a ser **exclusivo do backoffice** que vocês controlam.

Se não quiserem usar esta funcionalidade, **podem simplesmente ignorá-la**; o restante fluxo (Pix, indicação, cambista, sorteios) não depende dela.

---

## Sair satisfeito com o teste

Considerem o pacote **alinhado com a vossa necessidade** se:

- a separação **indicação (cliente)** vs **comissão (cambista)** estiver clara para utilizadores e no admin;
- as regras do **bolão** (metas, tipos de prémio, % do cambista no bolão) baterem certo com o que configuraram;
- o **menu / partilha** e o fluxo de **pagamento** forem aceitáveis na vossa rotina operacional.

Qualquer diferença face ao esperado convém anotar **ecrã, utilizador usado, bolão e passos** — facilita o ajuste fino.

---

*Documento orientativo para validação com o cliente. Não substitui contrato nem documentação técnica interna.*
