---
title: "Zahlungsmethoden"
description: "Gespeicherte Karten, ACH-Konten und die Einstellung der Standard-Zahlungsmethode."
publishedAt: 2026-05-21
updatedAt: 2026-05-21
kind: reference
openapiTag: payment-methods
---

# Zahlungsmethoden

Zahlungsmethoden sind die Bankkarten, ACH-Konten und (im Tarif Enterprise) Überweisungsprofile, die in einem Konto hinterlegt sind. Eine Methode ist als Standard festgelegt — sie wird für die Monatsrechnung belastet. Die anderen dienen als Ausweichmethoden (schlägt die Standardmethode fehl, versuchen wir sie der Reihe nach).

Kartendaten erreichen NimbusNexus nie direkt — das Anlegen einer Zahlungsmethode läuft über unseren PCI-konformen Zahlungsdienstleister (derzeit Stripe), und wir speichern nur die tokenisierte Referenz + Anzeigemetadaten (Marke, letzte vier Ziffern, Ablaufdatum). Solange Sie die API verwenden, müssen Sie sich auf Ihrer Seite keine Gedanken um den PCI-Scope machen; Kartennummern im Klartext erscheinen in keinem Request an NimbusNexus.

## Nächste Schritte {#next-steps}

- [Rechnungen](/docs/api/invoices) — wofür Zahlungsmethoden belastet werden.
- [Kontoübersicht](/docs/api/account-overview) — die Einstellung des Abrechnungskontakts.
