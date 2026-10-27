---
title: "Compartilhamento de rede"
description: "Compartilhe uma rede, sub-rede ou porta entre projetos do mesmo workspace."
publishedAt: 2026-05-21
updatedAt: 2026-05-21
kind: reference
openapiTag: network-sharing
---

# Compartilhamento de rede

As redes normalmente são isoladas por projeto — uma rede no projeto `acme-prod` é invisível para `acme-staging`. O compartilhamento de rede abre uma brecha controlada nesse isolamento: o projeto proprietário compartilha uma rede específica com outro projeto específico (no mesmo workspace), e o projeto que a recebe pode anexar VMs à rede compartilhada como se ela fosse dele.

Casos de uso: uma rede de serviços compartilhados (bancos de dados, caches, APIs internas) que vários projetos de aplicação precisam alcançar. A alternativa é expor os serviços em IPs públicos e protegê-los de novo na camada L7 — é possível, mas mais complexo do que compartilhar o segmento L2 dentro da fronteira de confiança de um workspace.

Compartilhar entre workspaces não é possível — essa é uma fronteira de isolamento deliberada.

## Próximos passos {#next-steps}

- [Redes](/docs/api/networks) — o recurso que é compartilhado.
- [Workspaces](/docs/api/workspaces) — a fronteira do compartilhamento.
- [Grupos de segurança](/docs/api/security-groups) — o que filtra o tráfego em uma rede compartilhada.
