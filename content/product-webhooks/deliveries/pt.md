---
title: "Entregas e retentativas"
description: "O que acontece com cada evento depois que ele é distribuído — estados de entrega, o cronograma de retentativas, a dead-letter queue e como reenviar."
publishedAt: 2026-10-19
updatedAt: 2026-10-30
kind: concept
---

# Entregas e retentativas

Publicar um evento cria uma **entrega** para cada endpoint inscrito no tipo dele. Uma entrega é a unidade que enviamos, repetimos e registramos: você pode ver cada tentativa que ela fez e o que voltou, e enviá-la de novo sempre que precisar.

## Estados de entrega {#states}

| Estado | Significado |
|---|---|
| `queued` | Esperando a primeira tentativa. |
| `sending` | Uma tentativa está em andamento. |
| `sent` | O endpoint respondeu 2xx. Concluída. Uma entrega que a [transformação](/docs/product-webhooks/transformations#dropped) do endpoint decidiu não enviar também fica como `sent`, com `"dropped": true`. |
| `failed` | A última tentativa falhou e outra está agendada (`next_attempt_at`). Também é o caso de uma entrega que espera a [transformação pausada](/docs/product-webhooks/transformations#versions) do endpoint. |
| `dead` | Sem tentativas restantes, retida sem envio porque o endpoint precisa passar pela [verificação](/docs/product-webhooks/endpoint-verification#gated) antes, ou com falha na [transformação](/docs/product-webhooks/transformations#failures) do endpoint. Fica na dead-letter queue até você enviá-la de novo. |

Qualquer coisa que não seja 2xx conta como falha: um status 4xx ou 5xx, um timeout, um erro de conexão ou de TLS. Cada tentativa espera até 10 segundos por uma resposta, ou o `delivery_timeout_ms` do próprio endpoint (de 100 ms a 60 s).

## O cronograma de retentativas {#retries}

Uma entrega que falhou é repetida depois de 30 segundos, depois de 1, 2, 4 e 8 minutos, dobrando a cada vez até uma hora entre tentativas, até chegar ao `max_attempts` do endpoint. O seu plano limita o `max_attempts` (5 no Free, 8 no Starter, 10 no Pro).

Quando a curva padrão não serve para o receptor, dê ao endpoint um `retry_schedule` — o intervalo, em segundos, antes de cada retentativa:

```bash
curl -sX PATCH {{WEBHOOKS_BASE_URL}}/v1/endpoints/ep_3f9a… \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"retry_schedule": [10, 60, 300, 1800]}'
```

Toda tentativa envia os mesmos bytes, assinados de novo com um timestamp novo, então uma entrega que chega uma hora atrasada ainda passa na verificação.

## Quando um endpoint continua falhando {#auto-disable}

Depois de 20 falhas seguidas, um endpoint é desativado automaticamente, com o motivo registrado, e enviamos um [webhook operacional](#operational) `endpoint.disabled` para que você fique sabendo. Os novos eventos deixam de ser distribuídos para ele. Corrija o receptor, depois ative o endpoint (`POST /v1/endpoints/{id}/enable`, ou **Enable** no console) e reenvie o que ele perdeu.

## Ver o que aconteceu {#attempts}

No console, **Deliveries** lista todas as entregas com o status, as tentativas e o último erro; abra uma para ver cada tentativa — código de status, erro, duração — e o payload enviado. Pela API:

```bash
curl -s "{{WEBHOOKS_BASE_URL}}/v1/deliveries?status=failed&endpoint_id=ep_3f9a…" \
  -H "Authorization: Bearer $READ_KEY"

curl -s {{WEBHOOKS_BASE_URL}}/v1/deliveries/dlv_…/attempts \
  -H "Authorization: Bearer $READ_KEY"
```

Quando a implantação registra esses dados, uma tentativa também traz a primeira parte do corpo da resposta do endpoint e os headers que enviamos (com as credenciais mascaradas).

Quando o endpoint tem uma [transformação](/docs/product-webhooks/transformations#deliveries), a entrega também mostra a execução que a moldou — a versão, o corpo enviado, os logs ou o erro — e `GET /v1/deliveries/{id}/transform` retorna essa execução.

## Reenviar {#replay}

| O quê | Como |
|---|---|
| Uma entrega | `POST /v1/deliveries/{id}/redeliver` — a partir de `dead`, `failed` ou `sent`. |
| Todas as entregas mortas (ou com falha) | `POST /v1/deliveries/redeliver` com `{"status": "dead"}`, opcionalmente restrito por `endpoint_id` ou `project_id`. |
| Entregas em uma janela de tempo | `POST /v1/deliveries/replay` com `from`, `to` e `status` — para "o receptor ficou fora do ar das 02:00 às 04:00". Somente chaves admin; no máximo 10.000 por chamada. |
| Um evento, para um endpoint à sua escolha | `POST /v1/events/{id}/replay` com `{"endpoint_id": "ep_…"}` — mesmo um que não estava inscrito. Somente chaves admin. |

As quatro formas criam novas tentativas do evento armazenado; elas não publicam um evento novo, então o id do evento pelo qual o seu endpoint deduplica continua o mesmo. Um endpoint que precisa passar pela [verificação](/docs/product-webhooks/endpoint-verification#gated) e ainda não passou é recusado (`409 endpoint_not_verified`) ou, nas duas formas em lote, deixado de fora e contado em `skipped_unverified`.

## Webhooks operacionais {#operational}

Para ficar sabendo de problemas de entrega sem ficar olhando o console, inscreva um endpoint seu nos nossos eventos operacionais: `endpoint.disabled`, `endpoint.degraded`, `endpoint.recovered`, `message.attempt.exhausted` (uma entrega foi para `dead`) e `transformation.disabled` (uma [transformação](/docs/product-webhooks/transformations#failures) foi desativada depois de falhar). Adicione um em **Operational webhooks** no console, ou com `POST /v1/operational-endpoints`. Eles são assinados como qualquer outra entrega.

## Por quanto tempo as entregas são mantidas {#retention}

Os eventos, as entregas e as tentativas deles são mantidos por 90 dias.

## Próximos passos {#next-steps}

- [Verificação de endpoint](/docs/product-webhooks/endpoint-verification) — por que um endpoint correspondente pode não receber nenhuma entrega.
- [Verificação de assinatura](/docs/product-webhooks/signatures) — como verificar cada entrega do seu lado.
- [Visão geral de Webhooks](/docs/product-webhooks) — eventos, endpoints e inscrições.
