---
title: "Vérification de signature"
description: "Le contrat de signature des webhooks livrés — headers, construction HMAC et les trois règles pour la vérifier."
publishedAt: 2026-08-05
updatedAt: 2026-08-05
kind: concept
---

# Vérification de signature

Chaque livraison est signée avec le secret de signature de l’endpoint destinataire. Vérifier cette signature, c’est ce qui distingue « un POST est arrivé sur mon URL » de « NimbusNexus m’a envoyé cet événement » — une URL de webhook n’est pas un secret, et n’importe quoi sur internet peut la trouver.

Cette page est le contrat. Si vous utilisez l’un des [SDK](/docs/product-webhooks/sdks), son helper `verify` implémente déjà tout cela, et vous pouvez passer directement à [ce qu’il faut faire après la vérification](#responding).

## Les headers {#headers}

| Header | Contenu |
|---|---|
| `X-Webhook-Signature` | `sha256=<hex>` — le HMAC que vous vérifiez. **Plusieurs tokens séparés par des virgules pendant une rotation de secret** ; voir les [règles](#rules) |
| `X-Webhook-Timestamp` | Secondes Unix ; fait partie de la signature et de la fenêtre de rejeu |
| `X-Webhook-Event-Id` | L’identifiant de l’événement, identique à `id` dans le corps — utilisez-le pour dédupliquer |
| `X-Webhook-Event-Type` | Le type d’événement |
| `X-Webhook-Delivery-Id` | L’identifiant de cette livraison ; citez-le dans vos demandes au support |

> Ce ne sont **pas** les headers utilisés par les [webhooks de la plateforme](/docs/webhooks), qui signent les notifications d’infrastructure avec un préfixe `NN-`. Les deux produits sont des systèmes distincts. Un handler écrit avec les mauvais noms de headers ne trouvera rien à vérifier et rejettera chaque livraison.

## La construction {#construction}

```text
signature = "sha256=" + hex( HMAC_SHA256( secret, "<timestamp>." + raw_body ) )
```

Le timestamp, un `.` littéral, puis le corps brut de la requête — concaténés, passés au HMAC avec le secret de signature de votre endpoint, encodés en hexadécimal et préfixés par `sha256=`.

Intégrer le timestamp aux données signées, c’est ce qui rend la fenêtre de rejeu applicable. Si le timestamp n’était qu’un header à côté de la signature, un attaquant qui rejoue une livraison interceptée pourrait le réécrire librement ; le signer signifie que toute modification invalide le HMAC.

Le corps lui-même est du JSON compact, à clés triées, sérialisé une seule fois au moment de la publication puis stocké. Chaque réessai d’une livraison envoie des **octets identiques** — une livraison qui réussit enfin à la quatrième tentative se vérifie donc exactement comme la première tentative l’aurait fait. Chaque tentative est signée à nouveau avec un timestamp frais, ce qui explique qu’un réessai très tardif tombe toujours dans une fenêtre de rejeu serrée.

## Les trois règles {#rules}

**1. Signer les octets bruts.** Lisez le corps une seule fois, sous forme d’octets, et vérifiez-le tel quel. Analyser le JSON puis le resérialiser change l’ordre des clés et les espaces, et la signature porte sur ce que nous avons envoyé, pas sur un objet équivalent. C’est de loin la cause la plus fréquente du « la signature ne correspond jamais » — le payload est correct, mais la comparaison porte sur d’autres octets.

Les frameworks qui analysent le JSON d’office exposent généralement l’original à part : `request.body` dans Flask, `req.rawBody` avec un hook verify d’Express, `await request.body()` dans FastAPI.

**2. Comparer à temps constant — avec chaque token.** Utilisez `hmac.compare_digest`, `crypto.timingSafeEqual`, `hmac.Equal` — pas `==`. Une comparaison octet par octet qui s’arrête au premier écart laisse fuiter, par le temps de réponse, quelle part d’une signature devinée était correcte, ce qui transforme la falsification en une recherche réalisable. Bien faire ne coûte rien ; le coût d’une erreur ne se voit pas en test, car une implémentation incorrecte passe tous les tests fonctionnels.

Découpez d’abord le header sur `,` et acceptez si **n’importe quel** token correspond. Normalement, il y a exactement un token, si bien que cela semble superflu — mais pendant une rotation du secret de signature, nous signons avec le nouveau et avec l’ancien secret, et envoyons `sha256=<a>,sha256=<b>`. Un vérificateur qui compare la valeur entière du header à un seul token attendu ne correspond à aucun des deux, et rejette **chaque** livraison pendant toute la durée du recouvrement. Les SDK officiels découpent tous ; c’est le vérificateur fait main qui se trompe.

**3. Rejeter les timestamps périmés.** Si `X-Webhook-Timestamp` s’écarte de plus de **300 secondes** de votre horloge, rejetez la livraison, que le HMAC soit valide ou non. Sans cela, une livraison interceptée reste rejouable indéfiniment. Avec, l’exposition est limitée à cinq minutes, même si un payload est intercepté.

La règle 3 suppose que l’horloge de votre serveur soit à peu près juste. Si des livraisons se mettent à échouer en masse à la vérification après un changement d’infrastructure, vérifiez NTP avant de vérifier votre code.

## Un handler complet {#example}

```python
import hashlib, hmac, time

WINDOW_SECONDS = 300

def verify(secret: str, raw_body: bytes, signature: str, timestamp: str) -> bool:
    # Rule 3 — replay window, checked first because it is the cheapest rejection.
    try:
        if abs(int(time.time()) - int(timestamp)) > WINDOW_SECONDS:
            return False
    except (TypeError, ValueError):
        return False  # absent or non-numeric header

    # Rule 1 — the raw bytes, exactly as received.
    expected = "sha256=" + hmac.new(
        secret.encode(), f"{timestamp}.".encode() + raw_body, hashlib.sha256
    ).hexdigest()

    # Rule 2 — constant-time comparison against EVERY token. One token normally; several,
    # comma-separated, while a rotation overlap is in effect.
    return any(
        hmac.compare_digest(expected, token.strip())
        for token in signature.split(",")
    )
```

## Répondre {#responding}

Renvoyez un `2xx` et nous considérons la livraison comme effectuée. Toute autre réponse — ou l’absence de réponse avant le timeout — compte comme un échec et entre dans le calendrier des réessais.

Accusez réception vite et faites le travail ensuite. Un handler qui termine une tâche lente avant de répondre garde la livraison ouverte, et s’il dépasse le timeout, le travail est fait *et* la livraison est réessayée, ce qui vous donne le doublon que vous cherchiez à éviter. Mettez le travail en file, renvoyez `200`, traitez-le à part.

Soyez idempotent dans tous les cas. La livraison se fait au moins une fois : prévoyez de voir le même événement deux fois, et dédupliquez sur `X-Webhook-Event-Id`, qui reste stable sur tous les réessais d’une livraison.

## Faire tourner un secret {#rotation}

```bash
curl -sX POST {{WEBHOOKS_BASE_URL}}/v1/endpoints/ep_3f9a/rotate-secret \
  -H "Authorization: Bearer $ADMIN_KEY"
```

Le nouveau secret n’est renvoyé qu’une fois. Vous n’avez **pas** besoin de gérer deux secrets dans votre handler : pendant environ 24 heures après une rotation, nous signons chaque livraison avec le nouveau et avec l’ancien secret, et envoyons les deux tokens dans un seul header, `sha256=<new>,sha256=<previous>`. Un vérificateur qui suit la [règle 2](#rules) et contrôle chaque token continue de fonctionner tout du long, quel que soit le secret dont il dispose : vous pouvez donc passer au nouveau immédiatement.

Le corollaire est le piège : un vérificateur qui compare la valeur entière du header fonctionne parfaitement jusqu’à la première rotation, puis rejette tout pendant une journée. Si vous faites tourner le secret et que des livraisons se mettent à échouer en masse à la vérification, cette comparaison est la première chose à vérifier.

## Étapes suivantes {#next-steps}

- [SDK](/docs/product-webhooks/sdks) — des helpers `verify` qui implémentent cette page.
- [Démarrage rapide](/docs/product-webhooks/quickstart) — le parcours de bout en bout dans lequel cela s’inscrit.
- [Vue d’ensemble de Webhooks](/docs/product-webhooks) — la sémantique de livraison et la dead-letter queue.
- [Webhooks de la plateforme](/docs/webhooks) — les notifications d’infrastructure distinctes, signées avec `NN-`.
