---
title: "Pagination"
description: "Pagination par curseur sur chaque endpoint de liste. Stable malgré les insertions, sans dérive d’offset."
publishedAt: 2026-05-20
updatedAt: 2026-10-15
kind: concept
---

# Pagination

Les endpoints de liste (`GET /v1/vms`, `GET /v1/snapshots`, etc.) paginent avec des curseurs opaques, pas avec des offsets numériques. La pagination par curseur est le bon choix par défaut pour des listes de ressources qui changent pendant que vous les parcourez — elle renvoie chaque élément exactement une fois, même si des lignes sont insérées ou supprimées entre deux récupérations de page.

## Le format {#shape}

Deux paramètres de requête sur chaque endpoint de liste :

- `limit` — taille de page. 50 par défaut, 200 au maximum. Au-delà de 200, la requête échoue à la validation : `422` `validation_error` ([Erreurs](/docs/errors#codes-validation)).
- `cursor` — pointeur opaque vers la page suivante. À omettre sur la première requête.

Chaque réponse de liste inclut :

```json
{
  "items": [ /* ... */ ],
  "pagination": {
    "next_cursor": "eyJpZCI6InZtXzAxSEc3Li4uIn0=",
    "total_count": null
  }
}
```

Quand `next_cursor` vaut `null`, vous avez atteint la dernière page.

## Parcourir les pages {#walking}

```ts
async function listAllVms(): Promise<VM[]> {
  const all: VM[] = []
  let cursor: string | undefined

  do {
    const url = new URL('{{API_BASE_URL}}/v1/vms')
    url.searchParams.set('limit', '200')
    if (cursor) url.searchParams.set('cursor', cursor)

    const res = await fetch(url, { headers: auth })
    const { items, pagination } = await res.json()

    all.push(...items)
    cursor = pagination.next_cursor ?? undefined
  } while (cursor)

  return all
}
```

Trois règles :

1. **Les curseurs sont opaques.** N’essayez pas de les analyser, n’essayez pas de les construire. Ils encodent l’état de tri + filtres de votre requête d’origine : un curseur issu d’une requête ne fonctionne donc pas dans une autre.
2. **Ne changez pas de filtres en cours de pagination.** Si vous commencez avec `?status=running`, puis ajoutez `?region=us-east-1` pour la page 2, vous obtenez un comportement indéfini. Repartez de zéro (sans curseur) quand les filtres changent.
3. **Arrêtez-vous quand `next_cursor` est null.** N’essayez pas de continuer à paginer « au cas où » — le curseur est le seul signal de fin de liste qui fasse foi.

## Pourquoi des curseurs et pas `?page=2&per_page=50` {#why-cursors}

La pagination par offset casse dans deux scénarios bien réels :

**Insertions pendant la pagination.** Si vous récupérez la page 1 (éléments 1–50), que quelqu’un crée ensuite une nouvelle VM, puis que vous récupérez la page 2 (éléments 51–100), vous verrez l’élément 50 deux fois (il est maintenant en position 51) et vous ne verrez jamais le nouvel élément. Les curseurs capturent « où vous en étiez » — la page suivante commence après l’endroit où vous étiez réellement, pas à un offset absolu.

**Suppressions pendant la pagination.** Même problème, à l’envers : si une VM est supprimée entre deux récupérations de page, un client paginé par offset saute un élément. Les clients paginés par curseur, non.

Ces cas limites comptent dès que l’échelle n’est plus triviale. Nous utilisons la pagination par curseur par défaut pour qu’ils ne vous piègent pas.

## `total_count` {#total-count}

Le champ `total_count` de `pagination` est **null sur la plupart des endpoints**, à dessein. Compter tous les éléments d’une liste paginée est une requête coûteuse, de moins en moins utile à mesure que N grandit (« vous avez 14,328 VM dans l’ensemble de vos projets » — qu’en faites-vous ?). Quand `total_count` est présent, la page de référence de l’endpoint le documente ; quand il est absent, n’en dépendez pas.

Si vous avez vraiment besoin d’un décompte exact, paginez jusqu’au bout et comptez ce que vous avez obtenu.

## Ordre de tri {#sort}

Les endpoints de liste ont un tri par défaut (généralement `created_at desc`, le plus récent d’abord), documenté pour chaque endpoint. Certains endpoints acceptent `?sort=` pour le modifier ; la page de référence liste ce qui est accepté.

Le curseur encode le tri : changer `?sort=` entre deux récupérations de page fait donc partie des cas de « comportement indéfini » — repartez de zéro quand vous le changez.

## Filtres {#filters}

Chaque endpoint de liste accepte quelques paramètres de filtre standard :

- `created_after` / `created_before` — timestamps RFC 3339
- `updated_after` / `updated_before` — timestamps RFC 3339
- Des filtres propres à la ressource (par exemple `?region=us-east-1&state=running` sur les VM)

Les filtres se combinent ; la réponse est le ET logique de tous les filtres. La page de référence de la ressource documente les filtres qu’elle accepte.

## Quand vous voulez vraiment tous les éléments {#listing}

Appeler la liste paginée dans une boucle serrée pour énumérer chaque ressource convient pour un travail ponctuel, mais coûte cher pour des daemons qui tournent en continu. Deux meilleurs modèles :

1. **Webhooks.** Abonnez-vous aux événements `resource.created` / `resource.deleted` et maintenez votre propre index. Voir [Webhooks de la plateforme](/docs/webhooks).
2. **Endpoints d’export en masse.** Pour certaines ressources (snapshots, sauvegardes, journaux d’audit), un endpoint d’export dédié renvoie l’ensemble complet en streaming, en une seule réponse. La page de référence de la ressource documente ces endpoints quand ils existent.

Le modèle de pagination est fait pour l’usage interactif (un tableau dans la console, une commande de liste de la CLI). Pour une synchronisation continue, le coût de la pagination domine et les webhooks sont la bonne réponse.

## Étapes suivantes {#next-steps}

- [Conventions](/docs/conventions) — le reste du format des requêtes (codes de statut, erreurs, idempotence).
- [Webhooks de la plateforme](/docs/webhooks) — l’alternative en push pour une synchronisation continue.
- La page de référence de n’importe quel endpoint de liste — filtres et options de tri propres à l’endpoint.
