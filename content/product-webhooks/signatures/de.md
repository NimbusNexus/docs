---
title: "Signaturprüfung"
description: "Die Signaturspezifikation für zugestellte Webhooks — Header, HMAC-Konstruktion und die drei Regeln für die Prüfung."
publishedAt: 2026-08-05
updatedAt: 2026-08-05
kind: concept
---

# Signaturprüfung

Jede Zustellung wird mit dem Signatur-Secret des empfangenden Endpoints signiert. Erst die Prüfung dieser Signatur unterscheidet „bei meiner URL ist ein POST angekommen“ von „NimbusNexus hat mir dieses Event gesendet“ — eine Webhook-URL ist kein Secret, und alles im Internet kann sie finden.

Diese Seite ist die Spezifikation. Wenn Sie eines der [SDKs](/docs/product-webhooks/sdks) verwenden, setzt dessen Helfer `verify` bereits alles davon um, und Sie können direkt dazu springen, [was nach der Prüfung zu tun ist](#responding).

## Die Header {#headers}

| Header | Inhalt |
|---|---|
| `X-Webhook-Signature` | `sha256=<hex>` — der HMAC, den Sie prüfen. **Während einer Rotation des Secrets mehrere kommagetrennte Tokens**; siehe [Regeln](#rules) |
| `X-Webhook-Timestamp` | Unix-Sekunden; Teil der Signatur und des Replay-Fensters |
| `X-Webhook-Event-Id` | Die Event-ID, entspricht `id` im Body — nutzen Sie sie zum Deduplizieren |
| `X-Webhook-Event-Type` | Der Event-Typ |
| `X-Webhook-Delivery-Id` | Die ID dieser Zustellung; nennen Sie sie in Supportanfragen |

> Das sind **nicht** die Header, die [Plattform-Webhooks](/docs/webhooks) verwenden; diese signieren Benachrichtigungen zur Infrastruktur mit dem Präfix `NN-`. Die beiden Produkte sind getrennte Systeme. Ein Handler, der für die falschen Header-Namen geschrieben ist, findet nichts zu prüfen und weist jede Zustellung ab.

## Die Konstruktion {#construction}

```text
signature = "sha256=" + hex( HMAC_SHA256( secret, "<timestamp>." + raw_body ) )
```

Der Timestamp, ein wörtlicher Punkt `.`, dann der Roh-Body des Requests — aneinandergehängt, mit dem Signatur-Secret Ihres Endpoints per HMAC signiert, hexadezimal kodiert und mit dem Präfix `sha256=` versehen.

Erst dadurch, dass der Timestamp Teil des signierten Materials ist, lässt sich das Replay-Fenster durchsetzen. Wäre der Timestamp nur ein Header neben der Signatur, könnte ein Angreifer, der eine abgefangene Zustellung erneut abspielt, ihn beliebig umschreiben; weil er signiert ist, macht jede Änderung den HMAC ungültig.

Der Body selbst ist kompaktes JSON mit sortierten Feldnamen, einmal beim Veröffentlichen serialisiert und gespeichert. Jeder Retry einer Zustellung sendet **identische Bytes** — eine Zustellung, die erst beim vierten Versuch gelingt, lässt sich also genauso verifizieren, wie es beim ersten Versuch gewesen wäre. Jeder Versuch wird mit einem frischen Timestamp neu signiert; deshalb fällt auch ein lange verzögerter Retry noch in ein enges Replay-Fenster.

## Die drei Regeln {#rules}

**1. Signieren Sie die Roh-Bytes.** Lesen Sie den Body einmal als Bytes und prüfen Sie genau diese. Parsen und erneutes Serialisieren des JSON ändert die Reihenfolge der Felder und den Leerraum, und die Signatur gilt für das, was wir gesendet haben, nicht für ein gleichwertiges Objekt. Das ist die mit Abstand häufigste Ursache für „die Signatur passt nie“ — die Payload ist in Ordnung, und verglichen wird mit anderen Bytes.

Frameworks, die JSON vorab parsen, stellen das Original meist separat bereit: `request.body` in Flask, `req.rawBody` mit einem Verify-Hook in Express, `await request.body()` in FastAPI.

**2. Vergleichen Sie in konstanter Zeit — mit jedem Token.** Verwenden Sie `hmac.compare_digest`, `crypto.timingSafeEqual`, `hmac.Equal` — nicht `==`. Ein byteweiser Vergleich, der vorzeitig abbricht, verrät über die Laufzeit, wie viel einer geratenen Signatur stimmte, und macht eine Fälschung damit zu einer lösbaren Suche. Es richtig zu machen kostet nichts; was es kostet, es falsch zu machen, zeigt sich beim Testen nicht, denn eine falsche Implementierung besteht jeden funktionalen Test.

Teilen Sie den Header zuerst an `,` auf und akzeptieren Sie, wenn **irgendein** Token passt. Normalerweise gibt es genau ein Token, daher wirkt das überflüssig — aber während einer Rotation des Signatur-Secrets signieren wir sowohl mit dem neuen als auch mit dem vorherigen Secret und senden `sha256=<a>,sha256=<b>`. Ein Prüfer, der den gesamten Header-Wert mit einem einzelnen erwarteten Token vergleicht, findet keine Übereinstimmung und weist für die Dauer der Überlappung **jede** Zustellung ab. Die offiziellen SDKs teilen alle auf; ein selbst geschriebener Prüfer ist derjenige, der das falsch macht.

**3. Weisen Sie veraltete Timestamps ab.** Wenn `X-Webhook-Timestamp` mehr als **300 Sekunden** von Ihrer Uhr abweicht, weisen Sie die Zustellung ab, unabhängig davon, ob der HMAC stimmt. Ohne diese Regel bleibt eine abgefangene Zustellung für immer wiederabspielbar. Mit ihr ist das Risiko auf fünf Minuten begrenzt, selbst wenn eine Payload abgefangen wird.

Regel 3 setzt voraus, dass die Uhr Ihres Servers ungefähr stimmt. Wenn nach einer Änderung an der Infrastruktur massenhaft Zustellungen bei der Prüfung scheitern, prüfen Sie NTP, bevor Sie Ihren Code prüfen.

## Ein vollständiger Handler {#example}

```python
import hashlib, hmac, time

WINDOW_SECONDS = 300

def verify(secret: str, raw_body: bytes, signature: str, timestamp: str) -> bool:
    # Rule 3 — replay window, checked first because it is the cheapest rejection.
    try:
        if abs(int(time.time()) - int(timestamp)) > WINDOW_SECONDS:
            return False
    except (TypeError, ValueError):
        return False  # absent or non-numeric header

    # Rule 1 — the raw bytes, exactly as received.
    expected = "sha256=" + hmac.new(
        secret.encode(), f"{timestamp}.".encode() + raw_body, hashlib.sha256
    ).hexdigest()

    # Rule 2 — constant-time comparison against EVERY token. One token normally; several,
    # comma-separated, while a rotation overlap is in effect.
    return any(
        hmac.compare_digest(expected, token.strip())
        for token in signature.split(",")
    )
```

## Antworten {#responding}

Geben Sie `2xx` zurück, und wir betrachten die Zustellung als erfolgt. Alles andere — oder keine Antwort innerhalb des Timeouts — zählt als Fehlschlag und geht in den Retry-Zeitplan.

Bestätigen Sie schnell und erledigen Sie die Arbeit danach. Ein Handler, der vor der Antwort einen langsamen Job abschließt, hält die Zustellung offen, und wenn er den Timeout überschreitet, wird die Arbeit erledigt *und* die Zustellung wiederholt — und Sie haben genau das Duplikat, das Sie vermeiden wollten. Stellen Sie die Arbeit in eine Warteschlange, geben Sie `200` zurück und verarbeiten Sie sie getrennt davon.

Seien Sie trotzdem idempotent. Die Zustellung erfolgt mindestens einmal, rechnen Sie also damit, dasselbe Event zweimal zu sehen: Deduplizieren Sie anhand von `X-Webhook-Event-Id`, das über alle Retries einer Zustellung gleich bleibt.

## Secret rotieren {#rotation}

```bash
curl -sX POST {{WEBHOOKS_BASE_URL}}/v1/endpoints/ep_3f9a/rotate-secret \
  -H "Authorization: Bearer $ADMIN_KEY"
```

Das neue Secret wird einmal zurückgegeben. Sie müssen in Ihrem Handler **nicht** mit zwei Secrets arbeiten: Etwa 24 Stunden lang nach einer Rotation signieren wir jede Zustellung sowohl mit dem neuen als auch mit dem vorherigen Secret und senden beide Tokens in einem Header, `sha256=<new>,sha256=<previous>`. Ein Prüfer, der [Regel 2](#rules) befolgt und jedes Token prüft, funktioniert die ganze Zeit weiter, egal welches Secret er hat, sodass Sie sofort auf das neue umstellen können.

Daraus folgt die Falle: Ein Prüfer, der den gesamten Header-Wert vergleicht, funktioniert bis zur ersten Rotation einwandfrei und weist dann einen Tag lang alles ab. Wenn Sie rotieren und massenhaft Zustellungen bei der Prüfung scheitern, prüfen Sie zuerst diesen Vergleich.

## Nächste Schritte {#next-steps}

- [SDKs](/docs/product-webhooks/sdks) — Helfer `verify`, die diese Seite umsetzen.
- [Schnellstart](/docs/product-webhooks/quickstart) — der durchgängige Ablauf, in den das gehört.
- [Überblick über Webhooks](/docs/product-webhooks) — Zustellsemantik und die Dead-Letter-Queue.
- [Plattform-Webhooks](/docs/webhooks) — die getrennten Benachrichtigungen zur Infrastruktur, signiert mit `NN-`.
