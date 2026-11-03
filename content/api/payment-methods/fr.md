---
title: "Moyens de paiement"
description: "Cartes enregistrées et carte par défaut pour les recharges."
publishedAt: 2026-05-21
updatedAt: 2026-11-03
kind: reference
openapiTag: payment-methods
---

# Moyens de paiement

Les moyens de paiement sont les cartes que votre espace de travail a enregistrées. L’une d’elles est la carte par défaut pour les recharges, qui ajoutent des fonds au solde prépayé de l’espace de travail.

- `POST /api/v1/payment/payment_methods/setup-intent` lance l’enregistrement d’une carte. Il renvoie le `client_secret` d’un SetupIntent Stripe, et la carte est confirmée auprès de Stripe, 3-D Secure compris.
- `GET /api/v1/payment/payment_methods/` liste les cartes enregistrées, avec la marque, les quatre derniers chiffres, la date d’expiration, et laquelle est la carte par défaut.
- `POST /api/v1/payment/payment_methods/{payment_method_id}/set_default` fait d’une carte la carte par défaut pour les recharges, et `DELETE /api/v1/payment/payment_methods/{payment_method_id}` en supprime une.
- `POST /api/v1/payment/payment_methods/{payment_method_id}/add_funds` débite une carte pour recharger le solde. Quand la banque demande une confirmation, le résultat est `requires_action`, avec un `client_secret` à confirmer ; `POST /api/v1/payment/payment_methods/topups/{attempt_id}/sync` récupère ensuite l’issue.

Les données de carte ne passent jamais directement par NimbusNexus — la création d’un moyen de paiement passe par notre prestataire de paiement conforme à PCI (Stripe à ce jour), et nous ne stockons que la référence tokenisée + les métadonnées d’affichage (marque, quatre derniers chiffres, date d’expiration). Vous n’avez pas à vous soucier du périmètre PCI de votre côté tant que vous utilisez l’API ; aucun numéro de carte en clair n’apparaît dans les requêtes envoyées à NimbusNexus.

Ces appels exigent une session connectée, transmise par `Authorization: Bearer` ou par le cookie de session. Une clé API ne peut pas les effectuer.

## Étapes suivantes {#next-steps}

- [Facturation](/docs/api/invoices) — les soldes que rechargent ces cartes, et vos coordonnées de facturation.
- [Données tarifaires](/docs/api/pricing-data) — les tarifs par ressource à l’origine des frais.
