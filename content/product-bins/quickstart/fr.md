---
title: "Démarrage rapide Request Bins"
description: "Créez un bin, envoyez-lui une requête avec curl et lisez ce qu’il a enregistré — dans la console, puis via l’API."
publishedAt: 2026-10-22
updatedAt: 2026-10-30
kind: quickstart
---

# Démarrage rapide Request Bins

De zéro à une requête enregistrée en deux ou trois minutes. Vous allez créer un bin, lui envoyer une requête avec `curl` et relire exactement ce qui est arrivé : d’abord dans la console, puis via l’API.

## Avant de commencer {#before}

- **Dans la console, sur tous les plans.** Ouvrez `https://bins.nimbusnexus.net` et connectez-vous avec votre compte NimbusNexus. Les étapes 1 à 3 ne demandent rien d’autre, sur Free aussi.
- **Via l’API, avec une clé.** L’étape 4 demande une clé API créée dans votre [console de compte]({{ACCOUNT_BASE_URL}}/api-keys?product=bins) avec **Request Bins** comme produit et **Read & write** comme permission. Une clé peut créer des bins sur tous les plans ; lire ce qu’ils ont enregistré avec une clé exige Starter ou plus, et sur Free ces routes répondent `402` `not_entitled`.

## 1. Créer un bin {#create}

Dans la console, choisissez **Create a bin** (**New bin** une fois que vous en avez un). Le libellé est facultatif et les expéditeurs ne le voient jamais. **Lifetime** est préréglé sur la valeur par défaut de votre plan, 24 heures sur Free et jusqu’à suppression sur les plans payants ; vous pouvez choisir une durée plus courte, ou saisir la vôtre avec **Custom…**, jusqu’à la plus longue que permet votre plan. La durée de vie ne pourra pas être modifiée ensuite. Choisissez **Create bin**.

La page du bin s’ouvre. En haut se trouvent sa **Bin URL**, par exemple `https://nnbin.net/b/k7xq2mbn9tfa`, et une commande **Try it**, chacune avec un bouton de copie.

## 2. Lui envoyer une requête {#send}

Depuis n’importe quel terminal, envoyez au bin un `POST` avec un chemin et une query string après le slug. Utilisez votre propre URL de bin :

```bash
curl -X POST "https://nnbin.net/b/k7xq2mbn9tfa/orders?source=quickstart" \
  -H "Content-Type: application/json" \
  -d '{"order_id": 1042, "status": "paid"}'
```

```json
{"status":"accepted"}
```

Cette réponse est la même pour chaque requête vers une URL de bin, enregistrée ou non : elle n’apprend donc rien à l’expéditeur sur votre bin. Ce qui est arrivé, c’est la console qui le montre.

N’importe quelle méthode, n’importe quel chemin, header ou corps fonctionne. En usage réel, mettez l’URL du bin partout où une application, les paramètres de webhooks d’un fournisseur, un script ou un job de CI attend une URL, et laissez-le envoyer.

## 3. La voir dans la console {#console}

De retour sur la page du bin, la requête apparaît en haut de la liste en quelques secondes ; la liste se rafraîchit toutes les 3 secondes. Sélectionnez-la pour voir :

- la méthode et le chemin après le slug : `POST /orders` ;
- la query string, décodée : `source=quickstart` ;
- les headers, dans leur ordre d’arrivée ;
- le corps, mis en forme comme JSON, avec le texte brut à un clic ;
- l’adresse d’origine, sa taille et son heure d’arrivée.

Sur Free, c’est tout le parcours : la console lit ce que les bins ont enregistré sur tous les plans.

## 4. Faire de même via l’API {#api}

Placez votre clé dans une variable d’environnement :

```bash
export BINS_API_KEY="<your-api-key>"
```

Tous les chemins ci-dessous sont relatifs à `https://bins.nimbusnexus.net`, et chaque requête porte `Authorization: Bearer <your key>`. Créez d’abord un bin :

```bash
curl -X POST https://bins.nimbusnexus.net/v1/bins \
  -H "Authorization: Bearer $BINS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"label": "Quickstart"}'
```

```json
{
  "id": "bin_3f9a1c7e5b2d8f4a6c0e9b17",
  "slug": "w4tz8hcv2qnd",
  "url": "https://nnbin.net/b/w4tz8hcv2qnd",
  "label": "Quickstart",
  "status": "enabled",
  "expires_at": null,
  "created_at": "2026-10-22T09:12:01Z",
  "request_count": 0
}
```

La réponse est abrégée ici ; [l’objet bin](/docs/product-bins/reference#bin) liste chaque champ. Deux comptent pour l’instant :

- **`url`** est ce que vous donnez à un expéditeur.
- **`id`** est ce qu’attend chaque appel ultérieur. Conservez-le.

`expires_at` vaut `null` car, sur un plan payant, un bin vit jusqu’à ce que vous le supprimiez ; sur Free, il vaut 24 heures après `created_at`. Free autorise un bin à la fois : sur ce plan, cet appel répond donc `402` `quota_exceeded` tant que le bin de l’étape 1 existe. Retrouvez plutôt celui-ci par son URL, avec `GET /v1/bins?url=https://nnbin.net/b/k7xq2mbn9tfa`.

Envoyez au nouveau bin la requête de l’étape 2, avec sa propre URL, puis listez ce qu’il a enregistré :

```bash
curl https://bins.nimbusnexus.net/v1/bins/bin_3f9a1c7e5b2d8f4a6c0e9b17/requests \
  -H "Authorization: Bearer $BINS_API_KEY"
```

```json
{
  "items": [
    {
      "id": "req_8d2e6b1f4a9c3e7d5b0f2a61",
      "bin_id": "bin_3f9a1c7e5b2d8f4a6c0e9b17",
      "method": "POST",
      "path": "/orders",
      "query": "source=quickstart",
      "source_ip": "203.0.113.24",
      "content_type": "application/json",
      "size_bytes": 36,
      "truncated": false,
      "seen_count": 1,
      "received_at": "2026-10-22T09:12:04Z",
      "expires_at": "2026-10-29T09:12:04Z"
    }
  ],
  "next_offset": null,
  "next_until": null
}
```

La requête la plus récente vient en premier. Son `expires_at` indique quand elle sera supprimée : ici 7 jours plus tard, la rétention de Starter.

Pour lire une requête en entier, avec sa query string, ses headers et son corps :

```bash
curl https://bins.nimbusnexus.net/v1/requests/req_8d2e6b1f4a9c3e7d5b0f2a61 \
  -H "Authorization: Bearer $BINS_API_KEY"
```

```json
{
  "id": "req_8d2e6b1f4a9c3e7d5b0f2a61",
  "method": "POST",
  "path": "/orders",
  "query": "source=quickstart",
  "headers": [
    {"name": "user-agent", "value": "curl/8.7.1"},
    {"name": "accept", "value": "*/*"},
    {"name": "content-type", "value": "application/json"},
    {"name": "content-length", "value": "36"}
  ],
  "body_base64": "eyJvcmRlcl9pZCI6IDEwNDIsICJzdGF0dXMiOiAicGFpZCJ9",
  "size_bytes": 36,
  "truncated": false,
  "request_id": "4b8f2c1d9e7a46b3a0c5d8e2f1a7b9c3"
}
```

Celle-ci est aussi abrégée : la réponse complète porte chaque champ de l’élément de liste. Le corps est en base64 car un corps n’est pas forcément du texte. Pour l’afficher :

```bash
curl -s https://bins.nimbusnexus.net/v1/requests/req_8d2e6b1f4a9c3e7d5b0f2a61 \
  -H "Authorization: Bearer $BINS_API_KEY" | jq -r .body_base64 | base64 --decode
```

```text
{"order_id": 1042, "status": "paid"}
```

## Du polling, pas de push {#polling}

Il n’y a ni flux ni callback. Pour attendre une requête, interrogez la liste avec `since` réglé sur le `received_at` le plus récent que vous avez vu ; elle ne renvoie que les requêtes reçues après cet instant :

```bash
curl -G https://bins.nimbusnexus.net/v1/bins/bin_3f9a1c7e5b2d8f4a6c0e9b17/requests \
  --data-urlencode "since=2026-10-22T09:12:04Z" \
  -H "Authorization: Bearer $BINS_API_KEY"
```

`-G` avec `--data-urlencode` place `since` encodé dans la query string, si bien qu’un décalage comme `+00:00` survit au trajet. Une requête envoyée à nouveau est une nouvelle ligne à part entière : elle revient donc aussi dans cette liste, avec ses propres `id` et `received_at`.

N’interrogez pas un nombre fixe de fois pour faire une assertion sur la dernière réponse. Vérifiez que la requête *apparaît*, avec un timeout, sinon un expéditeur lent ressemblera à un expéditeur qui n’a jamais rien envoyé.

## Nettoyage {#cleanup}

Sur un plan payant, un bin vit jusqu’à ce que vous le supprimiez, sauf si vous l’avez créé avec `expires_in_minutes`, et chaque plan plafonne le nombre de bins que vous pouvez détenir à la fois. Supprimez-le donc quand vous avez terminé :

```bash
curl -X DELETE https://bins.nimbusnexus.net/v1/bins/bin_3f9a1c7e5b2d8f4a6c0e9b17 \
  -H "Authorization: Bearer $BINS_API_KEY"
```

La suppression est **définitive** : l’URL cesse aussitôt d’enregistrer, ce que le bin a enregistré est supprimé, et son slug n’est plus jamais émis, ni pour vous ni pour personne. Les expéditeurs en reçoivent toujours `200`. Pour arrêter plutôt d’enregistrer pendant un moment, passez le bin à `{"status": "disabled"}` avec `PATCH`, puis de nouveau à `{"status": "enabled"}` plus tard. Pour garder le bin et effacer ce qu’il contient, videz-le avec `DELETE /v1/bins/{id}/requests`. Dans la console, les trois se trouvent dans le menu ⋯ de la page du bin : **Delete bin…**, **Disable** et **Empty bin…**. Sur Free, un bin expire au plus tard 24 heures après sa création, ce qui y met fin de la même façon qu’une suppression.

## Étapes suivantes {#next-steps}

- [Vue d’ensemble du produit](/docs/product-bins) — plans et limites, bins suspendus, et ce que Request Bins ne fait pas.
- [Transfert](/docs/product-bins/forwarding) — transférer aussi chaque requête vers votre propre serveur, sur un plan payant.
- [Référence Request Bins](/docs/product-bins/reference) — chaque route et chaque champ, ce que répond une URL de bin, rôles et portées.
- [API Request Bins](/docs/reference/bins) — chaque opération, avec la requête en curl, TypeScript, Python ou Go.
