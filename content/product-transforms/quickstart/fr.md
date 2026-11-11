---
title: "Démarrage rapide Transforms"
description: "Testez un pipeline sur une requête, enregistrez-le, exécutez-le, voyez une requête abandonnée et enregistrez une nouvelle version, via l’API."
publishedAt: 2026-11-06
updatedAt: 2026-11-11
kind: quickstart
---

# Démarrage rapide Transforms

De zéro à un pipeline versionné en quelques minutes. Vous allez tester un pipeline sur une requête, l’enregistrer, l’exécuter, voir une requête abandonnée et enregistrer une nouvelle version. Pour voir ce que fait un pipeline avant de vous connecter, essayez le [playground](/transforms/playground).

## Avant de commencer {#before}

Créez une clé API dans votre [console de compte]({{ACCOUNT_BASE_URL}}/api-keys?product=transforms), avec **Transforms** comme produit et **Read & write** comme permission. Free suffit pour tout ce qui suit. Placez ensuite la clé dans une variable d’environnement :

```bash
export TRANSFORMS_API_KEY="<your-api-key>"
```

Tous les chemins ci-dessous sont relatifs à `https://transforms.nimbusnexus.net`, et chaque requête porte `Authorization: Bearer <your key>`.

## 1. Tester un pipeline {#test}

Ce pipeline garde les factures payées de $1,000 ou plus, retire l’e-mail du client et tout numéro de téléphone, et ajoute deux champs et un header. `POST /v1/pipelines/test` exécute un document une fois, sur une requête que vous envoyez, et n’enregistre ni ne compte rien :

```bash
curl -X POST https://transforms.nimbusnexus.net/v1/pipelines/test \
  -H "Authorization: Bearer $TRANSFORMS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "pipeline": {
      "version": 1,
      "steps": [
        { "filter": { "type": "invoice.paid", "data": { "amount": { "$gte": 100000 } } }, "note": "Paid invoices of $1,000 or more" },
        { "drop": ["data.customer.email", "**.phone"] },
        { "set": { "event_type": "{{ type }}", "amount_display": "{{ data.amount | money(data.currency) }}" } },
        { "headers": { "set": { "X-Event-Type": "{{ type }}" } } }
      ]
    },
    "body": {
      "type": "invoice.paid",
      "data": {
        "id": "in_42",
        "amount": 150000,
        "currency": "usd",
        "customer": { "name": "Ana Silva", "email": "ana@example.com", "phone": "+1 202 555 0142" }
      }
    }
  }'
```

```json
{
  "status": "ok",
  "version": null,
  "body": {
    "type": "invoice.paid",
    "data": {
      "id": "in_42",
      "amount": 150000,
      "currency": "usd",
      "customer": { "name": "Ana Silva" }
    },
    "event_type": "invoice.paid",
    "amount_display": "1,500.00 USD"
  },
  "body_changed": true,
  "headers": { "X-Event-Type": "invoice.paid" },
  "query": {},
  "step": null,
  "note": null,
  "reason": null,
  "error": null,
  "duration_ms": 0.4
}
```

`status` vaut `ok` : `body` et `headers` sont donc ce qu’il faut envoyer. `version` vaut `null` car rien n’a encore été enregistré.

## 2. L’enregistrer {#save}

Enregistrez le même document comme pipeline, avec un nom :

```bash
curl -X POST https://transforms.nimbusnexus.net/v1/pipelines \
  -H "Authorization: Bearer $TRANSFORMS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Paid invoices",
    "pipeline": {
      "version": 1,
      "steps": [
        { "filter": { "type": "invoice.paid", "data": { "amount": { "$gte": 100000 } } }, "note": "Paid invoices of $1,000 or more" },
        { "drop": ["data.customer.email", "**.phone"] },
        { "set": { "event_type": "{{ type }}", "amount_display": "{{ data.amount | money(data.currency) }}" } },
        { "headers": { "set": { "X-Event-Type": "{{ type }}" } } }
      ]
    }
  }'
```

La réponse est `201`, avec [le pipeline](/docs/product-transforms/reference#pipeline), abrégé ici :

```json
{
  "id": "pipe_8e27d40b19c3f6a5e0d71b42",
  "name": "Paid invoices",
  "status": "enabled",
  "current_version": 1,
  "destinations": [],
  "consumers": []
}
```

Conservez l’`id` : chaque appel ultérieur l’attend.

```bash
export PIPELINE_ID="pipe_8e27d40b19c3f6a5e0d71b42"
```

## 3. L’exécuter {#run}

Envoyez une requête au pipeline enregistré. L’exécution prend un `body` et, en option, `headers` et `meta`, et indique ce que le pipeline a fait :

```bash
curl -X POST "https://transforms.nimbusnexus.net/v1/pipelines/$PIPELINE_ID/run" \
  -H "Authorization: Bearer $TRANSFORMS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"body": {"type": "invoice.paid", "data": {"id": "in_42", "amount": 150000, "currency": "usd"}}}'
```

La réponse a le même format que celle du test, avec `"version": 1`. Rien de la requête n’est conservé, et l’exécution ajoute un au décompte du mois dans `GET /v1/usage`. C’est à vous de transmettre le résultat : Transforms n’envoie rien lui-même.

## 4. Voir une requête abandonnée {#dropped}

Envoyez une facture d’un montant inférieur à celui du filtre :

```bash
curl -X POST "https://transforms.nimbusnexus.net/v1/pipelines/$PIPELINE_ID/run" \
  -H "Authorization: Bearer $TRANSFORMS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"body": {"type": "invoice.paid", "data": {"id": "in_43", "amount": 99999, "currency": "usd"}}}'
```

```json
{
  "status": "dropped",
  "version": 1,
  "body": null,
  "body_changed": false,
  "headers": {},
  "query": {},
  "step": 0,
  "note": "Paid invoices of $1,000 or more",
  "reason": "no_match",
  "error": "dropped by step 0 (Paid invoices of $1,000 or more)",
  "duration_ms": 0.1
}
```

C’est quand même un `200`, car le pipeline s’est exécuté. `step` compte à partir de 0, et `reason` vaut `no_match` pour un filtre auquel la requête ne correspondait pas. Dans ce cas, n’envoyez rien.

## 5. Enregistrer une nouvelle version {#version}

Envoyez un `PATCH` au pipeline avec un nouveau document, ici sans l’étape de headers :

```bash
curl -X PATCH "https://transforms.nimbusnexus.net/v1/pipelines/$PIPELINE_ID" \
  -H "Authorization: Bearer $TRANSFORMS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "pipeline": {
      "version": 1,
      "steps": [
        { "filter": { "type": "invoice.paid", "data": { "amount": { "$gte": 100000 } } }, "note": "Paid invoices of $1,000 or more" },
        { "drop": ["data.customer.email", "**.phone"] },
        { "set": { "event_type": "{{ type }}", "amount_display": "{{ data.amount | money(data.currency) }}" } }
      ]
    }
  }'
```

`current_version` vaut maintenant `2`, et les exécutions l’utilisent. La version 1 n’a pas changé : `GET /v1/pipelines/{id}/versions` liste les versions conservées, et une exécution peut toujours en désigner une :

```bash
curl -X POST "https://transforms.nimbusnexus.net/v1/pipelines/$PIPELINE_ID/run" \
  -H "Authorization: Bearer $TRANSFORMS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"version": 1, "body": {"type": "invoice.paid", "data": {"id": "in_42", "amount": 150000, "currency": "usd"}}}'
```

Pour revenir à la version 1, enregistrez de nouveau son contenu, ce qui en fait la version 3.

## Dans la console {#console}

La console à `https://transforms.nimbusnexus.net` fait tout cela avec un formulaire pour chaque étape : **Filter**, **Remove fields**, **Set fields**, **Reshape the body**, **Headers** et **Credential**. **Start from a template** propose des messages Slack, Discord et Teams, Keep only these fields et Drop personal data, et **JSON** montre le document entier. Testez ce qui se trouve dans l’éditeur avant de l’enregistrer.

## Nettoyage {#cleanup}

Chaque plan plafonne le nombre de pipelines que vous pouvez détenir. Supprimez donc celui-ci quand vous avez terminé :

```bash
curl -X DELETE "https://transforms.nimbusnexus.net/v1/pipelines/$PIPELINE_ID" \
  -H "Authorization: Bearer $TRANSFORMS_API_KEY"
```

La suppression est **définitive**, pour le pipeline comme pour chacune de ses versions. Pour plutôt arrêter ses exécutions pendant un moment, passez-le à `{"status": "disabled"}` avec `PATCH`, puis de nouveau à `{"status": "enabled"}` plus tard. Un pipeline désactivé répond à une exécution par `409` `conflict`, `pipeline_disabled`.

## Étapes suivantes {#next-steps}

- [Pipelines](/docs/product-transforms/pipelines) — toutes les étapes, tous les chemins, filtres et modèles.
- [Référence Transforms](/docs/product-transforms/reference) — chaque route et chaque champ, rôles, limites et erreurs.
- [API Transforms](/docs/reference/transforms) — chaque opération, avec la requête en curl, TypeScript, Python ou Go.
- [Vue d’ensemble du produit](/docs/product-transforms) — justificatifs d’identité, plans, et ce que Transforms ne fait pas.
