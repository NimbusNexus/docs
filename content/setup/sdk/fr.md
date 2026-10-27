---
title: "Configurer un SDK"
description: "Installez le SDK Webhooks pour Python, TypeScript ou Go, authentifiez-le avec une clé API et faites un premier appel."
publishedAt: 2026-10-19
updatedAt: 2026-10-19
kind: sdk
---

# Configurer un SDK

Webhooks propose des SDK officiels pour Python, TypeScript et Go, tous en version {{WEBHOOKS_SDK_VERSION}}. Ils réessaient en cas d’échec temporaire, vérifient les signatures des webhooks et peuvent mettre les événements en tampon tant que l’API est injoignable. Choisissez un langage en haut de la page : tous les exemples le suivent.

Inboxes et QR Codes n’ont pas encore de SDK ; appelez-les [en REST](/docs/setup/rest). La [référence de l’API](/docs/reference) montre chacun de leurs appels avec le client HTTP habituel de votre langage. Les SDK pour l’infrastructure (VM, stockage, bases de données) ne sont pas encore disponibles non plus.

## 1 · Installer {#install}

```bash tab=python
pip install nn-webhooks-sdk
```

```bash tab=typescript
npm install @nimbusnexus/webhooks-sdk
```

```bash tab=go
go get github.com/NimbusNexus/webhooks-go@v{{WEBHOOKS_SDK_VERSION}}
```

Python nécessite la version 3.11 ou ultérieure, TypeScript Node.js 24 ou ultérieur, et Go la version 1.25 ou ultérieure. Le paquet Python s’installe sous le nom `nn-webhooks-sdk` et s’importe sous le nom `nn_webhooks`.

## 2 · S’authentifier {#auth}

Créez une clé Webhooks dans votre [console de compte]({{ACCOUNT_BASE_URL}}/api-keys), sous **API keys** : [Obtenir une clé API](/docs/setup/rest#key) donne les détails. Créez ensuite un client à partir de cette clé. Lisez la clé depuis l’environnement plutôt que de l’écrire dans votre code.

```python
import os
from nn_webhooks import Client

wh = Client("{{WEBHOOKS_BASE_URL}}", api_key=os.environ["WEBHOOKS_API_KEY"])
```

```ts
import { WebhooksClient } from '@nimbusnexus/webhooks-sdk'

const wh = new WebhooksClient({
  baseUrl: '{{WEBHOOKS_BASE_URL}}',
  apiKey: process.env.WEBHOOKS_API_KEY!,
})
```

```go
import nnwh "github.com/NimbusNexus/webhooks-go"

ctx := context.Background()
client := nnwh.New("{{WEBHOOKS_BASE_URL}}", os.Getenv("WEBHOOKS_API_KEY"))
```

## 3 · Faire un premier appel {#first-call}

Listez vos livraisons récentes. Cet appel ne fait que lire : n’importe quelle clé `admin` ou `read` peut donc l’exécuter.

```python
page = wh.list_deliveries()
for d in page["items"]:
    print(d["id"], d["status"], d["attempts"])
```

```ts
const page = await wh.listDeliveries()
for (const d of page.items) console.log(d.id, d.status, d.attempts)
```

```go
page, err := client.ListDeliveries(ctx, nil)
if err != nil {
    log.Fatal(err)
}
for _, d := range page.Items {
    fmt.Println(d.Id, d.Status)
}
```

Une liste vide signifie que la clé fonctionne et que rien n’a encore été livré. Pour publier votre premier événement, suivez le [démarrage rapide Webhooks](/docs/product-webhooks/quickstart).

## Étapes suivantes {#next-steps}

- [SDK Webhooks](/docs/product-webhooks/sdks) : la vérification des signatures, la publication, l’outbox durable (file d’envoi locale), la gestion des endpoints.
- [Référence de l’API Webhooks](/docs/reference/webhooks) : toutes les opérations, avec l’appel SDK quand le SDK en propose un.
- [CLI](/docs/setup/cli) : les mêmes opérations depuis un shell.
