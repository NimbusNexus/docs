---
title: "Schnellstart"
description: "API-Key generieren, eine Region wählen und mit drei Requests Ihre erste VM erstellen."
publishedAt: 2026-05-19
updatedAt: 2026-05-19
kind: quickstart
---

# Schnellstart

Diese Anleitung bringt Sie in drei API-Aufrufen von einem angemeldeten Dashboard-Konto zu einer laufenden virtuellen Maschine. Alles, was Sie hier tun, lässt sich rückgängig machen — löschen Sie die VM, wenn Sie fertig sind, dann haben Sie höchstens ein paar Cent ausgegeben.

## Bevor Sie beginnen {#prereqs}

Sie brauchen drei Dinge:

- Ein NimbusNexus-Konto. Registrieren Sie sich unter [{{ROOT_DOMAIN}}]({{BASE_URL}}/register) — Sie erhalten ein Startguthaben, das diesen Schnellstart mehr als abdeckt.
- Das Kommandozeilentool `curl` oder einen beliebigen anderen HTTP-Client. Die Beispiele auf dieser Seite verwenden `curl`; dieselben Aufrufe funktionieren in jeder Sprache.
- Etwa fünf Minuten.

SSH müssen Sie noch nicht eingerichtet haben. Wir erstellen einen Key im Rahmen des zweiten Aufrufs.

## 1 · API-Key generieren {#api-key}

Melden Sie sich im Dashboard an und gehen Sie zu **Settings → API keys → New key**. Geben Sie dem Key eine Bezeichnung, die Sie später wiedererkennen (z. B. `quickstart`), und kopieren Sie den Wert an einen sicheren Ort — Sie sehen ihn nur einmal.

Exportieren Sie ihn als Umgebungsvariable, damit die Beispiele unten darauf zugreifen können:

```bash
export NIMBUS_KEY="nn_live_xxxxxxxxxxxxxxxx"
```

API-Keys gelten für ein einzelnes Projekt. Das Standardprojekt, das mit Ihrem Konto angelegt wird, reicht vorerst; Sie können Workloads später auf mehrere Projekte aufteilen, ohne Keys zu rotieren.

## 2 · Region wählen {#region}

NimbusNexus läuft in vier Regionen:

| Region | Code | Status |
| --- | --- | --- |
| Virginia, US | `us-east-1` | Live |
| Los Angeles, US | `us-west-1` | Live |
| Frankfurt, DE | `eu-central-1` | Live |
| Singapur | `ap-southeast-1` | Pre-Launch |

Wählen Sie die Region, die Ihren Nutzern (oder Ihrer bestehenden Infrastruktur) am nächsten liegt. Traffic zwischen Regionen innerhalb von NimbusNexus ist kostenlos; Egress ins öffentliche Internet ist der einzige kostenpflichtige Transfer.

Die maßgebliche Liste können Sie jederzeit über die API abfragen:

```bash
curl {{API_BASE_URL}}/v1/regions \
  -H "Authorization: Bearer $NIMBUS_KEY"
```

## 3 · Erste VM erstellen {#first-vm}

Die kleinste VM, die für echte Arbeit taugt, ist eine `gp-1-2` — eine vCPU, 2 GB RAM, 25 GB SSD. Sie kostet etwa einen Cent pro Stunde. So starten Sie eine in Virginia:

```bash
curl -X POST {{API_BASE_URL}}/v1/vms \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "quickstart",
    "size": "gp-1-2",
    "region": "us-east-1",
    "image": "ubuntu-24.04"
  }'
```

Die Antwort enthält die ID der VM und ihren aktuellen Zustand. In den ersten Sekunden ist der Zustand `provisioning`, danach `running`:

```json
{
  "id": "vm_01H...",
  "name": "quickstart",
  "size": "gp-1-2",
  "region": "us-east-1",
  "image": "ubuntu-24.04",
  "state": "provisioning",
  "ipv4": null,
  "created_at": "2026-05-19T18:30:00Z"
}
```

Fragen Sie die VM einmal pro Sekunde ab, bis `state` `running` ist und `ipv4` befüllt ist — das dauert bei einem zwischengespeicherten Image etwa 28 Sekunden, beim ersten Laden 60–90 Sekunden.

## Zusammenfassung {#summary}

Sie haben einen API-Key generiert, eine Region gewählt und eine echte virtuelle Maschine bereitgestellt. Dasselbe Muster aus drei Aufrufen funktioniert für jede Ressource der API: `POST` zum Erstellen, `GET` zum Lesen, `DELETE` zum Löschen. Authentifizierung, Regionscodes und Ressourcen-IDs sind über alle Ressourcentypen hinweg stabil — die API ist so gebaut, dass Sie sie einmal lernen und auf alles anwenden können.

## Nächste Schritte {#next-steps}

- Durchsuchen Sie die **API-Referenz**, um jeden Endpoint mit Parametern, Request-/Response-Schemas und Fehlercodes zu sehen.
- Lesen Sie mehr zur **Authentifizierung**, um zu verstehen, wie API-Keys mit der Projektbindung, ablaufenden Tokens und der Signierung von Webhooks zusammenspielen.
- Lesen Sie die **Konventionen**, um die Muster kennenzulernen, denen die API überall folgt — Idempotenz, Paginierung, Fehlerformate, lang laufende Operationen.
- Probieren Sie den **interaktiven API-Explorer** unter [{{API_HOST}}/docs/external]({{API_BASE_URL}}/docs/external) aus — eine Swagger UI, die an die Live-API angebunden ist; „Try it out“ sendet echte Aufrufe an Ihr Konto.

Wenn Sie fertig sind, löschen Sie die VM, damit keine Kosten mehr anfallen:

```bash
curl -X DELETE {{API_BASE_URL}}/v1/vms/vm_01H... \
  -H "Authorization: Bearer $NIMBUS_KEY"
```
