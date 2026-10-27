---
title: "Démarrage rapide Inboxes"
description: "Créez une adresse e-mail jetable, envoyez-lui un message et relisez-le — dans la console ou avec curl."
publishedAt: 2026-08-18
updatedAt: 2026-10-22
kind: quickstart
---

# Démarrage rapide Inboxes

De zéro à quelque chose sur quoi faire une assertion. Vous allez créer une adresse e-mail, lui envoyer du vrai courrier et relire son code à usage unique.

## Avant de commencer {#before}

- **Dans la console, sur tous les plans.** Ouvrez Inboxes et choisissez **New address**. La carte de la nouvelle adresse indique exactement où envoyer : l’adresse, et sa phrase si elle en a une. Ce qui arrive apparaît en dessous en quelques secondes. C’est tout le parcours sur le plan gratuit.
- **Via l’API, sur un plan payant.** La lecture par programme exige Starter ou plus — sur le plan gratuit, les routes des messages répondent `not_entitled`. Il vous faut aussi une clé API créée dans la console de compte avec **Inboxes** comme produit ; voir [Obtenir l’accès](/docs/product-inboxes#access).

Tous les chemins ci-dessous sont relatifs à `{{INBOXES_BASE_URL}}`, et chaque requête porte `Authorization: Bearer <your key>`.

## 1. Créer une adresse {#allocate}

```bash
curl -X POST {{INBOXES_BASE_URL}}/v1/inboxes \
  -H "Authorization: Bearer $INBOXES_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"phrase": true}'
```

```json
{
  "id": "inb_7f820a77f64ea18174499945",
  "address": "ff25m3tue9vm@nninbox.com",
  "transport": "email",
  "phrase": "nn-re89dr",
  "status": "enabled",
  "expires_at": null
}
```

Trois champs comptent :

- **`address`** est ce que vous donnez au système testé.
- **`phrase`** doit apparaître dans l’objet de tout ce qui est envoyé à cette adresse, sinon le courrier est refusé — c’est ce qui empêche une adresse divulguée de servir à s’inscrire un peu partout. Sur un plan payant, la phrase s’obtient sur demande : sans `"phrase": true`, vous obtenez `"phrase": ""` et l’adresse accepte n’importe quel objet.
- **`id`** est ce qu’attend chaque appel ultérieur. Conservez-le.

`expires_at` vaut `null` car, sur un plan payant, une adresse vit jusqu’à ce que vous la supprimiez ; envoyez `expires_in_minutes` pour en obtenir une qui expire d’elle-même.

`transport` vaut toujours `"email"`, car une boîte ne reçoit que du courrier. `POST /v1/inboxes` accepte `"transport": "email"` ou aucun `transport` ; toute autre valeur, comme `"http"`, est refusée avec un `422` `validation_error`. Pour enregistrer des requêtes HTTP, utilisez [Request Bins](/docs/product-bins).

## 2. Lui envoyer un message {#send}

Rien de propre à NimbusNexus ici — envoyez depuis ce que vous testez. La seule règle concerne l’objet :

```text
To:      ff25m3tue9vm@nninbox.com
Subject: nn-re89dr Your verification code
```

Un objet sans la phrase est refusé pendant la conversation SMTP. Votre expéditeur en est informé, et rien n’est stocké — un message manquant ici est donc un vrai refus, pas une perte silencieuse.

## 3. Le relire {#read}

```bash
curl "{{INBOXES_BASE_URL}}/v1/inboxes/inb_7f820a77f64ea18174499945/messages?extract=otp" \
  -H "Authorization: Bearer $INBOXES_API_KEY"
```

```json
{
  "items": [
    {
      "id": "msg_bd160c0bcf8db20fba4e535d",
      "from_addr": "noreply@example.test",
      "subject": "nn-re89dr Your verification code",
      "received_at": "2026-08-18T09:12:04Z",
      "extracted": { "otp": "100017" }
    }
  ],
  "next_offset": null
}
```

Tout l’intérêt est dans `extracted.otp`. Un test qui vérifie un parcours d’inscription veut généralement une seule chose — le code — et `?extract=otp` le place dans la réponse de liste : le cas courant ne demande donc pas de seconde requête. Sans `extract`, `extracted` vaut `null` ; `extract=links` renvoie à la place les liens du message, et `extract=all` renvoie les deux.

Pour le message complet, avec les deux parties du corps et les verdicts SPF/DKIM/DMARC :

```bash
curl {{INBOXES_BASE_URL}}/v1/inboxes/inb_7f820a77f64ea18174499945/messages/msg_bd160c0bcf8db20fba4e535d \
  -H "Authorization: Bearer $INBOXES_API_KEY"
```

**Vous n’avez que l’adresse ?** Cherchez la boîte pour obtenir son `id` :

```bash
curl "{{INBOXES_BASE_URL}}/v1/inboxes?address=ff25m3tue9vm@nninbox.com" \
  -H "Authorization: Bearer $INBOXES_API_KEY"
```

## Du polling, pas de push {#polling}

Il n’y a ni flux ni callback. Le courrier arrive en quelques secondes : interrogez donc la route de liste — un intervalle court pendant quelques secondes suffit, et c’est ce que fait la console elle-même.

N’interrogez pas un nombre fixe de fois pour faire une assertion sur la dernière réponse. Vérifiez que le message *apparaît*, avec un timeout, sinon un expéditeur lent ressemblera à un expéditeur en panne.

## Nettoyage {#cleanup}

Sur un plan payant, une adresse n’expire jamais, sauf si vous l’avez créée avec `expires_in_minutes`, et chaque plan plafonne le nombre d’adresses que vous pouvez détenir à la fois — supprimez-la donc quand vous avez terminé :

```bash
curl -X DELETE {{INBOXES_BASE_URL}}/v1/inboxes/inb_7f820a77f64ea18174499945 \
  -H "Authorization: Bearer $INBOXES_API_KEY"
```

La suppression est **définitive** : la boîte et son contenu sont supprimés, et l’adresse est retirée pour ne plus jamais pouvoir être émise, ni pour vous ni pour personne. C’est délibéré — une adresse jetable recyclée livrerait le courrier d’un inconnu dans votre boîte. Pour en mettre une en pause à la place, passez-la à `{"status": "disabled"}` avec `PATCH`, et réactivez-la plus tard.

## Étapes suivantes {#next-steps}

- [Les adresses et la phrase](/docs/product-inboxes/addresses) — les règles d’acceptation en détail, et l’interaction entre expiration et rétention.
- [Vue d’ensemble du produit](/docs/product-inboxes) — chaque limite par plan, et ce que le produit ne fait pas.
- [Référence de l’API Inboxes](/docs/reference/inboxes) — chaque route, avec la requête en curl, TypeScript, Python ou Go.
