---
title: "Налаштування CLI"
description: "Встановіть nn-webhooks через Homebrew, перевірене завантаження або go install, налаштуйте API-ключ і зробіть перший виклик."
publishedAt: 2026-10-19
updatedAt: 2026-10-19
kind: cli
---

# Налаштування CLI

`nn-webhooks` — інструмент командного рядка для [Webhooks](/docs/product-webhooks): один статичний бінарний файл для macOS, Linux і Windows, більше нічого встановлювати не треба. Він публікує події, керує ендпоінтами й повторно надсилає невдалі доставки. Наразі це єдиний CLI NimbusNexus. CLI для інфраструктури поки немає; натомість використовуйте [REST API](/docs/setup/rest).

Поточний реліз — **{{WEBHOOKS_CLI_VERSION}}**. Його архіви та їхній `checksums.txt` додано до кожного релізу публічного [репозиторію webhooks-go](https://github.com/NimbusNexus/webhooks-go/releases), і Homebrew встановлює ті самі архіви.

## 1 · Встановлення {#install}

### macOS: Homebrew {#homebrew}

```bash
brew install nimbusnexus/tap/nn-webhooks
nn-webhooks version
```

Tap постачає cask, а Homebrew встановлює cask-и лише на macOS. Пізніше оновлюйте командою `brew upgrade nn-webhooks`.

### Linux і macOS: завантаження {#download}

Задайте `OS` значення `linux` або `darwin`, а `ARCH` — `amd64` або `arm64`. Потім завантажте архів, звірте його з контрольними сумами релізу й покладіть бінарний файл у `PATH`:

```bash
VERSION={{WEBHOOKS_CLI_VERSION}}
OS=linux
ARCH=amd64
BASE=https://github.com/NimbusNexus/webhooks-go/releases/download/v$VERSION
curl -fsSLO "$BASE/nn-webhooks_${VERSION}_${OS}_${ARCH}.tar.gz"
curl -fsSLO "$BASE/checksums.txt"
shasum -a 256 --check --ignore-missing checksums.txt
tar -xzf "nn-webhooks_${VERSION}_${OS}_${ARCH}.tar.gz" nn-webhooks
sudo install -m 0755 nn-webhooks /usr/local/bin/nn-webhooks
nn-webhooks version
```

Крок із контрольною сумою має вивести `OK` для архіву; якщо ні, зупиніться на цьому. Якщо `shasum` немає, те саме робить `sha256sum --check --ignore-missing checksums.txt`. Без `sudo` встановіть у каталог, що належить вам і є у вашому `PATH`, напр., `~/.local/bin`.

### Windows: завантаження {#windows}

У PowerShell завантажте zip-архів, порівняйте його хеш із відповідним рядком `checksums.txt`, а потім розпакуйте його в теку з вашого `PATH`:

```powershell
$Version = "{{WEBHOOKS_CLI_VERSION}}"
$Base = "https://github.com/NimbusNexus/webhooks-go/releases/download/v$Version"
Invoke-WebRequest "$Base/nn-webhooks_${Version}_windows_amd64.zip" -OutFile nn-webhooks.zip
Invoke-WebRequest "$Base/checksums.txt" -OutFile checksums.txt
(Get-FileHash nn-webhooks.zip -Algorithm SHA256).Hash.ToLower()
Select-String "windows_amd64.zip" checksums.txt
Expand-Archive nn-webhooks.zip -DestinationPath "$env:LOCALAPPDATA\nn-webhooks"
```

Обидва хеші мають збігатися. Потім додайте `%LOCALAPPDATA%\nn-webhooks` до свого `PATH` і виконайте `nn-webhooks version`. На ARM використовуйте `windows_arm64` в обох назвах файлів.

### З інструментарієм Go {#go-install}

```bash
go install github.com/NimbusNexus/webhooks-go/cmd/nn-webhooks@latest
```

Для цього потрібен Go 1.25 або новіший. Бінарний файл, зібраний із сирців, показує версію SDK із суфіксом `+source`, а не номер релізу.

## 2 · Налаштуйте ключ {#configure}

На власному компʼютері увійдіть через браузер:

```bash
nn-webhooks login
```

Команда виводить код і відкриває консоль акаунта. Перевірте, що код збігається, схваліть там запит, і CLI збереже ключ на 90 днів у своєму профілі. Подробиці — у розділі [Вхід](/docs/product-webhooks/cli#sign-in).

Щоб натомість використати ключ, який у вас уже є, напр., для CI, створіть ключ Webhooks у [консолі акаунта]({{ACCOUNT_BASE_URL}}/api-keys) в розділі **API keys**; подробиці — у розділі [Отримайте API-ключ](/docs/setup/rest#key). Потім збережіть його в профілі:

```bash
nn-webhooks configure --url {{WEBHOOKS_BASE_URL}}
nn-webhooks whoami
```

`configure` запитує ключ і зберігає його в `~/.config/nn-webhooks/credentials.json` з правами `0600`. `whoami` показує, які URL і ключ буде використано і звідки взято кожен із них; із ключа виводяться лише останні чотири символи. У CI обійдіться без файлу й натомість задайте змінні середовища:

```bash
export NN_WEBHOOKS_URL={{WEBHOOKS_BASE_URL}}
export NN_WEBHOOKS_API_KEY="<your-api-key>"
```

## 3 · Перший виклик {#first-call}

```bash
nn-webhooks deliveries list
```

Кожна команда виводить JSON, тож її вивід можна одразу передати в `jq`. Порожній список `items` означає, що ключ працює, а доставок ще не було.

## Що далі {#next-steps}

- [CLI Webhooks](/docs/product-webhooks/cli): усі команди, профілі, пріоритет налаштувань і версії.
- [Довідник API Webhooks](/docs/reference/webhooks): кожна операція з відповідною командою `nn-webhooks`, якщо така є.
- [SDK](/docs/setup/sdk): ті самі операції з коду.
