---
title: "Paginação"
description: "Como cada API pagina suas listas, com limit e offset ou marker, e como saber que você chegou ao fim."
publishedAt: 2026-05-20
updatedAt: 2026-11-06
kind: concept
---

# Paginação

A NimbusNexus tem dois tipos de API, e eles paginam as listas de formas diferentes. As APIs dos apps paginam com `limit` e `offset`. Na API de infraestrutura, a maioria dos endpoints de listagem responde com tudo de uma vez, e alguns poucos aceitam `limit` com `marker` ou `offset`.

## As APIs dos apps {#shape}

No Webhooks, no Inboxes, no Request Bins e no Transforms, a maioria dos endpoints de listagem aceita dois parâmetros de query:

- `limit` — tamanho de página. Padrão 50, máximo 200. Acima de 200, a requisição falha na validação: `422` `validation_error` ([Erros](/docs/errors#codes-validation)).
- `offset` — quantos itens pular. Padrão 0, máximo 10.000.

Cada endpoint de listagem responde com os itens e o próximo offset:

```json
{
  "items": [],
  "next_offset": 50
}
```

Envie `next_offset` de volta como `offset` para obter a próxima página. Quando ele é `null`, você está na última página.

Um offset conta posições, então um item criado ou excluído enquanto você percorre uma lista pode fazer você ver outro item duas vezes ou perder um. Se isso importar, compare os ids. Mantenha os mesmos filtros durante todo o percurso e recomece do offset 0 quando mudá-los.

Dois casos são diferentes:

- As **buscas** no Inboxes e no Request Bins paginam com `next_until` em vez disso: veja [Busca de mensagens](/docs/product-inboxes#search) e [Requisições capturadas](/docs/product-bins/reference#requests).
- Em **Códigos QR**, a maioria das listas vem em uma única resposta. A lista de leituras de um código (`GET /v1/qr-tracked/codes/{code_id}/scans`) aceita só `limit`, e a de entregas de um webhook (`GET /v1/qr-tracked/webhooks/{webhook_id}/deliveries`) pagina com `limit` e `cursor`, com o próximo cursor em `nextCursor`.

## A API de infraestrutura {#infrastructure}

A maioria dos endpoints de listagem, como `GET /api/v1/instance/`, responde com a lista inteira e não recebe parâmetros de paginação. Os que paginam fazem isso de uma de duas formas.

### `limit` e `marker` {#marker}

`marker` é o último item que você viu: o id dele ou, no armazenamento de objetos, o nome dele. A resposta começa depois desse item.

- Imagens de VM: `GET /api/v1/image/`.
- DNS: `GET /api/v1/zones/`, `GET /api/v1/recordsets/`, `GET /api/v1/zones/{zone_id}/recordsets/`, `GET /api/v1/zones/{zone_id}/ptr/` e `GET /api/v1/zones/{zone_id}/shares/`.
- Armazenamento de objetos: `GET /api/v1/object_storage/` para contêineres e `GET /api/v1/object_storage/{container_name}/objects` para objetos. Nos objetos, `full_listing=true` retorna todos em uma única resposta.

Essas respostas trazem só `data`, sem nada que diga se ainda há mais itens. Continue até que uma página volte com menos itens que o seu `limit`.

### `limit` e `offset` {#offset}

`offset` é quantos itens pular.

- Backups de volume: `GET /api/v1/backup_restore/volume_backups/`, com `limit` padrão de 10.
- Agendamentos de backup: `GET /api/v1/backup_restore/backup_scheduler/list` e `GET /api/v1/backup_restore/volume_scheduler/list`.
- Conexões de armazenamento externo: `GET /api/v1/external/connections/`.
- Notificações: `GET /api/v1/notifications/list`, com `limit` padrão de 50 e máximo de 200.

Essas respostas também trazem `total`, o número de itens em todas as páginas, então você chegou ao fim quando tiver lido essa quantidade.

## Percorrer as páginas {#walking}

Em uma API de app, siga `next_offset`:

```ts
async function listAllEndpoints() {
  const all = []
  let offset = 0

  while (offset !== null) {
    const url = new URL('{{WEBHOOKS_BASE_URL}}/v1/endpoints')
    url.searchParams.set('limit', '200')
    url.searchParams.set('offset', String(offset))

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${process.env.WEBHOOKS_API_KEY}` },
    })
    const page = await res.json()

    all.push(...page.items)
    offset = page.next_offset
  }

  return all
}
```

Na API de infraestrutura, siga o último id até vir uma página mais curta:

```ts
async function listAllZones() {
  const all = []
  const limit = 100
  let marker

  while (true) {
    const url = new URL('{{API_BASE_URL}}/api/v1/zones/')
    url.searchParams.set('limit', String(limit))
    if (marker) url.searchParams.set('marker', marker)

    const res = await fetch(url, {
      headers: { 'X-API-Key': process.env.NIMBUS_KEY },
    })
    const { data } = await res.json()

    all.push(...data)
    if (data.length < limit) return all
    marker = data.at(-1).id
  }
}
```

Cada página é uma requisição e conta para o [limite de requisições](/docs/rate-limiting).

## Ordenação {#sort}

As listas que aceitam ordenação indicam os parâmetros nas páginas de referência delas. Na API de infraestrutura, são `sort_by` e `sort_desc` nas listas com `offset` que a aceitam, e `sort_key` e `sort_dir` nas imagens de VM e nos conjuntos de registros DNS. Mantenha a mesma ordenação durante todo o percurso.

## Próximos passos {#next-steps}

- [Convenções](/docs/conventions) — o resto do formato da requisição: ids, códigos de status, erros.
- [Limites de requisições](/docs/rate-limiting) — quantas requisições você pode fazer ao percorrer uma lista.
- [Erros](/docs/errors) — o que uma requisição recusada recebe como resposta.
