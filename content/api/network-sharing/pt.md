---
title: "Compartilhamento de rede"
description: "Compartilhe uma rede, uma política de QoS, um grupo de segurança, um pool de sub-redes, um escopo de endereços ou um grupo de endereços com outro projeto em que você tem uma função."
publishedAt: 2026-05-21
updatedAt: 2026-11-03
kind: reference
openapiTag: network-sharing
---

# Compartilhamento de rede

As redes normalmente são isoladas por projeto — uma rede no projeto `acme-prod` é invisível para `acme-staging`. O compartilhamento de rede abre uma brecha controlada nesse isolamento: você compartilha um objeto que pertence ao seu projeto com outro projeto em que você tem uma função, e o projeto que o recebe pode usá-lo como se fosse dele — anexar VMs a uma rede compartilhada, por exemplo.

`POST /api/v1/rbac_policy/` faz o compartilhamento. Ele recebe o `object_type` (`network`, `qos_policy`, `security_group`, `subnetpool`, `address_scope` ou `address_group`), o `object_id` do objeto, uma `action` como `access_as_shared` e o projeto que recebe em `target_tenant`.

Casos de uso: uma rede de serviços compartilhados (bancos de dados, caches, APIs internas) que vários projetos de aplicação precisam alcançar. A alternativa é expor os serviços em IPs públicos e protegê-los de novo na camada L7 — é possível, mas mais complexo do que compartilhar o segmento L2 dentro da fronteira de confiança de um workspace.

## Próximos passos {#next-steps}

- [Redes](/docs/api/networks) — o recurso que é compartilhado.
- [Projetos](/docs/api/projects) — os donos e os destinatários dos objetos compartilhados.
- [Grupos de segurança](/docs/api/security-groups) — o que filtra o tráfego em uma rede compartilhada.
