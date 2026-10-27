---
title: "Abonnements"
description: "Tarif, Abrechnungszeitraum sowie Endpoints für Upgrade und Downgrade."
publishedAt: 2026-05-21
updatedAt: 2026-05-21
kind: reference
openapiTag: subscriptions
---

# Abonnements

Ihr Abonnement ist die Kombination aus Tarif + Abrechnungszeitraum + Zahlungskonfiguration, die alles Abrechenbare im Konto bestimmt. Die Tarife (free, starter, production, enterprise) bestimmen das Support-SLA, die Standardkontingente, das enthaltene Guthaben und den Zugriff auf bestimmte Regionen. Der Abrechnungszeitraum (monatlich, jährlich) legt fest, wie oft Rechnungen kommen; jährliche Abrechnung ist gegenüber monatlicher rabattiert.

Upgrades des Tarifs gelten sofort; Downgrades gelten zum Ende des aktuellen Abrechnungszeitraums, um Streit über anteilige Abrechnung mitten im Monat zu vermeiden. Enterprise-Tarife werden individuell verhandelt und manuell eingerichtet; die API unterstützt Tarife bis einschließlich Production, leitet Anfragen für Enterprise aber an den Vertrieb weiter.

## Nächste Schritte {#next-steps}

- [Rechnungen](/docs/api/invoices) — was Abonnements erzeugen.
- [Zahlungsmethoden](/docs/api/payment-methods) — worüber das Abonnement abgerechnet wird.
- [Kontoübersicht](/docs/api/account-overview) — der größere Kontext des Kontos.
