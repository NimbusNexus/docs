---
title: "Início rápido de Inboxes"
description: "Crie um endereço de e-mail descartável, envie uma mensagem para ele e leia a mensagem de volta — no painel ou com curl."
publishedAt: 2026-08-18
updatedAt: 2026-10-27
kind: quickstart
---

# Início rápido de Inboxes

Do zero a algo que você pode verificar em um teste. Você vai criar uma caixa de entrada, enviar um e-mail real para o endereço dela e ler de volta o código de uso único.

## Antes de começar {#before}

- **No painel, em qualquer plano.** Abra o Inboxes, escolha **Create an inbox** e depois **Create inbox**: o rótulo é opcional, e o tempo de vida começa com o padrão do seu plano. A página da nova caixa de entrada mostra exatamente para onde enviar, cada um com um botão de copiar: o endereço e, se houver, a frase dele. O que chega aparece na lista abaixo, em segundos. No plano gratuito, o fluxo completo é esse.
- **Pela API, em um plano pago.** A leitura programática exige o Starter ou superior — no plano gratuito, as rotas de mensagens respondem `not_entitled`. Você também precisa de uma chave de API gerada no console da conta com **Inboxes** como produto; veja [Como obter acesso](/docs/product-inboxes#access).

Todos os caminhos abaixo são relativos a `{{INBOXES_BASE_URL}}`, e toda requisição leva `Authorization: Bearer <your key>`.

## 1. Criar uma caixa de entrada {#allocate}

```bash
curl -X POST {{INBOXES_BASE_URL}}/v1/inboxes \
  -H "Authorization: Bearer $INBOXES_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"phrase": true}'
```

```json
{
  "id": "inb_7f820a77f64ea18174499945",
  "address": "ff25m3tue9vm@nninbox.com",
  "transport": "email",
  "phrase": "nn-re89dr",
  "status": "enabled",
  "expires_at": null
}
```

Três campos importam:

- **`address`** é o que você passa ao sistema sob teste.
- **`phrase`** precisa aparecer no assunto de tudo o que for enviado para esse endereço, ou o e-mail é recusado — é isso que impede que um endereço vazado seja usado para fazer cadastros por aí. Em um plano pago, a frase é opcional: sem `"phrase": true`, você recebe `"phrase": ""` e o endereço aceita qualquer assunto.
- **`id`** é o que todas as chamadas seguintes recebem. Guarde-o.

`expires_at` é `null` porque um endereço pago vive até você excluí-lo; envie `expires_in_minutes` para obter um que expire sozinho.

`transport` é sempre `"email"`, porque uma caixa de entrada só recebe e-mails. `POST /v1/inboxes` aceita `"transport": "email"` ou nenhum `transport`; qualquer outro valor, como `"http"`, é recusado com um `422` `validation_error`. Para registrar requisições HTTP, use o [Request Bins](/docs/product-bins).

## 2. Enviar uma mensagem ao endereço {#send}

Nada específico da NimbusNexus aqui — envie a partir do que você estiver testando. A única regra é o assunto:

```text
To:      ff25m3tue9vm@nninbox.com
Subject: nn-re89dr Your verification code
```

Um assunto sem a frase é recusado durante a conversa SMTP. O seu remetente é avisado e nada é armazenado — então uma mensagem que não aparece aqui é uma recusa real, e não um descarte silencioso.

## 3. Ler a mensagem {#read}

```bash
curl "{{INBOXES_BASE_URL}}/v1/inboxes/inb_7f820a77f64ea18174499945/messages?extract=otp" \
  -H "Authorization: Bearer $INBOXES_API_KEY"
```

```json
{
  "items": [
    {
      "id": "msg_bd160c0bcf8db20fba4e535d",
      "from_addr": "noreply@example.test",
      "subject": "nn-re89dr Your verification code",
      "received_at": "2026-08-18T09:12:04Z",
      "extracted": { "otp": "100017" }
    }
  ],
  "next_offset": null,
  "next_until": null
}
```

`extracted.otp` é o ponto principal. Um teste que faz asserções sobre um fluxo de cadastro geralmente quer exatamente uma coisa — o código —, e `?extract=otp` o coloca na resposta da lista, então o caso comum não precisa de uma segunda requisição. Sem `extract`, `extracted` é `null`; `extract=links` retorna os links da mensagem em vez disso, e `extract=all` retorna os dois.

Para encontrar uma mensagem entre muitas, faça uma busca na lista: `q=verification` mantém as mensagens que contêm o texto, e `in=subject` (ou `from`, `headers` ou `body`) restringe onde ela procura. Uma busca é paginada por `next_until`, e não por `next_offset`; [Busca de mensagens](/docs/product-inboxes#search) traz todos os parâmetros.

Para a mensagem completa, incluindo as duas partes do corpo, os veredictos de SPF/DKIM/DMARC e os headers:

```bash
curl {{INBOXES_BASE_URL}}/v1/inboxes/inb_7f820a77f64ea18174499945/messages/msg_bd160c0bcf8db20fba4e535d \
  -H "Authorization: Bearer $INBOXES_API_KEY"
```

**Só tem o endereço?** Busque a caixa de entrada para obter o `id` dela:

```bash
curl "{{INBOXES_BASE_URL}}/v1/inboxes?address=ff25m3tue9vm@nninbox.com" \
  -H "Authorization: Bearer $INBOXES_API_KEY"
```

## Polling, não push {#polling}

Não há stream nem callback. Os e-mails chegam em segundos, então faça polling na rota de listagem — um intervalo curto durante alguns segundos é suficiente, e é o que o próprio painel faz.

Não faça polling um número fixo de vezes para depois fazer a asserção sobre a última resposta. Faça a asserção de que a mensagem *aparece*, com um timeout, ou um remetente lento vai parecer um remetente com defeito.

## Limpeza {#cleanup}

Um endereço pago nunca expira, a menos que você o tenha criado com `expires_in_minutes`, e todo plano limita quantos você pode ter ao mesmo tempo — então exclua-o quando terminar:

```bash
curl -X DELETE {{INBOXES_BASE_URL}}/v1/inboxes/inb_7f820a77f64ea18174499945 \
  -H "Authorization: Bearer $INBOXES_API_KEY"
```

A exclusão é **permanente**: a caixa de entrada e o que ela guarda são excluídos, e o endereço é aposentado, de modo que nunca mais pode ser emitido, nem para você nem para ninguém. Isso é proposital — um endereço descartável reciclado entregaria os e-mails de um desconhecido na sua caixa de entrada. Para apenas pausar um endereço, faça um `PATCH` com `{"status": "disabled"}` e ative-o de novo mais tarde. No painel, as duas opções ficam no menu ⋯ da página da caixa de entrada: **Delete inbox…** e **Disable**.

## Próximos passos {#next-steps}

- [Endereços e a frase](/docs/product-inboxes/addresses) — as regras de aceitação completas e como a expiração interage com a retenção.
- [Visão geral do produto](/docs/product-inboxes) — todos os limites por plano e o que o produto não faz.
- [Referência da API de Inboxes](/docs/reference/inboxes) — todas as rotas, com a requisição em curl, TypeScript, Python ou Go.
