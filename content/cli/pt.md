---
title: "CLI"
description: "nimbus — a interface de linha de comando da API REST da NimbusNexus."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: cli
---

# CLI

> **Status: pré-lançamento.** A CLI está em desenvolvimento ativo. Esta página documenta o formato da v1.0; até o binário ser publicado, use a API REST diretamente, conforme [Autenticação](/docs/authentication) e [Convenções](/docs/conventions).

`nimbus` é a interface de linha de comando oficial. Um único binário estático, sem dependências de runtime, disponível para macOS (Intel + Apple Silicon), Linux (amd64 + arm64) e Windows.

> **Procurando o `nn-webhooks`?** Essa é a CLI do [produto Webhooks](/docs/product-webhooks), que é separado — um binário diferente, já publicado, documentado em [CLI de Webhooks](/docs/product-webhooks/cli). Esta página trata do `nimbus`, a CLI da plataforma de nuvem.

## Instalar (quando for lançado) {#install}

```bash
# macOS / Linux — Homebrew
brew install nimbusnexus/tap/nimbus

# Linux — curl + install
curl -fsSL {{BASE_URL}}/cli/install.sh | sh

# Verify
nimbus --version
```

O script de instalação baixa um binário assinado para a sua plataforma, verifica a assinatura com a nossa chave pública publicada e instala em `/usr/local/bin/nimbus`. Leia o script antes de passá-lo para o `sh` se preferir entender primeiro o que ele faz.

## Autenticar {#auth}

```bash
nimbus auth login
# Opens a browser window, exchanges for an API key, stores it in your OS keychain.

# Or set an existing key directly:
export NIMBUS_KEY=nn_live_...
```

O fluxo `auth login` gera uma chave com escopo inicial vinculada ao usuário que está conectado ao painel no momento. Para CI / automação, gere uma chave de longa duração no painel e coloque-a em `NIMBUS_KEY`.

## Comandos comuns {#common}

```bash
# Resources mirror the REST API structure
nimbus vms list --region us-east-1
nimbus vms create --name web-01 --size gp-1-2 --region us-east-1 --image ubuntu-24.04
nimbus vms get vm_01HG7Y3...
nimbus vms delete vm_01HG7Y3...

# Databases
nimbus databases list
nimbus databases create --engine postgres --tier production-2x4 --region us-east-1

# Object storage
nimbus buckets list
nimbus buckets create my-bucket --region us-east-1
nimbus buckets cp ./file.txt nn://my-bucket/file.txt

# DNS
nimbus dns zones create example.com
nimbus dns records create example.com A www 203.0.113.5

# Floating IPs
nimbus floating-ips allocate --region us-east-1
nimbus floating-ips attach ip_01H... --to vm_01HG7Y3...
```

Todo tipo de recurso tem no mínimo `list`, `get`, `create` e `delete`, além de comandos específicos do tipo (por exemplo, `vms reboot`, `databases restore`, `dns records bulk-import`).

## Formatos de saída {#output}

```bash
# Human-readable table (default for terminals)
nimbus vms list

# JSON for scripting
nimbus vms list --output json

# JSONL (newline-delimited, good for piping)
nimbus vms list --output jsonl | jq -r '.id'

# Just the IDs
nimbus vms list --output ids
```

`--output json` retorna a resposta bruta da API. `--output ids` é um atalho para o padrão comum "me dê os IDs para passar a outro comando".

## Configuração + perfis {#config}

O `nimbus` lê a configuração de `~/.config/nimbus/config.toml` (Linux/macOS) ou `%APPDATA%\nimbus\config.toml` (Windows). Vários perfis para projetos diferentes:

```toml
default_profile = "prod"

[profiles.prod]
api_key_keychain = "nimbus-prod"  # OS keychain reference
default_region = "us-east-1"

[profiles.staging]
api_key_keychain = "nimbus-staging"
default_region = "us-west-1"
```

Troque de perfil por comando:

```bash
nimbus --profile staging vms list
```

Ou por sessão do shell:

```bash
export NIMBUS_PROFILE=staging
nimbus vms list
```

O campo `api_key_keychain` aponta para uma entrada no keychain do sistema operacional; a chave bruta nunca fica no arquivo de configuração. Para CI / sistemas não interativos, defina `NIMBUS_KEY` diretamente.

## Padrões para scripts {#scripting}

```bash
# Wait for a VM to be running
nimbus vms wait $VM_ID --state running --timeout 5m

# Bulk operations from a file
nimbus vms create --from-file vms.yaml

# Pipe IDs into deletion (with confirmation)
nimbus vms list --output ids --filter "state=stopped" | nimbus vms delete --stdin --yes

# Tail audit logs
nimbus audit-logs tail --project my-project
```

`wait` bloqueia até que um recurso atinja o estado pedido (ou até o timeout). `--stdin` lê IDs da stdin. `--yes` pula as confirmações (use só em scripts em que você tem certeza).

## Autocompletar no shell {#completion}

```bash
# Bash
nimbus completion bash > /etc/bash_completion.d/nimbus

# Zsh
nimbus completion zsh > "${fpath[1]}/_nimbus"

# Fish
nimbus completion fish > ~/.config/fish/completions/nimbus.fish

# PowerShell
nimbus completion powershell | Out-String | Invoke-Expression
```

O autocompletar cobre IDs de recurso (completados a partir de chamadas de listagem recentes em cache), regiões, tamanhos, nomes de imagem e todos os comandos/subcomandos.

## Situação atual {#status}

A CLI está sendo construída sobre o SDK para Go, mas ainda não foi lançada. Enquanto isso:

- Use a API REST diretamente. Cada comando da CLI corresponde 1:1 a uma chamada de API.
- O formato desta página é o design de API com o qual estamos nos comprometendo.
- Inscreva-se no [changelog]({{BASE_URL}}/changelog) para receber o anúncio do lançamento.

## Próximos passos {#next-steps}

- [Autenticação](/docs/authentication) — o que o `auth login` faz por baixo dos panos.
- [SDK para Go](/docs/sdks/go) — o SDK sobre o qual a CLI é construída.
- [Webhooks da plataforma](/docs/webhooks) — `nimbus webhooks endpoints` os gerencia pela linha de comando.
