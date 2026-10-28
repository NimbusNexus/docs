---
title: "Référence Request Bins"
description: "Chaque route de l’API Request Bins, ce qu’une URL de bin répond et enregistre, qui peut faire quoi et les limites de chaque plan."
publishedAt: 2026-10-22
updatedAt: 2026-10-27
kind: reference
---

# Référence Request Bins

Request Bins a deux faces. Les **URL de bin**, sur `nnbin.net`, acceptent les requêtes de n’importe qui et les enregistrent. **L’API**, à `https://bins.nimbusnexus.net/v1`, crée et gère les bins et lit ce qu’ils ont enregistré, pour votre espace de travail uniquement. Cette page couvre les deux, puis qui peut faire quoi et les limites de chaque plan. La [vue d’ensemble](/docs/product-bins) explique le produit, et le [démarrage rapide](/docs/product-bins/quickstart) le parcourt pas à pas.

## URL de bin {#edge}

| | |
| --- | --- |
| URL | `https://nnbin.net/b/<slug>`, et tout chemin sous elle : `https://nnbin.net/b/<slug>/<anything>` |
| Slug | 12 caractères : les lettres `a`–`z` sauf `l` et `o`, et les chiffres `2`–`9`. La casse n’a pas d’importance. |
| Méthodes | Toutes : `GET`, `POST` et les autres méthodes courantes, `PROPFIND` ou `COPY` de WebDAV, ou une méthode propre à l’expéditeur. Une méthode est enregistrée en majuscules, coupée à 16 caractères. `TRACE` et `CONNECT` sont refusées en amont du bin et jamais enregistrées. |
| Chemin enregistré | Tout ce qui suit le slug, tel qu’envoyé, avec l’encodage-pourcent conservé : `/b/<slug>/stripe/events` enregistre `/stripe/events`, et `/b/<slug>` enregistre `/`. |
| Query string enregistrée | La query string telle qu’envoyée, sans le `?`. |

### Ce que répond une URL de bin {#edge-answers}

| Statut | Corps | Quand |
| --- | --- | --- |
| `200` | `{"status":"accepted"}` | Chaque requête vers un slug bien formé, enregistrée ou non, sauf si une ligne ci-dessous s’applique. Un bin qui n’existe pas, a été supprimé, a expiré, est désactivé ou suspendu, ou a dépassé les requêtes mensuelles de son plan répond de la même façon. |
| `429` | `{"status":"rate_limited"}`, avec `Retry-After: 30` | L’adresse d’envoi dépasse 120 requêtes par minute vers les URL de bin, ou le bin dépasse 600 par minute, tous expéditeurs confondus. Vérifié avant la lecture du corps ; rien n’est enregistré ni compté. |
| `503` | `{"status":"unavailable"}`, avec `Retry-After: 30` | La requête n’a pas pu être stockée à ce moment-là. Rien n’est enregistré ; renvoyez-la. |
| `404` | aucun | Le slug ne peut pas être un slug émis par Request Bins : il n’a pas la bonne longueur, ou contient un caractère hors de l’alphabet des slugs. |

Le `200` est le même pour chaque issue, et c’est voulu. Un expéditeur qui reçoit une erreur peut cesser d’envoyer ou désactiver son webhook, et une réponse différente pour un bin actif permettrait à n’importe qui de sonder l’existence de bins. Savoir si une requête a été enregistrée, c’est le propriétaire du bin qui le lit dans l’API ou la console, jamais l’expéditeur.

Un `200` porte un header `X-Request-ID`, et le `request_id` de la requête capturée contient la même valeur : une ligne de log de l’expéditeur peut ainsi être rapprochée de ce que le bin a enregistré.

### Ce qu’un bin enregistre {#edge-records}

- **Corps :** un corps de n’importe quelle taille est accepté. Sa taille complète est comptée dans `size_bytes`, et il est stocké jusqu’à 1 MiB, si bien qu’un corps de 1 MiB au plus est stocké en entier. `truncated` vaut `true` quand le corps dépassait 1 MiB, et le corps stocké est alors plus court que `size_bytes`. Le corps est stocké sous la forme des octets reçus, jamais analysé ni modifié.
- **Headers :** dans l’ordre d’arrivée, doublons conservés, jusqu’à 256 ; un nom est coupé à 256 caractères et une valeur à 8,192. Les valeurs de `Authorization`, `Proxy-Authorization`, `Cookie`, `Set-Cookie` et `X-API-Key` sont remplacées par `[redacted]` avant tout stockage. Tous les autres headers sont conservés tels qu’envoyés.
- **Chemin :** coupé à 2,048 caractères.
- **Type de contenu :** le header `Content-Type`, sous `content_type`.
- **Adresse source :** l’adresse qui a envoyé la requête, sous `source_ip`.

### Chaque requête est une ligne {#edge-repeats}

Chaque requête est stockée comme une ligne à part entière. Une requête envoyée à nouveau, même avec la même méthode, le même chemin, la même query string et le même corps qu’une requête déjà présente dans le bin, est une nouvelle ligne avec ses propres headers, son adresse source, son heure et son `request_id`, et elle compte dans les requêtes du mois comme n’importe quelle autre. Les réessais d’un fournisseur apparaissent donc un par un, chacun avec sa propre signature et son propre timestamp. `seen_count` vaut `1` sur chaque nouvelle ligne. Une requête stockée avant le 25 octobre 2026 peut différer jusqu’à la fin de sa rétention : son corps a pu être coupé à 64 KiB, et son `seen_count` peut compter chaque fois que la même requête est arrivée.

### Quand rien n’est enregistré {#edge-refusals}

L’expéditeur reçoit `200` dans tous les cas ci-dessous. Ce que montre le bin :

| Le bin | Ce que montre le bin |
| --- | --- |
| n’existe pas, a été supprimé ou a expiré | — |
| est désactivé (`status` `disabled`) | — |
| est suspendu | — |
| appartient à un espace de travail suspendu pour un impayé | `refused_count` augmente ; `last_refused_reason` vaut `workspace_suspended` |
| a dépassé les requêtes du mois, ou sa propre part de celles-ci | `refused_count` augmente ; `last_refused_reason` vaut `quota_exceeded` |

`last_refused_summary` montre la dernière requête refusée sous la forme `METHOD /path`, et `last_refused_at` le moment où elle est arrivée. Les requêtes refusées ne comptent pas dans le mois.

### Suspension {#suspension}

Deux seuils suspendent un bin dont le trafic ressemble à une collecte auprès d’inconnus plutôt qu’à quelques expéditeurs connus :

- **Expéditeurs distincts :** un bin a reçu des requêtes de plus d’adresses distinctes que le plan n’en autorise : 50 sur Free, 200 sur Starter, 500 sur Pro et 2,000 sur Custom.
- **Envois de formulaire depuis un navigateur :** une requête qui porte un header de navigateur (`Origin`, `Referer`, `Sec-Fetch-Site` ou `Sec-Fetch-Mode`) et un type de contenu de formulaire (`application/x-www-form-urlencoded` ou `multipart/form-data`) est un envoi de formulaire depuis un navigateur. Un bin qui en reçoit plus que le plan n’en autorise (3 sur Free, 5 sur Starter et Pro, 10 sur Custom), depuis au moins trois adresses, est suspendu. `browser_post_count`, `last_browser_form_origin` et `last_browser_form_at` montrent ce qu’il a vu.

La requête qui franchit un seuil est enregistrée, celles qui suivent ne le sont pas. Un bin suspendu répond `200` et n’enregistre rien, quel que soit son `status`. `suspended_code` indique pourquoi :

| `suspended_code` | Pourquoi | Levée |
| --- | --- | --- |
| `source_fanout` | Le seuil d’expéditeurs distincts | Par NimbusNexus ; contactez le support |
| `browser_posts` | Le seuil d’envois de formulaire depuis un navigateur | Par NimbusNexus ; contactez le support |
| `abuse` | NimbusNexus l’a suspendu après un signalement | Par NimbusNexus |
| `non_payment` | L’espace de travail est suspendu pour un impayé | Quand l’impayé est réglé |
| `plan_downgrade` | Le plan autorise moins de bins que l’espace de travail n’en détient, et celui-ci est l’un des plus récents | Quand le plan l’autorise de nouveau, les bins les plus anciens d’abord |

Traitez `suspended_code` comme une chaîne ouverte et prévoyez un cas par défaut pour une valeur que vous ne connaissez pas ; `suspended_reason` dit la même chose en toutes lettres. Un bin peut être suspendu pour plusieurs causes à la fois, et chacune est levée séparément : régler un impayé ne lève jamais une suspension pour abus, et lever une suspension ne fait jamais revenir un bin que le plan n’autorise plus.

Pour signaler une URL de bin utilisée de manière abusive, écrivez à `abuse@nnbin.net` en indiquant l’URL complète. La page `https://nnbin.net/` dit la même chose.

### Navigateurs {#edge-browsers}

Les URL de bin n’envoient aucun header CORS. Une page web peut envoyer à un bin une requête simple, comme un envoi de formulaire, mais ne peut pas lire la réponse, et une requête qui nécessite un preflight s’arrête à son `OPTIONS`, qui est ce que le bin enregistre. `robots.txt` demande aux moteurs de recherche de ne pas explorer les URL de bin.

## L’API {#api}

L’URL de base est `https://bins.nimbusnexus.net/v1`. Les requêtes et les réponses sont en JSON. Envoyez une clé sous la forme `Authorization: Bearer <key>` ou `X-API-Key: <key>` ([Obtenir l’accès](/docs/product-bins#access)). Les timestamps sont en ISO 8601, en UTC, et un timestamp envoyé sans décalage est lu comme UTC. Les erreurs suivent le format décrit dans [Erreurs](/docs/errors).

| Route | Ce qu’elle fait | Exige |
| --- | --- | --- |
| `POST /v1/bins` | Crée un bin ; `201` avec [le bin](#bin) | write |
| `GET /v1/bins` | Les bins de l’espace de travail, du plus récent au plus ancien ; `url` ou `slug` en trouve un | read |
| `GET /v1/bins/{id}` | Un bin | read |
| `PATCH /v1/bins/{id}` | Renomme un bin, le désactive et le réactive, ou définit son [URL de transfert](#forwarding) | write |
| `POST /v1/bins/{id}/forward-test` | Envoie un [test](#forward-test) à l’URL de transfert du bin et renvoie ce qu’elle a répondu | write |
| `DELETE /v1/bins/{id}` | Supprime un bin ; `204` | admin |
| `GET /v1/bins/{id}/requests` | Les [requêtes capturées](#requests) d’un bin, de la plus récente à la plus ancienne | read ; avec une clé, un plan payant |
| `GET /v1/requests` | Les [requêtes capturées](#all-requests) de tous les bins en une seule liste, de la plus récente à la plus ancienne | read ; avec une clé, un plan payant |
| `GET /v1/bins/{id}/paths` | Les requêtes d’un bin [regroupées par chemin](#paths) | read ; avec une clé, un plan payant |
| `GET /v1/requests/{id}` | Une requête capturée, en entier, avec ses [transferts](#forwards) | read ; avec une clé, un plan payant |
| `DELETE /v1/bins/{id}/requests` | Vide un bin ; `200` avec `{"deleted": <count>}` | admin |
| `GET /v1/plan` | Le plan de l’espace de travail et ses limites | read |
| `GET /v1/usage` | Les requêtes de ce mois et les bins détenus, rapportés au plan | read |

**read**, **write** et **admin** sont expliqués dans [Qui peut faire quoi](#authority).

### Créer un bin {#create}

`POST /v1/bins` prend un corps JSON, `{}` si vous ne définissez rien :

| Champ | Description |
| --- | --- |
| `label` | Le nom que vous donnez au bin, jusqu’à 200 caractères. Les expéditeurs ne le voient jamais. |
| `expires_in_minutes` | La durée de vie du bin : de 1 à 525,600 (un an). Sans ce champ, la valeur par défaut du plan s’applique : 24 heures sur Free, jusqu’à suppression sur les plans payants. Une durée de vie plus longue que ce que le plan autorise est ramenée à son maximum, pas refusée : 24 heures sur Free, 7 jours sur Starter, 30 jours sur Pro et un an sur Custom. `expires_at` dans la réponse montre le résultat. |

La durée de vie d’un bin ne peut pas être modifiée après sa création. Quand l’espace de travail détient déjà tous les bins de son plan, la réponse est `402` `quota_exceeded`, avec `details.metric` `bins`, `details.limit` et `details.current`. Les bins mis en attente par un passage à un plan inférieur ne comptent pas.

### Trouver un bin {#list}

`GET /v1/bins` liste les bins de l’espace de travail, du plus récent au plus ancien. Avec `url` (une URL de bin, avec ou sans chemin après le slug) ou `slug` (dans n’importe quelle casse), il renvoie ce seul bin, ou une liste vide. Les bins supprimés et expirés ne sont jamais listés, et en lire un répond `404`.

Les listes sont paginées avec `limit` (de 1 à 200, 50 par défaut) et `offset` (de 0 à 10,000). La réponse est `{"items": [...], "next_offset": <offset>}` : renvoyez `next_offset` comme `offset` pour obtenir la page suivante. Il vaut `null` sur la dernière page, et au-delà de l’offset 10,000.

### L’objet bin {#bin}

| Champ | Description |
| --- | --- |
| `id` | `bin_` suivi de 24 caractères hexadécimaux. Chaque route l’attend. |
| `slug` | La partie de l’URL après `/b/`. |
| `url` | L’URL à donner aux expéditeurs. |
| `label` | Le nom que vous lui donnez. |
| `status` | `enabled` ou `disabled` : votre interrupteur. Un bin désactivé répond aux expéditeurs et n’enregistre rien. |
| `expires_at` | La fin du bin, ou `null` s’il vit jusqu’à sa suppression. |
| `created_at` | Sa date de création. |
| `suspended` | `true` tant que NimbusNexus maintient le bin coupé ([Suspension](#suspension)). |
| `suspended_code`, `suspended_reason` | La raison, en un mot et en toutes lettres ; vides quand le bin n’est pas suspendu. |
| `refused_count` | Les requêtes ayant reçu une réponse sans être enregistrées parce que l’espace de travail avait dépassé ses requêtes ou était suspendu. |
| `last_refused_summary`, `last_refused_reason`, `last_refused_at` | La dernière d’entre elles, sous la forme `METHOD /path` ; `quota_exceeded` ou `workspace_suspended` ; et son heure d’arrivée. |
| `browser_post_count` | Les envois de formulaire depuis un navigateur que le bin a reçus. |
| `last_browser_form_origin`, `last_browser_form_at` | La page qui a envoyé le dernier, et quand. |
| `request_count` | Les requêtes enregistrées depuis la création du bin ou son dernier vidage. |
| `last_request_at` | L’heure d’arrivée de la dernière, ou `null`. |
| `period_requests` | Les requêtes de ce mois comptées pour le bin, à comparer à `bin_request_ceiling` dans [`GET /v1/usage`](#plan). |
| `forward_url` | L’URL vers laquelle le bin [transfère](#forwarding) chaque requête qu’il enregistre, ou `null` quand il ne transfère pas. |
| `forward_paused_at`, `forward_paused_reason` | Le moment où le transfert s’est [mis en pause](/docs/product-bins/forwarding#paused) après des envois en échec, et pourquoi : `failed_in_a_row` ou `failing_for_an_hour`. `null` et vide tant qu’il n’est pas en pause. |
| `forward_last_error`, `forward_last_error_at` | Le dernier envoi en échec : ce qui s’est mal passé, comme `HTTP 503` ou un timeout, jamais ce que contenait la requête ; et quand. |

### Modifier ou supprimer un bin {#change}

`PATCH /v1/bins/{id}` prend `label`, `status` (`enabled` ou `disabled`) et `forward_url` ([Transfert](#forwarding)), seuls ou combinés, et répond avec le bin. La désactivation arrête l’enregistrement et conserve ce que contient le bin. Un bin désactivé compte toujours dans les bins du plan.

`status` valait autrefois `active` là où il vaut désormais `enabled`, et aucune réponse ne dit plus `active`. `PATCH` accepte toujours `"status": "active"`, et le bin renvoyé indique alors `enabled`, mais cette graphie est dépréciée et sera refusée à partir d’une date qui reste à annoncer : envoyez donc `enabled`.

Dans la console, le menu ⋯ de la page d’un bin contient **Rename…**, **Disable** ou **Enable**, **Empty bin…** et **Delete bin…**, et le transfert se configure sur sa carte **Forwarding**. La page d’un bin désactivé l’indique, avec un bouton **Enable**.

`DELETE /v1/bins/{id}` supprime un bin définitivement. Son URL cesse aussitôt d’enregistrer, même si les expéditeurs reçoivent toujours `200` ; son slug n’est plus jamais émis, ni pour vous ni pour personne ; et ce qu’il a enregistré est supprimé peu après. Sa place parmi les bins du plan se libère immédiatement.

`DELETE /v1/bins/{id}/requests` vide un bin : chaque requête qu’il contient est supprimée et `request_count` revient à `0`. Le bin garde son URL et continue d’enregistrer.

### Requêtes capturées {#requests}

`GET /v1/bins/{id}/requests` liste les requêtes d’un bin, de la plus récente à la plus ancienne, et `GET /v1/requests` liste [celles de tous les bins](#all-requests) en une seule liste. Les deux acceptent ces paramètres :

| Paramètre | Description |
| --- | --- |
| `since` | Seulement les requêtes reçues après cet instant. Passez le `received_at` le plus récent que vous avez vu pour interroger les nouvelles. |
| `until` | Seulement les requêtes reçues à cet instant ou avant : le moyen de remonter vers les plus anciennes. |
| `method` | Seulement les requêtes envoyées avec cette méthode, dans n’importe quelle casse. Répétez-le pour en accepter plusieurs : `?method=PUT&method=DELETE`. |
| `path` | Seulement les requêtes envoyées exactement à ce chemin : ce qui suivait le slug, à partir de son `/`, sans la query string, tel que la liste l’affiche. La casse a de l’importance. [Requêtes par chemin](#paths) liste les chemins d’un bin. |
| `q` | Seulement les requêtes contenant ce texte, jusqu’à 200 caractères, sans tenir compte de la casse : dans le chemin et la query string tels qu’envoyés (`/orders?id=42`), dans un header sous la forme `name: value`, ou dans le corps stocké. Un corps qui n’est pas du texte UTF-8 est recherché avec chaque octet supérieur à 127 (et NUL) écrit sous la forme `\` suivi de trois chiffres octaux, et chaque barre oblique inverse doublée. |
| `in` | Où `q` cherche : `all`, la valeur par défaut, ou seulement `path` (le chemin et la query string), `headers` (chacun sous la forme `name: value`) ou `body`. |
| `header` | Seulement les valeurs de ce header, son nom dans n’importe quelle casse, et n’importe laquelle d’entre elles quand il a été envoyé plusieurs fois. Sans `q`, chaque requête qui porte ce header. Il se combine avec `in` `all` ou `headers`. |
| `field` | Seulement ce champ d’un corps JSON, nommé sous la forme `data.object.id` ou `items[0].sku` : une chaîne est recherchée telle quelle, un nombre tel que JSON l’écrit, un objet ou un tableau sous forme de texte JSON. Sans `q`, chaque requête dont le corps contient ce champ. Un corps qui n’est pas du JSON, ou qui a été coupé à 1 MiB, n’a pas de champs. Il se combine avec `in` `all` ou `body`, et pas avec `header`. |
| `limit`, `offset` | Pagination, comme pour les bins. Au-delà de l’offset 10,000, réduisez plutôt la fenêtre avec `until`. |

Un `header` ou un `field` avec un autre `in`, ou un `header` et un `field` ensemble, est refusé avec un `422` `validation_error` dont l’entrée a le type `bins.search_conflict`.

Une recherche (`q`, `header` ou `field`) se pagine différemment du reste. Elle lit les requêtes de la liste de la plus récente à la plus ancienne et s’arrête dès qu’elle a `limit` correspondances ou qu’elle a lu 16 MiB de requêtes (ou 5,000 requêtes), selon ce qui arrive en premier : une page peut donc contenir moins de correspondances que `limit`, voire aucune, alors que des requêtes plus anciennes n’ont pas encore été lues. La page d’une recherche a `next_offset` à `null` et, tant que la recherche n’a pas lu la requête la plus ancienne de la liste, un `next_until` : renvoyez-le comme `until`, avec la même recherche et les mêmes `method`, `path` et `since`, pour poursuivre la recherche là où elle s’est arrêtée. Avec une recherche, `offset` saute ce nombre de requêtes avant que la recherche ne commence à lire.

```json
{
  "items": [],
  "next_offset": null,
  "next_until": "2026-10-23T14:02:11.408211+00:00"
}
```

Chaque élément :

| Champ | Description |
| --- | --- |
| `id` | `req_` suivi de 24 caractères hexadécimaux. |
| `bin_id` | Le bin auquel elle est arrivée. |
| `method` | La méthode HTTP. |
| `path` | Ce qui suivait le slug, tel qu’envoyé ; `/` pour l’URL de bin seule. |
| `query` | La query string telle qu’envoyée, sans le `?` ; vide s’il n’y en avait pas. |
| `source_ip` | L’adresse d’origine. |
| `content_type` | Son header `Content-Type`, ou vide. |
| `size_bytes` | La taille complète du corps, tel qu’envoyé. |
| `truncated` | `true` quand le corps dépassait 1 MiB, si bien qu’il n’est stocké que jusqu’à 1 MiB. |
| `seen_count` | `1` : chaque requête est une [ligne à part entière](#edge-repeats). |
| `received_at` | Son heure d’arrivée. |
| `expires_at` | Le moment où elle sera supprimée : la rétention du plan après `received_at`, ou l’`expires_at` du bin lui-même s’il arrive avant. |

`GET /v1/requests/{id}` renvoie une requête avec tous les champs ci-dessus, et :

| Champ | Description |
| --- | --- |
| `headers` | Des objets avec un `name` et une `value`, dans l’ordre d’arrivée, doublons conservés, justificatifs remplacés par `[redacted]`. |
| `body_base64` | Le corps stocké, encodé en base64 car ce n’est pas forcément du texte : 1 MiB au plus. |
| `request_id` | L’identifiant que l’URL de bin a donné à cette requête, c’est-à-dire le `X-Request-ID` que son expéditeur a reçu en retour. |
| `forwards` | Ce que sont devenus ses [transferts](#forwards), du plus récent au plus ancien ; vide si son bin ne transférait pas à son arrivée. |

Avec une clé API, `GET /v1/bins/{id}/requests`, `GET /v1/requests` et `GET /v1/requests/{id}` exigent un plan payant : sur Free, elles répondent `402` `not_entitled`, avec `details.feature` `read_api`. La console les lit sur tous les plans. Une requête dont l’`expires_at` est dépassé, ou qui se trouve dans un bin vidé, supprimé ou expiré, répond `404`.

### Requêtes de tous les bins {#all-requests}

`GET /v1/requests` liste les requêtes de tous les bins de l’espace de travail en une seule liste, de la plus récente à la plus ancienne. Elle accepte les paramètres de la liste d’un bin ci-dessus et se pagine de la même façon, par `next_offset`, ou par `next_until` pour une recherche. Ses éléments sont ceux de la liste d’un bin, chacun avec le `bin_id` du bin auquel il est arrivé ; pour afficher le libellé ou l’URL d’un bin à côté de chacun, faites correspondre `bin_id` avec `GET /v1/bins`.

Elle contient les requêtes des bins qui existent encore. Les requêtes d’un bin supprimé ou expiré en disparaissent aussitôt, et celles d’un bin désactivé ou suspendu y restent, comme elles restent dans la liste propre à ce bin. La page **All bins** de la console montre cette liste, avec les mêmes filtres de recherche et de méthode que la page d’un bin, et sans **By path**.

### Requêtes par chemin {#paths}

`GET /v1/bins/{id}/paths` regroupe par chemin les 10,000 requêtes les plus récentes d’un bin, le chemin utilisé le plus récemment en premier. La query string est laissée de côté : `/orders?id=1` et `/orders?id=2` forment donc un seul chemin. Les chemins, eux, sont comparés tels qu’envoyés : `/users/1` et `/users/2` en forment donc deux. `method` ne garde que les méthodes indiquées, comme sur la liste des requêtes, et `limit` et `offset` paginent comme pour les bins.

```json
{
  "items": [
    {
      "path": "/stripe/events",
      "requests": 42,
      "methods": ["POST", "GET"],
      "last_received_at": "2026-10-26T09:12:04Z"
    }
  ],
  "next_offset": null,
  "counted": 57,
  "capped": false
}
```

| Champ | Description |
| --- | --- |
| `path` | Ce qui suivait le slug, sans la query string. |
| `requests` | Le nombre de requêtes comptées qui lui ont été envoyées. |
| `methods` | Les méthodes avec lesquelles elles ont été envoyées, la plus utilisée en premier. |
| `last_received_at` | L’heure d’arrivée de la dernière d’entre elles. |

`counted` indique combien de requêtes ont été regroupées, et `capped` vaut `true` quand le bin en contient davantage, si bien que les chemins et les décomptes plus anciens manquent. Ne compter que les 10,000 plus récentes garde un appel aussi rapide sur un bin qui en contient des millions que sur un bin qui en contient dix. Pour lister les requêtes d’un chemin, passez-le comme `path` à `GET /v1/bins/{id}/requests`. Avec une clé API, la route exige un plan payant, comme les routes des requêtes.

Dans la console, **By path** au-dessus de la liste d’un bin montre les mêmes groupes, rafraîchis toutes les 10 secondes, avec les pastilles de méthode appliquées. Choisir un chemin liste ses requêtes, avec le chemin affiché sous forme de pastille au-dessus de la liste ; retirer la pastille liste de nouveau toutes les requêtes.

### Transfert {#forwarding}

Un bin sur Starter, Pro ou Custom peut transférer chaque requête qu’il enregistre vers une URL https qui vous appartient. [Transfert](/docs/product-bins/forwarding) couvre ce qui est envoyé, les réessais, les limites et le moment où le transfert se met en pause ; cette section couvre l’API.

`PATCH /v1/bins/{id}` avec `forward_url` définit l’URL, et `null` ou `""` arrête le transfert. Définir de nouveau une URL, même identique, relance un bin dont le transfert s’est [mis en pause](/docs/product-bins/forwarding#paused), et fait repartir de zéro son décompte d’envois en échec. Sur Free, la réponse est `402` `not_entitled`, avec `details.feature` `forwarding`. Une URL vers laquelle un bin refuse de transférer donne un `422` `validation_error` dont l’entrée a le type `bins.forward_target`, le `loc` `["body", "forward_url"]` et un `params.reason` :

| `reason` | Pourquoi |
| --- | --- |
| `scheme` | Elle n’est pas en `https`. |
| `credentials` | Elle porte un nom d’utilisateur ou un mot de passe. |
| `host` | Elle n’a pas d’hôte, ou son hôte n’est pas un nom valide. |
| `port` | Son port n’est pas compris entre 1 et 65535. |
| `length` | Elle dépasse 2,048 caractères. |
| `own_domain` | Son hôte est `nnbin.net`, `nimbusnexus.net` ou un nom sous l’un d’eux, ou se résout en l’une de nos propres adresses. |
| `not_public` | Son hôte ne se résout pas, ou se résout en une adresse qui n’est pas publique, comme une adresse privée, de bouclage ou lien-local. |
| `missing` | Un envoi de test vers un bin sans URL de transfert. |

Traitez `reason`, `forward_paused_reason` et le `reason` d’un transfert comme des chaînes ouvertes, et prévoyez un cas par défaut pour une valeur que vous ne connaissez pas.

Quand le transfert se met en pause, l’espace de travail en est averti une fois, par e-mail et par un webhook avec le type d’événement `bind.forwarding.paused` ; [Quand le transfert se met en pause](/docs/product-bins/forwarding#paused) montre le corps du webhook.

### Tester une URL de transfert {#forward-test}

`POST /v1/bins/{id}/forward-test` ne prend pas de corps. Il envoie immédiatement un événement de test à l’URL de transfert du bin et répond `200` avec ce qui est revenu ([Vérifier d’abord l’URL](/docs/product-bins/forwarding#test) montre l’événement) :

| Champ | Description |
| --- | --- |
| `ok` | `true` quand votre serveur a répondu `2xx` ou `3xx`. |
| `answer` | Ce qu’il a répondu : `status` ; `headers`, des objets avec un `name` et une `value`, dans l’ordre d’envoi ; les premiers 8 KiB du corps, sous `body_base64` ; et `truncated`, `true` quand le corps allait au-delà. `null` quand aucune réponse n’est arrivée. |
| `duration_ms` | La durée de l’envoi. |
| `error` | Pourquoi aucune réponse n’est arrivée, comme un timeout ou une connexion refusée ; vide quand une réponse est arrivée. |

L’appel attend la réponse jusqu’à 13 secondes, et un serveur plus lent donne `ok` à `false`, avec un `error` qui l’indique. Un bin peut envoyer 10 tests par minute : au-delà, la réponse est `429` `rate_limited`, et `details.retry_after` indique dans combien de secondes le suivant est autorisé. `503` `unavailable`, avec `details.reason` `forwarder_unavailable`, signifie que le test n’a pas été pris en charge pour l’envoi dans les 3 secondes, et que rien n’a donc été envoyé : réessayez sous peu. Une URL qui se révèle non publique au moment de l’envoi est refusée avec le `422` ci-dessus.

### Les transferts d’une requête {#forwards}

`GET /v1/requests/{id}` porte `forwards` : ce que sont devenus les transferts de la requête, du plus récent au plus ancien, et vide quand son bin ne transférait pas à son arrivée. [Voir ce qui s’est passé](/docs/product-bins/forwarding#forwards) en montre un en entier. Chaque élément :

| Champ | Description |
| --- | --- |
| `id` | `fwd_` suivi de 24 caractères hexadécimaux. |
| `state` | Où il en est, selon le tableau ci-dessous. |
| `reason` | Pourquoi la requête n’a pas été transférée, quand `state` vaut `not_forwarded` ; vide sinon. |
| `url` | Sa destination : l’URL de transfert telle qu’elle était à l’arrivée de la requête, à laquelle s’ajoutent le chemin et la query string de la requête. |
| `attempts`, `max_attempts` | Les tentatives faites jusqu’ici, et le maximum que le plan autorisait quand il a été mis en file d’attente. |
| `next_attempt_at` | Le moment prévu pour la prochaine tentative, tant que `state` vaut `retrying` ; `null` sinon. |
| `last_error` | Ce qui s’est mal passé lors de la dernière tentative, comme `HTTP 503` ou un timeout, ou pourquoi il attend ; vide une fois qu’il est envoyé. |
| `answer` | Ce que votre serveur a répondu lors de la dernière tentative, au même format que pour un [test](#forward-test). `null` quand cette tentative n’a reçu aucune réponse. |
| `duration_ms` | La durée de la dernière tentative ; `null` avant la première. |
| `created_at` | Le moment où il a été mis en file d’attente. |
| `sent_at` | Le moment où il a été envoyé ; `null` jusque-là. |

| `state` | Signification |
| --- | --- |
| `queued` | En attente de sa première tentative. |
| `sending` | Une tentative est en cours. |
| `sent` | Votre serveur a répondu `2xx` ou `3xx`. |
| `retrying` | Une tentative a échoué, et une autre est prévue à `next_attempt_at`. |
| `failed` | Abandonné : les tentatives du plan sont épuisées, ou une tentative s’est terminée d’une façon qui n’est pas réessayée, comme un `404`. |
| `not_forwarded` | La requête a été enregistrée et jamais envoyée ; `reason` indique pourquoi. |

| `reason` | Pourquoi la requête n’a pas été transférée |
| --- | --- |
| `paused` | Le transfert était en pause à l’arrivée de la requête, ou quand son tour est venu. |
| `body_too_large` | Le corps dépasse ce que le plan transfère, ou dépassait 1 MiB. |
| `url_too_long` | L’URL de transfert, à laquelle s’ajoutent le chemin et la query string de la requête, dépasse 8,192 caractères. |
| `queue_full` | 1,000 des transferts du bin n’étaient pas encore terminés. |
| `forwarding_off` | Le transfert a été arrêté avant son tour. |
| `bin_gone` | Le bin a été supprimé ou a expiré avant son tour. |
| `suspended` | Le bin ou son espace de travail a été suspendu avant son tour. |
| `not_entitled` | Le plan a cessé d’inclure le transfert avant son tour. |
| `request_gone` | La requête est arrivée au terme de sa rétention avant son tour. |

### Plan et consommation {#plan}

`GET /v1/plan` indique quelles limites s’appliquent :

```json
{
  "plan": "starter",
  "enforced_as": "starter",
  "ceilings": {
    "max_bins": 5,
    "monthly_requests": 25000,
    "retention_days": 7,
    "bin_ttl_minutes": 0,
    "bin_ttl_max_minutes": 10080,
    "read_api": 1,
    "bin_max_sources": 200,
    "bin_max_browser_posts": 5,
    "bin_share_pct": 50,
    "forwarding": 1,
    "forward_max_body_bytes": 262144,
    "forward_rate_per_min": 60,
    "forward_max_attempts": 3
  },
  "past_due": false,
  "suspended": false,
  "system": false
}
```

`plan` est le plan enregistré, vide quand l’espace de travail n’en a pas ; `enforced_as` est le plan dont les limites s’appliquent, `free` s’il n’y en a pas. `ceilings` contient les limites par nom ([Plans et limites](#limits)). `past_due` vaut `true` tant qu’un impayé n’est pas réglé, et `suspended` une fois écoulé le délai de grâce qui suit. `system` concerne l’espace de travail de NimbusNexus lui-même.

`GET /v1/usage` indique quelle part en est utilisée :

```json
{
  "period": "2026-10-01",
  "requests": 1834,
  "monthly_requests": 25000,
  "bins": 2,
  "max_bins": 5,
  "bin_request_ceiling": 12500
}
```

`period` est le mois, sous la forme de son premier jour. `requests` compte ce que les bins de l’espace de travail ont enregistré ce mois-ci, à comparer à `monthly_requests`. `bins` compte les bins détenus, à comparer à `max_bins`. `bin_request_ceiling` est le maximum qu’un seul bin peut enregistrer ce mois-ci.

## Qui peut faire quoi {#authority}

| | Lire les bins, le plan et la consommation | Lire les requêtes capturées | Créer, renommer, désactiver et activer des bins, et configurer le transfert | Supprimer et vider des bins |
| --- | --- | --- | --- | --- |
| Propriétaire ou admin de l’espace de travail | oui | oui | oui | oui |
| Membre | oui | oui | oui | non |
| Lecteur, ou tout autre rôle | oui | oui | non | non |
| Clé avec **Read & write** (portée `admin`) | oui | sur les plans payants | oui | oui |
| Clé avec **Read** (portée `read`) | oui | sur les plans payants | non | non |

Une action refusée répond `403` `forbidden` avec `details.reason` `role`, et `details.required` nomme le rôle nécessaire : `member` pour créer ou modifier un bin, `admin` pour en supprimer ou en vider un. Pour une clé, les deux signifient **Read & write** (la portée `admin`). La console de compte crée des clés **Read** et **Read & write**, et une clé de toute autre portée, comme `write`, est traitée comme **Read**.

Request Bins sert des espaces de travail entiers. Un siège invité, ou une clé limitée à un projet, est refusé sur chaque route avec `403` `project_confined`.

Un espace de travail dispose de Request Bins dès qu’un propriétaire ou un admin a ouvert la console, ou l’a ajouté depuis **Add a product**. D’ici là, les autres membres sont refusés avec `403` `product_not_enabled`. Les clés ne sont pas concernées.

## Plans et limites {#limits}

| Clé de `ceilings` | Description | Free | Starter | Pro | Custom |
| --- | --- | --- | --- | --- | --- |
| `max_bins` | Bins simultanés | 1 | 5 | 25 | 250 |
| `monthly_requests` | Requêtes enregistrées par mois | 1,000 | 25,000 | 250,000 | 5,000,000 |
| `bin_share_pct` | La part maximale des requêtes du mois qu’un seul bin peut utiliser | 100 % | 50 % | 40 % | 25 % |
| `retention_days` | Durée de conservation d’une requête | 1 jour | 7 jours | 30 jours | 90 jours |
| `bin_ttl_minutes` | Durée de vie par défaut d’un nouveau bin | 24 heures | jusqu’à suppression | jusqu’à suppression | jusqu’à suppression |
| `bin_ttl_max_minutes` | Durée de vie maximale que vous pouvez fixer | 24 heures | 7 jours | 30 jours | aucune limite de plan ; le maximum de l’API est d’un an |
| `read_api` | Lecture des requêtes capturées avec une clé | non | oui | oui | oui |
| `bin_max_sources` | Expéditeurs distincts avant la suspension d’un bin | 50 | 200 | 500 | 2,000 |
| `bin_max_browser_posts` | Envois de formulaire depuis un navigateur avant la suspension d’un bin | 3 | 5 | 5 | 10 |
| `forwarding` | [Transfert](#forwarding) de chaque requête vers votre propre serveur | non | oui | oui | oui |
| `forward_max_body_bytes` | Le plus grand corps que porte un transfert | — | 256 KiB | 1 MiB | 1 MiB |
| `forward_rate_per_min` | Transferts qu’un bin envoie par minute ; au-delà, les suivants attendent leur tour | — | 60 | 300 | 600 |
| `forward_max_attempts` | Tentatives d’envoi d’un transfert | — | 3 | 5 | 5 |

`GET /v1/plan` exprime les durées de vie en minutes, `0` signifiant jusqu’à suppression (`bin_ttl_minutes`) ou aucune limite de plan (`bin_ttl_max_minutes`), `read_api` et `forwarding` sous la forme `1` ou `0`, `forward_max_body_bytes` en octets et les valeurs du transfert à `0` sur Free. Les prix figurent dans la [vue d’ensemble](/docs/product-bins#limits).

- **Le mois** est un mois civil en UTC : `period` dans `GET /v1/usage`. Chaque requête enregistrée par un bin compte. Une requête refusée ou limitée en débit ne compte pas.
- **Au-delà des requêtes du mois**, ou de la part d’un bin (`bin_request_ceiling`), les bins répondent `200` et n’enregistrent rien jusqu’au mois suivant, et `refused_count` le montre. Aucun appel d’API n’est refusé pour autant.
- **La rétention et la durée de vie sont deux horloges distinctes.** Une requête est supprimée quand la rétention du plan arrive à son terme ou quand son bin prend fin, selon ce qui arrive en premier.
- **Avis :** quand l’espace de travail atteint 80 % puis 100 % des requêtes du mois, il en est averti par e-mail, envoyé au propriétaire de l’espace de travail sauf si vous choisissez une autre adresse, et par un webhook avec le type d’événement `bind.quota.threshold_reached` si vous en configurez un. Les deux se trouvent sous **Notifications** dans votre console de compte.
- **Tant qu’un paiement est en retard,** la création et la modification de bins sont refusées avec `402` `workspace_frozen`, et les bins continuent d’enregistrer. Si le délai de grâce prend fin, l’espace de travail est suspendu : les mêmes refus arrivent sous la forme `402` `workspace_suspended`, et les bins répondent `200` et n’enregistrent rien. La suppression et la lecture fonctionnent toujours, et rien n’est supprimé.
- **Sur un plan plus petit,** les bins au-delà de son `max_bins` sont mis en attente, les plus récents d’abord, avec [`plan_downgrade`](#suspension), et reviennent, les plus anciens d’abord, dès que le plan les autorise.

## Erreurs {#errors}

Les erreurs de l’API suivent le format décrit dans [Erreurs](/docs/errors), avec les codes qu’Inboxes envoie dans les mêmes situations :

| Statut | `code` | Quand |
| --- | --- | --- |
| `400` | `bad_request` | Un corps JSON qui n’est pas de l’UTF-8 valide. |
| `401` | `unauthorized` | Aucun justificatif d’identité, un justificatif révoqué, ou une connexion à la console qui a pris fin ; `details.reason` précise lequel. |
| `401` | `invalid_credential` | Une clé qui ne se vérifie pas, a expiré, ou a été créée pour un autre produit. |
| `402` | `quota_exceeded` | Création d’un bin alors que tous les bins du plan sont utilisés. |
| `402` | `not_entitled` | Sur Free : lecture des requêtes capturées avec une clé (`details.feature` `read_api`), ou définition d’une URL de transfert ou envoi d’un test (`forwarding`). |
| `402` | `workspace_frozen`, `workspace_suspended` | Création ou modification d’un bin pendant un retard de paiement, ou après l’arrêt du service. |
| `403` | `forbidden` | `details.reason` vaut `role`, `project_confined`, `product_not_enabled`, `csrf` ou `no_workspace`. |
| `404` | `not_found` | Bin ou requête inexistant dans votre espace de travail, ou supprimé, ou expiré ; `details.reason` vaut `bin` ou `request`. |
| `405` | `method_not_allowed` | Le chemin existe, mais pas pour cette méthode. |
| `413` | `payload_too_large` | Un corps de requête de plus de 2 MiB. |
| `422` | `validation_error` | Un paramètre ou un champ n’a pas passé la validation. Un caractère NUL dans le chemin, la query string ou un corps JSON donne le type d’entrée `bins.nul_character`, une URL de transfert vers laquelle un bin refuse de transférer donne `bins.forward_target` ([Transfert](#forwarding)), et une recherche dont les éléments se contredisent donne `bins.search_conflict` ([Requêtes capturées](#requests)). |
| `429` | `rate_limited` | Plus de 10 envois de test vers un même bin en une minute ; `details.retry_after` indique quand réessayer. |
| `500` | `internal_error` | Une panne de notre côté. |
| `503` | `unavailable` | Définition d’une URL de transfert ou envoi d’un test alors que le transfert est désactivé pour tout le service (`details.reason` `forwarding_disabled`), ou un test qui n’a pas été pris en charge pour l’envoi dans les 3 secondes, si bien que rien n’a été envoyé (`forwarder_unavailable`). |

L’API n’envoie aucun `409`, et un `429` uniquement pour les envois de test.

## Étapes suivantes {#next-steps}

- [Démarrage rapide](/docs/product-bins/quickstart) — créer un bin et lire ce qu’il a enregistré.
- [Transfert](/docs/product-bins/forwarding) — ce qu’envoie un transfert, les réessais, les limites et d’où viennent les transferts.
- [API Request Bins](/docs/reference/bins) — chaque opération, avec la requête en curl, TypeScript, Python ou Go.
- [Erreurs](/docs/errors) — le format d’erreur, chaque clé de `details` et une façon de les traiter.
- [Vue d’ensemble du produit](/docs/product-bins) — les prix, et ce que Request Bins ne fait pas.
