---
title: "Requêtes capturées"
description: "Enregistrez les requêtes brutes qui atteignent une source — headers, corps et ce que nous avons répondu — pour déboguer une intégration avec un fournisseur."
publishedAt: 2026-10-19
updatedAt: 2026-10-22
kind: concept
---

# Requêtes capturées

Quand un fournisseur affirme avoir envoyé un webhook et que rien n’a atteint vos endpoints, les requêtes capturées montrent ce qui est réellement arrivé à votre [source](/docs/product-webhooks/sources) : chaque header, le corps brut, la provenance et ce que nous avons répondu — y compris les requêtes que nous avons refusées, qui ne laissent de trace nulle part ailleurs.

## Activer l’enregistrement {#enable}

L’enregistrement se règle par source et est **désactivé par défaut**, car une requête capturée contient le corps brut d’un vrai webhook — pour un fournisseur de paiement, de vraies données clients. Activez-le pour la seule source que vous déboguez, observez ce qui arrive, puis désactivez-le.

- Dans la console : **Captured requests** affiche en haut de la page un interrupteur pour chaque source.
- Via l’API : `PATCH /v1/sources/{id}` avec `{"capture_enabled": true}`.

Dès lors, chaque requête vers l’URL d’ingestion de cette source est enregistrée, acceptée ou non.

## Ce que contient une capture {#contents}

| Champ | Ce que c’est |
|---|---|
| Méthode, chemin, query string | La ligne de requête telle que reçue. |
| Headers | Bruts, dans l’ordre d’arrivée, doublons conservés — si un fournisseur envoie deux headers `Stripe-Signature`, les deux apparaissent. Les headers d’identification comme `Authorization` et `Cookie` sont masqués ; les headers de signature sont conservés, puisque c’est eux que vous vérifiez. |
| Corps | Les 64 premiers KiB, exactement tels que reçus. Un corps plus long est marqué *truncated*, et un corps tronqué ne permet pas de revérifier une signature. |
| Provenance | L’adresse IP de l’expéditeur. |
| Résultat | `accepted`, ou la raison de notre refus (ci-dessous). |
| Reçu par l’expéditeur | Le statut que nous avons répondu, qui correspond donc à ce qu’affiche la console du fournisseur. |
| Événement | Pour une requête acceptée, l’événement qu’elle est devenue. |

Les répétitions sont regroupées : la même méthode, le même chemin et le même corps qui arrivent de nouveau incrémentent le compteur **times seen** de la capture (Stripe à lui seul réessaie jusqu’à huit fois) au lieu d’ajouter une ligne.

## Résultats {#outcomes}

| Résultat | Reçu par l’expéditeur | Signification |
|---|---|---|
| `accepted` | 202 | Vérifiée et publiée comme événement. |
| `bad_signature` | 401 | La signature ne s’est pas vérifiée avec le secret de la source. |
| `not_json` | 400 | Le corps n’est pas un objet JSON. |
| `rate_limited` | 429 | Au-delà du débit de publication de l’espace de travail. |
| `over_quota` | 402 | L’espace de travail a épuisé son quota mensuel de livraisons. |
| `too_large` | 413 | Le payload dépasse 256 KiB. |
| `unknown_event_type` | 422 | Le type n’est pas enregistré et la [politique des types d’événements](/docs/product-webhooks/event-types#policy) est Strict. |
| `invalid_payload` | 422 | Le payload ne respecte pas le JSON Schema de son type d’événement. |
| `duplicate` | 409 | L’identifiant d’événement du fournisseur a déjà été accepté avec un corps différent. |

`bad_signature` est généralement la première découverte : le mauvais secret collé dans la source, ou un proxy placé devant votre fournisseur qui a réécrit le corps. Comparez les headers capturés avec le journal de livraison du fournisseur lui-même.

Certains refus ne sont pas enregistrés : une requête vers une source inconnue ou désactivée (il n’y a pas de source pour laquelle la conserver), une requête au-delà de la limite de 512 KiB par requête, et une requête refusée par la limite anti-inondation par source avant la vérification de sa signature. Le [tableau des statuts de la page Sources](/docs/product-webhooks/sources#responses) liste ce que l’expéditeur voit dans chaque cas.

## Durée de conservation des captures {#retention}

Une source conserve ses 500 dernières captures, et chacune est supprimée 7 jours après sa dernière occurrence. Supprimez-en une plus tôt depuis la console ou avec `DELETE /v1/captures/{id}`.

## Les lire via l’API {#api}

```bash
# The latest captures for one source, refusals only
curl -s "{{WEBHOOKS_BASE_URL}}/v1/captures?source_id=src_…&outcome=bad_signature" \
  -H "Authorization: Bearer $READ_KEY"

# One capture with its headers and body (base64, since a body may not be UTF-8)
curl -s {{WEBHOOKS_BASE_URL}}/v1/captures/cap_… \
  -H "Authorization: Bearer $READ_KEY"
```

La liste omet les corps ; récupérez une capture par son identifiant pour obtenir `headers_raw` et `body_base64`. Chaque opération sur les captures figure dans la [référence de l’API](/docs/reference/webhooks#ref-captured-requests).

## Ce que ce n’est pas {#not}

Les requêtes capturées ne sont pas un bin de requêtes que vous créez pour y envoyer du trafic arbitraire — elles n’enregistrent que ce qui atteint vos propres sources. Pour une URL qui enregistre toute requête HTTP qui lui est envoyée, utilisez [Request Bins](/docs/product-bins).

## Étapes suivantes {#next-steps}

- [Sources](/docs/product-webhooks/sources) — créer la source, et ce que signifie chaque refus.
- [Types d’événements](/docs/product-webhooks/event-types) — pourquoi une requête peut être refusée avec `unknown_event_type`.
- [Livraisons et réessais](/docs/product-webhooks/deliveries) — ce qu’il advient ensuite d’une requête acceptée.
