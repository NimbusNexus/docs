---
title: "CLI Webhooks"
description: "nn-webhooks — один статичний бінарний файл для публікації подій, керування ендпоінтами й розбору dead-letter черги."
publishedAt: 2026-08-05
updatedAt: 2026-10-20
kind: cli
---

# CLI Webhooks

`nn-webhooks` — це інтерфейс командного рядка для [NimbusNexus Webhooks](/docs/product-webhooks). Один статичний бінарний файл: без середовища виконання, без virtualenv, нічого не треба встановлювати заздалегідь. Сьогодні це єдиний CLI NimbusNexus; CLI для Інфраструктури поки що недоступний.

Саме тому він написаний на Go. Оператор, який розбирає dead-letter чергу о 3-й ночі, часто працює на машині, де нічого не встановлено, а «спершу встановіть середовище виконання мови» — неприйнятний крок під час інциденту.

## Встановлення {#install}

Поточний реліз — **{{WEBHOOKS_CLI_VERSION}}**. Кожен реліз публічного [репозиторію webhooks-go](https://github.com/NimbusNexus/webhooks-go/releases) містить архіви для macOS, Linux і Windows на amd64 та arm64 разом із `checksums.txt`, і Homebrew встановлює ці самі архіви.

На macOS найкоротший шлях — Homebrew. Tap постачає cask, а Homebrew встановлює cask-и лише на macOS:

```bash
brew install nimbusnexus/tap/nn-webhooks
nn-webhooks version
```

На Linux або macOS без Homebrew завантажте архів, перевірте його за контрольними сумами релізу й покладіть бінарний файл у `PATH`. Задайте для `OS` значення `linux` або `darwin`, а для `ARCH` — `amd64` або `arm64`:

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

Крок перевірки контрольної суми має вивести `OK` для архіву; якщо цього немає, зупиніться. Для Windows призначені архіви `.zip`: кроки для PowerShell наведено на сторінці [Налаштування CLI](/docs/setup/cli#windows).

Якщо у вас є інструментарій Go (1.25 або новіший), можна натомість зібрати CLI з вихідного коду:

```bash
go install github.com/NimbusNexus/webhooks-go/cmd/nn-webhooks@latest
```

## Вхід {#sign-in}

```bash
nn-webhooks login         # opens your browser; approve, and the CLI is signed in
nn-webhooks whoami        # the workspace, key name, permissions and expiry
nn-webhooks logout        # revokes that key and removes the profile
```

`login` виводить короткий код і відкриває у браузері [{{ACCOUNT_BASE_URL}}/device]({{ACCOUNT_BASE_URL}}/device). Увійдіть як зазвичай, перевірте, що код на сторінці збігається з кодом у терміналі, і підтвердьте вхід. Потім CLI зберігає у своєму профілі API-ключ з назвою `nn-webhooks on <your hostname>`. Ключ дійсний 90 днів і показується в розділі **API keys** у консолі, де його можна будь-коли відкликати.

Запит підтверджує власник або адміністратор робочого простору, і він може звузити дозволи ключа (**Read & write**, **Publish** або **Read**) чи обмежити ключ одним проєктом. Учасник бачить запит, але не може його підтвердити: попросіть адміністратора або [налаштуйте](#configure) ключ, який адміністратор створив для вас.

Підтверджуйте лише вхід, який ви почали самі. Код, який вам надіслав хтось інший, дав би цій людині доступ до вашого робочого простору.

На машині без браузера, як-от у сесії SSH чи в контейнері, виконайте `nn-webhooks login --no-browser` і відкрийте виведене посилання на будь-якому пристрої. Код дійсний 15 хвилин. Повторний вхід замінює ключ профілю й відкликає старий.

## Налаштування {#configure}

`configure` зберігає ключ, який у вас уже є, наприклад ключ, який адміністратор випустив у консолі для CI:

```bash
nn-webhooks configure     # prompts for the API URL and key
nn-webhooks whoami        # what would be used, and where it came from
```

`nn-webhooks keys create` і `keys revoke` досі є в бінарному файлі й досі показуються в `--help`, але маршрути `/v1/api-keys`, на які вони спираються, видалено, тож обидві команди тепер завершуються з `404`. Випустіть ключ у консолі акаунта NimbusNexus у розділі **API keys**, вибравши продукт **Webhooks**, — див. [Як отримати доступ](/docs/product-webhooks#access). Ключ `whsk_…`, створений до цієї зміни, більше не проходить автентифікацію, тож профіль, де він досі зберігається, треба переналаштувати з ключем на заміну.

Облікові дані зберігаються в `$XDG_CONFIG_HOME/nn-webhooks/credentials.json` — або в `~/.config/nn-webhooks/credentials.json`, якщо `XDG_CONFIG_HOME` не задано, а на macOS за замовчуванням так і є, — з правами `0600`, у вигляді **іменованих профілів**, тож друге розгортання — це прапорець, а не перезапис першого:

```bash
nn-webhooks --profile staging configure --url {{WEBHOOKS_BASE_URL}}
nn-webhooks --profile staging endpoints list
```

Для CI обійдіться взагалі без файлу:

```bash
export NN_WEBHOOKS_URL={{WEBHOOKS_BASE_URL}}
export NN_WEBHOOKS_API_KEY="<your-api-key>"
nn-webhooks deliveries list --status dead
```

Пріоритет такий: `--api-key`, потім `$NN_WEBHOOKS_API_KEY`, потім профіль, — і `whoami` повідомляє, **яке джерело перемогло**. Це важливіше, ніж здається: застаріла змінна середовища, що непомітно перекриває профіль, який ви щойно записали, — звична причина плутанини, і просте «налаштовано» цього не пояснить.

Сам ключ ніколи не виводиться, лише його останні чотири символи. Вивід діагностичної команди — саме те, що потім вставляють у звернення в підтримку.

## Команди {#commands}

```bash
nn-webhooks publish deploy.completed --data '{"id":1}' --idempotency-key deploy-1

nn-webhooks endpoints list
nn-webhooks endpoints create --url https://example.com/hook --subscribe prefix:deploy.
nn-webhooks endpoints get ep_123
nn-webhooks endpoints update ep_123 --set max_attempts=10 --set status=disabled
nn-webhooks endpoints replace-subscriptions ep_123 --subscribe exact:deploy.completed --subscribe suffix:.failed
nn-webhooks endpoints rotate-secret ep_123
nn-webhooks endpoints enable ep_123

nn-webhooks deliveries list --status dead
nn-webhooks deliveries redeliver dlv_456

nn-webhooks verify --secret whsec_... --signature sha256=... --timestamp 1785984800 < body.json
```

Підписки задаються як `kind:pattern`, і прапорець можна повторювати: `--subscribe prefix:deploy.` або
`--subscribe exact:deploy.completed`. Значення, передані в `--set`, приводяться до JSON, а якщо це не вдається, лишаються
рядком; `null` очищає поле.

`update` не може змінювати підписки, бо webhookd ігнорує їх у PATCH: `replace-subscriptions` задає весь список одразу, замінюючи попередній, а `--none` відписує ендпоінт від усього.

Усі команди виводять JSON, тож вивід можна передавати в `jq` без жодного прапорця `--format`, який треба було б памʼятати:

```bash
nn-webhooks deliveries list --status dead | jq -r '.items[].id' | \
  xargs -n1 nn-webhooks deliveries redeliver
```

`nn-webhooks verify` перевіряє отриманий вебхук — це корисно, щоб переконатися, що обробник відхиляє запит через підпис, а не через те, як фреймворк обробляє тіло, а це частіший винуватець. Передавайте `--timestamp`: без нього HMAC обчислюється лише по тілу, що ніколи не збігається зі справжньою доставкою, тож кожна перевірка провалюється. Команда виводить `ok`/`failed`, а не JSON, і завершується з кодом 0/1.

## Версії {#versions}

```bash
nn-webhooks version
```

Команда показує два номери, і вони цілком можуть відрізнятися:

- `version` — реліз, з якого походить цей бінарний файл, проставлений під час збірки
- `sdk` — клієнтська бібліотека, вкомпільована в нього

Бінарний файл, зібраний з вихідного коду, не має тегу, який можна назвати, тож він показує версію SDK із суфіксом `+source`, а не видає себе за реліз.

## Що далі {#next-steps}

- [SDK](/docs/product-webhooks/sdks) — ті самі операції з коду застосунку.
- [Швидкий старт](/docs/product-webhooks/quickstart) — процес, який автоматизують ці команди.
- [Перевірка підпису](/docs/product-webhooks/signatures) — що перевіряє `nn-webhooks verify`.
- [Огляд Webhooks](/docs/product-webhooks) — обʼєкти й семантика доставки.
