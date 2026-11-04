---
title: "Idempotência"
description: "Quais rotas aceitam o header Idempotency-Key e como repetir com segurança nas demais."
publishedAt: 2026-05-20
updatedAt: 2026-11-04
kind: concept
---

# Idempotência

Uma requisição é **idempotente** quando fazê-la duas vezes tem o mesmo efeito que fazê-la uma vez. `GET /api/v1/instance/` é naturalmente idempotente — não altera nada. `POST /api/v1/instance/` naturalmente **não** é idempotente — chame duas vezes e você terá duas VMs.

O header `Idempotency-Key` permite repetir uma requisição com segurança, mas só nas poucas rotas que o aceitam. Todas as outras rotas ignoram o header.

## O problema que isso resolve {#problem}

Você publica um evento com `POST /v1/events`. A rede cai no caminho de volta e você recebe um timeout em vez de um 201. O evento foi enviado? Você não sabe:

- Se você repetir: talvez seus clientes o recebam duas vezes (a original deu certo; sua retentativa publicou um segundo).
- Se você não repetir: talvez eles nunca o recebam (a original falhou; você aceitou o estado errado).

Com uma chave de idempotência, a retentativa é segura. Se a original deu certo, a retentativa retorna o evento original e não distribui nada de novo. Se a original falhou, a retentativa de fato faz o trabalho.

## Rotas que aceitam o header {#usage}

| Rota | API | A chave é |
|---|---|---|
| `POST /v1/events` | Webhooks | Opcional |
| `POST /v1/qr-tracked/imports` | Códigos QR | Obrigatória |
| `POST /api/v1/payment/payment_methods/{payment_method_id}/add_funds` | Infraestrutura | Obrigatória |

Envie qualquer string única:

```bash
curl -X POST {{WEBHOOKS_BASE_URL}}/v1/events \
  -H "Authorization: Bearer $WEBHOOKS_API_KEY" \
  -H "Idempotency-Key: 8e1c91a4-04d0-4d77-8e6e-2f7c1a5b8e84" \
  -H "Content-Type: application/json" \
  -d '{ "event_type": "order.created", "payload": { "order_id": "1234" } }'
```

A convenção é um UUID v4 por operação lógica. Gere-o uma vez no cliente, salve-o antes de enviar a requisição e reutilize-o em cada retentativa dessa mesma operação lógica. Gere um novo para a *próxima* operação lógica.

## Na API de Webhooks {#webhooks}

Na API de Webhooks, `Idempotency-Key` se aplica à publicação de um evento (`POST /v1/events`) e funciona assim:

| Você envia | Você recebe |
|---|---|
| Uma chave nova | `201` e o novo evento, distribuído para os endpoints correspondentes. |
| A mesma chave e o mesmo corpo | `200`, o evento **original** e o header `Idempotency-Replayed: true`. Nada é distribuído de novo. |
| A mesma chave e um corpo diferente | `409` com `error.code: 'conflict'`, `details.reason: 'idempotency_key_reuse'` e a chave em `details.idempotency_key`. O evento original continua valendo. |
| A mesma chave depois de uma requisição que falhou | A requisição é executada de novo. Uma publicação que falhou (um erro de validação, um erro de cota, um limite de requisições) não registra a chave. |

"Mesmo corpo" significa o mesmo tipo de evento e o mesmo payload para o mesmo projeto. Uma chave de idempotência pertence ao seu workspace e ao seu projeto, não à chave de API que a enviou, então duas chaves de API que publicam no mesmo projeto compartilham chaves. Uma chave é guardada por pelo menos 24 horas.

## Em Códigos QR e ao adicionar fundos {#other-routes}

Em Códigos QR, uma importação em lote (`POST /v1/qr-tracked/imports`) exige uma chave. Uma chave de idempotência pertence ao seu workspace. A mesma chave e o mesmo corpo retornam a importação original sem criar os códigos dela de novo; a mesma chave e um corpo diferente recebem `409`.

Adicionar fundos ao seu saldo (`POST /api/v1/payment/payment_methods/{payment_method_id}/add_funds`) também exige uma chave, para que a retentativa de uma recarga não cobre o cartão duas vezes. Esta chamada exige uma sessão conectada, não uma chave de API ([Métodos de pagamento](/docs/api/payment-methods)).

## Conflito com um uso anterior {#conflicts}

Em Webhooks e Códigos QR, se você reutilizar uma chave com um **corpo de requisição diferente** no mesmo endpoint, recebe `409 Conflict` com `error.code: 'conflict'`, e `error.message` diz que a chave já foi usada com outro corpo de requisição. A requisição original continua valendo; seu corpo diferente é rejeitado. Esse é o comportamento mais seguro — devolver a resposta antiga em silêncio esconderia um bug no seu loop de retentativas.

Se você realmente precisa fazer uma requisição diferente, gere uma nova chave.

Versões anteriores desta página diziam que essa resposta trazia `error.code: 'idempotency_key_reused'`. A API nunca enviou esse código; ela envia `conflict`. `conflict` também cobre outros choques com o estado existente, como um nome já em uso; na API de Webhooks, `details.reason` é `idempotency_key_reuse` neste caso. Veja [Erros](/docs/errors#codes-state).

## Em todas as outras rotas {#skip}

Sem uma chave, verifique antes de repetir uma gravação:

- **Criar uma VM ou um volume.** A chamada coloca o trabalho na fila e responde sem id, então procure o novo recurso na lista (`GET /api/v1/instance/`, `GET /api/v1/storage/`) antes de enviá-la de novo. Um `name` único facilita encontrá-lo.
- **Criar algo com um nome único.** Uma zona DNS ou um contêiner do armazenamento de objetos cujo nome já está em uso recebe `409`, então uma retentativa depois de um timeout não consegue criar um segundo. Entenda o `409` como um sinal de que a original pode ter dado certo.
- **Excluir.** Repetir uma exclusão não exclui mais nada, embora a segunda chamada possa responder com um erro porque o recurso já não existe. Leia o recurso para ter certeza.

Para leituras, repetir sempre é seguro.

## Próximos passos {#next-steps}

- [Convenções](/docs/conventions) — paginação, códigos de status, formatos de erro e o resto.
- [Limites de requisições](/docs/rate-limiting) — quando as retentativas recebem um 429, a outra metade da história das retentativas seguras.
- [Erros](/docs/errors) — o formato do erro e o que cada `error.code` significa.
