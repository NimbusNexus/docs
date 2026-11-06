---
title: "Limitation de débit"
description: "Ce que limite chaque API, les headers et les erreurs renvoyés par une limite, et la bonne stratégie de backoff."
publishedAt: 2026-05-20
updatedAt: 2026-11-06
kind: concept
---

# Limitation de débit

L’API d’infrastructure limite le nombre de requêtes qu’elle accepte par minute. Les API des apps limitent certaines actions, comme la publication d’un événement. Dans les deux cas, une requête au-delà d’une limite répond `429`, généralement avec un header `Retry-After` qui indique combien de secondes attendre.

## L’API d’infrastructure {#defaults}

Chaque requête vers `{{API_HOST}}` compte dans un budget par minute :

| Qui appelle | Requêtes par minute | Décompte par |
|---|---|---|
| Une session connectée (`Authorization: Bearer` ou le cookie de session) | 120 | Utilisateur |
| Une clé API, ou aucun justificatif d’identité | 60 | Adresse IP |

Une clé API n’a pas de budget propre. Les clés utilisées depuis une même adresse se partagent ses 60 requêtes par minute, avec tout ce qui appelle aussi depuis cette adresse. `GET /api/v1/notifications/list` a une limite plus basse, de 30 par minute, mesurée sur le même décompte.

La minute commence à votre première requête et n’est pas glissante : quand elle se termine, le décompte repart de zéro.

## Headers de réponse {#headers}

Les réponses de l’API d’infrastructure portent la limite appliquée et ce qu’il en reste :

```http
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 59
```

Au-delà de la limite, la réponse est `429`, avec `X-RateLimit-Remaining: 0` et un header `Retry-After`, en secondes, pour ce qu’il reste de la minute :

```json
{
  "success": false,
  "message": "Too many requests. Please try again later."
}
```

## Les API des apps {#apps}

Les API des apps n’envoient pas de headers `X-RateLimit` et ne limitent pas toutes les requêtes. Ce qu’elles limitent, elles le refusent avec `429` `rate_limited`, comme le décrit [Erreurs](/docs/errors#codes-rate) :

- **Webhooks :** la publication (`POST /v1/events`) se fait au débit de publication de votre plan, par espace de travail. La relivraison et le rejeu (`POST /v1/deliveries/{delivery_id}/redeliver`, `POST /v1/deliveries/redeliver`, `POST /v1/deliveries/replay` et `POST /v1/events/{event_id}/replay`) se font au même débit, sur un décompte qui leur est propre. Les événements entrants vers `POST /v1/ingest/{source_id}` sont limités à 600 par minute et par source, puis au débit de publication de votre plan ([Ce que voit le fournisseur](/docs/product-webhooks/sources#responses)). L’enregistrement et le test de scripts sont limités à 60 par minute et par espace de travail ([Transformations](/docs/product-webhooks/transformations#errors)).
- **Inboxes :** chaque boîte accepte du courrier jusqu’à une limite par minute fixée par votre plan ([Limites par plan](/docs/product-inboxes#limits)).
- **Request Bins :** un bin peut envoyer 10 tests de transfert par minute ([Tester une URL de transfert](/docs/product-bins/reference#forward-test)). Une URL de bin accepte 120 requêtes par minute d’un même expéditeur et 600 par minute au total ([Ce que répond une URL de bin](/docs/product-bins/reference#edge-answers)).
- **Transforms :** les exécutions et les tests se partagent le nombre d’exécutions par minute de votre plan, par espace de travail ([Plans et limites](/docs/product-transforms/reference#limits)).
- **QR Codes :** un espace de travail peut envoyer 10 tests de webhook par minute.

## Stratégie de backoff {#backoff}

Le bon modèle quand vous recevez un `429` :

```ts
async function callWithBackoff(fn: () => Promise<Response>) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fn()
    if (res.status !== 429) return res

    const retryAfter = Number(res.headers.get('Retry-After') ?? '1')
    // Jitter prevents the thundering-herd problem if many clients
    // hit the limit at the same moment and all retry exactly together
    const jitter = Math.random() * 0.5 * retryAfter
    await new Promise(r => setTimeout(r, (retryAfter + jitter) * 1000))
  }
  throw new Error('Rate limit exceeded after 5 retries')
}
```

Deux remarques :

- **Respectez toujours `Retry-After`.** Ne réessayez pas plus tôt : vous ne recevriez qu’un autre `429`.
- **Ajoutez du jitter** si vous appelez depuis plusieurs workers. Sans jitter, ils réessaient tous au même instant et retombent tous ensemble sur la limite.

## Ce qui compte comme une requête {#counted}

Sur l’API d’infrastructure, chaque appel HTTP compte, y compris :

- Les `GET`, comme `GET /api/v1/instance/`
- Chaque page d’une [liste paginée](/docs/pagination), et chaque interrogation pendant que vous attendez qu’une VM passe à `ACTIVE`
- Les appels qui échouent, comme un `401`, et les `429` eux-mêmes

Pour rester sous la limite depuis une même adresse, étalez le travail : interrogez moins souvent, et ne listez pas ce que vous pourriez lire une fois et conserver.

## Relever vos limites {#raising}

Aucun appel d’API ni réglage de plan ne relève ces limites. Si la vôtre gêne une vraie charge de travail, [contactez le support]({{BASE_URL}}/contact/support).

## Étapes suivantes {#next-steps}

- [Conventions](/docs/conventions) — format des requêtes, codes de statut, les règles plus générales de l’API.
- [Idempotence](/docs/idempotency) — comment réessayer une écriture sans risque.
- [Quotas](/docs/api/quotas) — les limites de *ressources* (VM, vCPU, stockage), à distinguer des limites de débit des requêtes.
