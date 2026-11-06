---
title: "Transforms"
description: "Pipelines declarativos que filtram, enxugam e remodelam uma requisição. Monte, versione e teste esses pipelines em um só lugar e depois execute-os pela API ou por referência, a partir do produto que envia."
publishedAt: 2026-11-06
updatedAt: 2026-11-06
kind: concept
---

# Transforms

O NimbusNexus Transforms faz dos **pipelines** objetos independentes. Um pipeline é uma lista curta de etapas declarativas que descartam uma requisição a menos que ela corresponda, removem ou adicionam campos, remontam o corpo a partir de um template e definem headers. Monte um no console ou pela API REST, teste-o, mantenha as versões dele, execute-o pela API ou referencie-o pelo id a partir do produto que envia.

> **Não é a página que você procurava?** O Transforms não envia nada por conta própria. Para mudar o que um endpoint recebe em cada entrega, veja [Transformações](/docs/product-webhooks/transformations) no Webhooks e, para mudar o que um bin encaminha, veja [Um pipeline antes de cada encaminhamento](/docs/product-bins/forwarding#pipeline) no Request Bins. Experimente um pipeline sem conta no [playground](/transforms/playground).

## Em resumo {#at-a-glance}

| | |
| --- | --- |
| O que você cria | Um **pipeline**: um documento JSON de até 20 etapas, como `{"version": 1, "steps": [{"drop": ["**.email"]}]}` |
| O que ele faz | Filtra uma requisição, remove ou adiciona campos, remonta o corpo a partir de um template e define headers |
| O que ele não faz | Enviar qualquer coisa ou guardar algo do que processa. Ele não é um relay |
| Console | `https://transforms.nimbusnexus.net` |
| URL base da API | `https://transforms.nimbusnexus.net/v1` |
| Autenticação | `Authorization: Bearer <key>`, uma chave criada no console da conta com **Transforms** como produto |
| Identificador | O `id` do pipeline, por exemplo `pipe_8e27d40b19c3f6a5e0d71b42` |
| Experimentar um documento | `POST /v1/pipelines/test`, que não salva nem conta nada |
| Executar um pipeline salvo | `POST /v1/pipelines/{id}/run`, que responde o que ele fez |
| Todas as etapas, caminhos e filtros | [Pipelines](/docs/product-transforms/pipelines) |
| Todas as rotas, funções e limites | A [referência de Transforms](/docs/product-transforms/reference) |

## Como funciona {#how}

1. **Monte** um pipeline: adicione etapas no formulário do console, cole-as em JSON ou comece a partir de um [template](/docs/product-transforms/pipelines#templates). Um documento que nunca conseguiria rodar é recusado ao ser salvo, com `422` `invalid_pipeline`, indicando a etapa, o caminho e o motivo.
2. **Teste-o**. Execute o que está no editor em uma requisição que você colar e veja o corpo e os headers que ele enviaria, a etapa que a descartou ou por que falhou.
3. **Salve-o**. Salvar conteúdo novo adiciona uma versão, e uma versão nunca muda. O mesmo conteúdo de novo não adiciona nenhuma, e restaurar uma versão antiga é salvar o conteúdo dela de novo.
4. **Execute-o**, de uma de duas formas:
   - **Pela API.** Envie uma requisição para `POST /v1/pipelines/{id}/run`. Ela executa o pipeline sobre o que você envia, responde com o resultado e não guarda nada. Enviar o resultado para algum lugar cabe a você.
   - **Por referência.** Referencie o pipeline pelo id a partir do Webhooks, que o executa antes de cada entrega, no próprio processo. Cada versão nova chega a ele sem mudar nenhum endpoint.

O [início rápido](/docs/product-transforms/quickstart) faz os passos 1 a 4 pela API.

## O que uma execução responde {#answers}

Um pipeline não tem loops, relógio nem rede, então o mesmo pipeline sempre faz a mesma coisa com a mesma requisição. Uma execução responde `200` com um de três status, porque em todos os casos o pipeline rodou:

| `status` | O que significa | O que fazer |
| --- | --- | --- |
| `ok` | `body`, `headers` e `query` são a requisição a enviar. | Envie-a. |
| `dropped` | Um filtro descartou a requisição. `step`, `note` e `reason` dizem qual e por quê. | Não envie nada. |
| `failed` | O pipeline não consegue rodar com esta requisição. `step`, `reason` e `error` dizem por quê, como um limite que ele ultrapassou. | Altere o pipeline ou a requisição. A mesma requisição falha do mesmo jeito, então não tente de novo. |

## Credenciais {#credentials}

O Transforms não guarda credenciais. A etapa `auth` de um pipeline diz que um bearer token, autenticação básica ou uma chave de API vai na requisição e indica um **slot** para essa credencial. Um slot é um id e um rótulo, sem valor: adicione um no console, em **Credential slots**, ou com `POST /v1/slots`. O documento traz o id do slot e nada mais, então um pipeline lido de volta nunca mostra uma credencial, e nenhuma rota recebe nem retorna o valor de uma credencial.

Para enviar uma, execute o pipeline por referência a partir do produto que envia. Esse produto associa o slot a um segredo no próprio armazenamento, sob a própria chave, e o envia às próprias URLs. Fora desse produto, o slot não significa nada.

O Test e a API de execução mostram o que a etapa adicionaria, com o valor mascarado: `Authorization: Bearer ••••`. Eles não conseguem enviar uma credencial, porque o Transforms não tem nenhuma para enviar.

Onde um pipeline roda aparece primeiro. A leitura de um pipeline lista os produtos que o executam por referência e a versão que cada um executa. Salvar uma nova versão com uma etapa `auth`, ou excluir o pipeline, exige indicar cada um deles em `confirm_destinations`; caso contrário, a ação é recusada com `409` `conflict`, `destinations_unconfirmed` ([Quem executa um pipeline](/docs/product-transforms/reference#destinations)).

## Planos e limites {#limits}

| | Free | Starter | Pro | Custom |
| --- | --- | --- | --- | --- |
| Pipelines | 5 | 25 | 100 | 1,000 |
| Slots de credencial | 5 | 25 | 100 | 1,000 |
| Versões mantidas por pipeline | 10 | 25 | 50 | 100 |
| Execuções por minuto | 60 | 600 | 3,000 | 12,000 |

As seis etapas, os templates, o Test, a API de execução e a execução por referência estão em todos os planos, inclusive no Free.

As execuções são contadas, não cobradas. `GET /v1/usage` mostra as do mês. Acima da taxa do plano, que o Test compartilha, uma execução responde `429` `rate_limited` com o tempo de espera. Uma execução em um produto que referencia o pipeline conta no uso desse produto. Uma versão que um produto fixa, ou que foi visto executando nos últimos 30 dias, é mantida além do número do plano.

## Como obter acesso {#access}

Abra o console em `https://transforms.nimbusnexus.net` e entre com a sua conta NimbusNexus, ou adicione o Transforms em **Add a product** em qualquer console NimbusNexus. A primeira visita de um proprietário ou admin do workspace adiciona o Transforms ao workspace; a partir daí, os outros membros podem abri-lo.

As chaves não são emitidas pela API de Transforms. Crie uma no seu [console da conta]({{ACCOUNT_BASE_URL}}/api-keys?product=transforms), em **API keys**, com **Transforms** como produto. Uma chave é um JWT, por isso começa com `eyJ`. Apresente-a como `Authorization: Bearer <key>` ou `X-API-Key: <key>`.

Escolha a permissão dela ao criá-la: **Read** lê e executa pipelines, e **Read & write** também pode criar, alterar, testar e excluir pipelines. [Quem pode fazer o quê](/docs/product-transforms/reference#authority) traz a tabela completa, incluindo as funções do workspace.

## O que ele não faz {#not}

- **Ele não envia.** Não tem destino, retentativas nem log de entregas. O Webhooks entrega eventos, e o Request Bins encaminha requisições.
- **Ele não guarda o que processa.** A requisição e a resposta de uma execução desaparecem quando a chamada termina. Só a contagem fica.
- **Ele não guarda credenciais.** Uma credencial vem do produto que executa o pipeline por referência.
- **Ele não executa código.** Para lógica que as etapas não conseguem expressar, um endpoint do Webhooks pode executar um [script](/docs/product-webhooks/transformations#script) em vez disso, em um plano pago.

## Próximos passos {#next-steps}

- [Início rápido](/docs/product-transforms/quickstart) — teste um pipeline, salve-o, execute-o e salve uma nova versão.
- [Pipelines](/docs/product-transforms/pipelines) — todas as etapas, caminhos, filtros e templates, e os limites de uma execução.
- [Referência de Transforms](/docs/product-transforms/reference) — todas as rotas e campos, funções, limites e erros.
- [Playground](/transforms/playground) — execute um pipeline de exemplo sem conta.
