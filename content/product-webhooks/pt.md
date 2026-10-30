---
title: "Webhooks"
description: "A plataforma de webhooks gerenciada — publique um evento uma vez e nós assinamos, repetimos e reenviamos cada entrega aos seus assinantes."
publishedAt: 2026-08-05
updatedAt: 2026-10-30
kind: concept
---

# Webhooks

O NimbusNexus Webhooks é um produto independente para enviar webhooks aos *seus* assinantes. Você publica um evento uma vez; nós o distribuímos para todos os endpoints inscritos naquele tipo, assinamos cada entrega, repetimos as que falham e guardamos o que nunca chega ao destino em uma dead-letter queue que você pode reenviar.

> **Não é a página que você procurava?** Se você está aqui para receber notificações sobre *a sua própria infraestrutura na NimbusNexus* — `vm.created`, `snapshot.completed`, `invoice.generated` —, isso é outra funcionalidade, documentada em [Webhooks da plataforma](/docs/webhooks). Os dois são sistemas sem relação entre si e **os headers de assinatura deles são diferentes**, então um código de verificação escrito para um vai rejeitar todas as entregas do outro.

A diferença em uma linha: os webhooks da plataforma são eventos que *nós* enviamos a você sobre a sua conta; este produto entrega eventos que *você* envia aos seus próprios clientes.

## Para que serve {#what-for}

Operar a entrega de webhooks por conta própria parece fácil até deixar de ser. A entrega em si é um POST — o trabalho está em tudo ao redor: assinar para que os assinantes possam confiar no payload, repetir sem martelar um endpoint que já está fora do ar, manter um corpo idêntico byte a byte entre as retentativas para que as assinaturas continuem válidas, desativar endpoints que estão falhando há uma semana e dar ao suporte um jeito de responder "vocês enviaram?" com provas.

Este produto é essa engrenagem ao redor. Ele também recebe na outra direção — as [fontes](/docs/product-webhooks/sources) recebem webhooks do Stripe, do GitHub ou de qualquer outro remetente que assine os seus payloads —, então um único sistema cuida dos dois lados do seu tráfego de webhooks.

## Os objetos {#objects}

| Objeto | O que é |
|---|---|
| **Workspace** | A sua conta. Tudo o que você tem fica no escopo dele, isolado dos outros workspaces. |
| **Projeto** | Um agrupamento dentro do workspace. Separar staging de produção significa dois projetos; rodar dois produtos lado a lado também. Identificado pelo id (`prj_…`). |
| **Evento** | Algo que aconteceu — um tipo, como `order.created`, mais um payload JSON. Você o publica, ou uma fonte o recebe. |
| **Fonte** | Uma URL para a qual um provedor envia webhooks. Cada requisição assinada vira um evento. Veja [Fontes](/docs/product-webhooks/sources). |
| **Endpoint** | Uma URL HTTPS registrada para receber webhooks, com uma ou mais inscrições. |
| **Inscrição** | Uma regra de correspondência em um endpoint: `exact`, `prefix`, `suffix` ou `all`, mais um padrão como `order.`. |
| **Transformação** | Uma função JavaScript curta em um endpoint que remodela, filtra ou descarta cada entrega antes que ela seja assinada e enviada. Nos planos pagos. Veja [Transformações](/docs/product-webhooks/transformations). |
| **Entrega** | Um envio, com as tentativas rastreadas, de um evento para um endpoint correspondente. Assinada, repetida, observável. Veja [Entregas e retentativas](/docs/product-webhooks/deliveries). |
| **Tipo de evento** | Uma entrada no catálogo de nomes de tipo, com um JSON Schema opcional. Veja [Tipos de evento](/docs/product-webhooks/event-types). |
| **Segredo de assinatura** | Segredo por endpoint usado para assinar cada entrega com HMAC. Mostrado **uma vez**, na criação. |

Publicar um evento compara esse evento com todos os endpoints ativados cujas inscrições cobrem aquele tipo e cria uma entrega para cada correspondência. Quando o workspace exige [verificação de endpoint](/docs/product-webhooks/endpoint-verification), só os endpoints verificados contam.

Dois medidores contam esse processo, e a diferença importa quando você dimensiona um plano. Uma publicação é sempre um **evento**, e essa contagem, que não depende da distribuição, é o que `GET /v1/usage` informa como `messages_used`. Mas a cota mensal **aplicada** conta *entregas* — uma por endpoint correspondente —, então distribuir um único evento para dez endpoints consome dez. O medidor por evento é registrado e vai se tornar a unidade de faturamento; a cota de entregas é o teto que de fato rejeita uma publicação hoje.

## Como uma entrega se comporta {#delivery}

- **O corpo é montado uma vez.** O envelope é serializado no momento da publicação e armazenado byte a byte, então toda retentativa envia bytes idênticos. Cada *tentativa* é assinada de novo com um timestamp novo, o que permite que os seus assinantes apliquem uma janela de replay curta sem que uma entrega que só dá certo uma hora depois falhe na verificação.
- **Pelo menos uma vez.** As retentativas são reais; o mesmo evento pode chegar duas vezes. Deduplique pelo id do evento, que vai tanto no corpo quanto no header `X-Webhook-Event-Id`.
- **As retentativas usam backoff.** As entregas que falham são repetidas com backoff exponencial até o `max_attempts` do endpoint. Um endpoint pode ter um `retry_schedule` personalizado — uma lista explícita de intervalos em segundos — quando a curva padrão não combina com o outro lado.
- **As entregas esgotadas são mantidas, não descartadas.** Elas vão para a dead-letter queue, onde você pode filtrá-las e reenviá-las em lote quando o receptor estiver saudável.
- **Os endpoints que falham persistentemente são desativados** automaticamente, com o motivo registrado. Enviamos um [webhook operacional](/docs/product-webhooks/deliveries#operational) `endpoint.disabled` para os endpoints operacionais do workspace, então inscreva um endpoint para ficar sabendo. A reativação é explícita.

## Como se localizar no console {#console}

| Seção | Páginas | Para quê |
|---|---|---|
| **Build** | Sources, Endpoints, Event types, Pipeline | Configurar de onde os eventos vêm e para onde vão; a página Pipeline liga cada fonte aos endpoints que ela alcança, com a transformação no caminho. |
| **Observe** | Events, Deliveries, Captured requests | Ver o que chegou, o que saiu e o que falhou. |
| **Manage** | Operational webhooks, Audit log, Settings | Onde você é avisado quando algo quebra; quem mudou o quê; o seu plano e o uso do Webhooks, a verificação e as ferramentas de desenvolvedor. |

A página Overview tem botões para adicionar uma fonte ou um endpoint e para enviar um evento de teste, e guia um workspace novo até a primeira entrega.

## Publicar com segurança {#publishing}

Envie um `Idempotency-Key` em toda publicação. Assim, uma publicação repetida retorna o evento original em vez de ser distribuída uma segunda vez, o que importa mais justamente na situação que gera retentativas — um timeout em que você nunca ficou sabendo se a primeira chamada deu certo.

A mesma chave com um corpo *diferente* é rejeitada em vez de aceita silenciosamente, então uma colisão de chaves aparece como um erro, e não como um evento descartado em silêncio.

Para produtores que não podem tolerar a perda de um evento quando a API está inacessível, os SDKs incluem um outbox que grava antes de enviar: `enqueue()` persiste localmente e retorna sem nenhuma chamada de rede, e um drainer envia o que ficou pendente depois, com a mesma garantia de idempotência. Veja [SDKs](/docs/product-webhooks/sdks).

## Como obter acesso {#access}

Cadastre-se no Webhooks e você recebe um workspace no plano gratuito, criado na primeira vez que você entra no console. Os preços estão na [página do Webhooks](/webhooks).

As chaves não são emitidas com o workspace, e a API de Webhooks não as emite. Você mesmo gera uma no console da sua conta NimbusNexus, em **API keys**, escolhendo **Webhooks** como produto — o Identity é o único emissor de chaves de API em todos os produtos. Uma chave emitida pelo Identity é um JWT, por isso começa com `eyJ`, em vez de ter um prefixo de produto. Ela é apresentada exatamente como antes: `Authorization: Bearer <key>` ou `X-API-Key: <key>`.

Escolha o escopo ao gerá-la. `admin` dá controle total; `publish` pode produzir eventos e não lê nada; `read` pode ler tudo e não produz nada. `publish` e `read` são disjuntos, e não degraus de uma escada — uma chave `publish` não pode listar entregas, e uma chave `read` não pode publicar, então um job que faz as duas coisas precisa de `admin`. Uma chave também pode ser restrita a um único projeto no momento da geração.

> **Uma chave `whsk_…` existente não autentica mais.** A família `whsk_` deixou de existir, e uma requisição que traga uma é recusada como qualquer outra credencial não reconhecida. Se você tem uma, gere uma substituta no console da conta.

## Próximos passos {#next-steps}

- [Início rápido](/docs/product-webhooks/quickstart) — registre um endpoint, publique um evento, verifique a entrega.
- [Fontes](/docs/product-webhooks/sources) — receba webhooks do Stripe, do GitHub ou de qualquer remetente que assine com HMAC.
- [Entregas e retentativas](/docs/product-webhooks/deliveries) — estados, o cronograma de retentativas e como reenviar.
- [Verificação de endpoint](/docs/product-webhooks/endpoint-verification) — o desafio que um endpoint responde antes de receber eventos.
- [Transformações](/docs/product-webhooks/transformations) — remodele, filtre ou descarte cada entrega com um script curto.
- [Slack, Teams e Discord](/docs/product-webhooks/chat-apps) — envie eventos para um canal com um preset.
- [Tipos de evento](/docs/product-webhooks/event-types) — o catálogo, a política para tipos desconhecidos e os schemas de payload.
- [Requisições capturadas](/docs/product-webhooks/captured-requests) — as requisições brutas que chegaram a uma fonte.
- [Verificação de assinatura](/docs/product-webhooks/signatures) — o contrato de assinatura e as três regras para verificá-la.
- [SDKs](/docs/product-webhooks/sdks) — clientes tipados para Python, TypeScript e Go.
- [CLI](/docs/product-webhooks/cli) — `nn-webhooks`, um único binário estático.
- [Webhooks da plataforma](/docs/webhooks) — a outra coisa chamada webhooks: notificações sobre a sua própria infraestrutura.
