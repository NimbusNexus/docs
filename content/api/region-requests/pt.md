---
title: "Solicitações de região"
description: "Peça à NimbusNexus que abra uma região que ela ainda não atende."
publishedAt: 2026-05-21
updatedAt: 2026-11-03
kind: reference
openapiTag: region-requests
---

# Solicitações de região

Uma sessão conectada pode usar qualquer região que a NimbusNexus atende: `GET /api/v1/account/datacenters` lista as regiões, e `GET /api/v1/account/rescope?region=<region_name>` muda para uma delas (veja [Visão geral da conta](/docs/api/account-overview)). Uma solicitação de região é para um lugar que a NimbusNexus ainda não atende. Ela nos diz onde você gostaria que abríssemos em seguida.

Uma solicitação de região não altera cotas. Para aumentar um limite, envie uma solicitação de cota com `POST /api/v1/quota-request/` (veja [Cotas](/docs/api/quotas)).

`POST /api/v1/account/region-requests` é o que está por trás do formulário "solicitar uma região" no site da NimbusNexus, por isso não exige login. Envie um `email` e um `regionCode`: um de `ams`, `par`, `mad`, `sto`, `mil`, `waw`, `dxb`, `tlv`, `bom`, `icn`, `hkg`, `cgk`, `gru`, `mex`, `yyz` ou `jnb`, ou `__other` com o lugar em `regionOtherText`. `company` e `note` são opcionais. A resposta é só `success`: nada é aprovado nem concedido. Contamos as solicitações para ver onde está a demanda.

## Próximos passos {#next-steps}

- [Regiões](/docs/api/regions) — a lista de regiões disponíveis.
- [Cotas](/docs/api/quotas) — como pedir um limite maior.
- [Visão geral da conta](/docs/api/account-overview) — o contexto da conta para o acesso a regiões.
