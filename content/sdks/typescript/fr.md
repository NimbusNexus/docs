---
title: "SDK TypeScript"
description: "Client typé pour l’API REST NimbusNexus. ESM + CJS, Node 20+, compatible navigateur."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: sdk
---

# SDK TypeScript

> **Statut : préversion.** Le SDK est en développement actif. Cette page documente la forme de la v1.0 ; tant que le paquet n’est pas publié, utilisez directement l’API REST en suivant [Authentification](/docs/authentication) et [Conventions](/docs/conventions).

Un client TypeScript typé qui encapsule l’API REST v1. Double publication ESM + CJS, Node 20+, fonctionne dans le navigateur. Généré à partir de la spécification OpenAPI de production : les types restent synchronisés avec l’API par construction.

> **Vous envoyez des webhooks à vos propres clients ?** C’est le rôle du [produit Webhooks](/docs/product-webhooks), distinct, qui a son propre SDK TypeScript publié — [`@nimbusnexus/webhooks-sdk`](/docs/product-webhooks/sdks). Cette page présente le client de l’API cloud NimbusNexus.

## Installer (une fois publié) {#install}

```bash
npm install @nimbusnexus/sdk
# or
pnpm add @nimbusnexus/sdk
# or
yarn add @nimbusnexus/sdk
```

## Utilisation rapide {#quick}

```ts
import { NimbusNexus } from '@nimbusnexus/sdk'

const nn = new NimbusNexus({
  apiKey: process.env.NIMBUS_KEY!, // never hardcode
})

// List VMs in a region
const { items, pagination } = await nn.vms.list({
  region: 'us-east-1',
  limit: 50,
})

// Create a VM
const vm = await nn.vms.create({
  name: 'web-01',
  size: 'gp-1-2',
  region: 'us-east-1',
  image: 'ubuntu-24.04',
})

// Poll until running
while (vm.state !== 'running') {
  await new Promise(r => setTimeout(r, 1000))
  Object.assign(vm, await nn.vms.get(vm.id))
}
```

## Principes de conception {#design}

- **Typé de bout en bout.** Corps de requête, paramètres de requête, formats de réponse — chaque endpoint expose son schéma OpenAPI complet sous forme de type TypeScript. Pas de `any`, pas de casts `as` dans votre code.
- **Calqué sur l’API REST.** `nn.vms.list()` correspond à `GET /v1/vms`. `nn.databases.snapshots.list(dbId)` correspond à `GET /v1/databases/{dbId}/snapshots`. Aucune méthode de confort sur mesure qui s’éloignerait de l’API.
- **Idempotence par défaut.** Chaque appel de modification génère automatiquement une `Idempotency-Key` (UUID v4). Remplacez-la avec `{ idempotencyKey: '...' }` si vous avez besoin, de votre côté, d’une clé stable d’un réessai à l’autre.
- **Réessais sur 429 + 5xx.** La configuration par défaut réessaie avec un backoff exponentiel + jitter sur `429`, `502`, `503`, `504`. Désactivez les réessais avec `{ retries: 0 }` si vous voulez les gérer vous-même.
- **Aucune dépendance à l’exécution dans le bundle navigateur.** Côté serveur, `node:crypto` s’ajoute pour les helpers de vérification HMAC ; le bundle navigateur n’a aucune dépendance.

## Configuration {#config}

```ts
const nn = new NimbusNexus({
  apiKey: process.env.NIMBUS_KEY!,
  // All optional:
  baseUrl: '{{API_BASE_URL}}', // defaults to canonical
  timeout: 30_000,             // request timeout in ms
  retries: 3,                   // max retries on 429 / 5xx
  retryDelay: 1000,             // base delay; doubled per attempt with jitter
  userAgent: 'my-app/2.4',      // appended to the default `nimbusnexus-sdk/<ver>` UA
  fetch: customFetch,           // optional fetch implementation override
})
```

## Helper de vérification de webhook {#webhooks}

```ts
import { verifyWebhook } from '@nimbusnexus/sdk/webhooks'

export async function POST(req: Request) {
  const body = await req.text()
  const ok = verifyWebhook({
    body,
    timestamp: req.headers.get('NN-Timestamp')!,
    signature: req.headers.get('NN-Signature')!,
    secret: process.env.NIMBUS_WEBHOOK_SECRET!,
  })
  if (!ok) return new Response('bad signature', { status: 401 })

  // handle event...
  return new Response('ok')
}
```

Le vérificateur gère le HMAC + la comparaison à temps constant + le contrôle de la fenêtre de rejeu. N’écrivez pas votre propre version — se tromper sur l’un de ces points est le schéma classique d’usurpation de webhook.

## Helper de pagination {#pagination}

```ts
// Manual paging
for (const page of nn.vms.listPages({ region: 'us-east-1' })) {
  console.log(`got ${page.items.length} VMs`)
}

// Auto-flatten
for await (const vm of nn.vms.listAll({ region: 'us-east-1' })) {
  console.log(vm.name)
}
```

`listPages()` et `listAll()` sont des itérateurs asynchrones qui parcourent les curseurs pour vous. Voir [Pagination](/docs/pagination) pour le mécanisme sous-jacent.

## État actuel {#status}

Le SDK est en cours de génération à partir de la spécification OpenAPI, mais n’a pas encore été publié. En attendant :

- Utilisez directement l’API REST. L’authentification et les conventions sont documentées et stables.
- La forme du SDK présentée sur cette page est la conception d’API à laquelle nous nous engageons ; elle ne changera pas avant la v1.0.
- Abonnez-vous au changelog sur [{{BASE_URL}}/changelog]({{BASE_URL}}/changelog) pour l’annonce de la publication.

## Étapes suivantes {#next-steps}

- [Authentification](/docs/authentication) — ce que fait `apiKey` au niveau HTTP.
- [Webhooks de la plateforme](/docs/webhooks) — ce que vérifie `verifyWebhook`.
- [Pagination](/docs/pagination) — ce que parcourent `listAll` et `listPages`.
