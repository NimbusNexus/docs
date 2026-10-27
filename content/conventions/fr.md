---
title: "Conventions"
description: "Les règles que l’API suit partout — identifiants de ressource, pagination, erreurs, idempotence, opérations longues."
publishedAt: 2026-05-19
updatedAt: 2026-10-15
kind: concept
---

# Conventions

L’API a une seule forme, répétée sur chaque ressource. Une fois que vous connaissez cette forme, vous connaissez tous les endpoints — la seule chose qui change d’une ressource à l’autre est l’ensemble des champs de la ressource elle-même.

## Identifiants de ressource {#resource-ids}

Chaque ressource a un identifiant opaque et stable, de la forme `<prefix>_<26-char-base32>` :

| Ressource               | Préfixe | Exemple                           |
| ----------------------- | ------- | --------------------------------- |
| Machine virtuelle       | `vm_`   | `vm_01H8FZQ4XW9KMP4XQNR3VT7DC2`   |
| Base de données managée | `db_`   | `db_01H8FZQ4XW9KMP4XQNR3VT7DC2`   |
| Volume block            | `vol_`  | `vol_01H8FZQ4XW9KMP4XQNR3VT7DC2`  |
| Snapshot                | `snap_` | `snap_01H8FZQ4XW9KMP4XQNR3VT7DC2` |
| Clé API                 | `key_`  | `key_01H8FZQ4XW9KMP4XQNR3VT7DC2`  |

Les identifiants restent stables pendant toute la vie de la ressource — jamais réutilisés, jamais réécrits lors d’un renommage. Utilisez-les dans les URL, les clés étrangères et les journaux d’audit ; n’utilisez les champs `name` lisibles par un humain que pour l’affichage.

## Pagination {#pagination}

Les endpoints de liste acceptent deux paramètres de requête :

- `limit` — taille de page. 50 par défaut, 200 au maximum. Au-delà de 200, la requête échoue à la validation : `422` `validation_error` ([Erreurs](/docs/errors#codes-validation)).
- `cursor` — pointeur opaque vers la page suivante. Le corps de la réponse le renvoie dans `pagination.next_cursor` quand il reste des pages ; renvoyez-le dans `cursor` pour avancer.

Les curseurs sont opaques — n’essayez pas de les décoder ni de les construire. Ils incluent l’état de tri + filtres de la requête d’origine : changer de filtres en cours de pagination produit donc un comportement indéfini. Repartez de zéro (sans `cursor`) quand vos filtres changent.

Le modèle en code :

```bash
# Page 1
curl '{{API_BASE_URL}}/v1/vms?limit=50' \
  -H "Authorization: Bearer $NIMBUS_KEY"

# Page 2 (cursor from page 1's response.pagination.next_cursor)
curl '{{API_BASE_URL}}/v1/vms?limit=50&cursor=eyJpZCI6...' \
  -H "Authorization: Bearer $NIMBUS_KEY"
```

Quand `pagination.next_cursor` est absent ou null, vous êtes sur la dernière page.

## Erreurs {#errors}

Chaque réponse d’erreur utilise le même format JSON :

```json
{
  "error": {
    "code": "validation_error",
    "message": "request validation failed",
    "details": {
      "errors": [
        {
          "loc": ["body", "event_type"],
          "msg": "Field required",
          "type": "missing"
        }
      ]
    },
    "request_id": "7e4b1d9c2a6f4e8b9d3c5a1f0e2b4c68"
  }
}
```

- `code` — chaîne stable, lisible par une machine. Basez-vous sur elle, et non sur le code de statut, quand un même statut a plusieurs sens (par exemple, `402` peut être `quota_exceeded`, `not_entitled` ou `workspace_frozen`).
- `message` — texte en anglais lisible par un humain, pour les logs. Non localisé ; si vous montrez une erreur à des utilisateurs finaux, faites correspondre `code` à votre propre texte.
- `details` — présent sur certains codes. Sur une erreur de validation, `details.errors` liste les données en échec ; sur beaucoup d’autres erreurs, il porte un `reason` qui précise le code, avec les valeurs qui vont avec. Son format dépend du code.
- `request_id` — sur chaque corps d’erreur envoyé par l’API : le même identifiant que le header `X-Request-ID` que porte chaque réponse de l’API. Une réponse de la couche edge placée devant elle (un `502` ou un `504`, par exemple, ou un `413` pour un corps trop volumineux pour atteindre l’API) ne porte ni le corps d’erreur de l’API ni le header `X-Request-ID` ([Erreurs](/docs/errors#request-id)). Journalisez-le et indiquez-le quand vous contactez le support.
- `next_code` — envoyé seulement pendant qu’un code est renommé : le code que portera cette erreur ensuite. Quand il est présent, basez-vous sur lui plutôt que sur `code`. Aucun code n’est en cours de renommage aujourd’hui, donc l’API ne l’envoie pas.

[Erreurs](/docs/errors) liste chaque code et chaque raison, et indique laquelle des API Webhooks et Inboxes envoie chacun. (Des versions antérieures de cette page montraient `validation_failed` comme un `400`, avec `fields` et `request_id` dans le corps. Les API n’ont jamais envoyé les deux premiers : un échec de validation est un `422` `validation_error`, avec `details`. `request_id` n’était pas non plus dans le corps à l’époque ; les corps d’erreur de l’API le portent désormais.)

## Codes de statut HTTP {#status-codes}

Nous utilisons un ensemble restreint et prévisible :

| Statut    | Quand |
| --------- | ----- |
| `200`     | Succès avec corps. |
| `201`     | Ressource créée. Le header `Location` pointe vers la nouvelle ressource. |
| `202`     | Opération acceptée ; consultez `operation.status` pour suivre sa progression. |
| `204`     | Succès, sans corps (typique pour DELETE). |
| `400`     | La requête n’a pas pu être lue telle qu’envoyée. `error.message` dit pourquoi. |
| `401`     | Aucun justificatif d’identité utilisable. Voir [Authentification](/docs/authentication). |
| `402`     | Votre plan ou votre état de facturation bloque la requête (un quota, une fonctionnalité absente de votre plan, un espace de travail gelé). Réessayer ne servira à rien. |
| `403`     | Authentifié mais non autorisé (portée manquante, mauvais projet, etc.). Sur Webhooks, également un justificatif que l’API n’accepte pas. |
| `404`     | La ressource n’existe pas, OU l’appelant ne peut pas la voir. Nous ne faisons volontairement pas la distinction — révéler l’existence d’une ressource est en soi une fuite d’accès. |
| `409`     | Conflit d’état (nom déjà pris, `Idempotency-Key` réutilisée avec un corps différent, etc.). |
| `413`     | Le corps dépasse la limite de taille. |
| `422`     | La validation a échoué. Sur une erreur de validation (`validation_error`), `error.details.errors` liste les données en échec ; sur les autres codes `422` de l’API Webhooks, comme `invalid_payload` ou `unknown_event_type`, c’est un objet qui nomme la valeur ou la règle en cause. |
| `429`     | Limité en débit. Quand `Retry-After` est défini, il indique quand réessayer. |
| `500–504` | Problème côté serveur. Réessayer les requêtes idempotentes est toujours sans risque. |

## Idempotence {#idempotency}

Les endpoints de modification (POST, PUT, PATCH, DELETE) acceptent un header `Idempotency-Key` facultatif. Passez n’importe quelle valeur unique (un UUID, par convention) ; nous mettons la réponse en cache pendant 24 heures et renvoyons la même réponse si la requête est répétée avec la même clé.

```bash
curl -X POST {{API_BASE_URL}}/v1/vms \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Idempotency-Key: 8e1c91a4-04d0-4d77-8e6e-2f7c1a5b8e84" \
  -H "Content-Type: application/json" \
  -d '{ "name": "web", "size": "gp-2-4", "region": "us-east-1", "image": "ubuntu-24.04" }'
```

Utilisez des clés d’idempotence quand votre client peut réessayer une requête après une panne réseau sans savoir si la requête d’origine a réussi. Sans clé, le comportement par défaut est un « réessai au mieux » ; avec une clé, les réessais sont sans risque.

Les endpoints GET sont toujours idempotents et n’ont pas besoin de ce header.

## Opérations longues {#operations}

Certaines actions ne se terminent pas pendant le cycle de vie de la requête :

- Le `POST` d’une VM renvoie `202` pendant que l’hyperviseur alloue l’instance.
- Le `POST` d’une base de données renvoie `202` pendant que les réplicas démarrent.
- Le redimensionnement d’un volume et la migration d’une VM renvoient `202`.

Le corps de réponse de tout 202 inclut un objet `operation` :

```json
{
  "id": "vm_01H8FZQ4XW9KMP4XQNR3VT7DC2",
  "state": "provisioning",
  "operation": {
    "id": "op_01H8FZ...",
    "kind": "vm_create",
    "status": "running",
    "progress": 0.4,
    "started_at": "2026-05-19T18:30:00Z"
  }
}
```

Deux façons de suivre la progression :

1. **Polling** — `GET /v1/operations/{op_id}` une fois par seconde. Peu coûteux ; compte comme un appel d’API ordinaire dans les limites de débit.
2. **Webhook** — abonnez une URL de callback dans la console. Nous envoyons un POST quand l’opération atteint un état terminal (`succeeded` ou `failed`).

La plupart des opérations se terminent en moins de 60 secondes. Les exceptions : le téléchargement d’une image de VM à sa première utilisation (~90 secondes) et la mise en place d’un cluster Kafka (~180 secondes).

## Timestamps {#timestamps}

Tous les timestamps sont au format **RFC 3339 / ISO 8601 en UTC**, avec le suffixe `Z` :

```text
2026-05-19T18:30:00Z
```

Jamais en heure locale, jamais avec un décalage, jamais un epoch sous forme d’entier (sauf dans les headers de signature des webhooks, qui portent un timestamp Unix parce que c’est la convention des signataires HMAC). `Date.parse()` en JavaScript et les parseurs équivalents des bibliothèques standard des autres langages gèrent ce format nativement.

## Étapes suivantes {#next-steps}

- [Authentification](/docs/authentication) couvre le format du header d’authentification et le modèle des portées.
- Les pages de référence — [Machines virtuelles](/docs/api/vms), [Bases de données managées](/docs/api/managed-databases), [Stockage en bloc](/docs/api/block-storage), [Stockage objet](/docs/api/object-storage), [Régions](/docs/api/regions) — montrent ces conventions en pratique.
