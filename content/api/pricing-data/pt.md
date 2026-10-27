---
title: "Dados de preços"
description: "Acesso programático à lista de preços oficial. Somente leitura."
publishedAt: 2026-05-21
updatedAt: 2026-05-21
kind: reference
openapiTag: pricing-data
---

# Dados de preços

O endpoint de dados de preços é um feed somente leitura da lista de preços oficial da NimbusNexus — tamanhos de VM por família, classes de armazenamento em blocos, tiers do armazenamento de objetos, tarifas de egress, multiplicadores por mecanismo de banco de dados gerenciado, tudo. Os mesmos dados alimentam as páginas de preços do site de marketing e as projeções de custo do painel.

Casos de uso: integrar estimativas de custo em tempo real ao seu fluxo de provisionamento (mostrar "esta VM vai custar $X/mês" antes que o usuário clique em Launch), criar ferramentas internas de atribuição de custos ou simplesmente manter sua própria planilha de "quanto a NimbusNexus cobra por X agora".

Os preços são cotados em USD e são atualizados sempre que ajustamos a lista de preços publicada (raramente — normalmente uma ou duas vezes por ano, e avisamos por e-mail com 30 dias de antecedência antes de qualquer aumento).

## Próximos passos {#next-steps}

- [Faturas](/docs/api/invoices) — o que os preços produzem na prática.
- [Otimizar a fatura mensal](/docs/guides/cost-optimization) — o guia de estratégia para reduzir sua fatura.
- A [página de preços do site de marketing]({{BASE_URL}}/pricing) — a versão legível por humanos destes dados.
