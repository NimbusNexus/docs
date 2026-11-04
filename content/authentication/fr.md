---
title: "Authentification"
description: "Clés API, portées, frontières entre projets et rotation des clés en toute sécurité."
publishedAt: 2026-05-19
updatedAt: 2026-11-03
kind: concept
---

# Authentification

L’API NimbusNexus sur `{{API_HOST}}` prend une **clé API** dans le header `X-API-Key`. Chaque clé appartient à une personne et fonctionne dans un projet, avec les rôles et les règles d’accès avec lesquels elle a été créée.

## À quoi ressemble une requête {#request-shape}

Envoyez la clé dans le header `X-API-Key` :

```bash
curl {{API_BASE_URL}}/api/v1/instance/ \
  -H "X-API-Key: $NIMBUS_KEY"
```

La clé est la valeur `api_key` renvoyée à sa création : l’ID de la clé et son secret, joints par deux-points et encodés en base64. Une clé que l’API ne peut pas décoder ou ne reconnaît pas reçoit `401`.

## Générer une clé {#generating}

Créez une clé dans la console, ou avec `POST /api/v1/api_keys/` depuis une session connectée dont la portée est le projet de la clé. Donnez-lui un `name` unique parmi vos clés et, en option, une `description` et un `expires_at`. La réponse contient la clé une seule fois, dans `api_key` ; copiez-la à ce moment-là. Ensuite, l’API renvoie le nom, les rôles, les règles d’accès et l’expiration de la clé, mais jamais son secret.

## Portée par projet {#project-scope}

Chaque clé API est propre à un **seul projet**. La clé peut lire et écrire les ressources de son projet ; elle ne peut pas voir les ressources des autres projets, même au sein du même compte.

Les projets sont l’unité de contrôle d’accès et d’isolation ; la facturation se fait par espace de travail. Le projet par défaut fourni avec un nouveau compte convient au développement individuel ; les équipes en production veulent généralement un projet par environnement (`prod`, `staging`, `dev`), pour qu’une clé de dev compromise ne puisse pas atteindre les données de production.

Changer de projet = générer une nouvelle clé dans le projet cible. Il n’existe aucun mécanisme du type « utiliser cette clé, mais faire comme si elle appartenait à un autre projet » ; cela éroderait la garantie d’isolation.

## Ce qu’une clé peut faire {#scopes}

Une clé agit avec des **rôles** sur son projet, et des **règles d’accès** limitent les appels qu’elle peut faire :

- `roles` — les rôles avec lesquels la clé agit, choisis parmi ceux que vous détenez sur le projet. Sans ce champ, la clé les reçoit tous.
- `access_rules` — les appels que la clé peut faire. Chaque règle est un `service` (`api` pour cette API), une `method` et un `path`, par exemple `GET` et `/api/v1/instance/`. `GET /api/v1/api_keys/access_rules_artifacts` liste chaque méthode et chaque chemin que vous pouvez indiquer ; pour un chemin qui n’existe pas, la création de la clé répond `422`.
- `unrestricted: true` — aucune règle d’accès : la clé peut faire tout appel que ses rôles permettent.

Une clé sans règle d’accès et sans `unrestricted` ne peut que lire sa propre session (`GET /api/v1/account/get_session_auth_data`). Un appel hors des règles d’accès d’une clé reçoit `403`, avec le message « API key is restricted for this path! ». Il est donc peu coûteux de commencer avec des règles étroites et de n’ajouter des appels que lorsque l’un d’eux est refusé.

## Rotation {#rotation}

Il n’existe pas d’appel de rotation. Pour remplacer une clé, créez la nouvelle, passez vos outils dessus, puis supprimez l’ancienne avec `DELETE /api/v1/api_keys/{api_key_id}`. L’API vérifie la clé à chaque requête : une clé supprimée cesse donc de fonctionner dès son appel suivant. Les outils qui conservent la clé longtemps (CI/CD, agents déployés) doivent la relire au démarrage du processus, pour qu’une rotation se propage en l’espace d’un cycle de déploiement. Donnez aux clés un `expires_at`, pour qu’une clé oubliée cesse de fonctionner d’elle-même.

Si vous pensez qu’une clé est compromise, supprimez-la tout de suite, dans la console ou avec `DELETE /api/v1/api_keys/{api_key_id}` depuis une session connectée.

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
