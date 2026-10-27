---
title: "Política de versionamento"
description: "Como evoluímos a API sem quebrar seu código."
publishedAt: 2026-05-20
updatedAt: 2026-10-15
kind: concept
---

# Política de versionamento

A API da NimbusNexus está na **v1** e vai continuar na v1 indefinidamente. Mudanças incompatíveis não saem em cima da v1 — elas sairiam em uma nova versão (`v2` etc.), e a v1 continuaria funcionando sem mudanças. É a mesma postura de versionamento que o Stripe, a Twilio e a AWS adotam para suas APIs principais.

## O que é uma mudança incompatível {#breaking}

Qualquer coisa que possa fazer um código existente parar de funcionar:

- Remover um endpoint
- Remover um campo de uma resposta
- Remover um código de status das respostas possíveis de um endpoint
- Renomear um campo
- Mudar o tipo de um campo (por exemplo, `string` → `number`)
- Mudar o comportamento padrão de um endpoint existente
- Tornar a validação de requisições mais rígida (um corpo que era aceito passa a ser rejeitado)
- Adicionar um novo parâmetro de requisição obrigatório

Isso nunca acontece na `v1`. Ponto final.

> **Atualizado em 15 de outubro de 2026.** Antes do lançamento da v1, grafias de erro que já estavam sendo renomeadas, e algumas mudanças que vieram junto, entraram sem o período de 12 meses descrito abaixo. No Inboxes: `invalid_request`, o `unauthorized` que ele enviava para uma chave que não reconhece ou não consegue verificar, seu `error` genérico, o motivo `project` de `forbidden` e as chaves de `details` `max_inboxes`, `max_http_bins`, `monthly_messages`, `plan` e `inbox_id`. No Webhooks: `internal`, `unprocessable` e `plan_violation`, o `402` que ele enviava para `max_attempts` acima do teto do plano e o `409` do reenvio em lote (ambos agora um `422`), além do `details` e dos tipos de entrada de validação. Dois campos de resposta do Inboxes também foram removidos: `paid_plans_enabled` em `GET /v1/plan`, que àquela altura era `true` para todos os workspaces, e o `project_id` de uma caixa de entrada, que a API tinha deixado de definir. [Erros](/docs/errors#renames) mapeia cada mudança de erro. A partir do lançamento da v1, toda mudança segue esta página.

## O que é uma mudança aditiva {#additive}

Coisas que lançamos na `v1` sem aviso:

- Novos endpoints
- Novos parâmetros de requisição opcionais
- Novos campos nas respostas (você deve ignorar campos desconhecidos ao fazer o parsing)
- Novos códigos de erro (você deve tratar valores desconhecidos de `error.code` pela família do código de status)
- Novos tipos de evento de webhook
- Novos valores de enum (você deve tratar valores de enum desconhecidos como opacos)
- Novos códigos de status da família que o endpoint já retorna

Documentamos as mudanças aditivas no [changelog](/changelog), mas não as escondemos atrás de uma flag. O código existente continua funcionando; o código novo pode aderir a elas.

## Compatibilidade futura — como escrever código que sobrevive {#forward-compat}

Três regras:

**1. Ignore campos desconhecidos ao fazer o parsing.** Uma resposta ganhar um campo novo não deve ser um erro no seu cliente. A maioria das bibliotecas JSON já se comporta assim por padrão.

```ts
// Correct
const { id, name, state } = await res.json()

// Wrong (will reject responses with new fields)
const allowedKeys = ['id', 'name', 'state']
for (const k of Object.keys(json)) {
  if (!allowedKeys.includes(k)) throw new Error('unknown field')
}
```

**2. Trate enums desconhecidos como opacos.** Se você toma decisões com base em `state`, trate os valores conhecidos; para os desconhecidos, mostre a string bruta e não quebre.

```ts
switch (vm.state) {
  case 'running': return 'green'
  case 'stopped': return 'gray'
  case 'provisioning': return 'amber'
  default: return 'gray' // Don't throw, don't assume — we may add 'migrating'
}
```

**3. Decida com base em `error.code`, não em `status`.** Os códigos de status agrupam erros (`4xx` vs. `5xx`); `error.code` os distingue. Podemos adicionar novos códigos a códigos de status existentes; seu código deve cair em um caso padrão em vez de tratar códigos não reconhecidos como bugs fatais.

## Política de descontinuação {#deprecation}

Fazemos o possível para não precisar disso na v1. Se algum dia marcarmos um endpoint ou campo como descontinuado:

- O endpoint ou campo continua funcionando sem mudanças por **pelo menos 12 meses**
- Um header `Deprecation` é adicionado às respostas (RFC 9745)
- Um header `Sunset` traz a data de fim de vida
- O painel mostra o uso de endpoints descontinuados por projeto

Doze meses é bastante tempo. Na prática, nenhuma descontinuação aconteceu na v1 desde o lançamento — a evolução aditiva cobre a maioria das necessidades.

## Quando a v2 for lançada {#v2}

Se algum dia lançarmos a v2 (não pretendemos fazer isso tão cedo), a implantação seria assim:

- A v2 é lançada em `/v2/...` ao lado de `/v1/...` — as duas ficam no ar em paralelo
- A v1 continua recebendo correções de bugs e novas funcionalidades (aditivas) por pelo menos 24 meses
- A v2 tem uma URL base separada (`{{API_BASE_URL}}/v2/...`), para que a própria URL indique a versão

Você migraria quando estivesse pronto, não quando fosse obrigado. O caminho é começar a usar os endpoints `/v2` em código novo e migrar o código antigo no seu ritmo — não há um cutover com data marcada.

## Por que isso importa {#why}

Uma plataforma de nuvem cuja API quebra a cada dois anos não é uma infraestrutura confiável. O motivo de a v1 sobreviver à maioria dos outros contratos da plataforma: código de clientes, integrações de parceiros e distribuição de SDKs dependem todos de essa superfície ser estável. Quebrá-la sem aviso seria a forma mais rápida de perder a confiança.

Se algum dia você vir uma mudança incompatível de verdade na `v1` que não veio em uma nova versão: isso é um bug. Reporte-o ao suporte e nós o corrigiremos.

## Próximos passos {#next-steps}

- [Changelog](/changelog) — o registro contínuo das mudanças aditivas.
- [Autenticação](/docs/authentication) — a interface mais estável da API.
- [Convenções](/docs/conventions) — formato da requisição, códigos de status, famílias de erro.
