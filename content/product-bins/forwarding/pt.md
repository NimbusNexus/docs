---
title: "Encaminhamento"
description: "Um bin pode repassar cada requisição que registra para o seu próprio servidor e guardar o que o seu servidor respondeu — o que é enviado, as retentativas, os limites e o endereço de onde vêm os encaminhamentos."
publishedAt: 2026-10-26
updatedAt: 2026-10-26
kind: concept
---

# Encaminhamento

Dê a um bin uma URL de encaminhamento, e toda requisição que ele registra também é repassada para o seu próprio servidor, tal como chegou. O remetente continua recebendo na hora o `200` do bin. O bin repassa a requisição por conta própria, tenta de novo quando o seu servidor falha e guarda a resposta do seu servidor junto à requisição, para que um só lugar mostre o que um remetente enviou e o que o seu endpoint fez com isso.

## Quem pode encaminhar e para onde {#target}

O encaminhamento está incluído no Starter, no Pro e no Custom. No Free, definir uma URL de encaminhamento tem como resposta `402` `not_entitled`, com `details.feature` `forwarding`.

Um bin encaminha para uma única URL, e essa URL precisa:

- **Ser https**, em qualquer porta. O certificado é verificado em relação ao nome do host da URL.
- **Não ter nome de usuário nem senha.**
- **Estar na internet pública.** Todos os endereços para os quais o host dela resolve precisam ser públicos: um endereço privado, de loopback, link-local ou reservado de outra forma é recusado, assim como um host que não resolve.
- **Não ser nossa.** `nnbin.net`, `nimbusnexus.net` e todos os nomes sob eles são recusados, assim como qualquer nome que resolva para um dos nossos próprios endereços: um bin não pode encaminhar para um bin, nem para os próprios serviços da NimbusNexus.
- **Ter no máximo 2.048 caracteres.**

A URL é verificada quando você a define e de novo antes de cada envio, e cada envio vai só para os endereços que essa verificação encontrou, então uma mudança de DNS nesse meio-tempo não consegue apontá-lo para outro lugar. Os redirecionamentos não são seguidos: uma resposta `3xx` é guardada como a resposta do seu servidor e o encaminhamento conta como enviado, já que um redirecionamento poderia levar a qualquer lugar que a verificação nunca viu.

O caminho e a query de cada requisição são acrescentados à URL de encaminhamento. Com a URL de encaminhamento `https://api.example.com/hooks`, uma requisição para `https://nnbin.net/b/k7xq2mbn9tfa/stripe/events?x=1` vai para `https://api.example.com/hooks/stripe/events?x=1`. Uma requisição para a URL do bin sem nada depois vai para a URL de encaminhamento como você a definiu, e uma query string que a URL de encaminhamento traga vem primeiro.

Defina a URL com **Set up forwarding**, no card **Forwarding** do bin no console, ou com `forward_url` em `PATCH /v1/bins/{id}`:

```bash
curl -X PATCH https://bins.nimbusnexus.net/v1/bins/bin_3f9a1c7e5b2d8f4a6c0e9b17 \
  -H "Authorization: Bearer $BINS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"forward_url": "https://api.example.com/hooks"}'
```

A resposta é o bin, com `forward_url` definido. **Stop forwarding**, no card, ou `"forward_url": null` desliga o encaminhamento. Definir a URL exige a função de membro, ou uma chave com **Read & write**. Uma URL que viola uma das regras acima é recusada com `422`, e a [referência](/docs/product-bins/reference#forwarding) lista cada motivo.

## Verificar a URL antes {#test}

**Send a test**, no card Forwarding, ou `POST /v1/bins/{id}/forward-test` envia agora ao seu servidor um pequeno evento JSON e mostra o que ele respondeu, para que você saiba que a URL funciona antes que o tráfego real dependa dela:

```bash
curl -X POST https://bins.nimbusnexus.net/v1/bins/bin_3f9a1c7e5b2d8f4a6c0e9b17/forward-test \
  -H "Authorization: Bearer $BINS_API_KEY"
```

```json
{
  "ok": true,
  "answer": {
    "status": 200,
    "headers": [
      {"name": "content-type", "value": "text/plain"}
    ],
    "body_base64": "b2s=",
    "truncated": false
  },
  "duration_ms": 142,
  "error": ""
}
```

O seu servidor recebe um `POST` cujo corpo é `{"type":"request_bins.forward_test","bin":"<slug>","sent_at":"<when>"}`, com `Content-Type: application/json`, `User-Agent: NimbusNexus-Request-Bins (forward test)`, `X-Request-Bins-Request: test` e o `Via` e o `X-Forwarded-Host` que todo encaminhamento leva. `ok` é `true` para uma resposta `2xx` ou `3xx`. Quando nenhuma resposta vem, `answer` é `null` e `error` diz por quê, por exemplo, um timeout. Um bin pode enviar 10 testes por minuto.

## O que é enviado {#sent}

Um encaminhamento é a requisição tal como o bin a registrou:

- **o método**, qualquer que tenha sido;
- **o corpo, byte a byte**;
- **os headers, na ordem em que chegaram**, exceto os listados abaixo, e depois os nossos.

**Descartados**, porque pertencem a uma conexão ou a um salto, e não à requisição: `Connection` e todo header que ele nomeia, `Keep-Alive`, `Proxy-Connection`, `Proxy-Authenticate`, `TE`, `Trailer`, `Transfer-Encoding` e `Upgrade`; `Host`, que passa a ser o do seu servidor, e `Content-Length`, que é contado de novo; e `X-Real-IP`, `X-Forwarded-Proto`, `X-Forwarded-Host`, `CDN-Loop` e todo header `CF-*`, que descrevem um salto anterior; o encaminhamento define os seus próprios `X-Forwarded-Proto` e `X-Forwarded-Host`. O `X-Request-Bins-Request` do próprio remetente também é descartado, para que o que o seu servidor lê seja o nosso.

**Não encaminhadas: as credenciais.** `Authorization`, `Proxy-Authorization`, `Cookie`, `Set-Cookie` e `X-Api-Key` nunca saem do bin. A URL de um bin é pública, por isso um bin substitui esses valores por `[redacted]` antes que qualquer coisa seja armazenada, e nada do que um remetente colocou neles é guardado, nem mesmo pelo instante em que um encaminhamento precisaria disso. Os headers de assinatura, como `Stripe-Signature` ou `X-Hub-Signature-256`, não são credenciais e são encaminhados. O corpo não é alterado, então eles continuam passando na verificação, embora uma retentativa possa chegar depois que a tolerância de uma assinatura com timestamp tiver se esgotado. O custo: um servidor que autentica quem o chama com um desses cinco headers recusa as requisições encaminhadas.

**Acrescentados**, depois dos headers do remetente:

| Header | Valor |
| --- | --- |
| `X-Forwarded-For` | As entradas de `X-Forwarded-For` do próprio remetente, se ele enviou alguma, e depois o endereço do remetente, o `source_ip` da requisição. |
| `Forwarded` | Os elementos de `Forwarded` do próprio remetente, e depois o nosso: `for=<sender>;proto=https;host=nnbin.net`. |
| `Via` | `1.1 nnbin.net`, depois de qualquer `Via` que os próprios proxies do remetente tenham acrescentado. |
| `X-Forwarded-Proto` | `https` |
| `X-Forwarded-Host` | `nnbin.net` |
| `X-Request-Bins-Request` | O `id` da requisição, como `req_8d2e6b1f4a9c3e7d5b0f2a61`, para que os logs do seu servidor levem de volta a ela. |

## Entrega e retentativas {#delivery}

O remetente recebe na hora `200` e `{"status":"accepted"}`, como de qualquer bin, faça o seu servidor o que fizer, e nunca vê a resposta do seu servidor. O bin envia o encaminhamento por conta própria, geralmente poucos segundos depois de registrar a requisição.

Uma tentativa termina em timeout quando o seu servidor leva mais de 10 segundos para aceitar a conexão, ou mais de 10 segundos para responder. O que acontece depois depende de como a tentativa terminou:

| A tentativa terminou com | O que acontece |
| --- | --- |
| Uma resposta `2xx` ou `3xx` | Enviado. Um redirecionamento não é seguido. |
| Um erro de conexão, um timeout, `408`, `429` ou um `5xx` | Tentado de novo, até que as tentativas do plano se esgotem. |
| Qualquer outro `4xx` | Falha na hora: enviar a mesma requisição de novo não vai mudar um `400` ou um `404`. |
| Uma URL de encaminhamento que não passa mais nas [verificações](#target) | Falha na hora. |

Uma tentativa que falhou é repetida 30 segundos depois e, em seguida, 2 minutos, 10 minutos e 30 minutos depois de cada tentativa seguinte, até que as tentativas do plano se esgotem: 3 no Starter, então a última vem cerca de dois minutos e meio depois da primeira, e 5 no Pro e no Custom, cerca de 43 minutos depois. Quando uma resposta `408`, `429` ou `5xx` traz `Retry-After` pedindo uma espera maior, o bin espera esse tempo em vez disso, até uma hora.

Antes de cada tentativa, o bin verifica de novo se pode enviar. Um encaminhamento é descartado, como não encaminhado, se o bin tiver sido excluído ou suspenso, o encaminhamento tiver sido interrompido ou [pausado](#paused), o workspace tiver sido suspenso ou o plano não incluir mais o encaminhamento. Um encaminhamento vai para a URL que estava definida quando a requisição dele chegou, então mudar a URL não desvia os encaminhamentos que já estão esperando.

Só são enviadas as requisições que chegam enquanto um bin encaminha: ativar o encaminhamento não envia nada do que o bin registrou antes. Cada requisição é encaminhada separadamente, então uma requisição enviada duas vezes é registrada duas vezes e encaminhada duas vezes. A ordem das requisições não é mantida: uma requisição cujo envio é repetido pode chegar ao seu servidor depois de outra que chegou mais tarde.

## Ver o que aconteceu {#forwards}

No console, abra uma requisição. A seção **Forwarding** dela mostra para onde ela foi e em que situação está (**Queued**, **Sending**, **Sent**, **Retrying**, **Failed** ou **Not forwarded**, com o motivo), as tentativas até agora, o último erro e a resposta do seu servidor: o status, os headers e os primeiros 8 KiB do corpo dela. O card Forwarding do bin mostra o último envio que falhou.

Pela API, `GET /v1/requests/{id}` lista os encaminhamentos da requisição em `forwards`, do mais novo para o mais antigo. Um deles:

```json
{
  "id": "fwd_5a1e8c3b7d2f9a4e6c0b1d83",
  "state": "sent",
  "reason": "",
  "url": "https://api.example.com/hooks/orders?source=quickstart",
  "attempts": 1,
  "max_attempts": 3,
  "next_attempt_at": null,
  "last_error": "",
  "answer": {
    "status": 200,
    "headers": [
      {"name": "content-type", "value": "application/json"}
    ],
    "body_base64": "eyJyZWNlaXZlZCI6dHJ1ZX0=",
    "truncated": false
  },
  "duration_ms": 142,
  "created_at": "2026-10-26T09:12:04Z",
  "sent_at": "2026-10-26T09:12:05Z"
}
```

A [referência](/docs/product-bins/reference#forwards) traz todos os campos, estados e motivos. A resposta do seu servidor é mantida pelo mesmo tempo que a requisição, e excluída com ela. No bin, `forward_last_error` e `forward_last_error_at` dizem o que deu errado no último envio que falhou, como `HTTP 503` ou um timeout, e nunca o que a requisição continha.

## Limites {#limits}

| | Starter | Pro | Custom |
| --- | --- | --- | --- |
| Maior corpo encaminhado | 256 KiB | 1 MiB | 1 MiB |
| Encaminhamentos por minuto, por bin | 60 | 300 | 600 |
| Tentativas por requisição | 3 | 5 | 5 |

- **Um corpo maior é registrado e não é encaminhado**, com o motivo `body_too_large`. O mesmo vale para um corpo acima de 1 MiB em qualquer plano, já que um bin armazena só o primeiro 1 MiB dele ([O que um bin registra](/docs/product-bins/reference#edge-records)).
- **Depois de esgotados os encaminhamentos por minuto de um bin**, os encaminhamentos esperam a sua vez. Nenhum é descartado por causa disso.
- **Um bin mantém no máximo 1.000 encaminhamentos não concluídos**: na fila, sendo enviados ou esperando uma nova tentativa. Uma requisição que chega enquanto ele mantém esse número é registrada e não é encaminhada, com o motivo `queue_full`.
- **A URL de encaminhamento com o caminho e a query de uma requisição acrescentados** precisa caber em 8.192 caracteres, ou a requisição não é encaminhada (`url_too_long`).
- **O encaminhamento não consome requisições à parte.** Uma requisição encaminhada conta uma vez para as requisições do mês, quando é registrada, e as tentativas dela não contam. Uma requisição que o bin não registrou, porque as requisições do mês se esgotaram ou o bin estava suspenso, também não é encaminhada.

## Quando o encaminhamento é pausado {#paused}

Quando o seu servidor continua falhando, o bin para de enviar para ele: o encaminhamento é pausado depois de 20 tentativas seguidas que falharam, ou depois de uma hora em que todas as tentativas falharam. Uma tentativa bem-sucedida reinicia as duas contagens.

Enquanto o encaminhamento está pausado, o bin continua registrando, mas não envia nada: cada requisição que chega, e cada encaminhamento que estava esperando, é marcado como não encaminhado, com o motivo `paused`, e nenhum deles é enviado depois. O bin mostra quando e por que o encaminhamento foi pausado: **Paused** no card Forwarding dele, e `forward_paused_at` e `forward_paused_reason` (`failed_in_a_row` ou `failing_for_an_hour`) na API.

**O workspace é avisado**, uma vez a cada pausa, da mesma forma que é avisado sobre as requisições do mês: por e-mail, que vai para o proprietário do workspace, a menos que você escolha outro endereço, e por um webhook, se você configurar um. Os dois ficam em **Notifications** no seu console da conta. Retomar não envia nada.

O e-mail, "Request Bins: forwarding was paused on one of your bins", cita o bin, pelo rótulo e pela URL, e o host para o qual ele encaminhava, nunca o caminho nem a query. Ele diz por que o encaminhamento foi pausado, com o último erro, e que as requisições continuam sendo registradas, mas nenhuma é encaminhada, então as registradas nesse meio-tempo não serão encaminhadas depois. No fim, ele explica como retomar.

O tipo de evento do webhook é `bind.forwarding.paused`, e o corpo dele é:

```json
{
  "type": "bind.forwarding.paused",
  "workspace_id": "{{WORKSPACE_ID}}",
  "data": {
    "bin_id": "bin_3f9a1c7e5b2d8f4a6c0e9b17",
    "label": "Quickstart",
    "url": "https://nnbin.net/b/w4tz8hcv2qnd",
    "forward_host": "api.example.com",
    "reason": "failed_in_a_row",
    "paused_at": "2026-10-26T14:05:12.345678Z",
    "failures": 20,
    "last_error": "HTTP 503"
  }
}
```

`reason` é `failed_in_a_row` ou `failing_for_an_hour`, `failures` é quantos envios seguidos tinham falhado, e `last_error` é o que deu errado no último deles. `forward_host` é só o host da URL de encaminhamento: um aviso nunca leva o caminho nem a query da URL, que podem conter um segredo.

Para retomar depois que o seu servidor for corrigido, escolha **Resume** no card Forwarding, ou defina `forward_url` de novo com `PATCH /v1/bins/{id}`, com a mesma URL ou uma nova. O encaminhamento recomeça com a próxima requisição que o bin registrar, e **Send a test** mostra se o seu servidor responde.

## De onde vêm os encaminhamentos {#source-address}

Os encaminhamentos e os envios de teste chegam ao seu servidor a partir de `23.247.240.155`, por IPv4, então um servidor cujo host só tem endereços IPv6 não consegue recebê-los. Esse é o endereço hoje, e ele pode mudar: esta página vai avisar antes que isso aconteça. Se o seu servidor só aceita requisições de endereços que conhece, libere este.

## O que o encaminhamento não é {#not}

- **Um proxy.** O remetente recebe o `200` do bin, nunca a resposta do seu servidor, e um bin não pode responder com um status, headers ou corpo escolhidos por você.
- **Reenvio.** Uma requisição registrada não pode ser enviada de novo sob demanda: cada uma é encaminhada uma vez, assim que chega, com as suas retentativas.
- **Distribuição.** Um bin encaminha para uma única URL. Para verificar as assinaturas de um provedor e entregar os webhooks dele a vários endpoints seus, com uma dead-letter queue e reenvio, use uma [fonte de Webhooks](/docs/product-webhooks/sources).

## Próximos passos {#next-steps}

- [Referência de Request Bins](/docs/product-bins/reference#forwarding) — `forward_url`, o envio de teste e todos os campos de um encaminhamento.
- [Visão geral do produto](/docs/product-bins) — o que um bin registra e os limites de cada plano.
- [Fontes de Webhooks](/docs/product-webhooks/sources) — os webhooks de um provedor, verificados e entregues aos seus endpoints.
