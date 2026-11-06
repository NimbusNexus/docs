---
title: "Limites de requisições"
description: "O que cada API limita, os headers e erros com que um limite responde e a estratégia de backoff correta."
publishedAt: 2026-05-20
updatedAt: 2026-11-06
kind: concept
---

# Limites de requisições

A API de infraestrutura limita quantas requisições recebe por minuto. As APIs dos apps limitam ações específicas, como publicar um evento. Nos dois casos, uma requisição acima de um limite recebe `429`, geralmente com um header `Retry-After` que diz quantos segundos esperar.

## A API de infraestrutura {#defaults}

Toda requisição a `{{API_HOST}}` conta para o orçamento do minuto:

| Quem chama | Requisições por minuto | Contadas por |
|---|---|---|
| Uma sessão conectada (`Authorization: Bearer` ou o cookie da sessão) | 120 | Usuário |
| Uma chave de API, ou nenhuma credencial | 60 | Endereço IP |

Uma chave de API não tem um orçamento próprio. As chaves usadas a partir de um endereço compartilham as 60 requisições por minuto dele, junto com qualquer outra coisa que faça chamadas de lá. `GET /api/v1/notifications/list` tem um limite menor, de 30 por minuto, medido sobre a mesma contagem.

O minuto começa na sua primeira requisição e não é uma janela móvel: quando ele termina, a contagem recomeça do zero.

## Headers de resposta {#headers}

As respostas da API de infraestrutura trazem o limite aplicado e quanto resta dele:

```http
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 59
```

Acima do limite, a resposta é `429`, com `X-RateLimit-Remaining: 0` e um header `Retry-After`, em segundos, com o que resta do minuto:

```json
{
  "success": false,
  "message": "Too many requests. Please try again later."
}
```

## As APIs dos apps {#apps}

As APIs dos apps não enviam headers `X-RateLimit` e não limitam todas as requisições. O que limitam, elas recusam com `429` `rate_limited`, como [Erros](/docs/errors#codes-rate) descreve:

- **Webhooks:** a publicação (`POST /v1/events`) segue a taxa de publicação do seu plano, por workspace. Os reenvios de entregas e eventos (`POST /v1/deliveries/{delivery_id}/redeliver`, `POST /v1/deliveries/redeliver`, `POST /v1/deliveries/replay` e `POST /v1/events/{event_id}/replay`) seguem a mesma taxa, com uma contagem própria. Os eventos recebidos em `POST /v1/ingest/{source_id}` são limitados a 600 por minuto por fonte e, depois, à taxa de publicação do seu plano ([O que o provedor vê](/docs/product-webhooks/sources#responses)). Os salvamentos e testes de scripts são limitados a 60 por minuto por workspace ([Transformações](/docs/product-webhooks/transformations#errors)).
- **Inboxes:** cada caixa de entrada aceita e-mails até um limite por minuto definido pelo seu plano ([Limites por plano](/docs/product-inboxes#limits)).
- **Request Bins:** um bin pode enviar 10 testes de encaminhamento por minuto ([Testar uma URL de encaminhamento](/docs/product-bins/reference#forward-test)). A URL de um bin aceita 120 requisições por minuto de um mesmo remetente e 600 por minuto no total ([O que a URL de um bin responde](/docs/product-bins/reference#edge-answers)).
- **Transforms:** as execuções e os testes compartilham o limite de execuções por minuto do seu plano, por workspace ([Planos e limites](/docs/product-transforms/reference#limits)).
- **Códigos QR:** um workspace pode enviar 10 testes de webhook por minuto.

## Estratégia de backoff {#backoff}

O padrão certo quando você recebe um `429`:

```ts
async function callWithBackoff(fn: () => Promise<Response>) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fn()
    if (res.status !== 429) return res

    const retryAfter = Number(res.headers.get('Retry-After') ?? '1')
    // Jitter prevents the thundering-herd problem if many clients
    // hit the limit at the same moment and all retry exactly together
    const jitter = Math.random() * 0.5 * retryAfter
    await new Promise(r => setTimeout(r, (retryAfter + jitter) * 1000))
  }
  throw new Error('Rate limit exceeded after 5 retries')
}
```

Duas observações:

- **Sempre respeite o `Retry-After`.** Não tente de novo antes: você só vai receber outro `429`.
- **Adicione jitter** se você chama a API de vários workers. Sem jitter, todos eles tentam de novo no mesmo instante e batem no limite outra vez, todos juntos.

## O que conta como requisição {#counted}

Na API de infraestrutura, toda chamada HTTP conta, incluindo:

- `GET`s, como `GET /api/v1/instance/`
- Cada página de uma [lista paginada](/docs/pagination) e cada polling enquanto você espera uma VM chegar a `ACTIVE`
- Chamadas que falham, como um `401`, e os próprios `429`s

Para ficar abaixo do limite a partir de um endereço, distribua o trabalho: faça polling com menos frequência e não liste o que você poderia ler uma vez e guardar.

## Aumentar seus limites {#raising}

Nenhuma chamada de API nem configuração de plano aumenta esses limites. Se o seu atrapalhar uma carga de trabalho real, [entre em contato com o suporte]({{BASE_URL}}/contact/support).

## Próximos passos {#next-steps}

- [Convenções](/docs/conventions) — formato da requisição, códigos de status e os padrões mais amplos da API.
- [Idempotência](/docs/idempotency) — como repetir uma gravação com segurança.
- [Cotas](/docs/api/quotas) — os limites de *recursos* (VMs, vCPU, armazenamento), diferentes dos limites de requisições.
