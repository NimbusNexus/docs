---
title: "Configurar um SDK"
description: "Instale o SDK de Webhooks para Python, TypeScript ou Go, autentique-o com uma chave de API e faça sua primeira chamada."
publishedAt: 2026-10-19
updatedAt: 2026-10-19
kind: sdk
---

# Configurar um SDK

O Webhooks tem SDKs oficiais para Python, TypeScript e Go, todos na versão {{WEBHOOKS_SDK_VERSION}}. Eles repetem as tentativas em falhas transitórias, verificam assinaturas de webhooks e podem armazenar eventos em buffer enquanto a API está inacessível. Escolha uma linguagem no topo da página e todos os exemplos a acompanham.

Inboxes e Códigos QR ainda não têm SDK; chame-os [via REST](/docs/setup/rest). A [referência da API](/docs/reference) mostra cada uma das chamadas deles com o cliente HTTP habitual da sua linguagem. Os SDKs para Infraestrutura (VMs, armazenamento, bancos de dados) também ainda não estão disponíveis.

## 1 · Instalar {#install}

```bash tab=python
pip install nn-webhooks-sdk
```

```bash tab=typescript
npm install @nimbusnexus/webhooks-sdk
```

```bash tab=go
go get github.com/NimbusNexus/webhooks-go@v{{WEBHOOKS_SDK_VERSION}}
```

O Python exige a versão 3.11 ou posterior, o TypeScript exige Node.js 24 ou posterior e o Go exige a versão 1.25 ou posterior. O pacote Python é instalado como `nn-webhooks-sdk` e importado como `nn_webhooks`.

## 2 · Autenticar {#auth}

Crie uma chave de Webhooks no [console da sua conta]({{ACCOUNT_BASE_URL}}/api-keys), em **API keys**: os detalhes estão em [Obter uma chave de API](/docs/setup/rest#key). Depois, crie um cliente com ela. Leia a chave do ambiente em vez de escrevê-la no seu código.

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

## 3 · Fazer a primeira chamada {#first-call}

Liste suas entregas recentes. A chamada só lê dados, então qualquer chave `admin` ou `read` pode executá-la.

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

Uma lista vazia significa que a chave funciona e que nada foi entregue ainda. Para publicar seu primeiro evento, siga o [início rápido de Webhooks](/docs/product-webhooks/quickstart).

## Próximos passos {#next-steps}

- [SDKs de Webhooks](/docs/product-webhooks/sdks): verificação de assinaturas, publicação, o outbox durável, gerenciamento de endpoints.
- [Referência da API de Webhooks](/docs/reference/webhooks): todas as operações, com a chamada do SDK quando o SDK tiver uma.
- [CLI](/docs/setup/cli): as mesmas operações a partir de um shell.
