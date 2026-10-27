---
title: "Requisições capturadas"
description: "Registre as requisições brutas que chegam a uma fonte — headers, corpo e o que respondemos — para depurar a integração com um provedor."
publishedAt: 2026-10-19
updatedAt: 2026-10-22
kind: concept
---

# Requisições capturadas

Quando um provedor diz que enviou um webhook e nada chegou aos seus endpoints, as requisições capturadas mostram o que de fato chegou à sua [fonte](/docs/product-webhooks/sources): todos os headers, o corpo bruto, de onde veio e o que respondemos — incluindo as requisições que recusamos, que não deixam rastro em nenhum outro lugar.

## Ativar a captura {#enable}

A captura é por fonte e fica **desativada por padrão**, porque uma requisição capturada guarda o corpo bruto de um webhook real — no caso de um provedor de pagamentos, dados reais de clientes. Ative-a só na fonte que você está depurando, observe o que chega e desative-a de novo.

- No console: **Captured requests** mostra um interruptor para cada fonte no topo da página.
- Pela API: `PATCH /v1/sources/{id}` com `{"capture_enabled": true}`.

A partir daí, cada requisição para a URL de ingestão dessa fonte é registrada, aceita ou não.

## O que uma captura guarda {#contents}

| Campo | O que é |
|---|---|
| Método, caminho, query | A linha da requisição como foi recebida. |
| Headers | Brutos, na ordem de chegada, com duplicatas mantidas — um provedor que envia dois headers `Stripe-Signature` mostra os dois. Headers de credencial, como `Authorization` e `Cookie`, ficam ocultos; os headers de assinatura são mantidos, já que são eles que você está verificando. |
| Corpo | Os primeiros 64 KiB, exatamente como foram recebidos. Um corpo maior é marcado como *truncated*, e um corpo truncado não serve para verificar a assinatura de novo. |
| Origem | O endereço IP do remetente. |
| Resultado | `accepted`, ou o motivo da recusa (abaixo). |
| O que o remetente recebeu | O status que respondemos, que corresponde ao que o painel do provedor mostra. |
| Evento | Para uma requisição aceita, o evento em que ela se transformou. |

As repetições são agrupadas: o mesmo método, caminho e corpo chegando de novo aumenta o **times seen** da captura (o Stripe, sozinho, faz até oito retentativas) em vez de adicionar uma linha.

## Resultados {#outcomes}

| Resultado | O que o remetente recebeu | Significado |
|---|---|---|
| `accepted` | 202 | Verificada e publicada como evento. |
| `bad_signature` | 401 | A assinatura não confere com o segredo da fonte. |
| `not_json` | 400 | O corpo não é um objeto JSON. |
| `rate_limited` | 429 | Acima da taxa de publicação do workspace. |
| `over_quota` | 402 | O workspace já usou a sua franquia mensal de entregas. |
| `too_large` | 413 | O payload passa de 256 KiB. |
| `unknown_event_type` | 422 | O tipo não está registrado e a [política de tipos de evento](/docs/product-webhooks/event-types#policy) é Strict. |
| `invalid_payload` | 422 | O payload não passa no JSON Schema do tipo de evento. |
| `duplicate` | 409 | O id de evento do provedor já foi aceito com um corpo diferente. |

`bad_signature` costuma ser o primeiro achado: o segredo errado colado na fonte, ou um proxy na frente do seu provedor que reescreveu o corpo. Compare os headers capturados com o log de entregas do próprio provedor.

Algumas recusas não são registradas: uma requisição para uma fonte desconhecida ou desativada (não há fonte para guardá-la), uma acima do limite de 512 KiB por requisição e uma recusada pelo limite anti-inundação por fonte antes da verificação da assinatura. A [tabela de status em Fontes](/docs/product-webhooks/sources#responses) lista o que o remetente vê em cada caso.

## Por quanto tempo as capturas ficam guardadas {#retention}

Uma fonte guarda as suas 500 capturas mais recentes, e cada uma é excluída 7 dias depois da última vez em que foi vista. Exclua uma antes disso no console ou com `DELETE /v1/captures/{id}`.

## Leitura pela API {#api}

```bash
# The latest captures for one source, refusals only
curl -s "{{WEBHOOKS_BASE_URL}}/v1/captures?source_id=src_…&outcome=bad_signature" \
  -H "Authorization: Bearer $READ_KEY"

# One capture with its headers and body (base64, since a body may not be UTF-8)
curl -s {{WEBHOOKS_BASE_URL}}/v1/captures/cap_… \
  -H "Authorization: Bearer $READ_KEY"
```

A lista deixa os corpos de fora; busque uma captura pelo id para obter `headers_raw` e `body_base64`. Todas as operações de captura estão na [referência da API](/docs/reference/webhooks#ref-captured-requests).

## O que isto não é {#not}

As requisições capturadas não são um request bin que você cria e para o qual envia qualquer tráfego — elas registram só o que chega às suas próprias fontes. Para uma URL que registra qualquer requisição HTTP enviada a ela, use o [Request Bins](/docs/product-bins).

## Próximos passos {#next-steps}

- [Fontes](/docs/product-webhooks/sources) — crie a fonte e veja o que cada recusa significa.
- [Tipos de evento](/docs/product-webhooks/event-types) — por que uma requisição pode ser recusada como `unknown_event_type`.
- [Entregas e retentativas](/docs/product-webhooks/deliveries) — o que acontece em seguida com uma requisição aceita.
