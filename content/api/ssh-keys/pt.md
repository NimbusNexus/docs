---
title: "Chaves SSH"
description: "Chaves públicas registradas no seu usuário e instaladas em uma VM no boot."
publishedAt: 2026-05-20
updatedAt: 2026-11-03
kind: reference
---

# Chaves SSH

As chaves SSH são a forma de fazer login nas VMs Linux depois do boot. Registre uma chave no seu usuário e depois indique-a em `sshs` ao criar uma VM; o cloud-init a grava no `~/.ssh/authorized_keys` do usuário padrão.

## Como funciona {#how-it-works}

Há duas formas de registrar uma chave:

- `POST /api/v1/ssh/add_public` com um `name` e a sua `ssh_public_key`. Você envia apenas a chave **pública**; a chave privada fica com você.
- `POST /api/v1/ssh/` com um `name` gera um par de chaves e retorna a `private_key` dele uma única vez. Salve-a nessa hora: a API nunca mais a mostra.

Uma VM recebe a única chave que você indica em `sshs` ao criá-la. No boot, o serviço de metadados expõe essa chave pública ao cloud-init, que a grava no arquivo authorized_keys do usuário padrão.

As chaves adicionadas **depois** do boot de uma VM não são enviadas automaticamente para as VMs em execução. Uma VM mantém a chave com que foi criada, então adicione uma chave nova dentro da VM com o seu gerenciamento de configuração habitual.

## Formatos suportados {#formats}

A string da chave precisa estar no formato OpenSSH — a linha única que começa com `ssh-ed25519`, `ecdsa-sha2-nistp...` ou `ssh-rsa`, seguida do material da chave codificado em base64 e, opcionalmente, de um comentário. É o que os arquivos `~/.ssh/id_*.pub` contêm por padrão.

## Fingerprints + duplicatas {#fingerprints}

Cada chave tem um **fingerprint SHA256** estável. `GET /api/v1/ssh/` lista as suas chaves com o `fingerprint` e a `key` pública de cada uma. Os nomes das chaves precisam ser únicos entre as suas chaves: registrar uma segunda chave com um nome que você já usa retorna `409`.

## Remover uma chave {#removing}

`DELETE /api/v1/ssh/` com o id da chave em `ssh_keys` a exclui, e assim as novas VMs não podem usá-la. **As VMs que já deram boot mantêm a chave** no arquivo authorized_keys — o cloud-init não é um reconciliador de estado, é um instalador de primeiro boot. Para revogar uma chave das VMs em execução, você pode:

1. Recriar as VMs com outra chave em `sshs`, ou
2. Editar `~/.ssh/authorized_keys` diretamente dentro da VM (ou pelo seu gerenciamento de configuração).

## Próximos passos {#next-steps}

- [Máquinas virtuais](/docs/api/vms) — as VMs usam estas chaves no boot.
- [Autenticação](/docs/authentication) — as chaves de API são para a API de gerenciamento, não para o login nas VMs. Os endpoints de chaves SSH exigem uma sessão conectada, não uma chave de API.
