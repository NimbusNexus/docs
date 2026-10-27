---
title: "Plattform-Webhooks"
description: "Die Lebenszyklus-Events Ihrer Infrastruktur abonnieren. HMAC-signierte POSTs an eine URL, die Sie kontrollieren."
publishedAt: 2026-05-20
updatedAt: 2026-08-05
kind: concept
---

# Plattform-Webhooks

Über Plattform-Webhooks benachrichtigt NimbusNexus Ihre Systeme, wenn sich etwas ändert — eine VM ist fertig bereitgestellt, ein Snapshot ist abgeschlossen, eine Rechnung wurde erstellt. Sie registrieren eine URL; wir senden per POST eine JSON-Payload an sie, jedes Mal, wenn das passende Event eintritt.

> **Sie suchen das Produkt Webhooks?** Wenn Sie Webhooks an *Ihre eigenen* Kunden senden möchten — ein Event veröffentlichen und uns jede Zustellung signieren, wiederholen und erneut abspielen lassen —, ist das ein separates Produkt, dokumentiert unter [Webhooks (Produkt)](/docs/product-webhooks). Diese Seite behandelt nur die Benachrichtigungen, die NimbusNexus *Ihnen* über Ihre eigene Infrastruktur sendet. **Die beiden verwenden unterschiedliche Signatur-Header**, daher ist Code zur Signaturprüfung nicht austauschbar.

Mit Webhooks reagieren Sie auf Zustandsänderungen ohne Polling. Polling funktioniert, ist bei großem Umfang aber verschwenderisch (die meisten Requests liefern „nichts geändert“) und bei kleinem Umfang langsam (Sie erfahren von einer Änderung erst beim nächsten Abfragetakt). Webhooks kehren das Modell um — wir sagen Ihnen Bescheid, sobald etwas passiert.

## Aufbau einer Zustellung {#delivery}

```http
POST /webhooks/nimbusnexus HTTP/1.1
Host: your-app.example.com
Content-Type: application/json
NN-Event: vm.created
NN-Delivery-Id: del_01HG7Y3...
NN-Timestamp: 1763410800
NN-Signature: sha256=4d2c8f19e6b07d3f...

{
  "event": "vm.created",
  "occurred_at": "2026-05-20T18:30:00Z",
  "data": {
    "id": "vm_01HG7Y3...",
    "name": "web-01",
    "state": "running",
    "ipv4": "203.0.113.5"
  }
}
```

Jede Zustellung trägt vier Header:

- `NN-Event` — der Event-Typ (`vm.created`, `snapshot.completed` usw.)
- `NN-Delivery-Id` — eindeutig pro Zustellung; auf Ihrer Seite gefahrlos als Idempotency-Key verwendbar
- `NN-Timestamp` — Unix-Epoch-Sekunden zum Zeitpunkt der Zustellung; fließt in die Signatur ein
- `NN-Signature` — HMAC-SHA256 über `{timestamp}.{body}`, hex-kodiert

## Signatur prüfen {#signature}

Die Signatur beweist, dass die Zustellung von NimbusNexus kam und nicht von jemandem, der Ihre Webhook-URL erraten hat. Prüfen Sie sie in Ihrem Handler, bevor Sie irgendetwas verarbeiten:

```ts
import crypto from 'node:crypto'

function verifyWebhook(req: Request, secret: string): boolean {
  const timestamp = req.headers.get('NN-Timestamp')!
  const signature = req.headers.get('NN-Signature')!.replace(/^sha256=/, '')
  const body = req.bodyText // raw body, not parsed JSON

  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${body}`)
    .digest('hex')

  // Constant-time compare avoids timing oracles
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expected, 'hex')
  )
}
```

Das Secret erhalten Sie im Dashboard, wenn Sie den Webhook-Endpoint erstellen. Bewahren Sie es in Ihrem Secrets-Manager auf, nicht im Quellcode — mit ihm kann jeder Zustellungen fälschen.

Lehnen Sie außerdem Zustellungen ab, deren Timestamp mehr als 5 Minuten von der Uhr Ihres Servers abweicht. Das begrenzt das Replay-Fenster, falls das Secret jemals durchsickert.

## Event-Typen {#events}

Jede Ressource mit einem Lebenszyklus sendet Events. Häufige sind:

| Event | Wann |
| --- | --- |
| `vm.created` | Eine VM ist fertig bereitgestellt und `running` |
| `vm.state_changed` | Eine VM ist von einem Zustand in einen anderen gewechselt |
| `vm.deleted` | Eine VM wurde beendet |
| `snapshot.completed` | Ein Snapshot ist fertig kopiert |
| `backup.completed` | Ein geplantes Backup ist abgeschlossen |
| `database.upgrade_completed` | Ein Upgrade der Engine einer verwalteten Datenbank ist abgeschlossen |
| `floating_ip.attached` / `floating_ip.detached` | Änderungen der Zuordnung |
| `invoice.generated` | Eine Monatsrechnung wurde fertiggestellt |
| `payment.succeeded` / `payment.failed` | Ergebnisse von Zahlungen |
| `quota.warning` | Ein Projekt hat 90 % eines Kontingents überschritten |

Die vollständige Liste der Event-Typen steht in der API-Referenz der jeweiligen Ressource (das Feld `events` der Ressource zeigt, was gesendet wird).

## Zustellsemantik {#delivery-semantics}

- **Mindestens einmal.** Ein instabiles Netzwerk oder ein langsamer Handler kann dazu führen, dass wir wiederholen. Deduplizieren Sie auf Ihrer Seite mit `NN-Delivery-Id`.
- **Die Reihenfolge ist nicht garantiert.** Zwei Events, die im Abstand von ~1 Sekunde eintreten, können in anderer Reihenfolge ankommen. Das Feld `occurred_at` in der Payload gibt die tatsächliche Reihenfolge an; sortieren Sie danach, wenn es darauf ankommt.
- **Retries:** Fehlgeschlagene Zustellungen (Antwort außerhalb von 2xx oder Timeout > 10 s) werden mit exponentiellem Backoff nach 1, 5, 25, 125 und 625 Sekunden wiederholt. Insgesamt fünf Versuche. Danach wird die Zustellung verworfen; wir zeigen sie 14 Tage lang im Panel „failed deliveries“ des Dashboards an.
- **Timeout:** Ihr Handler hat 10 Sekunden Zeit, um ein 2xx zurückzugeben. Wenn Sie mehr Arbeit erledigen müssen, stellen Sie sie in eine Warteschlange und bestätigen Sie den Webhook sofort.

## Nächste Schritte {#next-steps}

- [Authentifizierung](/docs/authentication) — wie API-Keys (nicht Webhook-Secrets) funktionieren.
- [Idempotenz](/docs/idempotency) — das Muster, das diese Seite für den Umgang mit Retries empfiehlt.
- [Konventionen](/docs/conventions) — Fehlerformate, Statuscodes und der Rest des Request-Aufbaus.
