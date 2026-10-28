---
title: "Inboxes"
description: "Des adresses e-mail jetables pour vos tests — créez-en une, pointez-y le système testé et lisez ce qui arrive dans la console ou via l’API."
publishedAt: 2026-08-18
updatedAt: 2026-10-27
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
| Lire ce qui est arrivé | `GET /v1/inboxes/{id}/messages`, ou `GET /v1/messages` pour toutes les boîtes à la fois (plans payants ; avec le plan gratuit, la lecture se fait dans la console) |
| Rechercher dans ce qui est arrivé | `q` sur l’une ou l’autre liste, affiné avec `in` ou `header` ([Rechercher des messages](#search)) |
| Supprimer une boîte | `DELETE /v1/inboxes/{id}` — définitif, et l’adresse n’est plus jamais émise |
| Chaque route, avec des exemples | La [référence de l’API Inboxes](/docs/reference/inboxes) |

## Comment ça marche {#how}

1. **Créez** une boîte — dans la console avec **Create an inbox**, ou avec `POST /v1/inboxes`.
2. **Envoyez** du courrier à son adresse depuis le système testé, avec la `phrase` de la boîte dans l’objet si elle en a une.
3. **Lisez** ce qui est arrivé. Cela apparaît en quelques secondes dans la console et, sur les plans payants, à `GET /v1/inboxes/{id}/messages`. Pour trouver un message parmi beaucoup d’autres, cherchez dans les objets, les expéditeurs, les headers et les corps : **Search** au-dessus de la liste dans la console, `q` dans l’API ([Rechercher des messages](#search)). **All inboxes** dans la console, et `GET /v1/messages` dans l’API, listent ce qui est arrivé dans toutes les boîtes à la fois.
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
| Boîtes simultanées | 1 | 5 | 25 | 250 |
| Messages par mois | 1,000 | 25,000 | 250,000 | 5,000,000 |
| Conservation (rétention) | 1 jour | 7 jours | 30 jours | 90 jours |
| Durée de vie d’une boîte | 24 heures | jusqu’à sa suppression, ou jusqu’à 7 jours si vous en fixez une | jusqu’à sa suppression, ou jusqu’à 30 jours | jusqu’à sa suppression, ou toute durée de vie |
| Phrase dans l’objet | toujours exigée | facultative | facultative | facultative |
| Lecture via l’API | non (console uniquement) | oui | oui | oui |
| Courriers acceptés par minute et par boîte | 60 | 300 | 1,200 | 6,000 |

Les limites de taille sont les mêmes sur tous les plans :

| | Limite |
| --- | --- |
| Un e-mail | 5 MiB. Un courrier plus grand est refusé, jamais tronqué. |
| Corps texte ou HTML | 256K caractères de chacun sont conservés ; le reste est coupé et le message est marqué `truncated: true`. |
| Pièces jointes | Le nom, le type de contenu, la taille et l’empreinte sont conservés. Le fichier lui-même n’est stocké sur aucun plan. |

## Comment une boîte prend fin {#lifecycle}

| | Ce qui se passe | Pouvez-vous l’annuler ? |
| --- | --- | --- |
| **Désactiver** | La boîte cesse d’accepter du courrier et conserve ce qu’elle contient ; le courrier qui lui est envoyé est refusé. | Oui — réactivez-la |
| **Supprimer** | La boîte et son courrier sont supprimés, et son adresse est retirée : elle n’est plus jamais émise, ni pour vous ni pour personne. | Non |
| **Expiration** | À `expires_at`, la même chose que Supprimer. Toute boîte du plan gratuit expire, au bout de 24 heures au plus ; sur un plan payant, seule une boîte créée avec une durée de vie expire. | Non |

Dans la console, le menu ⋯ de la page d’une boîte contient **Rename…**, **Disable** ou **Enable**, **Empty inbox…**, qui supprime son courrier et conserve la boîte, et **Delete inbox…**. La suppression se fait avec `DELETE /v1/inboxes/{id}` ; les anciennes versions de cette documentation et le journal d’audit de l’API l’appellent *release*. Une adresse retirée n’est jamais réattribuée, et c’est délibéré : une adresse recyclée livrerait la réinitialisation de mot de passe d’un inconnu à quiconque la détiendrait ensuite. [Les adresses et la phrase](/docs/product-inboxes/addresses#lifecycle) donne les détails, notamment sur l’interaction entre expiration et rétention.

## Lire via l’API {#reading}

Les messages sont lisibles dans la console sur tous les plans, y compris le plan gratuit. Les lire **par programme**, c’est ce qu’ajoutent les plans payants : `GET /v1/inboxes/{id}/messages` liste les messages d’une boîte, du plus récent au plus ancien, avec l’expéditeur, l’objet et les verdicts d’authentification de chacun et, avec `extract=otp`, un champ `extracted` qui porte tout code à usage unique que nous avons trouvé — ce qui est généralement la seule chose que veut un test. `GET /v1/messages` liste les messages de toutes les boîtes de l’espace de travail en une seule liste, chacun avec son `inbox_id`. `GET /v1/inboxes/{id}/messages/{message_id}` renvoie un message en entier : les deux parties du corps, les détails de ses pièces jointes et ses [headers](#headers).

Chaque route attend l’`id` de la boîte. La console l’affiche sur la page de la boîte, à côté de **ID**, avec un bouton de copie. Si vous n’avez que l’adresse, cherchez la boîte :

```bash
curl "{{INBOXES_BASE_URL}}/v1/inboxes?address=ff25m3tue9vm@nninbox.com" \
  -H "Authorization: Bearer $INBOXES_API_KEY"
```

La réponse est la liste habituelle, avec un élément au plus. `GET /v1/inboxes` et `GET /v1/inboxes/{id}` renvoient ensemble l’`id`, l’`address` et la `phrase` : un seul appel vous donne donc tout ce qu’il faut pour envoyer et pour lire.

## Rechercher des messages {#search}

Les deux listes de messages acceptent une recherche : `GET /v1/inboxes/{id}/messages` pour une boîte et `GET /v1/messages` pour toutes. Le champ **Search** de la console, au-dessus de chaque liste, envoie les mêmes paramètres :

| Paramètre | Description |
| --- | --- |
| `q` | Seulement les messages contenant ce texte, jusqu’à 200 caractères, sans tenir compte de la casse. |
| `in` | Où `q` cherche : `all`, la valeur par défaut, ou seulement `subject`, `from` (l’expéditeur, tel que l’indique son header From), `headers` (chacun sous la forme `name: value`) ou `body` (le corps texte ou, pour un e-mail qui n’a qu’un corps HTML, le texte de son HTML). |
| `header` | Seulement les valeurs de ce header, son nom dans n’importe quelle casse, et n’importe laquelle d’entre elles quand le header est arrivé plusieurs fois. Sans `q`, chaque message qui porte ce header. Il se combine avec `in` `all` ou `headers`. |

```bash
curl -G "{{INBOXES_BASE_URL}}/v1/inboxes/inb_7f820a77f64ea18174499945/messages" \
  --data-urlencode "q=verification code" \
  --data-urlencode "in=subject" \
  -H "Authorization: Bearer $INBOXES_API_KEY"
```

`since`, `until`, `extract` et `limit` fonctionnent avec une recherche comme sans. Un `header` avec `in` réglé sur `subject`, `from` ou `body` est refusé avec un `422` `validation_error` dont l’entrée a le type `inboxes.search_conflict`.

Une recherche se pagine différemment de la liste simple. Elle lit les messages du plus récent au plus ancien et s’arrête dès qu’elle a `limit` correspondances ou qu’elle a lu 16 MiB de courrier (ou 5,000 messages), selon ce qui arrive en premier : une page peut donc contenir moins de correspondances que `limit`, voire aucune, alors que des messages plus anciens n’ont pas encore été lus. La page d’une recherche a `next_offset` à `null` et, tant que la recherche n’a pas lu le message le plus ancien de la liste, un `next_until` : renvoyez-le comme `until`, avec la même recherche et le même `since`, pour poursuivre la recherche là où elle s’est arrêtée. Avec une recherche, `offset` saute ce nombre de messages avant que la recherche ne commence à lire. Sans recherche, `next_until` vaut toujours `null`, et la liste se pagine par `next_offset`.

Une recherche dans les headers ne trouve que le courrier arrivé après qu’Inboxes a commencé à conserver les headers ([Headers](#headers)).

## Headers {#headers}

`GET /v1/inboxes/{id}/messages/{message_id}` porte les lignes de header de l’e-mail sous `headers` : des objets avec un `name` et une `value`, dans l’ordre d’arrivée, doublons conservés, chaque valeur dépliée et ses mots encodés (RFC 2047) décodés. Jusqu’à 256 lignes sont conservées, un nom est coupé à 256 caractères et une valeur à 8,192. Les listes ne portent pas les headers. Dans la console, ils se trouvent dans la section **Headers** du message.

`headers` vaut `null` pour un e-mail arrivé avant qu’Inboxes ne commence à conserver les headers : ils n’ont pas été conservés pour lui, et ne peuvent pas être ajoutés après coup. L’e-mail brut n’est pas conservé, seulement ses parties analysées.

## Obtenir l’accès {#access}

Inscrivez-vous à Inboxes et vous obtenez un espace de travail sur le plan gratuit : une boîte à la fois, une rétention de 24 heures et la lecture dans la console. Les tarifs sont sur la [page Inboxes](/inboxes).

Les clés ne sont pas émises avec l’espace de travail, et l’API Inboxes ne les émet pas. Créez-en une dans votre console de compte NimbusNexus, sous **API keys**, en choisissant **Inboxes** comme produit — Identity est l’unique émetteur de clés API sur l’ensemble de la plateforme. Une clé est un JWT : elle commence donc par `eyJ`. Présentez-la sous la forme `Authorization: Bearer <key>` ou `X-API-Key: <key>`.

Choisissez la portée à la création : `admin` peut créer, modifier, vider et supprimer des boîtes en plus de lire, `read` ne peut que lire. Une clé Inboxes ne peut pas être limitée à un seul projet.

> **Une clé `inbx_…` ne permet plus de s’authentifier.** Inboxes émettait auparavant ses propres clés avec ce préfixe. Si vous en détenez une, créez une clé de remplacement dans la console de compte.

## Ce que le produit ne fait pas {#not}

- **Il n’envoie pas.** Il n’y a pas d’API d’envoi ni de relais. Une adresse capable d’émettre du courrier serait un service de spam.
- **Ce n’est pas une archive.** Un message est supprimé à la fin de la rétention du plan, et tout le contenu d’une adresse disparaît quand l’adresse est supprimée ou expire.
- **Il ne transfère pas encore.** Le transfert de ce qui arrive vers une URL qui vous appartient est prévu, mais pas implémenté.
- **Il ne capture pas le HTTP.** Une boîte ne reçoit que du courrier. Pour les webhooks et les autres requêtes HTTP, utilisez [Request Bins](/docs/product-bins), dont les URL enregistrent toute requête qui leur est envoyée.

## Étapes suivantes {#next-steps}

- [Démarrage rapide](/docs/product-inboxes/quickstart) — créer une boîte, lui envoyer un message, le relire.
- [Les adresses et la phrase](/docs/product-inboxes/addresses) — le filtre sur l’objet, l’expiration et la rétention.
- [Référence de l’API Inboxes](/docs/reference/inboxes) — chaque route, avec la requête en curl, TypeScript, Python ou Go.
