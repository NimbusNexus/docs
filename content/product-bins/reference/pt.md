---
title: "Referência de Request Bins"
description: "Todas as rotas da API de Request Bins, o que a URL de um bin responde e registra, quem pode fazer o quê e os limites de cada plano."
publishedAt: 2026-10-22
updatedAt: 2026-10-30
kind: reference
---

# Referência de Request Bins

O Request Bins tem dois lados. As **URLs de bin**, em `nnbin.net`, recebem requisições de qualquer pessoa e as registram. **A API**, em `https://bins.nimbusnexus.net/v1`, cria e gerencia bins e lê o que eles registraram, apenas para o seu workspace. Esta página cobre os dois lados e, depois, quem pode fazer o quê e os limites de cada plano. A [visão geral](/docs/product-bins) explica o produto, e o [início rápido](/docs/product-bins/quickstart) mostra o passo a passo.

## URLs de bin {#edge}

| | |
| --- | --- |
| URL | `https://nnbin.net/b/<slug>`, e qualquer caminho sob ela: `https://nnbin.net/b/<slug>/<anything>` |
| Slug | 12 caracteres: as letras `a`–`z`, exceto `l` e `o`, e os dígitos `2`–`9`. Maiúsculas e minúsculas não fazem diferença. |
| Métodos | Qualquer um: `GET`, `POST` e os outros comuns, o `PROPFIND` ou o `COPY` do WebDAV, ou um método próprio do remetente. O método é registrado em maiúsculas, cortado em 16 caracteres. `TRACE` e `CONNECT` são recusados antes de chegar ao bin e nunca são registrados. |
| Caminho registrado | Tudo o que vem depois do slug, como foi enviado, com o percent-encoding preservado: `/b/<slug>/stripe/events` registra `/stripe/events`, e `/b/<slug>` registra `/`. |
| Query registrada | A query string como foi enviada, sem o `?`. |

### O que a URL de um bin responde {#edge-answers}

| Status | Corpo | Quando |
| --- | --- | --- |
| `200` | `{"status":"accepted"}` | Toda requisição para um slug bem formado, registrada ou não, a menos que uma das linhas abaixo se aplique. Um bin que não existe, foi excluído, expirou, está desativado ou suspenso, ou passou das requisições mensais do plano responde da mesma forma. |
| `429` | `{"status":"rate_limited"}`, com `Retry-After: 30` | O endereço de envio passou de 120 requisições por minuto para URLs de bin, ou o bin passou de 600 por minuto somando todos os seus remetentes. Verificado antes de o corpo ser lido; nada é registrado nem contado. |
| `503` | `{"status":"unavailable"}`, com `Retry-After: 30` | A requisição não pôde ser armazenada naquele momento. Nada é registrado; envie-a de novo. |
| `404` | nenhum | O slug não pode ser um que o Request Bins tenha emitido: ele tem o tamanho errado ou um caractere fora do alfabeto de slugs. |

O `200` é o mesmo para todos os resultados, de propósito. Um remetente que recebe um erro pode parar de enviar ou desativar o próprio webhook, e uma resposta diferente para um bin ativo deixaria qualquer pessoa sondar quais bins existem. Se uma requisição foi registrada ou não é algo que o proprietário do bin lê na API ou no console, nunca o remetente.

Um `200` traz um header `X-Request-ID`, e o `request_id` da requisição capturada guarda o mesmo valor, para que uma linha de log do remetente possa ser associada ao que o bin registrou.

### O que um bin registra {#edge-records}

- **Corpo:** um corpo de qualquer tamanho é aceito. O tamanho completo dele é contado em `size_bytes`, e o primeiro 1 MiB dele é armazenado, então um corpo de até 1 MiB é armazenado inteiro. `truncated` é `true` quando o corpo tinha mais de 1 MiB, e o corpo armazenado é então menor que `size_bytes`. O corpo é armazenado como os bytes que chegaram, nunca interpretado nem alterado.
- **Headers:** na ordem de chegada, com duplicatas mantidas, até 256 deles; um nome é cortado em 256 caracteres e um valor em 8.192. Os valores de `Authorization`, `Proxy-Authorization`, `Cookie`, `Set-Cookie` e `X-API-Key` são substituídos por `[redacted]` antes que qualquer coisa seja armazenada. Todos os outros headers são mantidos como foram enviados.
- **Caminho:** cortado em 2.048 caracteres.
- **Tipo de conteúdo:** o header `Content-Type`, como `content_type`.
- **Endereço de origem:** o endereço que enviou a requisição, como `source_ip`.

### Toda requisição é uma linha {#edge-repeats}

Toda requisição é armazenada como uma linha própria. Uma requisição enviada de novo, ainda que com o mesmo método, caminho, query string e corpo de uma que o bin já guarda, é uma nova linha, com os seus próprios headers, endereço de origem, horário e `request_id`, e conta para as requisições do mês como qualquer outra. Assim, as retentativas de um provedor aparecem uma a uma, cada uma com a sua própria assinatura e o seu próprio timestamp. `seen_count` é `1` em toda nova linha. Uma requisição armazenada antes de 25 de outubro de 2026 pode ser diferente até que a retenção a exclua: o corpo dela pode ter sido cortado em 64 KiB, e o `seen_count` dela pode contar todas as vezes que a mesma requisição chegou.

### Quando nada é registrado {#edge-refusals}

O remetente recebe `200` em todos os casos abaixo. O que o bin mostra:

| O bin | O que o bin mostra |
| --- | --- |
| não existe, foi excluído ou expirou | — |
| está desativado (`status` `disabled`) | — |
| está suspenso | — |
| pertence a um workspace suspenso por uma cobrança não paga | `refused_count` aumenta; `last_refused_reason` é `workspace_suspended` |
| passou das requisições do mês, ou da sua própria parcela delas | `refused_count` aumenta; `last_refused_reason` é `quota_exceeded` |

`last_refused_summary` mostra a última requisição recusada como `METHOD /path`, e `last_refused_at`, quando ela chegou. As requisições recusadas não contam para o mês.

### Suspensão {#suspension}

Duas barreiras suspendem um bin cujo tráfego parece coleta de dados de desconhecidos, e não de alguns poucos remetentes conhecidos:

- **Remetentes distintos:** um bin recebeu requisições de mais endereços distintos do que o plano permite: 50 no Free, 200 no Starter, 500 no Pro e 2.000 no Custom.
- **Envios de formulário de navegador:** uma requisição com um header de navegador (`Origin`, `Referer`, `Sec-Fetch-Site` ou `Sec-Fetch-Mode`) e um tipo de conteúdo de formulário (`application/x-www-form-urlencoded` ou `multipart/form-data`) é um envio de formulário de navegador. Um bin que recebe mais deles do que o plano permite (3 no Free, 5 no Starter e no Pro, 10 no Custom), vindos de pelo menos três endereços, é suspenso. `browser_post_count`, `last_browser_form_origin` e `last_browser_form_at` mostram o que ele já recebeu.

A requisição que aciona uma barreira é registrada, e as seguintes não. Um bin suspenso responde `200` e não registra nada, qualquer que seja o `status` dele. `suspended_code` informa o motivo:

| `suspended_code` | Por quê | Remoção |
| --- | --- | --- |
| `source_fanout` | A barreira de remetentes distintos | Pela NimbusNexus; fale com o suporte |
| `browser_posts` | A barreira de formulários de navegador | Pela NimbusNexus; fale com o suporte |
| `abuse` | A NimbusNexus suspendeu o bin após uma denúncia | Pela NimbusNexus |
| `non_payment` | O workspace está suspenso por uma cobrança não paga | Quando a cobrança é quitada |
| `plan_downgrade` | O plano permite menos bins do que o workspace tem, e este é um dos mais novos | Quando o plano voltar a permitir, a começar pelos bins mais antigos |

Trate `suspended_code` como uma string aberta e mantenha um caso padrão para um valor que você não conhece; `suspended_reason` diz o mesmo por extenso. Um bin pode estar suspenso por várias causas ao mesmo tempo, e cada uma é removida separadamente: quitar uma cobrança nunca remove uma suspensão por abuso, e remover uma suspensão nunca traz de volta um bin que o plano não permite mais.

Para denunciar a URL de um bin que esteja sendo usada de forma abusiva, escreva para `abuse@nnbin.net` com a URL completa. A página em `https://nnbin.net/` diz o mesmo.

### Navegadores {#edge-browsers}

As URLs de bin não enviam headers CORS. Uma página web pode enviar a um bin uma requisição simples, como um envio de formulário, mas não pode ler a resposta, e uma requisição que precisa de preflight para no `OPTIONS` dela, que é o que o bin registra. O `robots.txt` pede aos mecanismos de busca que não rastreiem URLs de bin.

## A API {#api}

A URL base é `https://bins.nimbusnexus.net/v1`. Requisições e respostas são JSON. Envie uma chave como `Authorization: Bearer <key>` ou `X-API-Key: <key>` ([Como obter acesso](/docs/product-bins#access)). Os timestamps são ISO 8601 em UTC, e um timestamp que você envia sem offset é interpretado como UTC. Os erros usam o formato descrito em [Erros](/docs/errors).

| Rota | O que faz | Exige |
| --- | --- | --- |
| `POST /v1/bins` | Cria um bin; `201` com [o bin](#bin) | write |
| `GET /v1/bins` | Os bins do workspace, do mais novo para o mais antigo; `url` ou `slug` encontra um | read |
| `GET /v1/bins/{id}` | Um bin | read |
| `PATCH /v1/bins/{id}` | Renomeia um bin, o desativa e ativa, ou define a [URL de encaminhamento](#forwarding) dele | write |
| `POST /v1/bins/{id}/forward-test` | Envia um [teste](#forward-test) para a URL de encaminhamento do bin e retorna o que ela respondeu | write |
| `DELETE /v1/bins/{id}` | Exclui um bin; `204` | admin |
| `GET /v1/bins/{id}/requests` | As [requisições capturadas](#requests) de um bin, da mais nova para a mais antiga | read; com uma chave, um plano pago |
| `GET /v1/requests` | As [requisições capturadas](#all-requests) de todos os bins em uma única lista, da mais nova para a mais antiga | read; com uma chave, um plano pago |
| `GET /v1/bins/{id}/paths` | As requisições de um bin [agrupadas por caminho](#paths) | read; com uma chave, um plano pago |
| `GET /v1/requests/{id}` | Uma requisição capturada completa, com os [encaminhamentos](#forwards) dela | read; com uma chave, um plano pago |
| `DELETE /v1/bins/{id}/requests` | Esvazia um bin; `200` com `{"deleted": <count>}` | admin |
| `GET /v1/plan` | O plano do workspace e os limites dele | read |
| `GET /v1/usage` | As requisições deste mês e os bins existentes, em relação ao plano | read |

**read**, **write** e **admin** são explicados em [Quem pode fazer o quê](#authority).

### Criar um bin {#create}

`POST /v1/bins` recebe um corpo JSON, `{}` quando você não define nada:

| Campo | Descrição |
| --- | --- |
| `label` | O nome que você dá ao bin, com até 200 caracteres. Os remetentes nunca o veem. |
| `expires_in_minutes` | Quanto tempo o bin vive: de 1 a 525.600 (um ano). Sem ele, vale o padrão do plano: 24 horas no Free, até ser excluído nos planos pagos. Um tempo de vida maior do que o plano permite é reduzido ao máximo, e não recusado: 24 horas no Free, 7 dias no Starter, 30 dias no Pro e um ano no Custom. O `expires_at` da resposta mostra o resultado. |

O tempo de vida de um bin não pode ser alterado depois que ele é criado. Quando o workspace já tem todos os bins do plano, a resposta é `402` `quota_exceeded`, com `details.metric` `bins`, `details.limit` e `details.current`. Os bins em espera por causa de um downgrade de plano não contam.

### Encontrar um bin {#list}

`GET /v1/bins` lista os bins do workspace, do mais novo para o mais antigo. Com `url` (a URL de um bin, com ou sem um caminho depois do slug) ou `slug` (sem diferenciar maiúsculas de minúsculas), retorna esse único bin, ou uma lista vazia. Bins excluídos e expirados nunca aparecem na lista, e a leitura de um deles responde `404`.

As listas são paginadas com `limit` (de 1 a 200, padrão 50) e `offset` (de 0 a 10.000). A resposta é `{"items": [...], "next_offset": <offset>}`: passe `next_offset` de volta como `offset` para obter a próxima página. Ele é `null` na última página e além do offset 10.000.

### O objeto bin {#bin}

| Campo | Descrição |
| --- | --- |
| `id` | `bin_` e 24 caracteres hexadecimais. Toda rota o recebe. |
| `slug` | A parte da URL depois de `/b/`. |
| `url` | A URL a ser passada aos remetentes. |
| `label` | O nome que você deu a ele. |
| `status` | `enabled` ou `disabled`: o seu interruptor. Um bin desativado responde aos remetentes e não registra nada. |
| `expires_at` | Quando o bin termina, ou `null` se ele vive até ser excluído. |
| `created_at` | Quando ele foi criado. |
| `suspended` | `true` enquanto a NimbusNexus mantém o bin desligado ([Suspensão](#suspension)). |
| `suspended_code`, `suspended_reason` | O motivo, como código e por extenso; vazios quando o bin não está suspenso. |
| `refused_count` | Requisições respondidas e não registradas porque o workspace tinha passado das suas requisições ou estava suspenso. |
| `last_refused_summary`, `last_refused_reason`, `last_refused_at` | A última delas, como `METHOD /path`; `quota_exceeded` ou `workspace_suspended`; e quando ela chegou. |
| `browser_post_count` | Os envios de formulário de navegador que o bin recebeu. |
| `last_browser_form_origin`, `last_browser_form_at` | A página que enviou o último, e quando. |
| `request_count` | As requisições registradas desde que o bin foi criado ou esvaziado pela última vez. |
| `last_request_at` | Quando a última chegou, ou `null`. |
| `period_requests` | As requisições deste mês contadas para o bin, em relação ao `bin_request_ceiling` de [`GET /v1/usage`](#plan). |
| `forward_url` | Para onde o bin [encaminha](#forwarding) cada requisição que registra, ou `null` quando ele não encaminha. |
| `forward_paused_at`, `forward_paused_reason` | Quando o encaminhamento foi [pausado](/docs/product-bins/forwarding#paused) depois de envios que falharam, e por quê: `failed_in_a_row` ou `failing_for_an_hour`. `null` e vazio enquanto ele não está pausado. |
| `forward_last_error`, `forward_last_error_at` | O último envio que falhou: o que deu errado, como `HTTP 503` ou um timeout, nunca o que a requisição continha; e quando. |

### Alterar ou excluir um bin {#change}

`PATCH /v1/bins/{id}` recebe `label`, `status` (`enabled` ou `disabled`), `forward_url` ([Encaminhamento](#forwarding)) ou qualquer um deles, e responde com o bin. Desativar interrompe o registro e mantém o que o bin guarda. Um bin desativado continua contando para os bins do plano.

`status` era `active` onde agora é `enabled`, e nenhuma resposta diz mais `active`. `PATCH` ainda aceita `"status": "active"`, e o bin volta como `enabled`, mas essa grafia está descontinuada e será recusada a partir de uma data ainda a ser anunciada, então envie `enabled`.

No console, o menu ⋯ na página de um bin traz **Rename…**, **Disable** ou **Enable**, **Empty bin…** e **Delete bin…**, e o encaminhamento é definido no card **Forwarding** dessa página. A página de um bin desativado indica isso, com um botão **Enable**.

`DELETE /v1/bins/{id}` exclui um bin para sempre. A URL dele para de registrar na hora, embora os remetentes continuem recebendo `200`; o slug dele nunca mais é emitido, nem para você nem para ninguém; e o que ele registrou é excluído pouco depois. A vaga dele entre os bins do plano é liberada na hora.

`DELETE /v1/bins/{id}/requests` esvazia um bin: toda requisição que ele guarda é excluída e `request_count` volta a `0`. O bin mantém a URL e continua registrando.

### Requisições capturadas {#requests}

`GET /v1/bins/{id}/requests` lista as requisições de um bin, da mais nova para a mais antiga, e `GET /v1/requests` lista as [requisições de todos os bins](#all-requests) em uma única lista. As duas rotas recebem estes parâmetros:

| Parâmetro | Descrição |
| --- | --- |
| `since` | Só as requisições recebidas depois deste instante. Passe o `received_at` mais recente que você já viu para fazer polling de novas requisições. |
| `until` | Só as requisições recebidas neste instante ou antes dele: o caminho para voltar pelas mais antigas. |
| `method` | Só as requisições enviadas com este método, sem diferenciar maiúsculas de minúsculas. Repita-o para aceitar qualquer um de vários: `?method=PUT&method=DELETE`. |
| `path` | Só as requisições enviadas exatamente para este caminho: o que veio depois do slug, com a `/` inicial, sem a query string, como a lista o mostra. Maiúsculas e minúsculas fazem diferença. [Requisições por caminho](#paths) lista os caminhos de um bin. |
| `q` | Só as requisições que contêm este texto, com até 200 caracteres, sem diferenciar maiúsculas de minúsculas: no caminho e na query string como foram enviados (`/orders?id=42`), em um header como `name: value`, ou no corpo armazenado. Um corpo que não é texto UTF-8 é pesquisado com cada byte acima de 127 (e o NUL) escrito como `\` seguido de três dígitos octais, e com cada barra invertida duplicada. |
| `in` | Onde `q` procura: `all`, o padrão, ou só `path` (o caminho e a query string), `headers` (cada um como `name: value`) ou `body`. |
| `header` | Só os valores deste header, sem diferenciar maiúsculas de minúsculas no nome, e qualquer um deles quando ele foi enviado mais de uma vez. Sem `q`, toda requisição que traz o header. Ele combina com `in` `all` ou `headers`. |
| `field` | Só este campo de um corpo JSON, indicado como `data.object.id` ou `items[0].sku`: uma string é pesquisada como ela mesma, um número como o JSON o escreve, um objeto ou array como texto JSON. Sem `q`, toda requisição cujo corpo tem o campo. Um corpo que não é JSON, ou que foi cortado em 1 MiB, não tem campos. Ele combina com `in` `all` ou `body`, e não com `header`. |
| `limit`, `offset` | Paginação, como nos bins. Além do offset 10.000, restrinja a janela com `until` em vez disso. |

Um `header` ou um `field` com outro `in`, ou um `header` junto com um `field`, é recusado com um `422` `validation_error` cuja entrada tem o tipo `bins.search_conflict`.

Uma busca (`q`, `header` ou `field`) é paginada de forma diferente das outras listagens. Ela lê as requisições da lista da mais nova para a mais antiga e para quando tem `limit` correspondências ou quando já leu 16 MiB de requisições (ou 5.000 delas), o que vier primeiro, então uma página pode ter menos correspondências que `limit`, ou nenhuma, enquanto ainda há requisições mais antigas não lidas. A página de uma busca tem `next_offset` `null` e, enquanto a busca não tiver lido a requisição mais antiga da lista, um `next_until`: passe-o de volta como `until`, com a mesma busca e os mesmos `method`, `path` e `since`, para continuar a busca de onde ela parou. Com uma busca, `offset` pula essa quantidade de requisições antes de a busca começar a ler.

```json
{
  "items": [],
  "next_offset": null,
  "next_until": "2026-10-23T14:02:11.408211+00:00"
}
```

Cada item:

| Campo | Descrição |
| --- | --- |
| `id` | `req_` e 24 caracteres hexadecimais. |
| `bin_id` | O bin para o qual ela veio. |
| `method` | O método HTTP. |
| `path` | O que veio depois do slug, como foi enviado; `/` para a URL do bin sem nada depois. |
| `query` | A query string como foi enviada, sem o `?`; vazia quando não havia nenhuma. |
| `source_ip` | O endereço de origem. |
| `content_type` | O header `Content-Type` dela, ou vazio. |
| `size_bytes` | O tamanho completo do corpo, como foi enviado. |
| `truncated` | `true` quando o corpo tinha mais de 1 MiB, e por isso só o primeiro 1 MiB dele está armazenado. |
| `seen_count` | `1`: toda requisição é uma [linha própria](#edge-repeats). |
| `received_at` | Quando ela chegou. |
| `expires_at` | Quando ela será excluída: a retenção do plano depois de `received_at`, ou o próprio `expires_at` do bin, se este vier antes. |

`GET /v1/requests/{id}` retorna uma requisição com todos os campos acima e mais:

| Campo | Descrição |
| --- | --- |
| `headers` | Objetos com um `name` e um `value`, na ordem de chegada, com duplicatas mantidas e credenciais como `[redacted]`. |
| `body_base64` | O corpo armazenado, codificado em base64 porque ele não precisa ser texto: no máximo 1 MiB. |
| `request_id` | O id que a URL do bin atribuiu a esta requisição, que é o `X-Request-ID` que o remetente dela recebeu de volta. |
| `forwards` | O que aconteceu com o [encaminhamento](#forwards) dela, do mais novo para o mais antigo; vazio quando o bin dela não estava encaminhando no momento em que ela chegou. |

Com uma chave de API, `GET /v1/bins/{id}/requests`, `GET /v1/requests` e `GET /v1/requests/{id}` exigem um plano pago: no Free, elas respondem `402` `not_entitled`, com `details.feature` `read_api`. O console as lê em todos os planos. Uma requisição depois do seu `expires_at`, ou em um bin que foi esvaziado, excluído ou expirou, responde `404`.

### As requisições de todos os bins {#all-requests}

`GET /v1/requests` lista as requisições de todos os bins do workspace em uma única lista, da mais nova para a mais antiga. Ela recebe os parâmetros da lista de um bin descritos acima e é paginada da mesma forma: por `next_offset`, ou por `next_until` em uma busca. Os itens dela são os itens da lista de um bin, cada um com o `bin_id` do bin para o qual veio; para mostrar o rótulo ou a URL de um bin ao lado de cada um, cruze o `bin_id` com `GET /v1/bins`.

Ela traz as requisições dos bins que ainda existem. As requisições de um bin excluído ou expirado saem dela na hora, e as de um bin desativado ou suspenso continuam nela, como continuam na lista do próprio bin. A página **All bins** do console mostra essa lista, com os mesmos filtros de busca e de método da página de um bin e sem **By path**.

### Requisições por caminho {#paths}

`GET /v1/bins/{id}/paths` agrupa por caminho as 10.000 requisições mais recentes de um bin, começando pelo caminho usado mais recentemente. A query string fica de fora, então `/orders?id=1` e `/orders?id=2` são um só caminho, enquanto os caminhos são comparados como foram enviados, então `/users/1` e `/users/2` são dois. `method` mantém só esses métodos, como na lista de requisições, e `limit` e `offset` paginam como nos bins.

```json
{
  "items": [
    {
      "path": "/stripe/events",
      "requests": 42,
      "methods": ["POST", "GET"],
      "last_received_at": "2026-10-26T09:12:04Z"
    }
  ],
  "next_offset": null,
  "counted": 57,
  "capped": false
}
```

| Campo | Descrição |
| --- | --- |
| `path` | O que veio depois do slug, sem a query string. |
| `requests` | Quantas das requisições contadas foram enviadas para ele. |
| `methods` | Os métodos com que elas foram enviadas, do mais usado para o menos usado. |
| `last_received_at` | Quando a última delas chegou. |

`counted` informa quantas requisições foram agrupadas, e `capped` é `true` quando o bin guarda mais do que isso, e por isso faltam caminhos e contagens mais antigos. Contar só as 10.000 mais recentes mantém uma chamada tão rápida em um bin com milhões de requisições quanto em um bin com dez. Para listar as requisições de um caminho, passe-o como `path` para `GET /v1/bins/{id}/requests`. Com uma chave de API, a rota exige um plano pago, como as rotas de requisições.

No console, **By path**, acima da lista de um bin, mostra os mesmos grupos, atualizados a cada 10 segundos, com os chips de método aplicados. Escolher um caminho lista as requisições dele, com o caminho mostrado como um chip acima da lista; remover o chip lista de novo todas as requisições.

### Encaminhamento {#forwarding}

Um bin no Starter, no Pro ou no Custom pode repassar cada requisição que registra para uma URL https sua. [Encaminhamento](/docs/product-bins/forwarding) cobre o que é enviado, as retentativas, os limites e quando o encaminhamento é pausado; esta seção cobre a API.

`PATCH /v1/bins/{id}` com `forward_url` define a URL, e `null` ou `""` interrompe o encaminhamento. Definir uma URL de novo, mesmo que seja a mesma, retoma um bin cujo encaminhamento foi [pausado](/docs/product-bins/forwarding#paused) e reinicia a contagem de envios que falharam. No Free, a resposta é `402` `not_entitled`, com `details.feature` `forwarding`. Uma URL para a qual um bin não encaminha é um `422` `validation_error` cuja entrada tem o tipo `bins.forward_target`, o `loc` `["body", "forward_url"]` e um `params.reason`:

| `reason` | Por quê |
| --- | --- |
| `scheme` | Ela não é `https`. |
| `credentials` | Ela traz um nome de usuário ou uma senha. |
| `host` | Ela não tem host, ou o host dela não é um nome válido. |
| `port` | A porta dela não está entre 1 e 65535. |
| `length` | Ela tem mais de 2.048 caracteres. |
| `own_domain` | O host dela é `nnbin.net`, `nimbusnexus.net` ou um nome sob eles, ou resolve para um dos nossos próprios endereços. |
| `not_public` | O host dela não resolve, ou resolve para um endereço que não é público, como um endereço privado, de loopback ou link-local. |
| `missing` | Um envio de teste para um bin sem URL de encaminhamento. |

Trate `reason`, `forward_paused_reason` e o `reason` de um encaminhamento como strings abertas e mantenha um caso padrão para um valor que você não conhece.

Quando o encaminhamento é pausado, o workspace é avisado uma vez, por e-mail e por um webhook com o tipo de evento `bind.forwarding.paused`; [Quando o encaminhamento é pausado](/docs/product-bins/forwarding#paused) mostra o corpo do webhook.

### Testar uma URL de encaminhamento {#forward-test}

`POST /v1/bins/{id}/forward-test` não recebe corpo. Envia na hora um evento de teste para a URL de encaminhamento do bin e responde `200` com o que voltou ([Verificar a URL antes](/docs/product-bins/forwarding#test) mostra o evento):

| Campo | Descrição |
| --- | --- |
| `ok` | `true` quando o seu servidor respondeu `2xx` ou `3xx`. |
| `answer` | O que ele respondeu: `status`; `headers`, objetos com um `name` e um `value`, na ordem em que foram enviados; os primeiros 8 KiB do corpo, como `body_base64`; e `truncated`, `true` quando o corpo ia além disso. `null` quando nenhuma resposta veio. |
| `duration_ms` | Quanto tempo o envio levou. |
| `error` | Por que nenhuma resposta veio, como um timeout ou uma conexão recusada; vazio quando uma resposta veio. |

A chamada espera até 13 segundos pela resposta, e um servidor mais lento que isso resulta em `ok` `false`, com um `error` que informa isso. Um bin pode enviar 10 testes por minuto: acima disso, a resposta é `429` `rate_limited`, e `details.retry_after` diz quantos segundos faltam até o próximo ser permitido. `503` `unavailable`, com `details.reason` `forwarder_unavailable`, significa que o teste não foi pego para envio em até 3 segundos, então nada foi enviado: tente de novo em instantes. Uma URL que se revela não pública no momento do envio é recusada com o `422` acima.

### Os encaminhamentos de uma requisição {#forwards}

`GET /v1/requests/{id}` traz `forwards`: o que aconteceu com o encaminhamento da requisição, do mais novo para o mais antigo, e vazio quando o bin dela não estava encaminhando no momento em que ela chegou. [Ver o que aconteceu](/docs/product-bins/forwarding#forwards) mostra um deles por completo. Cada item:

| Campo | Descrição |
| --- | --- |
| `id` | `fwd_` e 24 caracteres hexadecimais. |
| `state` | A situação dele, conforme a tabela abaixo. |
| `reason` | Por que a requisição não foi encaminhada, quando `state` é `not_forwarded`; vazio nos outros casos. |
| `url` | Para onde ele vai: a URL de encaminhamento como era quando a requisição chegou, com o caminho e a query da requisição acrescentados. |
| `attempts`, `max_attempts` | As tentativas feitas até agora, e o máximo que o plano permitia quando ele entrou na fila. |
| `next_attempt_at` | Quando a próxima tentativa está prevista, enquanto `state` é `retrying`; nos outros casos, `null`. |
| `last_error` | O que deu errado na última tentativa, como `HTTP 503` ou um timeout, ou por que ele está esperando; vazio depois que ele é enviado. |
| `answer` | O que o seu servidor respondeu na última tentativa, no mesmo formato de um [teste](#forward-test). `null` quando essa tentativa não teve resposta. |
| `duration_ms` | Quanto tempo a última tentativa levou; `null` antes da primeira. |
| `created_at` | Quando ele entrou na fila. |
| `sent_at` | Quando ele foi enviado; `null` até lá. |

| `state` | O que significa |
| --- | --- |
| `queued` | Esperando a primeira tentativa. |
| `sending` | Uma tentativa está em andamento. |
| `sent` | O seu servidor respondeu `2xx` ou `3xx`. |
| `retrying` | Uma tentativa falhou, e outra está prevista para `next_attempt_at`. |
| `failed` | Abandonado: as tentativas do plano se esgotaram, ou uma tentativa terminou de uma forma que não leva a uma nova tentativa, como um `404`. |
| `not_forwarded` | Registrado e nunca enviado; `reason` diz por quê. |

| `reason` | Por que a requisição não foi encaminhada |
| --- | --- |
| `paused` | O encaminhamento estava pausado quando a requisição chegou, ou quando chegou a vez dela. |
| `body_too_large` | O corpo é maior do que o plano encaminha, ou tinha mais de 1 MiB. |
| `url_too_long` | A URL de encaminhamento, com o caminho e a query da requisição acrescentados, tem mais de 8.192 caracteres. |
| `queue_full` | Havia 1.000 encaminhamentos do bin que ainda não tinham terminado. |
| `forwarding_off` | O encaminhamento foi interrompido antes de chegar a vez da requisição. |
| `bin_gone` | O bin foi excluído ou expirou antes de chegar a vez da requisição. |
| `suspended` | O bin, ou o workspace dele, foi suspenso antes de chegar a vez da requisição. |
| `not_entitled` | O plano deixou de incluir o encaminhamento antes de chegar a vez da requisição. |
| `request_gone` | A requisição atingiu o fim da retenção antes de chegar a vez dela. |

### Plano e uso {#plan}

`GET /v1/plan` informa quais limites se aplicam:

```json
{
  "plan": "starter",
  "enforced_as": "starter",
  "ceilings": {
    "max_bins": 5,
    "monthly_requests": 25000,
    "retention_days": 7,
    "bin_ttl_minutes": 0,
    "bin_ttl_max_minutes": 10080,
    "read_api": 1,
    "bin_max_sources": 200,
    "bin_max_browser_posts": 5,
    "bin_share_pct": 50,
    "forwarding": 1,
    "forward_max_body_bytes": 262144,
    "forward_rate_per_min": 60,
    "forward_max_attempts": 3
  },
  "past_due": false,
  "suspended": false,
  "system": false
}
```

`plan` é o plano registrado, vazio quando o workspace não tem nenhum; `enforced_as` é o plano cujos limites se aplicam, `free` quando não há nenhum. `ceilings` traz os limites pelo nome ([Planos e limites](#limits)). `past_due` é `true` enquanto há uma cobrança em aberto, e `suspended` passa a ser `true` quando termina o período de carência que vem depois dela. `system` é para o próprio workspace da NimbusNexus.

`GET /v1/usage` informa quanto desses limites já foi usado:

```json
{
  "period": "2026-10-01",
  "requests": 26834,
  "monthly_requests": 35000,
  "purchased_requests": 10000,
  "credit": null,
  "bins": 2,
  "max_bins": 5,
  "bin_request_ceiling": 17500
}
```

`period` é o mês, representado pelo primeiro dia. `requests` conta o que os bins do workspace registraram neste mês, em relação a `monthly_requests`: as requisições mensais do plano mais `purchased_requests`, as requisições compradas com [crédito](#credit) neste mês. Aqui, um workspace no Starter comprou um bloco além das suas 25.000. `bins` conta os bins existentes, em relação a `max_bins`. `bin_request_ceiling` é o máximo que um único bin pode registrar neste mês, incluindo as requisições compradas.

`credit` é `null` enquanto restam requisições no mês. Depois que elas se esgotam, ele diz o que o crédito está fazendo: `pending` enquanto mais requisições estão sendo compradas, e por isso os bins voltam a registrar em poucos minutos; `empty` quando o saldo é baixo demais para um bloco; e `off` quando o crédito está desligado para o Request Bins, ou quando o plano não compra requisições, como no Custom. Trate-o como uma string aberta e mantenha um caso padrão para um valor que você não conhece.

## Quem pode fazer o quê {#authority}

| | Ler bins, plano e uso | Ler requisições capturadas | Criar, renomear, desativar e ativar bins, e configurar o encaminhamento | Excluir e esvaziar bins |
| --- | --- | --- | --- | --- |
| Proprietário ou admin do workspace | sim | sim | sim | sim |
| Membro | sim | sim | sim | não |
| Viewer, ou qualquer outra função | sim | sim | não | não |
| Chave com **Read & write** (escopo `admin`) | sim | nos planos pagos | sim | sim |
| Chave com **Read** (escopo `read`) | sim | nos planos pagos | não | não |

Uma ação recusada responde `403` `forbidden` com `details.reason` `role`, e `details.required` indica a função necessária: `member` para criar ou alterar um bin, `admin` para excluir ou esvaziar um. Para uma chave, as duas significam **Read & write** (o escopo `admin`). O console da conta cria chaves **Read** e **Read & write**, e uma chave com qualquer outro escopo, como `write`, é tratada como **Read**.

O Request Bins atende workspaces inteiros. Um assento de convidado, ou uma chave restrita a um projeto, é recusado em todas as rotas com `403` `project_confined`.

Um workspace tem o Request Bins depois que um proprietário ou admin abre o console ou o adiciona em **Add a product**. Até lá, os outros membros são recusados com `403` `product_not_enabled`. As chaves não são afetadas.

## Planos e limites {#limits}

| Chave em `ceilings` | Descrição | Free | Starter | Pro | Custom |
| --- | --- | --- | --- | --- | --- |
| `max_bins` | Bins ao mesmo tempo | 1 | 5 | 25 | 250 |
| `monthly_requests` | Requisições registradas por mês | 1.000 | 25.000 | 250.000 | 5.000.000 |
| `bin_share_pct` | A maior parcela do mês que um bin pode usar | 100% | 50% | 40% | 25% |
| `retention_days` | Por quanto tempo uma requisição é mantida | 1 dia | 7 dias | 30 dias | 90 dias |
| `bin_ttl_minutes` | O tempo de vida padrão de um novo bin | 24 horas | até ser excluído | até ser excluído | até ser excluído |
| `bin_ttl_max_minutes` | O maior tempo de vida que você pode definir | 24 horas | 7 dias | 30 dias | sem limite do plano; o máximo da API é um ano |
| `read_api` | Leitura de requisições capturadas com uma chave | não | sim | sim | sim |
| `bin_max_sources` | Remetentes distintos antes de um bin ser suspenso | 50 | 200 | 500 | 2.000 |
| `bin_max_browser_posts` | Envios de formulário de navegador antes de um bin ser suspenso | 3 | 5 | 5 | 10 |
| `forwarding` | [Encaminhamento](#forwarding) de cada requisição para o seu próprio servidor | não | sim | sim | sim |
| `forward_max_body_bytes` | O maior corpo que um encaminhamento leva | — | 256 KiB | 1 MiB | 1 MiB |
| `forward_rate_per_min` | Encaminhamentos que um bin envia por minuto; os demais esperam a sua vez | — | 60 | 300 | 600 |
| `forward_max_attempts` | Tentativas de enviar um encaminhamento | — | 3 | 5 | 5 |

`GET /v1/plan` informa os tempos de vida em minutos, com `0` significando até ser excluído (`bin_ttl_minutes`) ou sem limite do plano (`bin_ttl_max_minutes`), `read_api` e `forwarding` como `1` ou `0`, `forward_max_body_bytes` em bytes e os números do encaminhamento como `0` no Free. Os preços estão na [visão geral](/docs/product-bins#limits).

- **O mês** é um mês do calendário em UTC: `period` em `GET /v1/usage`. Toda requisição que um bin registra conta. Uma requisição recusada ou barrada pelo limite de requisições não conta.
- **Depois de esgotadas as requisições do mês**, ou a parcela de um bin (`bin_request_ceiling`), os bins respondem `200` e não registram nada até que o [crédito](#credit) compre mais ou o mês seguinte comece, e `refused_count` mostra isso. Nenhuma chamada de API é recusada por causa disso.
- **Retenção e tempo de vida são relógios separados.** Uma requisição é excluída quando a retenção do plano se esgota ou quando o bin dela termina, o que acontecer primeiro.
- **Avisos:** quando o workspace chega a 80% e depois a 100% das requisições do mês, incluindo as compradas, ele é avisado por e-mail, que vai para o proprietário do workspace, a menos que você escolha outro endereço, e por um webhook com o tipo de evento `bind.quota.threshold_reached`, se você configurar um. Os dois ficam em **Notifications** no seu console da conta. O e-mail diz o que o crédito vai fazer.
- **Enquanto um pagamento estiver atrasado,** criar e alterar bins é recusado com `402` `workspace_frozen`, e os bins continuam registrando. Se o período de carência terminar, o workspace é suspenso: as mesmas recusas passam a vir como `402` `workspace_suspended`, e os bins respondem `200` e não registram nada. Excluir e ler continuam funcionando, e nada é excluído.
- **Em um plano menor,** os bins acima do `max_bins` dele ficam em espera, dos mais novos para os mais antigos, como [`plan_downgrade`](#suspension), e voltam, dos mais antigos para os mais novos, quando o plano permitir.

### Mais requisições com crédito {#credit}

O crédito é um saldo que o seu workspace mantém para os produtos NimbusNexus gastarem quando o limite mensal deles se esgota. Você o adiciona no [console da conta]({{ACCOUNT_BASE_URL}}/billing#credit), em **Billing**, onde o card **Credit** também liga ou desliga o gasto de cada produto. No Request Bins, esse gasto fica ligado até você desligá-lo.

- **O bloco:** 10.000 requisições por $4, no Free, no Starter e no Pro. No Custom, as requisições adicionais vêm por contrato, então o crédito não compra nenhuma.
- **Quando:** a cada 5 minutos, aproximadamente, o Request Bins compra um bloco para cada workspace que já usou 90% das requisições do mês e tem menos de 10.000 restantes, enquanto o saldo durar.
- **O que ele acrescenta:** 10.000 às requisições do mês e à parcela de cada bin, então `monthly_requests`, `purchased_requests` e `bin_request_ceiling` em [`GET /v1/usage`](#plan) aumentam com ele.
- **Só para o mês:** as requisições compradas expiram quando o mês termina. Um bloco usado só em parte não é reembolsado, e nada passa para o mês seguinte.
- **Quando não é possível comprar:** com o crédito desligado, ou com um saldo baixo demais para um bloco, os bins respondem `200` e não registram nada depois de esgotadas as requisições do mês, até o mês seguinte, e `credit` em `GET /v1/usage` diz qual dos dois. Um remetente rápido o bastante para esgotar as últimas requisições antes da próxima compra também encontra as requisições do mês esgotadas, por alguns minutos, e o que ele envia nesse intervalo não é registrado.

## Erros {#errors}

Os erros da API usam o formato descrito em [Erros](/docs/errors), com os códigos que o Inboxes envia nas mesmas situações:

| Status | `code` | Quando |
| --- | --- | --- |
| `400` | `bad_request` | Um corpo JSON que não é UTF-8 válido. |
| `401` | `unauthorized` | Nenhuma credencial, uma credencial revogada ou uma sessão de login do console que terminou; `details.reason` diz qual. |
| `401` | `invalid_credential` | Uma chave que não passa na verificação, expirou ou foi criada para outro produto. |
| `402` | `quota_exceeded` | Criar um bin quando todos os bins do plano estão em uso. |
| `402` | `not_entitled` | No Free: ler requisições capturadas com uma chave (`details.feature` `read_api`), ou definir uma URL de encaminhamento ou enviar um teste (`forwarding`). |
| `402` | `workspace_frozen`, `workspace_suspended` | Criar ou alterar um bin enquanto um pagamento está atrasado, ou depois que o serviço foi interrompido. |
| `403` | `forbidden` | `details.reason` é `role`, `project_confined`, `product_not_enabled`, `csrf` ou `no_workspace`. |
| `404` | `not_found` | Não há esse bin nem essa requisição no seu workspace, ou o recurso foi excluído ou expirou; `details.reason` é `bin` ou `request`. |
| `405` | `method_not_allowed` | O caminho existe, mas não para este método. |
| `413` | `payload_too_large` | Um corpo de requisição acima de 2 MiB. |
| `422` | `validation_error` | Um parâmetro ou campo falhou na validação. Um caractere NUL no caminho, na query ou em um corpo JSON aparece como uma entrada do tipo `bins.nul_character`, uma URL de encaminhamento para a qual um bin não encaminha aparece como `bins.forward_target` ([Encaminhamento](#forwarding)), e uma busca cujas partes se contradizem aparece como `bins.search_conflict` ([Requisições capturadas](#requests)). |
| `429` | `rate_limited` | Mais de 10 envios de teste para um bin em um minuto; `details.retry_after` diz quando tentar de novo. |
| `500` | `internal_error` | Algo quebrou do nosso lado. |
| `503` | `unavailable` | Definir uma URL de encaminhamento ou enviar um teste enquanto o encaminhamento está desligado para todo o serviço (`details.reason` `forwarding_disabled`), ou um teste que não foi pego para envio em até 3 segundos, então nada foi enviado (`forwarder_unavailable`). |

A API não envia `409`, e envia `429` só para envios de teste.

## Próximos passos {#next-steps}

- [Início rápido](/docs/product-bins/quickstart) — crie um bin e leia o que ele registrou.
- [Encaminhamento](/docs/product-bins/forwarding) — o que um encaminhamento envia, as retentativas, os limites e de onde vêm os encaminhamentos.
- [API de Request Bins](/docs/reference/bins) — todas as operações, com a requisição em curl, TypeScript, Python ou Go.
- [Erros](/docs/errors) — o formato do erro, todas as chaves de `details` e um padrão para tratá-los.
- [Visão geral do produto](/docs/product-bins) — preços e o que o Request Bins não faz.
