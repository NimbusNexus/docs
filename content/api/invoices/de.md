---
title: "Abrechnung"
description: "Salden, offene Kosten, Aktionsguthaben und Rechnungsdaten Ihres Workspaces."
publishedAt: 2026-05-21
updatedAt: 2026-11-03
kind: reference
openapiTag: invoices
---

# Abrechnung

Abgerechnet wird pro Workspace. Diese Endpoints lesen, wie das Konto des Workspaces steht, und pflegen seine Rechnungsdaten:

- `GET /api/v1/billing/public/balances` — ausstehende Postpaid-Kosten, verfügbares Aktionsguthaben und das Prepaid-Guthaben, in einer Momentaufnahme.
- `GET /api/v1/billing/public/accrued_charges` — die Summe der bisher angefallenen Kosten, die noch nicht beglichen sind.
- `GET /api/v1/billing/public/cash_balance` — das Prepaid-Guthaben, mit dem Zeitpunkt seiner letzten Änderung.
- `GET /api/v1/billing/public/promotion_grants` — aktives Aktionsguthaben, mit dem Restbetrag jeder Gutschrift und ihrem Ablaufdatum.
- `GET` und `PATCH /api/v1/billing/public/billing_info` — die Rechnungsadresse, der Firmenname und die E-Mail-Adressen, die Kontoauszüge und Zahlungsbelege erhalten.

Die Rechnungen selbst sind über die API nicht verfügbar.

Diese Aufrufe brauchen eine angemeldete Sitzung, gesendet als `Authorization: Bearer` oder als Sitzungs-Cookie. Ein API-Key kann sie nicht ausführen.

## Nächste Schritte {#next-steps}

- [Zahlungsmethoden](/docs/api/payment-methods) — die Karten, mit denen das Prepaid-Guthaben aufgeladen wird.
- [Preisdaten](/docs/api/pricing-data) — die Preise pro Ressource hinter den Kosten.
