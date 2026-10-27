---
title: "Configurer l’API REST"
description: "Obtenez une clé API, envoyez-la dans un header et faites un premier appel à un produit NimbusNexus depuis curl, TypeScript, Python ou Go."
publishedAt: 2026-10-19
updatedAt: 2026-10-22
kind: quickstart
---

# Configurer l’API REST

Chaque produit NimbusNexus est une API REST : du JSON sur HTTPS, avec votre clé API dans le header `Authorization`. Cette page vous mène de l’absence de clé à un premier appel réussi. Choisissez un langage en haut de la page : les exemples le suivent. REST signifie `curl` ; TypeScript, Python et Go utilisent le client HTTP habituel de chaque langage, sans SDK.

## 1 · Obtenir une clé API {#key}

**Apps : Webhooks, Inboxes, QR Codes et Request Bins.** Ouvrez **API keys** dans votre [console de compte]({{ACCOUNT_BASE_URL}}/api-keys) et créez une clé pour le produit que vous voulez appeler. Chaque clé appartient à un seul produit. Choisissez-y sa portée : `admin`, `read` ou, pour Webhooks, également `publish`. Copiez la clé dès qu’elle s’affiche, car elle n’est montrée qu’une fois. Une clé d’app est un JWT : elle commence donc par `eyJ`.

**Infrastructure : VM, stockage, bases de données et réseau.** Créez la clé dans la console, sous **Settings → API keys**. Elle est propre à un projet. [Authentification](/docs/authentication) couvre les portées et la rotation.

Ne mettez pas la clé dans votre code source. Exportez-la dans votre shell ou conservez-la dans votre gestionnaire de secrets :

```bash
export WEBHOOKS_API_KEY="<your-api-key>"
```

## 2 · L’envoyer avec chaque requête {#auth}

Envoyez la clé comme token Bearer. Les API des apps l’acceptent aussi sous la forme `X-API-Key: <key>`.

```http
Authorization: Bearer <your-api-key>
```

Chaque produit a sa propre URL de base :

| Produit | URL de base |
| --- | --- |
| Webhooks | `{{WEBHOOKS_BASE_URL}}/v1` |
| Inboxes | `{{INBOXES_BASE_URL}}/v1` |
| QR Codes | `{{QR_BASE_URL}}/v1` |
| Request Bins | `https://bins.nimbusnexus.net/v1` |
| Infrastructure | `{{API_BASE_URL}}` |

## 3 · Faire un premier appel {#first-call}

Sur Webhooks, `GET /v1/auth/me` renvoie la clé que vous avez envoyée : sa portée et l’espace de travail auquel elle appartient. Cette route ne lit rien d’autre : n’importe quelle clé valide peut donc l’appeler.

```bash
curl {{WEBHOOKS_BASE_URL}}/v1/auth/me \
  -H "Authorization: Bearer $WEBHOOKS_API_KEY"
```

```ts
const res = await fetch('{{WEBHOOKS_BASE_URL}}/v1/auth/me', {
  headers: { Authorization: `Bearer ${process.env.WEBHOOKS_API_KEY}` },
})
console.log(await res.json())
```

```python
import os
import requests

res = requests.get(
    "{{WEBHOOKS_BASE_URL}}/v1/auth/me",
    headers={"Authorization": f"Bearer {os.environ['WEBHOOKS_API_KEY']}"},
)
print(res.json())
```

```go
req, err := http.NewRequest("GET", "{{WEBHOOKS_BASE_URL}}/v1/auth/me", nil)
if err != nil {
    log.Fatal(err)
}
req.Header.Set("Authorization", "Bearer "+os.Getenv("WEBHOOKS_API_KEY"))
res, err := http.DefaultClient.Do(req)
if err != nil {
    log.Fatal(err)
}
defer res.Body.Close()
```

La réponse indique votre espace de travail :

```json
{
  "scope": "admin",
  "workspace_id": "{{WORKSPACE_ID}}"
}
```

Les autres champs indiquent de quel type de justificatif d’identité il s’agit. Pour une clé API, `email` et `created_at` valent `null`.

## 4 · Lire les erreurs {#errors}

Une requête en échec répond avec un statut 4xx ou 5xx et un format d’erreur unique, commun à tous les produits :

```json
{
  "error": {
    "code": "unauthorized",
    "message": "…",
    "details": { "reason": "missing" },
    "request_id": "…"
  }
}
```

Basez votre logique sur `code`, pas sur le statut ni sur le message. `unauthorized` signifie qu’aucune clé n’est arrivée ou que la clé a été révoquée. `invalid_credential` signifie que la clé n’est pas valide : créez-en une nouvelle, car réessayer n’y changera rien. `forbidden` signifie que la clé est valide mais ne peut pas faire cette opération : il lui manque la portée ou le rôle nécessaire, ou le produit n’est pas activé pour votre espace de travail. [Authentification](/docs/authentication#errors) et [Erreurs](/docs/errors) listent tous les codes. Indiquez le `request_id` quand vous contactez le support.

## Étapes suivantes {#next-steps}

- [Référence de l’API](/docs/reference) : toutes les opérations de tous les produits, avec l’appel dans votre langage.
- Les [SDK](/docs/setup/sdk) et la [CLI](/docs/setup/cli) : les mêmes appels, avec les réessais, la vérification des signatures et la pagination gérés pour vous.
- Démarrages rapides des produits : [Webhooks](/docs/product-webhooks/quickstart), [Inboxes](/docs/product-inboxes/quickstart), [Request Bins](/docs/product-bins/quickstart), [votre première VM](/docs/quickstart).
