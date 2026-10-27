---
title: "SDK de Go"
description: "Cliente de Go idiomático para la API REST de NimbusNexus. Compatible con context, sin dependencias."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: sdk
---

# SDK de Go

> **Estado: versión preliminar.** El SDK está en desarrollo activo. Esta página documenta la forma de la v1.0; hasta que se publique el módulo, usa directamente la API REST según [Autenticación](/docs/authentication) y [Convenciones](/docs/conventions).

Un cliente de Go idiomático. Compatible con context, sin dependencias en tiempo de ejecución y generado a partir de la especificación OpenAPI. Pensado para Go 1.22+.

## Instalación (cuando se publique) {#install}

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

## Principios de diseño {#design}

- **Context en todas partes.** Todas las llamadas a la API reciben un `context.Context`. Sin atajos con un context por defecto. Para cancelar una petición lenta, cancela su context.
- **Refleja la API REST.** `client.VMs.List(ctx, ...)` es `GET /v1/vms`. Los grupos de recursos siguen la URL — `client.Databases.Snapshots.List(ctx, dbID, ...)` es `GET /v1/databases/{db_id}/snapshots`.
- **Cero dependencias en tiempo de ejecución.** Solo la librería estándar. Dejamos claro que no incluimos `viper`, `cobra` ni ninguna otra librería complementaria con opiniones propias — eso lo decides tú.
- **Parámetros idiomáticos con punteros.** Los campos opcionales son punteros (`*string`, `*int`); usa los helpers `nn.String("...")`, `nn.Int(42)` y `nn.Bool(true)` para obtener la dirección de literales.
- **Idempotencia por defecto.** Las llamadas de escritura generan automáticamente un `IdempotencyKey` UUID. Sustitúyelo con `nn.VMCreateParams{ IdempotencyKey: nn.String("...") }`.
- **Reintenta los 429 y 5xx.** La configuración por defecto reintenta con backoff exponencial + jitter. Desactívalo con `nn.Config{ MaxRetries: -1 }`.

## Configuración {#config}

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

## Helper de verificación de webhooks {#webhooks}

Esto verifica los [webhooks de la plataforma](/docs/webhooks) — las notificaciones que NimbusNexus te envía sobre tu propia infraestructura, firmadas con cabeceras `NN-`. **No** es el helper del [producto Webhooks](/docs/product-webhooks), que firma con cabeceras `X-Webhook-` y tiene su propio módulo de Go; los dos exponen una función `Verify` con el mismo nombre y firmas distintas, así que un fragmento de la página equivocada no compila en ningún sitio útil. El import de abajo usa el alias `nnwebhooks` para que en la llamada se vea cuál es cuál.

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

El verificador usa `crypto/hmac.Equal` para la comparación en tiempo constante y aplica una ventana de replay de 5 minutos mediante la cabecera `NN-Timestamp`.

## Helper de paginación {#pagination}

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

Los dos iteradores recorren el cursor por ti. Consulta [Paginación](/docs/pagination) para ver el mecanismo.

## Errores {#errors}

El SDK expone un tipo de error tipado para cada [`error.code`](/docs/errors):

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

Tipos de error: `AuthenticationError`, `PermissionError`, `ValidationError`, `NotFoundError`, `ConflictError`, `RateLimitError` y `ServerError`. Todos implementan la interfaz estándar `error` y se desenvuelven en `*nn.APIError` (el sobre de error subyacente).

## Estado actual {#status}

El SDK se está generando a partir de la especificación OpenAPI, pero todavía no se ha publicado. Mientras tanto:

- Usa directamente la API REST. La autenticación y las convenciones están documentadas y son estables.
- La forma que muestra esta página es el diseño de API con el que nos comprometemos.
- Suscríbete al [changelog]({{BASE_URL}}/changelog) para enterarte del anuncio de la versión.

## Próximos pasos {#next-steps}

- [Autenticación](/docs/authentication) — qué hace `APIKey` en la petición HTTP.
- [Webhooks de la plataforma](/docs/webhooks) — qué comprueba `nnwebhooks.Verify`.
- [Resumen de Webhooks](/docs/product-webhooks) — el producto independiente de entrega de webhooks, con su propio módulo de Go y sus propias cabeceras de firma.
- [Paginación](/docs/pagination) — qué recorren los iteradores.
- [Errores](/docs/errors) — los códigos que corresponden a los tipos de error tipados de arriba.
