---
title: "Início rápido de Transforms"
description: "Teste um pipeline em uma requisição, salve-o, execute-o, veja uma requisição ser descartada e salve uma nova versão, tudo pela API."
publishedAt: 2026-11-06
updatedAt: 2026-11-11
kind: quickstart
---

# Início rápido de Transforms

Do zero a um pipeline versionado em poucos minutos. Você vai testar um pipeline em uma requisição, salvá-lo, executá-lo, ver uma requisição ser descartada e salvar uma nova versão. Para ver o que um pipeline faz antes de entrar com a sua conta, experimente o [playground](/transforms/playground).

## Antes de começar {#before}

Crie uma chave de API no seu [console da conta]({{ACCOUNT_BASE_URL}}/api-keys?product=transforms), com **Transforms** como produto e **Read & write** como permissão. O Free é suficiente para tudo o que está aqui. Depois, coloque a chave em uma variável de ambiente:

```bash
export TRANSFORMS_API_KEY="<your-api-key>"
```

Todos os caminhos abaixo são relativos a `https://transforms.nimbusnexus.net`, e toda requisição leva `Authorization: Bearer <your key>`.

## 1. Testar um pipeline {#test}

Este pipeline mantém as faturas pagas de $1,000 ou mais, remove o e-mail do cliente e qualquer número de telefone, e adiciona dois campos e um header. `POST /v1/pipelines/test` executa um documento uma vez, sobre uma requisição que você envia, e não salva nem conta nada:

```bash
curl -X POST https://transforms.nimbusnexus.net/v1/pipelines/test \
  -H "Authorization: Bearer $TRANSFORMS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "pipeline": {
      "version": 1,
      "steps": [
        { "filter": { "type": "invoice.paid", "data": { "amount": { "$gte": 100000 } } }, "note": "Paid invoices of $1,000 or more" },
        { "drop": ["data.customer.email", "**.phone"] },
        { "set": { "event_type": "{{ type }}", "amount_display": "{{ data.amount | money(data.currency) }}" } },
        { "headers": { "set": { "X-Event-Type": "{{ type }}" } } }
      ]
    },
    "body": {
      "type": "invoice.paid",
      "data": {
        "id": "in_42",
        "amount": 150000,
        "currency": "usd",
        "customer": { "name": "Ana Silva", "email": "ana@example.com", "phone": "+1 202 555 0142" }
      }
    }
  }'
```

```json
{
  "status": "ok",
  "version": null,
  "body": {
    "type": "invoice.paid",
    "data": {
      "id": "in_42",
      "amount": 150000,
      "currency": "usd",
      "customer": { "name": "Ana Silva" }
    },
    "event_type": "invoice.paid",
    "amount_display": "1,500.00 USD"
  },
  "body_changed": true,
  "headers": { "X-Event-Type": "invoice.paid" },
  "query": {},
  "step": null,
  "note": null,
  "reason": null,
  "error": null,
  "duration_ms": 0.4
}
```

`status` é `ok`, então `body` e `headers` são o que deve ser enviado. `version` é `null` porque nada foi salvo ainda.

## 2. Salvar o pipeline {#save}

Salve o mesmo documento como um pipeline, com um nome:

```bash
curl -X POST https://transforms.nimbusnexus.net/v1/pipelines \
  -H "Authorization: Bearer $TRANSFORMS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Paid invoices",
    "pipeline": {
      "version": 1,
      "steps": [
        { "filter": { "type": "invoice.paid", "data": { "amount": { "$gte": 100000 } } }, "note": "Paid invoices of $1,000 or more" },
        { "drop": ["data.customer.email", "**.phone"] },
        { "set": { "event_type": "{{ type }}", "amount_display": "{{ data.amount | money(data.currency) }}" } },
        { "headers": { "set": { "X-Event-Type": "{{ type }}" } } }
      ]
    }
  }'
```

A resposta é `201` com [o pipeline](/docs/product-transforms/reference#pipeline), resumida aqui:

```json
{
  "id": "pipe_8e27d40b19c3f6a5e0d71b42",
  "name": "Paid invoices",
  "status": "enabled",
  "current_version": 1,
  "destinations": [],
  "consumers": []
}
```

Guarde o `id`: todas as chamadas seguintes o recebem.

```bash
export PIPELINE_ID="pipe_8e27d40b19c3f6a5e0d71b42"
```

## 3. Executar o pipeline {#run}

Envie uma requisição para o pipeline salvo. A execução recebe um `body` e, opcionalmente, `headers` e `meta`, e responde o que o pipeline fez:

```bash
curl -X POST "https://transforms.nimbusnexus.net/v1/pipelines/$PIPELINE_ID/run" \
  -H "Authorization: Bearer $TRANSFORMS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"body": {"type": "invoice.paid", "data": {"id": "in_42", "amount": 150000, "currency": "usd"}}}'
```

A resposta tem o mesmo formato da resposta do teste, com `"version": 1`. Nada da requisição é guardado, e a execução soma um à contagem do mês em `GET /v1/usage`. Enviar o resultado adiante cabe a você: o Transforms não envia nada por conta própria.

## 4. Ver uma requisição descartada {#dropped}

Envie uma fatura abaixo do valor do filtro:

```bash
curl -X POST "https://transforms.nimbusnexus.net/v1/pipelines/$PIPELINE_ID/run" \
  -H "Authorization: Bearer $TRANSFORMS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"body": {"type": "invoice.paid", "data": {"id": "in_43", "amount": 99999, "currency": "usd"}}}'
```

```json
{
  "status": "dropped",
  "version": 1,
  "body": null,
  "body_changed": false,
  "headers": {},
  "query": {},
  "step": 0,
  "note": "Paid invoices of $1,000 or more",
  "reason": "no_match",
  "error": "dropped by step 0 (Paid invoices of $1,000 or more)",
  "duration_ms": 0.1
}
```

Continua sendo um `200`, porque o pipeline rodou. `step` conta a partir de 0, e `reason` é `no_match` para um filtro ao qual a requisição não correspondeu. Neste caso, não envie nada.

## 5. Salvar uma nova versão {#version}

Faça um `PATCH` no pipeline com um documento novo, aqui sem a etapa de headers:

```bash
curl -X PATCH "https://transforms.nimbusnexus.net/v1/pipelines/$PIPELINE_ID" \
  -H "Authorization: Bearer $TRANSFORMS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "pipeline": {
      "version": 1,
      "steps": [
        { "filter": { "type": "invoice.paid", "data": { "amount": { "$gte": 100000 } } }, "note": "Paid invoices of $1,000 or more" },
        { "drop": ["data.customer.email", "**.phone"] },
        { "set": { "event_type": "{{ type }}", "amount_display": "{{ data.amount | money(data.currency) }}" } }
      ]
    }
  }'
```

`current_version` agora é `2`, e as execuções usam essa versão. A versão 1 não mudou: `GET /v1/pipelines/{id}/versions` lista as versões mantidas, e uma execução ainda pode indicar uma delas:

```bash
curl -X POST "https://transforms.nimbusnexus.net/v1/pipelines/$PIPELINE_ID/run" \
  -H "Authorization: Bearer $TRANSFORMS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"version": 1, "body": {"type": "invoice.paid", "data": {"id": "in_42", "amount": 150000, "currency": "usd"}}}'
```

Para voltar à versão 1, salve o conteúdo dela de novo, o que faz dele a versão 3.

## No console {#console}

O console em `https://transforms.nimbusnexus.net` faz tudo isso com um formulário para cada etapa: **Filter**, **Remove fields**, **Set fields**, **Reshape the body**, **Headers** e **Credential**. **Start from a template** oferece mensagens do Slack, do Discord e do Teams, Keep only these fields e Drop personal data, e **JSON** mostra o documento inteiro. Teste o que está no editor antes de salvar.

## Limpeza {#cleanup}

Cada plano limita quantos pipelines você pode ter, então exclua este quando terminar:

```bash
curl -X DELETE "https://transforms.nimbusnexus.net/v1/pipelines/$PIPELINE_ID" \
  -H "Authorization: Bearer $TRANSFORMS_API_KEY"
```

A exclusão é **permanente**, para o pipeline e para todas as versões dele. Para, em vez disso, impedir que ele rode por um tempo, faça um `PATCH` nele com `{"status": "disabled"}` e, mais tarde, outro com `{"status": "enabled"}`. Um pipeline desativado responde a uma execução com `409` `conflict`, `pipeline_disabled`.

## Próximos passos {#next-steps}

- [Pipelines](/docs/product-transforms/pipelines) — todas as etapas, caminhos, filtros e templates.
- [Referência de Transforms](/docs/product-transforms/reference) — todas as rotas e campos, funções, limites e erros.
- [API de Transforms](/docs/reference/transforms) — todas as operações, com a requisição em curl, TypeScript, Python ou Go.
- [Visão geral do produto](/docs/product-transforms) — credenciais, planos e o que o Transforms não faz.
