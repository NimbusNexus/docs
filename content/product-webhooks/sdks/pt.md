---
title: "SDKs de Webhooks"
description: "Clientes tipados para Python, TypeScript e Go — verifique webhooks recebidos, publique eventos e gerencie endpoints pelo código."
publishedAt: 2026-08-05
updatedAt: 2026-10-20
kind: sdk
---

# SDKs de Webhooks

> **Status: publicado.** Python, TypeScript e Go estão nos seus registros públicos na versão {{WEBHOOKS_SDK_VERSION}}. Java e PHP estão escritos e testados, mas ainda não foram publicados — veja a [situação atual](#status).

Clientes oficiais para o [NimbusNexus Webhooks](/docs/product-webhooks). Cada um cobre as mesmas quatro tarefas, então um time que usa duas linguagens tem o mesmo comportamento nas duas. Escolha uma linguagem no topo da página e todos os exemplos a seguem; [Configurar um SDK](/docs/setup/sdk) é a versão curta de instalar, autenticar e fazer a primeira chamada.

> **Estes são os clientes de Webhooks.** Os SDKs para a Infraestrutura (VMs, armazenamento, rede) ainda não estão disponíveis; chame essa API [por REST](/docs/setup/rest). Os exemplos em Go usam o alias `nnwh` na importação para deixar a procedência visível.

A peça de maior valor é `verify`. A verificação de assinatura é crítica para a segurança, fácil de errar de forma sutil, e o erro passa em todos os testes funcionais — os SDKs implementam [o contrato completo](/docs/product-webhooks/signatures), incluindo a comparação em tempo constante e a janela de replay.

## Instalar {#install}

```bash tab=python
pip install nn-webhooks-sdk
```

```bash tab=typescript
npm install @nimbusnexus/webhooks-sdk
```

```bash tab=go
go get github.com/NimbusNexus/webhooks-go@v{{WEBHOOKS_SDK_VERSION}}
```

## Verificar um webhook recebido {#verify}

Para quem *recebe* webhooks. Passe os bytes brutos do corpo — nunca um objeto serializado de novo.

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

Sempre passe o timestamp. Omiti-lo faz a assinatura ser calculada só sobre o corpo, o que nunca corresponde ao que enviamos — então a verificação falha para *tudo*, não só para replays. Se `verify` retorna false para entregas que você acredita serem genuínas, um timestamp ausente é a primeira coisa a verificar.

## Publicar um evento {#publish}

Para *produtores*. Falhas transitórias — erros de conexão, `429`, `5xx` — são repetidas com backoff, e um `429` respeita o `Retry-After`. Os outros `4xx` lançam uma exceção.

A chave é gerada no console da sua conta NimbusNexus — veja [Como obter acesso](/docs/product-webhooks#access). Uma chave `whsk_…` de antes da mudança é recusada como credencial não reconhecida, e nenhum SDK verifica o formato da chave, então a falha aparece como um `403` `invalid_credential` da API, e não como um erro na construção do cliente.

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

## Armazenamento durável em buffer {#outbox}

`publish()` é síncrono — se a API estiver inacessível, ele lança uma exceção e o evento se perde. O outbox que grava antes de enviar separa as duas coisas: `enqueue()` persiste em um store e retorna na hora, sem chamada de rede, e `drain()` envia o que ficou pendente depois.

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

Todo envio leva `Idempotency-Key = record.id`, então esvaziar o outbox de novo depois de um crash nunca publica duas vezes. Um registro que continua falhando é repetido com backoff exponencial limitado até `max_attempts` (padrão 10), depois é marcado como morto e passado a um callback `on_dead` opcional.

| Store | Durável | Dependência extra |
|---|---|---|
| `MemoryStore` | Não — em processo | nenhuma |
| `FileStore(dir)` | Sim | nenhuma |
| `SQLiteStore(path)` | Sim, transacional | nenhuma |
| `RedisStore(url)` | Sim | `pip install 'nn-webhooks-sdk[redis]'` |
| `PostgresStore(dsn)` | Sim | `pip install 'nn-webhooks-sdk[postgres]'` |

Nenhum store precisa de uma dependência além do próprio SDK — a única dependência de runtime do SDK para Python é `httpx` —, e os stores de Redis e Postgres importam o driver sob demanda, só quando são construídos.

## Gerenciar endpoints {#manage}

O mesmo cliente encapsula o plano de controle, com uma chave com escopo `admin`:

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

Os métodos de listagem retornam `{"items": [...], "next_offset": int | None}`; os métodos de exclusão não retornam nada em um `204`.

`update_endpoint` não consegue alterar inscrições, porque o webhookd as ignora em um PATCH: `replace_subscriptions` (`replaceSubscriptions` em TypeScript, `ReplaceSubscriptions` em Go) define a lista inteira de uma vez, e uma lista vazia remove todas as inscrições do endpoint.

Os métodos de gerenciamento de chaves — `create_api_key`/`revoke_api_key` em Python, `createApiKey`/`revokeApiKey` em TypeScript, Java e PHP, `CreateAPIKey`/`RevokeAPIKey` em Go — ainda estão no cliente, mas as rotas `/v1/api-keys` que eles chamam foram removidas, então chamar um deles agora falha com um `404`; em vez disso, gere as chaves no console da conta.

## Apontar para um projeto {#projects}

Um projeto é identificado pelo id (`prj_3f9a…`) — não há slug nem nome curto. Deixe `project_id` sem definir para usar o projeto padrão do workspace, que é o que um workspace com um só projeto sempre quer:

```python
wh.publish("order.created", {...})                          # default project
wh.publish("order.created", {...}, project_id="prj_3f9a…")  # a specific one
```

Só o servidor consegue resolver "o projeto padrão", então omitir o campo é a forma de pedir por ele. Passar uma string inventada — `"default"`, ou o nome de exibição de um projeto — resulta em um `404`. O id real está em qualquer resposta, ou em `GET /v1/projects`.

## Como os SDKs se mantêm fiéis {#contract}

Todos os clientes implementam um único contrato de assinatura: `HMAC-SHA256(secret, "<timestamp>." + raw_body)`, enviado como `X-Webhook-Signature: sha256=<hex>`, com uma janela de 300 segundos. Um fixture compartilhado de vetores, gerado pelo próprio assinador do servidor, amarra todos eles a esse contrato, então nenhum cliente pode se desviar do servidor nem dos outros clientes — inclusive na CI, onde o pacote do servidor não está instalado.

## Situação atual {#status}

| Linguagem | Pacote | Status |
|---|---|---|
| Python | `nn-webhooks-sdk` | Publicado — [PyPI](https://pypi.org/project/nn-webhooks-sdk/), {{WEBHOOKS_SDK_VERSION}} |
| TypeScript | `@nimbusnexus/webhooks-sdk` | Publicado — [npm](https://www.npmjs.com/package/@nimbusnexus/webhooks-sdk), {{WEBHOOKS_SDK_VERSION}} |
| Go | `github.com/NimbusNexus/webhooks-go` | Publicado — [GitHub](https://github.com/NimbusNexus/webhooks-go), v{{WEBHOOKS_SDK_VERSION}} |
| Java | `net.nimbusnexus:webhooks-sdk` | Escrito e testado; ainda não está no Maven Central |
| PHP | `nimbusnexus/webhooks-sdk` | Escrito e testado; ainda não está no Packagist |

Até Java e PHP serem publicados, chame a API REST diretamente — a [página de verificação de assinatura](/docs/product-webhooks/signatures) tem tudo o que é preciso para verificar entregas em qualquer linguagem, e são umas vinte linhas.

## Próximos passos {#next-steps}

- [CLI](/docs/product-webhooks/cli) — as mesmas operações a partir de um shell.
- [Verificação de assinatura](/docs/product-webhooks/signatures) — o que `verify` implementa.
- [Início rápido](/docs/product-webhooks/quickstart) — o fluxo que estes clientes encapsulam.
- [Idempotência](/docs/idempotency) — o padrão de toda a plataforma por trás de `idempotency_key`.
