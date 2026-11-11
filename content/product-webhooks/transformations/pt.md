---
title: "Transformações"
description: "Filtre, enxugue, remodele ou adicione credenciais a cada entrega antes que ela seja assinada e enviada: com um pipeline de etapas declarativas em todos os planos ou com um script JavaScript nos planos pagos."
publishedAt: 2026-10-30
updatedAt: 2026-11-11
kind: concept
---

# Transformações

Uma transformação muda o que um endpoint recebe: ela roda em cada evento antes da entrega e envia, no lugar dele, uma requisição remodelada, ou nada. Ela é um **pipeline** de etapas declarativas, em todos os planos, ou um **script** JavaScript, nos planos pagos; o que ela produz é assinado com o segredo do endpoint e enviado como qualquer outra entrega.

## Para que serve {#what-for}

- **Um receptor que exige credenciais.** A sua própria API, ou a de um parceiro, espera um bearer token, autenticação básica ou uma chave de API. Um pipeline as adiciona a partir de um [segredo](#credentials) que guardamos criptografado e nunca mais mostramos.
- **Um receptor que quer o próprio formato.** O Slack, o Discord e o Microsoft Teams aceitam apenas os seus próprios formatos de mensagem e recusam o nosso envelope; um CRM quer três campos, com os nomes dele. Um [template](#templates) ou uma etapa `map` monta esse corpo.
- **Só alguns eventos.** Uma [inscrição](/docs/product-webhooks#objects) faz a correspondência só pelo tipo do evento. "Só `invoice.paid` de $1.000 ou mais" depende do payload, que uma etapa `filter` lê.
- **Menos dados, ou alguns a mais.** Remova dados pessoais antes que um fornecedor de analytics os veja, ou adicione o tipo do evento ao corpo ou a um header.

## Pipelines e scripts {#kinds}

| | Pipeline | Script |
|---|---|---|
| O que você escreve | Até 20 etapas, no formulário do console ou em JSON | Uma função JavaScript |
| Planos | Todos, inclusive o Free | Starter, Pro e Custom |
| Onde roda | Junto com a entrega, sob limites fixos; nenhum código seu roda | Em um sandbox próprio, com um orçamento de CPU, memória e tempo |
| Serve para | Credenciais, filtros, remover e adicionar campos, remodelar, mensagens de chat | Lógica que as etapas não conseguem expressar |

Uma transformação é uma coisa ou outra, e o tipo dela é definido quando ela é criada. Um endpoint executa no máximo uma transformação; uma transformação pode servir a vários endpoints do projeto dela. Um pipeline também pode ser [mantido no Transforms](#reference) e executado aqui por referência.

No Free, criar ou testar um script é recusado com `402 not_entitled`. Um workspace que sai do plano pago mantém os seus scripts e ainda pode renomeá-los, pausá-los, desvinculá-los e excluí-los, mas não pode salvar código novo, testar nem retomar nenhum deles; as entregas para um endpoint que executa um script esperam até que o plano volte a incluir scripts ou até que você o desvincule. Os pipelines continuam rodando em qualquer plano.

Os scripts dependem de um serviço de sandbox próprio; os pipelines, não. Enquanto os scripts estão desligados, o console avisa, `GET /v1/plan` retorna `transformations_available: false` e as entregas para um endpoint que executa um script ficam esperando. Se o sandbox não puder aceitar um script em um dado momento, salvar ou testar um script responde `503 unavailable` e nada é salvo, e a tentativa de uma entrega falha com uma mensagem que diz isso e é repetida no cronograma de sempre.

`GET /v1/plan` também diz o que o seu plano inclui: `pipelines` é `true` em todos os planos, e `transformations` é `true` quando ele inclui scripts. As execuções dos dois tipos são contadas, mas não cobradas; `transformation_runs` é a contagem deste mês.

## Um pipeline {#pipeline}

Um pipeline é um documento JSON. Este envia as faturas pagas de $1.000 ou mais, sem o e-mail do cliente nem nenhum número de telefone, com o tipo do evento adicionado ao corpo e um bearer token tirado de um segredo armazenado:

```json
{
  "version": 1,
  "steps": [
    { "filter": { "type": "invoice.paid", "data": { "amount": { "$gte": 100000 } } }, "note": "Paid invoices of $1,000 or more" },
    { "drop": ["data.customer.email", "**.phone"] },
    { "set": { "event_type": "{{ type }}" } },
    { "auth": { "type": "bearer", "secret": "sec_…" } }
  ]
}
```

`version` é o formato do documento, sempre `1`; não é a versão da transformação. As etapas rodam na ordem em que estão escritas. Cada uma é um objeto com uma chave de etapa e, opcionalmente, uma `note` de até 200 caracteres, que o console mostra na etapa e que fica registrada na entrega que um filtro descarta. Um `filter` também pode ter uma `action`.

A primeira etapa vê o envelope que enviaríamos normalmente, com `id`, `type`, `created_at`, `data` e `version`, e cada etapa seguinte vê o corpo como a anterior o deixou. Se nenhuma etapa muda o corpo, o receptor recebe os bytes originais do evento. As etapas são numeradas a partir de 0 na API e nos textos de erro, e a partir de 1 no editor do console.

| Etapa | No console | O que faz |
|---|---|---|
| `filter` | **Filter** | Envia o evento só se ele corresponder ou, com `"action": "drop"`, descarta o evento se ele corresponder. |
| `drop` | **Remove fields** | Remove campos do corpo. |
| `set` | **Set fields** | Adiciona ou sobrescreve campos. |
| `map` | **Reshape the body** | Substitui o corpo por um que você monta. |
| `headers` | **Headers** | Define, remove ou renomeia headers. |
| `auth` | **Credential** | Adiciona um bearer token, autenticação básica ou uma chave de API a partir de um segredo armazenado. |

### `filter` {#step-filter}

Mantém a entrega só se o evento corresponder; caso contrário, a entrega é [descartada](#dropped) e nada é enviado. Com `"action": "drop"`, funciona ao contrário: o que corresponde é descartado.

```json
{ "filter": { "data": { "status": "paid", "amount": { "$gte": 100000 } } }, "note": "Paid, $1,000 or more" }
```

- Cada chave é uma condição, e todas precisam ser atendidas. Um objeto aninhado é comparado pela forma, como `data` aqui.
- Um valor simples corresponde por igualdade JSON: `1` é igual a `1.0`.
- Um array corresponde quando é igual ao valor ou quando algum dos seus elementos corresponde: `{"data": {"tags": "urgent"}}` vale para `["billing", "urgent"]`, e `{"data": {"items": {"sku": "A-1", "qty": 2}}}` exige um item que tenha os dois.
- Um campo que o evento não tem só corresponde a `{"$exists": false}` e às negações, como `$neq`.
- Os operadores são `$eq`, `$neq`, `$gt`, `$gte`, `$lt`, `$lte` (números com números, texto com texto; timestamps ISO são ordenados pelo tempo), `$in`, `$nin`, `$exists`, `$startsWith`, `$endsWith`, `$contains` (texto, ou um array que contém o valor), e `$and`, `$or` e `$not` para combinar filtros.
- `$meta` testa para onde a entrega vai: `{"$meta": {"endpoint": {"id": "ep_3f9a…"}}}`.

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

Com um evento `invoice.paid` cujo `data` é `{"id": "in_42", "amount": 150000, "currency": "usd"}`, a etapa envia:

```json
{ "invoice_id": "in_42", "amount": 150000, "amount_display": "1,500.00 USD", "event": "invoice.paid" }
```

### `headers` {#step-headers}

Define headers com `set`, remove com `remove` e renomeia com `rename`, nesta ordem: remove, rename, set. Os nomes correspondem independentemente de maiúsculas e minúsculas. Um pipeline começa sem headers próprios: os headers personalizados do endpoint e os nossos são adicionados depois que ele roda, um header que ele define substitui um header personalizado com o mesmo nome, e `remove` e `rename` só alcançam headers definidos por etapas anteriores.

```json
{ "headers": { "set": { "X-Event-Type": "{{ type }}", "Content-Type": "application/json" } } }
```

Um pipeline não pode definir um header que nós mesmos enviamos, ou seja, nenhum header `X-Webhook-*`, a assinatura inclusive, nem `User-Agent`; nem um que pertença à conexão, como `Host`, `Content-Length` ou `Expect`. `Content-Type` ele pode definir, e ele passa a ser o tipo de conteúdo da entrega. Sem ele, a entrega sai como `application/json`.

### `auth` {#step-auth}

Adiciona credenciais a partir de um [segredo armazenado](#credentials), indicado pelo id:

| `type` | Adiciona |
|---|---|
| `bearer` | `Authorization: Bearer` e o segredo. |
| `basic` | `Authorization: Basic`, a partir de um `username` e do segredo como senha. |
| `api_key`, `"in": "header"` | O segredo no header chamado `name`, depois de um `prefix` opcional como `"Token "`. |
| `api_key`, `"in": "query"` | O segredo como parâmetro de query `name`, na URL do endpoint e só nessa requisição. |

```json
{ "auth": { "type": "api_key", "in": "header", "name": "X-Api-Key", "secret": "sec_…" } }
```

As etapas `auth` vêm depois de todas as outras, então nenhuma etapa consegue ler, copiar ou testar as credenciais.

## Caminhos e valores {#values}

Um caminho indica um campo do corpo:

| Caminho | Indica |
|---|---|
| `data.customer.email` | Um campo. |
| `data.items[0].sku` | Um elemento de uma lista. |
| `data['first name']` | Uma chave com espaço, ponto ou colchete. |
| `data.items[*].sku` | Cada elemento; em um valor, a lista deles. |
| `**.email` | `email` em qualquer profundidade; só em um `drop`. |
| `$meta.endpoint.id` | O endpoint para onde a entrega vai, e `$meta.endpoint.description` a descrição dele; só em um valor. |

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

A galeria reúne pipelines prontos para começar. No console, eles ficam em **Start from a template**, abaixo das etapas: **Use Slack message**, ou o botão de qualquer outro, coloca as etapas desse template no editor, depois de perguntar se elas substituiriam as suas. Pela API, `GET /v1/transformations/templates` retorna cada um com o seu `pipeline`.

| Template | O que envia |
|---|---|
| **Slack message** | Para um incoming webhook do Slack: o tipo do evento como título, o id e o horário dele, e os dados em um bloco de código. |
| **Discord message** | Para um webhook de canal do Discord: um embed com o tipo do evento, os dados em um bloco de código, e o id e o horário. Não menciona ninguém. |
| **Microsoft Teams card** | Para um webhook de workflow do Teams: um Adaptive Card com o tipo do evento, o id e o horário dele, e os dados em fonte monoespaçada. |
| **Keep only these fields** | O `id`, o `type`, o `created_at` e a `version` do evento, e só os campos de `data` que o `map` dele lista, começando por `data.id`. Um campo listado que o evento não tem é enviado como `null`. |
| **Drop personal data** | O evento sem `email`, `phone`, `first_name`, `last_name`, `address`, `billing_address`, `shipping_address`, `date_of_birth` e `ip_address`, em qualquer profundidade. Um `name` simples fica, porque muitas vezes ele nomeia um plano ou um produto. |

Salvar um template cria um pipeline que é seu: altere-o como qualquer outro; nada o liga de volta ao template. Cada template de chat é uma etapa `map` e uma etapa `headers` que define `Content-Type: application/json`, e funciona com qualquer evento. Um tipo ausente aparece como "Event" e um id ou horário ausente como "—", os dados são cortados para caber nos limites do app, e nada no evento consegue formatar a mensagem, mencionar alguém ou fechar o bloco de código antes da hora.

O Slack, o Discord e o Teams não conseguem responder ao [desafio de verificação](/docs/product-webhooks/endpoint-verification#cannot-echo), então um endpoint apontado para um deles precisa da verificação desligada no projeto dele, o que os planos pagos permitem.

**Os presets agora são templates.** Um endpoint que já executa um preset, que é um script, continua executando-o como está, e só um endpoint assim ainda oferece **Preset** entre as opções. O template de mesmo nome faz o mesmo trabalho sem script, em todos os planos.

## Credenciais {#credentials}

Uma etapa `auth` indica um segredo pelo id (`sec_…`), nunca pelo valor. Um segredo pertence a um projeto, como uma transformação, e só os pipelines desse projeto podem usá-lo. O valor dele é armazenado criptografado e nunca é devolvido: a API lista os segredos por nome e id, um pipeline lido de volta traz só o id, um teste mostra as credenciais como `••••`, e uma entrega guarda só os nomes dos headers e dos parâmetros de query que adicionou.

No console, **Secret**, em uma etapa **Credential**, lista os segredos do projeto. Para armazenar um novo, escolha **New secret…**, preencha **Secret name** e **Secret value** e escolha **Save secret**.

Pela API, com o valor lido de uma variável de ambiente:

```bash
curl -sX POST {{WEBHOOKS_BASE_URL}}/v1/secrets \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"project_id\": \"prj_…\", \"name\": \"CRM token\", \"value\": \"$CRM_TOKEN\"}"
```

```json
{ "id": "sec_…", "project_id": "prj_…", "name": "CRM token", "transformation_count": 0, "created_at": "…", "updated_at": "…" }
```

`PATCH /v1/secrets/{id}` renomeia um segredo ou substitui o valor dele; todo pipeline que o usa envia o valor novo a partir da próxima tentativa, inclusive nas retentativas de entregas anteriores. `DELETE /v1/secrets/{id}` é recusado com `409 secret_in_use` enquanto a versão atual de um pipeline usar o segredo. O console só cria segredos; para renomear, substituir e excluir, use a API.

## Scripts {#script}

Um script é uma única função chamada `transform`, no Starter, no Pro e no Custom:

```js
function transform(event, context) {
  // event:   { id, type, created_at, data, version }, the envelope we would otherwise send
  // context: { endpoint: { id, description }, attempt }
  if (event.type !== "invoice.paid") return null; // send nothing
  return {
    body: { text: `Invoice ${event.data.id} paid` },
    headers: { "X-Team": "billing" },
  };
}
```

Ela retorna a requisição a enviar, ou `null` para não enviar nada. Um `body` que é um objeto ou uma lista vai como JSON; uma string vai como está, como `text/plain; charset=utf-8`. `contentType` define outro tipo de conteúdo, no lugar de um header `Content-Type`, e `headers` acrescenta headers que seguem as regras dos headers personalizados de um endpoint. A URL e o método continuam sendo os do endpoint. O que o script escrever com `console.log` fica guardado com a entrega, até 4 KiB.

O script é JavaScript puro, em um único arquivo, sem rede, sem sistema de arquivos, sem timers e sem imports, então uma biblioteca de que ele precise tem que vir empacotada nele. Ao salvar, primeiro carregamos o script no sandbox, sem chamá-lo: um erro de sintaxe, a falta da função `transform` ou um código de nível superior que falhe é recusado com `422 invalid_transformation`, e nada é salvo.

## Testar {#test}

**Test**, abaixo do editor, executa o que está no editor, salvo ou não, com **A recent event** das últimas entregas do endpoint ou com **An event you paste**. Escolha **Run test**: nada é enviado e nada é salvo. Um pipeline roda com os segredos do projeto dele, e a resposta mostra cada credencial como `••••`. O resultado é um destes:

- **Would send**: o tipo de conteúdo, o tamanho, os headers e o corpo que o receptor receberia.
- **Would send nothing**: um filtro descartou a entrega, na etapa mostrada, ou o script retornou `null`.
- **Failed**: por que e, em um pipeline, em qual etapa.

Pela API, envie o pipeline, ou o `code` de um script, com um evento:

```bash
curl -sX POST {{WEBHOOKS_BASE_URL}}/v1/transformations/test \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d '{"project_id": "prj_…",
       "pipeline": {"version": 1, "steps": [
         {"map": {"text": "{{ type }}: {{ data.id }}"}},
         {"auth": {"type": "bearer", "secret": "sec_…"}}]},
       "event": {"id": "evt_1", "type": "invoice.paid", "created_at": "2026-11-03T10:00:00Z", "data": {"id": "in_42"}, "version": "1"}}'
```

```json
{ "status": "ok", "body": "{\"text\":\"invoice.paid: in_42\"}", "content_type": null, "headers": { "Authorization": "Bearer ••••" }, "logs": "", "reason": null, "error": null, "fuel": 0, "duration_ms": 0.2, "query": {}, "step": null }
```

`status` é `ok`, `dropped` ou `failed`. Em um descarte ou uma falha, `step` é a etapa, contada a partir de 0; `reason` é a palavra-chave, como `no_match` (ou `matched`, para um filtro com `"action": "drop"`) ou `set_conflict`; e `error` diz isso em palavras, com a nota do filtro em um descarte. `content_type` é `null`, a menos que uma etapa o tenha definido. Um teste que descarta ou falha ainda responde `200`, mas um pipeline que nunca conseguiria rodar é recusado com `422 invalid_pipeline`, como seria ao salvá-lo.

Testar um pipeline funciona em todos os planos. Testar um script exige um plano com scripts, divide com o salvamento de scripts um limite de 60 por minuto por workspace, com rajadas de 10, e também retorna os `logs` e o `fuel` do script.

O **Send test ping** de um endpoint envia o ping fixo sem a transformação, e portanto sem as credenciais de um pipeline: um receptor que as verifica recusa o ping. **Test**, ou um evento real, mostra o que o seu receptor vai receber.

## Versões e pausa {#versions}

Salvar um pipeline ou um script alterado cria a próxima versão dele; salvar um idêntico à versão atual não cria nenhuma. As últimas 50 versões são mantidas, e cada entrega registra a versão que a moldou. No console, **Versions** lista as versões, e **Load into editor** carrega uma anterior no editor; salvá-la faz dela a versão mais recente. Pela API, `GET /v1/transformations/{id}/versions` lista as versões, da mais recente para a mais antiga, e `GET /v1/transformations/{id}/versions/{version}` retorna uma com o pipeline ou o código dela.

**Pause** interrompe uma transformação sem desvinculá-la, assim como `PATCH /v1/transformations/{id}` com `{"status": "disabled"}`. As entregas dos endpoints dela esperam, em vez de sair sem a transformação: elas aparecem como `failed`, com `last_error` "paused: the endpoint's transformation is not running", e são enviadas quando você a retoma com **Resume** (`{"status": "enabled"}`), com a versão atual naquele momento. Pausar e retomar um pipeline funciona em qualquer plano.

## Vincular a um endpoint {#set-up}

No console, abra o menu do endpoint na página **Endpoints** e escolha **Transformation**, ou clique na entrada dele na coluna **Transformation**. Depois:

1. Escolha **Pipeline** e monte-o: com **Add a step**, a partir de um template, ou colando um documento inteiro em **JSON** e escolhendo **Apply JSON**. Ou escolha **Script** e escreva a função.
2. [Teste a transformação](#test).
3. Escolha **Save**. As próximas entregas do endpoint passam por ela.

**Off** e **Save** a desligam depois de uma confirmação, e as entregas voltam a sair como o envelope do evento. Se nenhum outro endpoint executa a transformação, ela é excluída junto com as versões. Como o tipo não pode mudar, trocar um endpoint de um script para um pipeline, ou o contrário, salva uma transformação nova no lugar da antiga, e exclui a antiga se nenhum outro endpoint a executa. Quando uma transformação roda em vários endpoints, salvá-la muda a transformação para todos eles.

Pela API, crie a transformação no projeto do endpoint e depois aponte o endpoint para ela:

```bash
curl -sX POST {{WEBHOOKS_BASE_URL}}/v1/transformations \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "Paid invoices to the CRM", "project_id": "prj_…",
       "pipeline": {"version": 1, "steps": [
         {"filter": {"type": "invoice.paid"}, "note": "Paid invoices only"},
         {"drop": ["**.email"]},
         {"auth": {"type": "bearer", "secret": "sec_…"}}]}}'

curl -sX PATCH {{WEBHOOKS_BASE_URL}}/v1/endpoints/ep_3f9a… \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d '{"transformation_id": "trf_…"}'
```

Um script usa `code` no lugar de `pipeline`; enviar os dois, ou nenhum, é recusado. Para mudar o documento depois, envie `PATCH /v1/transformations/{id}` com um `pipeline` novo. Se a versão nova tiver uma etapa `auth` e houver endpoints que executam a transformação, o `PATCH` também precisa levar `confirm_destinations`: a URL de cada um desses endpoints, como `destinations` da transformação os lista, porque as credenciais vão para todos. `POST /v1/endpoints` também aceita `transformation_id`, `{"transformation_id": null}` desvincula a transformação, e uma transformação de outro projeto é recusada como não encontrada. Criar, alterar e testar transformações e segredos exige uma chave `admin`; uma chave `read` pode listá-los e lê-los. Uma pessoa, ao contrário de uma chave, também precisa da função de proprietário ou de admin para armazenar ou alterar um segredo, salvar um pipeline cuja etapa `auth` referencia um segredo ou vincular um pipeline assim a um endpoint.

## Um pipeline mantido no Transforms {#reference}

Uma transformação pode executar um pipeline mantido no [Transforms](/docs/product-transforms) em vez de ter o próprio. O tipo dela é `reference`, em todos os planos, e guardamos qual pipeline ela indica, não uma cópia. O pipeline continua sendo executado aqui, junto da entrega, e o Transforms não participa do envio. As execuções também contam aqui, em `transformation_runs`. Os [testes](#test), a [pausa](#versions), [o que uma entrega mostra](#deliveries) e a [contagem de falhas](#failures) funcionam como em qualquer pipeline.

O console não oferece esse tipo. Crie uma pela API, no projeto do endpoint, e depois [aponte o endpoint para ela](#set-up) com `transformation_id`:

```bash
curl -sX POST {{WEBHOOKS_BASE_URL}}/v1/transformations \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "Paid invoices to the CRM", "project_id": "prj_…",
       "pipeline_ref": {"id": "pipe_…", "secrets": {"sec_1f0a…": "sec_9c4e…"}}}'
```

| Campo de `pipeline_ref` | O que é |
|---|---|
| `id` | O `id` do pipeline no Transforms, que precisa ser deste workspace. |
| `version` | Uma versão para fixar. Sem ela, a referência segue a versão atual, e uma versão nova chega às entregas em até um minuto. |
| `secrets` | Até 20 pares: o id de um [slot](/docs/product-transforms#credentials) que o pipeline indica e, depois, o id de um [segredo](#credentials) deste projeto. Cada slot que a versão indica precisa de um, e um pipeline sem etapa `auth` não precisa de nenhum. |

O Transforms não guarda credenciais, então elas vêm desta associação: cada etapa `auth` é executada com o segredo deste projeto no lugar do slot dela. Uma referência que associa um segredo segue as regras de uma etapa `auth`: uma pessoa precisa da função de proprietário ou de admin para salvá-la, uma versão nova precisa indicar todos os endpoints em `confirm_destinations`, e o segredo não pode ser excluído enquanto a referência o associar. Um pipeline no Transforms é de todo o workspace, então escolher um exige uma chave ou um login que alcance todo o workspace. Uma chave ou um login limitado a certos projetos é recusado com `403` `project_confined`, mas ainda pode ler, renomear e vincular o que já está salvo.

Para mudar o pipeline, a versão ou os segredos, envie `PATCH /v1/transformations/{id}` com um `pipeline_ref` novo, que salva a próxima versão da transformação. Uma versão nova no Transforms não precisa de `PATCH`, a menos que a referência fixe uma. Para testar, envie `pipeline_ref` no lugar de `pipeline` para `POST /v1/transformations/test`: o teste executa o que a referência executa agora, com cada credencial mascarada, mesmo enquanto o pipeline está desativado no Transforms. Para uma entrega, `GET /v1/deliveries/{id}/transform` adiciona `pipeline_version`, a versão do pipeline que foi executada, ao lado de `version`, a da transformação.

Um evento nunca é enviado sem transformação. Quando o pipeline não pode ser executado:

| O que aconteceu | O que a entrega faz |
|---|---|
| O Transforms não pode ser alcançado | Uma versão já obtida continua sendo executada. Sem nada em que se basear, a entrega espera sem gastar uma tentativa e verifica de novo depois de um quarto do tempo que já esperou, no mínimo 5 minutos e no máximo uma hora. Ela aparece como `failed`, com um `last_error` começando com `paused:`. Depois de esperar 7 dias, ou um dia antes de a [retenção](/docs/product-webhooks/deliveries#retention) excluir o evento dela se isso vier antes, ela vai para a dead-letter queue com `pipeline_failed:` e o motivo da espera, sem contar para a transformação. |
| O pipeline está desativado no Transforms | Em até um minuto, com ou sem versão fixada na referência, as entregas esperam da mesma forma. Quando ele já está ativado de novo há um minuto, as que ainda estão esperando saem na próxima verificação. |
| O pipeline foi excluído | A entrega falha com `pipeline_failed: reference_missing: …` e vai para a dead-letter queue. |
| Uma versão mais recente indica um slot que a referência não associa | A entrega falha da mesma forma com `secret_missing`, que indica o slot. Associe-o com um `PATCH`. |
| Uma versão mais recente contém algo que recusamos, como um header que nós mesmos enviamos | A entrega falha da mesma forma, com o motivo, como `managed_header`. Salvar no Transforms não verifica nossas regras de headers. |

Cada falha conta para a transformação, como em qualquer pipeline ([Quando uma execução falha](#failures)). O Transforms lista `webhookd` entre os serviços que executam um pipeline, e uma nova versão com uma etapa `auth`, ou a exclusão do pipeline, precisa indicá-lo antes ([Quem executa um pipeline](/docs/product-transforms/reference#destinations)).

## O que uma entrega mostra {#deliveries}

Uma transformação roda uma vez por entrega, na primeira tentativa. O que ela produziu é armazenado com a entrega, e cada retentativa reenvia esse mesmo corpo, assinado de novo, com os headers do endpoint como estiverem naquela tentativa. As credenciais de um pipeline nunca são armazenadas: cada tentativa as adiciona de novo a partir do valor do segredo naquele momento. [Reenviar](/docs/product-webhooks/deliveries#replay) executa de novo a versão atual da transformação.

No console, abra uma entrega na página **Deliveries**. **Transformed by** mostra a transformação e a versão que rodou, e o resultado é um destes:

- **Transformed**: o tipo de conteúdo, o tamanho, os headers que ela definiu, os nomes das credenciais que adicionou e o corpo enviado.
- **Dropped**: um filtro descartou a entrega, ou o script retornou `null`, então nada foi enviado.
- **Failed**: por que a execução falhou. A entrega está na dead-letter queue.

Pela API, `GET /v1/deliveries/{id}/transform` retorna a execução, ou `null` quando nenhuma rodou: `transformation_id`, `version`, `status` (`ok`, `dropped` ou `failed`), `reason`, `error`, `body`, `content_type`, `header_names`, `credential_headers` e `credential_query` (nomes, nunca valores) e `duration_ms`. A execução de um script também traz `logs` e `fuel`.

### Entregas descartadas {#dropped}

Quando um filtro descarta uma entrega, ou um script retorna `null`, nada é enviado e nenhuma tentativa é feita. A entrega termina como `sent`, com `"dropped": true`, o console a mostra como **dropped**, e as estatísticas do endpoint e do workspace a contam separadamente das entregues: a taxa de sucesso é calculada sobre o que era para ser enviado. Um descarte não é uma falha, nem para o endpoint nem para a transformação. Uma entrega descartada também não conta para a [cota mensal de entregas](/docs/product-webhooks#objects): a cota conta cada entrega quando o evento dela é publicado, antes de qualquer filtro ou script ser executado, e deixa de contá-la quando ela é descartada. Por isso, com a cota esgotada, uma publicação continua sendo recusada, mesmo que um filtro fosse descartar todas as entregas dela.

## Quando uma execução falha {#failures}

Um pipeline que pôde ser salvo ainda pode falhar com um evento específico: um `set` que escreveria dentro de um valor que não é um objeto (`set_conflict`), um corpo ou um valor acima do [limite](#limits), um valor que um header não consegue carregar, ou credenciais cujo segredo não existe mais (`secret_missing`) ou não pode ser enviado (`invalid_secret`). O mesmo pipeline falha do mesmo jeito com o mesmo evento, então a entrega vai direto para a dead-letter queue, sem ser enviada, com um `last_error` como `pipeline_failed: step 2: set_conflict: …`.

Um script falha quando lança uma exceção, fica sem tempo ou sem memória, entra em recursão profunda demais ou retorna algo que não é uma requisição (um objeto com um `body`, ou `null`). A entrega dele vai para a dead-letter queue com um `last_error` começando com `transform_failed:`.

Nunca enviamos o evento sem transformação no lugar dela: o receptor pode ser um terceiro, e a transformação pode existir justamente para que certos dados não cheguem até ele.

Cada execução com falha conta para a transformação, assim como as entregas com falha contam para um endpoint, e uma execução que envia ou descarta encerra a sequência. Depois de 20 falhas seguidas, a transformação é desligada (**turned off after failures** no console, `auto_disabled` na API), as entregas dos endpoints dela ficam esperando, e nós enviamos um e-mail ao proprietário do workspace e um [webhook operacional](/docs/product-webhooks/deliveries#operational) `transformation.disabled`. Corrija a transformação, teste-a e retome-a com **Resume**, ou envie `PATCH /v1/transformations/{id}` com `{"status": "enabled"}`: as entregas que estavam esperando são enviadas, e as que foram para a dead-letter queue podem ser [reenviadas](/docs/product-webhooks/deliveries#replay).

## Limites {#limits}

Um pipeline não tem loops, relógio nem E/S, então o mesmo pipeline sempre faz a mesma coisa com o mesmo evento, e limites fixos restringem cada execução:

| Pipeline | Limite |
|---|---|
| Etapas | 20 |
| Caminhos em um `drop`, campos em um `set`, nomes em cada parte de uma etapa `headers` | 50 |
| As configurações de uma etapa, como JSON compacto | 16 KiB |
| A nota de uma etapa | 200 caracteres |
| Aninhamento, em uma etapa e em um corpo | 32 níveis |
| O corpo que uma etapa lê e o corpo enviado | 256 KiB |
| Um valor gerado por uma etapa | 64 KiB |
| Trabalho em uma execução | 100.000 valores lidos ou copiados; texto conta um por KiB |
| Headers no fim de uma execução | 50 |
| Um valor de header | 8 KiB |
| O valor de um segredo | 4.096 caracteres de ASCII imprimível, sem espaço no início nem no fim |

| Script | Limite |
|---|---|
| CPU | Cerca de 50 ms de tempo de script, contados em instruções em vez de medidos, então o mesmo script tem o mesmo orçamento por mais ocupados que estejamos |
| Tempo de relógio | 1 segundo |
| Memória | 64 MiB |
| Tamanho do script | 1 MiB |
| Saída | 256 KiB |
| Logs | 4 KiB |
| Scripts rodando ao mesmo tempo, por workspace | 2 no Starter, 4 no Pro; no Custom, os do plano em que o contrato se baseia |

## Erros {#errors}

Um pipeline que nunca conseguiria rodar é recusado ao ser salvo ou testado, com `422 invalid_pipeline`. A recusa indica o primeiro problema: `details.reason`, `details.path` (um JSON Pointer até ele) e `details.step` (contado a partir de 0), cada um quando se aplica.

```json
{ "error": { "code": "invalid_pipeline", "message": "…", "details": { "reason": "managed_header", "path": "/steps/0/headers/set/User-Agent", "step": 0 }, "request_id": "…" } }
```

| `reason` | O que está errado |
|---|---|
| `invalid_document` | Não é um objeto com uma `version` e uma lista de `steps`. |
| `unsupported_version` | `version` não é `1`. |
| `no_steps` | Não há etapas. |
| `too_many_steps` | Há mais de 20 etapas. |
| `invalid_step` | Uma etapa não é um objeto com uma única chave de etapa, sem nada ao lado além de uma `note` e, em um filtro, uma `action`. |
| `unknown_step` | Uma chave de etapa não é `filter`, `drop`, `set`, `map`, `headers` nem `auth`. |
| `invalid_value` | Uma configuração não é uma das que a etapa aceita, como um `drop` vazio ou uma nota com mais de 200 caracteres. |
| `invalid_path` | Um caminho não pode ser lido, ou tem um curinga onde a etapa não aceita nenhum. |
| `invalid_template` | Uma expressão não pode ser lida, ou indica um filtro que não existe. |
| `invalid_filter` | Um filtro não é válido, por exemplo porque usa um operador desconhecido. |
| `invalid_header` | Um nome de header não é válido ou pertence à conexão, ou um valor não é ASCII imprimível em uma só linha. |
| `invalid_secret` | O `secret` de uma etapa `auth` não é o id de um segredo. Um valor colado ali nunca é repetido em uma mensagem. |
| `auth_not_last` | Há uma etapa depois de uma etapa `auth`. |
| `too_deep` | Algo está aninhado em mais de 32 níveis. |
| `too_large` | As configurações de uma etapa passam de 16 KiB. |
| `not_json` | O documento contém um valor que não é JSON. |
| `managed_header` | Uma etapa define um header que nós mesmos enviamos: `X-Webhook-*` ou `User-Agent`. |
| `forbidden_header` | Uma etapa define um header hop-by-hop ou de controle, como `Expect`. |
| `unknown_secret` | Uma etapa `auth`, ou os `secrets` de uma referência, indicam um segredo que o projeto não tem. |
| `unknown_pipeline` | Uma [referência](#reference) indica um pipeline que este workspace não tem no Transforms. |
| `unknown_pipeline_version` | Uma referência fixa uma versão que o Transforms não tem. |
| `unbound_secret` | A versão que uma referência executa indica um slot que os `secrets` dela não associam. |

As outras recusas:

| Status | Código | Quando |
|---|---|---|
| `422` | `validation_error` | Uma transformação enviada com mais de um entre `code`, `pipeline` e `pipeline_ref` ou sem nenhum, ou um `PATCH` com o campo de outro tipo. |
| `402` | `not_entitled` (`feature: transformations`) | Criar um script, salvar código novo, retomar um script ou testar um em um plano sem scripts. |
| `422` | `invalid_transformation` | Um script que não carrega: `syntax_error`, `no_transform`, `code_too_large` ou `load_failed`. |
| `409` | `conflict` (`transformation_in_use`) | Excluir uma transformação que um endpoint ainda executa. Desvincule-a antes. |
| `409` | `conflict` (`secret_in_use`) | Excluir um segredo que a versão atual de um pipeline usa. Altere o pipeline antes. |
| `409` | `conflict` (`destinations_unconfirmed`) | Um `PATCH` que salva uma etapa `auth` sem indicar em `confirm_destinations` todos os endpoints que executam a transformação. `details.destinations` lista as URLs deles, e nada é salvo. |
| `403` | `forbidden` (`role`) | Um membro que armazena ou altera um segredo, salva um pipeline cuja etapa `auth` referencia um segredo ou vincula um pipeline assim a um endpoint. |
| `403` | `forbidden` (`project_confined`) | Uma chave ou um login limitado a certos projetos que escolhe ou testa um pipeline do Transforms. |
| `404` | `not_found` (`transformation`, `transformation_version`, `secret`) | Não existe, essa versão já não é mantida, ou um endpoint indica uma transformação de outro projeto. |
| `429` | `rate_limited` | Acima de 60 salvamentos e testes de scripts por minuto por workspace. |
| `503` | `unavailable` (`transform`) | O sandbox não conseguiu executar o script naquele momento. Nada foi salvo; tente de novo. |
| `503` | `unavailable` (`transforms`) | Não foi possível consultar o Transforms sobre o pipeline de uma referência. Nada foi salvo; tente de novo. |

## Próximos passos {#next-steps}

- [Slack, Teams e Discord](/docs/product-webhooks/chat-apps) — obtenha a URL de webhook de um canal e envie eventos para ele.
- [Entregas e retentativas](/docs/product-webhooks/deliveries) — estados, retentativas e como reenviar.
- [Verificação de endpoint](/docs/product-webhooks/endpoint-verification) — o desafio, e os receptores que não conseguem respondê-lo.
- [Transforms](/docs/product-transforms) — crie, versione e teste pipelines em um só lugar e execute-os aqui por referência.
- [API de Webhooks](/docs/reference/webhooks) — todas as rotas, entre elas `/v1/transformations` e `/v1/secrets`.
- [Visão geral de Webhooks](/docs/product-webhooks) — eventos, endpoints e inscrições.
