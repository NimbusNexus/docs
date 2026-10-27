---
title: "Referência da API"
description: "Todas as operações de todos os produtos da NimbusNexus, apps e infraestrutura, com a chamada REST e a chamada do SDK na linguagem que você escolher."
publishedAt: 2026-10-19
updatedAt: 2026-10-22
kind: reference
---

# Referência da API

Todo produto NimbusNexus é uma API REST, e todas as operações estão listadas aqui. Apps são os produtos gerenciados que você chama a partir do seu código: Webhooks, Inboxes, Códigos QR e Request Bins. Infraestrutura são os recursos de nuvem dos seus projetos: VMs, armazenamento, bancos de dados, rede e DNS.

Cada operação mostra a requisição na linguagem escolhida no topo da página. REST é `curl`. Em TypeScript, Python e Go, você vê a chamada do SDK quando o produto tem um SDK e o cliente HTTP habitual da linguagem quando não tem. A autenticação é a mesma em todo lugar: uma chave de API no header `Authorization`, configurada em [API REST](/docs/setup/rest). Os erros têm um único formato, descrito em [Erros](/docs/errors).
