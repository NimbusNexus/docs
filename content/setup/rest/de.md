---
title: "REST-API einrichten"
description: "API-Key erstellen, ihn in einem Header mitsenden und mit curl, TypeScript, Python oder Go den ersten Aufruf an ein NimbusNexus-Produkt senden."
publishedAt: 2026-10-19
updatedAt: 2026-10-22
kind: quickstart
---

# REST-API einrichten

Jedes NimbusNexus-Produkt ist eine REST-API: JSON über HTTPS, mit Ihrem API-Key im Header `Authorization`. Diese Seite führt Sie vom fehlenden Key bis zum ersten erfolgreichen Aufruf. Wählen Sie oben auf der Seite eine Sprache, und die Beispiele folgen ihr. REST bedeutet `curl`; TypeScript, Python und Go verwenden den üblichen HTTP-Client der jeweiligen Sprache, ohne dass ein SDK nötig ist.

## 1 · API-Key erstellen {#key}

**Apps: Webhooks, Inboxes, QR-Codes und Request Bins.** Öffnen Sie **API keys** in Ihrer [Kontokonsole]({{ACCOUNT_BASE_URL}}/api-keys) und erstellen Sie einen Key für das Produkt, das Sie aufrufen wollen. Jeder Key gehört zu genau einem Produkt. Wählen Sie dort seinen Scope: `admin`, `read` oder bei Webhooks auch `publish`. Kopieren Sie den Key, sobald er erscheint, denn er wird nur einmal angezeigt. Ein App-Key ist ein JWT und beginnt daher mit `eyJ`.

**Infrastruktur: VMs, Speicher, Datenbanken und Netzwerk.** Erstellen Sie den Key im Dashboard unter **Settings → API keys**. Er gilt für genau ein Projekt. [Authentifizierung](/docs/authentication) behandelt Scopes und Rotation.

Halten Sie den Key aus Ihrem Quellcode heraus. Exportieren Sie ihn in Ihrer Shell oder bewahren Sie ihn in Ihrem Secret-Store auf:

```bash
export WEBHOOKS_API_KEY="<your-api-key>"
```

## 2 · Key bei jedem Request senden {#auth}

Senden Sie den Key als Bearer-Token. Die APIs der Apps akzeptieren ihn auch als `X-API-Key: <key>`.

```http
Authorization: Bearer <your-api-key>
```

Jedes Produkt hat eine eigene Basis-URL:

| Produkt | Basis-URL |
| --- | --- |
| Webhooks | `{{WEBHOOKS_BASE_URL}}/v1` |
| Inboxes | `{{INBOXES_BASE_URL}}/v1` |
| QR-Codes | `{{QR_BASE_URL}}/v1` |
| Request Bins | `https://bins.nimbusnexus.net/v1` |
| Infrastruktur | `{{API_BASE_URL}}` |

## 3 · Ersten Aufruf senden {#first-call}

`GET /v1/auth/me` bei Webhooks gibt den Key zurück, den Sie gesendet haben: seinen Scope und den Workspace, zu dem er gehört. Der Aufruf liest nichts anderes, daher kann ihn jeder gültige Key aufrufen.

```bash
curl {{WEBHOOKS_BASE_URL}}/v1/auth/me \
  -H "Authorization: Bearer $WEBHOOKS_API_KEY"
```

```ts
const res = await fetch('{{WEBHOOKS_BASE_URL}}/v1/auth/me', {
  headers: { Authorization: `Bearer ${process.env.WEBHOOKS_API_KEY}` },
})
console.log(await res.json())
```

```python
import os
import requests

res = requests.get(
    "{{WEBHOOKS_BASE_URL}}/v1/auth/me",
    headers={"Authorization": f"Bearer {os.environ['WEBHOOKS_API_KEY']}"},
)
print(res.json())
```

```go
req, err := http.NewRequest("GET", "{{WEBHOOKS_BASE_URL}}/v1/auth/me", nil)
if err != nil {
    log.Fatal(err)
}
req.Header.Set("Authorization", "Bearer "+os.Getenv("WEBHOOKS_API_KEY"))
res, err := http.DefaultClient.Do(req)
if err != nil {
    log.Fatal(err)
}
defer res.Body.Close()
```

Die Antwort nennt Ihren Workspace:

```json
{
  "scope": "admin",
  "workspace_id": "{{WORKSPACE_ID}}"
}
```

Die übrigen Felder geben an, um welche Art von Credential es sich handelt. Bei einem API-Key haben `email` und `created_at` den Wert `null`.

## 4 · Fehler lesen {#errors}

Ein fehlgeschlagener Request antwortet mit einem Status 4xx oder 5xx und mit einem einheitlichen Fehlerformat für alle Produkte:

```json
{
  "error": {
    "code": "unauthorized",
    "message": "…",
    "details": { "reason": "missing" },
    "request_id": "…"
  }
}
```

Verzweigen Sie anhand von `code`, nicht anhand des Status oder der Nachricht. `unauthorized` bedeutet, dass kein Key ankam oder der Key widerrufen wurde. `invalid_credential` bedeutet, dass der Key ungültig ist: Erstellen Sie einen neuen, denn eine Wiederholung hilft nicht. `forbidden` bedeutet, dass der Key gültig ist, dies aber nicht darf: Ihm fehlt der Scope oder die Rolle, oder das Produkt ist für Ihren Workspace nicht aktiviert. [Authentifizierung](/docs/authentication#errors) und [Fehler](/docs/errors) listen alle Codes auf. Geben Sie die `request_id` an, wenn Sie den Support kontaktieren.

## Nächste Schritte {#next-steps}

- [API-Referenz](/docs/reference): jede Operation jedes Produkts, mit dem Aufruf in Ihrer Sprache.
- [SDKs](/docs/setup/sdk) und die [CLI](/docs/setup/cli): dieselben Aufrufe, wobei Retries, Signaturprüfung und Paginierung für Sie übernommen werden.
- Schnellstarts der Produkte: [Webhooks](/docs/product-webhooks/quickstart), [Inboxes](/docs/product-inboxes/quickstart), [Request Bins](/docs/product-bins/quickstart), [Ihre erste VM](/docs/quickstart).
