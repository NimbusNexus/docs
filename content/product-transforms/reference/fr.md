---
title: "Référence Transforms"
description: "Chaque route de l’API Transforms, les objets pipeline et exécution, qui peut faire quoi, les limites de chaque plan et les erreurs."
publishedAt: 2026-11-06
updatedAt: 2026-11-11
kind: reference
---

# Référence Transforms

L’API à `https://transforms.nimbusnexus.net/v1` crée, versionne, teste et exécute des pipelines, pour votre espace de travail uniquement. Les requêtes et les réponses sont en JSON. Envoyez une clé sous la forme `Authorization: Bearer <key>` ou `X-API-Key: <key>` ([Obtenir l’accès](/docs/product-transforms#access)). Les timestamps sont en ISO 8601, en UTC. La [vue d’ensemble](/docs/product-transforms) explique le produit, et [Pipelines](/docs/product-transforms/pipelines) le document.

## Routes {#routes}

| Route | Ce qu’elle fait | Exige |
| --- | --- | --- |
| `POST /v1/pipelines` | Crée un pipeline et sa version 1 ; `201` avec [le pipeline](#pipeline) | write ; avec une étape de justificatif, admin |
| `GET /v1/pipelines` | Les pipelines de l’espace de travail, du plus récent au plus ancien, chacun sans son document | read |
| `GET /v1/pipelines/{id}` | Un pipeline, avec son document actuel et l’endroit où il s’exécute | read |
| `PATCH /v1/pipelines/{id}` | Renomme un pipeline, l’active ou le désactive, ou [enregistre une nouvelle version](#versions) | write ; avec une nouvelle étape de justificatif, admin |
| `DELETE /v1/pipelines/{id}` | Supprime un pipeline et ses versions, définitivement ; `204` | admin |
| `GET /v1/pipelines/{id}/versions` | Les versions conservées, de la plus récente à la plus ancienne, chacune sans son document | read |
| `GET /v1/pipelines/{id}/versions/{version}` | Une version, avec son document | read |
| `POST /v1/pipelines/{id}/run` | [Exécute](#run) un pipeline enregistré sur une requête | read |
| `POST /v1/pipelines/test` | [Teste](#test) un document sur une requête, sans rien enregistrer ni compter | write |
| `GET /v1/pipelines/templates` | Les [modèles](/docs/product-transforms/pipelines#templates) dont un pipeline peut partir | read |
| `POST /v1/slots` | Ajoute un [emplacement de justificatif](#slots) ; `201` avec l’emplacement | admin |
| `GET /v1/slots`, `GET /v1/slots/{id}` | Les emplacements de l’espace de travail, du plus récent au plus ancien, ou l’un d’eux | read |
| `PATCH /v1/slots/{id}` | Renomme un emplacement | admin |
| `DELETE /v1/slots/{id}` | Supprime un emplacement ; `204` | admin |
| `GET /v1/plan` | Le plan de l’espace de travail et ses limites | read |
| `GET /v1/usage` | Les exécutions de ce mois et ce que détient l’espace de travail | read |

**read**, **write** et **admin** sont expliqués dans [Qui peut faire quoi](#authority).

Les listes sont paginées avec `limit` (de 1 à 200, 50 par défaut) et `offset` (de 0 à 10,000). La réponse est `{"items": [...], "next_offset": <offset>}` : renvoyez `next_offset` comme `offset` pour obtenir la page suivante. Il vaut `null` sur la dernière page. `GET /v1/pipelines/templates` fait exception : cette route ne prend ni `limit` ni `offset` et répond avec tous les modèles dans un seul tableau simple.

## L’objet pipeline {#pipeline}

| Champ | Description |
| --- | --- |
| `id` | `pipe_` suivi de 24 caractères hexadécimaux. Chaque route l’attend, et un produit désigne le pipeline par cet identifiant. |
| `name` | Le nom que vous lui donnez, jusqu’à 200 caractères. |
| `status` | `enabled` ou `disabled` : votre interrupteur. Un pipeline désactivé ne s’exécute pas, ni ici ni dans aucun produit qui y fait référence. |
| `current_version` | La version qui s’exécute. |
| `pipeline` | Le document de la version actuelle ; `null` dans la liste. |
| `destinations` | Les services qui l’exécutent par référence, chacun une fois ; `null` dans la liste ([Qui exécute un pipeline](#destinations)). |
| `consumers` | Ce que chacun d’eux exécute : `service`, `version`, `last_seen_at`, sa dernière lecture de cette version, et `pinned`, `true` quand une référence fige cette version ; `null` dans la liste. |
| `created_at`, `updated_at` | Sa date de création, et celle de sa dernière modification. |

`POST /v1/pipelines` prend `name` et `pipeline`. Un document qui ne pourrait jamais s’exécuter est refusé avec [`422` `invalid_pipeline`](#invalid-pipeline), et au-delà des pipelines du plan, la réponse est `402` `quota_exceeded`, avec `details.metric` `pipelines`, `details.limit` et `details.current`.

## Versions {#versions}

`PATCH /v1/pipelines/{id}` prend `name`, `status` et `pipeline`, seuls ou combinés. Un nouveau `pipeline` est vérifié comme à la création, et enregistré comme version suivante.

- Une version ne change jamais : un produit peut donc conserver sa copie par identifiant et par version.
- Enregistrer le même contenu n’ajoute aucune version.
- Restaurer une ancienne version revient à enregistrer de nouveau son contenu, ce qui en fait la plus récente.
- Les versions conservées sont celles que prévoit le plan, les plus récentes d’abord, et un enregistrement retire les plus anciennes au-delà. Une version qu’un produit fige est également conservée, tout comme les cinq versions antérieures qu’un produit a été vu exécuter le plus récemment au cours des 30 derniers jours.

Chaque version dans `GET /v1/pipelines/{id}/versions` a `version`, `created_by` et `created_at` ; `GET /v1/pipelines/{id}/versions/{version}` y ajoute son `pipeline`. Une version qui n’est plus conservée répond `404` `not_found`, `pipeline_version`.

## Exécuter un pipeline {#run}

`POST /v1/pipelines/{id}/run` exécute la version actuelle, ou la version conservée que nomme `version`, sur ce que vous envoyez :

| Champ | Description |
| --- | --- |
| `body` | N’importe quelle valeur JSON, jusqu’à 256 KiB en JSON compact et avec au plus 32 niveaux d’imbrication. |
| `headers` | Une valeur par nom, 256 au plus. Un nom fait jusqu’à 256 caractères et une valeur jusqu’à 8,192. Au-delà, la réponse est `422` `validation_error`. |
| `meta` | Contexte en lecture seule pour `$meta` : n’importe quelle valeur JSON, avec au plus 32 niveaux d’imbrication. |
| `version` | La version conservée à exécuter. Sans ce champ, la version actuelle. |

Rien de la requête n’est conservé, et l’exécution est comptée. La réponse est un `200`, quoi qu’ait fait le pipeline :

| Champ | Description |
| --- | --- |
| `status` | `ok` : envoyez `body` et `headers` ; `dropped` : un filtre l’a abandonnée, n’envoyez donc rien ; `failed` : le pipeline ne peut pas s’exécuter sur cette requête. |
| `version` | La version qui s’est exécutée ; `null` pour un [test](#test). |
| `body`, `body_changed` | Le corps à envoyer, et `true` quand une étape l’a réécrit. `null` sauf avec `ok`. |
| `headers` | Les headers à envoyer, la valeur d’un justificatif étant masquée sous la forme `Bearer ••••`. |
| `query` | Ce qu’une étape `auth` ajoute à l’URL, masqué de la même façon. |
| `step` | L’étape qui l’a abandonnée ou l’a fait échouer, comptée à partir de 0 ; sinon `null`. |
| `note` | La note de l’étape qui l’a abandonnée. |
| `reason` | `no_match` pour un filtre auquel la requête ne correspondait pas, `matched` pour un filtre d’abandon auquel elle correspondait, ou la raison de l’échec, comme `set_conflict` ou `too_many_nodes`. Traitez-la comme une chaîne ouverte. |
| `error` | La même chose en toutes lettres, comme `step 2: set_conflict: …`. |
| `duration_ms` | La durée de l’exécution. |

Le même pipeline échoue de la même façon sur la même requête : ne réessayez donc pas un `failed`. Un pipeline désactivé répond `409` `conflict`, `pipeline_disabled`, et au-delà du débit du plan, ou avec trop d’exécutions ou de tests de l’espace de travail en cours à la fois, une exécution répond `429` `rate_limited`, avec `details.retry_after`.

## Tester un document {#test}

`POST /v1/pipelines/test` prend `pipeline`, un document qui n’a pas besoin d’être enregistré, avec `body`, `headers` et `meta`. Il est vérifié comme à l’enregistrement, s’exécute une fois et n’enregistre ni ne compte rien, mais il partage le débit du plan. Un abandon ou un échec donne un `200` qui l’indique.

## Emplacements de justificatifs {#slots}

Un emplacement est ce que nomme une étape `auth` : un identifiant et un libellé, sans valeur. Transforms ne stocke aucun justificatif, et aucune route n’en prend. Un produit qui exécute le pipeline par référence associe l’emplacement à un secret qui lui est propre ([Justificatifs d’identité](/docs/product-transforms#credentials)). `POST /v1/slots` prend `label`, jusqu’à 200 caractères, et répond `201` :

| Champ | Description |
| --- | --- |
| `id` | `sec_` suivi de lettres et de chiffres : ce que nomme une étape `auth`. Il ne change jamais. |
| `label` | À quoi sert le justificatif. Les produits le voient quand ils associent l’emplacement à un secret. |
| `pipeline_count` | Le nombre de pipelines dont la version actuelle le nomme. |
| `created_at`, `updated_at` | Le moment où il a été ajouté, et celui où il a été renommé pour la dernière fois. |

`PATCH /v1/slots/{id}` prend `label`. `DELETE /v1/slots/{id}` répond `204`, ou `409` `conflict` avec `details.reason` `slot_in_use`, `details.id` et `details.pipelines`, le nombre de pipelines, tant que la version actuelle d’un pipeline le nomme. Au-delà des emplacements du plan, en ajouter un répond `402` `quota_exceeded`, avec `details.metric` `slots`.

## Qui exécute un pipeline {#destinations}

Un produit désigne un pipeline par son identifiant et l’exécute dans son propre processus, avec ses propres secrets. Webhooks est le premier : [Transformations](/docs/product-webhooks/transformations#reference). Chaque récupération du pipeline note le service et la version : sa lecture montre donc `destinations` et `consumers`.

L’enregistrement d’une nouvelle version avec une étape `auth` se répercute sur chaque produit qui exécute le pipeline, tout comme sa suppression. Chacun de ces appels doit nommer dans `confirm_destinations` chaque service qui détient une référence ou a été vu au cours des 30 derniers jours : dans le corps d’un `PATCH` et dans la query string d’un `DELETE`. Sinon, c’est un `409` `conflict` avec `details.reason` `destinations_unconfirmed` et `details.destinations`, et rien ne change. Les URL propres à un service ne figurent jamais ici : c’est ce produit qui pose la même question à leur sujet.

## Qui peut faire quoi {#authority}

| | Lire les pipelines, les versions, les modèles, les emplacements, le plan et la consommation ; exécuter | Créer, modifier et tester des pipelines | Supprimer un pipeline, enregistrer une étape de justificatif, ou ajouter, renommer ou supprimer un emplacement |
| --- | --- | --- | --- |
| Propriétaire ou admin de l’espace de travail | oui | oui | oui |
| Membre | oui | oui | non |
| Lecteur, ou tout autre rôle | oui | non | non |
| Clé avec **Read & write** (portée `admin`) | oui | oui | oui |
| Clé avec **Read** (portée `read`) | oui | non | non |

Une action refusée répond `403` `forbidden` avec `details.reason` `role`, et `details.required` nomme le rôle nécessaire. Un membre peut toujours renommer un pipeline qui a une étape de justificatif, l’exécuter, le tester et retirer cette étape. La console de compte crée des clés **Read** et **Read & write**, et une clé de toute autre portée, comme `write`, est traitée comme **Read**.

Transforms sert des espaces de travail entiers. Un siège invité, ou une clé limitée à un projet, est refusé avec `403` `project_confined`. Un espace de travail dispose de Transforms dès qu’un propriétaire ou un admin a ouvert la console, ou l’a ajouté depuis **Add a product**. D’ici là, les autres membres sont refusés avec `403` `product_not_enabled`.

## Plans et limites {#limits}

`GET /v1/plan` indique quelles limites s’appliquent : `plan`, le plan enregistré ; `enforced_as`, le plan dont les limites s’appliquent, `free` s’il n’y en a pas ; `ceilings`, les limites par nom ; `past_due`, `suspended` et `system`.

| Clé de `ceilings` | Description | Free | Starter | Pro | Custom |
| --- | --- | --- | --- | --- | --- |
| `max_pipelines` | Pipelines qu’un espace de travail peut détenir | 5 | 25 | 100 | 1,000 |
| `max_secret_slots` | Emplacements de justificatifs qu’un espace de travail peut détenir | 5 | 25 | 100 | 1,000 |
| `max_versions` | Versions conservées par pipeline | 10 | 25 | 50 | 100 |
| `run_rate_per_min` | Exécutions et tests par minute, par espace de travail | 60 | 600 | 3,000 | 12,000 |

Jusqu’à l’équivalent de dix secondes d’exécutions, et au moins 10 exécutions, peuvent arriver coup sur coup. Un espace de travail a en outre au plus deux exécutions ou tests en cours à la fois dans chaque processus serveur, et un de plus n’est pas mis en file d’attente mais refusé, avec `429` `rate_limited` et `details.retry_after` 1. `GET /v1/usage` indique ce qui est utilisé : `period`, le mois, sous la forme de son premier jour ; `runs`, `failures` et `dropped` de ce mois, via l’API d’exécution ; `pipelines`, à comparer à `max_pipelines` ; et `slots`, les emplacements détenus, à comparer à `max_secret_slots`. Les exécutions sont comptées, pas facturées, et une exécution dans un produit qui fait référence au pipeline compte dans la consommation de ce produit.

Tant qu’un impayé n’est pas réglé, les modifications sont refusées avec `402` `workspace_frozen`, et les exécutions et les tests continuent. Une fois le délai de grâce écoulé, les exécutions et les tests sont refusés à leur tour, avec `402` `workspace_suspended`. Les lectures et les suppressions restent possibles.

## Erreurs {#errors}

Les erreurs de l’API suivent le format décrit dans [Erreurs](/docs/errors).

| Statut | `code` | Quand |
| --- | --- | --- |
| `400` | `bad_request` | Un corps JSON qui n’est pas de l’UTF-8 valide. |
| `401` | `unauthorized` | Aucun justificatif d’identité, un justificatif révoqué, ou une connexion à la console qui a pris fin ; `details.reason` précise lequel. |
| `401` | `invalid_credential` | Une clé qui ne se vérifie pas, a expiré, ou a été créée pour un autre produit. |
| `402` | `quota_exceeded` | Création d’un pipeline ou ajout d’un emplacement alors que tous ceux du plan sont utilisés ; `details.metric` vaut `pipelines` ou `slots`. |
| `402` | `workspace_frozen`, `workspace_suspended` | Une modification tant qu’un impayé n’est pas réglé, ou tout ce qui n’est ni une lecture ni une suppression après l’arrêt du service. |
| `403` | `forbidden` | `details.reason` vaut `role`, `project_confined`, `product_not_enabled`, `csrf` ou `no_workspace`. |
| `404` | `not_found` | Pipeline, version ou emplacement inexistant dans votre espace de travail ; `details.reason` vaut `pipeline`, `pipeline_version` ou `slot`. |
| `405` | `method_not_allowed` | Le chemin existe, mais pas pour cette méthode. |
| `409` | `conflict` | `details.reason` vaut `pipeline_disabled` ([Exécuter un pipeline](#run)), `destinations_unconfirmed` ([Qui exécute un pipeline](#destinations)) ou `slot_in_use` ([Emplacements de justificatifs](#slots)). |
| `413` | `payload_too_large` | Un corps de requête de plus de 1 MiB. |
| `422` | `invalid_pipeline` | Un pipeline qui ne pourrait jamais s’exécuter, à l’enregistrement ou au test. |
| `422` | `validation_error` | Un paramètre ou un champ n’a pas passé la validation. Un caractère NUL dans le chemin, la query string ou un corps JSON donne le type d’entrée `transforms.nul_character`. |
| `429` | `rate_limited` | Au-delà des exécutions par minute du plan, ou avec trop d’exécutions ou de tests de l’espace de travail en cours à la fois ([Plans et limites](#limits)) ; `details.retry_after` indique quand réessayer. |
| `500` | `internal_error` | Une panne de notre côté. |

### Pipelines non valides {#invalid-pipeline}

Le refus nomme le premier problème : `details.reason`, `details.path` (un JSON Pointer vers lui) et `details.step` (compté à partir de 0), chacun quand il s’applique.

```json
{ "error": { "code": "invalid_pipeline", "message": "…", "details": { "reason": "credential_header", "path": "/steps/0/headers/set/Authorization", "step": 0 }, "request_id": "…" } }
```

| `reason` | Ce qui ne va pas |
| --- | --- |
| `invalid_document` | Ce n’est pas un objet avec une `version` et une liste de `steps`. |
| `unsupported_version` | `version` ne vaut pas `1`. |
| `no_steps` | Il n’y a aucune étape. |
| `too_many_steps` | Il y a plus de 20 étapes. |
| `invalid_step` | Une étape n’est pas un objet avec une seule clé d’étape, sans rien d’autre à côté qu’une `note` et, pour un filtre, une `action`. |
| `unknown_step` | Une clé d’étape n’est ni `filter`, ni `drop`, ni `set`, ni `map`, ni `headers`, ni `auth`. |
| `invalid_value` | Un réglage n’est pas de ceux que prend son étape, comme un `drop` vide ou une note de plus de 200 caractères. |
| `invalid_path` | Un chemin ne peut pas être lu, ou contient un joker là où son étape n’en accepte pas. |
| `invalid_template` | Une expression ne peut pas être lue, ou nomme un filtre qui n’existe pas. |
| `invalid_filter` | Un filtre n’est pas valide, par exemple parce qu’il utilise un opérateur inconnu. |
| `invalid_header` | Un nom de header n’est pas valide ou appartient à la connexion, ou une valeur n’est pas de l’ASCII imprimable sur une seule ligne. |
| `invalid_secret` | Le `secret` d’une étape de justificatif n’est pas l’identifiant d’un emplacement. Une valeur collée là n’est jamais reprise dans un message. |
| `auth_not_last` | Une étape vient après une étape de justificatif. |
| `too_deep` | Quelque chose est imbriqué sur plus de 32 niveaux. |
| `too_large` | Les réglages d’une étape dépassent 16 KiB, ou le document dépasse 64 KiB. |
| `not_json` | Le document contient une valeur qui n’est pas du JSON. |
| `forbidden_header` | Une étape définit `Set-Cookie`, un header qu’aucune requête ne porte. |
| `credential_header` | Une étape de headers définit `Authorization`, `Cookie` ou `X-Api-Key`, ce qui stockerait le justificatif dans le pipeline. Ajoutez-le plutôt avec une étape de justificatif. |
| `unknown_slot` | Une étape de justificatif désigne un emplacement que l’espace de travail ne détient pas. |

Traitez `reason` comme une chaîne ouverte, et prévoyez un cas par défaut pour une valeur que vous ne connaissez pas.

## Étapes suivantes {#next-steps}

- [Démarrage rapide](/docs/product-transforms/quickstart) — tester un pipeline, l’enregistrer et l’exécuter.
- [Pipelines](/docs/product-transforms/pipelines) — toutes les étapes, tous les chemins, filtres et modèles.
- [API Transforms](/docs/reference/transforms) — chaque opération, avec la requête en curl, TypeScript, Python ou Go.
- [Erreurs](/docs/errors) — le format d’erreur, chaque clé de `details` et une façon de les traiter.
