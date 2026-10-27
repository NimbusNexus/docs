---
title: "Idempotência"
description: "Repita com segurança requisições que alteram dados, usando o header Idempotency-Key."
publishedAt: 2026-05-20
updatedAt: 2026-10-05
kind: concept
---

# Idempotência

Uma requisição é **idempotente** quando fazê-la duas vezes tem o mesmo efeito que fazê-la uma vez. `GET /v1/vms` é naturalmente idempotente — não altera nada. `POST /v1/vms` naturalmente **não** é idempotente — chame duas vezes e você terá duas VMs.

O header `Idempotency-Key` permite transformar qualquer requisição que altera dados em uma que pode ser repetida com segurança. Envie qualquer valor único (um UUID é o convencional) e guardamos a resposta em cache por 24 horas, devolvendo a mesma resposta em cada repetição com a mesma chave.

## O problema que isso resolve {#problem}

Você chama `POST /v1/vms`. A rede cai no caminho de volta e você recebe um timeout em vez de um 201. A VM foi criada? Você não sabe:

- Se você repetir: talvez fique com duas VMs (a original deu certo; sua retentativa criou uma segunda).
- Se você não repetir: talvez fique com zero VMs (a original falhou; você aceitou o estado errado).

Com uma chave de idempotência, a retentativa é segura. Se a original deu certo, a retentativa retorna o mesmo 201 com o mesmo id de VM — sem duplicata. Se a original falhou, a retentativa de fato faz o trabalho.

## Usar o header {#usage}

Envie qualquer string de até 255 caracteres:

```bash
curl -X POST {{API_BASE_URL}}/v1/vms \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Idempotency-Key: 8e1c91a4-04d0-4d77-8e6e-2f7c1a5b8e84" \
  -H "Content-Type: application/json" \
  -d '{ "name": "web-01", "size": "gp-2-4", "region": "us-east-1", "image": "ubuntu-24.04" }'
```

A convenção é um UUID v4 por operação lógica. Gere-o uma vez no cliente, salve-o antes de enviar a requisição e reutilize-o em cada retentativa dessa mesma operação lógica. Gere um novo para a *próxima* operação lógica.

## O que conta como "mesma chave" {#same-key}

Guardamos a resposta em cache indexada por:

1. O valor do header `Idempotency-Key`
2. A chave de API que faz a requisição
3. O endpoint (método + caminho)

Então duas requisições compartilham uma resposta em cache só se **as três coincidirem**. Isso evita acidentes — uma chave reutilizada em dois endpoints, em duas chaves de API ou até em dois projetos (chaves de API diferentes) não mistura as respostas.

## O que fica em cache {#cached}

Guardamos em cache a **resposta completa** — código de status, headers, corpo. Uma repetição com a mesma chave retorna uma saída idêntica byte a byte. Isso importa para clientes que calculam um fingerprint das respostas para detectar "isto mudou?" — eles recebem uma resposta consistente.

Também guardamos **erros** em cache. Se sua primeira chamada falhou na validação (`422 validation_error`), a retentativa retorna o mesmo `422` — não um erro diferente, caso você tenha corrigido algo entre as tentativas. Isso está correto: idempotência significa "mesmo efeito", e o efeito da primeira chamada foi uma falha. Se você quer uma nova tentativa, gere uma nova chave.

A API de Webhooks é a exceção: ela só registra uma chave quando uma publicação dá certo. Veja [Na API de Webhooks](#webhooks).

O TTL do cache é de **24 horas** a partir do primeiro uso. Depois disso, uma requisição com a mesma chave é tratada como uma nova requisição.

## Quando usar {#when}

| Tipo de endpoint | Usar? |
|---|---|
| `POST` que cria um recurso (`POST /v1/vms`) | Sim |
| `PUT` que substitui um recurso (`PUT /v1/vms/{id}`) | Sim |
| `PATCH` que atualiza um recurso | Sim |
| `DELETE` | Sim |
| `GET`, `HEAD`, `OPTIONS` | Não — já são naturalmente idempotentes |
| `POST` que dispara uma operação pontual (por exemplo, `POST /v1/vms/{id}/reboot`) | Sim — reiniciar duas vezes é diferente de reiniciar uma vez |

Na prática: qualquer requisição que altera dados e pode falhar no meio do caminho se beneficia de uma chave. O custo é um header em cada requisição e uma etapa de geração de UUID do seu lado.

## Conflito com um uso anterior {#conflicts}

Se você reutilizar uma chave com um **corpo de requisição diferente** no mesmo endpoint, recebe `409 Conflict` com `error.code: 'conflict'`, e `error.message` diz que a chave já foi usada com outro corpo de requisição. A requisição original continua valendo; seu corpo diferente é rejeitado. Esse é o comportamento mais seguro — devolver a resposta antiga em silêncio esconderia um bug no seu loop de retentativas.

Se você realmente precisa fazer uma requisição diferente, gere uma nova chave.

Versões anteriores desta página diziam que essa resposta trazia `error.code: 'idempotency_key_reused'`. A API nunca enviou esse código; ela envia `conflict`. `conflict` também cobre outros choques com o estado existente, como um nome já em uso; na API de Webhooks, `details.reason` é `idempotency_key_reuse` neste caso. Veja [Erros](/docs/errors#codes-state).

## Na API de Webhooks {#webhooks}

Na API de Webhooks, `Idempotency-Key` se aplica à publicação de um evento (`POST /v1/events`) e funciona assim:

| Você envia | Você recebe |
|---|---|
| Uma chave nova | `201` e o novo evento, distribuído para os endpoints correspondentes. |
| A mesma chave e o mesmo corpo | `200`, o evento **original** e o header `Idempotency-Replayed: true`. Nada é distribuído de novo. |
| A mesma chave e um corpo diferente | `409` com `error.code: 'conflict'`, `details.reason: 'idempotency_key_reuse'` e a chave em `details.idempotency_key`. O evento original continua valendo. |
| A mesma chave depois de uma requisição que falhou | A requisição é executada de novo. Uma publicação que falhou (um erro de validação, um erro de cota, um limite de requisições) não registra a chave. |

"Mesmo corpo" significa o mesmo tipo de evento e o mesmo payload para o mesmo projeto. Uma chave de idempotência pertence ao seu workspace e ao seu projeto, não à chave de API que a enviou, então duas chaves de API que publicam no mesmo projeto compartilham chaves. Uma chave é guardada por pelo menos 24 horas.

## Quando não vale a pena {#skip}

O fluxo sem chave é `best-effort retry`. Para leituras, tudo bem; para gravações em que você tolera "talvez nada, talvez uma" (operações idempotentes no nível da aplicação), também tudo bem. O header não custa nada — mas, se sua aplicação não repete em caso de falha, você não vai notar a diferença.

Os casos em que você realmente quer uma chave:

- Qualquer coisa ligada a faturamento (você não quer cobrar um cartão duas vezes)
- Qualquer coisa visível para o usuário (você não quer enviar uma notificação duas vezes)
- Qualquer etapa de um fluxo de trabalho que provisiona recursos em caso de falha (você não quer recursos órfãos)

## Próximos passos {#next-steps}

- [Convenções](/docs/conventions) — paginação, códigos de status, formatos de erro e o resto.
- [Limites de requisições](/docs/rate-limiting) — quando as retentativas recebem um 429, a outra metade da história das retentativas seguras.
- [Erros](/docs/errors) — o formato do erro e o que cada `error.code` significa.
