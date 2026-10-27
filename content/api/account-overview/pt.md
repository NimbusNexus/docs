---
title: "Visão geral da conta"
description: "Metadados de nível superior da conta — proprietário, contato de faturamento, acesso a regiões, nível do plano."
publishedAt: 2026-05-21
updatedAt: 2026-05-21
kind: reference
openapiTag: account-overview
---

# Visão geral da conta

Uma "conta" fica acima de todos os workspaces, projetos e recursos que você tem na NimbusNexus. Ela guarda o contato de faturamento, o nome da entidade jurídica que aparece nas faturas, o nível do plano (free / starter / production / enterprise), as regiões em cuja allow-list você está e as preferências que valem para a conta inteira. Existe exatamente uma conta por cadastro.

A maioria destes endpoints é somente leitura para quem não é proprietário e de leitura e escrita para os proprietários. O trabalho do dia a dia acontece no nível do projeto; as chamadas no nível da conta costumam ser operações feitas uma vez por trimestre (trocar o contato de faturamento, solicitar uma nova região, fazer upgrade do nível do plano).

## Próximos passos {#next-steps}

- [Workspaces](/docs/api/workspaces) — a próxima camada abaixo, dentro da conta.
- [Solicitações de região](/docs/api/region-requests) — solicite acesso a uma região que você ainda não tem.
