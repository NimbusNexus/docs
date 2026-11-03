---
title: "Données tarifaires"
description: "Accès programmatique à la grille tarifaire de référence. En lecture seule."
publishedAt: 2026-05-21
updatedAt: 2026-11-03
kind: reference
openapiTag: pricing-data
---

# Données tarifaires

Les endpoints des données tarifaires sont un flux en lecture seule de ce que facture NimbusNexus, avec un endpoint par type de ressource :

- `GET /api/v1/pricing/vm` — les tailles de VM. `architecture` et `vm_class` sont obligatoires ; `cpu` et `ram` restreignent la liste.
- `GET /api/v1/pricing/storage` — le stockage en bloc, pour un `volume_type` donné.
- `GET /api/v1/pricing/port`, `/api/v1/pricing/floating_ip` et `/api/v1/pricing/image` — les ports réseau, les IP flottantes et le stockage des images.
- `GET /api/v1/pricing/bandwidth` — la bande passante sortante.

Chaque prix est accompagné de sa période de facturation : unique, horaire, journalière, mensuelle ou annuelle. Vous n’avez pas besoin de vous connecter pour les lire. Un appelant dont la portée est l’un de vos projets voit les prix qui s’appliquent à votre espace de travail ; tout autre appelant voit les prix catalogue.

Cas d’usage : intégrer des estimations de coûts en temps réel dans votre processus de provisionnement (afficher « cette VM coûtera $X/mois » avant que l’utilisateur clique sur Launch), construire des outils internes d’attribution des coûts, ou simplement tenir votre propre tableur « ce que NimbusNexus facture pour X en ce moment ».

Les prix sont exprimés en USD.

## Étapes suivantes {#next-steps}

- [Facturation](/docs/api/invoices) — vos soldes et les frais pas encore réglés.
- [Optimiser votre facture mensuelle](/docs/guides/cost-optimization) — le guide de stratégie pour réduire votre facture.
- La [page des tarifs du site marketing]({{BASE_URL}}/pricing) — la version lisible par un humain de ces données.
