---
title: "SDK Webhooks"
description: "Clients typés pour Python, TypeScript et Go — vérifiez les webhooks entrants, publiez des événements et gérez les endpoints depuis votre code."
publishedAt: 2026-08-05
updatedAt: 2026-10-20
kind: sdk
---

# SDK Webhooks

> **Statut : publié.** Python, TypeScript et Go sont sur leurs registres publics en version {{WEBHOOKS_SDK_VERSION}}. Java et PHP sont écrits et testés, mais pas encore publiés — voir [l’état actuel](#status).

Les clients officiels de [NimbusNexus Webhooks](/docs/product-webhooks). Chacun couvre les quatre mêmes tâches, si bien qu’une équipe qui utilise deux langages obtient le même comportement dans les deux. Choisissez un langage en haut de la page : tous les exemples le suivent. [Configurer un SDK](/docs/setup/sdk) est la version courte de l’installation, de l’authentification et d’un premier appel.

> **Ce sont les clients Webhooks.** Les SDK pour l’Infrastructure (VM, stockage, réseau) ne sont pas encore disponibles ; appelez cette API [en REST](/docs/setup/rest). Les exemples Go donnent à l’import l’alias `nnwh` pour que sa provenance reste visible.

La pièce la plus précieuse est `verify`. La vérification de signature est critique pour la sécurité, facile à rater de façon subtile, et ratée d’une manière qui passe tous les tests fonctionnels — les SDK implémentent [le contrat complet](/docs/product-webhooks/signatures), y compris la comparaison à temps constant et la fenêtre de rejeu.

## Installer {#install}

```bash tab=python
pip install nn-webhooks-sdk
```

```bash tab=typescript
npm install @nimbusnexus/webhooks-sdk
```

```bash tab=go
go get github.com/NimbusNexus/webhooks-go@v{{WEBHOOKS_SDK_VERSION}}
```

## Vérifier un webhook entrant {#verify}

Pour quiconque *reçoit* des webhooks. Passez les octets bruts du corps — jamais un objet resérialisé.

```python
from nn_webhooks import verify

ok = verify(
    secret=ENDPOINT_SIGNING_SECRET,
    raw_body=request.body,
    signature=request.headers["X-Webhook-Signature"],
    timestamp=request.headers["X-Webhook-Timestamp"],
)
if not ok:
    return Response(status_code=400)   # forged, tampered, or outside the 300s window
```

```ts
import { verify } from "@nimbusnexus/webhooks-sdk";

const ok = verify(secret, rawBody, req.headers["x-webhook-signature"], {
  timestamp: req.headers["x-webhook-timestamp"],
});
if (!ok) return res.status(400).end();
```

```go
import nnwh "github.com/NimbusNexus/webhooks-go"

ts, _ := strconv.ParseInt(r.Header.Get("X-Webhook-Timestamp"), 10, 64)
ok := nnwh.Verify(secret, body, r.Header.Get("X-Webhook-Signature"),
    &nnwh.VerifyOptions{Timestamp: &ts})
```

Passez toujours le timestamp. Sans lui, la signature est calculée sur le corps seul, ce qui ne correspond jamais à ce que nous envoyons — la vérification échoue donc pour *tout*, pas seulement pour les rejeux. Si `verify` renvoie false pour des livraisons que vous pensez authentiques, un timestamp manquant est la première chose à vérifier.

## Publier un événement {#publish}

Pour les *producteurs*. Les échecs transitoires — erreurs de connexion, `429`, `5xx` — sont réessayés avec backoff, et un `429` respecte `Retry-After`. Les autres `4xx` lèvent une exception.

La clé se crée dans votre console de compte NimbusNexus — voir [Obtenir l’accès](/docs/product-webhooks#access). Une clé `whsk_…` antérieure au changement est refusée comme justificatif d’identité non reconnu, et aucun SDK ne vérifie la forme de la clé : l’échec se manifeste donc par un `403` `invalid_credential` renvoyé par l’API plutôt que par une erreur à la construction.

```python
from nn_webhooks import Client, WebhooksAPIError

with Client("{{WEBHOOKS_BASE_URL}}", api_key=WEBHOOKS_API_KEY) as wh:
    try:
        event = wh.publish(
            "order.created",
            {"order_id": "ord_123", "total": 4200},
            idempotency_key="order-123",     # makes the publish safe to retry
        )
        print(event.event_uid, event.deliveries_created)
    except WebhooksAPIError as e:
        print(e.status_code, e.code, e.message)
```

```ts
import { WebhooksClient } from "@nimbusnexus/webhooks-sdk";

const wh = new WebhooksClient({ baseUrl: "{{WEBHOOKS_BASE_URL}}", apiKey: WEBHOOKS_API_KEY });
const event = await wh.publish(
  "order.created",
  { order_id: "ord_123", total: 4200 },
  { idempotencyKey: "order-123" },   // makes the publish safe to retry
);
console.log(event.eventUid, event.deliveriesCreated);
```

```go
client := nnwh.New("{{WEBHOOKS_BASE_URL}}", webhooksAPIKey)
event, err := client.Publish(ctx, "order.created",
    map[string]any{"order_id": "ord_123", "total": 4200},
    &nnwh.PublishOptions{IdempotencyKey: "order-123"})
```

## Mise en tampon durable {#outbox}

`publish()` est synchrone — si l’API est injoignable, la méthode lève une exception et l’événement est perdu. L’outbox (file d’envoi locale) à écriture préalable découple les deux : `enqueue()` persiste dans un store et rend la main immédiatement, sans appel réseau, et `drain()` envoie l’arriéré plus tard.

```python
from nn_webhooks import Client, SQLiteStore

store = SQLiteStore("outbox.db")

# Construct for the process lifetime — NOT in a `with` block. Closing the client stops the
# drainer, so a `with` that exits immediately would shut down the thread you just started.
wh = Client("{{WEBHOOKS_BASE_URL}}", api_key=WEBHOOKS_API_KEY, store=store)
wh.start_drainer(interval_seconds=5)          # ships in the background

wh.enqueue("order.created", {"order_id": "ord_123"})   # returns at once, no network
...
wh.close()                                     # at shutdown; also stops the drainer
```

Chaque envoi porte `Idempotency-Key = record.id` : vider de nouveau l’outbox après un plantage ne publie donc jamais deux fois. Un enregistrement qui échoue sans cesse est réessayé avec un backoff exponentiel plafonné jusqu’à `max_attempts` (10 par défaut), puis marqué comme mort et transmis à un callback `on_dead` facultatif.

| Store | Durable | Dépendance supplémentaire |
|---|---|---|
| `MemoryStore` | Non — dans le processus | aucune |
| `FileStore(dir)` | Oui | aucune |
| `SQLiteStore(path)` | Oui, transactionnel | aucune |
| `RedisStore(url)` | Oui | `pip install 'nn-webhooks-sdk[redis]'` |
| `PostgresStore(dsn)` | Oui | `pip install 'nn-webhooks-sdk[postgres]'` |

Aucun store n’exige de dépendance au-delà du SDK lui-même — la seule dépendance d’exécution en Python est `httpx` — et les stores Redis et Postgres importent leur pilote à la demande, uniquement à leur construction.

## Gérer les endpoints {#manage}

Le même client couvre le plan de contrôle, avec une clé de portée `admin` :

```python
ep = wh.create_endpoint(
    "https://your-app.example/webhooks",
    subscriptions=[{"match_kind": "prefix", "pattern": "order."}],
)
endpoint_id, signing_secret = ep["id"], ep["secret"]   # secret returned once

wh.replace_subscriptions(endpoint_id, [                # replaces the whole set
    {"match_kind": "exact", "pattern": "order.paid"},
])
wh.rotate_endpoint_secret(endpoint_id)
wh.enable_endpoint(endpoint_id)                        # recover an auto-disabled endpoint

for d in wh.list_deliveries(status="dead")["items"]:   # drain the dead-letter queue
    wh.redeliver(d["id"])
```

Les méthodes de liste renvoient `{"items": [...], "next_offset": int | None}` ; les suppressions ne renvoient rien sur un `204`.

`update_endpoint` ne peut pas modifier les abonnements, car webhookd les ignore lors d’un PATCH : `replace_subscriptions` (`replaceSubscriptions` en TypeScript, `ReplaceSubscriptions` en Go) définit toute la liste d’un coup, et une liste vide désabonne l’endpoint de tout.

Les méthodes de gestion des clés — `create_api_key`/`revoke_api_key` en Python, `createApiKey`/`revokeApiKey` en TypeScript, Java et PHP, `CreateAPIKey`/`RevokeAPIKey` en Go — sont toujours présentes sur le client, mais les routes `/v1/api-keys` qu’elles appellent ont été supprimées : en appeler une échoue donc désormais avec un `404` ; créez plutôt les clés dans la console de compte.

## Cibler un projet {#projects}

Un projet est désigné par son identifiant (`prj_3f9a…`) — il n’existe ni slug ni nom court. Ne définissez pas `project_id` pour cibler le projet par défaut de l’espace de travail, ce que veut toujours un espace de travail à projet unique :

```python
wh.publish("order.created", {...})                          # default project
wh.publish("order.created", {...}, project_id="prj_3f9a…")  # a specific one
```

Seul le serveur peut résoudre « le projet par défaut » : omettre le champ est donc la façon de le demander. Passer une chaîne inventée — `"default"`, ou le nom d’affichage d’un projet — donne un `404`. Le véritable identifiant figure dans n’importe quelle réponse, ou s’obtient avec `GET /v1/projects`.

## Garder les SDK fidèles {#contract}

Tous les clients implémentent un seul contrat de signature : `HMAC-SHA256(secret, "<timestamp>." + raw_body)`, envoyé sous la forme `X-Webhook-Signature: sha256=<hex>` avec une fenêtre de 300 secondes. Ils y sont arrimés par une fixture de vecteurs de test partagée, générée par le module de signature du serveur lui-même : aucun client ne peut donc diverger du serveur ni des autres clients — y compris en CI, où le paquet serveur n’est pas installé.

## État actuel {#status}

| Langage | Paquet | Statut |
|---|---|---|
| Python | `nn-webhooks-sdk` | Publié — [PyPI](https://pypi.org/project/nn-webhooks-sdk/), {{WEBHOOKS_SDK_VERSION}} |
| TypeScript | `@nimbusnexus/webhooks-sdk` | Publié — [npm](https://www.npmjs.com/package/@nimbusnexus/webhooks-sdk), {{WEBHOOKS_SDK_VERSION}} |
| Go | `github.com/NimbusNexus/webhooks-go` | Publié — [GitHub](https://github.com/NimbusNexus/webhooks-go), v{{WEBHOOKS_SDK_VERSION}} |
| Java | `net.nimbusnexus:webhooks-sdk` | Écrit et testé ; pas encore sur Maven Central |
| PHP | `nimbusnexus/webhooks-sdk` | Écrit et testé ; pas encore sur Packagist |

En attendant la publication de Java et de PHP, appelez directement l’API REST — la [page Vérification de signature](/docs/product-webhooks/signatures) contient tout ce qu’il faut pour vérifier les livraisons dans n’importe quel langage, et cela tient en une vingtaine de lignes.

## Étapes suivantes {#next-steps}

- [CLI](/docs/product-webhooks/cli) — les mêmes opérations depuis un shell.
- [Vérification de signature](/docs/product-webhooks/signatures) — ce que `verify` implémente.
- [Démarrage rapide](/docs/product-webhooks/quickstart) — le parcours que ces clients encapsulent.
- [Idempotence](/docs/idempotency) — le modèle commun à toute la plateforme derrière `idempotency_key`.
