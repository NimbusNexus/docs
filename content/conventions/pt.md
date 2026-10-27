---
title: "Convenções"
description: "Padrões que a API segue em todo lugar — ids de recurso, paginação, erros, idempotência, operações de longa duração."
publishedAt: 2026-05-19
updatedAt: 2026-10-15
kind: concept
---

# Convenções

A API tem um único formato, repetido em todos os recursos. Quando você conhece o formato, conhece todos os endpoints — a única coisa que muda de um recurso para outro é o conjunto de campos do próprio recurso.

## Ids de recurso {#resource-ids}

Todo recurso tem um id opaco e estável, no formato `<prefix>_<26-char-base32>`:

| Recurso                   | Prefixo | Exemplo                           |
| ------------------------- | ------- | --------------------------------- |
| Máquina virtual           | `vm_`   | `vm_01H8FZQ4XW9KMP4XQNR3VT7DC2`   |
| Banco de dados gerenciado | `db_`   | `db_01H8FZQ4XW9KMP4XQNR3VT7DC2`   |
| Volume de blocos          | `vol_`  | `vol_01H8FZQ4XW9KMP4XQNR3VT7DC2`  |
| Snapshot                  | `snap_` | `snap_01H8FZQ4XW9KMP4XQNR3VT7DC2` |
| Chave de API              | `key_`  | `key_01H8FZQ4XW9KMP4XQNR3VT7DC2`  |

Os ids são estáveis durante toda a vida do recurso — nunca são reutilizados nem reescritos quando o recurso é renomeado. Use-os em URLs, chaves estrangeiras e logs de auditoria; use os campos `name`, legíveis por humanos, só para exibição.

## Paginação {#pagination}

Os endpoints de listagem aceitam dois parâmetros de query:

- `limit` — tamanho de página. Padrão 50, máximo 200. Acima de 200, a requisição falha na validação: `422` `validation_error` ([Erros](/docs/errors#codes-validation)).
- `cursor` — ponteiro opaco para a próxima página. O corpo da resposta o retorna como `pagination.next_cursor` quando há mais páginas; envie-o de volta como `cursor` para avançar.

Os cursores são opacos — não tente decodificá-los nem construí-los. Eles incluem o estado de ordenação + filtros da requisição original, então mudar os filtros no meio da paginação produz um comportamento indefinido. Recomece do zero (sem `cursor`) quando seus filtros mudarem.

O padrão em código:

```bash
# Page 1
curl '{{API_BASE_URL}}/v1/vms?limit=50' \
  -H "Authorization: Bearer $NIMBUS_KEY"

# Page 2 (cursor from page 1's response.pagination.next_cursor)
curl '{{API_BASE_URL}}/v1/vms?limit=50&cursor=eyJpZCI6...' \
  -H "Authorization: Bearer $NIMBUS_KEY"
```

Quando `pagination.next_cursor` está ausente ou é null, você está na última página.

## Erros {#errors}

Toda resposta de erro usa o mesmo formato JSON:

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
| `200`     | Sucesso com corpo.                                                                                                                                        |
| `201`     | Recurso criado. O header `Location` aponta para o novo recurso.                                                                                           |
| `202`     | Operação aceita; consulte `operation.status` para acompanhar o progresso.                                                                                 |
| `204`     | Sucesso, sem corpo (típico de DELETE).                                                                                                                    |
| `400`     | Não foi possível ler a requisição como foi enviada. `error.message` diz por quê.                                                                          |
| `401`     | Nenhuma credencial utilizável. Veja [Autenticação](/docs/authentication).                                                                                 |
| `402`     | Seu plano ou a situação do faturamento impede a requisição (uma cota, uma funcionalidade fora do seu plano, um workspace congelado). Repetir não adianta. |
| `403`     | Autenticado, mas não autorizado (falta de escopo, projeto errado etc.). No Webhooks, também uma credencial que ele não aceita.                            |
| `404`     | O recurso não existe, OU quem chama não pode vê-lo. De propósito, não distinguimos — revelar a existência já é um vazamento de acesso.                    |
| `409`     | Conflito de estado (nome já em uso, um `Idempotency-Key` reutilizado com outro corpo etc.).                                                               |
| `413`     | O corpo excede o limite de tamanho.                                                                                                                       |
| `422`     | A validação falhou. Em um erro de validação (`validation_error`), `error.details.errors` lista os valores de entrada que falharam; nos outros códigos `422` da API de Webhooks, como `invalid_payload` ou `unknown_event_type`, `error.details` é um objeto que nomeia o valor ou a regra com problema. |
| `429`     | Barrado pelo limite de requisições. Quando `Retry-After` está definido, ele diz quando tentar de novo.                                                    |
| `500–504` | Problema do lado do servidor. Sempre é seguro repetir requisições idempotentes.                                                                           |

## Idempotência {#idempotency}

Endpoints que alteram dados (POST, PUT, PATCH, DELETE) aceitam um header `Idempotency-Key` opcional. Envie qualquer valor único (um UUID é o convencional); guardamos a resposta em cache por 24 horas e devolvemos a mesma resposta em uma repetição com a mesma chave.

```bash
curl -X POST {{API_BASE_URL}}/v1/vms \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Idempotency-Key: 8e1c91a4-04d0-4d77-8e6e-2f7c1a5b8e84" \
  -H "Content-Type: application/json" \
  -d '{ "name": "web", "size": "gp-2-4", "region": "us-east-1", "image": "ubuntu-24.04" }'
```

Use chaves de idempotência quando seu cliente puder repetir uma requisição depois de uma falha de rede, mas não conseguir saber se a original deu certo. O comportamento padrão, sem chave, é "retentativa de melhor esforço"; com uma chave, as retentativas são seguras.

Endpoints GET são sempre idempotentes e não precisam do header.

## Operações de longa duração {#operations}

Algumas ações não terminam durante o ciclo de vida da requisição:

- O `POST` de VM retorna `202` enquanto o hypervisor aloca a instância.
- O `POST` de banco de dados retorna `202` enquanto as réplicas sobem.
- O redimensionamento de volume e a migração de VM retornam `202`.

O corpo da resposta de qualquer 202 inclui um objeto `operation`:

```json
{
  "id": "vm_01H8FZQ4XW9KMP4XQNR3VT7DC2",
  "state": "provisioning",
  "operation": {
    "id": "op_01H8FZ...",
    "kind": "vm_create",
    "status": "running",
    "progress": 0.4,
    "started_at": "2026-05-19T18:30:00Z"
  }
}
```

Duas formas de acompanhar o progresso:

1. **Polling** — `GET /v1/operations/{op_id}` uma vez por segundo. Barato; conta como uma chamada de API comum nos limites de requisições.
2. **Webhook** — inscreva uma URL de callback no painel. Enviamos um POST quando a operação chega a um estado final (`succeeded` ou `failed`).

A maioria das operações termina em menos de 60 segundos. As exceções são o download de imagens de VM no primeiro uso (~90 segundos) e a configuração de clusters Kafka (~180 segundos).

## Timestamps {#timestamps}

Todos os timestamps seguem **RFC 3339 / ISO 8601 em UTC**, com o sufixo `Z`:

```text
2026-05-19T18:30:00Z
```

Nunca em hora local, nunca com offset, nunca como epoch inteiro (exceto nos headers de assinatura de webhooks, que trazem um timestamp Unix porque essa é a convenção de quem assina com HMAC). `Date.parse()` em JavaScript e os parsers equivalentes da biblioteca padrão de outras linguagens tratam esse formato nativamente.

## Próximos passos {#next-steps}

- [Autenticação](/docs/authentication) cobre o formato do header de autenticação e o modelo de escopos.
- As páginas de referência — [Máquinas virtuais](/docs/api/vms), [Bancos de dados gerenciados](/docs/api/managed-databases), [Armazenamento em blocos](/docs/api/block-storage), [Armazenamento de objetos](/docs/api/object-storage), [Regiões](/docs/api/regions) — mostram as convenções na prática.
