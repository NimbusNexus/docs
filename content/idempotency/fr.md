---
title: "Idempotence"
description: "Réessayez sans risque les requêtes de modification grâce au header Idempotency-Key."
publishedAt: 2026-05-20
updatedAt: 2026-10-05
kind: concept
---

# Idempotence

Une requête est **idempotente** quand la faire deux fois a le même effet que la faire une fois. `GET /v1/vms` est naturellement idempotente — elle ne change rien. `POST /v1/vms` n’est naturellement **pas** idempotente — appelez-la deux fois et vous obtenez deux VM.

Le header `Idempotency-Key` vous permet de transformer n’importe quelle requête de modification en requête réessayable sans risque. Passez n’importe quelle valeur unique (un UUID, par convention) : nous mettons la réponse en cache pendant 24 heures et renvoyons la même réponse à chaque répétition avec la même clé.

## Le problème que cela résout {#problem}

Vous appelez `POST /v1/vms`. Le réseau coupe au retour, et vous obtenez un timeout au lieu d’un 201. La VM a-t-elle été créée ? Vous ne le savez pas :

- Si vous réessayez : vous obtenez peut-être deux VM (la requête d’origine a réussi ; votre réessai en a créé une deuxième).
- Si vous ne réessayez pas : vous obtenez peut-être zéro VM (la requête d’origine a échoué ; vous avez accepté le mauvais état).

Avec une clé d’idempotence, le réessai est sans risque. Si la requête d’origine a réussi, le réessai renvoie le même 201 avec le même identifiant de VM — pas de doublon. Si la requête d’origine a échoué, le réessai fait réellement le travail.

## Utiliser le header {#usage}

Envoyez n’importe quelle chaîne de 255 caractères au maximum :

```bash
curl -X POST {{API_BASE_URL}}/v1/vms \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Idempotency-Key: 8e1c91a4-04d0-4d77-8e6e-2f7c1a5b8e84" \
  -H "Content-Type: application/json" \
  -d '{ "name": "web-01", "size": "gp-2-4", "region": "us-east-1", "image": "ubuntu-24.04" }'
```

Par convention, un UUID v4 par opération logique. Générez-le une fois côté client, enregistrez-le avant d’envoyer la requête et réutilisez-le à chaque réessai de cette même opération logique. Générez-en un nouveau pour l’opération logique *suivante*.

## Ce que recouvre « la même clé » {#same-key}

Nous mettons la réponse en cache avec pour clé :

1. La valeur du header `Idempotency-Key`
2. La clé API qui fait la requête
3. L’endpoint (méthode + chemin)

Deux requêtes ne partagent donc une réponse en cache que si **les trois correspondent**. Cela évite les accidents — une clé réutilisée sur deux endpoints, par deux clés API, voire dans deux projets (clés API différentes), ne mélange pas les réponses.

## Ce qui est mis en cache {#cached}

Nous mettons en cache la **réponse complète** — code de statut, headers, corps. Une répétition avec la même clé renvoie une sortie identique à l’octet près. C’est important pour les clients qui prennent l’empreinte des réponses pour détecter « est-ce que ça a changé ? » — ils obtiennent une réponse cohérente.

Nous mettons aussi en cache les **erreurs**. Si votre premier appel a échoué à la validation (`422 validation_error`), le réessai renvoie le même `422` — et non une autre erreur si vous avez corrigé quelque chose entre les tentatives. C’est le bon comportement : l’idempotence signifie « même effet », et l’effet du premier appel était un échec. Si vous voulez repartir de zéro, générez une nouvelle clé.

L’API Webhooks fait exception : elle n’enregistre une clé que lorsqu’une publication réussit. Voir [Sur l’API Webhooks](#webhooks).

Le TTL du cache est de **24 heures** à partir de la première utilisation. Au-delà, une requête avec la même clé est traitée comme une nouvelle requête.

## Quand l’utiliser {#when}

| Type d’endpoint | L’utiliser ? |
|---|---|
| `POST` qui crée une ressource (`POST /v1/vms`) | Oui |
| `PUT` qui remplace une ressource (`PUT /v1/vms/{id}`) | Oui |
| `PATCH` qui met à jour une ressource | Oui |
| `DELETE` | Oui |
| `GET`, `HEAD`, `OPTIONS` | Non — déjà naturellement idempotents |
| `POST` qui déclenche une opération ponctuelle (par exemple `POST /v1/vms/{id}/reboot`) | Oui — redémarrer deux fois n’est pas la même chose que redémarrer une fois |

En pratique : toute requête de modification qui peut échouer en cours de route gagne à avoir une clé. Le coût est un header sur chaque requête et une étape de génération d’UUID de votre côté.

## Conflit avec une utilisation précédente {#conflicts}

Si vous réutilisez une clé avec un **corps de requête différent** sur le même endpoint, vous obtenez `409 Conflict` avec `error.code: 'conflict'`, et `error.message` indique que la clé a déjà été utilisée avec un corps de requête différent. La requête d’origine est maintenue ; votre corps différent est rejeté. C’est le comportement le plus sûr — renvoyer silencieusement l’ancienne réponse masquerait un bug dans votre boucle de réessai.

Si vous devez vraiment faire une requête différente, générez une nouvelle clé.

Des versions antérieures de cette page indiquaient que cette réponse portait `error.code: 'idempotency_key_reused'`. L’API n’a jamais envoyé ce code ; elle envoie `conflict`. `conflict` couvre aussi d’autres conflits avec l’état existant, comme un nom déjà pris ; sur l’API Webhooks, `details.reason` vaut `idempotency_key_reuse` pour celui-ci. Voir [Erreurs](/docs/errors#codes-state).

## Sur l’API Webhooks {#webhooks}

Sur l’API Webhooks, `Idempotency-Key` s’applique à la publication d’un événement (`POST /v1/events`) et se comporte ainsi :

| Vous envoyez | Vous obtenez |
|---|---|
| Une nouvelle clé | `201` et le nouvel événement, diffusé aux endpoints correspondants. |
| La même clé et le même corps | `200`, l’événement **d’origine** et le header `Idempotency-Replayed: true`. Rien n’est diffusé à nouveau. |
| La même clé et un corps différent | `409` avec `error.code: 'conflict'`, `details.reason: 'idempotency_key_reuse'` et la clé dans `details.idempotency_key`. L’événement d’origine est maintenu. |
| La même clé après une requête qui a échoué | La requête s’exécute de nouveau. Une publication qui échoue (une erreur de validation, une erreur de quota, une limite de débit) n’enregistre pas la clé. |

« Même corps » signifie le même type d’événement et le même payload pour le même projet. Une clé appartient à votre espace de travail et à votre projet, pas à la clé API qui l’a envoyée : deux clés API qui publient dans le même projet partagent donc les mêmes clés. Une clé est conservée au moins 24 heures.

## Quand s’en passer {#skip}

Le flux sans clé est un `best-effort retry`. Pour les lectures, cela suffit ; pour les écritures où vous pouvez tolérer « peut-être rien, peut-être une fois » (des opérations idempotentes au niveau de l’application), cela suffit aussi. Le header ne coûte rien — mais si votre application ne réessaie pas en cas d’échec, vous ne verrez pas la différence.

Les cas où vous voulez vraiment une clé :

- Tout ce qui touche à la facturation (vous ne voulez pas débiter une carte deux fois)
- Tout ce qui est visible par l’utilisateur (vous ne voulez pas envoyer une notification deux fois)
- Toute étape d’un workflow qui provisionne en cas d’échec (vous ne voulez pas de ressources orphelines)

## Étapes suivantes {#next-steps}

- [Conventions](/docs/conventions) — pagination, codes de statut, formats d’erreur, le reste.
- [Limitation de débit](/docs/rate-limiting) — quand les réessais tombent sur un 429, l’autre moitié de l’histoire du réessai sans risque.
- [Erreurs](/docs/errors) — le format des erreurs et ce que signifie chaque `error.code`.
