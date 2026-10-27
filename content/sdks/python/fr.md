---
title: "SDK Python"
description: "Client Python typé pour l’API REST NimbusNexus. Python 3.11+, sync + async."
publishedAt: 2026-05-20
updatedAt: 2026-10-15
kind: sdk
---

# SDK Python

> **Statut : préversion.** Le SDK est en développement actif. Cette page documente la forme de la v1.0 ; tant que le paquet n’est pas publié, utilisez directement l’API REST en suivant [Authentification](/docs/authentication) et [Conventions](/docs/conventions).

Un client Python typé. Sync + async (basé sur httpx), Python 3.11+, des modèles Pydantic complets pour chaque format de réponse.

> **Vous envoyez des webhooks à vos propres clients ?** C’est le rôle du [produit Webhooks](/docs/product-webhooks), distinct, qui a son propre SDK Python publié : le paquet `nn-webhooks-sdk`, importé sous le nom `nn_webhooks` ([SDK Webhooks](/docs/product-webhooks/sdks)). Cette page présente le client de l’API cloud NimbusNexus.

## Installer {#install}

Le client présenté sur cette page n’est pas encore publié, et il n’existe pas de paquet `nimbusnexus` sur PyPI : n’installez donc aucun paquet sous ce nom. (Les versions précédentes de cette page indiquaient `pip install nimbusnexus`.)

Le paquet Python que nous publions aujourd’hui est le SDK Webhooks :

```bash
pip install nn-webhooks-sdk
# or
uv add nn-webhooks-sdk
# or
poetry add nn-webhooks-sdk
```

Il installe le module `nn_webhooks` (`from nn_webhooks import Client`), pour Python 3.11 et ultérieur.

## Utilisation rapide {#quick}

```python
import os
from nimbusnexus import NimbusNexus

nn = NimbusNexus(api_key=os.environ["NIMBUS_KEY"])

# List VMs in a region
page = nn.vms.list(region="us-east-1", limit=50)
for vm in page.items:
    print(vm.id, vm.name, vm.state)

# Create a VM
vm = nn.vms.create(
    name="web-01",
    size="gp-1-2",
    region="us-east-1",
    image="ubuntu-24.04",
)

# Poll until running
while vm.state != "running":
    time.sleep(1)
    vm = nn.vms.get(vm.id)
```

## Client async {#async}

```python
import asyncio
from nimbusnexus import AsyncNimbusNexus

async def main():
    nn = AsyncNimbusNexus(api_key=os.environ["NIMBUS_KEY"])
    async with nn:
        vm = await nn.vms.create(
            name="web-01",
            size="gp-1-2",
            region="us-east-1",
            image="ubuntu-24.04",
        )
        print(vm.id)

asyncio.run(main())
```

Les clients sync et async exposent la même surface (chaque nom de méthode + signature est identique) ; choisissez celui qui convient à votre runtime. Le client async est basé sur httpx et recommandé pour toute charge de travail limitée par les I/O.

## Principes de conception {#design}

- **Typé avec Pydantic.** Chaque réponse est un modèle Pydantic ; mypy/pyright voient tous les types. Les kwargs de la requête sont validés avant l’envoi — une faute de frappe dans un nom de champ échoue au moment de l’appel, pas après un 400.
- **Calqué sur l’API REST.** `nn.vms.list()` correspond à `GET /v1/vms`. `nn.databases.snapshots.list(db_id)` correspond à `GET /v1/databases/{db_id}/snapshots`. Aucune méthode de confort sur mesure qui s’éloignerait de l’API.
- **Idempotence par défaut.** Chaque appel de modification génère une `Idempotency-Key` (UUID v4). Remplacez-la avec `idempotency_key="..."` pour garder des clés stables d’un réessai à l’autre.
- **Réessais sur 429 + 5xx.** Backoff + jitter configurables, désactivés par défaut pour les requêtes brutes ; activés par défaut pour les méthodes de ressource de haut niveau.
- **Pas de dépendance à httpx en sync.** Le client sync repose sur `urllib3`, sans dépendance supplémentaire. Le client async dépend de httpx.

## Configuration {#config}

```python
nn = NimbusNexus(
    api_key=os.environ["NIMBUS_KEY"],
    base_url="{{API_BASE_URL}}",  # defaults to canonical
    timeout=30,                    # seconds
    max_retries=3,
    retry_backoff=1.0,             # base; doubled per attempt with jitter
    user_agent="my-app/2.4",       # appended to the default UA
)
```

## Helper de vérification de webhook {#webhooks}

```python
from nimbusnexus.webhooks import verify_webhook
from flask import request, abort

@app.route("/webhooks/nimbusnexus", methods=["POST"])
def webhook():
    if not verify_webhook(
        body=request.get_data(),
        timestamp=request.headers["NN-Timestamp"],
        signature=request.headers["NN-Signature"],
        secret=os.environ["NIMBUS_WEBHOOK_SECRET"],
    ):
        abort(401)

    event = request.get_json()
    # handle event...
    return "", 200
```

Le vérificateur gère HMAC-SHA256 + la comparaison à temps constant + le contrôle de la fenêtre de rejeu. N’écrivez pas votre propre version : c’est là que se trouvent la plupart des bugs d’usurpation de webhook.

## Helper de pagination {#pagination}

```python
# Manual paging
for page in nn.vms.list_pages(region="us-east-1"):
    print(f"got {len(page.items)} VMs")

# Auto-flatten — yields one resource per iteration
for vm in nn.vms.list_all(region="us-east-1"):
    print(vm.name)
```

Les deux renvoient des itérateurs qui parcourent les curseurs pour vous. Voir [Pagination](/docs/pagination) pour le mécanisme sous-jacent.

## Erreurs sous forme d’exceptions {#errors}

### Dans le SDK Webhooks publié {#errors-webhooks-sdk}

`nn-webhooks-sdk` a deux classes d’exception, toutes deux dans `nn_webhooks.errors` :

| Classe | Levée quand | Contient |
|---|---|---|
| `WebhooksError` | La classe de base. Levée telle quelle pour une panne réseau qui persiste après les réessais, et pour une mauvaise utilisation, comme appeler `enqueue()` sur un `Client` créé sans store. | Un message |
| `WebhooksAPIError` | L’API a répondu avec un statut autre que 2xx. Sous-classe de `WebhooksError`. | `status_code`, `code`, `message` |

Il n’y a pas de classe par code. `code` est le `error.code` de l’API, transmis sans modification : testez sa valeur en vous basant sur les codes listés dans [Erreurs](/docs/errors). Si une réponse n’a pas de corps d’erreur JSON (un `502` de passerelle, par exemple), `code` vaut `"error"` et `message` contient le texte brut de la réponse. `details` n’est pas transmis. Un `429`, `500`, `502`, `503` ou `504` est réessayé jusqu’à `max_retries` fois (2 par défaut), en respectant `Retry-After` ; ensuite, la `WebhooksAPIError` est levée. Tout autre `4xx` ou `5xx`, `501` compris, lève l’exception immédiatement.

```python
from nn_webhooks import Client, WebhooksAPIError

with Client("{{WEBHOOKS_BASE_URL}}", api_key=WEBHOOKS_API_KEY) as wh:
    try:
        wh.publish("order.created", {"order_id": "ord_123"}, idempotency_key="order-123")
    except WebhooksAPIError as e:
        if e.code in ("validation_error", "unknown_event_type", "invalid_payload"):
            ...  # fix the request; sending it again won't help
        elif e.code == "quota_exceeded":
            ...  # monthly delivery quota: wait for the next period, or upgrade
        elif e.code == "invalid_credential":
            ...  # replace the key
        else:
            print(e.status_code, e.code, e.message)
```

À partir du lancement de la v1, un code renommé suit la [politique de dépréciation](/docs/versioning#deprecation) : le renommage est annoncé dans le [changelog](/changelog), et l’ancienne graphie continue d’arriver dans `code` pendant au moins 12 mois. Les renommages de Webhooks listés dans [Quand un code est renommé](/docs/errors#renames) ont pris effet le 2026-10-15, avant le lancement de la v1, sans cette période.

### Dans le client de l’API cloud (prévu) {#errors-planned}

Le client présenté sur cette page lèvera une classe par famille de statuts. Chacune contient `status_code`, `code`, `message` et `details`, exactement tels que l’API les envoie :

```python
from nimbusnexus.errors import (
    NimbusError,                # base class
    AuthenticationError,        # 401 unauthorized, 403 invalid_credential
    PermissionError,            # 403 forbidden
    PlanError,                  # 402 quota_exceeded, not_entitled, workspace_frozen, ...
    ValidationError,            # 422 validation_error (carries .details)
    NotFoundError,              # 404 not_found
    ConflictError,              # 409 conflict
    RateLimitError,             # 429 rate_limited (carries .retry_after_seconds)
    ServerError,                # 5xx — retryable
)

try:
    vm = nn.vms.create(name="web-01", size="gp-1-2", region="us-east-1", image="ubuntu-24.04")
except ValidationError as e:
    for entry in e.details["errors"]:
        print(f"  {entry['loc']}: {entry['msg']}")
except RateLimitError as e:
    print(f"slow down — wait {e.retry_after_seconds}s")
```

Les versions précédentes de cette page associaient ces classes à `invalid_credentials`, `expired_credentials`, `scope_required`, `wrong_project` et à un `400 validation_failed` portant `.fields`. Les API n’ont jamais envoyé ces codes ; les commentaires ci-dessus utilisent ceux qu’elles envoient réellement.

## État actuel {#status}

Le SDK est en cours de génération à partir de la spécification OpenAPI, mais n’a pas encore été publié. En attendant :

- Utilisez directement l’API REST. L’authentification et les conventions sont documentées et stables.
- La forme présentée sur cette page est la conception d’API à laquelle nous nous engageons.
- Abonnez-vous au [changelog]({{BASE_URL}}/changelog) pour l’annonce de la publication.

## Étapes suivantes {#next-steps}

- [Authentification](/docs/authentication) — ce que fait `api_key` au niveau HTTP.
- [Webhooks de la plateforme](/docs/webhooks) — ce que vérifie `verify_webhook`.
- [Pagination](/docs/pagination) — ce que parcourent `list_all` et `list_pages`.
- [Erreurs](/docs/errors) — les codes d’erreur qui correspondent aux classes d’exception ci-dessus.
