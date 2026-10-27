---
title: "Go-SDK"
description: "Idiomatischer Go-Client für die REST-API von NimbusNexus. Mit Context-Unterstützung, ohne Abhängigkeiten."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: sdk
---

# Go-SDK

> **Status: Vorabversion.** Das SDK befindet sich in aktiver Entwicklung. Diese Seite dokumentiert den Aufbau von v1.0; bis das Modul veröffentlicht ist, verwenden Sie die REST-API direkt, wie in [Authentifizierung](/docs/authentication) und [Konventionen](/docs/conventions) beschrieben.

Ein idiomatischer Go-Client. Mit Context-Unterstützung, ohne Laufzeitabhängigkeiten, aus der OpenAPI-Spezifikation generiert. Zielversion ist Go 1.22+.

## Installation (nach Veröffentlichung) {#install}

```bash
go get github.com/NimbusNexus/nimbusnexus-go
```

## Kurzbeispiel {#quick}

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

## Designprinzipien {#design}

- **Context überall.** Jeder API-Aufruf nimmt einen `context.Context` entgegen. Keine Abkürzungen über einen Standard-Context. Einen langsamen Request brechen Sie ab, indem Sie seinen Context abbrechen.
- **Bildet die REST-API ab.** `client.VMs.List(ctx, ...)` entspricht `GET /v1/vms`. Ressourcengruppen folgen der URL — `client.Databases.Snapshots.List(ctx, dbID, ...)` entspricht `GET /v1/databases/{db_id}/snapshots`.
- **Keine Laufzeitabhängigkeiten.** Nur die Standardbibliothek. Wir binden bewusst weder `viper` noch `cobra` oder andere meinungsstarke Begleitbibliotheken ein — darüber entscheiden Sie.
- **Idiomatische Parameter mit Pointern.** Optionale Felder sind Pointer (`*string`, `*int`); mit den Helfern `nn.String("...")`, `nn.Int(42)` und `nn.Bool(true)` erhalten Sie Adressen von Literalen.
- **Standardmäßig idempotent.** Ändernde Aufrufe erzeugen automatisch eine UUID als `IdempotencyKey`. Überschreiben Sie sie mit `nn.VMCreateParams{ IdempotencyKey: nn.String("...") }`.
- **Wiederholt bei 429 + 5xx.** Die Standardkonfiguration wiederholt mit exponentiellem Backoff + Jitter. Deaktivieren Sie das mit `nn.Config{ MaxRetries: -1 }`.

## Konfiguration {#config}

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

## Helfer zur Webhook-Prüfung {#webhooks}

Dieser Helfer prüft [Plattform-Webhooks](/docs/webhooks) — die Benachrichtigungen, die NimbusNexus Ihnen
über Ihre eigene Infrastruktur sendet, signiert mit Headern, die mit `NN-` beginnen. Er ist **nicht** der Helfer für das
[Produkt Webhooks](/docs/product-webhooks), das mit Headern signiert, die mit `X-Webhook-` beginnen, und ein eigenes
Go-Modul mitbringt; beide bieten eine gleichnamige Funktion `Verify` mit unterschiedlichen Signaturen, sodass ein Snippet
von der falschen Seite nirgends sinnvoll kompiliert. Der Import unten hat den Alias `nnwebhooks`, damit an der Aufrufstelle
erkennbar bleibt, welcher Helfer welcher ist.

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

Der Prüfer verwendet `crypto/hmac.Equal` für einen Vergleich in konstanter Zeit und erzwingt über den Header `NN-Timestamp` ein Replay-Fenster von 5 Minuten.

## Helfer für die Paginierung {#pagination}

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

Beide Iteratoren übernehmen das Durchlaufen der Cursor für Sie. Details zur Mechanik finden Sie unter [Paginierung](/docs/pagination).

## Fehler {#errors}

Das SDK stellt für jeden [`error.code`](/docs/errors) einen typisierten Fehlertyp bereit:

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

Fehlertypen: `AuthenticationError`, `PermissionError`, `ValidationError`, `NotFoundError`, `ConflictError`, `RateLimitError`, `ServerError`. Alle implementieren das Standard-Interface `error` und lassen sich zu `*nn.APIError` entpacken (dem zugrunde liegenden Fehler-Envelope).

## Aktueller Stand {#status}

Das SDK wird aus der OpenAPI-Spezifikation generiert, ist aber noch nicht veröffentlicht. Bis dahin:

- Verwenden Sie die REST-API direkt. Authentifizierung + Konventionen sind dokumentiert und stabil.
- Der Aufbau auf dieser Seite ist das API-Design, auf das wir uns festlegen.
- Abonnieren Sie den [Changelog]({{BASE_URL}}/changelog), um die Ankündigung des Releases zu erhalten.

## Nächste Schritte {#next-steps}

- [Authentifizierung](/docs/authentication) — was `APIKey` auf Protokollebene bewirkt.
- [Plattform-Webhooks](/docs/webhooks) — was `nnwebhooks.Verify` prüft.
- [Überblick über Webhooks](/docs/product-webhooks) — das separate Produkt für die Zustellung von Webhooks, mit eigenem Go-Modul und eigenen Signatur-Headern.
- [Paginierung](/docs/pagination) — was die Iteratoren durchlaufen.
- [Fehler](/docs/errors) — die Codes, die den typisierten Fehlertypen oben entsprechen.
