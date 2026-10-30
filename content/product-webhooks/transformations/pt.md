---
title: "Transformações"
description: "Remodele, filtre ou descarte cada entrega com uma função JavaScript curta que roda em um sandbox antes que a entrega seja assinada e enviada."
publishedAt: 2026-10-30
updatedAt: 2026-10-30
kind: concept
---

# Transformações

Uma transformação é uma função JavaScript curta em um endpoint. Ela recebe cada evento antes da entrega e retorna, no lugar dele, a requisição a enviar, ou `null` para não enviar nada. Ela roda em um sandbox sem rede e com um orçamento fixo de CPU e de memória, uma vez por entrega; o que ela retorna é assinado com o segredo do endpoint e enviado como qualquer outra entrega.

## Para que serve {#what-for}

- **Receptores que precisam de um formato próprio.** O Slack, o Microsoft Teams e o Discord aceitam apenas os seus próprios formatos de mensagem e recusam o nosso envelope. Uma transformação converte cada evento em uma mensagem que eles aceitam; os [presets](#presets) fazem isso por você.
- **Um formato diferente para cada receptor.** O seu próprio serviço recebe o payload inteiro, um CRM recebe três campos, um fornecedor de analytics não recebe nada que contenha dados pessoais.
- **Filtragem pelo payload.** Uma [inscrição](/docs/product-webhooks#objects) faz a correspondência só pelo tipo do evento. "Só `invoice.paid` acima de $1.000" depende do payload, que um script consegue ler.

## O script {#script}

Uma transformação é uma única função chamada `transform`:

```js
function transform(event, context) {
  // event:   { id, type, created_at, data, version }, the envelope we would otherwise send
  // context: { endpoint: { id, description }, attempt }
  if (event.type === "invoice.paid" && event.data.amount < 100000) {
    return null; // send nothing for small invoices
  }
  return {
    body: { text: `Invoice ${event.data.id} paid: ${event.data.amount / 100} ${event.data.currency}` },
    headers: { "X-Team": "billing" },
  };
}
```

O que ela retorna decide o que é enviado:

| Retorno | O que é enviado |
|---|---|
| `{ body: { … } }` ou `{ body: [ … ] }` | O corpo como JSON, com `Content-Type: application/json`. |
| `{ body: "…" }` | A string tal como está, com `Content-Type: text/plain; charset=utf-8`. |
| `{ body: …, contentType: "…" }` | O corpo, com esse tipo de conteúdo. |
| `{ body: …, headers: { … } }` | O corpo, com esses headers acrescentados, que seguem as mesmas regras dos headers personalizados de um endpoint. Defina `contentType`, e não um header `Content-Type`. |
| `null` | Nada. A entrega é [descartada](#dropped). |

A URL e o método continuam sendo os do endpoint: a URL é a que foi registrada, conferida e, quando exigido, [verificada](/docs/product-webhooks/endpoint-verification). O que o script escrever com `console.log` fica guardado com a entrega, até 4 KiB.

O script é JavaScript moderno puro, em um único arquivo. Ele não tem rede, sistema de arquivos nem timers, e não pode importar módulos, então uma biblioteca de que ele precise tem que vir empacotada nele.

## Presets {#presets}

Os presets são scripts que nós escrevemos e mantemos, para os receptores mais pedidos:

| Preset | Envia |
|---|---|
| **Slack message** | O tipo, o id e os dados do evento como uma mensagem do Slack, para um incoming webhook do Slack. |
| **Microsoft Teams card** | O evento como um Adaptive Card, para um webhook de workflow do Teams. |
| **Discord message** | O tipo, o id e os dados do evento como uma mensagem do Discord, para um webhook de canal do Discord. |
| **Keep only these fields** | O envelope só com os campos de `data` que você listar. Um nome com pontos, como `customer.id`, alcança campos aninhados. |

Escolher um preset salva o script dele como uma transformação sua, então você pode abri-la e alterá-la como qualquer outra. [Slack, Teams e Discord](/docs/product-webhooks/chat-apps) mostra o passo a passo de cada receptor, desde o início.

## Configurar uma transformação {#set-up}

No console, abra o menu do endpoint na página **Endpoints** e escolha **Transformation**. Selecione **Preset** ou **Script**, [teste-a](#test) e escolha **Save**: as próximas entregas do endpoint passam por ela. **Off** a remove de novo.

Pela API, crie a transformação no projeto do endpoint e depois aponte o endpoint para ela:

```bash
curl -sX POST {{WEBHOOKS_BASE_URL}}/v1/transformations \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "CRM fields", "project_id": "prj_…", "code": "function transform(event) { return { body: { id: event.id, total: event.data.total } }; }"}'

curl -sX PATCH {{WEBHOOKS_BASE_URL}}/v1/endpoints/ep_3f9a… \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"transformation_id": "tr_…"}'
```

Carregamos o script no sandbox antes de salvá-lo, sem chamá-lo: um erro de sintaxe, a falta da função `transform` ou um código de nível superior que falhe é recusado com `422 invalid_transformation`, e nada é salvo. Um endpoint executa no máximo uma transformação; uma transformação pode servir a vários endpoints do projeto dela. `{"transformation_id": null}` a desvincula.

## Testar um script {#test}

**Test** executa o script que está no editor, salvo ou não, no mesmo sandbox que as entregas usam, com um evento recente das entregas do próprio endpoint ou com um que você colar. Ele mostra o que seria enviado, os headers, os logs e quanto tempo levou. Nada é enviado e nada é salvo.

Pela API:

```bash
curl -sX POST {{WEBHOOKS_BASE_URL}}/v1/transformations/test \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"code": "function transform(event) { return { body: { text: event.type } }; }",
       "event": {"id": "evt_1", "type": "invoice.paid", "created_at": "2026-10-30T12:00:00+00:00", "data": {}, "version": "1"}}'
```

```json
{ "status": "ok", "body": "{\"text\":\"invoice.paid\"}", "content_type": "application/json", "headers": {}, "logs": "", "reason": null, "error": null, "fuel": 2764502, "duration_ms": 3.6 }
```

`status` é `ok`, `dropped` (o script retornou `null`) ou `failed`, com `reason` e `error` dizendo por quê. Mesmo quando o script falha, a resposta é `200`. Os testes e as verificações ao salvar dividem um mesmo limite de 60 por minuto por workspace, com rajadas de 10.

O **Send test ping** de um endpoint continua enviando o corpo fixo do ping, sem transformação; use **Test** para ver o que o seu receptor vai receber.

## O que uma entrega registra {#deliveries}

O script roda uma vez por entrega, na primeira tentativa dela. O que ele retorna é armazenado com a entrega e assinado com o segredo do endpoint como qualquer outro corpo, e cada retentativa reenvia esses mesmos bytes sem executar o script de novo, então uma retentativa não pode mudar o que o receptor recebe. [Reenviar](/docs/product-webhooks/deliveries#replay) executa de novo a versão atual da transformação.

No console, abra uma entrega na página **Deliveries** para ver a transformação e a versão que a moldaram, quanto tempo a execução levou, o corpo que foi enviado e os logs, ou o erro. Pela API, `GET /v1/deliveries/{id}/transform` retorna essa execução, ou `null` quando nenhuma rodou.

### Entregas descartadas {#dropped}

Quando o script retorna `null`, nada é enviado e nenhuma tentativa é feita. A entrega termina como `sent`, com `"dropped": true`, o console a mostra como **dropped**, e as estatísticas do endpoint e do workspace a contam separadamente das entregues: a taxa de sucesso é calculada sobre o que era para ser enviado.

## Quando um script falha {#failures}

Uma execução falha quando o script lança uma exceção, fica sem tempo ou sem memória, entra em recursão profunda demais ou retorna algo que não é uma requisição (um objeto com um `body`, ou `null`). A entrega vai então direto para a dead-letter queue, com `last_error` começando com `transform_failed:`. Nunca enviamos o evento sem transformação no lugar dela: o receptor pode ser um terceiro, e o script pode existir justamente para que certos dados não cheguem até ele.

Cada execução com falha conta para a transformação, assim como as entregas com falha contam para um endpoint. Depois de 20 falhas seguidas, a transformação é desativada automaticamente, as entregas dos endpoints dela ficam esperando, e nós enviamos um e-mail ao proprietário do workspace e um [webhook operacional](/docs/product-webhooks/deliveries#operational) `transformation.disabled`. Corrija o script, teste-o e ative a transformação de novo (**Resume** no console, ou `PATCH /v1/transformations/{id}` com `{"status": "enabled"}`): as entregas que estavam esperando são enviadas, e as que foram para a dead-letter queue podem ser [reenviadas](/docs/product-webhooks/deliveries#replay).

## Pausa e versões {#versions}

**Pause** (`{"status": "disabled"}`) interrompe uma transformação sem desvinculá-la. As entregas dos endpoints dela esperam, em vez de sair sem a transformação: elas aparecem como `failed`, com `last_error` "paused: the endpoint's transformation is not running", e são enviadas quando você a retoma.

Cada salvamento de código novo é uma nova versão. As últimas 50 versões são mantidas (`GET /v1/transformations/{id}/versions`), e cada entrega registra a versão que a moldou. Para voltar a uma versão anterior, carregue-a no editor e salve-a: ela passa a ser a versão mais recente.

## Limites {#limits}

Cada execução tem:

| Limite | Valor |
|---|---|
| CPU | Cerca de 50 ms de tempo de script, contados em instruções em vez de medidos, então o mesmo script tem o mesmo orçamento por mais ocupados que estejamos |
| Tempo de relógio | 1 segundo |
| Memória | 64 MiB |
| Tamanho do script | 1 MiB |
| Saída | 256 KiB |
| Logs | 4 KiB |

Os scripts rodam em um serviço próprio, separado da entrega, e cada workspace só pode rodar alguns ao mesmo tempo, então um script lento ou quebrado afeta apenas as próprias entregas, e não as de mais ninguém. Um script típico leva poucos milissegundos.

## Planos {#plans}

As transformações, sejam presets ou scripts, fazem parte de todos os planos pagos: Starter, Pro e Custom. O Free não as inclui. Os planos diferem em quantos scripts de um workspace rodam ao mesmo tempo: 2 no Starter, 4 no Pro e o que o contrato definir no Custom. O card do plano, na página Overview do console, conta as execuções deste mês. As execuções são contadas, mas não cobradas.

Um workspace que sai do plano pago mantém as suas transformações e ainda pode renomeá-las, pausá-las, desvinculá-las e excluí-las, mas não pode salvar código novo, testar nem retomar nenhuma delas. As entregas para um endpoint que ainda tem uma transformação esperam até que o plano volte a incluir transformações ou até que você a desvincule.

## Erros {#errors}

| Status | Código | Quando |
|---|---|---|
| `402` | `not_entitled` (`feature: transformations`) | Criar uma transformação, salvar código novo, ativar uma ou testar em um plano sem transformações. |
| `422` | `invalid_transformation` | O script não carregou: `syntax_error`, `no_transform`, `code_too_large` ou `load_failed`, com a causa. |
| `409` | `conflict` (`transformation_in_use`) | Excluir uma transformação que um endpoint ainda executa. Desvincule-a antes. |
| `404` | `not_found` (`transformation`, `transformation_version`) | Ela não existe mais, ou essa versão já não é mantida. |
| `429` | `rate_limited` | Acima dos 60 testes e verificações ao salvar por minuto. |
| `503` | `unavailable` (`transform`) | O sandbox não conseguiu executar o script naquele momento. Nada foi salvo; tente de novo. |

## Próximos passos {#next-steps}

- [Slack, Teams e Discord](/docs/product-webhooks/chat-apps) — envie eventos para um canal com um preset.
- [Entregas e retentativas](/docs/product-webhooks/deliveries) — o que acontece com uma entrega depois que o script dela roda.
- [Verificação de endpoint](/docs/product-webhooks/endpoint-verification) — por que os receptores de chat precisam da verificação desligada.
- [Visão geral de Webhooks](/docs/product-webhooks) — eventos, endpoints e inscrições.
