---
title: "SDK Go"
description: "Client Go idiomatique pour l’API REST NimbusNexus. Gestion du contexte, aucune dépendance."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: sdk
---

# SDK Go

> **Statut : préversion.** Le SDK est en développement actif. Cette page documente la forme de la v1.0 ; tant que le module n’est pas publié, utilisez directement l’API REST en suivant [Authentification](/docs/authentication) et [Conventions](/docs/conventions).

Un client Go idiomatique. Gestion du contexte, aucune dépendance à l’exécution, généré à partir de la spécification OpenAPI. Cible Go 1.22+.

## Installer (une fois publié) {#install}

```bash
go get github.com/NimbusNexus/nimbusnexus-go
```

## Utilisation rapide {#quick}

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

## Principes de conception {#design}

- **Le contexte partout.** Chaque appel d’API prend un `context.Context`. Aucun raccourci avec un contexte par défaut. Pour annuler une requête lente, annulez son contexte.
- **Calqué sur l’API REST.** `client.VMs.List(ctx, ...)` correspond à `GET /v1/vms`. Les groupes de ressources suivent l’URL — `client.Databases.Snapshots.List(ctx, dbID, ...)` correspond à `GET /v1/databases/{db_id}/snapshots`.
- **Aucune dépendance à l’exécution.** Uniquement la bibliothèque standard. Nous n’embarquons délibérément ni `viper`, ni `cobra`, ni aucune autre bibliothèque compagnon aux choix tranchés — c’est à vous de décider.
- **Des paramètres idiomatiques avec des pointeurs.** Les champs optionnels sont des pointeurs (`*string`, `*int`) ; utilisez les helpers `nn.String("...")`, `nn.Int(42)`, `nn.Bool(true)` pour prendre l’adresse de littéraux.
- **Idempotence par défaut.** Les appels de modification génèrent automatiquement une `IdempotencyKey` UUID. Remplacez-la via `nn.VMCreateParams{ IdempotencyKey: nn.String("...") }`.
- **Réessais sur 429 + 5xx.** La configuration par défaut réessaie avec un backoff exponentiel + jitter. Désactivez les réessais avec `nn.Config{ MaxRetries: -1 }`.

## Configuration {#config}

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

## Helper de vérification de webhook {#webhooks}

Ce helper vérifie les [webhooks de la plateforme](/docs/webhooks) — les notifications que NimbusNexus vous envoie à propos
de votre propre infrastructure, signées avec des headers `NN-`. Ce n’est **pas** le helper du
[produit Webhooks](/docs/product-webhooks), qui signe avec des headers `X-Webhook-` et fournit son propre
module Go ; les deux exposent une fonction `Verify` du même nom avec des signatures différentes, si bien qu’un
extrait pris sur la mauvaise page ne compile pas là où il vous serait utile. L’import ci-dessous est aliasé en
`nnwebhooks` pour que le point d’appel montre clairement de quel helper il s’agit.

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

Le vérificateur utilise `crypto/hmac.Equal` pour une comparaison à temps constant et applique une fenêtre de rejeu de 5 minutes via le header `NN-Timestamp`.

## Helper de pagination {#pagination}

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

Les deux itérateurs parcourent les curseurs pour vous. Voir [Pagination](/docs/pagination) pour le mécanisme.

## Erreurs {#errors}

Le SDK expose un type d’erreur dédié pour chaque [`error.code`](/docs/errors) :

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

Types d’erreur : `AuthenticationError`, `PermissionError`, `ValidationError`, `NotFoundError`, `ConflictError`, `RateLimitError`, `ServerError`. Tous implémentent l’interface standard `error` et, une fois déballés (unwrap), donnent `*nn.APIError` (l’enveloppe d’erreur sous-jacente).

## État actuel {#status}

Le SDK est en cours de génération à partir de la spécification OpenAPI, mais n’a pas encore été publié. En attendant :

- Utilisez directement l’API REST. L’authentification et les conventions sont documentées et stables.
- La forme présentée sur cette page est la conception d’API à laquelle nous nous engageons.
- Abonnez-vous au [changelog]({{BASE_URL}}/changelog) pour l’annonce de la publication.

## Étapes suivantes {#next-steps}

- [Authentification](/docs/authentication) — ce que fait `APIKey` au niveau HTTP.
- [Webhooks de la plateforme](/docs/webhooks) — ce que vérifie `nnwebhooks.Verify`.
- [Vue d’ensemble de Webhooks](/docs/product-webhooks) — le produit distinct de livraison de webhooks, avec son propre module Go et ses propres headers de signature.
- [Pagination](/docs/pagination) — ce que parcourent les itérateurs.
- [Erreurs](/docs/errors) — les codes qui correspondent aux types d’erreur ci-dessus.
