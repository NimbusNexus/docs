---
title: "Authentification"
description: "Clés API, portées, frontières entre projets et rotation des clés en toute sécurité."
publishedAt: 2026-05-19
updatedAt: 2026-10-15
kind: concept
---

# Authentification

L’API NimbusNexus utilise des **clés API** comme tokens Bearer. Un seul mécanisme vaut pour tous les endpoints — pas de format de justificatif d’identité propre à chaque ressource, pas de schéma de signature à part pour les appels « avancés ». Si vous pouvez faire une requête authentifiée, vous pouvez toutes les faire.

## À quoi ressemble une requête {#request-shape}

Envoyez la clé dans le header `Authorization`. Le format est le mot `Bearer` tel quel, suivi de votre clé :

```bash
curl {{API_BASE_URL}}/v1/vms \
  -H "Authorization: Bearer nn_live_xxxxxxxxxxxxxxxx"
```

Le préfixe des clés dépend de l’environnement : `nn_live_*` pour la production, `nn_test_*` pour la sandbox. Après le préfixe viennent 32–48 caractères d’un alphabet compatible base32.

## Générer une clé {#generating}

Dans la console : **Settings → API keys → New key**. Vous ne voyez la valeur de la clé qu’une seule fois, à sa création ; copiez-la à ce moment-là. Ensuite, la console n’affiche que le préfixe + les 4 derniers caractères, pour que vous puissiez distinguer les clés sans exposer le secret.

Il n’existe volontairement aucune API pour créer des clés API. Une procédure de récupération après la compromission d’une clé a besoin d’un canal hors bande que la clé compromise ne peut pas atteindre — devoir passer par la console est le goulot d’étranglement qui rend cette récupération propre.

## Portée par projet {#project-scope}

Chaque clé API est propre à un **seul projet**. La clé peut lire et écrire les ressources de son projet ; elle ne peut pas voir les ressources des autres projets, même au sein du même compte.

Les projets sont l’unité de contrôle d’accès, de facturation et d’isolation. Le projet par défaut fourni avec un nouveau compte convient au développement individuel ; les équipes en production veulent généralement un projet par environnement (`prod`, `staging`, `dev`), pour qu’une clé de dev compromise ne puisse pas atteindre les données de production.

Changer de projet = générer une nouvelle clé dans le projet cible. Il n’existe aucun mécanisme du type « utiliser cette clé, mais faire comme si elle appartenait à un autre projet » ; cela éroderait la garantie d’isolation.

## Portées (capacités) {#scopes}

Les clés portent des **portées** qui limitent ce qu’elles peuvent faire dans leur projet. Par défaut, une nouvelle clé a la lecture+écriture sur tout le projet ; vous pouvez restreindre ses portées à la création, par exemple à `vms:read` seulement pour un agent de surveillance qui n’a jamais besoin de créer de ressources.

La liste complète des portées suit les types de ressources :

- `vms:read`, `vms:write`, `vms:create`, `vms:delete`
- `databases:read`, `databases:write`, …
- `block-storage:read`, `block-storage:write`, …
- `object-storage:read`, `object-storage:write`, …
- `iam:read`, `iam:write` (gérer les utilisateurs, les projets, les clés elles-mêmes)

Une requête vers un endpoint qui exige une portée que la clé ne porte pas renvoie `403 Forbidden` avec `error.code: 'forbidden'`, et `error.message` indique ce qui manquait. Il est donc peu coûteux de commencer avec des portées étroites et de ne les élargir que lorsque quelque chose échoue. (Des versions antérieures de cette page promettaient `scope_required`, avec la portée dans `error.fields.scope` ; l’API n’a jamais envoyé ni l’un ni l’autre.)

## Rotation {#rotation}

Vous pouvez faire tourner chaque clé indépendamment des autres. Faire tourner une clé :

1. Génère une nouvelle valeur de clé.
2. Marque l’ancienne clé comme **dépréciée**, mais la garde valide pendant **24 heures**.
3. Journalise l’utilisation des deux clés pendant cette fenêtre, pour que vous puissiez vérifier que la nouvelle clé est bien utilisée avant que l’ancienne ne cesse de fonctionner.

Pour une rotation automatisée (que nous recommandons), appelez l’API IAM pour faire tourner les clés selon un calendrier, et laissez le recouvrement de 24 heures absorber la fenêtre de déploiement. Les outils qui conservent la clé longtemps (CI/CD, agents déployés) doivent la relire au démarrage du processus, pour qu’une rotation se propage en l’espace d’un cycle de déploiement.

Si vous pensez qu’une clé est compromise, **révoquez-la** au lieu de la faire tourner — cela saute le délai de grâce de 24 heures et invalide immédiatement l’ancienne clé. La console permet de révoquer une clé en un clic ; il existe aussi un endpoint IAM pour une révocation d’urgence programmatique.

## Erreurs courantes {#errors}

Les API Webhooks et Inboxes répondent à un problème de justificatif avec ces codes. Elles diffèrent sur un point : `invalid_credential`, une clé que l’API ne reconnaît pas, est un `403` sur Webhooks et un `401` sur Inboxes.

| Statut    | error.code           | API      | Ce que cela signifie |
| --------- | -------------------- | -------- | -------------------- |
| 401       | `unauthorized`       | Les deux | Aucun justificatif n’a été envoyé (ni `Authorization` ni `X-API-Key`), ou la clé a été révoquée. |
| 401 / 403 | `invalid_credential` | Les deux | La clé ou le token n’est pas valide : un `401` sur Inboxes, un `403` sur Webhooks. Remplacez ce justificatif ; le renvoyer ne fonctionnera pas. |
| 403       | `forbidden`          | Les deux | La clé est valide, mais ne peut pas faire cela : une portée ou un rôle manquant, une clé limitée à certains projets utilisée en dehors de ceux-ci ou un produit qui n’est pas activé pour votre espace de travail. |

`message` indique le cas rencontré ; basez-vous sur `code`, pas sur le statut : `invalid_credential` est un `403` sur Webhooks et un `401` sur Inboxes. Traitez-le avec `unauthorized`, comme « ce justificatif ne vaut rien ».

Des versions antérieures de cette page listaient `no_credentials`, `invalid_credentials`, `expired_credentials`, `scope_required` et `wrong_project`. Les API n’ont jamais envoyé ces codes. Elles envoient `unauthorized` là où la page indiquait `no_credentials` ; `invalid_credential` là où elle indiquait `invalid_credentials` ou `expired_credentials`, puisqu’une clé expirée est une clé que l’API ne peut pas vérifier ; et `forbidden` là où elle indiquait `scope_required` ou `wrong_project`.

Les erreurs ci-dessus utilisent le format d’erreur standard décrit dans [Erreurs](/docs/errors).

## Étapes suivantes {#next-steps}

- Lisez [Conventions](/docs/conventions) pour les règles que suit chaque endpoint (identifiants de ressource, pagination, erreurs, idempotence).
- Lisez la [référence des machines virtuelles](/docs/api/vms) pour un exemple concret et complet d’API de ressource.
- Pour des configurations de service à service au sein de votre propre infrastructure, vous pouvez aussi créer des **délégations** entre projets — voir la référence IAM (bientôt disponible).
