---
title: "Schnellstart für Transforms"
description: "Eine Pipeline mit einem Request testen, speichern und ausführen, einen verworfenen Request sehen und eine neue Version speichern, alles über die API."
publishedAt: 2026-11-06
updatedAt: 2026-11-06
kind: quickstart
---

# Schnellstart für Transforms

In wenigen Minuten von null zur versionierten Pipeline. Sie testen eine Pipeline mit einem Request, speichern sie, führen sie aus, sehen einen verworfenen Request und speichern eine neue Version. Um zu sehen, was eine Pipeline tut, bevor Sie sich anmelden, probieren Sie den [Playground](/transforms/playground) aus.

## Bevor Sie beginnen {#before}

Erstellen Sie in Ihrer [Kontokonsole]({{ACCOUNT_BASE_URL}}/api-keys?product=transforms) einen API-Key mit **Transforms** als Produkt und **Read & write** als Berechtigung. Für alles auf dieser Seite reicht Free. Legen Sie den Key dann in einer Umgebungsvariablen ab:

```bash
export TRANSFORMS_API_KEY="<your-api-key>"
```

Jeder Pfad unten ist relativ zu `https://transforms.nimbusnexus.net`, und jeder Request enthält `Authorization: Bearer <your key>`.

## 1. Pipeline testen {#test}

Diese Pipeline behält bezahlte Rechnungen ab $1,000, entfernt die E-Mail-Adresse des Kunden und jede Telefonnummer und fügt zwei Felder und einen Header hinzu. `POST /v1/pipelines/test` führt ein Dokument einmal aus, mit einem Request, den Sie senden, und speichert und zählt nichts:

```bash
curl -X POST https://transforms.nimbusnexus.net/v1/pipelines/test \
  -H "Authorization: Bearer $TRANSFORMS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "pipeline": {
      "version": 1,
      "steps": [
        { "filter": { "type": "invoice.paid", "data": { "amount": { "$gte": 100000 } } }, "note": "Paid invoices of $1,000 or more" },
        { "drop": ["data.customer.email", "**.phone"] },
        { "set": { "event_type": "{{ type }}", "amount_display": "{{ data.amount | money(data.currency) }}" } },
        { "headers": { "set": { "X-Event-Type": "{{ type }}" } } }
      ]
    },
    "body": {
      "type": "invoice.paid",
      "data": {
        "id": "in_42",
        "amount": 150000,
        "currency": "usd",
        "customer": { "name": "Ana Silva", "email": "ana@example.com", "phone": "+1 202 555 0142" }
      }
    }
  }'
```

```json
{
  "status": "ok",
  "version": null,
  "body": {
    "type": "invoice.paid",
    "data": {
      "id": "in_42",
      "amount": 150000,
      "currency": "usd",
      "customer": { "name": "Ana Silva" }
    },
    "event_type": "invoice.paid",
    "amount_display": "1,500.00 USD"
  },
  "body_changed": true,
  "headers": { "X-Event-Type": "invoice.paid" },
  "query": {},
  "step": null,
  "note": null,
  "reason": null,
  "error": null,
  "duration_ms": 0.4
}
```

`status` ist `ok`, also sind `body` und `headers` das, was gesendet werden soll. `version` ist `null`, weil noch nichts gespeichert wurde.

## 2. Pipeline speichern {#save}

Speichern Sie dasselbe Dokument als Pipeline, mit einem Namen:

```bash
curl -X POST https://transforms.nimbusnexus.net/v1/pipelines \
  -H "Authorization: Bearer $TRANSFORMS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Paid invoices",
    "pipeline": {
      "version": 1,
      "steps": [
        { "filter": { "type": "invoice.paid", "data": { "amount": { "$gte": 100000 } } }, "note": "Paid invoices of $1,000 or more" },
        { "drop": ["data.customer.email", "**.phone"] },
        { "set": { "event_type": "{{ type }}", "amount_display": "{{ data.amount | money(data.currency) }}" } },
        { "headers": { "set": { "X-Event-Type": "{{ type }}" } } }
      ]
    }
  }'
```

Die Antwort lautet `201` mit [der Pipeline](/docs/product-transforms/reference#pipeline), hier gekürzt:

```json
{
  "id": "pipe_8e27d40b19c3f6a5e0d71b42",
  "name": "Paid invoices",
  "status": "enabled",
  "current_version": 1,
  "destinations": [],
  "consumers": []
}
```

Bewahren Sie die `id` auf: Jeder spätere Aufruf erwartet sie.

```bash
export PIPELINE_ID="pipe_8e27d40b19c3f6a5e0d71b42"
```

## 3. Pipeline ausführen {#run}

Senden Sie einen Request an die gespeicherte Pipeline. Die Ausführung erwartet einen `body` und optional `headers` und `meta` und antwortet mit dem, was die Pipeline getan hat:

```bash
curl -X POST "https://transforms.nimbusnexus.net/v1/pipelines/$PIPELINE_ID/run" \
  -H "Authorization: Bearer $TRANSFORMS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"body": {"type": "invoice.paid", "data": {"id": "in_42", "amount": 150000, "currency": "usd"}}}'
```

Die Antwort ist aufgebaut wie die des Tests, mit `"version": 1`. Vom Request wird nichts behalten, und die Ausführung erhöht die Zählung des Monats in `GET /v1/usage` um eins. Ob Sie das Ergebnis weitersenden, liegt bei Ihnen: Transforms sendet selbst nichts.

## 4. Verworfenen Request sehen {#dropped}

Senden Sie eine Rechnung unter dem Betrag des Filters:

```bash
curl -X POST "https://transforms.nimbusnexus.net/v1/pipelines/$PIPELINE_ID/run" \
  -H "Authorization: Bearer $TRANSFORMS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"body": {"type": "invoice.paid", "data": {"id": "in_43", "amount": 99999, "currency": "usd"}}}'
```

```json
{
  "status": "dropped",
  "version": 1,
  "body": null,
  "body_changed": false,
  "headers": {},
  "query": {},
  "step": 0,
  "note": "Paid invoices of $1,000 or more",
  "reason": "no_match",
  "error": "dropped by step 0 (Paid invoices of $1,000 or more)",
  "duration_ms": 0.1
}
```

Auch das ist ein `200`, denn die Pipeline ist gelaufen. `step` zählt ab 0, und `reason` ist `no_match` bei einem Filter, auf den der Request nicht gepasst hat. Senden Sie in diesem Fall nichts.

## 5. Neue Version speichern {#version}

Ändern Sie die Pipeline per `PATCH` mit einem neuen Dokument, hier ohne den Header-Schritt:

```bash
curl -X PATCH "https://transforms.nimbusnexus.net/v1/pipelines/$PIPELINE_ID" \
  -H "Authorization: Bearer $TRANSFORMS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "pipeline": {
      "version": 1,
      "steps": [
        { "filter": { "type": "invoice.paid", "data": { "amount": { "$gte": 100000 } } }, "note": "Paid invoices of $1,000 or more" },
        { "drop": ["data.customer.email", "**.phone"] },
        { "set": { "event_type": "{{ type }}", "amount_display": "{{ data.amount | money(data.currency) }}" } }
      ]
    }
  }'
```

`current_version` ist jetzt `2`, und Ausführungen verwenden diese Version. Version 1 hat sich nicht geändert: `GET /v1/pipelines/{id}/versions` listet die aufbewahrten Versionen auf, und eine Ausführung kann weiterhin eine davon nennen:

```bash
curl -X POST "https://transforms.nimbusnexus.net/v1/pipelines/$PIPELINE_ID/run" \
  -H "Authorization: Bearer $TRANSFORMS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"version": 1, "body": {"type": "invoice.paid", "data": {"id": "in_42", "amount": 150000, "currency": "usd"}}}'
```

Um zu Version 1 zurückzukehren, speichern Sie ihren Inhalt erneut; das ergibt Version 3.

## In der Konsole {#console}

Die Konsole unter `https://transforms.nimbusnexus.net` erledigt all das mit einem Formular für jeden Schritt: **Filter**, **Remove fields**, **Set fields**, **Reshape the body**, **Headers** und **Credential**. **Start from a template** bietet Nachrichten für Slack, Discord und Teams sowie Keep only these fields und Drop personal data an, und **JSON** zeigt das ganze Dokument. Testen Sie, was im Editor steht, bevor Sie es speichern.

## Aufräumen {#cleanup}

Jeder Tarif begrenzt, wie viele Pipelines Sie haben dürfen. Löschen Sie diese daher, wenn Sie fertig sind:

```bash
curl -X DELETE "https://transforms.nimbusnexus.net/v1/pipelines/$PIPELINE_ID" \
  -H "Authorization: Bearer $TRANSFORMS_API_KEY"
```

Löschen ist **endgültig**, für die Pipeline und jede Version. Um sie stattdessen eine Zeit lang nicht laufen zu lassen, setzen Sie sie per `PATCH` auf `{"status": "disabled"}` und später wieder auf `{"status": "enabled"}`. Eine deaktivierte Pipeline beantwortet eine Ausführung mit `409` `conflict`, `pipeline_disabled`.

## Nächste Schritte {#next-steps}

- [Pipelines](/docs/product-transforms/pipelines) — jeder Schritt, Pfad und Filter und jede Vorlage.
- [Referenz für Transforms](/docs/product-transforms/reference) — jede Route und jedes Feld, Rollen, Limits und Fehler.
- [Produktüberblick](/docs/product-transforms) — Credentials, Tarife und was Transforms nicht tut.
