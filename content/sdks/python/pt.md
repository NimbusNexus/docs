---
title: "SDK para Python"
description: "Cliente Python tipado para a API REST da NimbusNexus. Python 3.11+, síncrono + assíncrono."
publishedAt: 2026-05-20
updatedAt: 2026-10-15
kind: sdk
---

# SDK para Python

> **Status: pré-lançamento.** O SDK está em desenvolvimento ativo. Esta página documenta o formato da v1.0; até o pacote ser publicado, use a API REST diretamente, conforme [Autenticação](/docs/authentication) e [Convenções](/docs/conventions).

Um cliente Python tipado. Síncrono + assíncrono (baseado em httpx), Python 3.11+, modelos Pydantic completos para todos os formatos de resposta.

> **Quer enviar webhooks para os seus próprios clientes?** Isso é o [produto Webhooks](/docs/product-webhooks), que é separado e tem o próprio SDK para Python publicado: o pacote `nn-webhooks-sdk`, importado como `nn_webhooks` ([SDKs de Webhooks](/docs/product-webhooks/sdks)). Esta página trata do cliente para a API de nuvem da NimbusNexus.

## Instalar {#install}

O cliente desta página ainda não foi publicado, e não existe um pacote `nimbusnexus` no PyPI, então não instale nenhum pacote com esse nome. (Versões anteriores desta página mostravam `pip install nimbusnexus`.)

O pacote Python que publicamos hoje é o SDK de Webhooks:

```bash
pip install nn-webhooks-sdk
# or
uv add nn-webhooks-sdk
# or
poetry add nn-webhooks-sdk
```

Ele instala o módulo `nn_webhooks` (`from nn_webhooks import Client`), para Python 3.11 e posteriores.

## Uso rápido {#quick}

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

## Cliente assíncrono {#async}

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

Os clientes síncrono e assíncrono têm a mesma interface (todos os nomes de método + assinaturas coincidem); escolha o que se encaixa no seu runtime. O cliente assíncrono é baseado em httpx e é o recomendado para qualquer carga de trabalho limitada por I/O.

## Princípios de design {#design}

- **Tipado com Pydantic.** Toda resposta é um modelo Pydantic; o mypy/pyright enxergam os tipos completos. Os kwargs da requisição são validados antes de saírem — erros de digitação em nomes de campos falham no momento da chamada, não depois de um 400.
- **Espelha a API REST.** `nn.vms.list()` é `GET /v1/vms`. `nn.databases.snapshots.list(db_id)` é `GET /v1/databases/{db_id}/snapshots`. Sem métodos de conveniência sob medida que se afastam da API.
- **Idempotência por padrão.** Toda chamada que altera dados gera um `Idempotency-Key` (UUID v4). Substitua com `idempotency_key="..."` para ter chaves estáveis entre retentativas.
- **Repete em 429 + 5xx.** Backoff + jitter configuráveis, desativados por padrão para requisições brutas e ativados por padrão para os métodos de recurso de alto nível.
- **Sem dependência de httpx no cliente síncrono.** O cliente síncrono é baseado em `urllib3`, sem dependências extras. O cliente assíncrono depende do httpx.

## Configuração {#config}

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

## Helper de verificação de webhooks {#webhooks}

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

O verificador cuida do HMAC-SHA256 + comparação em tempo constante + verificação da janela de replay. Não implemente o seu próprio; é aí que mora a maioria dos bugs de falsificação de webhooks.

## Helper de paginação {#pagination}

```python
# Manual paging
for page in nn.vms.list_pages(region="us-east-1"):
    print(f"got {len(page.items)} VMs")

# Auto-flatten — yields one resource per iteration
for vm in nn.vms.list_all(region="us-east-1"):
    print(vm.name)
```

Os dois retornam iteradores que percorrem o cursor por você. Veja [Paginação](/docs/pagination) para entender o mecanismo por trás.

## Erros como exceções {#errors}

### No SDK de Webhooks publicado {#errors-webhooks-sdk}

O `nn-webhooks-sdk` tem duas classes de exceção, ambas em `nn_webhooks.errors`:

| Classe | Lançada quando | Contém |
|---|---|---|
| `WebhooksError` | A classe base. É lançada diretamente para uma falha de rede que persiste depois das retentativas e para uso indevido, como chamar `enqueue()` em um `Client` criado sem um store. | Uma mensagem |
| `WebhooksAPIError` | A API respondeu com um status fora de 2xx. Uma subclasse de `WebhooksError`. | `status_code`, `code`, `message` |

Não há uma classe por código. `code` é o `error.code` da API, repassado sem alterações, então tome decisões com base nele usando os códigos listados em [Erros](/docs/errors). Se uma resposta não tiver um corpo de erro em JSON (um `502` do gateway, por exemplo), `code` é `"error"` e `message` é o texto bruto da resposta. `details` não é incluído. Um `429`, `500`, `502`, `503` ou `504` é repetido até `max_retries` vezes (padrão 2), respeitando o `Retry-After`; depois disso, o `WebhooksAPIError` é lançado. Qualquer outro `4xx` ou `5xx`, inclusive um `501`, lança a exceção imediatamente.

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

A partir do lançamento da v1, um código renomeado segue a [política de descontinuação](/docs/versioning#deprecation): a mudança de nome é anunciada no [changelog](/changelog), e a grafia antiga continua chegando em `code` por pelo menos 12 meses. As mudanças de nome do Webhooks listadas em [Quando um código é renomeado](/docs/errors#renames) entraram em 15 de outubro de 2026, antes do lançamento da v1, sem esse período.

### No cliente da API de nuvem (planejado) {#errors-planned}

O cliente desta página vai lançar uma classe por família de status. Cada uma contém `status_code`, `code`, `message` e `details` exatamente como a API os envia:

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

Versões anteriores desta página associavam essas classes a `invalid_credentials`, `expired_credentials`, `scope_required`, `wrong_project` e a um `400 validation_failed` com `.fields`. As APIs nunca enviaram esses códigos; os comentários acima usam os códigos que elas de fato enviam.

## Situação atual {#status}

O SDK está sendo gerado a partir da especificação OpenAPI, mas ainda não foi publicado. Enquanto isso:

- Use a API REST diretamente. A autenticação + as convenções estão documentadas e estáveis.
- O formato desta página é o design de API com o qual estamos nos comprometendo.
- Inscreva-se no [changelog]({{BASE_URL}}/changelog) para receber o anúncio do lançamento.

## Próximos passos {#next-steps}

- [Autenticação](/docs/authentication) — o que o `api_key` faz no nível do HTTP.
- [Webhooks da plataforma](/docs/webhooks) — o que o `verify_webhook` está verificando.
- [Paginação](/docs/pagination) — o que o `list_all` e o `list_pages` estão percorrendo.
- [Erros](/docs/errors) — os códigos de erro que correspondem às classes de exceção acima.
