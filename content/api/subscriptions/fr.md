---
title: "Abonnements"
description: "Niveau de plan, cycle de facturation et endpoints pour passer à un plan supérieur ou inférieur."
publishedAt: 2026-05-21
updatedAt: 2026-05-21
kind: reference
openapiTag: subscriptions
---

# Abonnements

Votre abonnement, c’est l’ensemble niveau de plan + cycle de facturation + configuration de paiement qui détermine tout ce qui est facturable sur le compte. Les niveaux de plan (Free, Starter, Production, Enterprise) déterminent le SLA du support, les quotas par défaut, le crédit inclus et l’accès à certaines régions. Le cycle de facturation (mensuel, annuel) fixe le rythme des factures ; la facturation annuelle donne droit à une remise par rapport à la facturation mensuelle.

Les passages à un plan supérieur prennent effet immédiatement ; les passages à un plan inférieur prennent effet à la fin du cycle de facturation en cours, pour éviter les litiges de prorata en milieu de mois. Les plans Enterprise sont négociés et provisionnés manuellement ; l’API prend en charge les niveaux jusqu’à Production, mais transmet les demandes de plan Enterprise au contact commercial.

## Étapes suivantes {#next-steps}

- [Factures](/docs/api/invoices) — ce que produisent les abonnements.
- [Moyens de paiement](/docs/api/payment-methods) — ce qui est débité au titre de l’abonnement.
- [Vue d’ensemble du compte](/docs/api/account-overview) — le contexte plus large du compte.
