---
title: "Quotas"
description: "Limites par projet sur les VM, les vCPU, la RAM, le stockage, les IP flottantes et les autres ressources."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: reference
---

# Quotas

Les quotas sont des limites par projet qui bornent la quantité de chaque ressource qu’un projet peut détenir. Ils évitent les dépenses incontrôlées dues à des boucles accidentelles, et ils garantissent que la consommation d’un projet ne peut pas épuiser la capacité d’une région.

## Ce qui est soumis à quota {#what}

Chaque projet a un quota sur chacun des éléments suivants :

| Ressource | Quota par défaut | Notes |
| --- | --- | --- |
| VM | 50 | Par région ; une VM compte dans tous les états sauf `terminated` |
| vCPU | 200 | Total sur l’ensemble des VM en cours d’exécution |
| RAM (GB) | 800 | Total sur l’ensemble des VM en cours d’exécution |
| Stockage en bloc (GB) | 5,000 | Somme de tous les volumes (attachés + détachés) |
| Stockage objet (GB) | illimité | Limite souple uniquement : nous vous contactons au-delà de ~50 TB pour aligner les attentes |
| Snapshots | 200 | Par région ; les snapshots supprimés ne comptent pas |
| Sauvegardes | 500 | Par région |
| IP flottantes | 20 | Par région |
| Réseaux | 10 | Par région |
| Groupes de sécurité | 50 | Par région |
| Load balancers | 10 | Par région |
| Zones DNS | 50 | À l’échelle du projet |
| Utilisateurs | 25 | À l’échelle du projet |

Les valeurs par défaut sont prudentes. Les quotas de la plupart des projets de production sont relevés à 5–10× sur les axes les plus utilisés (vCPU, RAM, stockage) peu après le lancement.

## Quota et consommation {#quota-vs-usage}

Les endpoints exposent les deux :

- `GET /v1/quotas` — les **limites** (50 VM, 200 vCPU, etc.)
- `GET /v1/quotas/usage` — la **consommation actuelle** (12 VM utilisées sur 50, 48 vCPU sur 200, etc.)

Vérifiez toujours la consommation avant une création en masse ; une requête qui vous ferait dépasser le quota renvoie 429 avec un `Retry-After` vide (comme le quota n’est pas limité dans le temps, réessayer ne sert à rien — vous devez supprimer quelque chose ou augmenter le quota).

## Augmenter un quota {#raising}

Les augmentations de quota passent par le formulaire de contact du support, pas par l’API. Trois raisons :

1. **Planification de capacité.** Les fortes augmentations (10×+) nécessitent de réserver du matériel dans la région cible.
2. **Conformité.** Certaines augmentations de quota nécessitent une brève discussion sur le profil de la charge de travail.
3. **Prévention des abus.** Un endpoint d’augmentation de quota en libre-service serait la première chose qu’appellerait un compte compromis.

La plupart des augmentations sont accordées en moins d’un jour ouvré. Les migrations de production sont traitées le jour même si vous le signalez dans la demande.

## Quotas et régions {#regions}

La plupart des quotas sont **par région** (VM, snapshots, réseaux). Quelques-uns s’appliquent **à l’échelle du projet** (zones DNS, utilisateurs). La réponse de l’endpoint le précise explicitement — chaque entrée de quota porte un champ `scope` (`region: us-east-1` ou `project`).

## Étapes suivantes {#next-steps}

- [Projets](/docs/api/projects) — le conteneur auquel s’appliquent les quotas.
- [Authentification](/docs/authentication) — comment appeler ces endpoints.
- Le **formulaire de contact du support** sur [/contact/support]({{BASE_URL}}/contact/support) — là où se font les augmentations de quota.
