---
title: "Slack, Teams e Discord"
description: "Envie eventos para um canal do Slack, do Microsoft Teams ou do Discord, com um preset de transformação que converte cada evento em uma mensagem que o canal aceita."
publishedAt: 2026-10-30
updatedAt: 2026-10-30
kind: guide
---

# Slack, Teams e Discord

O Slack, o Microsoft Teams e o Discord podem dar a um canal uma URL de webhook que posta nele tudo o que recebe — mas só no formato de mensagem de cada app, então eles recusam o envelope de evento que normalmente enviamos. Uma [transformação](/docs/product-webhooks/transformations) resolve essa diferença. No final deste guia, você terá:

- um endpoint apontado para a URL de webhook do seu canal;
- o preset desse app transformando cada evento em uma mensagem que ele aceita;
- um evento de teste postado no canal.

Tempo total: cerca de 10 minutos.

## Pré-requisitos {#prereqs}

- Um workspace do Webhooks no Starter, no Pro ou no Custom. O Free não inclui transformações.
- Permissão para adicionar um webhook ao canal: no Slack, para instalar um app no workspace; no Teams, para criar um workflow; no Discord, a permissão **Manage Webhooks**.
- A [verificação de endpoint](/docs/product-webhooks/endpoint-verification#cannot-echo) desligada no projeto em que o endpoint vai ficar. Esses canais só aceitam mensagens no próprio formato, então nunca conseguem responder ao desafio de verificação, e um endpoint que precisa passar por ele não recebe nada. Os planos pagos permitem desligar a verificação.

## 1 · Obter a URL de webhook do canal {#webhook-url}

### Slack {#slack}

Crie um app do Slack para o seu workspace e ative **Incoming Webhooks** nas configurações dele. Escolha **Add New Webhook to Workspace**, selecione o canal e autorize. Copie a URL, que se parece com `https://hooks.slack.com/services/T…/B…/…`. Os passos do próprio Slack estão em [Enviar mensagens usando incoming webhooks](https://docs.slack.dev/messaging/sending-messages-using-incoming-webhooks).

### Microsoft Teams {#teams}

No Teams, abra **Workflows** e comece pelo template **Send webhook alerts to a channel**. Escolha a equipe e o canal, salve o workflow e copie a URL do webhook nos detalhes dele. Os passos da própria Microsoft estão em [Criar webhooks de entrada com Workflows para o Microsoft Teams](https://support.microsoft.com/en-us/office/create-incoming-webhooks-with-workflows-for-microsoft-teams-8ae491c7-0394-4861-ba59-055e33f75498).

### Discord {#discord}

No Discord, abra **Server Settings → Integrations → Webhooks** e crie um webhook. Escolha o canal em que ele vai postar e depois **Copy Webhook URL**; a URL se parece com `https://discord.com/api/webhooks/…/…`. Os passos do próprio Discord estão em [Introdução aos webhooks](https://support.discord.com/hc/en-us/articles/228383668-Intro-to-Webhooks).

Trate a URL como um segredo: esses canais não verificam a nossa assinatura, então qualquer pessoa que a tenha pode postar no canal.

## 2 · Adicionar o endpoint {#endpoint}

No console, escolha **New endpoint** na página **Endpoints**, cole a URL e inscreva o endpoint nos eventos que o canal deve ver. Mantenha a lista curta: um canal é lido por pessoas, e cada evento correspondente vira uma mensagem.

Pela API:

```bash
curl -sX POST {{WEBHOOKS_BASE_URL}}/v1/endpoints \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://hooks.slack.com/services/T…/B…/…", "project_id": "prj_…",
       "subscriptions": [{"match_kind": "exact", "pattern": "invoice.paid"}]}'
```

## 3 · Escolher o preset {#preset}

Abra o menu do endpoint na página **Endpoints** e escolha **Transformation**. Selecione **Preset**, depois o do seu app — **Slack message**, **Microsoft Teams card** ou **Discord message** — e escolha **Save**. A partir de agora, cada entrega para este endpoint é enviada como uma mensagem:

| Preset | O que o canal mostra |
|---|---|
| Slack message | O tipo e o id do evento, quando ele aconteceu e os dados dele em um bloco de código. |
| Microsoft Teams card | Um Adaptive Card com o tipo do evento, o id e o horário dele e os dados. |
| Discord message | O tipo e o id do evento e os dados dele em um bloco de código JSON. |

Cada um corta os dados para caber no limite do próprio app, como 3.000 caracteres em uma seção do Slack ou 2.000 em uma mensagem do Discord.

Um preset é um script como qualquer outro, então não há um nome de preset para indicar pela API: [crie uma transformação](/docs/product-webhooks/transformations#set-up) com o script que você quiser. No console, **Edit this script** mostra o código de cada preset como ponto de partida.

## 4 · Testar {#test}

Em **Test**, na mesma página, escolha **Run test**. O teste executa o preset com um evento recente das entregas do endpoint, ou com um que você colar, e mostra a mensagem que seria enviada. Nada é enviado.

Depois, envie um evento de verdade: **Send test event**, na página Overview do console, ou publique um evento em que o endpoint esteja inscrito:

```bash
curl -sX POST {{WEBHOOKS_BASE_URL}}/v1/events \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"event_type": "invoice.paid", "project_id": "prj_…", "payload": {"id": "in_123", "amount": 125000, "currency": "usd"}}'
```

A mensagem aparece no canal em poucos segundos. O **Send test ping** do endpoint não serve aqui: ele envia o ping fixo sem transformação, e o canal o recusa.

## O que você fez {#summary}

Agora, cada evento em que o endpoint está inscrito posta uma mensagem no seu canal. Abra uma entrega na página **Deliveries** para ver a mensagem que foi enviada; se o app respondeu com um erro, ele também aparece lá, nas tentativas da entrega.

## Personalizar {#customize}

Escolha **Edit this script** para mudar o que a mensagem diz ou quais eventos geram uma. Retornar `null` não envia nada, então um script pode reservar o canal para os eventos de que as pessoas precisam. Para o Slack:

```js
function transform(event) {
  if (event.type !== "invoice.paid" || event.data.amount < 100000) return null;
  return { body: { text: `Invoice ${event.data.id} paid: ${event.data.amount / 100} ${event.data.currency}` } };
}
```

Para o Discord, envie `content` onde o Slack recebe `text`; para o Teams, mantenha o card do preset e mude o texto dentro dele. Uma entrega que o script descarta não é enviada e não conta como falha. Teste o script antes de salvá-lo: uma execução que falha manda a entrega para a dead-letter queue e nunca envia o evento sem transformação.

## Próximos passos {#next-steps}

- [Transformações](/docs/product-webhooks/transformations) — o contrato do script, os limites e o que acontece quando um script falha.
- [Verificação de endpoint](/docs/product-webhooks/endpoint-verification#cannot-echo) — receptores que não conseguem responder ao desafio.
- [Entregas e retentativas](/docs/product-webhooks/deliveries) — estados, retentativas e como reenviar.
