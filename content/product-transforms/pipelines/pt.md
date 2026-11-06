---
title: "Pipelines"
description: "As etapas de um pipeline, os caminhos, valores e filtros dele, os templates para começar e os limites de uma execução."
publishedAt: 2026-11-06
updatedAt: 2026-11-06
kind: concept
---

# Pipelines

Um pipeline é um documento JSON, e esta página descreve a linguagem dele. O Webhooks e o Request Bins executam a mesma linguagem no mesmo motor, então o que você aprende aqui também vale lá, dentro das regras de headers de cada produto. Para experimentar tudo isso sem conta, use o [playground](/transforms/playground).

## O documento {#document}

Este pipeline mantém as faturas pagas de $1,000 ou mais, remove o e-mail do cliente e qualquer número de telefone, adiciona dois campos e um header, e diz que um bearer token vai na requisição:

```json
{
  "version": 1,
  "steps": [
    { "filter": { "type": "invoice.paid", "data": { "amount": { "$gte": 100000 } } }, "note": "Paid invoices of $1,000 or more" },
    { "drop": ["data.customer.email", "**.phone"] },
    { "set": { "event_type": "{{ type }}", "amount_display": "{{ data.amount | money(data.currency) }}" } },
    { "headers": { "set": { "X-Event-Type": "{{ type }}" } } },
    { "auth": { "type": "bearer", "secret": "sec_…" } }
  ]
}
```

`version` é o formato do documento, sempre `1`; não é a versão do pipeline. As etapas rodam na ordem em que estão escritas. Cada uma é um objeto com uma chave de etapa e, opcionalmente, uma `note` de até 200 caracteres, que o console mostra na etapa e que um descarte informa. Um `filter` também pode ter uma `action`.

Uma execução vê uma requisição: um `body`, qualquer valor JSON; `headers`; e `meta`, somente leitura. Na API de execução, os três são o que você enviar. Cada etapa vê o corpo como a anterior o deixou. As etapas são numeradas a partir de 0 na API e nos textos de erro, e a partir de 1 no editor do console.

| Etapa | No console | O que faz |
|---|---|---|
| `filter` | **Filter** | Mantém a requisição só se ela corresponder ou, com `"action": "drop"`, descarta a requisição se ela corresponder. |
| `drop` | **Remove fields** | Remove campos do corpo. |
| `set` | **Set fields** | Adiciona ou sobrescreve campos. |
| `map` | **Reshape the body** | Substitui o corpo por um que você monta. |
| `headers` | **Headers** | Define, remove ou renomeia headers. |
| `auth` | **Credential** | Diz que um bearer token, autenticação básica ou uma chave de API vai na requisição e indica o slot de onde essa credencial vem. |

### `filter` {#step-filter}

Mantém a requisição só se ela corresponder; caso contrário, a execução responde `dropped`. Com `"action": "drop"`, funciona ao contrário: o que corresponde é descartado.

```json
{ "filter": { "data": { "status": "paid", "amount": { "$gte": 100000 } } }, "note": "Paid, $1,000 or more" }
```

- Cada chave é uma condição, e todas precisam ser atendidas. Um objeto aninhado é comparado pela forma, como `data` aqui.
- Um valor simples corresponde por igualdade JSON: `1` é igual a `1.0`.
- Um array corresponde quando é igual ao valor ou quando algum dos seus elementos corresponde: `{"data": {"tags": "urgent"}}` vale para `["billing", "urgent"]`, e `{"data": {"items": {"sku": "A-1", "qty": 2}}}` exige um item que tenha os dois.
- Um campo que a requisição não tem só corresponde a `{"$exists": false}` e às negações, como `$neq`.
- Os operadores são `$eq`, `$neq`, `$gt`, `$gte`, `$lt`, `$lte` (números com números, texto com texto; timestamps ISO são ordenados pelo tempo), `$in`, `$nin`, `$exists`, `$startsWith`, `$endsWith`, `$contains` (texto, ou um array que contém o valor), e `$and`, `$or` e `$not` para combinar filtros.
- `$headers`, `$meta` e `$body` testam essa parte da requisição: `{"$headers": {"x-github-event": "push"}}`.

### `drop` {#step-drop}

Remove campos do corpo: uma lista de 1 a 50 caminhos. `*` corresponde a um nível qualquer e `**` a qualquer profundidade, então `**.email` remove todos os campos `email`, onde quer que estejam. Um caminho que não corresponde a nada não é um erro.

```json
{ "drop": ["data.customer.email", "data.cards[*].number", "**.phone"] }
```

### `set` {#step-set}

Adiciona ou sobrescreve campos: de 1 a 50 pares de um caminho e um [valor](#values). Cria os objetos que faltarem no caminho, e cada valor lê o corpo como a etapa o encontrou. Um caminho que esbarra em um valor que não é um objeto faz a execução falhar com `set_conflict`.

```json
{ "set": { "event_type": "{{ type }}", "data.total_cents": { "$ref": "data.amount" } } }
```

### `map` {#step-map}

Substitui o corpo por um [valor](#values) que você escreve, geralmente um objeto.

```json
{ "map": {
    "invoice_id": "{{ data.id }}",
    "amount": { "$ref": "data.amount" },
    "amount_display": "{{ data.amount | money(data.currency) }}",
    "event": "{{ type }}"
} }
```

Com uma requisição `invoice.paid` cujo `data` é `{"id": "in_42", "amount": 150000, "currency": "usd"}`, o corpo passa a ser:

```json
{ "invoice_id": "in_42", "amount": 150000, "amount_display": "1,500.00 USD", "event": "invoice.paid" }
```

### `headers` {#step-headers}

Define headers com `set`, remove com `remove` e renomeia com `rename`, nesta ordem: remove, rename, set. Os nomes correspondem independentemente de maiúsculas e minúsculas, e um nome definido substitui todas as grafias dele.

```json
{ "headers": { "set": { "X-Event-Type": "{{ type }}", "Content-Type": "application/json" } } }
```

Uma etapa de headers não pode definir um header que pertença à conexão, como `Host` ou `Content-Length`, nem `Set-Cookie`. Também não pode definir `Authorization`, `Cookie` nem `X-Api-Key`, porque o valor ficaria no documento, que toda leitura retorna: uma credencial vai em uma etapa `auth`. Um produto que executa o pipeline por referência também o submete às próprias regras de headers.

### `auth` {#step-auth}

Diz que uma credencial vai na requisição e indica o slot de onde ela vem:

| `type` | Adiciona |
|---|---|
| `bearer` | `Authorization: Bearer` e a credencial. |
| `basic` | `Authorization: Basic`, a partir de um `username` e da credencial como senha. |
| `api_key`, `"in": "header"` | A credencial no header chamado `name`, depois de um `prefix` opcional como `"Token "`. |
| `api_key`, `"in": "query"` | A credencial como parâmetro de query `name`, na URL do destino. |

```json
{ "auth": { "type": "api_key", "in": "header", "name": "X-Api-Key", "secret": "sec_…" } }
```

`secret` é o id de um [slot](/docs/product-transforms/reference#slots) que o workspace tem. Nunca é um valor: um valor colado ali é recusado com `invalid_secret`, e a recusa não o repete. O produto que executa o pipeline por referência associa o slot a um segredo próprio ([Credenciais](/docs/product-transforms#credentials)). O Test e a API de execução mostram o header ou o parâmetro com o valor mascarado.

As etapas de credencial vêm depois de todas as outras, então nenhuma etapa consegue ler, copiar ou testar uma credencial.

## Caminhos e valores {#values}

Um caminho indica um campo do corpo:

| Caminho | Indica |
|---|---|
| `data.customer.email` | Um campo. |
| `data.items[0].sku` | Um elemento de uma lista. |
| `data['first name']` | Uma chave com espaço, ponto ou colchete. |
| `data.items[*].sku` | Cada elemento; em um valor, a lista deles. |
| `**.email` | `email` em qualquer profundidade; só em um `drop`. |
| `$meta.source`, `$headers.x-name`, `$body.data` | O meta da requisição, um dos headers dela ou o corpo dela; só em um valor. |

`set` aceita caminhos simples, `drop` aceita `*` e `**`, e um valor lê com `*`, mas não com `**`.

Um valor em `set`, `map` ou em um header é JSON, copiado como está escrito, com duas exceções:

- **`{{ path }}`** dentro de uma string insere um valor como texto. Um valor ausente ou `null` não insere nada, e um objeto ou uma lista entram como JSON. `{{ 'text' }}` e `{{ 42 }}` são literais, então um `{{` literal se escreve `{{ '{{' }}`.
- **`{"$ref": "path"}`** insere o próprio valor e mantém o tipo dele: um número continua número, uma lista continua lista. Adicione `"default"` para quando o caminho estiver ausente.

Uma expressão pode passar o valor por filtros, da esquerda para a direita: `{{ data.amount | money(data.currency) }}` dá `1,500.00 USD` para um valor de 150000 em `usd`.

| Filtro | Dá |
|---|---|
| `upper`, `lower` | O texto em maiúsculas ou minúsculas. |
| `default(x)` | `x` quando o valor está ausente, é `null` ou está vazio. |
| `truncate(n)` | No máximo `n` caracteres, seguidos de `…`. |
| `join(sep)` | Uma lista como texto, unida com `", "`, a menos que você informe `sep`. |
| `length` | O número de elementos, chaves ou caracteres. |
| `json`, `json(indent)` | O valor como JSON compacto, ou indentado com 1 a 8 espaços. |
| `number(digits)` | Um número com essa quantidade de casas decimais. |
| `money(currency)` | Um valor em unidades menores, formatado; moedas sem casas decimais e com três também. |
| `date(format)` | Uma data ISO 8601 ou segundos epoch, em UTC, com `%Y`, `%m`, `%d`, `%H`, `%M`, `%S` e outros. |
| `escape(target)` | Texto que não consegue formatar uma mensagem de chat: `slack` (o padrão), `discord` ou `markdown`. |
| `code(target, max, language)` | Texto como bloco de código na marcação de `slack`, `discord` ou `markdown`, que o texto não consegue fechar antes da hora, ajustado a `max` caracteres. |

Não há loops, condições nem contas: uma condição é uma etapa `filter`, e uma lista vira texto com `[*]` e `join`.

## Templates {#templates}

A galeria reúne pipelines prontos para começar. No console, eles ficam em **Start from a template**. Pela API, `GET /v1/pipelines/templates` retorna cada um com o seu `pipeline`. Salvar um template cria um pipeline que é seu: altere-o como qualquer outro; nada o liga de volta ao template.

| `id` | Template | O que envia |
|---|---|---|
| `slack` | **Slack message** | Para um incoming webhook do Slack: o tipo do evento como título, o id e o horário dele, e os dados em um bloco de código. |
| `discord` | **Discord message** | Para um webhook de canal do Discord: um embed com o tipo do evento, os dados em um bloco de código, e o id e o horário. Não menciona ninguém. |
| `teams` | **Microsoft Teams card** | Para um webhook de workflow do Teams: um Adaptive Card com o tipo do evento, o id e o horário dele, e os dados em fonte monoespaçada. |
| `keep_fields` | **Keep only these fields** | O `id`, o `type`, o `created_at` e a `version` do evento, e só os campos de `data` que o `map` dele lista, começando por `data.id`. Um campo listado que o evento não tem é enviado como `null`. |
| `drop_personal` | **Drop personal data** | O evento sem `email`, `phone`, `first_name`, `last_name`, `address`, `billing_address`, `shipping_address`, `date_of_birth` e `ip_address`, em qualquer profundidade. Um `name` simples fica, porque muitas vezes ele nomeia um plano ou um produto. |

Cada template de chat é uma etapa `map` e uma etapa `headers` que define `Content-Type: application/json`, e funciona com qualquer evento. Um tipo ausente aparece como "Event" e um id ou horário ausente como "—", os dados são cortados para caber nos limites do app, e nada no evento consegue formatar a mensagem, mencionar alguém ou fechar o bloco de código antes da hora.

## Limites {#limits}

Um pipeline não tem loops, relógio nem rede, e limites fixos restringem cada execução. Acima de um deles, a execução responde `failed` com o motivo, e um documento acima de um deles é recusado ao ser salvo.

| O quê | Limite | Recusado como |
|---|---|---|
| Um documento, como JSON compacto | 64 KiB | `too_large` |
| Etapas | 20 | `too_many_steps` |
| Caminhos em um `drop`, campos em um `set`, nomes em cada parte de uma etapa `headers` | 50 | `invalid_value` |
| As configurações de uma etapa, como JSON compacto | 16 KiB | `too_large` |
| A nota de uma etapa | 200 caracteres | `invalid_value` |
| Aninhamento, em uma etapa e em um corpo | 32 níveis | `too_deep`, `input_too_deep` |
| O corpo que uma etapa lê | 256 KiB | `input_too_large` |
| O corpo com que uma execução responde | 256 KiB | `output_too_large` |
| Um valor gerado por uma etapa | 64 KiB | `value_too_large` |
| Trabalho em uma execução | 100,000 valores lidos ou copiados; texto conta um a cada 128 caracteres | `too_many_nodes` |
| Headers no fim de uma execução | 50 | `too_many_headers` |
| Um valor de header | 8 KiB | `header_too_large` |

O playground tem limites menores: um documento de 16 KiB, um corpo de 32 KiB e 10,000 valores lidos ou copiados em uma execução.

## Próximos passos {#next-steps}

- [Início rápido](/docs/product-transforms/quickstart) — teste um pipeline, salve-o e execute-o.
- [Referência de Transforms](/docs/product-transforms/reference) — todas as rotas e campos, e o que cada recusa significa.
- [Transformações no Webhooks](/docs/product-webhooks/transformations) — a mesma linguagem em um endpoint do Webhooks.
