---
title: "Fontes"
description: "Receba webhooks do Stripe, do GitHub, do Clerk, do Resend ou de qualquer remetente que assine com HMAC e entregue-os aos seus endpoints como eventos."
publishedAt: 2026-10-19
updatedAt: 2026-10-28
kind: concept
---

# Fontes

Uma fonte é uma URL que você passa a um provedor — o Stripe, o GitHub, um remetente do Standard Webhooks como o Clerk ou o Resend, ou qualquer outro que assine os seus webhooks — para que ele possa enviar para nós. Verificamos a assinatura de cada requisição, transformamos a requisição em um evento e o entregamos aos seus endpoints exatamente como um evento que você [publicou por conta própria](/docs/product-webhooks/quickstart#publish): as mesmas inscrições, as mesmas retentativas, a mesma dead-letter queue.

Use uma fonte quando você quiser um só lugar para o tráfego de webhooks nas duas direções, ou quando quiser que vários dos seus serviços recebam os eventos de um provedor sem que cada um verifique a assinatura do Stripe por conta própria.

## Como uma requisição vira entregas {#flow}

1. O provedor faz um POST para a URL de ingestão da fonte, `{{WEBHOOKS_BASE_URL}}/v1/ingest/{source_id}`.
2. Verificamos a assinatura sobre os bytes exatos recebidos, com o segredo de assinatura da fonte.
3. O corpo precisa ser um objeto JSON. Lemos o tipo do evento nele (veja [Tipos de evento de uma fonte](#event-types)).
4. O evento é publicado no projeto da fonte e comparado com as inscrições dos seus endpoints, o que cria uma entrega por endpoint correspondente.
5. O provedor recebe `202`. Os seus endpoints recebem o evento assinado com o segredo *deles*, não com o do provedor.

A URL de ingestão é a única parte do Webhooks que aceita requisições sem chave de API: a assinatura do provedor é a credencial.

## Provedores e as suas assinaturas {#providers}

| Provedor | Header que verificamos | Bytes assinados | Janela de replay |
|---|---|---|---|
| `stripe` | `Stripe-Signature: t=…,v1=…` | `{t}.{body}` | 5 minutos |
| `github` | `X-Hub-Signature-256: sha256=…` | `{body}` | nenhuma (o GitHub não envia timestamp) |
| `generic` | `X-Webhook-Signature: sha256=…` com `X-Webhook-Timestamp` | `{timestamp}.{body}` | 5 minutos |
| `standardwebhooks` | `webhook-signature: v1,…` com `webhook-id` e `webhook-timestamp`, ou os mesmos três como `svix-*` | `{id}.{timestamp}.{body}` | 5 minutos |

Os quatro usam HMAC-SHA256. `generic` é o mesmo esquema com que assinamos as nossas próprias entregas, então o endpoint de um workspace do Webhooks pode alimentar a fonte de outro, e qualquer remetente que você controle pode assinar assim com poucas linhas. `standardwebhooks` é o esquema do [Standard Webhooks](https://www.standardwebhooks.com/), que todo remetente baseado no Svix usa, entre eles o Clerk e o Resend.

## Criar uma fonte {#create}

No console: **Sources → New source** (também na página Overview). Ou pela API:

```bash
curl -sX POST {{WEBHOOKS_BASE_URL}}/v1/sources \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{
        "provider": "stripe",
        "name": "Stripe live",
        "secret": "whsec_…",
        "event_type_prefix": "stripe."
      }'
```

- **Stripe, GitHub e Standard Webhooks**: cole o segredo de assinatura que o provedor mostra (para um remetente do Standard Webhooks, o valor `whsec_…` das configurações de webhook dele). Uma fonte criada sem segredo começa desativada; adicione o segredo depois com `rotate-secret` e ative-a.
- **Generic**: deixe `secret` de fora e nós geramos um, retornado uma vez nesta resposta.

A resposta traz `ingest_url`. Cole-a nas configurações de webhook do provedor e adicione um endpoint inscrito nos tipos que você espera (`prefix` `stripe.` no exemplo acima).

## Tipos de evento de uma fonte {#event-types}

Cada requisição precisa de um tipo de evento para que os endpoints possam se inscrever nele. Uma fonte o encontra nesta ordem:

1. Onde você mandou procurar: um **header** da requisição ou um **caminho JSON** com pontos no corpo (`data.object.type`).
2. Caso contrário, no lugar próprio do provedor: o `type` do corpo nas fontes Stripe, generic e Standard Webhooks, e o header `X-GitHub-Event` nas fontes GitHub.
3. Se nenhum dos dois der um valor: o **tipo padrão** da fonte e, na falta dele, `webhook.received`.

O **prefixo** da fonte vai na frente (`stripe.` + `invoice.paid` → `stripe.invoice.paid`), o que mantém separados os tipos de dois provedores em um mesmo projeto. Se a sua lista de tipos de evento mostra `webhook.received`, uma fonte recebeu requisições sem nenhum tipo que ela conseguisse ler: defina um tipo padrão ou um caminho JSON nessa fonte.

O próprio id de evento do provedor (o `evt_…` do Stripe, o id de entrega do GitHub, o header `webhook-id` do Standard Webhooks) é a chave de idempotência, então, quando um provedor repete um evento que já aceitamos, ele recebe `202` de novo e nada é entregue duas vezes.

## O que o provedor vê {#responses}

| Status | Quando |
|---|---|
| `202` | Aceita e publicada. |
| `400` | O corpo não é JSON, ou não é um objeto JSON. |
| `401` | A assinatura não foi verificada — ausente, malformada, com o segredo errado ou fora da janela de replay. Uma única resposta para todos esses casos, de propósito. |
| `402` | O workspace já usou a sua franquia mensal de entregas. |
| `404` | A fonte não existe ou está desativada. |
| `409` | O id de evento do provedor já foi aceito com um corpo diferente. |
| `413` | A requisição passa de 512 KiB, ou o payload passa de 256 KiB. |
| `422` | O tipo não está registrado e a [política de tipos de evento](/docs/product-webhooks/event-types#policy) é Strict, ou o payload não passa no JSON Schema do tipo. |
| `429` | Requisições demais: 600 por minuto por fonte antes da verificação da assinatura e, depois, a taxa de publicação do seu plano. |

Os provedores repetem a requisição em qualquer resposta que não seja 2xx, então uma recusa não se perde do lado deles — mas, para ver *por que* recusamos, ative a captura na fonte e leia as [Requisições capturadas](/docs/product-webhooks/captured-requests).

## Rotacionar um segredo {#rotate}

Quando o provedor trocar o segredo, envie o novo:

```bash
curl -sX POST {{WEBHOOKS_BASE_URL}}/v1/sources/src_…/rotate-secret \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"secret": "whsec_new…"}'
```

O segredo anterior continua valendo na verificação por 24 horas, então as requisições assinadas com qualquer um dos dois são aceitas enquanto o provedor faz a troca. Para uma fonte generic, envie um corpo vazio e nós geramos o novo segredo.

## Próximos passos {#next-steps}

- [Requisições capturadas](/docs/product-webhooks/captured-requests) — veja as requisições brutas que uma fonte recebeu, incluindo as recusas.
- [Fontes na referência da API](/docs/reference/webhooks#ref-sources) — todas as operações de fonte, com as chamadas do SDK e da CLI.
- [Tipos de evento](/docs/product-webhooks/event-types) — o catálogo de tipos e o que acontece com um tipo desconhecido.
- [Entregas e retentativas](/docs/product-webhooks/deliveries) — o que acontece depois que um evento é publicado.
- [Visão geral de Webhooks](/docs/product-webhooks) — os objetos e como eles se encaixam.
