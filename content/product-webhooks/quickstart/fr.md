---
title: "Démarrage rapide Webhooks"
description: "Enregistrez un endpoint, publiez un événement et vérifiez la livraison signée — trois requêtes et un handler."
publishedAt: 2026-08-05
updatedAt: 2026-10-19
kind: quickstart
---

# Démarrage rapide Webhooks

De zéro à une livraison vérifiée. Vous allez enregistrer un endpoint de réception, lui publier un événement et vérifier la signature du webhook qui arrive.

## Avant de commencer {#before}

Il vous faut deux choses :

- **Une clé API de portée `admin`.** Créez-en une dans votre console de compte NimbusNexus, sous **API keys**, en choisissant **Webhooks** comme produit et `admin` comme portée. La [vue d’ensemble du produit](/docs/product-webhooks#access) présente les portées. Placez-la dans votre shell :

  ```bash
  export ADMIN_KEY="eyJ…"
  ```

- **Une URL HTTPS publique qui exécute votre handler.** Nous livrons via internet : `localhost` ne convient donc pas. Pour un premier test, un tunnel vers votre ordinateur portable fonctionne (`cloudflared tunnel --url http://localhost:3000`, ou ngrok).

Tous les chemins ci-dessous sont relatifs à `{{WEBHOOKS_BASE_URL}}`.

## 1. Enregistrer un endpoint {#endpoint}

Un endpoint est l’URL HTTPS à laquelle nous livrons, plus les abonnements qui déterminent les types d’événements qu’il reçoit. Celui-ci prend tout ce qui commence par `order.` :

```bash
curl -sX POST {{WEBHOOKS_BASE_URL}}/v1/endpoints \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{
        "url": "https://your-app.example/webhooks",
        "subscriptions": [{"match_kind": "prefix", "pattern": "order."}]
      }'
```

La réponse porte l’endpoint et son **secret de signature** :

```json
{
  "id": "ep_3f9a…",
  "url": "https://your-app.example/webhooks",
  "status": "enabled",
  "health": "healthy",
  "subscriptions": [{ "match_kind": "prefix", "pattern": "order." }],
  "secret": "whsec_…"
}
```

Le secret n’est affiché **qu’une seule fois**. Stockez-le dès maintenant dans votre gestionnaire de secrets — c’est avec lui que vous vérifiez les livraisons, et il ne peut pas être relu. Si vous le perdez, faites-le tourner et mettez à jour votre handler.

`match_kind` accepte `exact`, `prefix`, `suffix` ou `all`. Commencez étroit : un abonnement `all` sur un récepteur qui ne comprend que deux types d’événements vous oblige à écrire dans votre handler un filtre que l’abonnement aurait pu faire à votre place.

**Si votre espace de travail exige la vérification des endpoints**, l’endpoint ne reçoit rien tant qu’il n’a pas réussi un challenge unique : nous envoyons en POST une requête `webhook.verify` portant un token, et votre handler répond 2xx avec le token dans le corps. Un plan peut l’exiger, et tout espace de travail peut l’activer ; la page **Settings** de la console indique si c’est le cas du vôtre. Ajoutez à votre handler les quelques lignes de [Vérification des endpoints](/docs/product-webhooks/endpoint-verification#handler), puis :

```bash
curl -sX POST {{WEBHOOKS_BASE_URL}}/v1/endpoints/ep_3f9a…/verify \
  -H "Authorization: Bearer $ADMIN_KEY"
```

`"verified": true` dans la réponse signifie que la vérification a réussi.

## 2. Publier un événement {#publish}

```bash
curl -sX POST {{WEBHOOKS_BASE_URL}}/v1/events \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: order-123-created" \
  -d '{
        "event_type": "order.created",
        "payload": {"order_id": "ord_123", "total": 4200}
      }'
```

Le champ est `event_type`, pas `type` — `type` est le nom du champ dans l’enveloppe *livrée*, qui est un autre objet. Envoyer `type` ici donne un `422`.

La réponse indique ce que la publication a produit :

```json
{
  "id": "evt_0b6e2c8f4a1d4e7b9c3f5a8d2e6b1c4f",
  "event_uid": "8f1c2e4a9b7d4c3e8a6f5b2d1c0e9a7b",
  "event_type": "order.created",
  "source": null,
  "project_id": "prj_5d2a9c7e1b4f4a8d9e3c6b1a7f2e8d4c",
  "deliveries_created": 1,
  "skipped_unverified": 0
}
```

`id` est l’identifiant API de l’événement (`GET /v1/events/{id}`). `event_uid` est l’identifiant que reçoit votre endpoint, comme `id` de l’enveloppe et dans le header `X-Webhook-Event-Id` — dédupliquez sur lui.

`deliveries_created: 0` est la surprise la plus fréquente lors d’un premier essai, et elle a deux causes :

- **Aucun endpoint n’est abonné à ce type.** Comparez le motif d’abonnement de l’endpoint avec le type que vous avez envoyé.
- **Les endpoints correspondants ne sont pas vérifiés**, et votre espace de travail exige la vérification. `skipped_unverified` les compte ; [vérifiez l’endpoint](/docs/product-webhooks/endpoint-verification) et publiez à nouveau.

C’est le header `Idempotency-Key` qui permet de réessayer la publication sans risque : rejouer la même clé renvoie l’événement d’origine au lieu de le diffuser à nouveau.

## 3. Vérifier la livraison {#verify}

Le webhook arrive à votre URL sous la forme d’un POST dont le corps est l’événement placé dans une enveloppe :

```json
{"created_at":"2026-10-19T15:04:12.483211+00:00","data":{"order_id":"ord_123","total":4200},"id":"8f1c2e4a9b7d4c3e8a6f5b2d1c0e9a7b","type":"order.created","version":"1"}
```

`data` est le payload que vous avez publié, `id` l’`event_uid`, `type` le type d’événement. Vérifiez la signature avant tout traitement — un handler qui s’en dispense traitera tout ce qui trouve votre URL.

```python
import hashlib, hmac, time

def handle(request):
    secret = ENDPOINT_SIGNING_SECRET          # from step 1
    timestamp = request.headers["X-Webhook-Timestamp"]
    signature = request.headers["X-Webhook-Signature"]
    raw_body = request.body                   # RAW bytes — never re-serialize the JSON

    # 1. Reject anything outside the replay window.
    if abs(int(time.time()) - int(timestamp)) > 300:
        return Response(status_code=400)

    # 2. Recompute and compare in constant time. The header carries one token normally, but
    #    several comma-separated ones during a secret rotation — accept if ANY matches.
    expected = "sha256=" + hmac.new(
        secret.encode(), f"{timestamp}.".encode() + raw_body, hashlib.sha256
    ).hexdigest()
    if not any(hmac.compare_digest(expected, t.strip()) for t in signature.split(",")):
        return Response(status_code=400)

    # 3. Only now is the payload trustworthy.
    process(request.json())
    return Response(status_code=200)          # 2xx = delivered; anything else retries
```

Signer les octets bruts plutôt qu’un objet réencodé est le détail qui piège les gens : analyser puis resérialiser du JSON réordonne les clés et modifie les espaces, et la signature porte sur les octets que nous avons envoyés. Lisez le corps une fois, conservez-le, vérifiez, puis analysez.

Le contrat complet — chaque header, et la raison d’être de chaque règle — se trouve dans [Vérification de signature](/docs/product-webhooks/signatures). Les [SDK](/docs/product-webhooks/sdks) fournissent un helper `verify` qui implémente tout cela, et c’est la voie recommandée.

## 4. Confirmer qu’elle est arrivée {#confirm}

```bash
curl -s "{{WEBHOOKS_BASE_URL}}/v1/deliveries?status=dead" \
  -H "Authorization: Bearer $ADMIN_KEY"
```

Un tableau `items` vide signifie que rien n’a épuisé ses réessais. Si votre handler était en panne pendant l’étape 2, la livraison sera ici — réparez le handler, puis rejouez-la :

```bash
curl -sX POST {{WEBHOOKS_BASE_URL}}/v1/deliveries/dlv_456/redeliver \
  -H "Authorization: Bearer $ADMIN_KEY"
```

## Étapes suivantes {#next-steps}

- [Vérification de signature](/docs/product-webhooks/signatures) — le contrat de signature complet.
- [Livraisons et réessais](/docs/product-webhooks/deliveries) — ce qui se passe quand votre handler est en panne.
- [Sources](/docs/product-webhooks/sources) — recevoir de la même façon les webhooks de Stripe, de GitHub et d’autres.
- [SDK](/docs/product-webhooks/sdks) — se passer du HMAC fait main.
- [CLI](/docs/product-webhooks/cli) — les mêmes opérations sans curl.
- [Vue d’ensemble de Webhooks](/docs/product-webhooks) — les objets, la sémantique de livraison et l’idempotence.
