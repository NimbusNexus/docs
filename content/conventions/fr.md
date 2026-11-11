---
title: "Conventions"
description: "Les règles que suivent les API — identifiants de ressource, pagination, erreurs, idempotence, opérations longues."
publishedAt: 2026-05-19
updatedAt: 2026-11-11
kind: concept
---

# Conventions

NimbusNexus a deux types d’API, et elles ne partagent pas toutes leurs conventions. L’**API d’infrastructure** sur `{{API_HOST}}` (VM, réseaux, stockage, DNS et votre compte) a ses routes sous `/api/v1/` et prend une clé API dans le header `X-API-Key` ([Authentification](/docs/authentication)). Les **API des apps** (Webhooks, Inboxes, Request Bins et les autres) ont chacune leur propre URL de base, avec des routes sous `/v1/`, et prennent une clé comme token Bearer ([Configurer l’API REST](/docs/setup/rest)). Cette page indique où les deux diffèrent.

## Identifiants de ressource {#resource-ids}

Sur l’API d’infrastructure, la plupart des identifiants de ressource sont des UUID, comme `3f0c9e1a-6b7d-4c2e-9a51-7d2b8f4e1c60` ; les conteneurs et les objets du stockage objet se désignent par leur nom. Sur les API des apps, les identifiants portent un préfixe, comme `ep_` pour un endpoint Webhooks ou `evt_` pour un événement. Traitez tout identifiant comme une chaîne opaque.

Les identifiants restent stables pendant toute la vie de la ressource — jamais réutilisés, jamais réécrits lors d’un renommage. Utilisez-les dans les URL, les clés étrangères et les journaux d’audit ; n’utilisez les champs `name` lisibles par un humain que pour l’affichage.

## Pagination {#pagination}

Sur Webhooks, Inboxes, Request Bins et Transforms, la plupart des endpoints de liste acceptent deux paramètres de requête ([Pagination](/docs/pagination#shape) liste ceux qui diffèrent) :

- `limit` — taille de page. 50 par défaut, 200 au maximum. Au-delà de 200, la requête échoue à la validation : `422` `validation_error` ([Erreurs](/docs/errors#codes-validation)).
- `offset` — le nombre d’éléments à ignorer. Le corps de la réponse renvoie la valeur suivante dans `next_offset` ; renvoyez-la dans `offset` pour avancer.

Le modèle en code :

```bash
# Page 1
curl '{{WEBHOOKS_BASE_URL}}/v1/endpoints?limit=50' \
  -H "Authorization: Bearer $WEBHOOKS_API_KEY"

# Page 2 (offset from page 1's response.next_offset)
curl '{{WEBHOOKS_BASE_URL}}/v1/endpoints?limit=50&offset=50' \
  -H "Authorization: Bearer $WEBHOOKS_API_KEY"
```

Quand `next_offset` est null, vous êtes sur la dernière page.

Sur l’API d’infrastructure, la plupart des endpoints de liste, comme `GET /api/v1/instance/`, répondent avec la liste complète et ne prennent aucun paramètre de pagination. Ceux qui paginent le font de l’une de deux façons :

- `limit` et `marker` (le dernier identifiant ou nom que vous avez vu) : images de VM, zones DNS et jeux d’enregistrements, conteneurs et objets du stockage objet.
- `limit` et `offset` : sauvegardes de volume, planifications de sauvegarde, connexions de stockage externe, notifications.

```bash
# Page 1
curl '{{API_BASE_URL}}/api/v1/zones/?limit=50' \
  -H "X-API-Key: $NIMBUS_KEY"

# Page 2 (marker: the id of the last zone on page 1)
curl '{{API_BASE_URL}}/api/v1/zones/?limit=50&marker=<zone-id>' \
  -H "X-API-Key: $NIMBUS_KEY"
```

## Erreurs {#errors}

Les deux types d’API répondent différemment en cas d’erreur. Sur l’API d’infrastructure, une erreur porte `success: false` et un `message` :

```json
{
  "success": false,
  "message": "Authentication required"
}
```

Un échec de validation (`422`) porte `errors` à la place, avec les champs en échec :

```json
{
  "success": false,
  "errors": {
    "field": ["Invalid value"]
  }
}
```

Il n’y a pas de code d’erreur ici : basez-vous sur le statut et n’analysez pas `message`. Chaque réponse porte un header `X-Request-ID` ; indiquez-le quand vous contactez le support.

Chaque réponse d’erreur de Webhooks, d’Inboxes, de Request Bins et de Transforms utilise ce format JSON :

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
| `200`     | Succès avec corps. Sur l’API d’infrastructure, également une requête dont le travail est mis en file d’attente ([Opérations longues](#operations)). |
| `201`     | Ressource créée. |
| `202`     | Acceptée : le travail se termine après la réponse ([Opérations longues](#operations)). |
| `204`     | Succès, sans corps (typique pour DELETE). |
| `400`     | La requête n’a pas pu être lue telle qu’envoyée. `error.message`, ou `message` sur l’API d’infrastructure, dit pourquoi. |
| `401`     | Aucun justificatif d’identité utilisable. Voir [Authentification](/docs/authentication). |
| `402`     | Sur les API des apps : votre plan ou votre état de facturation bloque la requête (un quota, une fonctionnalité absente de votre plan, un espace de travail gelé). Réessayer ne servira à rien. |
| `403`     | Authentifié mais non autorisé (portée manquante, mauvais projet, etc.). Sur Webhooks, également un justificatif que l’API n’accepte pas. Sur l’API d’infrastructure, également un appel hors des règles d’accès d’une clé API. |
| `404`     | La ressource n’existe pas, OU l’appelant ne peut pas la voir. Nous ne faisons volontairement pas la distinction — révéler l’existence d’une ressource est en soi une fuite d’accès. |
| `409`     | Conflit d’état (nom déjà pris, `Idempotency-Key` réutilisée avec un corps différent, etc.). |
| `413`     | Le corps dépasse la limite de taille. |
| `422`     | La validation a échoué. Sur une erreur de validation (`validation_error`), `error.details.errors` liste les données en échec ; sur les autres codes `422` de l’API Webhooks, comme `invalid_payload` ou `unknown_event_type`, c’est un objet qui nomme la valeur ou la règle en cause. Sur l’API d’infrastructure, `errors` contient les champs en échec. |
| `429`     | Limité en débit. Quand `Retry-After` est défini, il indique quand réessayer. |
| `500–504` | Problème côté serveur. Réessayer les requêtes idempotentes est toujours sans risque. |

## Idempotence {#idempotency}

Quelques routes acceptent un header `Idempotency-Key`, pour qu’un réessai ne fasse pas le travail deux fois. Sur Webhooks, il s’agit de la publication d’un événement. Passez n’importe quelle valeur unique (un UUID, par convention) :

```bash
curl -X POST {{WEBHOOKS_BASE_URL}}/v1/events \
  -H "Authorization: Bearer $WEBHOOKS_API_KEY" \
  -H "Idempotency-Key: 8e1c91a4-04d0-4d77-8e6e-2f7c1a5b8e84" \
  -H "Content-Type: application/json" \
  -d '{ "event_type": "order.created", "payload": { "order_id": "1234" } }'
```

Toutes les autres routes ignorent ce header. Sur l’API d’infrastructure, créer une VM deux fois donne deux VM, avec ou sans clé. [Idempotence](/docs/idempotency) liste les routes qui l’acceptent, et ce qu’il faut faire sur les autres.

Les endpoints GET sont toujours idempotents et n’ont pas besoin de ce header.

## Opérations longues {#operations}

Certaines actions ne se terminent pas pendant la requête. Sur l’API d’infrastructure, elles répondent dès que le travail est mis en file d’attente :

- `POST /api/v1/instance/` (créer une VM) répond `200` avec `{"success": true}` et sans identifiant.
- `POST /api/v1/storage/` (créer un volume) répond `201` sans identifiant.
- `POST /api/v1/instance/{instance_id}/resize` répond `200`, et la VM passe à `VERIFY_RESIZE`.
- `PUT` et `DELETE` sur un jeu d’enregistrements DNS répondent `202`.

Il n’y a pas d’objet d’opération à suivre. Pour suivre le travail, lisez la ressource et surveillez son `status` : `GET /api/v1/instance/` montre une nouvelle VM en `BUILD`, puis `ACTIVE` ou `ERROR`. Une interrogation compte comme un appel d’API ordinaire dans les limites de débit.

## Timestamps {#timestamps}

Tous les timestamps sont au format **RFC 3339 / ISO 8601 en UTC**, avec le suffixe `Z` :

```text
2026-05-19T18:30:00Z
```

Jamais en heure locale, jamais avec un décalage, jamais un epoch sous forme d’entier (sauf dans les headers de signature des webhooks, qui portent un timestamp Unix parce que c’est la convention des signataires HMAC). `Date.parse()` en JavaScript et les parseurs équivalents des bibliothèques standard des autres langages gèrent ce format nativement.

## Étapes suivantes {#next-steps}

- [Authentification](/docs/authentication) couvre le header d’authentification, ainsi que les rôles et les règles d’accès qui limitent une clé.
- Les pages de référence — [Machines virtuelles](/docs/api/vms), [Stockage en bloc](/docs/api/block-storage), [Stockage objet](/docs/api/object-storage), [Régions](/docs/api/regions) — montrent ces conventions en pratique.
