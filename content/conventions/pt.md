---
title: "Convenções"
description: "Padrões que as APIs seguem — ids de recurso, paginação, erros, idempotência, operações de longa duração."
publishedAt: 2026-05-19
updatedAt: 2026-11-04
kind: concept
---

# Convenções

A NimbusNexus tem dois tipos de API, e eles não compartilham todas as convenções. A **API de infraestrutura** em `{{API_HOST}}` (VMs, redes, armazenamento, DNS e a sua conta) tem as rotas sob `/api/v1/` e recebe uma chave de API no header `X-API-Key` ([Autenticação](/docs/authentication)). As **APIs dos apps** (Webhooks, Inboxes, Request Bins e as demais) têm cada uma a própria URL base, com rotas sob `/v1/`, e recebem uma chave como token Bearer ([Configurar a API REST](/docs/setup/rest)). Esta página diz em que os dois tipos diferem.

## Ids de recurso {#resource-ids}

Na API de infraestrutura, a maioria dos ids de recurso são UUIDs, como `3f0c9e1a-6b7d-4c2e-9a51-7d2b8f4e1c60`; os contêineres e objetos do armazenamento de objetos são identificados pelo nome. Nas APIs dos apps, os ids trazem um prefixo, como `ep_` para um endpoint do Webhooks ou `evt_` para um evento. Trate qualquer id como uma string opaca.

Os ids são estáveis durante toda a vida do recurso — nunca são reutilizados nem reescritos quando o recurso é renomeado. Use-os em URLs, chaves estrangeiras e logs de auditoria; use os campos `name`, legíveis por humanos, só para exibição.

## Paginação {#pagination}

No Webhooks, no Inboxes e no Request Bins, os endpoints de listagem aceitam dois parâmetros de query:

- `limit` — tamanho de página. Padrão 50, máximo 200. Acima de 200, a requisição falha na validação: `422` `validation_error` ([Erros](/docs/errors#codes-validation)).
- `offset` — quantos itens pular. O corpo da resposta retorna o próximo valor como `next_offset`; envie-o de volta como `offset` para avançar.

O padrão em código:

```bash
# Page 1
curl '{{WEBHOOKS_BASE_URL}}/v1/endpoints?limit=50' \
  -H "Authorization: Bearer $WEBHOOKS_API_KEY"

# Page 2 (offset from page 1's response.next_offset)
curl '{{WEBHOOKS_BASE_URL}}/v1/endpoints?limit=50&offset=50' \
  -H "Authorization: Bearer $WEBHOOKS_API_KEY"
```

Quando `next_offset` é null, você está na última página.

Na API de infraestrutura, a maioria dos endpoints de listagem, como `GET /api/v1/instance/`, responde com a lista inteira e não recebe parâmetros de paginação. Os que paginam fazem isso de uma de duas formas:

- `limit` e `marker` (o último id ou nome que você viu): imagens de VM, zonas DNS e conjuntos de registros, contêineres e objetos do armazenamento de objetos.
- `limit` e `offset`: backups de volume, agendamentos de backup, conexões de armazenamento externo, notificações.

```bash
# Page 1
curl '{{API_BASE_URL}}/api/v1/zones/?limit=50' \
  -H "X-API-Key: $NIMBUS_KEY"

# Page 2 (marker: the id of the last zone on page 1)
curl '{{API_BASE_URL}}/api/v1/zones/?limit=50&marker=<zone-id>' \
  -H "X-API-Key: $NIMBUS_KEY"
```

## Erros {#errors}

Os dois tipos de API devolvem erros de formas diferentes. Na API de infraestrutura, um erro traz `success: false` e um `message`:

```json
{
  "success": false,
  "message": "Authentication required"
}
```

Uma falha de validação (`422`) traz `errors` em vez disso, com os campos que falharam:

```json
{
  "success": false,
  "errors": {
    "field": ["Invalid value"]
  }
}
```

Aqui não há códigos de erro: decida com base no status e não faça parsing de `message`. Toda resposta traz um header `X-Request-ID`; inclua-o quando entrar em contato com o suporte.

Toda resposta de erro do Webhooks, do Inboxes e do Request Bins usa este formato JSON:

```json
{
  "error": {
    "code": "validation_error",
    "message": "request validation failed",
    "details": {
      "errors": [
        {
          "loc": ["body", "event_type"],
          "msg": "Field required",
          "type": "missing"
        }
      ]
    },
    "request_id": "7e4b1d9c2a6f4e8b9d3c5a1f0e2b4c68"
  }
}
```

- `code` — string estável, legível por máquina. Decida com base nela, não no código de status, quando o mesmo status tem vários significados (por exemplo, `402` pode ser `quota_exceeded`, `not_entitled` ou `workspace_frozen`).
- `message` — texto em inglês, legível por humanos, para logs. Não é traduzido; se você mostra um erro a usuários finais, mapeie `code` para o seu próprio texto.
- `details` — presente em alguns códigos. Em um erro de validação, `details.errors` lista os valores de entrada que falharam; em muitos outros erros, ele traz um `reason` que refina o código, com os valores que o acompanham. Seu formato depende do código.
- `request_id` — em todo corpo de erro que a API envia: o mesmo id do header `X-Request-ID` que toda resposta da API traz. Uma resposta do edge que fica na frente dela (um `502` ou `504`, por exemplo, ou um `413` para um corpo grande demais para chegar à API) não traz nem o corpo de erro da API nem o header `X-Request-ID` ([Erros](/docs/errors#request-id)). Registre-o em log e inclua-o quando entrar em contato com o suporte.
- `next_code` — enviado só enquanto um código está sendo renomeado: o código que este erro vai trazer depois. Quando ele estiver presente, decida com base nele em vez de `code`. Nenhum código está sendo renomeado hoje, então a API não o envia.

[Erros](/docs/errors) lista todos os códigos e motivos, e qual das APIs, a de Webhooks ou a de Inboxes, envia cada um. (Versões anteriores desta página mostravam `validation_failed` como um `400`, com `fields` e `request_id` no corpo. As APIs nunca enviaram os dois primeiros: uma falha de validação é um `422` `validation_error`, com `details`. `request_id` também não estava no corpo naquela época; os corpos de erro da API o trazem agora.)

## Códigos de status HTTP {#status-codes}

Usamos um conjunto pequeno e previsível:

| Status    | Quando                                                                                                                                                    |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `200`     | Sucesso com corpo. Na API de infraestrutura, também uma requisição cujo trabalho foi colocado na fila ([Operações de longa duração](#operations)).        |
| `201`     | Recurso criado.                                                                                                                                           |
| `202`     | Aceita: o trabalho termina depois da resposta ([Operações de longa duração](#operations)).                                                                |
| `204`     | Sucesso, sem corpo (típico de DELETE).                                                                                                                    |
| `400`     | Não foi possível ler a requisição como foi enviada. `error.message`, ou `message` na API de infraestrutura, diz por quê.                                  |
| `401`     | Nenhuma credencial utilizável. Veja [Autenticação](/docs/authentication).                                                                                 |
| `402`     | Nas APIs dos apps: seu plano ou a situação do faturamento impede a requisição (uma cota, uma funcionalidade fora do seu plano, um workspace congelado). Repetir não adianta. |
| `403`     | Autenticado, mas não autorizado (falta de escopo, projeto errado etc.). No Webhooks, também uma credencial que ele não aceita. Na API de infraestrutura, também uma chamada fora das regras de acesso de uma chave de API. |
| `404`     | O recurso não existe, OU quem chama não pode vê-lo. De propósito, não distinguimos — revelar a existência já é um vazamento de acesso.                    |
| `409`     | Conflito de estado (nome já em uso, um `Idempotency-Key` reutilizado com outro corpo etc.).                                                               |
| `413`     | O corpo excede o limite de tamanho.                                                                                                                       |
| `422`     | A validação falhou. Em um erro de validação (`validation_error`), `error.details.errors` lista os valores de entrada que falharam; nos outros códigos `422` da API de Webhooks, como `invalid_payload` ou `unknown_event_type`, ele é um objeto que nomeia o valor ou a regra com problema. Na API de infraestrutura, `errors` traz os campos que falharam. |
| `429`     | Barrado pelo limite de requisições. Quando `Retry-After` está definido, ele diz quando tentar de novo.                                                    |
| `500–504` | Problema do lado do servidor. Sempre é seguro repetir requisições idempotentes.                                                                           |

## Idempotência {#idempotency}

Algumas rotas aceitam um header `Idempotency-Key`, para que uma retentativa não faça o trabalho duas vezes. No Webhooks, é a publicação de um evento. Envie qualquer valor único (um UUID é o convencional):

```bash
curl -X POST {{WEBHOOKS_BASE_URL}}/v1/events \
  -H "Authorization: Bearer $WEBHOOKS_API_KEY" \
  -H "Idempotency-Key: 8e1c91a4-04d0-4d77-8e6e-2f7c1a5b8e84" \
  -H "Content-Type: application/json" \
  -d '{ "event_type": "order.created", "payload": { "order_id": "1234" } }'
```

Todas as outras rotas ignoram o header. Na API de infraestrutura, criar uma VM duas vezes gera duas VMs, com ou sem chave. [Idempotência](/docs/idempotency) lista as rotas que o aceitam e o que fazer nas demais.

Endpoints GET são sempre idempotentes e não precisam do header.

## Operações de longa duração {#operations}

Algumas ações não terminam durante a requisição. Na API de infraestrutura, elas respondem assim que o trabalho é colocado na fila:

- `POST /api/v1/instance/` (criar uma VM) responde `200` com `{"success": true}` e sem id.
- `POST /api/v1/storage/` (criar um volume) responde `201` sem id.
- `POST /api/v1/instance/{instance_id}/resize` responde `200`, e a VM passa para `VERIFY_RESIZE`.
- `PUT` e `DELETE` em um conjunto de registros DNS respondem `202`.

Não há um objeto de operação para consultar. Para acompanhar o trabalho, leia o recurso e observe o `status` dele: `GET /api/v1/instance/` mostra uma VM nova em `BUILD` e depois em `ACTIVE` ou `ERROR`. Cada polling conta como uma chamada de API comum nos limites de requisições.

## Timestamps {#timestamps}

Todos os timestamps seguem **RFC 3339 / ISO 8601 em UTC**, com o sufixo `Z`:

```text
2026-05-19T18:30:00Z
```

Nunca em hora local, nunca com offset, nunca como epoch inteiro (exceto nos headers de assinatura de webhooks, que trazem um timestamp Unix porque essa é a convenção de quem assina com HMAC). `Date.parse()` em JavaScript e os parsers equivalentes da biblioteca padrão de outras linguagens tratam esse formato nativamente.

## Próximos passos {#next-steps}

- [Autenticação](/docs/authentication) cobre o header de autenticação e as funções e regras de acesso que limitam uma chave.
- As páginas de referência — [Máquinas virtuais](/docs/api/vms), [Armazenamento em blocos](/docs/api/block-storage), [Armazenamento de objetos](/docs/api/object-storage), [Regiões](/docs/api/regions) — mostram as convenções na prática.
