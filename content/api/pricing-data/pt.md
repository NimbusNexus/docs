---
title: "Dados de preços"
description: "Acesso programático à lista de preços oficial. Somente leitura."
publishedAt: 2026-05-21
updatedAt: 2026-11-03
kind: reference
openapiTag: pricing-data
---

# Dados de preços

Os endpoints de dados de preços são um feed somente leitura do que a NimbusNexus cobra, com um endpoint por tipo de recurso:

- `GET /api/v1/pricing/vm` — tamanhos de VM. `architecture` e `vm_class` são obrigatórios; `cpu` e `ram` restringem a lista.
- `GET /api/v1/pricing/storage` — armazenamento em blocos, para um `volume_type`.
- `GET /api/v1/pricing/port`, `/api/v1/pricing/floating_ip` e `/api/v1/pricing/image` — portas de rede, IPs flutuantes e armazenamento de imagens.
- `GET /api/v1/pricing/bandwidth` — largura de banda de saída.

Cada preço vem com o seu período de faturamento: uma única vez, por hora, por dia, por mês ou por ano. Não é preciso fazer login para lê-los. Quem chama com escopo de um dos seus projetos vê os preços que valem para o seu workspace; qualquer outra pessoa vê os preços de tabela.

Casos de uso: integrar estimativas de custo em tempo real ao seu fluxo de provisionamento (mostrar "esta VM vai custar $X/mês" antes que o usuário clique em Launch), criar ferramentas internas de atribuição de custos ou simplesmente manter sua própria planilha de "quanto a NimbusNexus cobra por X agora".

Os preços são cotados em USD.

## Próximos passos {#next-steps}

- [Faturamento](/docs/api/invoices) — os seus saldos e as cobranças ainda não quitadas.
- [Otimizar a fatura mensal](/docs/guides/cost-optimization) — o guia de estratégia para reduzir sua fatura.
- A [página de preços do site de marketing]({{BASE_URL}}/pricing) — a versão legível por humanos destes dados.
