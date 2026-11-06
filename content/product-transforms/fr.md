---
title: "Transforms"
description: "Des pipelines déclaratifs qui filtrent, allègent et remodèlent une requête. Construisez-les, versionnez-les et testez-les en un seul endroit, puis exécutez-les via l’API ou par référence depuis le produit qui envoie."
publishedAt: 2026-11-06
updatedAt: 2026-11-06
kind: concept
---

# Transforms

NimbusNexus Transforms fait des **pipelines** des objets à part entière. Un pipeline est une courte liste d’étapes déclaratives qui abandonnent une requête si elle ne correspond pas, retirent ou ajoutent des champs, reconstruisent le corps à partir d’un modèle et définissent des headers. Construisez-en un dans la console ou via l’API REST, testez-le, conservez ses versions, exécutez-le via l’API, ou désignez-le par son identifiant depuis le produit qui envoie.

> **Ce n’est pas la page que vous cherchez ?** Transforms n’envoie rien lui-même. Pour changer ce que reçoit un endpoint à chaque livraison, voir [Transformations](/docs/product-webhooks/transformations) dans Webhooks, et pour changer ce que transfère un bin, voir [Un pipeline avant chaque transfert](/docs/product-bins/forwarding#pipeline) dans Request Bins. Essayez un pipeline sans compte dans le [playground](/transforms/playground).

## En bref {#at-a-glance}

| | |
| --- | --- |
| Ce que vous créez | Un **pipeline** : un document JSON de 20 étapes au plus, comme `{"version": 1, "steps": [{"drop": ["**.email"]}]}` |
| Ce qu’il fait | Filtre une requête, retire ou ajoute des champs, reconstruit le corps à partir d’un modèle et définit des headers |
| Ce qu’il ne fait pas | Il n’envoie rien et ne conserve rien de ce qu’il traite. Ce n’est pas un relais |
| Console | `https://transforms.nimbusnexus.net` |
| URL de base de l’API | `https://transforms.nimbusnexus.net/v1` |
| Authentification | `Authorization: Bearer <key>`, avec une clé créée dans la console de compte avec **Transforms** comme produit |
| Identifiant | L’`id` du pipeline, par exemple `pipe_8e27d40b19c3f6a5e0d71b42` |
| Essayer un document | `POST /v1/pipelines/test`, qui n’enregistre et ne compte rien |
| Exécuter un pipeline enregistré | `POST /v1/pipelines/{id}/run`, qui indique ce que le pipeline a fait |
| Chaque étape, chaque chemin et chaque filtre | [Pipelines](/docs/product-transforms/pipelines) |
| Chaque route, chaque rôle et chaque limite | La [référence Transforms](/docs/product-transforms/reference) |

## Comment ça marche {#how}

1. **Construisez** un pipeline : ajoutez des étapes dans le formulaire de la console, collez-les en JSON ou partez d’un [modèle](/docs/product-transforms/pipelines#templates). Un document qui ne pourrait jamais s’exécuter est refusé à l’enregistrement, avec un `422` `invalid_pipeline` qui nomme son étape, son chemin et la raison.
2. **Testez**-le. Exécutez ce qui se trouve dans l’éditeur sur une requête que vous collez, et voyez le corps et les headers qu’il enverrait, l’étape qui l’a abandonnée ou la raison de l’échec.
3. **Enregistrez**-le. Enregistrer un nouveau contenu ajoute une version, et une version ne change jamais. Enregistrer de nouveau le même contenu n’en ajoute aucune, et restaurer une ancienne version revient à enregistrer de nouveau son contenu.
4. **Exécutez**-le, de l’une de ces deux façons :
   - **Via l’API.** Envoyez une requête à `POST /v1/pipelines/{id}/run`. Cette route exécute le pipeline sur ce que vous envoyez, répond avec le résultat et ne conserve rien. C’est à vous d’envoyer le résultat, où que ce soit.
   - **Par référence.** Désignez le pipeline par son identifiant depuis Webhooks, qui l’exécute avant chaque livraison, dans son propre processus. Chaque nouvelle version lui parvient sans qu’aucun endpoint ait à changer.

Le [démarrage rapide](/docs/product-transforms/quickstart) parcourt les étapes 1 à 4 via l’API.

## Ce que répond une exécution {#answers}

Un pipeline n’a ni boucles, ni horloge, ni réseau : le même pipeline fait donc toujours la même chose sur la même requête. Une exécution répond `200` avec l’un de ces trois statuts, car dans chaque cas le pipeline s’est exécuté :

| `status` | Ce que cela signifie | Ce qu’il faut faire |
| --- | --- | --- |
| `ok` | `body`, `headers` et `query` sont la requête à envoyer. | Envoyez-la. |
| `dropped` | Un filtre a abandonné la requête. `step`, `note` et `reason` indiquent lequel, et pourquoi. | N’envoyez rien. |
| `failed` | Le pipeline ne peut pas s’exécuter sur cette requête. `step`, `reason` et `error` indiquent pourquoi, comme un plafond qu’il a dépassé. | Modifiez le pipeline ou la requête. La même requête échoue de la même façon : ne réessayez donc pas. |

## Justificatifs d’identité {#credentials}

Transforms ne détient aucun justificatif d’identité. L’étape `auth` d’un pipeline indique que la requête doit porter un bearer token, une authentification basique ou une clé d’API, et nomme un **emplacement** pour ce justificatif. Un emplacement est un identifiant et un libellé, sans valeur : ajoutez-en un dans la console sous **Credential slots**, ou avec `POST /v1/slots`. Le document contient l’identifiant de l’emplacement et rien d’autre : relire un pipeline ne montre donc jamais de justificatif, et aucune route ne prend ni ne renvoie la valeur d’un justificatif.

Pour en envoyer un, exécutez le pipeline par référence depuis le produit qui envoie. Ce produit associe l’emplacement à un secret de son propre stockage, sous sa propre clé, et l’envoie vers ses propres URL. Hors de ce produit, l’emplacement ne signifie rien.

Test et l’API d’exécution montrent ce qu’ajouterait l’étape, avec la valeur masquée : `Authorization: Bearer ••••`. Ils ne peuvent pas envoyer de justificatif, car Transforms n’en a aucun à envoyer.

Vous voyez d’abord où s’exécute un pipeline. La lecture d’un pipeline liste les produits qui l’exécutent par référence et la version que chacun exécute. L’enregistrement d’une nouvelle version avec une étape `auth`, ou la suppression du pipeline, doit nommer chacun d’eux dans `confirm_destinations` ; sinon, la requête est refusée avec `409` `conflict`, `destinations_unconfirmed` ([Qui exécute un pipeline](/docs/product-transforms/reference#destinations)).

## Plans et limites {#limits}

| | Free | Starter | Pro | Custom |
| --- | --- | --- | --- | --- |
| Pipelines | 5 | 25 | 100 | 1,000 |
| Emplacements de justificatifs | 5 | 25 | 100 | 1,000 |
| Versions conservées par pipeline | 10 | 25 | 50 | 100 |
| Exécutions par minute | 60 | 600 | 3,000 | 12,000 |

Les six étapes, les modèles, Test, l’API d’exécution et l’exécution par référence sont disponibles sur tous les plans, Free compris.

Les exécutions sont comptées, pas facturées. `GET /v1/usage` montre celles du mois. Au-delà du débit du plan, que Test partage, une exécution répond `429` `rate_limited`, avec le temps à attendre. Une exécution dans un produit qui fait référence au pipeline compte dans la consommation de ce produit. Une version qu’un produit fige, ou qu’un produit a été vu exécuter au cours des 30 derniers jours, est conservée au-delà du nombre prévu par le plan.

## Obtenir l’accès {#access}

Ouvrez la console à `https://transforms.nimbusnexus.net` et connectez-vous avec votre compte NimbusNexus, ou ajoutez Transforms depuis **Add a product** dans n’importe quelle console NimbusNexus. La première visite d’un propriétaire ou d’un admin de l’espace de travail ajoute Transforms à l’espace de travail ; les autres membres peuvent ensuite l’ouvrir.

Les clés ne sont pas émises par l’API Transforms. Créez-en une dans votre [console de compte]({{ACCOUNT_BASE_URL}}/api-keys?product=transforms), sous **API keys**, avec **Transforms** comme produit. Une clé est un JWT : elle commence donc par `eyJ`. Présentez-la sous la forme `Authorization: Bearer <key>` ou `X-API-Key: <key>`.

Choisissez sa permission à la création : **Read** lit et exécute les pipelines, et **Read & write** peut en plus les créer, les modifier, les tester et les supprimer. [Qui peut faire quoi](/docs/product-transforms/reference#authority) donne le tableau complet, rôles de l’espace de travail compris.

## Ce que le produit ne fait pas {#not}

- **Il n’envoie rien.** Il n’a ni destination, ni réessais, ni journal de livraison. Webhooks livre les événements et Request Bins transfère les requêtes.
- **Il ne conserve pas ce qu’il traite.** La requête et la réponse d’une exécution disparaissent à la fin de l’appel. Seul le décompte reste.
- **Il ne détient pas de justificatifs.** Un justificatif vient du produit qui exécute le pipeline par référence.
- **Il n’exécute pas de code.** Pour la logique que les étapes ne savent pas exprimer, un endpoint Webhooks peut exécuter un [script](/docs/product-webhooks/transformations#script) à la place, sur un plan payant.

## Étapes suivantes {#next-steps}

- [Démarrage rapide](/docs/product-transforms/quickstart) — tester un pipeline, l’enregistrer, l’exécuter et enregistrer une nouvelle version.
- [Pipelines](/docs/product-transforms/pipelines) — toutes les étapes, tous les chemins, filtres et modèles, et les plafonds d’une exécution.
- [Référence Transforms](/docs/product-transforms/reference) — chaque route et chaque champ, rôles, limites et erreurs.
- [Playground](/transforms/playground) — exécuter un pipeline d’exemple sans compte.
