---
title: "SDK para Go"
description: "Cliente Go idiomático para a API REST da NimbusNexus. Com suporte a context, sem dependências."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: sdk
---

# SDK para Go

> **Status: pré-lançamento.** O SDK está em desenvolvimento ativo. Esta página documenta o formato da v1.0; até o módulo ser publicado, use a API REST diretamente, conforme [Autenticação](/docs/authentication) e [Convenções](/docs/conventions).

Um cliente Go idiomático. Com suporte a context, sem dependências de runtime, gerado a partir da especificação OpenAPI. Para Go 1.22+.

## Instalar (quando for lançado) {#install}

```bash
go get github.com/NimbusNexus/nimbusnexus-go
```

## Uso rápido {#quick}

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

## Princípios de design {#design}

- **Context em todo lugar.** Toda chamada de API recebe um `context.Context`. Sem atalhos com context padrão. Cancele uma requisição lenta cancelando o context dela.
- **Espelha a API REST.** `client.VMs.List(ctx, ...)` é `GET /v1/vms`. Os grupos de recursos seguem a URL — `client.Databases.Snapshots.List(ctx, dbID, ...)` é `GET /v1/databases/{db_id}/snapshots`.
- **Zero dependências de runtime.** Só a biblioteca padrão. Deixamos claro que não incluímos `viper`, `cobra` nem qualquer biblioteca complementar opinativa — a escolha é sua.
- **Parâmetros idiomáticos com ponteiros.** Campos opcionais são ponteiros (`*string`, `*int`); use os helpers `nn.String("...")`, `nn.Int(42)`, `nn.Bool(true)` para obter o endereço de literais.
- **Idempotência por padrão.** Chamadas que alteram dados geram automaticamente um `IdempotencyKey` UUID. Substitua via `nn.VMCreateParams{ IdempotencyKey: nn.String("...") }`.
- **Repete em 429 + 5xx.** A configuração padrão tenta de novo com backoff exponencial + jitter. Desative com `nn.Config{ MaxRetries: -1 }`.

## Configuração {#config}

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

## Helper de verificação de webhooks {#webhooks}

Isto verifica os [webhooks da plataforma](/docs/webhooks) — as notificações que a NimbusNexus envia a você sobre a sua própria infraestrutura, assinadas com headers `NN-`. Este **não** é o helper do [produto Webhooks](/docs/product-webhooks), que assina com headers `X-Webhook-` e tem o próprio módulo Go; os dois expõem um `Verify` com o mesmo nome e assinaturas diferentes, então um trecho de código da página errada não compila em lugar nenhum que sirva. O import abaixo usa o alias `nnwebhooks` para deixar visível, no ponto da chamada, qual é qual.

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

O verificador usa `crypto/hmac.Equal` para a comparação em tempo constante e aplica uma janela de replay de 5 minutos via o header `NN-Timestamp`.

## Helper de paginação {#pagination}

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

Os dois iteradores percorrem o cursor por você. Veja [Paginação](/docs/pagination) para entender o mecanismo.

## Erros {#errors}

O SDK expõe um tipo de erro tipado para cada [`error.code`](/docs/errors):

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

Tipos de erro: `AuthenticationError`, `PermissionError`, `ValidationError`, `NotFoundError`, `ConflictError`, `RateLimitError`, `ServerError`. Todos implementam a interface padrão `error` e fazem unwrap para `*nn.APIError` (o envelope de erro subjacente).

## Situação atual {#status}

O SDK está sendo gerado a partir da especificação OpenAPI, mas ainda não foi publicado. Enquanto isso:

- Use a API REST diretamente. A autenticação + as convenções estão documentadas e estáveis.
- O formato desta página é o design de API com o qual estamos nos comprometendo.
- Inscreva-se no [changelog]({{BASE_URL}}/changelog) para receber o anúncio do lançamento.

## Próximos passos {#next-steps}

- [Autenticação](/docs/authentication) — o que o `APIKey` faz no nível do HTTP.
- [Webhooks da plataforma](/docs/webhooks) — o que o `nnwebhooks.Verify` está verificando.
- [Visão geral de Webhooks](/docs/product-webhooks) — o produto separado de entrega de webhooks, com o próprio módulo Go e headers de assinatura.
- [Paginação](/docs/pagination) — o que os iteradores estão percorrendo.
- [Erros](/docs/errors) — os códigos que correspondem aos tipos de erro tipados acima.
