---
title: "Schnellstart für Webhooks"
description: "Einen Endpoint registrieren, ein Event veröffentlichen und die signierte Zustellung prüfen — drei Requests und ein Handler."
publishedAt: 2026-08-05
updatedAt: 2026-10-19
kind: quickstart
---

# Schnellstart für Webhooks

Von null zur verifizierten Zustellung. Sie registrieren einen empfangenden Endpoint, veröffentlichen ein Event an ihn und prüfen die Signatur des ankommenden Webhooks.

## Bevor Sie beginnen {#before}

Sie brauchen zwei Dinge:

- **Einen API-Key mit dem Scope `admin`.** Erstellen Sie einen in Ihrer NimbusNexus-Kontokonsole unter **API keys** und wählen Sie **Webhooks** als Produkt und `admin` als Scope. Der [Produktüberblick](/docs/product-webhooks#access) erklärt die Scopes. Legen Sie den Key in Ihrer Shell ab:

  ```bash
  export ADMIN_KEY="eyJ…"
  ```

- **Eine öffentliche HTTPS-URL, unter der Ihr Handler läuft.** Wir stellen über das Internet zu, daher genügt `localhost` nicht. Für einen ersten Test funktioniert ein Tunnel zu Ihrem Laptop (`cloudflared tunnel --url http://localhost:3000` oder ngrok).

Jeder Pfad unten ist relativ zu `{{WEBHOOKS_BASE_URL}}`.

## 1. Endpoint registrieren {#endpoint}

Ein Endpoint ist die HTTPS-URL, an die wir zustellen, plus die Abos, die festlegen, welche Event-Typen er empfängt. Dieser nimmt alles an, was mit `order.` beginnt:

```bash
curl -sX POST {{WEBHOOKS_BASE_URL}}/v1/endpoints \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{
        "url": "https://your-app.example/webhooks",
        "subscriptions": [{"match_kind": "prefix", "pattern": "order."}]
      }'
```

Die Antwort enthält den Endpoint und sein **Signatur-Secret**:

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

Das Secret wird **einmal** angezeigt. Speichern Sie es jetzt in Ihrem Secrets-Manager — gegen dieses Secret prüfen Sie Zustellungen, und es lässt sich nicht erneut auslesen. Wenn Sie es verlieren, rotieren Sie es und aktualisieren Sie Ihren Handler.

`match_kind` akzeptiert `exact`, `prefix`, `suffix` oder `all`. Beginnen Sie eng: Ein Abo mit `all` bei einem Empfänger, der nur zwei Event-Typen versteht, heißt, dass Sie in Ihrem Handler einen Filter schreiben, den das Abo für Sie hätte übernehmen können.

**Wenn Ihr Workspace Endpoint-Verifizierung verlangt**, empfängt der Endpoint nichts, bis er eine einmalige Challenge besteht: Wir senden per POST einen Request `webhook.verify` mit einem Token, und Ihr Handler antwortet mit 2xx und dem Token im Body. Ein Tarif kann sie verlangen, und jeder Workspace kann sie einschalten; die Seite **Settings** in der Konsole zeigt, ob das bei Ihrem der Fall ist. Fügen Sie Ihrem Handler die wenigen Zeilen aus [Endpoint-Verifizierung](/docs/product-webhooks/endpoint-verification#handler) hinzu und führen Sie dann Folgendes aus:

```bash
curl -sX POST {{WEBHOOKS_BASE_URL}}/v1/endpoints/ep_3f9a…/verify \
  -H "Authorization: Bearer $ADMIN_KEY"
```

`"verified": true` in der Antwort bedeutet, dass er bestanden hat.

## 2. Event veröffentlichen {#publish}

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

Das Feld heißt `event_type`, nicht `type` — `type` ist der Feldname im *zugestellten* Envelope, und das ist ein anderes Objekt. Wenn Sie hier `type` senden, erhalten Sie `422`.

Die Antwort zeigt, was der Publish erzeugt hat:

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

`id` ist die API-ID des Events (`GET /v1/events/{id}`). `event_uid` ist die ID, die Ihr Endpoint erhält, als `id` des Envelopes und im Header `X-Webhook-Event-Id` — deduplizieren Sie anhand dieser ID.

`deliveries_created: 0` ist die häufigste Überraschung beim ersten Durchlauf und hat zwei Ursachen:

- **Kein Endpoint abonniert diesen Typ.** Vergleichen Sie das Abo-Muster des Endpoints mit dem Typ, den Sie gesendet haben.
- **Die passenden Endpoints sind nicht verifiziert**, und Ihr Workspace verlangt Verifizierung. `skipped_unverified` zählt sie; [verifizieren Sie den Endpoint](/docs/product-webhooks/endpoint-verification) und veröffentlichen Sie erneut.

Der Header `Idempotency-Key` macht den Publish sicher wiederholbar: Wer denselben Key erneut sendet, erhält das ursprüngliche Event zurück, statt es erneut zu verteilen.

## 3. Zustellung prüfen {#verify}

Der Webhook kommt bei Ihrer URL als POST an, dessen Body das Event in einem Envelope ist:

```json
{"created_at":"2026-10-19T15:04:12.483211+00:00","data":{"order_id":"ord_123","total":4200},"id":"8f1c2e4a9b7d4c3e8a6f5b2d1c0e9a7b","type":"order.created","version":"1"}
```

`data` ist die Payload, die Sie veröffentlicht haben, `id` die `event_uid`, `type` der Event-Typ. Prüfen Sie die Signatur, bevor Sie irgendetwas verarbeiten — ein Handler, der das auslässt, verarbeitet alles, was Ihre URL findet.

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

Dass die Signatur über die Roh-Bytes geht und nicht über ein neu kodiertes Objekt, ist das Detail, an dem viele scheitern: Parsen und erneutes Serialisieren von JSON ändert die Reihenfolge der Felder und den Leerraum, und die Signatur gilt für die Bytes, die wir gesendet haben. Lesen Sie den Body einmal, bewahren Sie ihn auf, prüfen Sie ihn und parsen Sie ihn erst dann.

Die vollständige Spezifikation — jeder Header und warum es jede Regel gibt — steht unter [Signaturprüfung](/docs/product-webhooks/signatures). Die [SDKs](/docs/product-webhooks/sdks) liefern einen Helfer `verify`, der all das umsetzt, und das ist der empfohlene Weg.

## 4. Ankunft bestätigen {#confirm}

```bash
curl -s "{{WEBHOOKS_BASE_URL}}/v1/deliveries?status=dead" \
  -H "Authorization: Bearer $ADMIN_KEY"
```

Ein leeres Array `items` bedeutet, dass keine Zustellung ihre Retries ausgeschöpft hat. Wenn Ihr Handler während Schritt 2 nicht erreichbar war, steht die Zustellung hier — beheben Sie das Problem im Handler und spielen Sie die Zustellung dann erneut ab:

```bash
curl -sX POST {{WEBHOOKS_BASE_URL}}/v1/deliveries/dlv_456/redeliver \
  -H "Authorization: Bearer $ADMIN_KEY"
```

## Nächste Schritte {#next-steps}

- [Signaturprüfung](/docs/product-webhooks/signatures) — die vollständige Signaturspezifikation.
- [Zustellungen und Retries](/docs/product-webhooks/deliveries) — was passiert, wenn Ihr Handler nicht erreichbar ist.
- [Quellen](/docs/product-webhooks/sources) — Webhooks von Stripe, GitHub und anderen auf dieselbe Weise empfangen.
- [SDKs](/docs/product-webhooks/sdks) — ohne selbst geschriebenes HMAC.
- [CLI](/docs/product-webhooks/cli) — dieselben Operationen ohne curl.
- [Überblick über Webhooks](/docs/product-webhooks) — Objekte, Zustellsemantik und Idempotenz.
