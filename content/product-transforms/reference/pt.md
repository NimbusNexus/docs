---
title: "Referência de Transforms"
description: "Todas as rotas da API de Transforms, os objetos de pipeline e de execução, quem pode fazer o quê, os limites de cada plano e os erros."
publishedAt: 2026-11-06
updatedAt: 2026-11-06
kind: reference
---

# Referência de Transforms

A API em `https://transforms.nimbusnexus.net/v1` cria, versiona, testa e executa pipelines, apenas para o seu workspace. Requisições e respostas são JSON. Envie uma chave como `Authorization: Bearer <key>` ou `X-API-Key: <key>` ([Como obter acesso](/docs/product-transforms#access)). Os timestamps são ISO 8601 em UTC. A [visão geral](/docs/product-transforms) explica o produto, e [Pipelines](/docs/product-transforms/pipelines), o documento.

## Rotas {#routes}

| Rota | O que faz | Exige |
| --- | --- | --- |
| `POST /v1/pipelines` | Cria um pipeline e a versão 1 dele; `201` com [o pipeline](#pipeline) | write; com uma etapa de credencial, admin |
| `GET /v1/pipelines` | Os pipelines do workspace, do mais novo para o mais antigo, cada um sem o documento | read |
| `GET /v1/pipelines/{id}` | Um pipeline, com o documento atual e onde ele roda | read |
| `PATCH /v1/pipelines/{id}` | Renomeia o pipeline, o liga ou desliga, ou [salva uma nova versão](#versions) | write; com uma nova etapa de credencial, admin |
| `DELETE /v1/pipelines/{id}` | Exclui um pipeline e as versões dele, para sempre; `204` | admin |
| `GET /v1/pipelines/{id}/versions` | As versões mantidas, da mais recente para a mais antiga, cada uma sem o documento | read |
| `GET /v1/pipelines/{id}/versions/{version}` | Uma versão, com o documento dela | read |
| `POST /v1/pipelines/{id}/run` | [Executa](#run) um pipeline salvo sobre uma requisição | read |
| `POST /v1/pipelines/test` | [Testa](#test) um documento sobre uma requisição, sem salvar nem contar nada | write |
| `GET /v1/pipelines/templates` | Os [templates](/docs/product-transforms/pipelines#templates) para começar | read |
| `POST /v1/slots` | Adiciona um [slot de credencial](#slots); `201` com o slot | admin |
| `GET /v1/slots`, `GET /v1/slots/{id}` | Os slots do workspace, do mais novo para o mais antigo, ou um só | read |
| `PATCH /v1/slots/{id}` | Renomeia um slot | admin |
| `DELETE /v1/slots/{id}` | Exclui um slot; `204` | admin |
| `GET /v1/plan` | O plano do workspace e os limites dele | read |
| `GET /v1/usage` | As execuções deste mês e o que o workspace tem | read |

**read**, **write** e **admin** são explicados em [Quem pode fazer o quê](#authority).

As listas são paginadas com `limit` (de 1 a 200, padrão 50) e `offset` (de 0 a 10,000). A resposta é `{"items": [...], "next_offset": <offset>}`: passe `next_offset` de volta como `offset` para obter a próxima página. Ele é `null` na última página.

## O objeto pipeline {#pipeline}

| Campo | Descrição |
| --- | --- |
| `id` | `pipe_` e 24 caracteres hexadecimais. Toda rota o recebe, e um produto referencia o pipeline por ele. |
| `name` | O nome que você dá a ele, com até 200 caracteres. |
| `status` | `enabled` ou `disabled`: o seu interruptor. Um pipeline desativado não roda, nem aqui nem em qualquer produto que o referencie. |
| `current_version` | A versão que roda. |
| `pipeline` | O documento da versão atual; `null` na lista. |
| `destinations` | Os serviços que o executam por referência, cada um uma vez; `null` na lista ([Quem executa um pipeline](#destinations)). |
| `consumers` | O que cada um deles executa: `service`, `version`, `last_seen_at`, a última leitura dessa versão, e `pinned`, `true` quando uma referência fixa essa versão; `null` na lista. |
| `created_at`, `updated_at` | Quando ele foi criado e quando foi alterado pela última vez. |

`POST /v1/pipelines` recebe `name` e `pipeline`. Um documento que nunca conseguiria rodar é recusado com [`422` `invalid_pipeline`](#invalid-pipeline) e, acima dos pipelines do plano, a resposta é `402` `quota_exceeded`, com `details.metric` `pipelines`, `details.limit` e `details.current`.

## Versões {#versions}

`PATCH /v1/pipelines/{id}` recebe qualquer um de `name`, `status` e `pipeline`. Um `pipeline` novo é verificado como na criação e salvo como a próxima versão.

- Uma versão nunca muda, então um produto pode guardar a própria cópia pelo id e pela versão.
- Salvar o mesmo conteúdo não adiciona nenhuma versão.
- Restaurar uma versão antiga é salvar o conteúdo dela de novo, o que faz dele a versão mais recente.
- As versões do plano são mantidas, começando pelas mais recentes, e um salvamento remove as mais antigas além desse número. Uma versão que um produto fixa, ou que foi visto executando nos últimos 30 dias, também é mantida.

Cada versão em `GET /v1/pipelines/{id}/versions` tem `version`, `created_by` e `created_at`; `GET /v1/pipelines/{id}/versions/{version}` acrescenta o `pipeline` dela. Uma versão que já não é mantida responde `404` `not_found`, `pipeline_version`.

## Executar um pipeline {#run}

`POST /v1/pipelines/{id}/run` executa a versão atual, ou a versão mantida que `version` indica, sobre o que você envia:

| Campo | Descrição |
| --- | --- |
| `body` | Qualquer valor JSON, com até 256 KiB como JSON compacto e no máximo 32 níveis de aninhamento. |
| `headers` | Um valor por nome, no máximo 256. Um nome tem até 256 caracteres e um valor até 8,192. Acima disso, a resposta é `422` `validation_error`. |
| `meta` | Contexto somente leitura para `$meta`: qualquer valor JSON, com no máximo 32 níveis de aninhamento. |
| `version` | A versão mantida a executar. Sem ele, a atual. |

Nada da requisição é guardado, e a execução é contada. A resposta é um `200`, independentemente do que o pipeline tenha feito:

| Campo | Descrição |
| --- | --- |
| `status` | `ok`, envie `body` e `headers`; `dropped`, um filtro descartou a requisição, então não envie nada; `failed`, o pipeline não consegue rodar com esta requisição. |
| `version` | A versão que rodou; `null` em um [teste](#test). |
| `body`, `body_changed` | O corpo a enviar, e `true` quando uma etapa o reescreveu. `null`, a menos que o resultado seja `ok`. |
| `headers` | Os headers a enviar, com o valor de uma credencial mascarado como `Bearer ••••`. |
| `query` | O que uma etapa `auth` acrescenta à URL, mascarado da mesma forma. |
| `step` | A etapa que descartou a requisição ou a fez falhar, contada a partir de 0; caso contrário, `null`. |
| `note` | A nota de uma etapa que descarta. |
| `reason` | `no_match` para um filtro ao qual a requisição não correspondeu, `matched` para um filtro de descarte ao qual ela correspondeu, ou por que ela falhou, como `set_conflict` ou `too_many_nodes`. Trate-o como uma string aberta. |
| `error` | O mesmo em palavras, como `step 2: set_conflict: …`. |
| `duration_ms` | Quanto tempo a execução levou. |

O mesmo pipeline com a mesma requisição falha do mesmo jeito, então não tente de novo um `failed`. Um pipeline desativado responde `409` `conflict`, `pipeline_disabled`, e acima da taxa do plano uma execução responde `429` `rate_limited`, com `details.retry_after`.

## Testar um documento {#test}

`POST /v1/pipelines/test` recebe `pipeline`, um documento que não precisa estar salvo, com `body`, `headers` e `meta`. Ele é verificado como em um salvamento, roda uma vez e não salva nem conta nada, embora compartilhe a taxa do plano. Um descarte ou uma falha é um `200` que diz isso.

## Slots de credencial {#slots}

Um slot é o que uma etapa `auth` indica: um id e um rótulo, sem valor. O Transforms não armazena nenhuma credencial, e nenhuma rota recebe uma. Um produto que executa o pipeline por referência associa o slot a um segredo próprio ([Credenciais](/docs/product-transforms#credentials)). `POST /v1/slots` recebe `label`, com até 200 caracteres, e responde `201`:

| Campo | Descrição |
| --- | --- |
| `id` | `sec_` e letras e dígitos: o que uma etapa `auth` indica, e ele nunca muda. |
| `label` | Para que serve a credencial. Os produtos veem esse rótulo quando associam o slot a um segredo. |
| `pipeline_count` | Quantos pipelines o indicam na versão atual. |
| `created_at`, `updated_at` | Quando ele foi adicionado e quando foi renomeado pela última vez. |

`PATCH /v1/slots/{id}` recebe `label`. `DELETE /v1/slots/{id}` responde `204`, ou `409` `conflict`, com `details.reason` `slot_in_use`, `details.id` e `details.pipelines`, o número de pipelines, enquanto a versão atual de um pipeline o indicar. Acima dos slots do plano, adicionar um responde `402` `quota_exceeded`, com `details.metric` `slots`.

## Quem executa um pipeline {#destinations}

Um produto referencia um pipeline pelo id e o executa no próprio processo, com os próprios segredos. O Webhooks é o primeiro: [Transformações](/docs/product-webhooks/transformations#reference). Toda vez que um produto obtém o pipeline, o serviço e a versão são registrados, então a leitura de um pipeline mostra `destinations` e `consumers`.

Salvar uma nova versão com uma etapa `auth` alcança todos os produtos que executam o pipeline, e excluí-lo também. Cada uma dessas chamadas precisa indicar em `confirm_destinations` todos os serviços que têm uma referência ou foram vistos nos últimos 30 dias, no corpo de um `PATCH` e na query de um `DELETE`. Caso contrário, a resposta é um `409` `conflict` com `details.reason` `destinations_unconfirmed` e `details.destinations`, e nada muda. As próprias URLs de um serviço nunca aparecem aqui: esse produto faz a mesma pergunta em relação a elas.

## Quem pode fazer o quê {#authority}

| | Ler pipelines, versões, templates, slots, plano e uso; executar | Criar, alterar e testar pipelines | Excluir um pipeline, salvar uma etapa de credencial ou adicionar, renomear ou excluir um slot |
| --- | --- | --- | --- |
| Proprietário ou admin do workspace | sim | sim | sim |
| Membro | sim | sim | não |
| Viewer, ou qualquer outra função | sim | não | não |
| Chave com **Read & write** (escopo `admin`) | sim | sim | sim |
| Chave com **Read** (escopo `read`) | sim | não | não |

Uma ação recusada responde `403` `forbidden` com `details.reason` `role`, e `details.required` indica a função necessária. Um membro ainda pode renomear um pipeline com uma etapa de credencial, executá-lo, testá-lo e remover a etapa. O console da conta cria chaves **Read** e **Read & write**, e uma chave com qualquer outro escopo, como `write`, é tratada como **Read**.

O Transforms atende workspaces inteiros. Um assento de convidado, ou uma chave restrita a um projeto, é recusado com `403` `project_confined`. Um workspace tem o Transforms depois que um proprietário ou admin abre o console ou o adiciona em **Add a product**. Até lá, os outros membros são recusados com `403` `product_not_enabled`.

## Planos e limites {#limits}

`GET /v1/plan` informa quais limites se aplicam: `plan`, o plano registrado; `enforced_as`, o plano cujos limites se aplicam, `free` quando não há nenhum; `ceilings`, os limites pelo nome; `past_due`, `suspended` e `system`.

| Chave em `ceilings` | Descrição | Free | Starter | Pro | Custom |
| --- | --- | --- | --- | --- | --- |
| `max_pipelines` | Pipelines que um workspace pode ter | 5 | 25 | 100 | 1,000 |
| `max_secret_slots` | Slots de credencial que um workspace pode ter | 5 | 25 | 100 | 1,000 |
| `max_versions` | Versões mantidas por pipeline | 10 | 25 | 50 | 100 |
| `run_rate_per_min` | Execuções e testes por minuto, por workspace | 60 | 600 | 3,000 | 12,000 |

Até o equivalente a dez segundos de execuções, e no mínimo 10, podem chegar de uma vez. `GET /v1/usage` informa quanto já foi usado: `period`, o mês, representado pelo primeiro dia; `runs`, `failures` e `dropped` deste mês, pela API de execução; `pipelines` em relação a `max_pipelines`; e `slots`, os slots existentes, em relação a `max_secret_slots`. As execuções são contadas, não cobradas, e uma execução em um produto que referencia o pipeline conta no uso desse produto.

Enquanto houver uma cobrança em aberto, as alterações são recusadas com `402` `workspace_frozen`, e as execuções e os testes continuam. Depois que o período de carência termina, as execuções e os testes também são recusados, com `402` `workspace_suspended`. As leituras e as exclusões continuam liberadas.

## Erros {#errors}

Os erros da API usam o formato descrito em [Erros](/docs/errors).

| Status | `code` | Quando |
| --- | --- | --- |
| `400` | `bad_request` | Um corpo JSON que não é UTF-8 válido. |
| `401` | `unauthorized` | Nenhuma credencial, uma credencial revogada ou uma sessão de login do console que terminou; `details.reason` diz qual. |
| `401` | `invalid_credential` | Uma chave que não passa na verificação, expirou ou foi criada para outro produto. |
| `402` | `quota_exceeded` | Criar um pipeline ou adicionar um slot quando todos os do plano estão em uso; `details.metric` é `pipelines` ou `slots`. |
| `402` | `workspace_frozen`, `workspace_suspended` | Uma alteração enquanto há uma cobrança em aberto, ou qualquer coisa que não seja uma leitura ou uma exclusão depois que o serviço foi interrompido. |
| `403` | `forbidden` | `details.reason` é `role`, `project_confined`, `product_not_enabled`, `csrf` ou `no_workspace`. |
| `404` | `not_found` | Não há esse pipeline, essa versão nem esse slot no seu workspace; `details.reason` é `pipeline`, `pipeline_version` ou `slot`. |
| `405` | `method_not_allowed` | O caminho existe, mas não para este método. |
| `409` | `conflict` | `details.reason` é `pipeline_disabled` ([Executar um pipeline](#run)), `destinations_unconfirmed` ([Quem executa um pipeline](#destinations)) ou `slot_in_use` ([Slots de credencial](#slots)). |
| `413` | `payload_too_large` | Um corpo de requisição acima de 1 MiB. |
| `422` | `invalid_pipeline` | Um pipeline que nunca conseguiria rodar, ao ser salvo ou testado. |
| `422` | `validation_error` | Um parâmetro ou campo falhou na validação. Um caractere NUL no caminho, na query ou em um corpo JSON aparece como uma entrada do tipo `transforms.nul_character`. |
| `429` | `rate_limited` | Acima das execuções por minuto do plano; `details.retry_after` diz quando tentar de novo. |
| `500` | `internal_error` | Algo quebrou do nosso lado. |

### Pipelines inválidos {#invalid-pipeline}

A recusa indica o primeiro problema: `details.reason`, `details.path` (um JSON Pointer até ele) e `details.step` (contado a partir de 0), cada um quando se aplica.

```json
{ "error": { "code": "invalid_pipeline", "message": "…", "details": { "reason": "credential_header", "path": "/steps/0/headers/set/Authorization", "step": 0 }, "request_id": "…" } }
```

| `reason` | O que está errado |
| --- | --- |
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
| `invalid_secret` | O `secret` de uma etapa de credencial não é o id de um slot. Um valor colado ali nunca é repetido. |
| `auth_not_last` | Há uma etapa depois de uma etapa de credencial. |
| `too_deep` | Algo está aninhado em mais de 32 níveis. |
| `too_large` | As configurações de uma etapa passam de 16 KiB, ou o documento passa de 64 KiB. |
| `not_json` | O documento contém um valor que não é JSON. |
| `forbidden_header` | Uma etapa define `Set-Cookie`, um header que nenhuma requisição traz. |
| `credential_header` | Uma etapa de headers define `Authorization`, `Cookie` ou `X-Api-Key`, o que guardaria a credencial no pipeline. Em vez disso, adicione-a com uma etapa de credencial. |
| `unknown_slot` | Uma etapa de credencial indica um slot que o workspace não tem. |

Trate `reason` como uma string aberta e mantenha um caso padrão para um valor que você não conhece.

## Próximos passos {#next-steps}

- [Início rápido](/docs/product-transforms/quickstart) — teste um pipeline, salve-o e execute-o.
- [Pipelines](/docs/product-transforms/pipelines) — todas as etapas, caminhos, filtros e templates.
- [Erros](/docs/errors) — o formato do erro, todas as chaves de `details` e um padrão para tratá-los.
