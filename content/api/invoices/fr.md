---
title: "Factures"
description: "Les factures mensuelles — listez-les, récupérez-les, consultez leur détail."
publishedAt: 2026-05-21
updatedAt: 2026-05-21
kind: reference
openapiTag: invoices
---

# Factures

Les factures sont générées chaque mois, le 1er du mois suivant, et couvrent toute la consommation du mois calendaire précédent. Chaque facture est détaillée par ressource et par jour, ce qui vous permet de rattacher n’importe quelle ligne à des VM / volumes / buckets / bases de données précis.

Cet endpoint donne un accès programmatique aux mêmes données que la console. Cas d’usage : alimenter votre propre système d’attribution des coûts avec les lignes des factures, archiver les factures à des fins fiscales, faire le rapprochement avec votre registre de bons de commande.

Les factures sont aussi disponibles en PDF — le format utilisé pour les déclarations de déductions fiscales dans la plupart des juridictions. Le format JSON est la source de référence ; le PDF est généré à partir du JSON.

## Étapes suivantes {#next-steps}

- [Moyens de paiement](/docs/api/payment-methods) — ce qui sert à régler les factures.
- [Données tarifaires](/docs/api/pricing-data) — les tarifs par ressource qui aboutissent aux totaux des factures.
