---
title: "Endpoint-Verifizierung"
description: "Nachweisen, dass ein Endpoint Ihre Events haben will, bevor er welche empfängt — mit einer einmaligen signierten Challenge, die er zurücksenden muss."
publishedAt: 2026-10-19
updatedAt: 2026-10-28
kind: concept
---

# Endpoint-Verifizierung

Die Verifizierung weist nach, dass die URL hinter einem Endpoint Ihnen gehört und für Webhooks bereit ist. Wir senden ihr eine signierte Challenge; sie besteht, indem sie die Challenge zurücksendet. Bis sie besteht, stellt ein Workspace, der Verifizierung verlangt, nichts an sie zu. Das fängt eine vertippte URL oder einen halb fertigen Empfänger ab, bevor sich echte Events in der Dead-Letter-Queue stapeln, und verhindert, dass jemand unsere Zustellungen auf einen Server richtet, der nie darum gebeten hat.

## Die Challenge {#challenge}

Wenn Sie eine Verifizierung starten, wird ein POST an die URL des Endpoints gesendet, signiert mit dem Secret des Endpoints, genau wie eine Zustellung (dieselben `X-Webhook-Signature` und `X-Webhook-Timestamp`, die Custom-Header Ihres Endpoints und `X-Webhook-Event-Type: webhook.verify`):

```json
{"type": "webhook.verify", "data": {"endpoint_id": "ep_3f9a…", "challenge": "Xb9kQ2…"}}
```

Der Endpoint besteht, wenn er mit **2xx antwortet und den Wert von `challenge` irgendwo im Response-Body enthält**. Ein 2xx ohne das Token schlägt mit `challenge_not_echoed` fehl; alles andere schlägt fehl wie bei einer Zustellung.

## Die Challenge beantworten {#handler}

Prüfen Sie die Signatur wie bei jeder Zustellung und geben Sie dann die Challenge zurück:

```python
event = json.loads(raw_body)                       # after the signature check
if event["type"] == "webhook.verify":
    return Response(event["data"]["challenge"], status=200)
```

```ts
const event = JSON.parse(rawBody); // after the signature check
if (event.type === "webhook.verify") return res.status(200).send(event.data.challenge);
```

```go
var event struct {
    Type string `json:"type"`
    Data struct{ Challenge string `json:"challenge"` } `json:"data"`
}
_ = json.Unmarshal(rawBody, &event) // after the signature check
if event.Type == "webhook.verify" {
    w.WriteHeader(http.StatusOK)
    w.Write([]byte(event.Data.Challenge))
    return
}
```

## Verifizierung ausführen {#run}

Öffnen Sie in der Konsole auf der Seite **Endpoints** das Menü des Endpoints und wählen Sie **Verify**. Über die API:

```bash
curl -sX POST {{WEBHOOKS_BASE_URL}}/v1/endpoints/ep_3f9a…/verify \
  -H "Authorization: Bearer $ADMIN_KEY"
```

```json
{ "verified": true, "challenge_echoed": true, "status_code": 200, "error": null, "duration_ms": 142, "failure_reason": null }
```

Ein Endpoint bleibt verifiziert, bis sich seine URL ändert; eine neue URL muss erneut verifiziert werden.

## Wann sie verlangt wird {#required}

Die Verifizierung wird für einen Endpoint verlangt, wenn eine der folgenden Vorgaben aktiv ist:

- der Schalter für den **Workspace** — **Settings → Endpoint verification** in der Konsole oder `PATCH /v1/workspace` mit `{"require_endpoint_verification": true}`;
- der Schalter für das **Projekt** — `PUT /v1/verification-policy?project_id=…` mit `{"required": true}`, für ein Projekt, das sie braucht, während andere sie nicht brauchen;
- Ihr **Tarif**, sofern er sie verlangt. Die Konsole zeigt den Schalter dann als fest eingeschaltet.

`GET /v1/verification-policy` liefert die Regel, wie die Zustellung sie anwendet (`required`), zusammen mit den beiden Schaltern.

## Was einem nicht verifizierten Endpoint entgeht {#gated}

Wenn die Verifizierung verlangt wird, wird ein nicht verifizierter Endpoint bei der Verteilung eines Events ausgelassen: Die Antwort auf den Publish zählt ihn in `skipped_unverified`, die Konsole markiert den Endpoint als *gated*, und für ihn wird keine Zustellung erstellt — es wartet also nichts darauf, gesendet zu werden, sobald er verifiziert ist. Veröffentlichen Sie das Event erneut oder [spielen Sie es erneut ab](/docs/product-webhooks/deliveries#replay), nachdem der Endpoint bestanden hat.

Erneutes Senden wird ebenso zurückgehalten. Eine einzelne Zustellung erneut an diesen Endpoint zuzustellen oder ein Event erneut an ihn abzuspielen, wird mit `409 endpoint_not_verified` abgewiesen; eine Sammel-Neuzustellung oder ein Replay über einen Zeitraum lässt ihn aus und zählt ihn in `skipped_unverified`. Eine Zustellung, die bereits in der Warteschlange steht oder wiederholt wird, wenn der Endpoint eine Verifizierung braucht — weil die Anforderung eingeschaltet wurde oder sich die URL des Endpoints geändert hat —, geht ungesendet in die Dead-Letter-Queue, mit einem `last_error`, das mit „not verified:“ beginnt. Verifizieren Sie den Endpoint und stellen Sie die Zustellung dann erneut zu.

## Empfänger, die nicht antworten können {#cannot-echo}

Manche Empfänger nehmen jeden POST an, geben aber nie einen Body Ihrer Wahl zurück — darunter die Catch Hooks von Zapier. Sie können die Verifizierung nicht bestehen. Wo Ihr Tarif es zulässt, lassen Sie die Verifizierung für das Projekt ausgeschaltet, das an sie zustellt; andernfalls schalten Sie ein kleines eigenes Relay davor, das die Challenge beantwortet.

Die Incoming Webhooks von Slack sind ein anderer Fall. Sie nehmen nur eine Slack-Nachricht mit einem Feld `text` oder `blocks` an und lehnen deshalb jedes Event ab, das wir zustellen, auch bei ausgeschalteter Verifizierung. Um Events nach Slack zu bringen, richten Sie den Endpoint auf etwas, das jedes Event in eine Nachricht umwandelt, etwa einen eigenen Empfänger oder einen Catch Hook von Zapier.

## Nächste Schritte {#next-steps}

- [Signaturprüfung](/docs/product-webhooks/signatures) — die Prüfung, die Sie vor dem Beantworten der Challenge ausführen.
- [Zustellungen und Retries](/docs/product-webhooks/deliveries) — was geschieht, sobald der Endpoint Events empfängt.
- [Schnellstart](/docs/product-webhooks/quickstart) — von null zur verifizierten Zustellung.
