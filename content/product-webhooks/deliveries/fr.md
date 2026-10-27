---
title: "Livraisons et réessais"
description: "Ce qu’il advient de chaque événement après sa diffusion — les états d’une livraison, le calendrier des réessais, la dead-letter queue et comment effectuer des renvois."
publishedAt: 2026-10-19
updatedAt: 2026-10-21
kind: concept
---

# Livraisons et réessais

Publier un événement crée une **livraison** pour chaque endpoint abonné à son type. Une livraison est l’unité que nous envoyons, réessayons et enregistrons : vous pouvez voir chacune de ses tentatives et ce qui a été répondu, et la renvoyer chaque fois que nécessaire.

## États d’une livraison {#states}

| État | Signification |
|---|---|
| `queued` | En attente de sa première tentative. |
| `sending` | Une tentative est en cours. |
| `sent` | L’endpoint a répondu 2xx. Terminé. |
| `failed` | La dernière tentative a échoué et une autre est planifiée (`next_attempt_at`). |
| `dead` | Plus de tentatives disponibles, ou retenue sans être envoyée parce que son endpoint doit d’abord passer la [vérification](/docs/product-webhooks/endpoint-verification#gated). Conservée dans la dead-letter queue jusqu’à ce que vous la renvoyiez. |

Tout ce qui n’est pas un 2xx compte comme un échec : un statut 4xx ou 5xx, un timeout, une erreur de connexion ou de TLS. Chaque tentative attend une réponse jusqu’à 10 secondes, ou le `delivery_timeout_ms` propre à l’endpoint (de 100 ms à 60 s).

## Le calendrier des réessais {#retries}

Une livraison échouée est réessayée après 30 secondes, puis 1, 2, 4 et 8 minutes, l’intervalle doublant à chaque fois jusqu’à une heure entre deux tentatives, jusqu’à atteindre le `max_attempts` de l’endpoint. Votre plan plafonne `max_attempts` (5 sur Free, 8 sur Starter, 10 sur Pro).

Quand la courbe par défaut ne convient pas au récepteur, donnez à l’endpoint un `retry_schedule` — le délai en secondes avant chaque réessai :

```bash
curl -sX PATCH {{WEBHOOKS_BASE_URL}}/v1/endpoints/ep_3f9a… \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"retry_schedule": [10, 60, 300, 1800]}'
```

Chaque tentative envoie les mêmes octets, signés à nouveau avec un timestamp frais : une livraison qui arrive avec une heure de retard se vérifie donc toujours.

## Quand un endpoint échoue sans cesse {#auto-disable}

Après 20 échecs consécutifs, un endpoint est désactivé automatiquement, avec la raison enregistrée, et nous envoyons un [webhook opérationnel](#operational) `endpoint.disabled` pour que vous en soyez informé. Les nouveaux événements ne lui sont plus diffusés. Réparez le récepteur, puis activez l’endpoint (`POST /v1/endpoints/{id}/enable`, ou **Enable** dans la console) et relivrez ce qu’il a manqué.

## Voir ce qui s’est passé {#attempts}

Dans la console, **Deliveries** liste chaque livraison avec son statut, ses tentatives et sa dernière erreur ; ouvrez-en une pour voir chaque tentative — code de statut, erreur, durée — et le payload envoyé. Via l’API :

```bash
curl -s "{{WEBHOOKS_BASE_URL}}/v1/deliveries?status=failed&endpoint_id=ep_3f9a…" \
  -H "Authorization: Bearer $READ_KEY"

curl -s {{WEBHOOKS_BASE_URL}}/v1/deliveries/dlv_…/attempts \
  -H "Authorization: Bearer $READ_KEY"
```

Là où le déploiement les enregistre, une tentative porte aussi le début du corps de la réponse de l’endpoint et les headers que nous avons envoyés (avec les justificatifs d’identité masqués).

## Renvoyer {#replay}

| Quoi | Comment |
|---|---|
| Une livraison | `POST /v1/deliveries/{id}/redeliver` — depuis `dead`, `failed` ou `sent`. |
| Toutes les livraisons mortes (ou en échec) | `POST /v1/deliveries/redeliver` avec `{"status": "dead"}`, éventuellement restreint par `endpoint_id` ou `project_id`. |
| Les livraisons d’une fenêtre de temps | `POST /v1/deliveries/replay` avec `from`, `to` et `status` — pour « le récepteur était en panne de 02:00 à 04:00 ». Clés admin uniquement ; 10,000 au plus par appel. |
| Un événement, vers l’endpoint de votre choix | `POST /v1/events/{id}/replay` avec `{"endpoint_id": "ep_…"}` — même un endpoint qui n’était pas abonné. Clés admin uniquement. |

Ces quatre opérations créent de nouvelles tentatives de l’événement stocké ; elles ne publient pas de nouvel événement, si bien que l’identifiant d’événement sur lequel votre endpoint déduplique reste le même. Un endpoint qui doit passer la [vérification](/docs/product-webhooks/endpoint-verification#gated) et ne l’a pas passée est refusé (`409 endpoint_not_verified`) ou, dans les deux formes en masse, écarté et compté dans `skipped_unverified`.

## Webhooks opérationnels {#operational}

Pour être informé des problèmes de livraison sans surveiller la console, abonnez un de vos propres endpoints à nos événements opérationnels : `endpoint.disabled`, `endpoint.degraded`, `endpoint.recovered` et `message.attempt.exhausted` (une livraison est passée à `dead`). Ajoutez-en un sous **Operational webhooks** dans la console, ou avec `POST /v1/operational-endpoints`. Ils sont signés comme n’importe quelle autre livraison.

## Durée de conservation des livraisons {#retention}

Les événements, leurs livraisons et leurs tentatives sont conservés 90 jours.

## Étapes suivantes {#next-steps}

- [Vérification des endpoints](/docs/product-webhooks/endpoint-verification) — pourquoi un endpoint correspondant peut ne recevoir aucune livraison.
- [Vérification de signature](/docs/product-webhooks/signatures) — vérifier chaque livraison de votre côté.
- [Vue d’ensemble de Webhooks](/docs/product-webhooks) — événements, endpoints et abonnements.
