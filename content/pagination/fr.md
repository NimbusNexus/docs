---
title: "Pagination"
description: "Comment chaque API pagine ses listes, avec limit et offset ou marker, et comment savoir que vous êtes à la fin."
publishedAt: 2026-05-20
updatedAt: 2026-11-06
kind: concept
---

# Pagination

NimbusNexus a deux types d’API, et elles ne paginent pas leurs listes de la même façon. Les API des apps paginent avec `limit` et `offset`. Sur l’API d’infrastructure, la plupart des listes répondent avec tous leurs éléments en une fois, et quelques-unes prennent `limit` avec `marker` ou `offset`.

## Les API des apps {#shape}

Sur Webhooks, Inboxes et Request Bins, la plupart des listes acceptent deux paramètres de requête :

- `limit` — taille de page. 50 par défaut, 200 au maximum. Au-delà de 200, la requête échoue à la validation : `422` `validation_error` ([Erreurs](/docs/errors#codes-validation)).
- `offset` — le nombre d’éléments à ignorer. 0 par défaut, 10,000 au maximum.

Chaque liste répond avec ses éléments et l’offset suivant :

```json
{
  "items": [],
  "next_offset": 50
}
```

Renvoyez `next_offset` dans `offset` pour obtenir la page suivante. Quand il vaut `null`, vous êtes sur la dernière page.

Un offset compte des positions : un élément créé ou supprimé pendant que vous parcourez une liste peut donc vous faire voir un autre élément deux fois, ou en manquer un. Si cela a de l’importance, comparez les identifiants. Gardez les mêmes filtres pendant tout le parcours, et repartez de l’offset 0 quand vous les changez.

Deux cas diffèrent :

- **Les recherches** sur Inboxes et Request Bins se paginent plutôt avec `next_until` : voir [Rechercher des messages](/docs/product-inboxes#search) et [Requêtes capturées](/docs/product-bins/reference#requests).
- **QR Codes** renvoie la plupart de ses listes en une seule réponse. Les scans d’un code (`GET /v1/qr-tracked/codes/{code_id}/scans`) prennent `limit` seul, et les livraisons d’un webhook (`GET /v1/qr-tracked/webhooks/{webhook_id}/deliveries`) se paginent avec `limit` et `cursor`, le curseur suivant se trouvant dans `nextCursor`.

## L’API d’infrastructure {#infrastructure}

La plupart des listes, comme `GET /api/v1/instance/`, répondent avec la liste complète et ne prennent aucun paramètre de pagination. Celles qui paginent le font de l’une de deux façons.

### `limit` et `marker` {#marker}

`marker` est le dernier élément que vous avez vu : son identifiant ou, sur le stockage objet, son nom. La réponse commence après lui.

- Images de VM : `GET /api/v1/image/`.
- DNS : `GET /api/v1/zones/`, `GET /api/v1/recordsets/`, `GET /api/v1/zones/{zone_id}/recordsets/`, `GET /api/v1/zones/{zone_id}/ptr/` et `GET /api/v1/zones/{zone_id}/shares/`.
- Stockage objet : `GET /api/v1/object_storage/` pour les conteneurs et `GET /api/v1/object_storage/{container_name}/objects` pour les objets. Sur les objets, `full_listing=true` les renvoie tous en une seule réponse.

Ces réponses ne contiennent que `data`, sans rien pour indiquer s’il reste d’autres éléments. Continuez jusqu’à ce qu’une page revienne plus courte que votre `limit`.

### `limit` et `offset` {#offset}

`offset` est le nombre d’éléments à ignorer.

- Sauvegardes de volume : `GET /api/v1/backup_restore/volume_backups/`, avec un `limit` de 10 par défaut.
- Planifications de sauvegarde : `GET /api/v1/backup_restore/backup_scheduler/list` et `GET /api/v1/backup_restore/volume_scheduler/list`.
- Connexions de stockage externe : `GET /api/v1/external/connections/`.
- Notifications : `GET /api/v1/notifications/list`, avec un `limit` de 50 par défaut et de 200 au maximum.

Ces réponses portent aussi `total`, le nombre d’éléments sur l’ensemble des pages : vous êtes donc à la fin quand vous en avez lu autant.

## Parcourir les pages {#walking}

Sur une API d’app, suivez `next_offset` :

```ts
async function listAllEndpoints() {
  const all = []
  let offset = 0

  while (offset !== null) {
    const url = new URL('{{WEBHOOKS_BASE_URL}}/v1/endpoints')
    url.searchParams.set('limit', '200')
    url.searchParams.set('offset', String(offset))

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${process.env.WEBHOOKS_API_KEY}` },
    })
    const page = await res.json()

    all.push(...page.items)
    offset = page.next_offset
  }

  return all
}
```

Sur l’API d’infrastructure, suivez le dernier identifiant jusqu’à obtenir une page courte :

```ts
async function listAllZones() {
  const all = []
  const limit = 100
  let marker

  while (true) {
    const url = new URL('{{API_BASE_URL}}/api/v1/zones/')
    url.searchParams.set('limit', String(limit))
    if (marker) url.searchParams.set('marker', marker)

    const res = await fetch(url, {
      headers: { 'X-API-Key': process.env.NIMBUS_KEY },
    })
    const { data } = await res.json()

    all.push(...data)
    if (data.length < limit) return all
    marker = data.at(-1).id
  }
}
```

Chaque page est une requête, et elle compte dans la [limite de débit](/docs/rate-limiting).

## Ordre de tri {#sort}

Les listes qui trient indiquent leurs paramètres sur leur page de référence. Sur l’API d’infrastructure, ce sont `sort_by` et `sort_desc` sur les listes à `offset` qui trient, et `sort_key` et `sort_dir` sur les images de VM et les jeux d’enregistrements DNS. Gardez le même tri pendant tout le parcours.

## Étapes suivantes {#next-steps}

- [Conventions](/docs/conventions) — le reste du format des requêtes : identifiants, codes de statut, erreurs.
- [Limitation de débit](/docs/rate-limiting) — combien de requêtes un parcours peut faire.
- [Erreurs](/docs/errors) — ce que répond une requête refusée.
