---
title: "Moyens de paiement"
description: "Cartes enregistrées, comptes ACH et configuration du moyen de paiement par défaut."
publishedAt: 2026-05-21
updatedAt: 2026-05-21
kind: reference
openapiTag: payment-methods
---

# Moyens de paiement

Les moyens de paiement sont les cartes bancaires, les comptes ACH et (pour le niveau Enterprise) les profils de virement bancaire attachés à un compte. Un moyen est désigné comme moyen par défaut — c’est lui qui est débité pour la facture mensuelle. Les autres servent de solutions de repli (nous les essayons dans l’ordre si le moyen par défaut échoue).

Les données de carte ne passent jamais directement par NimbusNexus — la création d’un moyen de paiement passe par notre prestataire de paiement conforme à PCI (Stripe à ce jour), et nous ne stockons que la référence tokenisée + les métadonnées d’affichage (marque, quatre derniers chiffres, date d’expiration). Vous n’avez pas à vous soucier du périmètre PCI de votre côté tant que vous utilisez l’API ; aucun numéro de carte en clair n’apparaît dans les requêtes envoyées à NimbusNexus.

## Étapes suivantes {#next-steps}

- [Factures](/docs/api/invoices) — ce pour quoi les moyens de paiement sont débités.
- [Vue d’ensemble du compte](/docs/api/account-overview) — la configuration du contact de facturation.
