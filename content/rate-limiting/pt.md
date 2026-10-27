---
title: "Limites de requisições"
description: "Orçamentos de requisições por chave, os headers que retornamos e a estratégia de backoff correta."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: concept
---

# Limites de requisições

Toda chave de API recebe um orçamento de requisições por segundo e por hora. Os limites protegem tanto você quanto a nós — eles impedem que um loop descontrolado queime seu cartão de crédito e que um único tenant sature uma região.

## Os valores padrão {#defaults}

| Plano | Por segundo | Por hora |
|---|---|---|
| Free | 5 | 1.000 |
| Starter | 25 | 10.000 |
| Production | 100 | 100.000 |
| Enterprise | Sob medida | Sob medida |

Eles valem por **chave de API**, não por projeto — se você tem três chaves em um projeto, cada uma recebe seu próprio orçamento. A maioria dos times nunca chega perto do limite do plano Production; se você chegar, o quadro "rate limit usage" do painel mostra os pontos de chamada que consomem a cota mais rápido.

## Como a limitação funciona {#mechanics}

Um token bucket em cada chave. O bucket se reabastece na taxa por segundo; o tamanho do bucket é definido para que uma rajada breve que esgote o orçamento se recupere em ~10 segundos. O limite por hora é um teto rígido — depois que você o atinge, nenhuma requisição dá certo até que a janela móvel de uma hora avance.

Os limites são avaliados no gateway, antes que a requisição chegue ao handler do recurso. Uma requisição barrada pelo limite de requisições nunca toca nos recursos do seu projeto, então nunca custa nada além da entrada de log da requisição que falhou.

## Headers de resposta {#headers}

Toda resposta da API traz quatro headers que descrevem seu orçamento atual:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1763410812
X-RateLimit-Window: 1
```

- `X-RateLimit-Limit` — orçamento total da janela atual
- `X-RateLimit-Remaining` — requisições restantes
- `X-RateLimit-Reset` — epoch Unix em que o orçamento se reabastece (ou em que a janela de uma hora avança)
- `X-RateLimit-Window` — `1` para o orçamento por segundo, `3600` para o por hora. Mostramos o orçamento que você está mais perto de esgotar

Quando `Remaining` chega a zero, a próxima requisição retorna `429 Too Many Requests` com um header `Retry-After` (em segundos) que diz quando tentar de novo.

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

- **Sempre respeite o `Retry-After`.** Não tente de novo antes — você só vai bater no limite outra vez e queimar seu orçamento mais rápido.
- **Adicione jitter** se você chama a API de vários workers. Sem jitter, todos os seus workers tentam de novo no mesmo instante e batem no limite outra vez, todos juntos.

## O que conta como requisição {#counted}

Toda chamada HTTP à API conta como uma requisição, incluindo:

- `GET`s (sim, até `GET /v1/regions`)
- Chamadas de paginação (cada página é uma requisição)
- Retentativas idempotentes (o acerto de cache ainda conta como uma requisição — mas é barato, e a deduplicação faz com que você não pague duas vezes pela operação subjacente)

O que **não** conta:

- Arquivos estáticos servidos pelo site de marketing (CDN, não a API)
- Entregas de webhooks para o seu lado (quem as envia somos nós, não você)
- Tentativas de conexão que falharam (sem entrada de log no gateway)

## Aumentar seus limites {#raising}

Os planos Starter e Production costumam ser generosos o bastante; menos de 5% das contas chegam ao teto por hora. Se você chegar, o caminho é o formulário de contato do suporte, não a API — o mesmo dos [aumentos de cota](/docs/api/quotas). Migrações de produção recebem resposta no mesmo dia.

Se você está batendo nos limites por segundo, mas não no por hora, normalmente não precisa de um aumento — precisa distribuir a carga (agrupar requisições em lotes, usar `Idempotency-Key` para deduplicar retentativas, paginar com tamanhos de página razoáveis). O quadro "rate limit usage" no painel mostra quais endpoints estão com picos.

## Próximos passos {#next-steps}

- [Convenções](/docs/conventions) — formato da requisição, códigos de status e os padrões mais amplos da API.
- [Idempotência](/docs/idempotency) — padrão de retentativa segura quando falhas de rede parecem limites de requisições.
- [Cotas](/docs/api/quotas) — os limites de *recursos* (VMs, vCPU, armazenamento), diferentes dos limites de requisições.
