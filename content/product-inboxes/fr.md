---
title: "Inboxes"
description: "Des adresses e-mail jetables pour vos tests — créez-en une, pointez-y le système testé et lisez ce qui arrive dans la console ou via l’API."
publishedAt: 2026-08-18
updatedAt: 2026-10-26
kind: concept
---

# Inboxes

NimbusNexus Inboxes vous fournit des **adresses e-mail** jetables qui acceptent du vrai courrier. Vous en créez une, vous y pointez un formulaire d’inscription ou une suite de tests, et vous lisez ce qui est arrivé dans la console ou via l’API REST.

> **Ce n’est pas la page que vous cherchez ?** Inboxes ne fait que recevoir des e-mails. Pour *envoyer* du courrier depuis votre application, ce n’est pas le bon produit. Pour capturer des **requêtes HTTP** — les webhooks d’un fournisseur, ou ce qu’envoie votre propre application — utilisez [Request Bins](/docs/product-bins).

## En bref {#at-a-glance}

| | |
| --- | --- |
| Ce que vous créez | Une **boîte** : une adresse e-mail jetable |
| URL de base de l’API | `{{INBOXES_BASE_URL}}` |
| Authentification | `Authorization: Bearer <key>`, avec une clé créée dans la console de compte avec **Inboxes** comme produit |
| Identifiant attendu par chaque route | L’`id` de la boîte, par exemple `inb_7f820a77f64ea18174499945` — jamais l’adresse |
| Trouver une boîte par son adresse | `GET /v1/inboxes?address=<address>` |
| Lire ce qui est arrivé | `GET /v1/inboxes/{id}/messages` (plans payants ; avec le plan gratuit, la lecture se fait dans la console) |
| Supprimer une boîte | `DELETE /v1/inboxes/{id}` — définitif, et l’adresse n’est plus jamais émise |
| Chaque route, avec des exemples | La [référence de l’API Inboxes](/docs/reference/inboxes) |

## Comment ça marche {#how}

1. **Créez** une adresse — dans la console avec **New address**, ou avec `POST /v1/inboxes`.
2. **Envoyez**-lui du courrier depuis le système testé, avec la `phrase` de la boîte dans l’objet si elle en a une.
3. **Lisez** ce qui est arrivé. Cela apparaît en quelques secondes dans la console et, sur les plans payants, à `GET /v1/inboxes/{id}/messages`.
4. **Supprimez**-la quand vous avez terminé, ou laissez-la expirer.

Le [démarrage rapide](/docs/product-inboxes/quickstart) parcourt les quatre étapes avec `curl`.

Utilisez l’`address` exactement telle que l’API la renvoie. Les adresses vivent sur un domaine dédié, et non sur `{{ROOT_DOMAIN}}`, afin que le trafic jetable ne partage jamais sa réputation avec le domaine qu’utilise votre vrai courrier.

## Comment fonctionne l’acceptation {#acceptance}

Le courrier est refusé à l’entrée plutôt qu’accepté puis caché. Un message n’est stocké que si toutes ces conditions sont remplies :

- l’adresse du destinataire est une boîte existante et activée ;
- l’**objet contient la phrase de cette boîte**, si elle en a une ;
- l’espace de travail n’a pas dépassé son quota mensuel ;
- le message ne dépasse pas 5 MiB.

Tout le reste est refusé pendant la conversation SMTP : le serveur d’envoi en est informé et génère le bounce. Un message refusé n’est jamais stocké et n’est jamais décompté de votre consommation.

Le courrier accepté est nettoyé avant stockage : le HTML passe par un filtre de nettoyage à liste d’autorisation, et la console l’affiche dans un cadre isolé, avec les images distantes bloquées jusqu’à ce que vous les demandiez. N’importe qui peut écrire à une adresse jetable : le contenu est donc traité comme rédigé par un attaquant.

## Limites par plan {#limits}

| | Free | Starter | Pro | Custom |
| --- | --- | --- | --- | --- |
| Adresses simultanées | 1 | 5 | 25 | 250 |
| Messages par mois | 1,000 | 25,000 | 250,000 | 5,000,000 |
| Conservation (rétention) | 1 jour | 7 jours | 30 jours | 90 jours |
| Durée de vie d’une adresse | 24 heures | jusqu’à sa suppression, ou jusqu’à 7 jours si vous en fixez une | jusqu’à sa suppression, ou jusqu’à 30 jours | jusqu’à sa suppression, ou toute durée de vie |
| Phrase dans l’objet | toujours exigée | facultative | facultative | facultative |
| Lecture via l’API | non (console uniquement) | oui | oui | oui |
| Courriers acceptés par minute et par adresse | 60 | 300 | 1,200 | 6,000 |

Les limites de taille sont les mêmes sur tous les plans :

| | Limite |
| --- | --- |
| Un e-mail | 5 MiB. Un courrier plus grand est refusé, jamais tronqué. |
| Corps texte ou HTML | 256K caractères de chacun sont conservés ; le reste est coupé et le message est marqué `truncated: true`. |
| Pièces jointes | Le nom, le type de contenu, la taille et l’empreinte sont conservés. Le fichier lui-même n’est stocké sur aucun plan. |

## Comment une adresse prend fin {#lifecycle}

| | Ce qui se passe | Pouvez-vous l’annuler ? |
| --- | --- | --- |
| **Désactiver** | L’adresse cesse d’accepter du courrier et conserve ce qu’elle contient ; le courrier qui lui est envoyé est refusé. | Oui — réactivez-la |
| **Supprimer** | L’adresse et son courrier sont supprimés, et l’adresse est retirée : elle n’est plus jamais émise, ni pour vous ni pour personne. | Non |
| **Expiration** | À `expires_at`, la même chose que Supprimer. Seules les adresses du plan gratuit (24 heures) et les adresses créées avec `expires_in_minutes` expirent. | Non |

La suppression se fait avec `DELETE /v1/inboxes/{id}` ; les anciennes versions de cette documentation et le journal d’audit de l’API l’appellent *release*. Une adresse retirée n’est jamais réattribuée, et c’est délibéré : une adresse recyclée livrerait la réinitialisation de mot de passe d’un inconnu à quiconque la détiendrait ensuite. [Les adresses et la phrase](/docs/product-inboxes/addresses#lifecycle) donne les détails, notamment sur l’interaction entre expiration et rétention.

## Lire via l’API {#reading}

Les messages sont lisibles dans la console sur tous les plans, y compris le plan gratuit. Les lire **par programme**, c’est ce qu’ajoutent les plans payants : `GET /v1/inboxes/{id}/messages` renvoie le message analysé, les deux parties du corps, les verdicts d’authentification et un champ `extracted` qui porte tout code à usage unique que nous avons trouvé — ce qui est généralement la seule chose que veut un test.

Chaque route attend l’`id` de la boîte. La console l’affiche sur la carte de l’adresse, avec un bouton de copie. Si vous n’avez que l’adresse, cherchez la boîte :

```bash
curl "{{INBOXES_BASE_URL}}/v1/inboxes?address=ff25m3tue9vm@nninbox.com" \
  -H "Authorization: Bearer $INBOXES_API_KEY"
```

La réponse est la liste habituelle, avec un élément au plus. `GET /v1/inboxes` et `GET /v1/inboxes/{id}` renvoient ensemble l’`id`, l’`address` et la `phrase` : un seul appel vous donne donc tout ce qu’il faut pour envoyer et pour lire.

## Obtenir l’accès {#access}

Inscrivez-vous à Inboxes et vous obtenez un espace de travail sur le plan gratuit : une adresse à la fois, une rétention de 24 heures et la lecture dans la console. Les tarifs sont sur la [page Inboxes](/inboxes).

Les clés ne sont pas émises avec l’espace de travail, et l’API Inboxes ne les émet pas. Créez-en une dans votre console de compte NimbusNexus, sous **API keys**, en choisissant **Inboxes** comme produit — Identity est l’unique émetteur de clés API sur l’ensemble de la plateforme. Une clé est un JWT : elle commence donc par `eyJ`. Présentez-la sous la forme `Authorization: Bearer <key>` ou `X-API-Key: <key>`.

Choisissez la portée à la création : `admin` peut créer, modifier et supprimer des adresses en plus de lire, `read` ne peut que lire. Une clé Inboxes ne peut pas être limitée à un seul projet.

> **Une clé `inbx_…` ne permet plus de s’authentifier.** Inboxes émettait auparavant ses propres clés avec ce préfixe. Si vous en détenez une, créez une clé de remplacement dans la console de compte.

## Ce que le produit ne fait pas {#not}

- **Il n’envoie pas.** Il n’y a pas d’API d’envoi ni de relais. Une adresse capable d’émettre du courrier serait un service de spam.
- **Ce n’est pas une archive.** Un message est supprimé à la fin de la rétention du plan, et tout le contenu d’une adresse disparaît quand l’adresse est supprimée ou expire.
- **Il ne transfère pas encore.** Le transfert de ce qui arrive vers une URL qui vous appartient est prévu, mais pas implémenté.
- **Il ne capture pas le HTTP.** Une boîte ne reçoit que du courrier. Pour les webhooks et les autres requêtes HTTP, utilisez [Request Bins](/docs/product-bins), dont les URL enregistrent toute requête qui leur est envoyée.

## Étapes suivantes {#next-steps}

- [Démarrage rapide](/docs/product-inboxes/quickstart) — créer une adresse, lui envoyer un message, le relire.
- [Les adresses et la phrase](/docs/product-inboxes/addresses) — le filtre sur l’objet, l’expiration et la rétention.
- [Référence de l’API Inboxes](/docs/reference/inboxes) — chaque route, avec la requête en curl, TypeScript, Python ou Go.
