---
title: "Paginação"
description: "Paginação por cursor em todo endpoint de listagem. Estável mesmo com inserções, sem desvio de offset."
publishedAt: 2026-05-20
updatedAt: 2026-10-15
kind: concept
---

# Paginação

Os endpoints de listagem (`GET /v1/vms`, `GET /v1/snapshots` etc.) paginam com cursores opacos, não com offsets numéricos. A paginação por cursor é o padrão certo para listas de recursos que mudam enquanto você pagina — ela retorna cada item exatamente uma vez, mesmo que linhas sejam inseridas ou excluídas entre as buscas de página.

## O formato {#shape}

Dois parâmetros de query em todo endpoint de listagem:

- `limit` — tamanho de página. Padrão 50, máximo 200. Acima de 200, a requisição falha na validação: `422` `validation_error` ([Erros](/docs/errors#codes-validation)).
- `cursor` — ponteiro opaco para a próxima página. Omita na primeira requisição.

Toda resposta de listagem inclui:

```json
{
  "items": [ /* ... */ ],
  "pagination": {
    "next_cursor": "eyJpZCI6InZtXzAxSEc3Li4uIn0=",
    "total_count": null
  }
}
```

Quando `next_cursor` é `null`, você chegou à última página.

## Percorrer as páginas {#walking}

```ts
async function listAllVms(): Promise<VM[]> {
  const all: VM[] = []
  let cursor: string | undefined

  do {
    const url = new URL('{{API_BASE_URL}}/v1/vms')
    url.searchParams.set('limit', '200')
    if (cursor) url.searchParams.set('cursor', cursor)

    const res = await fetch(url, { headers: auth })
    const { items, pagination } = await res.json()

    all.push(...items)
    cursor = pagination.next_cursor ?? undefined
  } while (cursor)

  return all
}
```

Três regras:

1. **Os cursores são opacos.** Não tente interpretá-los nem construí-los. Eles codificam o estado de ordenação + filtros da sua requisição original, então um cursor de uma consulta não funciona em outra.
2. **Não mude os filtros no meio da paginação.** Se você começa com `?status=running` e depois adiciona `?region=us-east-1` na página 2, o comportamento é indefinido. Recomece do zero (sem cursor) quando os filtros mudarem.
3. **Pare quando `next_cursor` for null.** Não tente continuar paginando "por via das dúvidas" — o cursor é o único sinal confiável de fim da lista.

## Por que cursores e não `?page=2&per_page=50` {#why-cursors}

A paginação por offset quebra em dois cenários reais:

**Inserções durante a paginação.** Se você busca a página 1 (itens 1–50), alguém cria uma VM nova e depois você busca a página 2 (itens 51–100), você vê o item 50 duas vezes (agora ele está na posição 51) e nunca vê o item novo. Os cursores capturam "onde você estava" — a próxima página começa depois de onde você realmente estava, não em um offset absoluto.

**Exclusões durante a paginação.** O mesmo problema ao contrário: se uma VM é excluída entre as buscas de página, um cliente que pagina por offset pula um item. Clientes que paginam por cursor não pulam.

Esses casos extremos importam em qualquer escala não trivial. Usamos paginação por cursor por padrão para que eles não causem problemas para você.

## `total_count` {#total-count}

O campo `total_count` em `pagination` é **null na maioria dos endpoints**, de propósito. Contar todos os itens de uma lista paginada é uma consulta cara que fica menos útil à medida que N cresce ("você tem 14.328 VMs em todos os seus projetos" — o que fazer com isso?). Quando `total_count` está presente, a página de referência do endpoint o documenta; quando está ausente, não dependa dele.

Se você realmente precisa de uma contagem exata, pagine até o fim e conte o que recebeu.

## Ordenação {#sort}

Os endpoints de listagem têm uma ordenação padrão (geralmente `created_at desc`, os mais novos primeiro), documentada por endpoint. Alguns endpoints aceitam `?sort=` para substituí-la; a página de referência lista o que é aceito.

O cursor codifica a ordenação, então mudar `?sort=` entre as buscas de página é um dos casos de "comportamento indefinido" — recomece do zero quando mudá-la.

## Filtros {#filters}

Todo endpoint de listagem aceita alguns parâmetros de filtro padrão:

- `created_after` / `created_before` — timestamps RFC 3339
- `updated_after` / `updated_before` — timestamps RFC 3339
- Filtros específicos do recurso (por exemplo, `?region=us-east-1&state=running` em VMs)

Os filtros se combinam; a resposta é o AND de todos os filtros. A página de referência do recurso documenta quais filtros ele aceita.

## Quando você realmente quer todos os itens {#listing}

Chamar a listagem paginada em um loop apertado para enumerar todos os recursos serve para trabalho pontual, mas sai caro para daemons que rodam repetidamente. Dois padrões melhores:

1. **Webhooks.** Inscreva-se nos eventos `resource.created` / `resource.deleted` e mantenha seu próprio índice. Veja [Webhooks da plataforma](/docs/webhooks).
2. **Endpoints de exportação em lote.** Para alguns recursos (snapshots, backups, logs de auditoria), há um endpoint de exportação dedicado que transmite o conjunto completo em uma única resposta. A página de referência do recurso documenta esses endpoints onde eles existem.

O padrão de paginação é para uso interativo (uma tabela no painel, um comando de listagem na CLI). Para sincronização contínua, o custo da paginação domina e os webhooks são a resposta certa.

## Próximos passos {#next-steps}

- [Convenções](/docs/conventions) — o resto do formato da requisição (códigos de status, erros, idempotência).
- [Webhooks da plataforma](/docs/webhooks) — alternativa baseada em push para sincronização contínua.
- A página de referência de qualquer endpoint de listagem — filtros e opções de ordenação específicos do endpoint.
