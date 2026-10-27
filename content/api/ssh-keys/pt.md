---
title: "Chaves SSH"
description: "Chaves públicas registradas no projeto e injetadas nas VMs no boot."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: reference
---

# Chaves SSH

As chaves SSH são a forma de fazer login nas VMs Linux depois do boot. Registre sua chave pública no projeto; toda VM nova recebe a chave no `~/.ssh/authorized_keys` do usuário padrão via cloud-init.

## Como funciona {#how-it-works}

Você registra apenas a chave **pública** — a NimbusNexus nunca vê sua chave privada. No boot, o serviço de metadados expõe ao cloud-init as chaves públicas registradas no projeto, e o cloud-init as grava no arquivo authorized_keys do usuário padrão (`ubuntu` no Ubuntu, `debian` no Debian, `rocky` no Rocky, `Administrator` no Windows via WinRM).

As chaves adicionadas **depois** do boot de uma VM não são enviadas automaticamente para as VMs em execução. Reinicie a VM (por padrão, o cloud-init não roda de novo depois do primeiro boot, então isso só ajuda com imagens configuradas para rodá-lo de novo) ou adicione a chave dentro da VM com o seu gerenciamento de configuração habitual.

## Formatos suportados {#formats}

Aceitamos:

- **ed25519** — recomendado; pequeno, rápido, moderno
- **ecdsa-sha2-nistp256 / nistp384 / nistp521**
- **RSA** — mínimo de 2048 bits; 4096 bits recomendado; rejeitamos < 2048

DSA é rejeitado (foi descontinuado no upstream desde o OpenSSH 7.0).

A string da chave precisa estar no formato OpenSSH — a linha única que começa com `ssh-ed25519`, `ecdsa-sha2-nistp...` ou `ssh-rsa`, seguida do material da chave codificado em base64 e, opcionalmente, de um comentário. É o que os arquivos `~/.ssh/id_*.pub` contêm por padrão.

## Fingerprints + duplicatas {#fingerprints}

Cada chave tem um **fingerprint SHA256** estável. A API rejeita duplicatas pelo fingerprint — adicionar a mesma chave duas vezes (mesmo com um rótulo diferente) retorna 409. Isso pega o erro comum "adicionei a chave do meu laptop a dois projetos" antes que ele cause confusão na atribuição de contas.

## Remover uma chave {#removing}

Excluir uma chave do projeto a remove dos próximos boots de VM. **As VMs que já deram boot mantêm a chave** no arquivo authorized_keys — o cloud-init não é um reconciliador de estado, é um instalador de primeiro boot. Para revogar uma chave das VMs em execução, você pode:

1. Recriar as VMs a partir de um snapshot recente, ou
2. Editar `~/.ssh/authorized_keys` diretamente dentro da VM (ou pelo seu gerenciamento de configuração).

Se o objetivo é revogar rápido porque a chave foi comprometida: o painel tem a opção "revoke from all projects", de um clique, que envia a remoção pelo serviço de metadados. O equivalente na API está na referência de IAM (em breve).

## Próximos passos {#next-steps}

- [Máquinas virtuais](/docs/api/vms) — as VMs usam estas chaves no boot.
- [Autenticação](/docs/authentication) — as chaves de API não têm relação com isso; elas são para a API de gerenciamento, não para o login nas VMs.
