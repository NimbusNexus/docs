---
title: "Transfert"
description: "Un bin peut transférer chaque requête qu’il enregistre vers votre propre serveur et conserver ce que votre serveur a répondu — ce qui est envoyé, les réessais, les limites et l’adresse d’où viennent les transferts."
publishedAt: 2026-10-26
updatedAt: 2026-10-26
kind: concept
---

# Transfert

Donnez une URL de transfert à un bin : chaque requête qu’il enregistre est aussi transférée vers votre propre serveur, telle qu’elle est arrivée. L’expéditeur reçoit toujours immédiatement le `200` du bin. Le bin transfère la requête de lui-même, réessaie quand votre serveur échoue et conserve la réponse de votre serveur à côté de la requête : un seul endroit montre ainsi ce qu’un expéditeur a envoyé et ce que votre endpoint en a fait.

## Qui peut transférer, et vers où {#target}

Le transfert est inclus dans Starter, Pro et Custom. Sur Free, définir une URL de transfert donne `402` `not_entitled`, avec `details.feature` `forwarding`.

Un bin transfère vers une seule URL, et cette URL doit être :

- **En https**, sur n’importe quel port. Le certificat est vérifié par rapport au nom d’hôte de l’URL.
- **Sans nom d’utilisateur ni mot de passe.**
- **Sur l’internet public.** Chaque adresse en laquelle son hôte se résout doit être publique : une adresse privée, de bouclage, lien-local ou réservée à un autre titre est refusée, tout comme un hôte qui ne se résout pas.
- **Pas l’une des nôtres.** `nnbin.net`, `nimbusnexus.net` et tous les noms sous eux sont refusés, de même que tout nom qui se résout en l’une de nos propres adresses : un bin ne peut pas transférer vers un bin, ni vers les propres services de NimbusNexus.
- **Longue de 2,048 caractères au plus.**

L’URL est vérifiée quand vous la définissez et de nouveau avant chaque envoi, et chaque envoi ne part que vers les adresses trouvées par cette vérification : un changement de DNS entre-temps ne peut donc pas la faire pointer ailleurs. Les redirections ne sont pas suivies : une réponse `3xx` est conservée comme réponse de votre serveur, et le transfert compte comme envoyé, car une redirection pourrait mener vers n’importe quel endroit que la vérification n’a jamais vu.

Le chemin et la query string de chaque requête sont ajoutés à l’URL de transfert. Avec l’URL de transfert `https://api.example.com/hooks`, une requête vers `https://nnbin.net/b/k7xq2mbn9tfa/stripe/events?x=1` part vers `https://api.example.com/hooks/stripe/events?x=1`. Une requête vers l’URL de bin seule part vers l’URL de transfert telle que vous l’avez définie, et une query string que porte l’URL de transfert vient en premier.

Définissez l’URL avec **Set up forwarding** sur la carte **Forwarding** du bin dans la console, ou avec `forward_url` sur `PATCH /v1/bins/{id}` :

```bash
curl -X PATCH https://bins.nimbusnexus.net/v1/bins/bin_3f9a1c7e5b2d8f4a6c0e9b17 \
  -H "Authorization: Bearer $BINS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"forward_url": "https://api.example.com/hooks"}'
```

La réponse est le bin, avec `forward_url` défini. **Stop forwarding** sur la carte, ou `"forward_url": null`, désactive le transfert. Définir l’URL exige le rôle de membre, ou une clé avec **Read & write**. Une URL qui enfreint l’une des règles ci-dessus est refusée avec `422`, et la [référence](/docs/product-bins/reference#forwarding) liste chaque raison.

## Vérifier d’abord l’URL {#test}

**Send a test** sur la carte Forwarding, ou `POST /v1/bins/{id}/forward-test`, envoie tout de suite un petit événement JSON à votre serveur et montre ce qu’il a répondu, pour que vous sachiez que l’URL fonctionne avant que du vrai trafic en dépende :

```bash
curl -X POST https://bins.nimbusnexus.net/v1/bins/bin_3f9a1c7e5b2d8f4a6c0e9b17/forward-test \
  -H "Authorization: Bearer $BINS_API_KEY"
```

```json
{
  "ok": true,
  "answer": {
    "status": 200,
    "headers": [
      {"name": "content-type", "value": "text/plain"}
    ],
    "body_base64": "b2s=",
    "truncated": false
  },
  "duration_ms": 142,
  "error": ""
}
```

Votre serveur reçoit un `POST` dont le corps est `{"type":"request_bins.forward_test","bin":"<slug>","sent_at":"<when>"}`, avec `Content-Type: application/json`, `User-Agent: NimbusNexus-Request-Bins (forward test)`, `X-Request-Bins-Request: test`, ainsi que les headers `Via` et `X-Forwarded-Host` que porte chaque transfert. `ok` vaut `true` pour une réponse `2xx` ou `3xx`. Quand aucune réponse n’arrive, `answer` vaut `null` et `error` indique pourquoi, comme un timeout. Un bin peut envoyer 10 tests par minute.

## Ce qui est envoyé {#sent}

Un transfert, c’est la requête telle que le bin l’a enregistrée :

- **la méthode**, quelle qu’elle soit ;
- **le corps, octet pour octet** ;
- **les headers, dans leur ordre d’arrivée**, moins ceux ci-dessous, puis les nôtres.

**Retirés**, car ils appartiennent à une connexion ou à un saut plutôt qu’à la requête : `Connection` et chaque header qu’il nomme, `Keep-Alive`, `Proxy-Connection`, `Proxy-Authenticate`, `TE`, `Trailer`, `Transfer-Encoding` et `Upgrade` ; `Host`, qui devient celui de votre serveur, et `Content-Length`, qui est recalculé ; et `X-Real-IP`, `X-Forwarded-Proto`, `X-Forwarded-Host`, `CDN-Loop` et chaque header `CF-*`, qui décrivent un saut antérieur ; le transfert définit ses propres `X-Forwarded-Proto` et `X-Forwarded-Host`. Le `X-Request-Bins-Request` propre à un expéditeur est retiré aussi : celui que lit votre serveur est donc le nôtre.

**Non transférés : les justificatifs d’identité.** `Authorization`, `Proxy-Authorization`, `Cookie`, `Set-Cookie` et `X-Api-Key` ne quittent jamais le bin. Une URL de bin est publique : un bin remplace donc ces valeurs par `[redacted]` avant tout stockage, et rien de ce qu’un expéditeur y a mis n’est conservé, pas même pour l’instant où un transfert en aurait besoin. Les headers de signature, comme `Stripe-Signature` ou `X-Hub-Signature-256`, ne sont pas des justificatifs et sont transférés. Le corps est inchangé : ils se vérifient donc toujours, même si un réessai peut arriver après l’expiration de la tolérance d’une signature horodatée. La contrepartie : un serveur qui authentifie son appelant avec l’un de ces cinq headers refuse les requêtes transférées.

**Ajoutés**, après les headers de l’expéditeur :

| Header | Valeur |
| --- | --- |
| `X-Forwarded-For` | Les entrées `X-Forwarded-For` propres à l’expéditeur, s’il en a envoyé, puis l’adresse de l’expéditeur, le `source_ip` de la requête. |
| `Forwarded` | Les éléments `Forwarded` propres à l’expéditeur, puis le nôtre : `for=<sender>;proto=https;host=nnbin.net`. |
| `Via` | `1.1 nnbin.net`, après tout `Via` ajouté par les propres proxys de l’expéditeur. |
| `X-Forwarded-Proto` | `https` |
| `X-Forwarded-Host` | `nnbin.net` |
| `X-Request-Bins-Request` | L’`id` de la requête, par exemple `req_8d2e6b1f4a9c3e7d5b0f2a61`, pour que les logs de votre serveur mènent jusqu’à elle. |

## Livraison et réessais {#delivery}

L’expéditeur reçoit immédiatement `200` et `{"status":"accepted"}`, comme avec n’importe quel bin, quoi que fasse votre serveur, et ne voit jamais la réponse de votre serveur. Le bin envoie le transfert de lui-même, généralement dans les secondes qui suivent l’enregistrement de la requête.

Une tentative expire quand votre serveur met plus de 10 secondes à accepter la connexion, ou plus de 10 secondes à répondre. La suite dépend de la façon dont la tentative s’est terminée :

| La tentative s’est terminée par | Ce qui se passe |
| --- | --- |
| Une réponse `2xx` ou `3xx` | Envoyé. Une redirection n’est pas suivie. |
| Une erreur de connexion, un timeout, `408`, `429` ou un `5xx` | Réessayé, jusqu’à épuisement des tentatives du plan. |
| Tout autre `4xx` | Échec immédiat : renvoyer la même requête ne changera rien à un `400` ni à un `404`. |
| Une URL de transfert qui ne passe plus [les vérifications](#target) | Échec immédiat. |

Une tentative échouée est réessayée 30 secondes plus tard, puis 2 minutes, 10 minutes et 30 minutes après chacune des tentatives suivantes, jusqu’à épuisement des tentatives du plan : 3 sur Starter, si bien que la dernière arrive environ deux minutes et demie après la première, et 5 sur Pro et Custom, environ 43 minutes après. Quand une réponse `408`, `429` ou `5xx` porte un `Retry-After` qui demande une attente plus longue, le bin attend plutôt ce délai, jusqu’à une heure.

Avant chaque tentative, le bin vérifie de nouveau qu’il peut envoyer. Un transfert est abandonné, et marqué comme non transféré, dès que le bin a été supprimé ou suspendu, que le transfert a été arrêté ou [mis en pause](#paused), que l’espace de travail a été suspendu, ou que le plan n’inclut plus le transfert. Un transfert part vers l’URL définie à l’arrivée de sa requête : changer l’URL ne déplace donc pas les transferts déjà en attente.

Seules les requêtes qui arrivent pendant qu’un bin transfère sont envoyées : activer le transfert n’envoie rien de ce que le bin a enregistré avant. Chaque requête est transférée séparément : une requête envoyée deux fois est donc enregistrée deux fois et transférée deux fois. L’ordre des requêtes n’est pas conservé : une requête réessayée peut atteindre votre serveur après une requête arrivée plus tard.

## Voir ce qui s’est passé {#forwards}

Dans la console, ouvrez une requête. Sa section **Forwarding** montre où elle a été envoyée et où elle en est (**Queued**, **Sending**, **Sent**, **Retrying**, **Failed** ou **Not forwarded** avec la raison), les tentatives faites jusqu’ici, la dernière erreur et la réponse de votre serveur : son statut, ses headers et les premiers 8 KiB de son corps. La carte Forwarding du bin montre le dernier envoi en échec.

Via l’API, `GET /v1/requests/{id}` liste les transferts de la requête dans `forwards`, du plus récent au plus ancien. L’un d’eux :

```json
{
  "id": "fwd_5a1e8c3b7d2f9a4e6c0b1d83",
  "state": "sent",
  "reason": "",
  "url": "https://api.example.com/hooks/orders?source=quickstart",
  "attempts": 1,
  "max_attempts": 3,
  "next_attempt_at": null,
  "last_error": "",
  "answer": {
    "status": 200,
    "headers": [
      {"name": "content-type", "value": "application/json"}
    ],
    "body_base64": "eyJyZWNlaXZlZCI6dHJ1ZX0=",
    "truncated": false
  },
  "duration_ms": 142,
  "created_at": "2026-10-26T09:12:04Z",
  "sent_at": "2026-10-26T09:12:05Z"
}
```

La [référence](/docs/product-bins/reference#forwards) donne chaque champ, chaque état et chaque raison. La réponse de votre serveur est conservée aussi longtemps que la requête, et supprimée avec elle. Sur le bin, `forward_last_error` et `forward_last_error_at` indiquent ce qui s’est mal passé lors du dernier envoi en échec, comme `HTTP 503` ou un timeout, et jamais ce que contenait la requête.

## Limites {#limits}

| | Starter | Pro | Custom |
| --- | --- | --- | --- |
| Plus grand corps transféré | 256 KiB | 1 MiB | 1 MiB |
| Transferts par minute, par bin | 60 | 300 | 600 |
| Tentatives par requête | 3 | 5 | 5 |

- **Un corps plus grand est enregistré et non transféré**, avec la raison `body_too_large`. Il en va de même pour un corps de plus de 1 MiB sur tous les plans, puisqu’un bin ne le stocke que jusqu’à 1 MiB ([Ce qu’un bin enregistre](/docs/product-bins/reference#edge-records)).
- **Au-delà des transferts par minute d’un bin**, les transferts attendent leur tour. Aucun n’est abandonné pour autant.
- **Un bin détient au plus 1,000 transferts non terminés** : en file d’attente, en cours d’envoi ou en attente d’un réessai. Une requête qui arrive alors qu’il en détient autant est enregistrée et non transférée, avec la raison `queue_full`.
- **L’URL de transfert, à laquelle s’ajoutent le chemin et la query string d’une requête,** doit tenir en 8,192 caractères, sinon la requête n’est pas transférée (`url_too_long`).
- **Le transfert ne consomme aucune requête supplémentaire.** Une requête transférée compte une fois dans les requêtes du mois, quand elle est enregistrée, et ses tentatives ne comptent pas. Une requête que le bin n’a pas enregistrée, parce que les requêtes du mois étaient épuisées ou que le bin était suspendu, n’est pas transférée non plus.

## Quand le transfert se met en pause {#paused}

Quand votre serveur échoue sans cesse, le bin cesse de lui envoyer des requêtes : le transfert se met en pause après 20 tentatives échouées d’affilée, ou après une heure pendant laquelle toutes les tentatives ont échoué. Une seule tentative réussie fait repartir les deux décomptes de zéro.

Tant que le transfert est en pause, le bin continue d’enregistrer mais n’envoie rien : chaque requête qui arrive, et chaque transfert qui attendait, est marqué non transféré, avec la raison `paused`, et aucun n’est envoyé plus tard. Le bin indique quand et pourquoi il s’est mis en pause : **Paused** sur sa carte Forwarding, et `forward_paused_at` et `forward_paused_reason` (`failed_in_a_row` ou `failing_for_an_hour`) dans l’API.

**L’espace de travail en est averti**, une fois par pause, comme il l’est pour les requêtes du mois : par e-mail, envoyé au propriétaire de l’espace de travail sauf si vous choisissez une autre adresse, et par un webhook si vous en configurez un. Les deux se trouvent sous **Notifications** dans votre console de compte. La reprise n’envoie rien.

L’e-mail, « Request Bins: forwarding was paused on one of your bins », nomme le bin par son libellé et son URL, ainsi que l’hôte vers lequel il transférait, jamais le chemin ni la query string. Il indique pourquoi le bin s’est mis en pause, avec la dernière erreur, et que les requêtes sont toujours enregistrées mais qu’aucune n’est transférée : celles enregistrées entre-temps ne seront donc pas transférées plus tard. Il se termine en indiquant comment reprendre.

Le type d’événement du webhook est `bind.forwarding.paused`, et son corps est :

```json
{
  "type": "bind.forwarding.paused",
  "workspace_id": "{{WORKSPACE_ID}}",
  "data": {
    "bin_id": "bin_3f9a1c7e5b2d8f4a6c0e9b17",
    "label": "Quickstart",
    "url": "https://nnbin.net/b/w4tz8hcv2qnd",
    "forward_host": "api.example.com",
    "reason": "failed_in_a_row",
    "paused_at": "2026-10-26T14:05:12.345678Z",
    "failures": 20,
    "last_error": "HTTP 503"
  }
}
```

`reason` vaut `failed_in_a_row` ou `failing_for_an_hour`, `failures` est le nombre d’envois consécutifs qui avaient échoué et `last_error` ce qui s’est mal passé lors du dernier d’entre eux. `forward_host` est l’hôte seul de l’URL de transfert : un avis ne porte jamais le chemin ni la query string de l’URL, qui peuvent contenir un secret.

Pour reprendre une fois votre serveur réparé, choisissez **Resume** sur la carte Forwarding, ou définissez de nouveau `forward_url` avec `PATCH /v1/bins/{id}`, à la même URL ou à une nouvelle. Le transfert reprend avec la prochaine requête que le bin enregistre, et **Send a test** montre si votre serveur répond.

## D’où viennent les transferts {#source-address}

Les transferts et les envois de test atteignent votre serveur depuis `23.247.240.155`, en IPv4 : un serveur dont l’hôte n’a que des adresses IPv6 ne peut donc pas les recevoir. C’est l’adresse actuelle, et elle peut changer : cette page l’indiquera avant que ce soit le cas. Si votre serveur n’accepte que les requêtes d’adresses qu’il connaît, autorisez celle-ci.

## Ce que le transfert n’est pas {#not}

- **Un proxy.** L’expéditeur reçoit le `200` du bin, jamais la réponse de votre serveur, et un bin ne peut pas répondre avec un statut, des headers ou un corps de votre choix.
- **Un rejeu.** Une requête enregistrée ne peut pas être renvoyée à la demande : chacune est transférée une fois, à son arrivée, avec ses réessais.
- **Une diffusion.** Un bin transfère vers une seule URL. Pour vérifier les signatures d’un fournisseur et livrer ses webhooks à plusieurs de vos endpoints, avec une dead-letter queue et la relivraison, utilisez une [source Webhooks](/docs/product-webhooks/sources).

## Étapes suivantes {#next-steps}

- [Référence Request Bins](/docs/product-bins/reference#forwarding) — `forward_url`, l’envoi de test et chaque champ d’un transfert.
- [Vue d’ensemble du produit](/docs/product-bins) — ce qu’un bin enregistre, et les limites de chaque plan.
- [Sources Webhooks](/docs/product-webhooks/sources) — les webhooks d’un fournisseur, vérifiés et livrés à vos endpoints.
