---
title: "Tipos de evento"
description: "O catálogo de nomes de evento de um workspace, a política para nomes que ele ainda não viu e os JSON Schemas opcionais aos quais os payloads devem corresponder."
publishedAt: 2026-10-19
updatedAt: 2026-10-19
kind: concept
---

# Tipos de evento

Todo evento tem um tipo — `order.created`, `stripe.invoice.paid` — e os endpoints se [inscrevem](/docs/product-webhooks#objects) nos tipos usando padrões. O catálogo de tipos de evento é a lista de nomes que o seu workspace usa, com uma descrição e um JSON Schema opcionais para cada um. É também onde você decide o que acontece quando aparece um nome que ninguém registrou.

## Preciso registrar os tipos? {#register}

Não — não com a política padrão. Com **Lenient**, qualquer tipo que você publica (ou que uma [fonte](/docs/product-webhooks/sources) recebe) é aceito e adicionado ao catálogo na primeira vez que aparece. A maioria dos workspaces nunca registra um tipo manualmente.

Registre um quando você quiser:

- **descrevê-lo** para quem desenvolve em cima dos seus webhooks;
- **verificar os payloads dele** com um JSON Schema (abaixo);
- ou mudar para **Strict**, em que só tipos registrados podem ser publicados.

As inscrições de endpoint fazem a correspondência pelo nome de qualquer forma; uma inscrição em `order.` não precisa que `order.created` esteja no catálogo.

## A política para tipos não registrados {#policy}

| Política | Um tipo não registrado… |
|---|---|
| **Lenient** (padrão) | é aceito e adicionado ao catálogo. |
| **Strict** | é recusado com `422 unknown_event_type`. |

O Strict é adequado para um workspace em que o conjunto de tipos é um contrato — um erro de digitação em um publicador passa a falhar de forma explícita na publicação, em vez de criar em silêncio um tipo em que nenhum endpoint está inscrito. Uma requisição de uma fonte recusada dessa forma aparece como `unknown_event_type` nas [requisições capturadas](/docs/product-webhooks/captured-requests#outcomes).

A política é definida para o workspace e pode ser definida por projeto (`PUT /v1/event-types/policy`, com `?project_id=` para um projeto). No console, é o controle **When an unregistered type arrives** na página Event types, e ele acompanha o seletor de projeto.

## Schemas de payload {#schemas}

Um tipo pode ter um [JSON Schema](https://json-schema.org/) (draft 7). Quando tem, toda publicação desse tipo é verificada com ele, e um payload que não corresponde é recusado com `422 invalid_payload`, com a lista do que falhou.

```bash
curl -sX POST {{WEBHOOKS_BASE_URL}}/v1/event-types \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{
        "name": "order.created",
        "description": "A customer placed an order",
        "payload_schema": {
          "type": "object",
          "required": ["order_id", "total"],
          "properties": {"order_id": {"type": "string"}, "total": {"type": "integer"}}
        }
      }'
```

Os schemas são verificados quando você os salva: um que não seja JSON Schema válido, ou cujas expressões regulares possam tornar a correspondência extremamente lenta, é recusado com uma explicação.

## Tipos de todo o workspace e por projeto {#scope}

Um tipo registrado sem projeto vale para todos os projetos. Um registrado com `project_id` vale só para aquele projeto e, nele, tem precedência sobre uma entrada de todo o workspace com o mesmo nome — assim um projeto pode ter a sua própria descrição ou um schema mais rígido. A coluna **Applies to** do console mostra qual é qual.

## De onde veio um tipo {#origin}

| Origem | No console | Como chegou lá |
|---|---|---|
| `manual` | added here | Registrado no console ou com `POST /v1/event-types`. |
| `ingest` | from a source | Chegou pela primeira vez por uma fonte, com Lenient. |
| `lenient` | auto-added | Publicado pela primeira vez pela API, com Lenient. |

## `webhook.received` {#webhook-received}

Se o catálogo lista `webhook.received` e você nunca o publicou: uma fonte recebeu requisições das quais não conseguiu ler um tipo e não tinha um tipo padrão para usar no lugar. Dê um tipo padrão a essa fonte, ou indique o header ou o caminho JSON que traz o tipo — veja [Tipos de evento de uma fonte](/docs/product-webhooks/sources#event-types).

## Próximos passos {#next-steps}

- [Fontes](/docs/product-webhooks/sources) — como uma fonte lê o tipo na requisição de um provedor.
- [Visão geral de Webhooks](/docs/product-webhooks) — inscrições e os outros objetos.
- [Erros](/docs/errors) — `unknown_event_type`, `invalid_payload` e os demais.
