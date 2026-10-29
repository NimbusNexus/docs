---
title: "Sources"
description: "Recevez les webhooks de Stripe, de GitHub, de Clerk, de Resend ou de tout expéditeur qui signe en HMAC, et livrez-les à vos endpoints sous forme d’événements."
publishedAt: 2026-10-19
updatedAt: 2026-10-28
kind: concept
---

# Sources

Une source est une URL que vous donnez à un fournisseur — Stripe, GitHub, un expéditeur Standard Webhooks comme Clerk ou Resend, ou tout autre service qui signe ses webhooks — pour qu’il puisse nous les envoyer. Nous vérifions la signature de chaque requête, la transformons en événement et la livrons à vos endpoints exactement comme un événement que vous avez [publié vous-même](/docs/product-webhooks/quickstart#publish) : mêmes abonnements, mêmes réessais, même dead-letter queue.

Utilisez une source quand vous voulez un seul endroit pour le trafic de webhooks dans les deux sens, ou quand vous voulez que plusieurs de vos services reçoivent les événements d’un même fournisseur sans que chacun vérifie lui-même la signature de Stripe.

## Comment une requête devient des livraisons {#flow}

1. Le fournisseur envoie un POST à l’URL d’ingestion de la source, `{{WEBHOOKS_BASE_URL}}/v1/ingest/{source_id}`.
2. Nous vérifions la signature sur les octets exacts reçus, avec le secret de signature de la source.
3. Le corps doit être un objet JSON. Nous y lisons le type d’événement (voir [Types d’événements d’une source](#event-types)).
4. L’événement est publié dans le projet de la source et confronté aux abonnements de vos endpoints, ce qui crée une livraison par endpoint correspondant.
5. Le fournisseur reçoit `202`. Vos endpoints reçoivent l’événement signé avec *leur* secret, et non celui du fournisseur.

L’URL d’ingestion est la seule partie de Webhooks qui accepte des requêtes sans clé API : la signature du fournisseur tient lieu de justificatif d’identité.

## Les fournisseurs et leurs signatures {#providers}

| Fournisseur | Header vérifié | Octets signés | Fenêtre de rejeu |
|---|---|---|---|
| `stripe` | `Stripe-Signature: t=…,v1=…` | `{t}.{body}` | 5 minutes |
| `github` | `X-Hub-Signature-256: sha256=…` | `{body}` | aucune (GitHub n’envoie pas de timestamp) |
| `generic` | `X-Webhook-Signature: sha256=…` avec `X-Webhook-Timestamp` | `{timestamp}.{body}` | 5 minutes |
| `standardwebhooks` | `webhook-signature: v1,…` avec `webhook-id` et `webhook-timestamp`, ou les trois mêmes en `svix-*` | `{id}.{timestamp}.{body}` | 5 minutes |

Les quatre sont en HMAC-SHA256. `generic` est le même schéma que celui avec lequel nous signons nos propres livraisons : l’endpoint d’un espace de travail Webhooks peut donc alimenter la source d’un autre, et tout expéditeur que vous contrôlez peut signer ainsi en quelques lignes. `standardwebhooks` est le schéma de [Standard Webhooks](https://www.standardwebhooks.com/), celui qu’utilise tout expéditeur bâti sur Svix, dont Clerk et Resend.

## Créer une source {#create}

Dans la console : **Sources → New source** (également sur la page Overview). Ou via l’API :

```bash
curl -sX POST {{WEBHOOKS_BASE_URL}}/v1/sources \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{
        "provider": "stripe",
        "name": "Stripe live",
        "secret": "whsec_…",
        "event_type_prefix": "stripe."
      }'
```

- **Stripe, GitHub et Standard Webhooks** : collez le secret de signature que le fournisseur vous montre (pour un expéditeur Standard Webhooks, la valeur `whsec_…` de ses paramètres de webhooks). Une source créée sans secret démarre désactivée ; ajoutez le secret plus tard avec `rotate-secret` et activez-la.
- **Generic** : omettez `secret` et nous en générons un, renvoyé une seule fois dans cette réponse.

La réponse porte `ingest_url`. Collez-la dans les paramètres de webhooks du fournisseur, et ajoutez un endpoint abonné aux types que vous attendez (`prefix` `stripe.` ci-dessus).

## Types d’événements d’une source {#event-types}

Chaque requête a besoin d’un type d’événement auquel les endpoints peuvent s’abonner. Une source le trouve dans cet ordre :

1. Là où vous lui avez dit de chercher : un **header** de la requête, ou un **chemin JSON** pointé dans le corps (`data.object.type`).
2. Sinon, l’emplacement propre au fournisseur : le `type` du corps pour Stripe, les sources génériques et Standard Webhooks, le header `X-GitHub-Event` pour GitHub.
3. Si aucun des deux ne donne de valeur : le **type par défaut** de la source, et à défaut, `webhook.received`.

Le **préfixe** de la source se place devant (`stripe.` + `invoice.paid` → `stripe.invoice.paid`), ce qui sépare les types de deux fournisseurs dans un même projet. Si votre liste de types d’événements affiche `webhook.received`, une source a reçu des requêtes sans type lisible : définissez un type par défaut ou un chemin JSON sur cette source.

L’identifiant d’événement propre au fournisseur (le `evt_…` de Stripe, l’identifiant de livraison de GitHub, le header `webhook-id` de Standard Webhooks) sert de clé d’idempotence : quand un fournisseur réessaie un événement que nous avons déjà accepté, il reçoit de nouveau `202` et rien n’est livré deux fois.

## Ce que voit le fournisseur {#responses}

| Statut | Quand |
|---|---|
| `202` | Accepté et publié. |
| `400` | Le corps n’est pas du JSON, ou pas un objet JSON. |
| `401` | La signature ne s’est pas vérifiée — absente, mal formée, mauvais secret ou hors de la fenêtre de rejeu. Une seule réponse pour tous ces cas, et c’est voulu. |
| `402` | L’espace de travail a épuisé son quota mensuel de livraisons. |
| `404` | Source inexistante, ou source désactivée. |
| `409` | L’identifiant d’événement du fournisseur a déjà été accepté avec un corps différent. |
| `413` | La requête dépasse 512 KiB, ou le payload dépasse 256 KiB. |
| `422` | Le type n’est pas enregistré et la [politique des types d’événements](/docs/product-webhooks/event-types#policy) est Strict, ou le payload ne respecte pas le JSON Schema du type. |
| `429` | Trop de requêtes : 600 par minute et par source avant la vérification de la signature, puis le débit de publication de votre plan. |

Les fournisseurs réessaient sur toute réponse autre que 2xx : un refus n’est donc pas perdu de leur côté — mais pour voir *pourquoi* nous avons refusé, activez l’enregistrement pour la source et consultez les [Requêtes capturées](/docs/product-webhooks/captured-requests).

## Faire tourner un secret {#rotate}

Quand le fournisseur change son secret, envoyez le nouveau :

```bash
curl -sX POST {{WEBHOOKS_BASE_URL}}/v1/sources/src_…/rotate-secret \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"secret": "whsec_new…"}'
```

L’ancien secret continue de vérifier les signatures pendant 24 heures : les requêtes signées avec l’un ou l’autre sont donc acceptées pendant que le fournisseur bascule. Pour une source générique, envoyez un corps vide et nous générons le nouveau secret.

## Étapes suivantes {#next-steps}

- [Requêtes capturées](/docs/product-webhooks/captured-requests) — voir les requêtes brutes reçues par une source, refus compris.
- [Sources dans la référence de l’API](/docs/reference/webhooks#ref-sources) — chaque opération sur les sources, avec les appels SDK et CLI.
- [Types d’événements](/docs/product-webhooks/event-types) — le catalogue des types, et ce qu’il advient d’un type inconnu.
- [Livraisons et réessais](/docs/product-webhooks/deliveries) — ce qui se passe après la publication d’un événement.
- [Vue d’ensemble de Webhooks](/docs/product-webhooks) — les objets et la façon dont ils s’articulent.
