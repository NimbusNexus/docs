---
title: "Rechnungen"
description: "Monatsrechnungen — auflisten, abrufen, Aufschlüsselung ansehen."
publishedAt: 2026-05-21
updatedAt: 2026-05-21
kind: reference
openapiTag: invoices
---

# Rechnungen

Rechnungen werden monatlich am 1. des Folgemonats erstellt und decken den gesamten Verbrauch des vorherigen Kalendermonats ab. Jede Rechnung ist nach Ressource und Tag aufgeschlüsselt, sodass Sie jede Position auf bestimmte VMs / Volumes / Buckets / Datenbanken zurückführen können.

Dieser Endpoint bietet programmatischen Zugriff auf dieselben Daten, die das Dashboard zeigt. Anwendungsfälle: Rechnungspositionen in Ihr eigenes System zur Kostenzuordnung einspeisen, Rechnungen für steuerliche Zwecke archivieren, Rechnungen mit Ihrem Bestellbuch abgleichen.

Rechnungen gibt es auch als PDF — dasselbe Format, das in den meisten Rechtsordnungen für die steuerliche Geltendmachung verwendet wird. Das JSON-Format ist die maßgebliche Quelle; das PDF wird aus dem JSON erzeugt.

## Nächste Schritte {#next-steps}

- [Zahlungsmethoden](/docs/api/payment-methods) — womit Rechnungen bezahlt werden.
- [Preisdaten](/docs/api/pricing-data) — die Preise pro Ressource, aus denen sich die Rechnungssummen ergeben.
