---
title: "Grupos de endereços"
description: "Conjuntos nomeados de CIDRs, reutilizáveis nas regras de grupos de segurança."
publishedAt: 2026-05-21
updatedAt: 2026-05-21
kind: reference
openapiTag: address-groups
---

# Grupos de endereços

Um grupo de endereços é um conjunto nomeado e mutável de blocos CIDR que você pode referenciar nas regras de [grupos de segurança](/docs/api/security-groups). Em vez de colar a mesma allow-list em dez grupos de segurança, você cria um grupo de endereços (`office-cidrs`) e o referencia em cada regra. Adicione ou remova um CIDR do grupo; todas as regras que o referenciam são atualizadas imediatamente.

O caso de uso clássico: CIDRs de VPN corporativa que mudam com o tempo. Manter a lista diretamente em cada grupo de segurança significa sair caçando cada cópia quando um CIDR muda; mantê-la em um único grupo de endereços significa atualizar em um só lugar.

## Próximos passos {#next-steps}

- [Grupos de segurança](/docs/api/security-groups) — onde os grupos de endereços são referenciados.
- [Redes](/docs/api/networks) e [Sub-redes](/docs/api/subnets) — a camada de rede dentro da qual os grupos de endereços se aplicam.
