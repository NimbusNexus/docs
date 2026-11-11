---
title: "Pipelines"
description: "Les étapes d’un pipeline, ses chemins, ses valeurs et ses filtres, les modèles pour démarrer et les plafonds d’une exécution."
publishedAt: 2026-11-06
updatedAt: 2026-11-11
kind: concept
---

# Pipelines

Un pipeline est un document JSON, et cette page décrit son langage. Webhooks et Request Bins exécutent le même langage sur le même moteur : ce que vous apprenez ici s’y applique donc aussi, dans la limite des règles de headers propres à chaque produit. Pour essayer tout cela sans compte, utilisez le [playground](/transforms/playground).

## Le document {#document}

Ce pipeline garde les factures payées de $1,000 ou plus, retire l’e-mail du client et tout numéro de téléphone, ajoute deux champs et un header, et indique que la requête doit porter un bearer token :

```json
{
  "version": 1,
  "steps": [
    { "filter": { "type": "invoice.paid", "data": { "amount": { "$gte": 100000 } } }, "note": "Paid invoices of $1,000 or more" },
    { "drop": ["data.customer.email", "**.phone"] },
    { "set": { "event_type": "{{ type }}", "amount_display": "{{ data.amount | money(data.currency) }}" } },
    { "headers": { "set": { "X-Event-Type": "{{ type }}" } } },
    { "auth": { "type": "bearer", "secret": "sec_…" } }
  ]
}
```

`version` est le format du document, toujours `1` ; ce n’est pas la version du pipeline. Les étapes s’exécutent dans l’ordre où elles sont écrites. Chacune est un objet avec une clé d’étape et, en option, une `note` de 200 caractères au plus, que la console affiche sur l’étape et que rapporte un abandon. Un `filter` peut aussi prendre une `action`.

Une exécution voit une seule requête : un `body`, n’importe quelle valeur JSON ; des `headers` ; et `meta`, en lecture seule. Dans l’API d’exécution, les trois sont ce que vous envoyez. Chaque étape voit le corps tel que la précédente l’a laissé. Les étapes sont numérotées à partir de 0 dans l’API et dans les textes d’erreur, et à partir de 1 dans l’éditeur de la console.

| Étape | Dans la console | Ce qu’elle fait |
|---|---|---|
| `filter` | **Filter** | Ne garde la requête que si elle correspond, ou, avec `"action": "drop"`, l’abandonne si elle correspond. |
| `drop` | **Remove fields** | Retire des champs du corps. |
| `set` | **Set fields** | Ajoute ou remplace des champs. |
| `map` | **Reshape the body** | Remplace le corps par un corps que vous construisez. |
| `headers` | **Headers** | Définit, retire ou renomme des headers. |
| `auth` | **Credential** | Indique que la requête doit porter un bearer token, une authentification basique ou une clé d’API, et nomme l’emplacement d’où vient ce justificatif. |

### `filter` {#step-filter}

Ne garde la requête que si elle correspond ; sinon, l’exécution répond `dropped`. Avec `"action": "drop"`, c’est l’inverse : ce qui correspond est abandonné.

```json
{ "filter": { "data": { "status": "paid", "amount": { "$gte": 100000 } } }, "note": "Paid, $1,000 or more" }
```

- Chaque clé est une condition, et toutes doivent être remplies. Un objet imbriqué se compare par sa forme, comme `data` ici.
- Une valeur simple correspond par égalité JSON : `1` est égal à `1.0`.
- Un tableau correspond s’il est égal à la valeur ou si l’un de ses éléments correspond : `{"data": {"tags": "urgent"}}` est vrai pour `["billing", "urgent"]`, et `{"data": {"items": {"sku": "A-1", "qty": 2}}}` exige un élément qui ait les deux.
- Un champ absent de la requête ne correspond qu’à `{"$exists": false}` et aux négations, comme `$neq`.
- Les opérateurs sont `$eq`, `$neq`, `$gt`, `$gte`, `$lt`, `$lte` (des nombres avec des nombres, du texte avec du texte ; les horodatages ISO se comparent dans l’ordre chronologique), `$in`, `$nin`, `$exists`, `$startsWith`, `$endsWith`, `$contains` (du texte, ou un tableau qui contient la valeur), et `$and`, `$or` et `$not` pour combiner des filtres.
- `$headers`, `$meta` et `$body` testent cette partie de la requête : `{"$headers": {"x-github-event": "push"}}`.

### `drop` {#step-drop}

Retire des champs du corps : une liste de 1 à 50 chemins. `*` correspond à un niveau quelconque et `**` à n’importe quelle profondeur, si bien que `**.email` retire tous les champs `email`, où qu’ils soient. Un chemin qui ne correspond à rien n’est pas une erreur.

```json
{ "drop": ["data.customer.email", "data.cards[*].number", "**.phone"] }
```

### `set` {#step-set}

Ajoute ou remplace des champs : de 1 à 50 paires d’un chemin et d’une [valeur](#values). Les objets manquants en chemin sont créés, et chaque valeur lit le corps tel que l’étape l’a trouvé. Un chemin qui tombe sur une valeur qui n’est pas un objet fait échouer l’exécution avec `set_conflict`.

```json
{ "set": { "event_type": "{{ type }}", "data.total_cents": { "$ref": "data.amount" } } }
```

### `map` {#step-map}

Remplace le corps par une [valeur](#values) que vous écrivez, le plus souvent un objet.

```json
{ "map": {
    "invoice_id": "{{ data.id }}",
    "amount": { "$ref": "data.amount" },
    "amount_display": "{{ data.amount | money(data.currency) }}",
    "event": "{{ type }}"
} }
```

Sur une requête `invoice.paid` dont les `data` valent `{"id": "in_42", "amount": 150000, "currency": "usd"}`, le corps devient :

```json
{ "invoice_id": "in_42", "amount": 150000, "amount_display": "1,500.00 USD", "event": "invoice.paid" }
```

### `headers` {#step-headers}

Définit des headers avec `set`, les retire avec `remove` et les renomme avec `rename`, dans cet ordre : remove, rename, set. Les noms correspondent quelle que soit leur casse, et un nom défini remplace toutes ses graphies.

```json
{ "headers": { "set": { "X-Event-Type": "{{ type }}", "Content-Type": "application/json" } } }
```

Une étape de headers ne peut pas définir un header qui appartient à la connexion, comme `Host` ou `Content-Length`, ni `Set-Cookie`. Elle ne peut pas non plus définir `Authorization`, `Cookie` ou `X-Api-Key`, car la valeur se retrouverait dans le document, que renvoie chaque lecture : un justificatif passe par une étape `auth`. Un produit qui exécute le pipeline par référence le soumet en plus à ses propres règles de headers.

### `auth` {#step-auth}

Indique que la requête doit porter un justificatif d’identité, et nomme l’emplacement d’où il vient :

| `type` | Ajoute |
|---|---|
| `bearer` | `Authorization: Bearer` et le justificatif. |
| `basic` | `Authorization: Basic`, à partir d’un `username` et du justificatif comme mot de passe. |
| `api_key`, `"in": "header"` | Le justificatif dans le header nommé `name`, après un `prefix` facultatif comme `"Token "`. |
| `api_key`, `"in": "query"` | Le justificatif comme paramètre de requête `name`, sur l’URL de la destination. |

```json
{ "auth": { "type": "api_key", "in": "header", "name": "X-Api-Key", "secret": "sec_…" } }
```

`secret` est l’identifiant d’un [emplacement](/docs/product-transforms/reference#slots) que détient l’espace de travail. Ce n’est jamais une valeur : une valeur collée là est refusée avec `invalid_secret`, et le refus ne la répète pas. Le produit qui exécute le pipeline par référence associe l’emplacement à son propre secret ([Justificatifs d’identité](/docs/product-transforms#credentials)). Test et l’API d’exécution montrent le header ou le paramètre avec la valeur masquée.

Les étapes de justificatif viennent après toutes les autres, si bien qu’aucune étape ne peut lire, copier ni tester un justificatif.

## Chemins et valeurs {#values}

Un chemin désigne un champ du corps :

| Chemin | Désigne |
|---|---|
| `data.customer.email` | Un champ. |
| `data.items[0].sku` | Un élément d’une liste. |
| `data['first name']` | Une clé qui contient un espace, un point ou un crochet. |
| `data.items[*].sku` | Chaque élément ; dans une valeur, leur liste. |
| `**.email` | `email` à n’importe quelle profondeur ; dans un `drop` seulement. |
| `$meta.source`, `$headers.x-name`, `$body.data` | Les métadonnées de la requête, l’un de ses headers ou son corps ; dans une valeur seulement. |

`set` prend des chemins simples, `drop` accepte `*` et `**`, et une valeur lit avec `*` mais pas avec `**`.

Une valeur dans `set`, `map` ou un header est du JSON, recopié tel qu’il est écrit, à deux exceptions près :

- **`{{ path }}`** dans une chaîne insère une valeur sous forme de texte. Une valeur absente ou `null` n’insère rien, et un objet ou une liste s’insère en JSON. `{{ 'text' }}` et `{{ 42 }}` sont des littéraux ; un `{{` littéral s’écrit donc `{{ '{{' }}`.
- **`{"$ref": "path"}`** insère la valeur elle-même et conserve son type : un nombre reste un nombre, une liste une liste. Ajoutez `"default"` pour le cas où le chemin est absent.

Une expression peut faire passer sa valeur par des filtres, de gauche à droite : `{{ data.amount | money(data.currency) }}` donne `1,500.00 USD` pour un montant de 150000 en `usd`.

| Filtre | Donne |
|---|---|
| `upper`, `lower` | Le texte en majuscules ou en minuscules. |
| `default(x)` | `x` quand la valeur est absente, `null` ou vide. |
| `truncate(n)` | Au plus `n` caractères, suivis de `…`. |
| `join(sep)` | Une liste sous forme de texte, jointe par `", "` sauf si vous donnez `sep`. |
| `length` | Le nombre d’éléments, de clés ou de caractères. |
| `json`, `json(indent)` | La valeur en JSON compact, ou indentée de 1 à 8 espaces. |
| `number(digits)` | Un nombre avec autant de décimales. |
| `money(currency)` | Un montant en unités mineures, mis en forme ; les devises sans décimale et à trois décimales comprises. |
| `date(format)` | Une date ISO 8601 ou un nombre de secondes epoch, en UTC, avec `%Y`, `%m`, `%d`, `%H`, `%M`, `%S`, etc. |
| `escape(target)` | Du texte qui ne peut pas mettre en forme un message de chat : `slack` (par défaut), `discord` ou `markdown`. |
| `code(target, max, language)` | Du texte en bloc de code dans le balisage de `slack`, `discord` ou `markdown`, que le texte ne peut pas fermer avant la fin, ajusté à `max` caractères. |

Il n’y a ni boucles, ni conditions, ni calculs : une condition est une étape `filter`, et une liste devient du texte avec `[*]` et `join`.

## Modèles {#templates}

La galerie propose des pipelines tout faits pour démarrer. Dans la console, ils figurent sous **Start from a template**. Via l’API, `GET /v1/pipelines/templates` renvoie chacun avec son `pipeline`. Enregistrer un modèle crée un pipeline qui vous appartient : modifiez-le comme n’importe quel autre ; rien ne le relie plus au modèle.

| `id` | Modèle | Ce qu’il envoie |
|---|---|---|
| `slack` | **Slack message** | Pour un incoming webhook de Slack : le type de l’événement comme header, son identifiant et son heure, et ses données dans un bloc de code. |
| `discord` | **Discord message** | Pour le webhook d’un canal Discord : un embed avec le type de l’événement, ses données dans un bloc de code, et son identifiant et son heure. Il ne mentionne personne. |
| `teams` | **Microsoft Teams card** | Pour un webhook de workflow Teams : une Adaptive Card avec le type de l’événement, son identifiant et son heure, et ses données en police à chasse fixe. |
| `keep_fields` | **Keep only these fields** | L’`id`, le `type`, le `created_at` et la `version` de l’événement, et seulement les champs de `data` que liste son `map`, à commencer par `data.id`. Un champ listé absent de l’événement est envoyé à `null`. |
| `drop_personal` | **Drop personal data** | L’événement sans `email`, `phone`, `first_name`, `last_name`, `address`, `billing_address`, `shipping_address`, `date_of_birth` ni `ip_address`, à n’importe quelle profondeur. Un simple `name` reste, car il désigne souvent un plan ou un produit. |

Chaque modèle de chat est une étape `map` suivie d’une étape `headers` qui définit `Content-Type: application/json`, et il fonctionne avec n’importe quel événement. Un type absent s’affiche « Event » et un identifiant ou une heure absents « — », les données sont coupées pour tenir dans les limites de l’app, et rien dans l’événement ne peut mettre en forme le message, mentionner quelqu’un ni fermer le bloc de code avant la fin.

## Limites {#limits}

Un pipeline n’a ni boucles, ni horloge, ni réseau, et des plafonds fixes bornent chaque exécution. Au-delà de l’un d’eux, l’exécution répond `failed` avec la raison, et un document qui en dépasse un est refusé à l’enregistrement.

| Élément | Limite | Refusé avec |
|---|---|---|
| Un document, en JSON compact | 64 KiB | `too_large` |
| Étapes | 20 | `too_many_steps` |
| Chemins dans un `drop`, champs dans un `set`, noms dans chaque partie d’une étape `headers` | 50 | `invalid_value` |
| Les réglages d’une étape, en JSON compact | 16 KiB | `too_large` |
| La note d’une étape | 200 caractères | `invalid_value` |
| Imbrication, dans une étape et dans un corps | 32 niveaux | `too_deep`, `input_too_deep` |
| Le corps que lit une étape | 256 KiB | `input_too_large` |
| Le corps que renvoie une exécution | 256 KiB | `output_too_large` |
| Une valeur produite par une étape | 64 KiB | `value_too_large` |
| Travail d’une exécution | 100,000 valeurs lues ou copiées, le texte comptant pour une tous les 128 caractères | `too_many_nodes` |
| Headers après chaque étape | 50, ou autant qu’en portait la requête s’il y en avait plus | `too_many_headers` |
| Une valeur de header | 8 KiB | `header_too_large` lors d’une exécution, pour une valeur avec une expression ; `invalid_header` à l’enregistrement, pour une valeur qui n’en a pas |

Le playground a des plafonds plus bas : un document de 16 KiB, un corps de 32 KiB, 16 KiB pour une valeur produite par une étape, 20 headers, 1 KiB pour une valeur de header et 10,000 valeurs lues ou copiées par exécution.

## Étapes suivantes {#next-steps}

- [Démarrage rapide](/docs/product-transforms/quickstart) — tester un pipeline, l’enregistrer et l’exécuter.
- [Référence Transforms](/docs/product-transforms/reference) — chaque route et chaque champ, et ce que signifie chaque refus.
- [Transformations dans Webhooks](/docs/product-webhooks/transformations) — le même langage sur un endpoint Webhooks.
