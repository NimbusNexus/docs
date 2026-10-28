---
title: "Início rápido de Request Bins"
description: "Crie um bin, envie uma requisição para ele com curl e leia o que ele registrou — no console e depois pela API."
publishedAt: 2026-10-22
updatedAt: 2026-10-27
kind: quickstart
---

# Início rápido de Request Bins

Do zero a uma requisição registrada em poucos minutos. Você vai criar um bin, enviar uma requisição para ele com `curl` e ler de volta exatamente o que chegou: primeiro no console, depois pela API.

## Antes de começar {#before}

- **No console, em qualquer plano.** Abra `https://bins.nimbusnexus.net` e entre com a sua conta NimbusNexus. Os passos 1 a 3 não precisam de mais nada, inclusive no Free.
- **Pela API, com uma chave.** O passo 4 precisa de uma chave de API criada no seu [console da conta]({{ACCOUNT_BASE_URL}}/api-keys?product=bins) com **Request Bins** como produto e **Read & write** como permissão. Uma chave pode criar bins em qualquer plano; ler com uma chave o que eles registraram exige o Starter ou superior, e no Free essas rotas respondem `402` `not_entitled`.

## 1. Criar um bin {#create}

No console, escolha **Create a bin** (**New bin**, quando você já tiver um). O rótulo é opcional e os remetentes nunca o veem. **Lifetime** começa com o padrão do seu plano, 24 horas no Free e até ser excluído nos planos pagos; você pode escolher um tempo de vida mais curto, ou digitar o seu próprio com **Custom…**, até o mais longo que o seu plano permite. Ele não pode ser alterado depois. Escolha **Create bin**.

A página do bin se abre. No topo ficam a **Bin URL** dele, como `https://nnbin.net/b/k7xq2mbn9tfa`, e um comando **Try it**, cada um com um botão de copiar.

## 2. Enviar uma requisição ao bin {#send}

De qualquer terminal, envie ao bin um `POST` com um caminho e uma query depois do slug. Use a URL do seu próprio bin:

```bash
curl -X POST "https://nnbin.net/b/k7xq2mbn9tfa/orders?source=quickstart" \
  -H "Content-Type: application/json" \
  -d '{"order_id": 1042, "status": "paid"}'
```

```json
{"status":"accepted"}
```

Essa resposta é a mesma para toda requisição a uma URL de bin, registrada ou não, então ela não diz nada ao remetente sobre o seu bin. O que chegou é o que o console mostra.

Qualquer método, caminho, header ou corpo funciona. No uso real, coloque a URL do bin onde um app, as configurações de webhook de um provedor, um script ou um job de CI esperam uma URL, e deixe que eles enviem.

## 3. Ver no console {#console}

De volta à página do bin, a requisição aparece no topo da lista em poucos segundos; a lista se atualiza a cada 3 segundos. Selecione-a para ver:

- o método e o caminho depois do slug: `POST /orders`;
- a query, decodificada: `source=quickstart`;
- os headers, na ordem em que chegaram;
- o corpo, formatado como JSON, com o texto bruto a um clique de distância;
- o endereço de origem, o tamanho e quando ela chegou.

No Free, o fluxo completo é este: o console lê o que os bins registraram em todos os planos.

## 4. Fazer o mesmo pela API {#api}

Coloque a sua chave em uma variável de ambiente:

```bash
export BINS_API_KEY="<your-api-key>"
```

Todos os caminhos abaixo são relativos a `https://bins.nimbusnexus.net`, e toda requisição leva `Authorization: Bearer <your key>`. Primeiro, crie um bin:

```bash
curl -X POST https://bins.nimbusnexus.net/v1/bins \
  -H "Authorization: Bearer $BINS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"label": "Quickstart"}'
```

```json
{
  "id": "bin_3f9a1c7e5b2d8f4a6c0e9b17",
  "slug": "w4tz8hcv2qnd",
  "url": "https://nnbin.net/b/w4tz8hcv2qnd",
  "label": "Quickstart",
  "status": "enabled",
  "expires_at": null,
  "created_at": "2026-10-22T09:12:01Z",
  "request_count": 0
}
```

A resposta aparece resumida aqui; [o objeto bin](/docs/product-bins/reference#bin) lista todos os campos. Dois importam agora:

- **`url`** é o que você passa a um remetente.
- **`id`** é o que todas as chamadas seguintes recebem. Guarde-o.

`expires_at` é `null` porque, em um plano pago, um bin vive até você excluí-lo; no Free, é 24 horas depois de `created_at`. O Free permite um bin por vez, então lá esta chamada responde `402` `quota_exceeded` enquanto o bin do passo 1 existir. Nesse caso, encontre esse bin pela URL dele, com `GET /v1/bins?url=https://nnbin.net/b/k7xq2mbn9tfa`.

Envie ao novo bin a requisição do passo 2, com a URL dele, e depois liste o que ele registrou:

```bash
curl https://bins.nimbusnexus.net/v1/bins/bin_3f9a1c7e5b2d8f4a6c0e9b17/requests \
  -H "Authorization: Bearer $BINS_API_KEY"
```

```json
{
  "items": [
    {
      "id": "req_8d2e6b1f4a9c3e7d5b0f2a61",
      "bin_id": "bin_3f9a1c7e5b2d8f4a6c0e9b17",
      "method": "POST",
      "path": "/orders",
      "query": "source=quickstart",
      "source_ip": "203.0.113.24",
      "content_type": "application/json",
      "size_bytes": 36,
      "truncated": false,
      "seen_count": 1,
      "received_at": "2026-10-22T09:12:04Z",
      "expires_at": "2026-10-29T09:12:04Z"
    }
  ],
  "next_offset": null,
  "next_until": null
}
```

A requisição mais recente vem primeiro. O `expires_at` dela indica quando ela será excluída: aqui, 7 dias depois, a retenção do Starter.

Para ler uma requisição completa, com a query, os headers e o corpo:

```bash
curl https://bins.nimbusnexus.net/v1/requests/req_8d2e6b1f4a9c3e7d5b0f2a61 \
  -H "Authorization: Bearer $BINS_API_KEY"
```

```json
{
  "id": "req_8d2e6b1f4a9c3e7d5b0f2a61",
  "method": "POST",
  "path": "/orders",
  "query": "source=quickstart",
  "headers": [
    {"name": "user-agent", "value": "curl/8.7.1"},
    {"name": "accept", "value": "*/*"},
    {"name": "content-type", "value": "application/json"},
    {"name": "content-length", "value": "36"}
  ],
  "body_base64": "eyJvcmRlcl9pZCI6IDEwNDIsICJzdGF0dXMiOiAicGFpZCJ9",
  "size_bytes": 36,
  "truncated": false,
  "request_id": "4b8f2c1d9e7a46b3a0c5d8e2f1a7b9c3"
}
```

Esta também está resumida: a resposta completa traz todos os campos do item da lista, e a lista real de headers também inclui os headers adicionados pelos proxies na frente de `nnbin.net`, como `x-forwarded-for`. O corpo vem em base64 porque um corpo não precisa ser texto. Para imprimi-lo:

```bash
curl -s https://bins.nimbusnexus.net/v1/requests/req_8d2e6b1f4a9c3e7d5b0f2a61 \
  -H "Authorization: Bearer $BINS_API_KEY" | jq -r .body_base64 | base64 --decode
```

```text
{"order_id": 1042, "status": "paid"}
```

## Polling, não push {#polling}

Não há stream nem callback. Para esperar uma requisição, faça polling na lista com `since` definido como o `received_at` mais recente que você já viu; ela retorna só as requisições recebidas depois desse instante:

```bash
curl -G https://bins.nimbusnexus.net/v1/bins/bin_3f9a1c7e5b2d8f4a6c0e9b17/requests \
  --data-urlencode "since=2026-10-22T09:12:04Z" \
  -H "Authorization: Bearer $BINS_API_KEY"
```

`-G` com `--data-urlencode` coloca `since` codificado na query string, então um offset como `+00:00` chega intacto. Uma requisição enviada de novo é uma nova linha própria, por isso também volta nessa lista, com `id` e `received_at` próprios.

Não faça polling um número fixo de vezes para depois fazer a asserção sobre a última resposta. Faça a asserção de que a requisição *aparece*, com um timeout, ou um remetente lento vai parecer um remetente que nunca enviou nada.

## Limpeza {#cleanup}

Um bin pago vive até você excluí-lo, a menos que você o tenha criado com `expires_in_minutes`, e todo plano limita quantos bins você pode ter ao mesmo tempo, então exclua-o quando terminar:

```bash
curl -X DELETE https://bins.nimbusnexus.net/v1/bins/bin_3f9a1c7e5b2d8f4a6c0e9b17 \
  -H "Authorization: Bearer $BINS_API_KEY"
```

A exclusão é **permanente**: a URL para de registrar na hora, o que o bin registrou é excluído e o slug dele nunca mais é emitido, nem para você nem para ninguém. Os remetentes continuam recebendo `200` dela. Para, em vez disso, parar de registrar por um tempo, faça um `PATCH` no bin com `{"status": "disabled"}` e, mais tarde, outro com `{"status": "enabled"}`. Para manter o bin e limpar o que ele guarda, esvazie-o com `DELETE /v1/bins/{id}/requests`. No console, as três opções ficam no menu ⋯ da página do bin: **Delete bin…**, **Disable** e **Empty bin…**. No Free, um bin expira no máximo 24 horas depois de criado, o que o encerra da mesma forma que a exclusão.

## Próximos passos {#next-steps}

- [Visão geral do produto](/docs/product-bins) — planos e limites, bins suspensos e o que o Request Bins não faz.
- [Encaminhamento](/docs/product-bins/forwarding) — repasse também cada requisição ao seu próprio servidor, em um plano pago.
- [Referência de Request Bins](/docs/product-bins/reference) — todas as rotas e campos, o que a URL de um bin responde, funções e escopos.
- [API de Request Bins](/docs/reference/bins) — todas as operações, com a requisição em curl, TypeScript, Python ou Go.
