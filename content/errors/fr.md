---
title: "Erreurs"
description: "Le format des erreurs, les codes d’erreur qu’envoient les API Webhooks, Inboxes et Request Bins, et la façon de traiter chacun."
publishedAt: 2026-05-20
updatedAt: 2026-10-30
kind: concept
---

# Erreurs

Chaque réponse d’erreur des API Webhooks, Inboxes et Request Bins utilise le même format JSON. Pour traiter chaque cas, basez-vous sur `error.code`, ou sur `error.next_code` quand une erreur en porte un. N’analysez pas `message`, et ne décidez pas d’après le statut seul : un même statut peut porter plusieurs codes, et sur chaque API, `402` en porte quatre.

> **Mis à jour le 2026-10-16.** Dans Webhooks, un nom de header personnalisé qui est un token HTTP valide suivi d’un saut de ligne final est désormais refusé comme tout autre nom qui n’est pas un token HTTP valide : `webhooks.custom_header_name_invalid`, avec le `msg` de cette règle et sans `params` ([Validation des requêtes](#codes-validation)). Auparavant, le saut de ligne passait la vérification du token et le nom était refusé comme caractère de contrôle, avec `params.header` : en tant que `webhooks.custom_header_control_character` à partir du 2026-10-15, et en tant que `value_error` avant cela. La requête reste un `422` `validation_error`, et rien d’autre n’a changé.
>
> **Mis à jour le 2026-10-15.** Avant le lancement de la v1, tous les renommages en cours sur Inboxes et Webhooks ont abouti : une erreur qui portait un `next_code` porte désormais ce code, avec le statut de ce code, et aucune des deux API n’envoie plus `next_code`.
>
> - Une requête qui échoue à la validation est `validation_error` sur les deux API, toujours un `422`. Sur Inboxes, c’était `invalid_request` ; sur Webhooks, un champ que l’API vérifie elle-même était `unprocessable`. Sur les deux, `details` est `{"errors": [...]}` ; sur Webhooks, c’était une simple liste ([Validation des requêtes](#codes-validation)).
> - Chaque `500` est `internal_error` sur les deux API (sur Webhooks, c’était `internal`).
> - Sur Inboxes, une clé API ou un token que l’API ne reconnaît pas ou ne peut pas vérifier est `invalid_credential`, toujours un `401` (c’était `unauthorized`). Un justificatif d’identité absent ou révoqué, ou une session de connexion terminée, reste `unauthorized`, avec un `details.reason`.
> - Sur Inboxes, un statut sans code propre porte le code de ce statut, comme `bad_request` pour un `400` (c’était `error`).
> - Sur Webhooks, `plan_violation` a disparu. La limite d’endpoints est `quota_exceeded` (`402`, `details.reason` `allocation`), un `max_attempts` au-dessus du plafond du plan est un `422` `validation_error`, et une source RabbitMQ sur un plan inférieur à Pro, ou la désactivation de la vérification des endpoints sur un plan qui l’exige (aucun plan ne l’exige aujourd’hui), est `not_entitled` (`402`).
> - Sur Webhooks, un rejeu en masse dont le `from` est postérieur au `to` est un `422` `validation_error` avec une entrée sur `["body", "to"]`, et non plus un `409` `conflict`.
> - Les règles propres à Webhooks sur les headers personnalisés, les délais de `retry_schedule`, les champs de broker d’une source RabbitMQ et les noms de plan indiquent leur propre `type` d’entrée au lieu de `value_error` ; `loc`, `msg` et `params` sont inchangés ([Validation des requêtes](#codes-validation)).
> - Sur Inboxes, un justificatif limité à certains projets est refusé avec `details.reason` `project_confined` (c’était `project`) ([Ce que contient `details`](#details)).
> - Sur Inboxes, `details` ne porte que les clés que liste cette page. `quota_exceeded` n’envoie plus `max_inboxes`, `max_http_bins` ni `monthly_messages` (lisez `metric`, `limit`, `current` et `period`), le `not_entitled` de l’API de lecture n’envoie plus `plan` et le `rate_limited` par boîte n’envoie plus `inbox_id`.
>
> Chaque `message` est inchangé, de même que chaque statut, sauf ceux des deux refus de Webhooks devenus un `422`. Ces changements ont été faits avant le lancement de la v1 : ils n’ont donc pas bénéficié de la période de 12 mois que décrit [Quand un code est renommé](#renames) ; cette section fait correspondre chaque ancienne graphie à la nouvelle.
>
> **Mis à jour le 2026-10-05.** Les corps d’erreur ont gagné des champs et n’en ont perdu aucun : `request_id` (la même valeur que le header `X-Request-ID`), un `reason` et des valeurs nommées dans `details` sur bien plus d’erreurs, `params` sur les entrées de validation qui ont une borne numérique et `next_code` sur une erreur dont le code est en cours de renommage. Chaque statut, `code` et `message` est inchangé. Sur Webhooks, un `conflict` nomme le conflit dans `details.reason`, le `quota_exceeded` mensuel nomme son `metric`, son `limit`, son `current` et son `period`, chaque `413` nomme son `limit` et `plan_violation` porte le `next_code` qu’il deviendra, avec les `details` de ce code ([Quand un code est renommé](#renames)). [Le format](#shape) décrit chaque champ.
>
> **Corrigé le 2026-10-05.** Des versions antérieures de cette page listaient des codes, des statuts et des champs que les API n’ont jamais envoyés, parmi lesquels `validation_failed` (400), `rate_limit_exceeded`, `quota_exceeded` en tant que 429 et `fields`. Du code qui teste ces valeurs n’a jamais trouvé de correspondance. Ces versions promettaient aussi un `request_id` dans chaque corps avant que les API n’en envoient un ; les corps d’erreur le portent désormais, tous depuis le 2026-10-06 ([L’identifiant de requête](#request-id)). [Codes que cette page listait](#earlier-versions) fait correspondre chacun à ce que l’API envoie réellement.

## Le format {#shape}

Une clé en lecture seule qui tente de créer une boîte sur Inboxes, ou un endpoint sur Webhooks, reçoit cette réponse des deux API (seul le `request_id` diffère) :

```json
{
  "error": {
    "code": "forbidden",
    "message": "admin scope required",
    "details": {
      "reason": "scope",
      "required": "admin"
    },
    "request_id": "5f0c2e9a8b7d4c31a6e4f2b1d9c8e7a6"
  }
}
```

Request Bins refuse la même clé en lecture seule avec le même code et le même statut, mais ses `details` nomment le rôle dont l’action a besoin plutôt qu’une portée : `"reason": "role"` et `"required": "member"`. Une clé a ce rôle avec la portée `admin`, **Read & write** dans la console de compte ([Ce que contient `details`](#details)).

Jusqu’à cinq champs. `code`, `message` et `request_id` figurent dans chaque corps d’erreur envoyé par les API, et `details` et `next_code` apparaissent quand ils ont quelque chose à dire :

| Champ | Toujours présent | Description |
|---|---|---|
| `code` | Oui | Chaîne stable, lisible par une machine. Basez-vous sur elle, ou sur `next_code` quand il est présent. |
| `message` | Oui | Texte en anglais pour les logs et les tickets de support. Non localisé, et pas destiné à une interface pour utilisateurs finaux. |
| `details` | Non | Contexte structuré : un `reason` qui précise le code, et les valeurs qui vont avec, comme l’`id` introuvable. Sur une erreur de validation, les données en échec. Son format dépend du code ; sur une erreur de validation, c’est `{"errors": [...]}`, une liste d’entrées. Voir [Ce que contient `details`](#details). |
| `request_id` | Oui | L’identifiant de cette requête, la même valeur que le header de réponse `X-Request-ID`. Journalisez-le et citez-le au support ; ne fondez jamais de logique dessus. Voir [L’identifiant de requête](#request-id). |
| `next_code` | Non | Envoyé seulement pendant qu’un code est renommé : le code que portera cette erreur une fois le renommage effectif. Préférez-le à `code`. Aucun code n’est en cours de renommage aujourd’hui, donc aucune API ne l’envoie. Voir [Quand un code est renommé](#renames). |

De nouveaux champs peuvent être ajoutés au membre `error`, comme à toute réponse ; ignorez ceux que vous n’utilisez pas ([Politique de versionnage](/docs/versioning#forward-compat)).

### Ce que contient `details` {#details}

Traitez chaque clé de `details` comme facultative : lisez celles dont vous avez besoin et ignorez le reste. Quand il a un `reason`, c’est une chaîne machine stable qui précise le code : pourquoi un `forbidden` a été refusé, ou quel type de chose un `not_found` n’a pas trouvé. À côté se trouvent les valeurs dont cette raison a besoin, sous des noms fixes. Certains codes portent des valeurs sans raison, et beaucoup d’erreurs ne portent aucun `details`. Comme `code`, `details.reason` est une chaîne ouverte, pas une énumération : les nouvelles raisons et les nouveaux codes sont des [changements additifs](/docs/versioning#additive), gardez donc une branche par défaut pour les deux. Le tableau liste ce que vous pouvez rencontrer en appelant les API aujourd’hui. Dans sa colonne **API**, **Les deux** désigne Webhooks et Inboxes, et Request Bins a ses propres lignes.

| `code` | API | `details.reason` | Autres clés dans `details` |
|---|---|---|---|
| `unauthorized` | Les deux | `missing` : aucun justificatif n’a été envoyé. `revoked` : la clé ou la session a été révoquée. `invalid` : sur Inboxes, une session de connexion qui n’a pas pu être vérifiée, généralement parce qu’elle a expiré ; sur Webhooks, un événement entrant vers `POST /v1/ingest/{source_id}` dont la signature ne se vérifie pas. `no_workspace`, sur Inboxes uniquement : le justificatif n’est rattaché à aucun espace de travail. | — |
| `unauthorized` | Request Bins | `missing` : aucun justificatif n’a été envoyé. `revoked` : la clé ou la session a été révoquée. `invalid` : une session de connexion qui n’a pas pu être vérifiée, généralement parce qu’elle a expiré. `no_workspace` : la session de connexion n’est rattachée à aucun espace de travail. | — |
| `forbidden` | Les deux | `scope` : la portée du justificatif ne le permet pas. `project_confined` : un justificatif limité à certains projets, utilisé sur une route qui répond pour tout l’espace de travail ; Inboxes n’accepte pas encore les justificatifs limités à des projets, et envoie donc cette raison sur toutes les routes. `csrf` : une session de navigateur a envoyé une écriture sans le header `X-CSRF`. `operator` : la route, ou un champ de la requête, est réservé aux opérateurs de la plateforme. | `required`, sur la plupart des refus `scope` : la portée qui aurait été autorisée (`admin` sur Inboxes ; `admin`, `read` ou `publish` sur Webhooks) |
| `forbidden` | Webhooks | `role` : votre rôle, dans l’espace de travail ou sur le projet de la ressource sur laquelle vous agissez, est trop bas. `project` : le justificatif, ou la personne qui l’utilise, n’a pas accès au projet que nomme la requête. `product_not_enabled` : votre accès n’inclut pas Webhooks. `not_provisioned` : l’espace de travail n’est pas encore configuré pour Webhooks. | `required`, sur `role` : le rôle le plus bas autorisé (`admin`) |
| `forbidden` | Request Bins | `role` : votre rôle, ou la portée de votre clé, ne le permet pas. `project_confined` : un siège invité, ou une clé limitée à un projet ; Request Bins sert des espaces de travail entiers, et envoie donc cette raison sur toutes les routes. `product_not_enabled` : votre espace de travail n’a pas ajouté Request Bins, ou votre connexion ne l’inclut pas. `csrf` : une session de navigateur a envoyé une écriture sans le header `X-CSRF`. `no_workspace` : le justificatif n’est rattaché à aucun espace de travail, comme un token de service. | `required`, sur `role` : `member` pour créer ou modifier un bin, `admin` pour en supprimer ou en vider un. Pour une clé, les deux signifient la portée `admin` (**Read & write**). |
| `not_found` | Les deux | Le type de ressource. Inboxes : `inbox`, `message`, `workspace`. Webhooks : `endpoint`, `source`, `event`, `delivery`, `capture`, `event_type`, `operational_endpoint`, `project`, `workspace`, `user` et `default_project` (une écriture qui ne nomme aucun projet, dans un espace de travail qui n’en a pas encore). | `id` : l’identifiant demandé. Absent sur `user` et `default_project`, où vous n’en avez nommé aucun, et sur un chemin qui n’existe pas du tout. |
| `not_found` | Request Bins | Le type de ressource : `bin` ou `request`. Pour un bin supprimé ou expiré, c’est `bin`. | `id` : l’identifiant demandé. Absent sur un chemin qui n’existe pas du tout. |
| `bad_request` | Webhooks | `project_required` : une écriture qui ne nomme aucun projet, depuis un justificatif qui peut en atteindre plusieurs. | `projects` : les projets que le justificatif peut atteindre |
| `conflict` | Webhooks | Le conflit en cause, comme `event_type_exists` ou `idempotency_key_reuse`. [Conflits](#codes-state) liste chaque raison et quand elle est envoyée. | Les valeurs dont cette raison a besoin, comme l’`id` de l’endpoint, de la livraison ou du projet concerné par le conflit ; [Conflits](#codes-state) les liste par raison |
| `quota_exceeded` | Les deux | `allocation` : le plafond d’un plan sur un nombre d’éléments (Inboxes : adresses ; Webhooks : endpoints). `period` : le plafond mensuel (Inboxes : messages ; Webhooks : livraisons). | `metric` (`inboxes` ou `messages` sur Inboxes ; `endpoints` ou `deliveries` sur Webhooks) et son `limit` ; `current` sur `allocation`, et sur un `period` de Webhooks (les livraisons utilisées avant la publication refusée) quand le décompte a pu être lu ; `period` sur `period` : le mois sur Inboxes (`YYYY-MM`), le premier jour du cycle de facturation sur Webhooks (`YYYY-MM-DD`). Une publication est refusée quand ses livraisons feraient passer le décompte au-delà de `limit`, donc sur Webhooks, `current` peut être inférieur à `limit`. |
| `quota_exceeded` | Request Bins | `allocation` : le plafond du plan sur les bins, sur `POST /v1/bins`. Jamais `period` : au-delà des requêtes du mois, les bins répondent à leurs expéditeurs et n’enregistrent rien, et aucun appel d’API n’est refusé. | `metric` (`bins`), son `limit` et `current` |
| `not_entitled` | Les deux | — | `feature` : `read_api` ou `optional_phrase_gate` sur Inboxes ; `rabbitmq_sources` ou `optional_endpoint_verification` sur Webhooks. Webhooks envoie `optional_endpoint_verification` pour la désactivation de la vérification des endpoints sur un plan qui l’exige ; aucun plan ne l’exige aujourd’hui. |
| `not_entitled` | Request Bins | — | `feature` : `read_api`, la lecture des requêtes capturées avec une clé API sur le plan Free ; `forwarding`, la définition d’une URL de transfert ou l’envoi d’un test sur le plan Free |
| `payload_too_large` | Les deux | — | `limit` en octets, sur chaque `413`. Inboxes envoie aussi `size` quand l’API a mesuré le corps. |
| `payload_too_large` | Request Bins | — | `limit` en octets, sur chaque `413` |
| `unknown_event_type` | Webhooks | — | `event_type` : le nom qui n’est pas enregistré |
| `invalid_payload` | Webhooks | `payload` : le payload ne respecte pas le schéma de son type d’événement. `schema_invalid` : un schéma que vous enregistrez n’est pas un JSON Schema valide. | Sur `payload` : `errors`, jusqu’à 20 entrées `{path, keyword, params}` (ci-dessous), et `total`, le nombre d’entrées avant cette coupe (la longueur de la liste quand rien n’a été coupé). Sur `schema_invalid` : `path`, un JSON Pointer dans le schéma, là où il a échoué. |
| `schema_too_large` | Webhooks | `bytes`, `depth`, `members`, `enum_values` ou `patterns` : la borne que le schéma a dépassée | `limit` ; plus `size` sur `bytes` (tous deux en octets) |
| `schema_pattern_unsafe` | Webhooks | `too_long`, `does_not_compile`, `empty_repeat`, `nested_quantifier`, `ambiguous_alternation` ou `too_complex` : la règle que le motif a enfreinte | `pattern` : le motif en entier, même si `message` raccourcit un motif long ; `limit` (en caractères) sur `too_long` |
| `schema_ref_unsupported` | Webhooks | — | `ref` : le `$ref` distant que l’API ne résoudra pas |
| `provider_secret_required` | Webhooks | — | `provider` : `stripe`, `github` ou `rabbitmq` |
| `broker_not_allowed` | Webhooks | Aucune pour votre broker, quelle que soit la règle qui l’a refusé (`not_system_broker` n’est envoyé qu’à l’espace de travail de la plateforme elle-même) | `host` : le broker, sous la forme `host:port` |
| `rate_limited` | Les deux | `inbox_rate` (Inboxes) : la limite par minute d’une boîte. Webhooks n’envoie aucune raison. | `retry_after` en secondes, le même nombre que le header `Retry-After` (les deux API). Sur le `inbox_rate` d’Inboxes, aussi `rate_per_min`. |
| `rate_limited` | Request Bins | — | `retry_after` : le nombre de secondes avant que le prochain envoi de test du bin soit autorisé |
| `unavailable` | Inboxes | `ingest_disabled` : l’acceptation des messages est désactivée | — |
| `unavailable` | Request Bins | `forwarding_disabled` : le transfert est désactivé pour tout le service. `forwarder_unavailable` : un test n’a pas été pris en charge pour l’envoi dans les 3 secondes, et rien n’a donc été envoyé. | — |

Sur `invalid_payload`, chaque entrée de `details.errors` indique ce qui a échoué et où. `path` est un JSON Pointer vers la valeur en échec : `""` désigne le payload lui-même, et pour un membre manquant ou inattendu, il pointe vers l’objet qui devrait ou ne devrait pas le contenir. `keyword` est le mot-clé JSON Schema qui a échoué (`required`, `type`, `enum`, `const`, `minimum`, `maximum`, `minLength`, `maxLength`, `minItems`, `maxItems`, `pattern`, `format` ou `additionalProperties`), ou `other` pour tout autre mot-clé. `params` contient `property` (le membre manquant ou inattendu, une entrée pour chacun), `count` (une borne de longueur ou de nombre d’éléments), `limit` (la borne d’un `minimum` ou d’un `maximum`) ou `type` (le seul type que la valeur aurait dû avoir), et il est vide quand rien de cela ne s’applique, comme sur `enum` ou `pattern`, ou sur un `type` qui en autorise plusieurs. Les entrées ne portent jamais l’expression régulière, les valeurs autorisées ni la valeur en échec ; `message` décrit tout de même un échec, en anglais.

Les erreurs de validation des requêtes (`validation_error`) ne figurent pas dans le tableau : sur chaque API, leur `details` est `{"errors": [...]}`, une liste d’entrées de validation, chacune avec `loc`, `type` et `msg`, un format différent de celui d’`invalid_payload`. Voir [Validation des requêtes](#codes-validation).

### L’identifiant de requête {#request-id}

`error.request_id` a la même valeur que le header `X-Request-ID` de chaque réponse envoyée par une API : l’un ou l’autre identifie donc la requête. Si votre requête envoie un header `X-Request-ID` (jusqu’à 128 lettres, chiffres, `.`, `_` ou `-`), l’API utilise cette valeur comme identifiant de requête ; sinon, elle en crée un. Si vous le définissez, rendez-le unique pour chaque requête, afin que l’identifiant désigne un seul appel. Certaines réponses viennent de la couche edge placée devant les API plutôt que d’une API : un `502` ou un `504`, par exemple, ou un `413` pour un corps trop volumineux pour atteindre l’API. Celles-ci ne portent ni le corps d’erreur de l’API ni `X-Request-ID`. Lisez d’abord le corps, puis rabattez-vous sur le header, comme le fait le [modèle de traitement](#pattern), et attendez-vous à ce que les deux manquent sur ces réponses. Ce qu’il faut faire de l’identifiant est décrit sous [Signaler des bugs](#bugs).

## Familles de codes de statut {#families}

| Famille de statuts | Sens de la famille |
|---|---|
| `200`/`201`/`202`/`204` | Succès |
| `400` | La requête n’a pas pu être lue telle qu’envoyée |
| `401` | Aucun justificatif utilisable : aucun n’a été envoyé, ou il a été révoqué. Inboxes et Request Bins répondent aussi `401`, avec `invalid_credential`, pour une clé que ces API ne reconnaissent pas ou ne peuvent pas vérifier, et Webhooks répond `401`, avec `unauthorized`, pour un événement entrant dont la signature ne se vérifie pas |
| `402` | Votre plan ou votre état de facturation bloque la requête : un quota, une fonctionnalité que votre plan n’inclut pas ou un espace de travail gelé ou suspendu |
| `403` | Non autorisé. Webhooks répond aussi `403`, avec `invalid_credential`, pour un justificatif que l’API ne reconnaît pas |
| `404` | La ressource n’existe pas *ou* l’appelant ne peut pas la voir (indiscernables, à dessein) |
| `405` | Le chemin existe, mais pas pour cette méthode |
| `409` | Conflit avec l’état existant, y compris une `Idempotency-Key` réutilisée avec un corps différent |
| `413` | Le corps est trop volumineux |
| `422` | La requête a pu être analysée, mais a échoué à la validation |
| `429` | Limité en débit |
| `5xx` | Problème côté serveur |

`429` et `5xx` sont les seules familles pour lesquelles renvoyer la même requête peut réussir. Pour tout autre `4xx`, le code vous dit quoi changer.

## Codes d’erreur {#codes}

Les deux API partagent la plupart des codes et, depuis la mise à jour signalée en haut de cette page, expriment de la même façon presque toutes les situations qu’elles ont en commun. Deux diffèrent : `invalid_credential` est un `401` sur Inboxes et un `403` sur Webhooks, et une session de connexion expirée est `unauthorized` (`details.reason` `invalid`) sur Inboxes, mais `invalid_credential` sur Webhooks. La colonne **API** indique quelle API envoie chaque code.

Request Bins envoie les mêmes codes qu’Inboxes dans les mêmes situations, ces deux-là compris. Dans la colonne **API**, **Toutes** désigne les trois API, **Les deux** désigne Webhooks et Inboxes, et une ligne marquée **Request Bins** ne concerne que cette API.

### Authentification et autorisation {#codes-auth}

| `code` | Statut | API | Description |
|---|---|---|---|
| `unauthorized` | 401 | Toutes | Aucun justificatif n’a été envoyé, ou il a été révoqué. Sur Inboxes et Request Bins, également une session de connexion terminée ou qui n’a pas pu être vérifiée ; chaque `unauthorized` que ces API envoient porte un `details.reason`. Sur Webhooks, également un événement entrant vers `POST /v1/ingest/{source_id}` dont la signature ne se vérifie pas (`details.reason` `invalid`) ; chaque `401` de Webhooks porte un `details.reason` ([Ce que contient `details`](#details)). |
| `invalid_credential` | 401 sur Inboxes et Request Bins, 403 sur Webhooks | Toutes | Une clé API ou un token que l’API ne reconnaît pas ou ne peut pas vérifier. Remplacez ce justificatif ; renvoyer le même ne fonctionnera pas. Sur Webhooks, cela inclut une session de connexion expirée : reconnectez-vous. |
| `forbidden` | 403 | Toutes | Le justificatif est valide, mais ne peut pas faire cela : une portée ou un rôle manquant, une clé limitée à certains projets utilisée en dehors de ceux-ci ou un produit qui n’est pas activé pour votre espace de travail. `details.reason` indique lequel de ces cas s’applique. |

`invalid_credential` est un `403` sur l’API Webhooks et un `401` sur Inboxes et Request Bins, et chacun le restera : basez-vous sur le code, pas sur le statut. Voir [Authentification](/docs/authentication) pour le format des requêtes.

### Validation des requêtes {#codes-validation}

| `code` | Statut | API | Description |
|---|---|---|---|
| `validation_error` | 422 | Toutes | Le corps, la query ou le chemin a échoué à la validation, ou, sur Webhooks, une règle que l’API vérifie elle-même a refusé un champ. `details` est `{"errors": [...]}`, une liste d’entrées. |
| `bad_request` | 400 | Toutes | La requête ne peut pas être traitée telle qu’envoyée. `message` dit pourquoi. Sur Inboxes et Request Bins, un corps que l’API n’a pas pu lire, par exemple un corps qui n’est pas de l’UTF-8 valide. |
| `payload_too_large` | 413 | Toutes | Le corps dépasse la limite de taille. |
| `method_not_allowed` | 405 | Toutes | Le chemin existe, mais pas pour cette méthode. |

Chaque entrée de validation décrit une donnée en échec : `loc` dit où (`["body", "event_type"]`), `type` dit ce qui ne va pas sous une forme lisible par une machine (`missing`, `string_too_long`, `json_invalid`, …) et `msg` le dit en anglais. Quand la règle comporte un nombre, l’entrée le porte aussi dans `params` : `count` pour une longueur (`string_too_short`, `string_too_long`, `too_short`, `too_long`) et `limit` pour une borne (`greater_than`, `greater_than_equal`, `less_than`, `less_than_equal`). Un corps qui n’est pas du JSON valide est aussi une erreur de validation, avec le type `json_invalid` ; sur Inboxes et Request Bins, un corps qui n’est pas de l’UTF-8 valide est plutôt un `400` `bad_request`.

Webhooks envoie aussi ses propres types d’entrée, pour les règles que l’API vérifie elle-même :

- `webhooks.max_attempts_above_plan` : `max_attempts` au-dessus du plafond du plan, sur `POST /v1/endpoints` ou `PATCH /v1/endpoints/{id}` ; `loc` `["body", "max_attempts"]`, avec `params.count`, le plafond.
- `webhooks.url_not_https` : une `url` d’endpoint qui n’est pas en https, sur `POST /v1/endpoints`, `PATCH /v1/endpoints/{id}` ou `POST /v1/operational-endpoints` ; `loc` `["body", "url"]`.
- `webhooks.end_before_start` : un rejeu en masse dont le `to` est antérieur au `from` ; `loc` `["body", "to"]`. Des bornes égales sont autorisées.
- `webhooks.end_not_after_start` : sur une route réservée aux opérateurs de la plateforme, une fenêtre de consommation qui ne se termine pas après son début ; `loc` `["query", "end"]`.
- `webhooks.unknown_delivery_status` : un filtre `status` inconnu sur `GET /v1/deliveries` ; `loc` `["query", "status"]`, avec `params.status`, la valeur envoyée.
- `webhooks.unknown_operational_event_type` : une valeur d’`event_types` qui n’est pas un type d’événement opérationnel, sur `POST /v1/operational-endpoints` ; `loc` `["body", "event_types", <index>]`, une entrée par valeur distincte, à son premier index, avec `params.event_type`, la valeur, et `params.choices`, les types d’événements opérationnels que l’API accepte.

Sur la même route réservée aux opérateurs de la plateforme, une date de fenêtre de consommation qui ne peut pas être analysée donne une entrée `date_parsing` sur `["query", "start"]` ou `["query", "end"]`, une pour chaque date concernée. Un refus issu d’une règle que l’API vérifie elle-même porte au plus 20 entrées.

Les règles propres à Webhooks sur les headers personnalisés, les délais de `retry_schedule` et les champs de broker d’une source RabbitMQ envoient des entrées d’un `type` qui leur est propre, avec les `loc` et `msg` qu’elles ont toujours eus (sauf pour le nom de header que décrit la note du 2026-10-16), et des `params` contenant les valeurs que nomme la règle :

- Plus de 20 headers personnalisés : `too_long`, avec `params.count`, `20`.
- Un nom de header personnalisé qui n’est pas un token HTTP valide : `webhooks.custom_header_name_invalid`, sans `params`.
- Un saut de ligne ou un autre caractère de contrôle dans la valeur d’un header personnalisé : `webhooks.custom_header_control_character`, avec `params.header`, le nom du header.
- Une valeur de header personnalisé de plus de 1024 caractères : `webhooks.custom_header_value_too_long`, avec `params.header` et `params.count`, `1024`.
- Un nom que l’API réserve à ses propres headers de livraison (`Content-Type`, `User-Agent` ou tout nom commençant par `X-Webhook-`) : `webhooks.custom_header_managed`, avec `params.header`.
- Un nom hop-by-hop ou de contrôle de connexion, comme `Host` ou `Connection` : `webhooks.custom_header_forbidden`, avec `params.header`.
- Une valeur de header personnalisé contenant un caractère non ASCII : `webhooks.custom_header_not_ascii`, avec `params.header`.
- Des noms et valeurs de headers personnalisés qui occupent ensemble plus de 8192 octets : `webhooks.custom_headers_too_large`, avec `params.limit`, `8192`.
- Un délai de `retry_schedule` inférieur à 0 ou supérieur à 604800 secondes : `webhooks.retry_delay_out_of_range`, avec `params.limit`, `604800`.
- Une source RabbitMQ créée sans tous ses champs de broker : `webhooks.broker_fields_required`, avec `params.missing`, la liste des champs (parmi `broker_identifier`, `broker_host`, `broker_user`, `broker_exchange` et `broker_topic`) manquants ou vides. Son `loc` est `["body"]`.

Le `loc` des règles sur les headers personnalisés est `["body", "custom_headers"]`, et `params.header` est le nom tel que vous l’avez envoyé ; la valeur d’un header n’est jamais renvoyée. Un nom de plan que l’API ne connaît pas, sur une route réservée aux opérateurs de la plateforme, donne une entrée `enum` sans `params`. Jusqu’à la mise à jour signalée en haut de cette page, toutes ces entrées avaient le type `value_error`.

Inboxes envoie un type d’entrée qui lui est propre : `inboxes.search_conflict`, pour une recherche de messages sur `GET /v1/inboxes/{id}/messages` ou `GET /v1/messages` qui nomme un `header` avec `in` réglé sur `subject`, `from` ou `body`. Son `loc` est `["query", "in"]`, et l’entrée ne porte pas de `params` ([Rechercher des messages](/docs/product-inboxes#search)).

Request Bins en envoie trois :

- `bins.nul_character` : un caractère NUL dans le chemin, la query string ou un corps JSON, que l’API ne peut pas stocker. Son `loc` est `["path"]`, `["query", <name>]` ou `["body"]`, et l’entrée ne porte pas de `params`.
- `bins.forward_target` : une URL de transfert vers laquelle un bin refuse de transférer. Son `loc` est `["body", "forward_url"]`, et `params.reason` indique pourquoi ([Transfert](/docs/product-bins/reference#forwarding)).
- `bins.search_conflict` : une recherche sur `GET /v1/bins/{id}/requests` ou `GET /v1/requests` dont le `header` ou le `field` ne va pas avec son `in`, avec le `loc` `["query", "in"]`, ou qui nomme à la fois un `header` et un `field`, avec le `loc` `["query", "field"]`. L’entrée ne porte pas de `params` ([Requêtes capturées](/docs/product-bins/reference#requests)).

Un libellé Inboxes qui dépasse sa limite d’un caractère :

```json
{
  "error": {
    "code": "validation_error",
    "message": "request validation failed",
    "details": {
      "errors": [
        {
          "loc": ["body", "label"],
          "msg": "String should have at most 200 characters",
          "type": "string_too_long",
          "params": {"count": 200}
        }
      ]
    },
    "request_id": "a3e81f0c5b9d4e2f8c7a6b5d4e3f2a1b"
  }
}
```

Sur Webhooks, la même entrée figure dans la même liste `details.errors`, sous le même code, et Request Bins l’envoie pour un `label` de bin de plus de 200 caractères.

### Codes de l’API Webhooks {#codes-webhooks}

Ces codes concernent les objets propres à l’API Webhooks (types d’événements, schémas, sources, endpoints, livraisons) et sont tous des `422` :

| `code` | Description |
|---|---|
| `unknown_event_type` | Le type d’événement n’est pas dans le catalogue de votre espace de travail, et le catalogue n’accepte que les types enregistrés. |
| `invalid_payload` | Le payload ne correspond pas au schéma enregistré pour son type d’événement (`details.reason` `payload`, avec `details.errors`), ou un schéma que vous enregistrez n’est pas un JSON Schema valide (`schema_invalid`). |
| `schema_too_large` | Un JSON Schema que vous avez enregistré est trop gros ou trop profondément imbriqué. |
| `schema_pattern_unsafe` | Un `pattern` de votre schéma est trop long, ne compile pas ou pourrait prendre trop de temps à s’exécuter. |
| `schema_ref_unsupported` | Votre schéma utilise un `$ref` que l’API ne résout pas. |
| `provider_secret_required` | La rotation d’une source Stripe ou GitHub nécessite le nouveau secret de ce fournisseur, et la rotation d’une source RabbitMQ nécessite le nouveau mot de passe du broker. `details.provider` indique lequel : `stripe`, `github` ou `rabbitmq`. |
| `broker_not_allowed` | Une source RabbitMQ nomme un broker auquel l’API refuse de se connecter. |

### Plan et facturation {#codes-plan}

Ce sont tous des `402`. Réessayer la même requête ne sert jamais à rien : quelqu’un doit changer de plan, régler un paiement, attendre la prochaine période de facturation ou faire de la place dans une allocation, par exemple en libérant une adresse ou en supprimant un endpoint.

| `code` | API | Description |
|---|---|---|
| `quota_exceeded` | Les deux | Au-delà d’une limite du plan : une allocation (Inboxes : adresses ; Webhooks : endpoints) ou un plafond mensuel (Inboxes : messages ; Webhooks : livraisons), pour lequel vous attendez la période suivante ou passez à un plan supérieur. Sur les deux API, `details.reason` indique lequel, et `details` nomme le `metric`, son `limit` et, pour une allocation, le décompte `current`. |
| `quota_exceeded` | Request Bins | Au-delà de la limite de bins du plan, lors de la création d’un bin. `details.reason` est `allocation`, et `details` nomme le `metric` (`bins`), son `limit` et le décompte `current`. La limite mensuelle de requêtes ne refuse jamais un appel d’API : au-delà, les bins répondent à leurs expéditeurs et n’enregistrent rien jusqu’à ce que le [crédit](/docs/product-bins/reference#credit) en achète davantage ou que le mois suivant commence. |
| `not_entitled` | Toutes | La fonctionnalité n’est pas dans votre plan, comme l’API de lecture sur le plan gratuit d’Inboxes, la lecture des requêtes capturées avec une clé API sur le plan Free de Request Bins ou une source RabbitMQ sur un plan inférieur à Pro sur Webhooks. `details.feature` la nomme. |
| `workspace_frozen` | Toutes | Il y a un impayé : les modifications sont donc refusées. Réglez-le dans votre console de compte ; passer à un plan supérieur est aussi refusé tant que vous ne l’avez pas fait. |
| `workspace_suspended` | Toutes | Le délai de grâce qui suit un impayé est terminé et le service s’est arrêté pour cet espace de travail. |

`quota_exceeded` est un `402`, pas un `429`. Une limite de débit se lève d’elle-même en quelques secondes ; un quota, non.

Sur Webhooks, la limite d’endpoints est `quota_exceeded` sur `POST /v1/endpoints`, avec `details.reason` `allocation`, `metric` `endpoints`, `limit` (le plafond du plan) et `current` (les endpoints que compte l’espace de travail). Une source RabbitMQ sur un plan inférieur à Pro est `not_entitled` avec `details.feature` `rabbitmq_sources` : sur `POST /v1/sources`, et sur un `PATCH /v1/sources/{id}` d’une source RabbitMQ dont le corps définit `status` à `enabled` ou définit l’un des champs `broker_identifier`, `broker_host`, `broker_port`, `broker_vhost`, `broker_user`, `broker_exchange`, `broker_topic` ou `broker_queues`, même à la valeur qu’il a déjà. Les autres modifications, comme renommer ou désactiver la source, restent autorisées. Un `max_attempts` au-dessus du plafond du plan n’est pas un `402` : c’est un `422` `validation_error` ([Validation des requêtes](#codes-validation)).

Sur Request Bins, la limite de bins est `quota_exceeded` sur `POST /v1/bins`. Lire les requêtes capturées avec une clé API sur Free donne `not_entitled`, avec `details.feature` `read_api`, sur `GET /v1/bins/{id}/requests`, `GET /v1/requests`, `GET /v1/bins/{id}/paths` et `GET /v1/requests/{id}` ; la console les lit sur tous les plans. Définir une URL de transfert ou envoyer un test sur Free donne aussi `not_entitled`, avec `details.feature` `forwarding`. Tant qu’un espace de travail est gelé ou suspendu, toute écriture sauf une suppression est refusée avec `workspace_frozen` ou `workspace_suspended`, et les lectures restent ouvertes. Les bins continuent d’enregistrer tant que l’espace de travail est gelé et s’arrêtent tant qu’il est suspendu ([Plans et limites](/docs/product-bins/reference#limits)).

### Ressources {#codes-resources}

| `code` | Statut | API | Description |
|---|---|---|---|
| `not_found` | 404 | Toutes | La ressource n’existe pas, ou vous ne pouvez pas la voir. Les deux cas sont volontairement indiscernables. `details.reason` nomme le type de ressource et `details.id` l’identifiant demandé, quand il y en a un ; un chemin qui n’existe pas ne porte pas de `details` ([Ce que contient `details`](#details)). |

### Conflits {#codes-state}

| `code` | Statut | API | Description |
|---|---|---|---|
| `conflict` | 409 | Webhooks | La requête entre en conflit avec l’état existant : un nom déjà pris, ou une `Idempotency-Key` réutilisée avec un corps différent ([Idempotence](/docs/idempotency#conflicts)). `details.reason` indique lequel, d’après le tableau ci-dessous. |

Chaque `details.reason` que peut porter un `conflict`, quand il est envoyé, et les autres clés de `details` :

| `details.reason` | Quand | Autres clés dans `details` |
|---|---|---|
| `event_type_exists` | Un type d’événement de ce nom est déjà enregistré dans la même portée : à l’échelle de l’espace de travail, ou dans le projet que vous avez nommé. | `event_type` : le nom |
| `project_not_empty` | Suppression d’un projet qui contient encore des endpoints ou des sources. Supprimez-les d’abord. | `id` : le projet. `endpoints` et `sources` : combien il en contient |
| `idempotency_key_reuse` | Une `Idempotency-Key` réutilisée avec un corps différent ([Idempotence](/docs/idempotency#webhooks)). L’événement d’origine est maintenu. | `idempotency_key` : la clé |
| `delivery_not_redeliverable` | Relivraison d’une livraison encore en file d’attente ou en cours d’envoi. Seule une livraison `sent`, `failed` ou `dead` peut être relivrée. | `id` : la livraison. `state` : `queued`, `sending`, `sent`, `failed` ou `dead`, ou `missing` si la livraison a été supprimée entre-temps |
| `delivery_exists` | Rejeu d’un événement vers un endpoint qui en a déjà une livraison. Relivrez plutôt cette livraison. | `event_id` et `endpoint_id` |
| `endpoint_not_enabled` | Rejeu d’un événement vers un endpoint désactivé, par vous ou automatiquement après des échecs répétés. | `id` : l’endpoint. `state` : `disabled` (par vous) ou `auto_disabled` (automatiquement) |
| `endpoint_suspended` | Rejeu d’un événement vers un endpoint que nous avons suspendu. | `id` : l’endpoint. `cause` : `abuse`, `non_payment` ou `plan_downgrade` ; la plus grave quand plusieurs s’appliquent, et champ absent quand aucune ne s’applique |
| `endpoint_has_pending_deliveries` | Suppression d’un endpoint qui a encore des livraisons en file d’attente, en cours d’envoi ou en attente d’un réessai. L’endpoint est désactivé même si la suppression a été refusée, si bien qu’aucune nouvelle livraison ne l’atteint ; réessayez la suppression une fois qu’elles sont terminées. | `id` : l’endpoint. `count` : ses livraisons en attente |
| `replay_across_projects` | Rejeu d’un événement vers un endpoint d’un autre projet. | `event_id` et `endpoint_id` |

Un rejeu en masse dont le `from` est postérieur au `to` n’est pas un conflit : c’est un `422` `validation_error` ([Validation des requêtes](#codes-validation)).

### Limites de débit {#codes-rate}

| `code` | Statut | API | Description |
|---|---|---|---|
| `rate_limited` | 429 | Les deux | Trop de requêtes. Si `Retry-After` est défini, attendez ce nombre de secondes et réessayez ; sinon, appliquez un backoff. `details.retry_after` porte le même nombre sur les deux API, et sur Inboxes, une limite par boîte définit aussi `details.reason` à `inbox_rate`, avec `details.rate_per_min`. |
| `rate_limited` | 429 | Request Bins | Plus de 10 envois de test vers l’URL de transfert d’un même bin en une minute. `details.retry_after` indique dans combien de secondes le suivant est autorisé. |

L’API de Request Bins n’envoie `rate_limited` que pour les envois de test ([Tester une URL de transfert](/docs/product-bins/reference#forward-test)). Ses URL de bin limitent le rythme d’envoi des expéditeurs et répondent à un expéditeur qui dépasse la limite par un `429` et `Retry-After`, pas dans ce format JSON ([Ce que répond une URL de bin](/docs/product-bins/reference#edge-answers)).

### Serveur {#codes-server}

| `code` | Statut | API | Description |
|---|---|---|---|
| `internal_error` | 500 | Toutes | Quelque chose a cassé de notre côté. Réessayer les requêtes idempotentes est sans risque. |
| `unavailable` | 503 | Inboxes | Impossible de servir la requête pour le moment : l’acceptation des messages est désactivée, et `details.reason` est `ingest_disabled`. Réessayez avec un backoff. |
| `unavailable` | 503 | Request Bins | Le transfert ne peut pas accepter la requête : définition d’une URL de transfert ou envoi d’un test alors que le transfert est désactivé pour tout le service (`details.reason` `forwarding_disabled`), ou un test qui n’a pas été pris en charge pour l’envoi dans les 3 secondes, si bien que rien n’a été envoyé (`forwarder_unavailable`). Réessayez plus tard. |

Un `502` ou un `504` venant de la couche edge placée devant les API peut arriver sans aucun corps JSON. Traitez un `5xx` que vous ne pouvez pas analyser comme réessayable.

### Résultats des tests et des vérifications {#failure-reason}

Tester ou vérifier un endpoint Webhooks (`POST /v1/endpoints/{id}/test`, `POST /v1/endpoints/{id}/verify`) lui envoie une requête et répond `200` avec le résultat, que cette requête ait réussi ou non : un échec à cet endroit n’est donc pas une réponse d’erreur. `delivered` sur un test, ou `verified` sur une vérification, indique si cela a fonctionné. En cas d’échec, `error` le décrit en anglais et `failure_reason` le nomme sous forme de chaîne machine stable :

| `failure_reason` | Ce qui s’est passé |
|---|---|
| `http_status` | L’endpoint a répondu avec un statut hors `2xx` ; `status_code` indique lequel. |
| `timeout` | Aucune réponse avant le timeout de l’endpoint. |
| `tls_failed` | La négociation TLS a échoué, le plus souvent parce que le certificat ne se vérifie pas. |
| `dns_failed` | L’hôte ne se résout pas. |
| `connection_failed` | Tout autre échec de connexion, comme une connexion refusée, réinitialisée ou injoignable. |
| `blocked_address` | L’hôte se résout en une adresse privée ou, à un autre titre, non publique, vers laquelle Webhooks n’envoie jamais rien. |
| `challenge_not_echoed` | Vérification uniquement : l’endpoint a répondu `2xx` sans le token du challenge dans son corps. |
| `url_changed` | Vérification uniquement : l’URL de l’endpoint a changé pendant que le challenge était en cours. Vérifiez à nouveau. |

`failure_reason` vaut `null` en cas de succès, ainsi que sur un échec qu’aucune de ces valeurs ne décrit, où `error` est la seule description. Comme `code`, c’est une chaîne ouverte, pas une énumération : prévoyez un cas par défaut pour une valeur que vous ne connaissez pas, et basez-vous sur `failure_reason` plutôt que d’analyser `error`.

## Quand un code est renommé {#renames}

Inboxes et Webhooks ont terminé leurs renommages le 2026-10-15, avant le lancement de la v1, plutôt qu’au bout de 12 mois. Sur Inboxes, `invalid_request` est désormais `validation_error`, une clé API ou un token que l’API ne reconnaît pas ou ne peut pas vérifier est `invalid_credential` (toujours un `401`), et un statut sans code propre porte le code de ce statut, comme `bad_request` pour un `400`. Sur Webhooks, `internal` est désormais `internal_error`, `unprocessable` est désormais `validation_error`, et `plan_violation` a disparu : chacun de ses refus envoie le code que nommait son `next_code`, avec le statut de ce code. Aucune des deux API n’envoie `next_code` aujourd’hui. Après le lancement de la v1, un renommage est annoncé dans le [changelog](/changelog), et l’ancienne graphie continue d’être envoyée dans `error.code` pendant au moins 12 mois après cela, la même période que celle que la [politique de dépréciation](/docs/versioning#deprecation) accorde à un champ.

Pendant qu’un renommage est en cours, l’erreur porte aussi `next_code` : la graphie qu’aura `code` une fois le renommage effectif. C’est ce champ, et non un header de réponse `Deprecation`, qui vous indique que le code d’une erreur est en cours de renommage.

Basez-vous sur `next_code` quand il est présent, et sur `code` sinon (`error.next_code ?? error.code`). Un handler écrit ainsi n’a besoin d’aucune modification quand un renommage devient effectif : à partir de là, `code` porte la nouvelle graphie, et `next_code` n’est plus envoyé pour ce code. Si vous ne pouvez lire que `code`, par exemple via un SDK qui ne transmet que `code`, acceptez les deux graphies jusqu’à ce que le renommage soit effectif.

Les renommages appliqués le 2026-10-15, avec les refus qui ont changé avec eux :

| API | Situation | Avant | Maintenant |
|---|---|---|---|
| Inboxes | Une requête qui échoue à la validation | `422` `invalid_request`, `next_code` `validation_error` | `422` `validation_error` |
| Inboxes | Une clé API ou un token que l’API ne reconnaît pas, ou qui échoue à la vérification | `401` `unauthorized`, `next_code` `invalid_credential` | `401` `invalid_credential` |
| Inboxes | Un statut sans code propre, comme pour un corps qui n’est pas de l’UTF-8 valide | `error`, `next_code` le code que ce statut a ailleurs | le code de ce statut, comme `400` `bad_request` |
| Inboxes | Un justificatif limité à certains projets | `403` `forbidden`, `details.reason` `project` | `403` `forbidden`, `details.reason` `project_confined` |
| Inboxes | `quota_exceeded`, le `not_entitled` de l’API de lecture et le `rate_limited` par boîte | `details` portait aussi `max_inboxes`, `max_http_bins`, `monthly_messages`, `plan` ou `inbox_id` | `details` ne porte que les clés que liste [Ce que contient `details`](#details) |
| Webhooks | Chaque `500` | `internal`, `next_code` `internal_error` | `internal_error` |
| Webhooks | Un champ que l’API vérifie elle-même (une `url` d’endpoint qui n’est pas en https, un filtre `status` ou un type d’événement opérationnel inconnu, une fenêtre de consommation qui ne peut pas être analysée ou ne se termine pas après son début) | `422` `unprocessable`, `next_code` `validation_error` | `422` `validation_error` |
| Webhooks | La limite d’endpoints (`POST /v1/endpoints`) | `402` `plan_violation`, `next_code` `quota_exceeded` | `402` `quota_exceeded`, `details.reason` `allocation` |
| Webhooks | `max_attempts` au-dessus du plafond du plan (`POST /v1/endpoints`, `PATCH /v1/endpoints/{id}`) | `402` `plan_violation`, `next_code` `validation_error` | `422` `validation_error`, type d’entrée `webhooks.max_attempts_above_plan` |
| Webhooks | Une source RabbitMQ sur un plan inférieur à Pro | `402` `plan_violation`, `next_code` `not_entitled` | `402` `not_entitled`, `details.feature` `rabbitmq_sources` |
| Webhooks | La désactivation de la vérification des endpoints sur un plan qui l’exige (`PATCH /v1/workspace`) ; aucun plan ne l’exige aujourd’hui | `402` `plan_violation`, `next_code` `not_entitled` | `402` `not_entitled`, `details.feature` `optional_endpoint_verification` |
| Webhooks | Un rejeu en masse dont le `from` est postérieur au `to` (`POST /v1/deliveries/replay`) | `409` `conflict`, `details.reason` `replay_window_inverted` | `422` `validation_error`, type d’entrée `webhooks.end_before_start` sur `["body", "to"]` |
| Webhooks | Les règles propres à Webhooks sur les headers personnalisés, `retry_schedule`, les champs de broker et les noms de plan | type d’entrée `value_error` | le type d’entrée propre à la règle ([Validation des requêtes](#codes-validation)) ; `loc`, `msg` et `params` inchangés |
| Webhooks | Toute erreur de validation | `details` : une liste d’entrées | `details` : `{"errors": [...]}`, comme sur Inboxes |

Un handler qui se basait sur `error.next_code ?? error.code` obtient le même code qu’avant dans toutes les situations ci-dessus, sauf le rejeu en masse. Un handler qui lisait `error.details` comme une liste sur une erreur de validation de Webhooks lit désormais `error.details.errors` ; celui qui lisait les clés supprimées du `quota_exceeded` d’Inboxes lit `metric`, `limit`, `current` et `period` ; celui qui testait la raison `project` du `forbidden` d’Inboxes teste `project_confined` ; et celui qui testait le `type` d’entrée `value_error` de Webhooks teste le type propre à la règle.

`unauthorized` n’est pas retiré : il reste le code d’un justificatif absent ou révoqué sur les deux API, d’une session de connexion terminée sur Inboxes et d’un événement entrant dont la signature ne se vérifie pas sur Webhooks.

## Codes que cette page listait {#earlier-versions}

Des versions antérieures de cette page listaient les codes et les champs de gauche. Les API ne les envoyaient pas ; elles envoient ce qui figure à droite. Deux d’entre eux sont depuis devenus réalité, `request_id` dans les corps d’erreur et `internal_error` sur chaque API, et leurs lignes expliquent comment.

| Les versions antérieures listaient | Les API envoient |
|---|---|
| `validation_failed` (400) | `validation_error` (422) |
| `fields` | `details` : `{"errors": [...]}` sur les deux API |
| `request_id` dans chaque corps | Non envoyé tant que ces versions étaient d’actualité : l’identifiant n’était que dans le header de réponse `X-Request-ID`. Depuis les mises à jour signalées en haut de cette page, chaque corps d’erreur envoyé par les API le porte aussi, dans `error.request_id`, avec la même valeur que le header ([L’identifiant de requête](#request-id)). |
| `malformed_json` (400), `unsupported_content_type` (415) | `validation_error` (422) |
| `request_too_large` | `payload_too_large` (413) |
| `no_credentials` (401) | `unauthorized` (401) |
| `invalid_credentials`, `expired_credentials` (401) | `invalid_credential` : un `403` sur Webhooks, un `401` sur Inboxes. Une session de connexion expirée est `unauthorized` (401) sur Inboxes |
| `scope_required`, `wrong_project` (403) | `forbidden` (403) ; `details.reason` dit pourquoi (`scope`, `project`, `project_confined`, …), et `details.required` nomme une portée manquante |
| `already_exists`, `state_conflict`, `not_empty`, `idempotency_key_reused` (409) | `conflict` (409) ; `details.reason` dit lequel (`event_type_exists`, `project_not_empty`, `idempotency_key_reuse`, …) |
| `rate_limit_exceeded` | `rate_limited` (429) |
| `quota_exceeded` en tant que 429 | `quota_exceeded` en tant que 402 |
| `internal_error` sur chaque API | `internal_error` sur les deux API depuis le 2026-10-15 ; Webhooks envoyait `internal` auparavant |
| `service_unavailable` (503), `gateway_timeout` (504) | `unavailable` (503) sur Inboxes, quand l’acceptation des messages est désactivée, et sur Request Bins, quand le transfert ne peut pas accepter une requête ; un `502`/`504` de passerelle peut n’avoir aucun corps JSON |

## Modèle de traitement {#pattern}

```ts
async function call(): Promise<Event> {
  const res = await fetch(url, opts)
  if (res.ok) return await res.json()

  // A gateway 502/504 can arrive without a JSON body
  const body = await res.json().catch(() => null)
  const error = body?.error ?? { code: 'error', message: res.statusText }
  // Log this with every error; the header carries it when the body doesn't
  const requestId = error.request_id ?? res.headers.get('X-Request-ID')
  // While a code is being renamed, next_code is what it will become: prefer it
  const code = error.next_code ?? error.code

  // Switch on the code, not the status: one status can carry several codes
  switch (code) {
    case 'rate_limited': {
      const wait = Number(res.headers.get('Retry-After') ?? '1')
      await sleep(wait * 1000)
      return call() // retry
    }
    case 'invalid_credential': // All: a key the API can't accept (403 on Webhooks, 401 on Inboxes and Request Bins)
    case 'unauthorized': // All: no usable credential
      // The credential is missing or bad: replace it rather than retry with it
      throw new CredentialError(error, requestId)
    case 'forbidden': {
      // Optional refinement: why it was refused, and what would have been allowed
      const reason = error.details?.reason // 'scope', 'role', 'project', 'project_confined', 'csrf', …
      const required = error.details?.required // 'admin', 'member', 'read' or 'publish', when sent
      throw new PermissionError(error, requestId, reason, required)
    }
    case 'validation_error': { // All
      const entries = error.details?.errors ?? []
      throw new ValidationError(entries, requestId)
    }
    case 'quota_exceeded':
    case 'not_entitled':
      // Retrying won't help; the plan has to change, or the period has to roll over
      throw new PlanError(error, requestId)
    default:
      // Unknown code, but the family tells us the rough shape
      if (res.status >= 500) {
        // Server-side; safe to retry idempotent ops
        throw new RetryableError(error, requestId)
      }
      throw new TerminalError(error, requestId)
  }
}
```

La règle générale : **basez-vous sur `error.next_code ?? error.code` et, par défaut, sur la famille de statuts**. Les nouveaux codes ajoutés sur des statuts existants ne casseront pas votre code ; votre cas par défaut les traite. `details.reason` précise un cas et ne le remplace jamais : une raison que vous ne reconnaissez pas reçoit le traitement de son code. N’analysez pas `message` ; quand une valeur est destinée à être lue par un programme, comme l’identifiant introuvable ou la limite atteinte, elle se trouve dans `details`. La même règle vaut pour une console ou un SDK construit sur ces API : les [SDK](/docs/product-webhooks/sdks) publiés transmettent `error.code` tel quel, basez-vous donc sur le code que porte l’exception, et acceptez les deux graphies d’un code en cours de renommage.

## Signaler des bugs {#bugs}

Chaque réponse envoyée par une API porte un header `X-Request-ID`, erreurs comprises, et les API laissent le JavaScript du navigateur le lire. Leurs corps d’erreur portent le même identifiant dans `error.request_id`. Quand quelque chose ne va pas de notre côté (5xx, comportement inattendu), l’identifiant de requête est ce qui nous permet de retrouver l’appel dans nos logs. Journalisez-le à côté de chaque erreur et indiquez-le dans vos tickets de support.

Ne partagez pas publiquement les identifiants de requête (ils ne sont pas secrets, mais ils permettent à quiconque les détient de nous interroger sur le trafic de votre compte). Utilisez-les dans des canaux privés (support, tickets depuis la console).

## Étapes suivantes {#next-steps}

- [Conventions](/docs/conventions) — le reste du format requête/réponse.
- [Authentification](/docs/authentication) — les codes d’erreur d’authentification en contexte.
- [Limitation de débit](/docs/rate-limiting) — le fonctionnement de `Retry-After` en détail.
- [Idempotence](/docs/idempotency) — le modèle de réessai sans risque pour les cas 5xx + 429.
- [Politique de versionnage](/docs/versioning) — ce qui compte comme changement cassant, et la période de dépréciation de 12 mois dont bénéficie aussi un renommage de code.
