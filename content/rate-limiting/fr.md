---
title: "Limitation de débit"
description: "Budgets de requêtes par clé, les headers que nous renvoyons et la bonne stratégie de backoff."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: concept
---

# Limitation de débit

Chaque clé API reçoit un budget de requêtes par seconde et par heure. Ces limites vous protègent autant que nous — elles empêchent une boucle incontrôlée de faire flamber votre carte bancaire et empêchent un tenant, quel qu’il soit, de saturer une région.

## Les valeurs par défaut {#defaults}

| Niveau | Par seconde | Par heure |
|---|---|---|
| Free | 5 | 1,000 |
| Starter | 25 | 10,000 |
| Production | 100 | 100,000 |
| Enterprise | Sur mesure | Sur mesure |

Elles s’appliquent par **clé API**, pas par projet — si vous avez trois clés dans un projet, chacune a son propre budget. La plupart des équipes n’approchent jamais la limite du niveau Production ; si c’est votre cas, le panneau « rate limit usage » de la console fait ressortir les points d’appel qui consomment le quota le plus vite.

## Comment fonctionne la limitation {#mechanics}

Un token bucket sur chaque clé. Le bucket se remplit au rythme par seconde ; sa taille est fixée pour qu’après un bref burst qui épuise le budget, celui-ci se reconstitue en ~10 secondes. La limite horaire est un plafond strict — une fois qu’elle est atteinte, aucune requête n’aboutit tant que la fenêtre glissante d’une heure n’a pas avancé.

Les limites sont évaluées à la passerelle, avant que la requête n’atteigne le handler de la ressource. Une requête limitée en débit ne touche jamais aux ressources de votre projet : elle ne vous coûte donc jamais rien au-delà de l’entrée de log de la requête refusée.

## Headers de réponse {#headers}

Chaque réponse de l’API porte quatre headers qui décrivent votre budget actuel :

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1763410812
X-RateLimit-Window: 1
```

- `X-RateLimit-Limit` — budget total pour la fenêtre en cours
- `X-RateLimit-Remaining` — requêtes restantes
- `X-RateLimit-Reset` — l’instant, en epoch Unix, où le budget se remplit (ou où la fenêtre horaire avance)
- `X-RateLimit-Window` — `1` pour la limite par seconde, `3600` pour la limite par heure. Nous indiquons le budget que vous êtes le plus près d’épuiser

Quand `Remaining` atteint zéro, la requête suivante renvoie `429 Too Many Requests` avec un header `Retry-After` (en secondes) qui vous indique quand réessayer.

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

- **Respectez toujours `Retry-After`.** Ne réessayez pas plus tôt — vous retomberiez simplement sur la limite et épuiseriez votre budget plus vite.
- **Ajoutez du jitter** si vous appelez depuis plusieurs workers. Sans jitter, tous vos workers réessaient au même instant et retombent tous ensemble sur la limite.

## Ce qui compte comme une requête {#counted}

Chaque appel HTTP à l’API compte comme une requête, y compris :

- Les `GET` (oui, même `GET /v1/regions`)
- Les appels de pagination (chaque page est une requête)
- Les réessais idempotents (la réponse servie par le cache compte quand même comme une requête — mais elle est peu coûteuse, et la déduplication vous évite de payer deux fois l’opération sous-jacente)

Ce qui ne compte **pas** :

- Les ressources statiques servies par le site marketing (CDN, pas l’API)
- Les livraisons de webhooks vers vos systèmes (c’est nous qui les envoyons, pas vous)
- Les tentatives de connexion échouées (aucune entrée de log à la passerelle)

## Relever vos limites {#raising}

Les niveaux Starter et Production sont généralement assez généreux ; moins de 5 % des comptes atteignent un jour le plafond horaire. Si cela vous arrive, la marche à suivre passe par le formulaire de contact du support, pas par l’API — comme pour les [augmentations de quota](/docs/api/quotas). Les migrations de production obtiennent une réponse dans la journée.

Si vous atteignez les limites par seconde mais pas la limite horaire, vous n’avez généralement pas besoin d’une augmentation — vous devez répartir la charge (regrouper les requêtes, utiliser `Idempotency-Key` pour dédupliquer les réessais, paginer avec des tailles de page raisonnables). Le panneau « rate limit usage » de la console détaille les endpoints qui connaissent des pics.

## Étapes suivantes {#next-steps}

- [Conventions](/docs/conventions) — format des requêtes, codes de statut, les règles plus générales de l’API.
- [Idempotence](/docs/idempotency) — le modèle de réessai sans risque quand des pannes réseau ressemblent à des limites de débit.
- [Quotas](/docs/api/quotas) — les limites de *ressources* (VM, vCPU, stockage), à distinguer des limites de débit des requêtes.
