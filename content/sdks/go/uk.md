---
title: "SDK для Go"
description: "Ідіоматичний клієнт REST API NimbusNexus для Go. Підтримка context, без залежностей."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: sdk
---

# SDK для Go

> **Статус: попередня версія.** SDK активно розробляється. Ця сторінка описує форму v1.0; доки модуль не опубліковано, використовуйте REST API напряму, як описано на сторінках [Автентифікація](/docs/authentication) і [Угоди](/docs/conventions).

Ідіоматичний клієнт для Go. Підтримує context, не має залежностей під час виконання, згенерований зі специфікації OpenAPI. Розрахований на Go 1.22+.

## Встановлення (після випуску) {#install}

```bash
go get github.com/NimbusNexus/nimbusnexus-go
```

## Швидкий приклад {#quick}

```go
package main

import (
    "context"
    "log"
    "os"
    "time"

    nn "github.com/NimbusNexus/nimbusnexus-go"
)

func main() {
    client := nn.NewClient(nn.Config{
        APIKey: os.Getenv("NIMBUS_KEY"),
    })

    ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
    defer cancel()

    // List VMs
    page, err := client.VMs.List(ctx, &nn.VMListParams{
        Region: nn.String("us-east-1"),
        Limit:  nn.Int(50),
    })
    if err != nil { log.Fatal(err) }

    for _, vm := range page.Items {
        log.Println(vm.ID, vm.Name, vm.State)
    }

    // Create a VM
    vm, err := client.VMs.Create(ctx, &nn.VMCreateParams{
        Name:   "web-01",
        Size:   "gp-1-2",
        Region: "us-east-1",
        Image:  "ubuntu-24.04",
    })
    if err != nil { log.Fatal(err) }
    log.Println("created", vm.ID)
}
```

## Принципи дизайну {#design}

- **Context усюди.** Кожен виклик API приймає `context.Context`. Жодних скорочень із контекстом за замовчуванням. Щоб скасувати повільний запит, скасуйте його контекст.
- **Віддзеркалює REST API.** `client.VMs.List(ctx, ...)` — це `GET /v1/vms`. Групи ресурсів повторюють URL: `client.Databases.Snapshots.List(ctx, dbID, ...)` — це `GET /v1/databases/{db_id}/snapshots`.
- **Нуль залежностей під час виконання.** Лише стандартна бібліотека. Ми свідомо не підключаємо `viper`, `cobra` чи будь-які інші бібліотеки з власним баченням — їх обирати вам.
- **Ідіоматичні параметри з вказівниками.** Необовʼязкові поля — вказівники (`*string`, `*int`); щоб отримати адреси літералів, використовуйте хелпери `nn.String("...")`, `nn.Int(42)`, `nn.Bool(true)`.
- **Ідемпотентність за замовчуванням.** Виклики, що змінюють дані, автоматично генерують UUID для `IdempotencyKey`. Перевизначити можна через `nn.VMCreateParams{ IdempotencyKey: nn.String("...") }`.
- **Повтори для 429 + 5xx.** Конфігурація за замовчуванням повторює запити з експоненційним backoff + jitter. Вимкнути можна через `nn.Config{ MaxRetries: -1 }`.

## Налаштування {#config}

```go
client := nn.NewClient(nn.Config{
    APIKey:       os.Getenv("NIMBUS_KEY"),
    BaseURL:      "{{API_BASE_URL}}", // defaults to canonical
    Timeout:      30 * time.Second,
    MaxRetries:   3,
    RetryBackoff: time.Second,        // base; doubled per attempt with jitter
    UserAgent:    "my-app/2.4",       // appended to the default UA
    HTTPClient:   customClient,       // optional *http.Client override
})
```

## Хелпер перевірки вебхуків {#webhooks}

Цей хелпер перевіряє [Вебхуки платформи](/docs/webhooks) — сповіщення, які NimbusNexus надсилає вам про вашу власну інфраструктуру, підписані заголовками `NN-`. Це **не** хелпер для [продукту Webhooks](/docs/product-webhooks), який підписує заголовками `X-Webhook-` і має власний модуль Go; обидва надають однойменну функцію `Verify` з різними сигнатурами, тож фрагмент коду з неправильної сторінки не скомпілюється там, де він вам потрібен. Імпорт нижче має псевдонім `nnwebhooks`, щоб у місці виклику було видно, що є що.

```go
import nnwebhooks "github.com/NimbusNexus/nimbusnexus-go/webhooks"

func handleWebhook(w http.ResponseWriter, r *http.Request) {
    body, err := io.ReadAll(r.Body)
    if err != nil { http.Error(w, "bad body", 400); return }

    ok := nnwebhooks.Verify(nnwebhooks.VerifyParams{
        Body:      body,
        Timestamp: r.Header.Get("NN-Timestamp"),
        Signature: r.Header.Get("NN-Signature"),
        Secret:    os.Getenv("NIMBUS_WEBHOOK_SECRET"),
    })
    if !ok {
        http.Error(w, "bad signature", 401)
        return
    }

    // handle event...
    w.WriteHeader(200)
}
```

Функція перевірки використовує `crypto/hmac.Equal` для порівняння за сталий час і застосовує replay-вікно у 5 хвилин через заголовок `NN-Timestamp`.

## Хелпер пагінації {#pagination}

```go
// Manual paging
iter := client.VMs.ListPages(ctx, &nn.VMListParams{Region: nn.String("us-east-1")})
for iter.Next() {
    page := iter.Page()
    log.Printf("got %d VMs", len(page.Items))
}
if err := iter.Err(); err != nil { log.Fatal(err) }

// Auto-flatten — yields one resource per iteration
all := client.VMs.ListAll(ctx, &nn.VMListParams{Region: nn.String("us-east-1")})
for all.Next() {
    vm := all.Value()
    log.Println(vm.Name)
}
if err := all.Err(); err != nil { log.Fatal(err) }
```

Обидва ітератори самі обходять сторінки за курсором. Як це працює, див. на сторінці [Пагінація](/docs/pagination).

## Помилки {#errors}

SDK надає типізований тип помилки для кожного [`error.code`](/docs/errors):

```go
vm, err := client.VMs.Create(ctx, &nn.VMCreateParams{
    Name:   "web-01",
    Size:   "gp-1-2",
    Region: "us-east-1",
    Image:  "ubuntu-24.04",
})
if err != nil {
    var validation *nn.ValidationError
    if errors.As(err, &validation) {
        for field, problem := range validation.Fields {
            log.Printf("  %s: %s", field, problem)
        }
        return
    }

    var rate *nn.RateLimitError
    if errors.As(err, &rate) {
        log.Printf("slow down — wait %s", rate.RetryAfter)
        return
    }

    log.Fatal(err)
}
```

Типи помилок: `AuthenticationError`, `PermissionError`, `ValidationError`, `NotFoundError`, `ConflictError`, `RateLimitError`, `ServerError`. Усі реалізують стандартний інтерфейс `error` і розгортаються до `*nn.APIError` (базовий конверт помилки).

## Поточний стан {#status}

SDK генерується зі специфікації OpenAPI, але ще не опублікований. Поки що:

- Використовуйте REST API напряму. Автентифікація й угоди задокументовані та стабільні.
- Форма на цій сторінці — це дизайн API, якого ми зобовʼязуємося дотримуватися.
- Підпишіться на [журнал змін]({{BASE_URL}}/changelog), щоб отримати оголошення про реліз.

## Що далі {#next-steps}

- [Автентифікація](/docs/authentication) — що `APIKey` робить на рівні запитів.
- [Вебхуки платформи](/docs/webhooks) — що саме перевіряє `nnwebhooks.Verify`.
- [Огляд Webhooks](/docs/product-webhooks) — окремий продукт для доставки вебхуків із власним модулем Go і заголовками підпису.
- [Пагінація](/docs/pagination) — що саме обходять ітератори.
- [Помилки](/docs/errors) — коди, яким відповідають наведені вище типізовані типи помилок.
