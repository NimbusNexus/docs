---
title: "Zahlungsmethoden"
description: "Gespeicherte Karten und die Standardkarte für Aufladungen."
publishedAt: 2026-05-21
updatedAt: 2026-11-03
kind: reference
openapiTag: payment-methods
---

# Zahlungsmethoden

Zahlungsmethoden sind die Karten, die Ihr Workspace gespeichert hat. Eine davon ist die Standardkarte für Aufladungen, mit denen Sie das Prepaid-Guthaben des Workspaces aufstocken.

- `POST /api/v1/payment/payment_methods/setup-intent` beginnt das Speichern einer Karte. Der Aufruf gibt das `client_secret` eines Stripe-SetupIntents zurück, und die Karte wird bei Stripe bestätigt, einschließlich 3-D Secure.
- `GET /api/v1/payment/payment_methods/` listet die gespeicherten Karten auf, mit Marke, letzten vier Ziffern, Ablaufdatum und der Angabe, welche die Standardkarte ist.
- `POST /api/v1/payment/payment_methods/{payment_method_id}/set_default` macht eine Karte zur Standardkarte für Aufladungen, und `DELETE /api/v1/payment/payment_methods/{payment_method_id}` entfernt eine.
- `POST /api/v1/payment/payment_methods/{payment_method_id}/add_funds` belastet eine Karte, um das Guthaben aufzuladen. Verlangt die Bank eine Bestätigung, lautet das Ergebnis `requires_action`, mit einem `client_secret` zum Bestätigen; `POST /api/v1/payment/payment_methods/topups/{attempt_id}/sync` holt danach den Ausgang ab.

Kartendaten erreichen NimbusNexus nie direkt — das Anlegen einer Zahlungsmethode läuft über unseren PCI-konformen Zahlungsdienstleister (derzeit Stripe), und wir speichern nur die tokenisierte Referenz + Anzeigemetadaten (Marke, letzte vier Ziffern, Ablaufdatum). Solange Sie die API verwenden, müssen Sie sich auf Ihrer Seite keine Gedanken um den PCI-Scope machen; Kartennummern im Klartext erscheinen in keinem Request an NimbusNexus.

Diese Aufrufe brauchen eine angemeldete Sitzung, gesendet als `Authorization: Bearer` oder als Sitzungs-Cookie. Ein API-Key kann sie nicht ausführen.

## Nächste Schritte {#next-steps}

- [Abrechnung](/docs/api/invoices) — die Guthaben, die diese Karten aufladen, und Ihre Rechnungsdaten.
- [Preisdaten](/docs/api/pricing-data) — die Preise pro Ressource hinter den Kosten.
