---
title: "Request Bins"
description: "Des URL publiques qui enregistrent chaque requête HTTP reçue — pointez-y une application, un script ou un service et lisez exactement ce qu’il a envoyé, dans la console ou via l’API."
publishedAt: 2026-10-22
updatedAt: 2026-10-26
kind: concept
---

# Request Bins

NimbusNexus Request Bins vous fournit des **bins** : des URL publiques qui enregistrent chaque requête HTTP qui leur est envoyée, avec n’importe quelle méthode, vers n’importe quel chemin sous l’URL, avec n’importe quel corps. Pointez vers l’un d’eux tout ce qui envoie du HTTP — un fournisseur de webhooks, votre propre application, un script, un job de CI — et lisez exactement ce qui est arrivé : la méthode, le chemin, la query string, les headers, le corps et l’adresse d’origine, dans la console ou via l’API REST.

> **Ce n’est pas la page que vous cherchez ?** Un bin enregistre ce qu’il reçoit et répond de la même façon à chaque expéditeur. Sur un plan payant, il peut aussi transmettre chaque requête à une URL qui vous appartient, telle qu’elle est arrivée ([Transfert](/docs/product-bins/forwarding)), mais il ne vérifie pas les signatures et ne livre pas à plusieurs endpoints. Pour vérifier les webhooks d’un fournisseur et les livrer sous forme d’événements à vos endpoints, avec une dead-letter queue et la relivraison, utilisez une [source Webhooks](/docs/product-webhooks/sources).

## En bref {#at-a-glance}

| | |
| --- | --- |
| Ce que vous créez | Un **bin** : une URL comme `https://nnbin.net/b/k7xq2mbn9tfa` |
| Ce qu’il enregistre | Chaque requête vers cette URL ou vers n’importe quel chemin sous elle, avec n’importe quelle méthode (`GET`, `POST`, le `PROPFIND` de WebDAV, une méthode propre à l’expéditeur), n’importe quels headers et n’importe quel corps |
| Ce que reçoit l’expéditeur | `200` et `{"status":"accepted"}`, immédiatement |
| Transfert | Sur Starter, Pro et Custom, un bin peut aussi transférer chaque requête vers votre propre URL https ([Transfert](/docs/product-bins/forwarding)) |
| Console | `https://bins.nimbusnexus.net` |
| URL de base de l’API | `https://bins.nimbusnexus.net/v1` |
| Authentification | `Authorization: Bearer <key>`, avec une clé créée dans la console de compte avec **Request Bins** comme produit |
| Identifiant attendu par chaque route | L’`id` du bin, par exemple `bin_3f9a1c7e5b2d8f4a6c0e9b17` — pas son URL |
| Trouver un bin par son URL | `GET /v1/bins?url=<url>` |
| Lire ce qui est arrivé | `GET /v1/bins/{id}/requests` (plans payants ; sur Free, la lecture se fait dans la console) |
| Chaque route, ce que répond une URL de bin, rôles et limites | La [référence Request Bins](/docs/product-bins/reference) |

## Comment ça marche {#how}

1. **Créez** un bin — dans la console avec **New bin**, ou avec `POST /v1/bins`. Son URL enregistre dès cet instant.
2. **Envoyez**-lui des requêtes. Donnez l’URL à ce que vous voulez observer — les paramètres de webhooks d’un fournisseur, la configuration de votre application, un script, un job de CI — ou appelez-la vous-même avec `curl`. Ce qui suit le slug est à votre choix : une requête vers `https://nnbin.net/b/k7xq2mbn9tfa/orders/42` est enregistrée avec le chemin `/orders/42`.
3. **Lisez** ce qui est arrivé. Cela apparaît dans la console en quelques secondes et, sur les plans payants, à `GET /v1/bins/{id}/requests`. Pour trouver une requête parmi beaucoup d’autres, cherchez du texte dans les chemins, les headers et les corps, ou ne gardez que certaines méthodes : **Search** et les pastilles de méthode au-dessus de la liste dans la console, `q` et `method` dans l’API ([Requêtes capturées](/docs/product-bins/reference#requests)). Pour voir quels chemins un expéditeur a utilisés, basculez la liste sur **By path** : elle compte les requêtes vers chaque chemin, et choisir un chemin liste ses requêtes. `GET /v1/bins/{id}/paths` fait de même dans l’API ([Requêtes par chemin](/docs/product-bins/reference#paths)).
4. **Supprimez** le bin quand vous avez terminé, ou laissez-le expirer.

Le [démarrage rapide](/docs/product-bins/quickstart) parcourt les quatre étapes.

Utilisez l’`url` exactement telle que l’API la renvoie. Les URL de bin vivent sur leur propre domaine, `nnbin.net`, et non sur `{{ROOT_DOMAIN}}`.

## Ce que reçoit l’expéditeur {#answers}

Un bin répond immédiatement à chaque requête par `200` et le corps `{"status":"accepted"}`, qu’il ait enregistré la requête ou non. Un bin désactivé, suspendu ou qui a dépassé les requêtes mensuelles de son plan répond de la même façon, tout comme une URL dont le bin n’a jamais existé ou a été supprimé. C’est voulu : un expéditeur qui reçoit une erreur peut cesser d’envoyer, ou désactiver votre webhook, et une réponse différente pour un bin actif permettrait à n’importe qui de sonder l’existence de bins.

Une URL de bin ne répond autre chose que lorsque rien n’a été enregistré :

- `429`, avec `Retry-After`, quand l’expéditeur ou le bin dépasse sa limite par minute ;
- `503`, avec `Retry-After`, quand la requête n’a pas pu être stockée à ce moment-là : l’expéditeur doit donc la renvoyer ;
- `404`, quand le slug de l’URL n’est pas un slug que Request Bins aurait jamais pu émettre.

La référence donne les détails : [ce que répond une URL de bin](/docs/product-bins/reference#edge-answers).

## Ce qui est enregistré {#recorded}

Pour chaque requête, un bin conserve la méthode, le chemin après le slug, la query string, les headers dans leur ordre d’arrivée, le corps, l’adresse d’origine et l’heure d’arrivée. Quelques règles déterminent ce que vous relisez :

- **Les corps sont stockés en entier, jusqu’à 1 MiB.** Un corps plus grand est coupé à 1 MiB, `truncated` vaut `true`, et `size_bytes` indique toujours sa taille réelle.
- **Les justificatifs d’identité sont masqués.** Les valeurs de `Authorization`, `Proxy-Authorization`, `Cookie`, `Set-Cookie` et `X-API-Key` sont remplacées par `[redacted]` avant tout stockage. Tous les autres headers sont conservés tels qu’envoyés, headers de signature compris, car c’est la signature que vous devez voir quand sa vérification échoue.
- **Rien n’est modifié ni exécuté.** Un corps est stocké sous la forme des octets reçus, et la console l’affiche comme du texte, jamais comme du balisage.
- **Chaque requête est une ligne à part entière.** Une requête envoyée à nouveau, avec la même méthode, le même chemin, la même query string et le même corps, est stockée à nouveau, avec ses propres headers, son adresse et son heure : chacun des réessais d’un expéditeur peut ainsi être ouvert séparément.

## Transfert {#forwarding}

Sur Starter, Pro et Custom, un bin peut aussi transférer chaque requête qu’il enregistre vers votre propre serveur. Donnez-lui une URL de transfert : la méthode, le chemin, la query string, les headers et le corps partent vers cette URL tels qu’ils sont arrivés, tandis que l’expéditeur reçoit toujours immédiatement le `200` du bin. Le bin réessaie quand votre serveur échoue, et conserve ce que votre serveur a répondu à côté de la requête : vous voyez ainsi ce qu’un expéditeur a envoyé et ce que votre endpoint en a fait. Les justificatifs d’identité ne sont pas transférés : les headers qu’un bin masque ne le quittent jamais. [Transfert](/docs/product-bins/forwarding) donne les règles, les réessais, les limites et l’adresse d’où viennent les transferts.

## Plans et limites {#limits}

| | Free | Starter | Pro | Custom |
| --- | --- | --- | --- | --- |
| Prix | $0 | $9 par mois, ou $86.40 par an | $29 par mois, ou $278.40 par an | sur contrat |
| Bins simultanés | 1 | 5 | 25 | 250 |
| Requêtes enregistrées par mois | 1,000 | 25,000 | 250,000 | 5,000,000 |
| Conservation (rétention) | 1 jour | 7 jours | 30 jours | 90 jours |
| Durée de vie d’un bin | 24 heures | jusqu’à sa suppression, ou jusqu’à 7 jours si vous en fixez une | jusqu’à sa suppression, ou jusqu’à 30 jours | jusqu’à sa suppression, ou jusqu’à un an |
| Lecture via l’API | non (console uniquement) | oui | oui | oui |
| [Transfert](/docs/product-bins/forwarding), par bin | non | 60 requêtes / minute | 300 requêtes / minute | 600 requêtes / minute |
| Expéditeurs distincts par bin | 50 | 200 | 500 | 2,000 |
| Envois de formulaire depuis un navigateur par bin | 3 | 5 | 5 | 10 |

Free suffit pour voir exactement ce qu’envoie une application, un script ou un service : un bin, 1,000 requêtes par mois, lues dans la console.

Le mois est un mois civil en UTC, et chaque requête enregistrée par un bin compte. Une fois les requêtes du mois épuisées, les bins continuent de répondre `200` et n’enregistrent rien jusqu’au début du mois suivant ; les requêtes refusées ainsi ne comptent pas. Un bin ne peut utiliser qu’une partie des requêtes du mois — la totalité sur Free, la moitié sur Starter, 40 % sur Pro et un quart sur Custom — afin qu’une URL très sollicitée ou divulguée ne puisse pas épuiser les requêtes des autres bins de l’espace de travail.

Les deux dernières lignes sont des limites anti-abus, décrites dans [Bins suspendus](#suspended).

## Bins suspendus {#suspended}

Une URL de bin est publique : quiconque la connaît peut y envoyer des requêtes. Un bin serait donc un endroit pratique pour collecter ce que soumet le formulaire d’une page de phishing, ou des données dérobées sur les machines d’inconnus ; c’est pourquoi un bin est suspendu quand son trafic y ressemble :

- il reçoit des requêtes de plus d’adresses distinctes que la limite d’**expéditeurs distincts** du plan ; ou
- il reçoit plus d’envois de formulaire depuis des navigateurs web que la limite d’**envois de formulaire depuis un navigateur** du plan, depuis au moins trois adresses.

Un bin suspendu continue de répondre `200` et n’enregistre rien. La console indique pourquoi, tout comme `suspended_code` dans l’API. La suspension est de notre fait et ne dépend pas de votre interrupteur : activer le bin ne la lève pas, contactez donc le support si vous pensez qu’il s’agit d’une erreur. Les bins sont aussi mis en attente, sans être supprimés, quand un changement de plan laisse à l’espace de travail plus de bins que le nouveau plan n’en autorise, et tant que l’espace de travail est suspendu pour un impayé ; chacun revient une fois sa cause résolue.

Pour signaler une URL de bin utilisée de manière abusive, écrivez à `abuse@nnbin.net` en indiquant l’URL complète.

## Obtenir l’accès {#access}

Ouvrez la console à `https://bins.nimbusnexus.net` et connectez-vous avec votre compte NimbusNexus, ou ajoutez Request Bins depuis **Add a product** dans n’importe quelle console NimbusNexus. La première visite d’un propriétaire ou d’un admin de l’espace de travail ajoute Request Bins à l’espace de travail ; les autres membres peuvent ensuite l’ouvrir. Un espace de travail personnel démarre sur Free, et un espace de travail d’équipe démarre avec un essai Starter de 7 jours.

Les clés ne sont pas émises par l’API Request Bins. Créez-en une dans votre [console de compte]({{ACCOUNT_BASE_URL}}/api-keys?product=bins), sous **API keys**, avec **Request Bins** comme produit. Une clé est un JWT : elle commence donc par `eyJ`. Présentez-la sous la forme `Authorization: Bearer <key>` ou `X-API-Key: <key>`.

Choisissez sa permission à la création : **Read** lit les bins et ce qu’ils ont enregistré, et **Read & write** peut en plus créer, modifier, vider et supprimer des bins. Sur Free, une clé peut gérer les bins, mais lire ce qu’ils ont enregistré via l’API exige Starter ou plus ; la console le lit sur tous les plans. [Qui peut faire quoi](/docs/product-bins/reference#authority) donne le tableau complet, rôles de l’espace de travail compris.

## Ce que le produit ne fait pas {#not}

- **Il ne répond pas avec votre réponse.** Chaque bin répond `200` avec `{"status":"accepted"}` ; répondre avec un statut, des headers ou un corps de votre choix n’est pas implémenté.
- **Il ne rejoue pas.** Une requête enregistrée ne peut pas être renvoyée à la demande. [Transfert](/docs/product-bins/forwarding) envoie chaque requête une fois, à son arrivée.
- **Il ne pousse rien.** Il n’y a ni flux ni callback : interrogez `GET /v1/bins/{id}/requests` avec `since`, comme le fait la console toutes les 3 secondes.
- **Ce n’est pas une archive.** Une requête est supprimée à la fin de la rétention du plan, et tout le contenu d’un bin disparaît quand le bin est supprimé ou expire.
- **Il ne découpe pas un espace de travail par projet.** Request Bins sert des espaces de travail entiers : les sièges invités et les clés limitées à un projet sont donc refusés.

## Étapes suivantes {#next-steps}

- [Démarrage rapide](/docs/product-bins/quickstart) — créer un bin, lui envoyer une requête, la relire.
- [Transfert](/docs/product-bins/forwarding) — transférer chaque requête vers votre propre serveur, et voir ce qu’il a répondu.
- [Référence Request Bins](/docs/product-bins/reference) — chaque route et chaque champ, ce que répond une URL de bin, rôles, portées et limites.
- [API Request Bins](/docs/reference/bins) — chaque opération, avec la requête en curl, TypeScript, Python ou Go.
- [Erreurs](/docs/errors) — le format d’erreur et les codes envoyés par l’API.
