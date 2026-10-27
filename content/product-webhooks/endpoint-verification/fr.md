---
title: "Vérification des endpoints"
description: "Prouvez qu’un endpoint veut vos événements avant qu’il en reçoive — un challenge signé à usage unique, qu’il doit renvoyer."
publishedAt: 2026-10-19
updatedAt: 2026-10-21
kind: concept
---

# Vérification des endpoints

La vérification prouve que l’URL derrière un endpoint vous appartient et qu’elle est prête à recevoir des webhooks. Nous envoyons un challenge signé à l’endpoint ; il réussit la vérification en renvoyant le challenge. Tant qu’il ne l’a pas réussie, un espace de travail qui exige la vérification ne lui livre rien — ce qui permet de repérer une URL mal saisie ou un récepteur à moitié construit avant que de vrais événements ne s’accumulent dans la dead-letter queue, et empêche quiconque de diriger nos livraisons vers un serveur qui ne les a jamais demandées.

## Le challenge {#challenge}

Lancer une vérification envoie un POST à l’URL de l’endpoint, signé avec le secret de l’endpoint exactement comme une livraison (les mêmes `X-Webhook-Signature` et `X-Webhook-Timestamp`, les headers personnalisés de votre endpoint, et `X-Webhook-Event-Type: webhook.verify`) :

```json
{"type": "webhook.verify", "data": {"endpoint_id": "ep_3f9a…", "challenge": "Xb9kQ2…"}}
```

L’endpoint réussit quand il répond **2xx avec la valeur de `challenge` n’importe où dans le corps de la réponse**. Un 2xx sans le token échoue avec `challenge_not_echoed` ; toute autre réponse échoue comme le ferait une livraison.

## Y répondre {#handler}

Vérifiez la signature comme pour chaque livraison, puis renvoyez le challenge :

```python
event = json.loads(raw_body)                       # after the signature check
if event["type"] == "webhook.verify":
    return Response(event["data"]["challenge"], status=200)
```

```ts
const event = JSON.parse(rawBody); // after the signature check
if (event.type === "webhook.verify") return res.status(200).send(event.data.challenge);
```

```go
var event struct {
    Type string `json:"type"`
    Data struct{ Challenge string `json:"challenge"` } `json:"data"`
}
_ = json.Unmarshal(rawBody, &event) // after the signature check
if event.Type == "webhook.verify" {
    w.WriteHeader(http.StatusOK)
    w.Write([]byte(event.Data.Challenge))
    return
}
```

## La lancer {#run}

Dans la console, ouvrez le menu de l’endpoint sur la page **Endpoints** et choisissez **Verify**. Via l’API :

```bash
curl -sX POST {{WEBHOOKS_BASE_URL}}/v1/endpoints/ep_3f9a…/verify \
  -H "Authorization: Bearer $ADMIN_KEY"
```

```json
{ "verified": true, "challenge_echoed": true, "status_code": 200, "error": null, "duration_ms": 142, "failure_reason": null }
```

Un endpoint reste vérifié jusqu’à ce que son URL change ; une nouvelle URL doit être vérifiée à nouveau.

## Quand elle est exigée {#required}

La vérification est exigée pour un endpoint dès que l’un de ces éléments est actif :

- l’interrupteur de l’**espace de travail** — **Settings → Endpoint verification** dans la console, ou `PATCH /v1/workspace` avec `{"require_endpoint_verification": true}` ;
- l’interrupteur du **projet** — `PUT /v1/verification-policy?project_id=…` avec `{"required": true}`, pour un projet qui en a besoin alors que les autres non ;
- votre **plan**, lorsque le plan l’exige. La console affiche alors l’interrupteur verrouillé en position activée.

`GET /v1/verification-policy` renvoie la règle telle que la livraison l’applique (`required`), avec les deux interrupteurs.

## Ce que manque un endpoint non vérifié {#gated}

Quand la vérification est exigée, un endpoint non vérifié est écarté lors de la diffusion d’un événement : la réponse de publication le compte dans `skipped_unverified`, la console marque l’endpoint *gated*, et aucune livraison n’est créée pour lui — rien n’attend donc d’être envoyé une fois qu’il est vérifié. Publiez ou [rejouez](/docs/product-webhooks/deliveries#replay) de nouveau une fois la vérification réussie.

Les renvois sont retenus de la même façon. Relivrer une livraison vers cet endpoint, ou y rejouer un événement, est refusé avec `409 endpoint_not_verified` ; une relivraison en masse ou un rejeu sur une plage l’écarte et le compte dans `skipped_unverified`. Une livraison déjà en file ou en cours de réessai au moment où l’endpoint se met à exiger la vérification — parce que l’exigence a été activée, ou que l’URL de l’endpoint a changé — part dans la dead-letter queue sans être envoyée, avec un `last_error` qui commence par « not verified: ». Vérifiez l’endpoint, puis relivrez-la.

## Les récepteurs qui ne peuvent pas répondre {#cannot-echo}

Certains récepteurs acceptent n’importe quel POST mais ne renvoient jamais un corps de votre choix — parmi eux, les incoming webhooks de Slack et les catch hooks de Zapier. Ils ne peuvent pas réussir la vérification. Si votre plan vous le permet, laissez la vérification désactivée pour le projet qui leur livre ; sinon, placez devant eux un petit relais à vous qui répond au challenge.

## Étapes suivantes {#next-steps}

- [Vérification de signature](/docs/product-webhooks/signatures) — la vérification à effectuer avant de répondre au challenge.
- [Livraisons et réessais](/docs/product-webhooks/deliveries) — ce qui se passe une fois que l’endpoint reçoit des événements.
- [Démarrage rapide](/docs/product-webhooks/quickstart) — de zéro à une livraison vérifiée.
