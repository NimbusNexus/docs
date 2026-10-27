---
title: "Início rápido de Webhooks"
description: "Registre um endpoint, publique um evento e verifique a entrega assinada — três requisições e um handler."
publishedAt: 2026-08-05
updatedAt: 2026-10-19
kind: quickstart
---

# Início rápido de Webhooks

Do zero a uma entrega verificada. Você vai registrar um endpoint receptor, publicar um evento para ele e verificar a assinatura do webhook que chegar.

## Antes de começar {#before}

Você precisa de duas coisas:

- **Uma chave de API com escopo `admin`.** Gere uma no console da sua conta NimbusNexus, em **API keys**, escolhendo **Webhooks** como produto e `admin` como escopo. A [visão geral do produto](/docs/product-webhooks#access) explica os escopos. Coloque a chave no seu shell:

  ```bash
  export ADMIN_KEY="eyJ…"
  ```

- **Uma URL HTTPS pública que execute o seu handler.** Entregamos pela internet, então `localhost` não serve. Para um primeiro teste, um túnel até o seu laptop funciona (`cloudflared tunnel --url http://localhost:3000`, ou ngrok).

Todos os caminhos abaixo são relativos a `{{WEBHOOKS_BASE_URL}}`.

## 1. Registrar um endpoint {#endpoint}

Um endpoint é a URL HTTPS para a qual entregamos, mais as inscrições que decidem quais tipos de evento ele recebe. Este recebe tudo o que começa com `order.`:

```bash
curl -sX POST {{WEBHOOKS_BASE_URL}}/v1/endpoints \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{
        "url": "https://your-app.example/webhooks",
        "subscriptions": [{"match_kind": "prefix", "pattern": "order."}]
      }'
```

A resposta traz o endpoint e o **segredo de assinatura** dele:

```json
{
  "id": "ep_3f9a…",
  "url": "https://your-app.example/webhooks",
  "status": "enabled",
  "health": "healthy",
  "subscriptions": [{ "match_kind": "prefix", "pattern": "order." }],
  "secret": "whsec_…"
}
```

O segredo é mostrado **uma vez**. Guarde-o agora no seu gerenciador de segredos — é com ele que você verifica as entregas, e não é possível lê-lo de novo. Se você o perder, rotacione-o e atualize o seu handler.

`match_kind` aceita `exact`, `prefix`, `suffix` ou `all`. Comece restrito: uma inscrição `all` em um receptor que só entende dois tipos de evento significa escrever no seu handler um filtro que a inscrição poderia ter feito por você.

**Se o seu workspace exige verificação de endpoint**, o endpoint não recebe nada até passar por um desafio de uso único: enviamos por POST uma requisição `webhook.verify` com um token, e o seu handler responde 2xx com o token no corpo. Um plano pode exigir isso, e qualquer workspace pode ativar a exigência; a página **Settings** do console mostra se o seu exige. Adicione ao seu handler as poucas linhas de [Verificação de endpoint](/docs/product-webhooks/endpoint-verification#handler) e depois:

```bash
curl -sX POST {{WEBHOOKS_BASE_URL}}/v1/endpoints/ep_3f9a…/verify \
  -H "Authorization: Bearer $ADMIN_KEY"
```

`"verified": true` na resposta significa que ele passou.

## 2. Publicar um evento {#publish}

```bash
curl -sX POST {{WEBHOOKS_BASE_URL}}/v1/events \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: order-123-created" \
  -d '{
        "event_type": "order.created",
        "payload": {"order_id": "ord_123", "total": 4200}
      }'
```

O campo é `event_type`, não `type` — `type` é o nome do campo dentro do envelope *entregue*, que é outro objeto. Enviar `type` aqui resulta em um `422`.

A resposta informa o que a publicação produziu:

```json
{
  "id": "evt_0b6e2c8f4a1d4e7b9c3f5a8d2e6b1c4f",
  "event_uid": "8f1c2e4a9b7d4c3e8a6f5b2d1c0e9a7b",
  "event_type": "order.created",
  "source": null,
  "project_id": "prj_5d2a9c7e1b4f4a8d9e3c6b1a7f2e8d4c",
  "deliveries_created": 1,
  "skipped_unverified": 0
}
```

`id` é o id do evento na API (`GET /v1/events/{id}`). `event_uid` é o id que o seu endpoint recebe, como o `id` do envelope e no header `X-Webhook-Event-Id` — deduplique por ele.

`deliveries_created: 0` é a surpresa mais comum na primeira execução, e tem duas causas:

- **Nenhum endpoint está inscrito nesse tipo.** Compare o padrão de inscrição do endpoint com o tipo que você enviou.
- **Os endpoints correspondentes não estão verificados**, e o seu workspace exige verificação. `skipped_unverified` os conta; [verifique o endpoint](/docs/product-webhooks/endpoint-verification) e publique de novo.

O header `Idempotency-Key` é o que torna a publicação segura para repetir: repetir a requisição com a mesma chave retorna o evento original em vez de distribuí-lo de novo.

## 3. Verificar a entrega {#verify}

O webhook chega à sua URL como um POST cujo corpo é o evento dentro de um envelope:

```json
{"created_at":"2026-10-19T15:04:12.483211+00:00","data":{"order_id":"ord_123","total":4200},"id":"8f1c2e4a9b7d4c3e8a6f5b2d1c0e9a7b","type":"order.created","version":"1"}
```

`data` é o payload que você publicou, `id` é o `event_uid` e `type` é o tipo do evento. Verifique a assinatura antes de fazer qualquer trabalho — um handler que pula essa etapa vai processar qualquer coisa que encontre a sua URL.

```python
import hashlib, hmac, time

def handle(request):
    secret = ENDPOINT_SIGNING_SECRET          # from step 1
    timestamp = request.headers["X-Webhook-Timestamp"]
    signature = request.headers["X-Webhook-Signature"]
    raw_body = request.body                   # RAW bytes — never re-serialize the JSON

    # 1. Reject anything outside the replay window.
    if abs(int(time.time()) - int(timestamp)) > 300:
        return Response(status_code=400)

    # 2. Recompute and compare in constant time. The header carries one token normally, but
    #    several comma-separated ones during a secret rotation — accept if ANY matches.
    expected = "sha256=" + hmac.new(
        secret.encode(), f"{timestamp}.".encode() + raw_body, hashlib.sha256
    ).hexdigest()
    if not any(hmac.compare_digest(expected, t.strip()) for t in signature.split(",")):
        return Response(status_code=400)

    # 3. Only now is the payload trustworthy.
    process(request.json())
    return Response(status_code=200)          # 2xx = delivered; anything else retries
```

Assinar os bytes brutos, e não um objeto recodificado, é o detalhe que mais confunde as pessoas: interpretar e serializar o JSON de novo reordena as chaves e muda os espaços em branco, e a assinatura é sobre os bytes que enviamos. Leia o corpo uma vez, guarde-o, verifique e só então interprete-o.

O contrato completo — todos os headers e o motivo de cada regra — está em [Verificação de assinatura](/docs/product-webhooks/signatures). Os [SDKs](/docs/product-webhooks/sdks) trazem um helper `verify` que implementa tudo isso, e esse é o caminho recomendado.

## 4. Confirmar a entrega {#confirm}

```bash
curl -s "{{WEBHOOKS_BASE_URL}}/v1/deliveries?status=dead" \
  -H "Authorization: Bearer $ADMIN_KEY"
```

Um array `items` vazio significa que nada esgotou as retentativas. Se o seu handler estava fora do ar durante o passo 2, a entrega vai estar aqui — corrija o handler e depois reenvie-a:

```bash
curl -sX POST {{WEBHOOKS_BASE_URL}}/v1/deliveries/dlv_456/redeliver \
  -H "Authorization: Bearer $ADMIN_KEY"
```

## Próximos passos {#next-steps}

- [Verificação de assinatura](/docs/product-webhooks/signatures) — o contrato de assinatura completo.
- [Entregas e retentativas](/docs/product-webhooks/deliveries) — o que acontece quando o seu handler está fora do ar.
- [Fontes](/docs/product-webhooks/sources) — receba webhooks do Stripe, do GitHub e de outros da mesma forma.
- [SDKs](/docs/product-webhooks/sdks) — dispense o HMAC feito à mão.
- [CLI](/docs/product-webhooks/cli) — as mesmas operações sem curl.
- [Visão geral de Webhooks](/docs/product-webhooks) — objetos, semântica de entrega e idempotência.
