---
title: "CLI"
description: "nimbus — інтерфейс командного рядка для REST API NimbusNexus."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: cli
---

# CLI

> **Статус: попередня версія.** CLI активно розробляється. Ця сторінка описує вигляд v1.0; доки бінарний файл не опубліковано, працюйте з REST API напряму, як описано на сторінках [Автентифікація](/docs/authentication) і [Угоди](/docs/conventions).

`nimbus` — офіційний інтерфейс командного рядка. Один статичний бінарний файл без залежностей під час виконання, доступний для macOS (Intel + Apple Silicon), Linux (amd64 + arm64) і Windows.

> **Шукаєте `nn-webhooks`?** Це CLI окремого [продукту Webhooks](/docs/product-webhooks) — інший бінарний файл, уже опублікований і описаний на сторінці [CLI Webhooks](/docs/product-webhooks/cli). Ця сторінка про `nimbus`, CLI хмарної платформи.

## Встановлення (після випуску) {#install}

```bash
# macOS / Linux — Homebrew
brew install nimbusnexus/tap/nimbus

# Linux — curl + install
curl -fsSL {{BASE_URL}}/cli/install.sh | sh

# Verify
nimbus --version
```

Скрипт встановлення завантажує підписаний бінарний файл для вашої платформи, перевіряє підпис за нашим опублікованим публічним ключем і встановлює файл у `/usr/local/bin/nimbus`. Якщо хочете спершу зрозуміти, що робить скрипт, прочитайте його, перш ніж передавати в `sh`.

## Автентифікація {#auth}

```bash
nimbus auth login
# Opens a browser window, exchanges for an API key, stores it in your OS keychain.

# Or set an existing key directly:
export NIMBUS_KEY=nn_live_...
```

Процес `auth login` генерує ключ зі стартовою областю дії, привʼязаний до користувача, який зараз увійшов у дашборд. Для CI / автоматизації згенеруйте довгостроковий ключ у дашборді й покладіть його в `NIMBUS_KEY`.

## Поширені команди {#common}

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

Кожен тип ресурсу має щонайменше `list`, `get`, `create`, `delete`, а також команди, специфічні для типу (напр. `vms reboot`, `databases restore`, `dns records bulk-import`).

## Формати виводу {#output}

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

`--output json` повертає сиру відповідь API. `--output ids` — скорочення для поширеного сценарію «отримати ідентифікатори й передати їх іншій команді».

## Конфігурація та профілі {#config}

`nimbus` читає конфігурацію з `~/.config/nimbus/config.toml` (Linux/macOS) або `%APPDATA%\nimbus\config.toml` (Windows). Кілька профілів для різних проєктів:

```toml
default_profile = "prod"

[profiles.prod]
api_key_keychain = "nimbus-prod"  # OS keychain reference
default_region = "us-east-1"

[profiles.staging]
api_key_keychain = "nimbus-staging"
default_region = "us-west-1"
```

Перемикайте профіль для окремої команди:

```bash
nimbus --profile staging vms list
```

Або для всієї сесії оболонки:

```bash
export NIMBUS_PROFILE=staging
nimbus vms list
```

Поле `api_key_keychain` посилається на запис у сховищі ключів ОС; сам ключ ніколи не зберігається у файлі конфігурації. Для CI / неінтерактивних систем задайте `NIMBUS_KEY` напряму.

## Патерни для скриптів {#scripting}

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

`wait` блокує виконання, доки ресурс не перейде в потрібний стан (або доки не сплине тайм-аут). `--stdin` читає ідентифікатори зі stdin. `--yes` пропускає запити на підтвердження (використовуйте лише в скриптах, у яких ви впевнені).

## Автодоповнення в оболонці {#completion}

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

Автодоповнення працює для ідентифікаторів ресурсів (підставляє їх із кешованих результатів нещодавніх викликів list), регіонів, розмірів, назв образів і всіх команд/підкоманд.

## Поточний стан {#status}

CLI будується на основі SDK для Go, але ще не вийшов. Поки ви чекаєте:

- Працюйте з REST API напряму. Кожна команда CLI відповідає 1:1 виклику API.
- Вигляд, описаний на цій сторінці, — це дизайн API, якого ми зобовʼязуємося дотримуватися.
- Підпишіться на [журнал змін]({{BASE_URL}}/changelog), щоб отримати оголошення про реліз.

## Що далі {#next-steps}

- [Автентифікація](/docs/authentication) — що `auth login` робить під капотом.
- [SDK для Go](/docs/sdks/go) — SDK, на якому побудовано CLI.
- [Вебхуки платформи](/docs/webhooks) — `nimbus webhooks endpoints` керує ними з командного рядка.
