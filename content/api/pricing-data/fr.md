---
title: "Données tarifaires"
description: "Accès programmatique à la grille tarifaire de référence. En lecture seule."
publishedAt: 2026-05-21
updatedAt: 2026-05-21
kind: reference
openapiTag: pricing-data
---

# Données tarifaires

L’endpoint des données tarifaires est un flux en lecture seule de la grille tarifaire de référence de NimbusNexus — tailles de VM par famille, classes de stockage en bloc, tiers de stockage objet, tarifs d’egress, multiplicateurs par moteur de base de données managée, absolument tout. Les mêmes données alimentent les pages de tarifs du site marketing et les projections de coûts de la console.

Cas d’usage : intégrer des estimations de coûts en temps réel dans votre processus de provisionnement (afficher « cette VM coûtera $X/mois » avant que l’utilisateur clique sur Launch), construire des outils internes d’attribution des coûts, ou simplement tenir votre propre tableur « ce que NimbusNexus facture pour X en ce moment ».

Les prix sont exprimés en USD et changent chaque fois que nous ajustons la grille tarifaire publiée (c’est rare — en général une ou deux fois par an, et nous prévenons par e-mail 30 jours avant toute hausse).

## Étapes suivantes {#next-steps}

- [Factures](/docs/api/invoices) — ce que donnent les prix en pratique.
- [Optimiser votre facture mensuelle](/docs/guides/cost-optimization) — le guide de stratégie pour réduire votre facture.
- La [page des tarifs du site marketing]({{BASE_URL}}/pricing) — la version lisible par un humain de ces données.
