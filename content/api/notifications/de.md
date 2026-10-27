---
title: "Benachrichtigungen"
description: "Benachrichtigungseinstellungen pro Konto — worüber wir Sie per E-Mail informieren und was über Webhooks geleitet wird."
publishedAt: 2026-05-21
updatedAt: 2026-05-21
kind: reference
openapiTag: notifications
---

# Benachrichtigungen

Benachrichtigungseinstellungen legen fest, welche Events eine E-Mail an welchen Kontakt auslösen und welche stattdessen (oder zusätzlich) eine Webhook-Zustellung auslösen. Zu den Kategorien gehören Abrechnungs-Alerts, Sicherheits-Events, Kontingentwarnungen, Ankündigungen geplanter Wartungen und Veröffentlichungen neuer Funktionen.

Die Standardeinstellungen sind vernünftig — Abrechnung und Sicherheit gehen unabhängig von den Einstellungen immer an den Abrechnungs- bzw. Sicherheitskontakt. Konfigurierbar sind die betrieblichen Kategorien: Wartungsfenster, Kontingent-Schwellenwerte, Ankündigungen von Beta-Funktionen usw.

Für größere Teams ist das typische Muster, betriebliche Benachrichtigungen per Webhook in Ihr Incident-Management-System (PagerDuty, Opsgenie) zu leiten statt per E-Mail an einen einzelnen Kontakt. Der Webhook-Weg hier verwendet dieselbe Zustellsemantik wie auf der Seite [Plattform-Webhooks](/docs/webhooks) beschrieben.

## Nächste Schritte {#next-steps}

- [Plattform-Webhooks](/docs/webhooks) — der Zustellkanal für alles, was nicht per E-Mail geht.
- [Kontoübersicht](/docs/api/account-overview) — wo die Abrechnungs- und Sicherheitskontakte hinterlegt sind.
