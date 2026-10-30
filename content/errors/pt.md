---
title: "Erros"
description: "O formato do erro, os códigos de erro que as APIs de Webhooks, Inboxes e Request Bins enviam e como tratar cada um."
publishedAt: 2026-05-20
updatedAt: 2026-10-30
kind: concept
---

# Erros

Toda resposta de erro das APIs de Webhooks, Inboxes e Request Bins usa o mesmo formato JSON. Para tratar cada caso, decida com base em `error.code`, ou em `error.next_code` quando o erro trouxer esse campo. Não faça parsing de `message` e não decida só pelo status: um mesmo status pode trazer vários códigos e, em todas as APIs, o `402` traz quatro.

> **Atualizado em 16 de outubro de 2026.** No Webhooks, um nome de header personalizado que é um token HTTP válido com um line feed no final agora é recusado como qualquer outro nome que não seja um token HTTP válido: `webhooks.custom_header_name_invalid`, com o `msg` dessa regra e sem `params` ([Validação da requisição](#codes-validation)). Antes, o line feed passava pela verificação de token e o nome era recusado como caractere de controle, com `params.header`: como `webhooks.custom_header_control_character` a partir de 15 de outubro de 2026, e como `value_error` antes disso. A requisição continua sendo um `422` `validation_error`, e nada mais mudou.
>
> **Atualizado em 15 de outubro de 2026.** Antes do lançamento da v1, todas as renomeações que estavam em andamento no Inboxes e no Webhooks foram concluídas: um erro que trazia um `next_code` agora traz esse código, com o status desse código, e nenhuma das duas APIs envia mais `next_code`.
>
> - Uma requisição que falha na validação é `validation_error` nas duas APIs, ainda um `422`. No Inboxes era `invalid_request`; no Webhooks, um campo que a própria API verifica era `unprocessable`. Nas duas, `details` é `{"errors": [...]}`; no Webhooks era uma lista simples ([Validação da requisição](#codes-validation)).
> - Todo `500` é `internal_error` nas duas APIs (no Webhooks era `internal`).
> - No Inboxes, uma chave de API ou um token que ele não reconhece ou não consegue verificar é `invalid_credential`, ainda um `401` (era `unauthorized`). Uma credencial ausente ou revogada, ou uma sessão de login que terminou, continua sendo `unauthorized` com um `details.reason`.
> - No Inboxes, um status sem código próprio traz o código desse status, como `bad_request` para um `400` (era `error`).
> - No Webhooks, `plan_violation` deixou de existir. O limite de endpoints é `quota_exceeded` (`402`, `details.reason` `allocation`), `max_attempts` acima do teto do plano é um `422` `validation_error`, e uma fonte RabbitMQ abaixo do Pro, ou desativar a verificação de endpoint em um plano que a exige (nenhum plano exige hoje), é `not_entitled` (`402`).
> - No Webhooks, um reenvio em lote cujo `from` é posterior ao `to` é um `422` `validation_error` com uma entrada em `["body", "to"]`, e não mais um `409` `conflict`.
> - As regras próprias do Webhooks para headers personalizados, atrasos de `retry_schedule`, campos de broker de uma fonte RabbitMQ e nomes de plano informam o seu próprio `type` de entrada em vez de `value_error`; `loc`, `msg` e `params` não mudaram ([Validação da requisição](#codes-validation)).
> - No Inboxes, uma credencial limitada a certos projetos é recusada com `details.reason` `project_confined` (era `project`) ([O que `details` contém](#details)).
> - No Inboxes, `details` traz apenas as chaves que esta página lista. `quota_exceeded` não envia mais `max_inboxes`, `max_http_bins` nem `monthly_messages` (leia `metric`, `limit`, `current` e `period`), o `not_entitled` da API de leitura não envia mais `plan`, e o `rate_limited` por caixa de entrada não envia mais `inbox_id`.
>
> Nenhum `message` mudou, e nenhum status mudou, exceto os das duas recusas do Webhooks que viraram um `422`. Essas mudanças foram feitas antes do lançamento da v1, então não tiveram o período de 12 meses que [Quando um código é renomeado](#renames) descreve; essa seção mapeia cada grafia antiga para a nova.
>
> **Atualizado em 5 de outubro de 2026.** Os corpos de erro ganharam campos e não perderam nenhum: `request_id` (o mesmo valor do header `X-Request-ID`), um `reason` e valores nomeados em `details` em muitos outros erros, `params` nas entradas de validação que têm um limite numérico, e `next_code` em um erro cujo código está sendo renomeado. Nenhum status, `code` ou `message` mudou. No Webhooks, um `conflict` nomeia o choque em `details.reason`, o `quota_exceeded` mensal nomeia `metric`, `limit`, `current` e `period`, todo `413` nomeia seu `limit`, e `plan_violation` traz o `next_code` em que vai se transformar, com o `details` desse código ([Quando um código é renomeado](#renames)). [O formato](#shape) descreve cada campo.
>
> **Corrigido em 5 de outubro de 2026.** Versões anteriores desta página listavam códigos, status e campos que as APIs nunca enviaram, entre eles `validation_failed` (400), `rate_limit_exceeded`, `quota_exceeded` como 429 e `fields`. Um código que testa esses valores nunca encontrou nenhum deles. Elas também prometiam um `request_id` em todo corpo antes de as APIs enviarem um; os corpos de erro o trazem agora, todos desde 6 de outubro de 2026 ([O id da requisição](#request-id)). [Códigos que esta página listava](#earlier-versions) mapeia cada um para o que a API de fato envia.

## O formato {#shape}

Uma chave somente leitura que tenta criar uma caixa de entrada no Inboxes, ou um endpoint no Webhooks, recebe esta resposta das duas APIs (só o `request_id` muda):

```json
{
  "error": {
    "code": "forbidden",
    "message": "admin scope required",
    "details": {
      "reason": "scope",
      "required": "admin"
    },
    "request_id": "5f0c2e9a8b7d4c31a6e4f2b1d9c8e7a6"
  }
}
```

O Request Bins recusa a mesma chave somente leitura com o mesmo código e o mesmo status, mas o seu `details` nomeia a função de que a ação precisa, e não um escopo: `"reason": "role"` e `"required": "member"`. Uma chave tem essa função com o escopo `admin`, **Read & write** no console da conta ([O que `details` contém](#details)).

Até cinco campos. `code`, `message` e `request_id` estão em todo corpo de erro que as APIs enviam, e `details` e `next_code` aparecem quando têm algo a dizer:

| Campo | Sempre presente | Descrição |
|---|---|---|
| `code` | Sim | String estável, legível por máquina. Tome decisões com base nela, ou em `next_code` quando ele estiver presente. |
| `message` | Sim | Texto em inglês para logs e tickets de suporte. Não é traduzido e não se destina a uma interface para usuários finais. |
| `details` | Não | Contexto estruturado: um `reason` que refina o código e os valores que o acompanham, como o `id` que não foi encontrado. Em um erro de validação, os valores de entrada que falharam. Seu formato depende do código; em um erro de validação, é `{"errors": [...]}`, uma lista de entradas. Veja [O que `details` contém](#details). |
| `request_id` | Sim | O id desta requisição, o mesmo valor do header de resposta `X-Request-ID`. Registre-o em log e informe-o ao suporte; nunca tome decisões com base nele. Veja [O id da requisição](#request-id). |
| `next_code` | Não | Enviado só enquanto um código está sendo renomeado: o código que este erro vai trazer quando a renomeação for concluída. Prefira-o a `code`. Nenhum código está sendo renomeado hoje, então nenhuma API o envia. Veja [Quando um código é renomeado](#renames). |

Novos campos podem ser adicionados ao membro `error`, como a qualquer resposta; ignore os que você não usa ([Política de versionamento](/docs/versioning#forward-compat)).

### O que `details` contém {#details}

Trate todas as chaves de `details` como opcionais: leia as que você precisa e ignore o resto. Quando ele tem um `reason`, essa é uma string de máquina estável que refina o código: por que um `forbidden` foi recusado, ou que tipo de coisa um `not_found` não encontrou. Ao lado dele ficam os valores de que esse motivo precisa, com nomes fixos. Alguns códigos trazem valores sem motivo, e muitos erros não trazem `details` nenhum. Assim como `code`, `details.reason` é uma string aberta, não um enum: novos motivos e novos códigos são [mudanças aditivas](/docs/versioning#additive), então mantenha um caso padrão para os dois. A tabela lista o que você pode encontrar chamando as APIs hoje. Na coluna **API**, **Ambas** significa Webhooks e Inboxes, e o Request Bins tem linhas próprias.

| `code` | API | `details.reason` | Outras chaves em `details` |
|---|---|---|---|
| `unauthorized` | Ambas | `missing`: nenhuma credencial foi enviada. `revoked`: a chave ou a sessão foi revogada. `invalid`: no Inboxes, uma sessão de login que não passou na verificação, geralmente porque expirou; no Webhooks, um evento recebido em `POST /v1/ingest/{source_id}` cuja assinatura não passa na verificação. `no_workspace`, só no Inboxes: a credencial não está vinculada a um workspace. | — |
| `unauthorized` | Request Bins | `missing`: nenhuma credencial foi enviada. `revoked`: a chave ou a sessão foi revogada. `invalid`: uma sessão de login que não passou na verificação, geralmente porque expirou. `no_workspace`: a sessão de login não está vinculada a um workspace. | — |
| `forbidden` | Ambas | `scope`: o escopo da credencial não permite isso. `project_confined`: uma credencial limitada a certos projetos, usada em uma rota que responde pelo workspace inteiro; o Inboxes ainda não aceita credenciais limitadas a projetos, então envia isso em todas as rotas. `csrf`: uma sessão de navegador enviou uma requisição de gravação sem o header `X-CSRF`. `operator`: a rota, ou um campo da requisição, é só para operadores da plataforma. | `required`, na maioria das recusas por `scope`: o escopo que teria sido permitido (`admin` no Inboxes; `admin`, `read` ou `publish` no Webhooks) |
| `forbidden` | Webhooks | `role`: sua função, no workspace ou no projeto do recurso em que você está agindo, é baixa demais. `project`: a credencial, ou a pessoa que a usa, não tem acesso ao projeto que a requisição indica. `product_not_enabled`: seu acesso não inclui o Webhooks. `not_provisioned`: o workspace ainda não está configurado para o Webhooks. | `required`, em `role`: a menor função permitida (`admin`) |
| `forbidden` | Request Bins | `role`: sua função, ou o escopo da sua chave, não permite isso. `project_confined`: um assento de convidado, ou uma chave limitada a um projeto; o Request Bins atende workspaces inteiros, então envia isso em todas as rotas. `product_not_enabled`: seu workspace não adicionou o Request Bins, ou o seu login não o inclui. `csrf`: uma sessão de navegador enviou uma requisição de gravação sem o header `X-CSRF`. `no_workspace`: a credencial não está vinculada a um workspace, como um token de serviço. | `required`, em `role`: `member` para criar ou alterar um bin, `admin` para excluir ou esvaziar um. Para uma chave, os dois significam o escopo `admin` (**Read & write**). |
| `not_found` | Ambas | O tipo de recurso. Inboxes: `inbox`, `message`, `workspace`. Webhooks: `endpoint`, `source`, `event`, `delivery`, `capture`, `event_type`, `operational_endpoint`, `project`, `workspace`, `user` e `default_project` (uma gravação que não indica projeto, em um workspace que ainda não tem nenhum). | `id`: o id que você pediu. Ausente em `user` e `default_project`, em que você não indicou nenhum, e em um caminho que nem existe. |
| `not_found` | Request Bins | O tipo de recurso: `bin` ou `request`. Um bin que foi excluído ou que expirou é `bin`. | `id`: o id que você pediu. Ausente em um caminho que nem existe. |
| `bad_request` | Webhooks | `project_required`: uma gravação que não indica projeto, vinda de uma credencial que alcança vários. | `projects`: os projetos que a credencial alcança |
| `conflict` | Webhooks | Qual é o choque, como `event_type_exists` ou `idempotency_key_reuse`. [Conflitos](#codes-state) lista cada motivo e quando ele é enviado. | Os valores de que esse motivo precisa, como o `id` do endpoint, da entrega ou do projeto envolvido no choque; [Conflitos](#codes-state) os lista por motivo |
| `quota_exceeded` | Ambas | `allocation`: o teto de um plano para uma contagem (Inboxes: endereços; Webhooks: endpoints). `period`: o teto mensal (Inboxes: mensagens; Webhooks: entregas). | `metric` (`inboxes` ou `messages` no Inboxes; `endpoints` ou `deliveries` no Webhooks) e o `limit` correspondente; `current` em `allocation`, e em um `period` do Webhooks (as entregas usadas antes da publicação recusada) quando foi possível ler a contagem; `period` em `period`: o mês no Inboxes (`YYYY-MM`), o primeiro dia do ciclo de faturamento no Webhooks (`YYYY-MM-DD`). Uma publicação é recusada quando suas entregas levariam a contagem além de `limit`, então no Webhooks `current` pode ficar abaixo de `limit`. |
| `quota_exceeded` | Request Bins | `allocation`: o teto do plano para bins, em `POST /v1/bins`. Nunca `period`: depois de esgotadas as requisições do mês, os bins respondem aos remetentes e não registram nada, e nenhuma chamada de API é recusada. | `metric` (`bins`), o `limit` correspondente e `current` |
| `not_entitled` | Ambas | — | `feature`: `read_api` ou `optional_phrase_gate` no Inboxes; `rabbitmq_sources` ou `optional_endpoint_verification` no Webhooks. O Webhooks envia `optional_endpoint_verification` quando alguém desativa a verificação de endpoint em um plano que a exige; nenhum plano exige hoje. |
| `not_entitled` | Request Bins | — | `feature`: `read_api`, ler requisições capturadas com uma chave de API no plano Free; `forwarding`, definir uma URL de encaminhamento ou enviar um teste no plano Free |
| `payload_too_large` | Ambas | — | `limit` em bytes, em todo `413`. O Inboxes também envia `size` quando a API mediu o corpo. |
| `payload_too_large` | Request Bins | — | `limit` em bytes, em todo `413` |
| `unknown_event_type` | Webhooks | — | `event_type`: o nome que não está registrado |
| `invalid_payload` | Webhooks | `payload`: o payload não passa no schema do seu tipo de evento. `schema_invalid`: um schema que você está registrando não é um JSON Schema válido. | Em `payload`: `errors`, até 20 entradas de `{path, keyword, params}` (abaixo), e `total`, quantas entradas havia antes desse corte (o tamanho da lista quando nada foi cortado). Em `schema_invalid`: `path`, um JSON Pointer para dentro do schema, onde ele falhou. |
| `schema_too_large` | Webhooks | `bytes`, `depth`, `members`, `enum_values` ou `patterns`: o limite que o schema ultrapassou | `limit`; também `size` em `bytes` (ambos em bytes) |
| `schema_pattern_unsafe` | Webhooks | `too_long`, `does_not_compile`, `empty_repeat`, `nested_quantifier`, `ambiguous_alternation` ou `too_complex`: a regra que o padrão violou | `pattern`: o padrão inteiro, embora `message` encurte um padrão longo; `limit` (em caracteres) em `too_long` |
| `schema_ref_unsupported` | Webhooks | — | `ref`: o `$ref` remoto que a API não resolve |
| `provider_secret_required` | Webhooks | — | `provider`: `stripe`, `github` ou `rabbitmq` |
| `broker_not_allowed` | Webhooks | Nenhum para o seu broker, qualquer que seja a regra que o recusou (`not_system_broker` só é enviado ao próprio workspace da plataforma) | `host`: o broker, como `host:port` |
| `rate_limited` | Ambas | `inbox_rate` (Inboxes): o limite por minuto de uma caixa de entrada. O Webhooks não envia motivo. | `retry_after` em segundos, o mesmo número do header `Retry-After` (nas duas APIs). No `inbox_rate` do Inboxes, também `rate_per_min`. |
| `rate_limited` | Request Bins | — | `retry_after`: os segundos que faltam até o próximo envio de teste do bin ser permitido |
| `unavailable` | Inboxes | `ingest_disabled`: a aceitação de mensagens está desligada | — |
| `unavailable` | Request Bins | `forwarding_disabled`: o encaminhamento está desligado para todo o serviço. `forwarder_unavailable`: um teste não foi pego para envio em até 3 segundos, então nada foi enviado. | — |

Em `invalid_payload`, cada entrada de `details.errors` diz o que falhou e onde. `path` é um JSON Pointer para o valor que falhou: `""` é o próprio payload e, para um membro ausente ou inesperado, ele aponta para o objeto que deveria contê-lo ou que não deveria. `keyword` é a palavra-chave do JSON Schema que falhou (`required`, `type`, `enum`, `const`, `minimum`, `maximum`, `minLength`, `maxLength`, `minItems`, `maxItems`, `pattern`, `format` ou `additionalProperties`), ou `other` para qualquer outra palavra-chave. `params` contém `property` (o membro ausente ou inesperado, uma entrada para cada um), `count` (um limite de tamanho ou de quantidade de itens), `limit` (o limite de um `minimum` ou `maximum`) ou `type` (o único tipo que o valor deveria ter), e fica vazio quando nada disso se aplica, como em `enum` ou `pattern`, ou em um `type` que permite vários. As entradas nunca trazem a regex, os valores permitidos nem o valor que falhou; `message` continua descrevendo uma das falhas em inglês.

Os erros de validação da requisição (`validation_error`) não estão na tabela: em todas as APIs, o `details` deles é `{"errors": [...]}`, uma lista de entradas de validação, cada uma com `loc`, `type` e `msg`, um formato diferente do de `invalid_payload`. Veja [Validação da requisição](#codes-validation).

### O id da requisição {#request-id}

`error.request_id` é o mesmo valor do header `X-Request-ID` em toda resposta que uma API envia, então qualquer um dos dois identifica a requisição. Se a sua requisição envia um header `X-Request-ID` (até 128 letras, dígitos, `.`, `_` ou `-`), a API usa esse valor como id da requisição; caso contrário, ela gera um. Se você o definir, faça com que seja único por requisição, para que o id aponte para uma única chamada. Algumas respostas vêm do edge que fica na frente das APIs, e não de uma API: um `502` ou `504`, por exemplo, ou um `413` para um corpo grande demais para chegar à API. Essas respostas não trazem nem o corpo de erro da API nem `X-Request-ID`. Leia o corpo primeiro e, se faltar, recorra ao header, como faz o [padrão de tratamento](#pattern), e espere que os dois faltem nessas respostas. O que fazer com o id está em [Reportar bugs](#bugs).

## Famílias de códigos de status {#families}

| Família de status | Significado da família |
|---|---|
| `200`/`201`/`202`/`204` | Sucesso |
| `400` | Não foi possível ler a requisição como foi enviada |
| `401` | Nenhuma credencial utilizável: nenhuma foi enviada, ou ela foi revogada. O Inboxes e o Request Bins também respondem `401`, como `invalid_credential`, para uma chave que não reconhecem ou não conseguem verificar, e o Webhooks responde `401`, como `unauthorized`, para um evento recebido cuja assinatura não passa na verificação |
| `402` | Seu plano ou a situação do faturamento impede a requisição: uma cota, uma funcionalidade que seu plano não inclui ou um workspace congelado ou suspenso |
| `403` | Não permitido. O Webhooks também responde `403`, como `invalid_credential`, para uma credencial que ele não reconhece |
| `404` | O recurso não existe *ou* quem chama não pode vê-lo (indistinguíveis de propósito) |
| `405` | O caminho existe, mas não para este método |
| `409` | Conflito com o estado existente, incluindo um `Idempotency-Key` reutilizado com outro corpo |
| `413` | O corpo é grande demais |
| `422` | A requisição foi interpretada, mas falhou na validação |
| `429` | Barrado pelo limite de requisições |
| `5xx` | Problema do lado do servidor |

`429` e `5xx` são as únicas famílias em que enviar a mesma requisição de novo pode dar certo. Para todos os outros `4xx`, o código diz o que mudar.

## Códigos de erro {#codes}

As duas APIs compartilham a maioria dos códigos e, desde a atualização indicada no topo desta página, usam a mesma grafia para quase todas as situações que têm em comum. Duas diferem: `invalid_credential` é um `401` no Inboxes e um `403` no Webhooks, e uma sessão de login que expirou é `unauthorized` (`details.reason` `invalid`) no Inboxes, mas `invalid_credential` no Webhooks. A coluna **API** diz qual API envia cada código.

O Request Bins envia os códigos que o Inboxes envia para as mesmas situações, incluindo essas duas. Na coluna **API**, **Todas** significa as três APIs, **Ambas** significa Webhooks e Inboxes, e uma linha marcada **Request Bins** trata só dessa API.

### Autenticação e autorização {#codes-auth}

| `code` | Status | API | Descrição |
|---|---|---|---|
| `unauthorized` | 401 | Todas | Nenhuma credencial foi enviada, ou ela foi revogada. No Inboxes e no Request Bins, também uma sessão de login que terminou ou não passou na verificação; todo `unauthorized` que eles enviam traz um `details.reason`. No Webhooks, também um evento recebido em `POST /v1/ingest/{source_id}` cuja assinatura não passa na verificação (`details.reason` `invalid`); todo `401` do Webhooks traz um `details.reason` ([O que `details` contém](#details)). |
| `invalid_credential` | 401 no Inboxes e no Request Bins, 403 no Webhooks | Todas | Uma chave de API ou um token que a API não reconhece ou não consegue verificar. Substitua-o; enviar a mesma credencial de novo não vai funcionar. No Webhooks, isso inclui uma sessão de login que expirou: entre de novo. |
| `forbidden` | 403 | Todas | A credencial é válida, mas não pode fazer isso: a falta de um escopo ou de uma função, uma chave limitada a certos projetos usada fora deles ou um produto que não está ativado para o seu workspace. `details.reason` diz qual é o caso. |

`invalid_credential` é um `403` na API de Webhooks e um `401` no Inboxes e no Request Bins, e cada um vai continuar assim: decida com base no código, não no status. Veja [Autenticação](/docs/authentication) para o formato da requisição.

### Validação da requisição {#codes-validation}

| `code` | Status | API | Descrição |
|---|---|---|---|
| `validation_error` | 422 | Todas | O corpo, a query ou o caminho falhou na validação, ou, no Webhooks, uma regra que a própria API verifica recusou um campo. `details` é `{"errors": [...]}`, uma lista de entradas. |
| `bad_request` | 400 | Todas | Não é possível agir sobre a requisição como ela foi enviada. `message` diz por quê. No Inboxes e no Request Bins, um corpo que a API não conseguiu ler, como um que não é UTF-8 válido. |
| `payload_too_large` | 413 | Todas | O corpo excede o limite de tamanho. |
| `method_not_allowed` | 405 | Todas | O caminho existe, mas não para este método. |

Cada entrada de validação descreve um valor de entrada que falhou: `loc` diz onde (`["body", "event_type"]`), `type` diz o que está errado em formato legível por máquina (`missing`, `string_too_long`, `json_invalid`, …) e `msg` diz isso em inglês. Quando a regra tem um número, a entrada também o traz em `params`: `count` para um tamanho (`string_too_short`, `string_too_long`, `too_short`, `too_long`) e `limit` para um limite (`greater_than`, `greater_than_equal`, `less_than`, `less_than_equal`). Um corpo que não é JSON válido também é um erro de validação, com o tipo `json_invalid`; no Inboxes e no Request Bins, um corpo que não é UTF-8 válido é, em vez disso, um `400` `bad_request`.

O Webhooks também envia tipos de entrada próprios, para regras que ele mesmo verifica:

- `webhooks.max_attempts_above_plan`: `max_attempts` acima do teto do plano, em `POST /v1/endpoints` ou `PATCH /v1/endpoints/{id}`; `loc` `["body", "max_attempts"]`, com `params.count`, o teto.
- `webhooks.url_not_https`: uma `url` de endpoint que não é https, em `POST /v1/endpoints`, `PATCH /v1/endpoints/{id}` ou `POST /v1/operational-endpoints`; `loc` `["body", "url"]`.
- `webhooks.end_before_start`: um reenvio em lote cujo `to` é anterior ao `from`; `loc` `["body", "to"]`. Limites iguais são permitidos.
- `webhooks.end_not_after_start`: em uma rota para operadores da plataforma, uma janela de uso que não termina depois de começar; `loc` `["query", "end"]`.
- `webhooks.unknown_delivery_status`: um filtro `status` desconhecido em `GET /v1/deliveries`; `loc` `["query", "status"]`, com `params.status`, o valor enviado.
- `webhooks.unknown_operational_event_type`: um valor de `event_types` que não é um tipo de evento operacional, em `POST /v1/operational-endpoints`; `loc` `["body", "event_types", <index>]`, uma entrada por valor distinto, no primeiro índice em que ele aparece, com `params.event_type`, o valor, e `params.choices`, os tipos de evento operacionais que a API aceita.

Na mesma rota para operadores da plataforma, uma data da janela de uso que não pode ser interpretada é uma entrada `date_parsing` em `["query", "start"]` ou `["query", "end"]`, uma para cada data assim. Uma recusa vinda de uma regra que a própria API verifica traz no máximo 20 entradas.

As regras próprias do Webhooks para headers personalizados, atrasos de `retry_schedule` e campos de broker de uma fonte RabbitMQ enviam entradas com `type` próprio, com o `loc` e o `msg` que sempre tiveram (exceto o nome de header que a nota de 16 de outubro de 2026 descreve), e `params` com os valores que a regra indica:

- Mais de 20 headers personalizados: `too_long`, com `params.count`, `20`.
- Um nome de header personalizado que não é um token HTTP válido: `webhooks.custom_header_name_invalid`, sem `params`.
- Uma quebra de linha ou outro caractere de controle no valor de um header personalizado: `webhooks.custom_header_control_character`, com `params.header`, o nome do header.
- Um valor de header personalizado com mais de 1.024 caracteres: `webhooks.custom_header_value_too_long`, com `params.header` e `params.count`, `1024`.
- Um nome que a API reserva para os seus próprios headers de entrega (`Content-Type`, `User-Agent` ou qualquer nome que comece com `X-Webhook-`): `webhooks.custom_header_managed`, com `params.header`.
- Um nome hop-by-hop ou de controle de conexão, como `Host` ou `Connection`: `webhooks.custom_header_forbidden`, com `params.header`.
- Um valor de header personalizado com um caractere que não é ASCII: `webhooks.custom_header_not_ascii`, com `params.header`.
- Nomes e valores de headers personalizados que, juntos, ocupam mais de 8.192 bytes: `webhooks.custom_headers_too_large`, com `params.limit`, `8192`.
- Um atraso de `retry_schedule` abaixo de 0 ou acima de 604.800 segundos: `webhooks.retry_delay_out_of_range`, com `params.limit`, `604800`.
- Uma fonte RabbitMQ criada sem todos os seus campos de broker: `webhooks.broker_fields_required`, com `params.missing`, uma lista dos campos (entre `broker_identifier`, `broker_host`, `broker_user`, `broker_exchange` e `broker_topic`) que estavam ausentes ou vazios. Seu `loc` é `["body"]`.

O `loc` das regras de headers personalizados é `["body", "custom_headers"]`, e `params.header` é o nome como você o enviou; o valor de um header nunca é devolvido. Um nome de plano que a API não conhece, em uma rota para operadores da plataforma, é uma entrada `enum` sem `params`. Até a atualização indicada no topo desta página, todas essas entradas tinham o tipo `value_error`.

O Inboxes envia um tipo de entrada próprio: `inboxes.search_conflict`, para uma busca de mensagens em `GET /v1/inboxes/{id}/messages` ou `GET /v1/messages` que indica um `header` com `in` definido como `subject`, `from` ou `body`. Seu `loc` é `["query", "in"]`, e ele não traz `params` ([Busca de mensagens](/docs/product-inboxes#search)).

O Request Bins envia três:

- `bins.nul_character`: um caractere NUL no caminho, na query string ou em um corpo JSON, que ele não consegue armazenar. Seu `loc` é `["path"]`, `["query", <name>]` ou `["body"]`, e ele não traz `params`.
- `bins.forward_target`: uma URL de encaminhamento para a qual um bin não encaminha. Seu `loc` é `["body", "forward_url"]`, e `params.reason` diz por quê ([Encaminhamento](/docs/product-bins/reference#forwarding)).
- `bins.search_conflict`: uma busca em `GET /v1/bins/{id}/requests` ou `GET /v1/requests` cujo `header` ou `field` não combina com o seu `in`, com o `loc` `["query", "in"]`, ou que indica tanto um `header` quanto um `field`, com o `loc` `["query", "field"]`. Ele não traz `params` ([Requisições capturadas](/docs/product-bins/reference#requests)).

Um rótulo do Inboxes com um caractere acima do limite:

```json
{
  "error": {
    "code": "validation_error",
    "message": "request validation failed",
    "details": {
      "errors": [
        {
          "loc": ["body", "label"],
          "msg": "String should have at most 200 characters",
          "type": "string_too_long",
          "params": {"count": 200}
        }
      ]
    },
    "request_id": "a3e81f0c5b9d4e2f8c7a6b5d4e3f2a1b"
  }
}
```

No Webhooks, a mesma entrada fica na mesma lista `details.errors`, sob o mesmo código, e o Request Bins a envia para um `label` de bin com mais de 200 caracteres.

### Códigos da API de Webhooks {#codes-webhooks}

Estes pertencem aos objetos próprios da API de Webhooks (tipos de evento, schemas, fontes, endpoints, entregas) e são todos `422`:

| `code` | Descrição |
|---|---|
| `unknown_event_type` | O tipo de evento não está no catálogo do seu workspace, e o catálogo só aceita tipos registrados. |
| `invalid_payload` | O payload não corresponde ao schema registrado para o seu tipo de evento (`details.reason` `payload`, com `details.errors`), ou um schema que você está registrando não é um JSON Schema válido (`schema_invalid`). |
| `schema_too_large` | Um JSON Schema que você registrou é grande demais ou tem aninhamento profundo demais. |
| `schema_pattern_unsafe` | Um `pattern` no seu schema é longo demais, não compila ou pode levar tempo demais para rodar. |
| `schema_ref_unsupported` | Seu schema usa um `$ref` que a API não resolve. |
| `provider_secret_required` | Rotacionar uma fonte do Stripe ou do GitHub exige o novo segredo desse provedor, e rotacionar uma fonte RabbitMQ exige a nova senha do broker. `details.provider` diz qual: `stripe`, `github` ou `rabbitmq`. |
| `broker_not_allowed` | Uma fonte RabbitMQ indica um broker ao qual a API não se conecta. |

### Plano e faturamento {#codes-plan}

Todos estes são `402`. Repetir a mesma requisição nunca adianta: alguém precisa mudar o plano, quitar um pagamento, esperar o próximo período de faturamento ou liberar uma alocação, por exemplo liberando um endereço ou excluindo um endpoint.

| `code` | API | Descrição |
|---|---|---|
| `quota_exceeded` | Ambas | Acima de um limite do plano: uma alocação (Inboxes: endereços; Webhooks: endpoints) ou um teto mensal (Inboxes: mensagens; Webhooks: entregas), em que você espera o próximo período ou faz upgrade. Nas duas APIs, `details.reason` diz qual é o caso, e `details` traz `metric`, o `limit` correspondente e, para uma alocação, a contagem `current`. |
| `quota_exceeded` | Request Bins | Acima do limite de bins do plano, ao criar um bin. `details.reason` é `allocation`, e `details` traz `metric` (`bins`), o `limit` correspondente e a contagem `current`. O limite mensal de requisições nunca recusa uma chamada de API: depois de ultrapassá-lo, os bins respondem aos remetentes e não registram nada até que o [crédito](/docs/product-bins/reference#credit) compre mais ou o mês seguinte comece. |
| `not_entitled` | Todas | A funcionalidade não está no seu plano, como a API de leitura no plano gratuito do Inboxes, a leitura de requisições capturadas com uma chave de API no plano Free do Request Bins ou uma fonte RabbitMQ abaixo do Pro no Webhooks. `details.feature` a nomeia. |
| `workspace_frozen` | Todas | Há uma cobrança em aberto, então as alterações são recusadas. Quite-a no console da sua conta; o upgrade do plano também é recusado até você fazer isso. |
| `workspace_suspended` | Todas | O período de carência após uma cobrança em aberto terminou e o serviço parou para este workspace. |

`quota_exceeded` é um `402`, não um `429`. Um limite de requisições se resolve sozinho em segundos; uma cota, não.

No Webhooks, o limite de endpoints é `quota_exceeded` em `POST /v1/endpoints`, com `details.reason` `allocation`, `metric` `endpoints`, `limit` (o teto do plano) e `current` (os endpoints que o workspace tem). Uma fonte RabbitMQ abaixo do Pro é `not_entitled` com `details.feature` `rabbitmq_sources`: em `POST /v1/sources` e em um `PATCH /v1/sources/{id}` de uma fonte RabbitMQ cujo corpo define `status` como `enabled` ou define qualquer um de `broker_identifier`, `broker_host`, `broker_port`, `broker_vhost`, `broker_user`, `broker_exchange`, `broker_topic` ou `broker_queues`, mesmo que seja para o valor que ele já tem. Outras alterações, como renomear ou desativar a fonte, continuam permitidas. `max_attempts` acima do teto do plano não é um `402`: é um `422` `validation_error` ([Validação da requisição](#codes-validation)).

No Request Bins, o limite de bins é `quota_exceeded` em `POST /v1/bins`. Ler requisições capturadas com uma chave de API no Free é `not_entitled`, com `details.feature` `read_api`, em `GET /v1/bins/{id}/requests`, `GET /v1/requests`, `GET /v1/bins/{id}/paths` e `GET /v1/requests/{id}`; o console as lê em todos os planos. Definir uma URL de encaminhamento ou enviar um teste no Free também é `not_entitled`, com `details.feature` `forwarding`. Enquanto um workspace está congelado ou suspenso, toda gravação, exceto uma exclusão, é recusada com `workspace_frozen` ou `workspace_suspended`, e as leituras continuam liberadas. Os bins continuam registrando enquanto o workspace está congelado e param enquanto ele está suspenso ([Planos e limites](/docs/product-bins/reference#limits)).

### Recursos {#codes-resources}

| `code` | Status | API | Descrição |
|---|---|---|---|
| `not_found` | 404 | Todas | O recurso não existe, ou você não pode vê-lo. Os dois casos são indistinguíveis de propósito. `details.reason` nomeia o tipo de recurso, e `details.id`, o id que você pediu, quando há um; um caminho que não existe não traz `details` ([O que `details` contém](#details)). |

### Conflitos {#codes-state}

| `code` | Status | API | Descrição |
|---|---|---|---|
| `conflict` | 409 | Webhooks | A requisição se choca com o estado existente: um nome já em uso, ou um `Idempotency-Key` reutilizado com outro corpo ([Idempotência](/docs/idempotency#conflicts)). `details.reason` diz qual é o caso, conforme a tabela abaixo. |

Cada `details.reason` que um `conflict` traz, quando ele é enviado, e as outras chaves em `details`:

| `details.reason` | Quando | Outras chaves em `details` |
|---|---|---|
| `event_type_exists` | Um tipo de evento com esse nome já está registrado no mesmo escopo: no workspace inteiro, ou no projeto que você indicou. | `event_type`: o nome |
| `project_not_empty` | Excluir um projeto que ainda contém endpoints ou fontes. Exclua-os primeiro. | `id`: o projeto. `endpoints` e `sources`: quantos ele contém |
| `idempotency_key_reuse` | Um `Idempotency-Key` reutilizado com outro corpo ([Idempotência](/docs/idempotency#webhooks)). O evento original continua valendo. | `idempotency_key`: a chave |
| `delivery_not_redeliverable` | Reenviar uma entrega que ainda está na fila ou sendo enviada. Só uma entrega `sent`, `failed` ou `dead` pode ser reenviada. | `id`: a entrega. `state`: `queued`, `sending`, `sent`, `failed` ou `dead`, ou `missing` se a entrega foi excluída nesse meio-tempo |
| `delivery_exists` | Reenviar um evento para um endpoint que já tem uma entrega dele. Em vez disso, reenvie essa entrega. | `event_id` e `endpoint_id` |
| `endpoint_not_enabled` | Reenviar um evento para um endpoint que está desligado, por você ou automaticamente após falhas repetidas. | `id`: o endpoint. `state`: `disabled` (por você) ou `auto_disabled` (automaticamente) |
| `endpoint_suspended` | Reenviar um evento para um endpoint que suspendemos. | `id`: o endpoint. `cause`: `abuse`, `non_payment` ou `plan_downgrade`; o mais grave quando vários se aplicam, e ausente quando nenhum deles se aplica |
| `endpoint_has_pending_deliveries` | Excluir um endpoint que ainda tem entregas na fila, sendo enviadas ou aguardando uma retentativa. O endpoint é desativado mesmo com a exclusão recusada, então nenhuma entrega nova chega a ele; tente a exclusão de novo quando elas terminarem. | `id`: o endpoint. `count`: suas entregas pendentes |
| `replay_across_projects` | Reenviar um evento para um endpoint de outro projeto. | `event_id` e `endpoint_id` |

Um reenvio em lote cujo `from` é posterior ao `to` não é um conflito: é um `422` `validation_error` ([Validação da requisição](#codes-validation)).

### Limites de requisições {#codes-rate}

| `code` | Status | API | Descrição |
|---|---|---|---|
| `rate_limited` | 429 | Ambas | Requisições demais. Se `Retry-After` estiver definido, espere esse número de segundos e tente de novo; caso contrário, aplique backoff. `details.retry_after` traz o mesmo número nas duas APIs, e no Inboxes um limite por caixa de entrada também define `details.reason` como `inbox_rate`, com `details.rate_per_min`. |
| `rate_limited` | 429 | Request Bins | Mais de 10 envios de teste para a URL de encaminhamento de um bin em um minuto. `details.retry_after` diz quantos segundos faltam até o próximo ser permitido. |

A API de Request Bins envia `rate_limited` só para envios de teste ([Testar uma URL de encaminhamento](/docs/product-bins/reference#forward-test)). As URLs dos bins limitam a velocidade com que os remetentes podem enviar e respondem a um remetente acima do limite com um `429` e `Retry-After`, não neste formato JSON ([O que a URL de um bin responde](/docs/product-bins/reference#edge-answers)).

### Servidor {#codes-server}

| `code` | Status | API | Descrição |
|---|---|---|---|
| `internal_error` | 500 | Todas | Algo quebrou do nosso lado. É seguro repetir requisições idempotentes. |
| `unavailable` | 503 | Inboxes | Temporariamente sem condições de atender a requisição: a aceitação de mensagens está desligada, e `details.reason` é `ingest_disabled`. Tente de novo com backoff. |
| `unavailable` | 503 | Request Bins | O encaminhamento não consegue atender a requisição: definir uma URL de encaminhamento ou enviar um teste enquanto o encaminhamento está desligado para todo o serviço (`details.reason` `forwarding_disabled`), ou um teste que não foi pego para envio em até 3 segundos, então nada foi enviado (`forwarder_unavailable`). Tente de novo mais tarde. |

Um `502` ou `504` vindo do edge que fica na frente das APIs pode chegar sem nenhum corpo JSON. Trate um `5xx` que você não consegue interpretar como passível de nova tentativa.

### Resultados de teste e verificação {#failure-reason}

Testar ou verificar um endpoint do Webhooks (`POST /v1/endpoints/{id}/test`, `POST /v1/endpoints/{id}/verify`) envia uma requisição a ele e responde `200` com o resultado, quer essa requisição tenha dado certo ou não, então uma falha ali não é uma resposta de erro. `delivered` em um teste, ou `verified` em uma verificação, diz se funcionou. Em uma falha, `error` a descreve em inglês e `failure_reason` a nomeia como uma string de máquina estável:

| `failure_reason` | O que aconteceu |
|---|---|
| `http_status` | O endpoint respondeu com um status fora de `2xx`; `status_code` diz qual. |
| `timeout` | Nenhuma resposta dentro do timeout do endpoint. |
| `tls_failed` | O handshake TLS falhou, na maioria das vezes porque o certificado não passa na verificação. |
| `dns_failed` | O host não resolve. |
| `connection_failed` | Qualquer outra falha de conexão, como uma conexão recusada, resetada ou inalcançável. |
| `blocked_address` | O host resolve para um endereço privado ou não público por outro motivo, para o qual o Webhooks nunca envia. |
| `challenge_not_echoed` | Só na verificação: o endpoint respondeu `2xx` sem o token do desafio no corpo. |
| `url_changed` | Só na verificação: a URL do endpoint mudou enquanto o desafio estava pendente. Verifique de novo. |

`failure_reason` é `null` em caso de sucesso e em uma falha que nenhum destes descreve, em que `error` é a única descrição. Assim como `code`, é uma string aberta, não um enum: mantenha um caso padrão para um valor que você não conhece e tome decisões com base em `failure_reason` em vez de fazer parsing de `error`.

## Quando um código é renomeado {#renames}

O Inboxes e o Webhooks concluíram suas renomeações em 15 de outubro de 2026, antes do lançamento da v1, em vez de depois de 12 meses. No Inboxes, `invalid_request` agora é `validation_error`, uma chave de API ou um token que ele não reconhece ou não consegue verificar é `invalid_credential` (ainda um `401`), e um status sem código próprio traz o código desse status, como `bad_request` para um `400`. No Webhooks, `internal` agora é `internal_error`, `unprocessable` agora é `validation_error`, e `plan_violation` deixou de existir: cada uma de suas recusas envia o código que o seu `next_code` indicava, com o status desse código. Nenhuma das duas APIs envia `next_code` hoje. Depois do lançamento da v1, uma renomeação é anunciada no [changelog](/changelog), e a grafia antiga continua sendo enviada em `error.code` por pelo menos 12 meses depois disso, o mesmo período que a [política de descontinuação](/docs/versioning#deprecation) dá a um campo.

Enquanto uma renomeação está em andamento, o erro também traz `next_code`: a grafia que `code` vai ter quando a renomeação for concluída. É esse campo, e não um header de resposta `Deprecation`, que indica que o código de um erro está sendo renomeado.

Decida com base em `next_code` quando ele estiver presente e em `code` caso contrário (`error.next_code ?? error.code`). Um handler escrito assim não precisa de mudança quando uma renomeação é concluída: a partir daí, `code` traz a nova grafia, e `next_code` deixa de ser enviado para ele. Se você só consegue ler `code`, por exemplo por meio de um SDK que repassa apenas `code`, aceite as duas grafias até a renomeação ser concluída.

As renomeações concluídas em 15 de outubro de 2026, com as recusas que mudaram junto com elas:

| API | Situação | Antes | Agora |
|---|---|---|---|
| Inboxes | Uma requisição que falha na validação | `422` `invalid_request`, `next_code` `validation_error` | `422` `validation_error` |
| Inboxes | Uma chave de API ou um token que ele não reconhece, ou que falha na verificação | `401` `unauthorized`, `next_code` `invalid_credential` | `401` `invalid_credential` |
| Inboxes | Um status sem código próprio, como um corpo que não é UTF-8 válido | `error`, `next_code` o código que esse status tem em outros lugares | o código desse status, como `400` `bad_request` |
| Inboxes | Uma credencial limitada a certos projetos | `403` `forbidden`, `details.reason` `project` | `403` `forbidden`, `details.reason` `project_confined` |
| Inboxes | `quota_exceeded`, o `not_entitled` da API de leitura e o `rate_limited` por caixa de entrada | `details` também trazia `max_inboxes`, `max_http_bins`, `monthly_messages`, `plan` ou `inbox_id` | `details` traz apenas as chaves que [O que `details` contém](#details) lista |
| Webhooks | Todo `500` | `internal`, `next_code` `internal_error` | `internal_error` |
| Webhooks | Um campo que a própria API verifica (uma `url` de endpoint que não é https, um filtro `status` ou tipo de evento operacional desconhecido, uma janela de uso que não pode ser interpretada ou não termina depois de começar) | `422` `unprocessable`, `next_code` `validation_error` | `422` `validation_error` |
| Webhooks | O limite de endpoints (`POST /v1/endpoints`) | `402` `plan_violation`, `next_code` `quota_exceeded` | `402` `quota_exceeded`, `details.reason` `allocation` |
| Webhooks | `max_attempts` acima do teto do plano (`POST /v1/endpoints`, `PATCH /v1/endpoints/{id}`) | `402` `plan_violation`, `next_code` `validation_error` | `422` `validation_error`, tipo de entrada `webhooks.max_attempts_above_plan` |
| Webhooks | Uma fonte RabbitMQ abaixo do Pro | `402` `plan_violation`, `next_code` `not_entitled` | `402` `not_entitled`, `details.feature` `rabbitmq_sources` |
| Webhooks | Desativar a verificação de endpoint em um plano que a exige (`PATCH /v1/workspace`); nenhum plano exige hoje | `402` `plan_violation`, `next_code` `not_entitled` | `402` `not_entitled`, `details.feature` `optional_endpoint_verification` |
| Webhooks | Um reenvio em lote cujo `from` é posterior ao `to` (`POST /v1/deliveries/replay`) | `409` `conflict`, `details.reason` `replay_window_inverted` | `422` `validation_error`, tipo de entrada `webhooks.end_before_start` em `["body", "to"]` |
| Webhooks | As regras próprias do Webhooks para headers personalizados, `retry_schedule`, campos de broker e nomes de plano | tipo de entrada `value_error` | o tipo de entrada próprio da regra ([Validação da requisição](#codes-validation)); `loc`, `msg` e `params` inalterados |
| Webhooks | Qualquer erro de validação | `details`: uma lista de entradas | `details`: `{"errors": [...]}`, como no Inboxes |

Um handler que decidia com base em `error.next_code ?? error.code` recebe o mesmo código de antes em todas as situações acima, exceto no reenvio em lote. Um que lia `error.details` como lista em um erro de validação do Webhooks agora lê `error.details.errors`; um que lia as chaves removidas de `quota_exceeded` do Inboxes lê `metric`, `limit`, `current` e `period`; um que comparava com o motivo `project` de `forbidden` do Inboxes compara com `project_confined`; e um que comparava com o `type` de entrada `value_error` do Webhooks compara com o tipo próprio da regra.

`unauthorized` não foi aposentado: ele continua sendo o código para uma credencial ausente ou revogada nas duas APIs, para uma sessão de login que terminou no Inboxes e para um evento recebido cuja assinatura não passa na verificação no Webhooks.

## Códigos que esta página listava {#earlier-versions}

Versões anteriores desta página listavam os códigos e campos da esquerda. As APIs não os enviavam; elas enviam o que está à direita. Dois deles se tornaram realidade desde então, `request_id` nos corpos de erro e `internal_error` em todas as APIs, e as linhas deles dizem como.

| Versões anteriores listavam | As APIs enviam |
|---|---|
| `validation_failed` (400) | `validation_error` (422) |
| `fields` | `details`: `{"errors": [...]}` nas duas APIs |
| `request_id` em todo corpo | Não era enviado enquanto essas versões estavam em vigor: o id estava apenas no header de resposta `X-Request-ID`. Desde as atualizações indicadas no topo desta página, todo corpo de erro que as APIs enviam também o traz, como `error.request_id`, com o mesmo valor do header ([O id da requisição](#request-id)). |
| `malformed_json` (400), `unsupported_content_type` (415) | `validation_error` (422) |
| `request_too_large` | `payload_too_large` (413) |
| `no_credentials` (401) | `unauthorized` (401) |
| `invalid_credentials`, `expired_credentials` (401) | `invalid_credential`: um `403` no Webhooks, um `401` no Inboxes. Uma sessão de login que expirou é `unauthorized` (401) no Inboxes |
| `scope_required`, `wrong_project` (403) | `forbidden` (403); `details.reason` diz por quê (`scope`, `project`, `project_confined`, …), e `details.required` nomeia um escopo que falta |
| `already_exists`, `state_conflict`, `not_empty`, `idempotency_key_reused` (409) | `conflict` (409); `details.reason` diz qual é o caso (`event_type_exists`, `project_not_empty`, `idempotency_key_reuse`, …) |
| `rate_limit_exceeded` | `rate_limited` (429) |
| `quota_exceeded` como 429 | `quota_exceeded` como 402 |
| `internal_error` em todas as APIs | `internal_error` nas duas APIs desde 15 de outubro de 2026; antes, o Webhooks enviava `internal` |
| `service_unavailable` (503), `gateway_timeout` (504) | `unavailable` (503) no Inboxes, quando a aceitação de mensagens está desligada, e no Request Bins, quando o encaminhamento não consegue atender uma requisição; um `502`/`504` do gateway pode não ter corpo JSON |

## Padrão de tratamento {#pattern}

```ts
async function call(): Promise<Event> {
  const res = await fetch(url, opts)
  if (res.ok) return await res.json()

  // A gateway 502/504 can arrive without a JSON body
  const body = await res.json().catch(() => null)
  const error = body?.error ?? { code: 'error', message: res.statusText }
  // Log this with every error; the header carries it when the body doesn't
  const requestId = error.request_id ?? res.headers.get('X-Request-ID')
  // While a code is being renamed, next_code is what it will become: prefer it
  const code = error.next_code ?? error.code

  // Switch on the code, not the status: one status can carry several codes
  switch (code) {
    case 'rate_limited': {
      const wait = Number(res.headers.get('Retry-After') ?? '1')
      await sleep(wait * 1000)
      return call() // retry
    }
    case 'invalid_credential': // All: a key the API can't accept (403 on Webhooks, 401 on Inboxes and Request Bins)
    case 'unauthorized': // All: no usable credential
      // The credential is missing or bad: replace it rather than retry with it
      throw new CredentialError(error, requestId)
    case 'forbidden': {
      // Optional refinement: why it was refused, and what would have been allowed
      const reason = error.details?.reason // 'scope', 'role', 'project', 'project_confined', 'csrf', …
      const required = error.details?.required // 'admin', 'member', 'read' or 'publish', when sent
      throw new PermissionError(error, requestId, reason, required)
    }
    case 'validation_error': { // All
      const entries = error.details?.errors ?? []
      throw new ValidationError(entries, requestId)
    }
    case 'quota_exceeded':
    case 'not_entitled':
      // Retrying won't help; the plan has to change, or the period has to roll over
      throw new PlanError(error, requestId)
    default:
      // Unknown code, but the family tells us the rough shape
      if (res.status >= 500) {
        // Server-side; safe to retry idempotent ops
        throw new RetryableError(error, requestId)
      }
      throw new TerminalError(error, requestId)
  }
}
```

A regra geral: **decida com base em `error.next_code ?? error.code` e, por padrão, trate pela família do status**. Novos códigos adicionados a status existentes não vão quebrar sua aplicação; o seu caso padrão os trata. `details.reason` refina um caso e nunca o substitui: um motivo que você não reconhece recebe o tratamento do código. Não faça parsing de `message`; quando um valor é destinado a código, como o id que não foi encontrado ou o limite que foi atingido, ele está em `details`. A mesma regra vale para um painel ou um SDK construído sobre essas APIs: os [SDKs](/docs/product-webhooks/sdks) publicados repassam `error.code` sem alteração, então decida com base no código que a exceção traz e aceite as duas grafias de um código que está sendo renomeado.

## Reportar bugs {#bugs}

Toda resposta que uma API envia traz um header `X-Request-ID`, inclusive as de erro, e as APIs permitem que o JavaScript do navegador o leia. Os corpos de erro delas trazem o mesmo id em `error.request_id`. Quando algo está errado do nosso lado (5xx, comportamento inesperado), é o id da requisição que nos permite encontrar a chamada nos nossos logs. Registre-o em log junto com cada erro e inclua-o nos tickets de suporte.

Não compartilhe ids de requisição publicamente (eles não são secretos, mas permitem que qualquer pessoa que os tenha nos pergunte sobre o tráfego da sua conta). Use-os em canais privados (suporte, tickets pelo painel).

## Próximos passos {#next-steps}

- [Convenções](/docs/conventions) — o resto do formato de requisição/resposta.
- [Autenticação](/docs/authentication) — os códigos de erro de autenticação em contexto.
- [Limites de requisições](/docs/rate-limiting) — o funcionamento do `Retry-After` em detalhe.
- [Idempotência](/docs/idempotency) — padrão de retentativa segura para os casos de 5xx + 429.
- [Política de versionamento](/docs/versioning) — o que conta como mudança incompatível e o período de descontinuação de 12 meses que a renomeação de um código também recebe.
