---
title: "Verificação de endpoint"
description: "Comprove que um endpoint quer os seus eventos antes que ele receba algum — um desafio assinado de uso único que ele precisa devolver."
publishedAt: 2026-10-19
updatedAt: 2026-10-28
kind: concept
---

# Verificação de endpoint

A verificação comprova que a URL por trás de um endpoint é sua e está pronta para receber webhooks. Enviamos a ela um único desafio assinado; ela passa ao devolver o desafio. Até passar, um workspace que exige verificação não entrega nada a ela — isso detecta uma URL digitada errado ou um receptor pela metade antes que eventos reais se acumulem na dead-letter queue, e impede que alguém aponte as nossas entregas para um servidor que nunca as pediu.

## O desafio {#challenge}

Iniciar uma verificação envia um POST para a URL do endpoint, assinado com o segredo do endpoint exatamente como uma entrega (os mesmos `X-Webhook-Signature` e `X-Webhook-Timestamp`, os headers personalizados do seu endpoint e `X-Webhook-Event-Type: webhook.verify`):

```json
{"type": "webhook.verify", "data": {"endpoint_id": "ep_3f9a…", "challenge": "Xb9kQ2…"}}
```

O endpoint passa quando responde **2xx com o valor de `challenge` em qualquer lugar do corpo da resposta**. Um 2xx sem o token falha com `challenge_not_echoed`; qualquer outra coisa falha como uma entrega falharia.

## Responder ao desafio {#handler}

Verifique a assinatura como você faz em toda entrega e depois retorne o desafio:

```python
from nn_webhooks import challenge_response

if (challenge := challenge_response(raw_body)) is not None:  # after the signature check
    return Response(challenge, status=200)
```

```ts
import { challengeResponse } from "@nimbusnexus/webhooks-sdk";

const challenge = challengeResponse(rawBody); // after the signature check
if (challenge !== null) return res.status(200).send(challenge);
```

```go
if challenge, ok := webhooks.ChallengeResponse(rawBody); ok { // after the signature check
    w.WriteHeader(http.StatusOK)
    w.Write([]byte(challenge))
    return
}
```

Esses são os helpers dos SDKs que fazem isso em uma chamada (a partir da 0.8.0). Para qualquer outro evento eles não retornam nada, então o resto do seu handler funciona como antes. Sem SDK, faça o parse do corpo e responda com `data.challenge` quando `type` for `webhook.verify`.

## Executar a verificação {#run}

No console, abra o menu do endpoint na página **Endpoints** e escolha **Verify**. Pela API:

```bash
curl -sX POST {{WEBHOOKS_BASE_URL}}/v1/endpoints/ep_3f9a…/verify \
  -H "Authorization: Bearer $ADMIN_KEY"
```

```json
{ "verified": true, "challenge_echoed": true, "status_code": 200, "error": null, "duration_ms": 142, "failure_reason": null }
```

Um endpoint continua verificado até a URL dele mudar; uma URL nova precisa ser verificada de novo.

## Quando ela é obrigatória {#required}

A verificação é obrigatória para um endpoint quando qualquer um destes estiver ligado:

- o interruptor do **workspace** — **Settings → Endpoint verification** no console, ou `PATCH /v1/workspace` com `{"require_endpoint_verification": true}`;
- o interruptor do **projeto** — `PUT /v1/verification-policy?project_id=…` com `{"required": true}`, para um projeto que precisa dela quando os outros não precisam;
- o seu **plano**, quando o plano a exige. Nesse caso, o console mostra o interruptor travado em ligado.

`GET /v1/verification-policy` retorna a regra tal como a entrega a aplica (`required`), junto com os dois interruptores.

## O que um endpoint não verificado perde {#gated}

Quando a verificação é obrigatória, um endpoint não verificado fica de fora quando um evento é distribuído: a resposta da publicação o conta em `skipped_unverified`, o console marca o endpoint como *gated* e nenhuma entrega é criada para ele — então nada fica esperando para ser enviado quando ele for verificado. Publique de novo ou [reenvie](/docs/product-webhooks/deliveries#replay) depois que ele passar.

O reenvio é barrado da mesma forma. Reenviar uma entrega para esse endpoint, ou reenviar um evento para ele, é recusado com `409 endpoint_not_verified`; um reenvio em lote ou um reenvio por intervalo de tempo o deixa de fora e o conta em `skipped_unverified`. Uma entrega que já estava na fila ou em retentativa quando o endpoint passa a precisar de verificação — a exigência foi ligada, ou a URL do endpoint mudou — vai para a dead-letter queue sem ser enviada, com `last_error` começando com "not verified:". Verifique o endpoint e depois reenvie a entrega.

## Receptores que não conseguem responder {#cannot-echo}

Alguns receptores aceitam qualquer POST, mas nunca devolvem um corpo escolhido por você — entre eles, os catch hooks do Zapier. Eles não conseguem passar pela verificação. Quando o seu plano permitir, deixe a verificação desligada no projeto que entrega para eles; caso contrário, coloque na frente deles um pequeno relay seu que responda ao desafio.

Os incoming webhooks do Slack são um caso à parte. Eles aceitam apenas uma mensagem do Slack, com um campo `text` ou `blocks`, então recusam todo evento que entregamos, mesmo com a verificação desligada. Para levar eventos ao Slack, aponte o endpoint para algo que transforme cada evento em uma mensagem, como um receptor seu ou um catch hook do Zapier.

## Próximos passos {#next-steps}

- [Verificação de assinatura](/docs/product-webhooks/signatures) — a verificação a fazer antes de responder ao desafio.
- [Entregas e retentativas](/docs/product-webhooks/deliveries) — o que acontece depois que o endpoint passa a receber eventos.
- [Início rápido](/docs/product-webhooks/quickstart) — do zero a uma entrega verificada.
