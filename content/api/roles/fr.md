---
title: "Rôles"
description: "Rôles intégrés et personnalisés, et les endpoints d’attribution qui donnent à un utilisateur un rôle sur un projet."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: reference
---

# Rôles

Un rôle est un ensemble de permissions. **L’attribution de rôle** consiste à accorder un rôle à un utilisateur sur un projet. Un même utilisateur peut détenir des rôles différents sur des projets différents ; un utilisateur sans rôle sur un projet ne peut pas le voir du tout.

## Rôles intégrés {#built-in}

Chaque projet est livré avec quatre rôles intégrés que vous pouvez attribuer sans rien définir de personnalisé :

| Rôle | Ce que le rôle permet |
| --- | --- |
| **`viewer`** | Lire toutes les ressources. Aucune écriture, aucune suppression. Adapté aux outils de supervision, aux auditeurs. |
| **`editor`** | Créer + modifier la plupart des ressources. Ne peut pas gérer l’IAM (utilisateurs, rôles, clés). Adapté aux développeurs au quotidien. |
| **`admin`** | Tout ce que peut faire `editor`, plus l’IAM. Peut créer des utilisateurs, accorder/révoquer des rôles, gérer les clés API. |
| **`billing-admin`** | Lire les factures, changer le moyen de paiement, consulter + augmenter les quotas. Aucun accès aux ressources. Adapté à la finance. |

Le rôle `admin` n’inclut **pas** `billing-admin`, et inversement. C’est voulu — l’ingénieur qui pilote l’API ne doit pas être aussi celui qui approuve la facture.

## Rôles granulaires {#granular}

Au-delà des quatre rôles intégrés, nous fournissons des rôles granulaires par ressource pour les cas où `editor` en donne trop :

- `vms:operator` — créer / démarrer / arrêter / détruire des VM uniquement, pas de réseau
- `storage:operator` — gérer les volumes, buckets, snapshots, sauvegardes
- `dns:admin` — gestion complète des zones + enregistrements DNS ; rien d’autre
- `networking:admin` — réseaux, sous-réseaux, groupes de sécurité, IP flottantes, LB
- `databases:admin` — bases de données managées + leurs sauvegardes

Vous les attribuez de la même manière que les rôles intégrés, via `POST /v1/role-assignments`.

## Rôles personnalisés {#custom}

Définissez les vôtres via `POST /v1/roles` (absent de l’exemple minimal ci-dessous) en listant les permissions à regrouper. Les noms de permission suivent le format `<resource>:<action>` — par exemple `vms:read`, `volumes:create`, `databases:snapshot`. Le catalogue complet des permissions est disponible via `GET /v1/permissions`.

Cas d’usage des rôles personnalisés : « tout lire sauf la facturation » pour un auditeur de sécurité ; « gérer les enregistrements DNS mais pas les zones » pour une équipe marketing qui gère le contenu des sous-domaines mais pas la délégation de zone.

## Comment se combinent les attributions de rôles {#compose}

Un utilisateur peut détenir plusieurs attributions de rôles sur un même projet. L’ensemble de permissions effectif est l’**union** — la liste des rôles est additive, pas multiplicative. Accorder `viewer` + `vms:operator` au même utilisateur lui donne la lecture sur tout + l’écriture sur les VM en particulier.

Révoquer un rôle ne révoque pas les autres. Pour retirer complètement les droits d’un utilisateur, supprimez chaque attribution une par une, ou supprimez l’utilisateur (ce qui révoque toutes les attributions de façon atomique).

## Étapes suivantes {#next-steps}

- [Utilisateurs](/docs/api/users) — à qui vous accordez des rôles.
- [Projets](/docs/api/projects) — sur quoi vous accordez des rôles.
- [Authentification](/docs/authentication) — comment les clés API correspondent aux rôles des utilisateurs.
