---
title: "Transformations"
description: "Filtrez, allégez, remodelez chaque livraison ou ajoutez-y des justificatifs d’identité avant sa signature et son envoi : avec un pipeline d’étapes déclaratives sur tous les plans, ou un script JavaScript sur les plans payants."
publishedAt: 2026-10-30
updatedAt: 2026-11-06
kind: concept
---

# Transformations

Une transformation change ce que reçoit un endpoint : elle s’exécute sur chaque événement avant que nous ne le livrions, et envoie à sa place une requête remodelée, ou rien du tout. C’est soit un **pipeline** d’étapes déclaratives, sur tous les plans, soit un **script** JavaScript, sur les plans payants ; ce qu’elle produit est signé avec le secret de l’endpoint et envoyé comme n’importe quelle autre livraison.

## À quoi ça sert {#what-for}

- **Un récepteur qui exige des justificatifs d’identité.** Votre propre API, ou celle d’un partenaire, attend un bearer token, une authentification basique ou une clé d’API. Un pipeline les ajoute à partir d’un [secret](#credentials) que nous stockons chiffré et ne montrons plus jamais.
- **Un récepteur qui attend son propre format.** Slack, Discord et Microsoft Teams n’acceptent que leurs propres formats de message et refusent notre enveloppe ; un CRM veut trois champs, nommés à sa façon. Un [modèle](#templates) ou une étape `map` construit ce corps.
- **Seulement certains événements.** Un [abonnement](/docs/product-webhooks#objects) ne porte que sur le type d’événement. « Seulement les `invoice.paid` de $1,000 ou plus » demande de lire le payload, ce que fait une étape `filter`.
- **Moins de données, ou un peu plus.** Retirez les données personnelles avant qu’un fournisseur d’analytics ne les voie, ou ajoutez le type d’événement au corps ou à un header.

## Pipelines et scripts {#kinds}

| | Pipeline | Script |
|---|---|---|
| Ce que vous écrivez | Jusqu’à 20 étapes, dans le formulaire de la console ou en JSON | Une fonction JavaScript |
| Plans | Tous les plans, Free compris | Starter, Pro et Custom |
| Où il s’exécute | À côté de la livraison, sous des plafonds fixes ; aucun code de votre part ne s’exécute | Dans une sandbox à part, avec un budget de CPU, de mémoire et de temps |
| Pour | Justificatifs d’identité, filtres, retrait et ajout de champs, remodelage, messages de chat | La logique que les étapes ne savent pas exprimer |

Une transformation est l’un ou l’autre, et son type est fixé à sa création. Un endpoint exécute au plus une transformation ; une même transformation peut servir plusieurs endpoints de son projet. Un pipeline peut aussi être [conservé dans Transforms](#reference) et exécuté ici par référence.

Sur Free, créer ou tester un script est refusé avec `402 not_entitled`. Un espace de travail qui quitte son plan payant conserve ses scripts et peut toujours les renommer, les mettre en pause, les détacher et les supprimer, mais pas enregistrer de nouveau code, ni en tester ou en relancer un ; les livraisons vers un endpoint qui en exécute un attendent que le plan inclue de nouveau les scripts, ou que vous le détachiez. Les pipelines continuent de s’exécuter sur n’importe quel plan.

Les scripts dépendent d’un service de sandbox qui leur est propre ; les pipelines, non. Tant que les scripts sont désactivés, la console l’indique, `GET /v1/plan` renvoie `transformations_available: false`, et les livraisons vers un endpoint qui exécute un script attendent. Si la sandbox ne peut pas prendre un script à un moment donné, enregistrer ou tester un script répond `503 unavailable` et rien n’est enregistré, et la tentative d’une livraison échoue avec un message qui le dit, puis est réessayée selon le calendrier habituel.

`GET /v1/plan` indique aussi ce que comprend votre plan : `pipelines` vaut `true` sur tous les plans, et `transformations` vaut `true` quand il comprend les scripts. Les exécutions des deux types sont comptées, pas facturées ; `transformation_runs` donne le nombre de ce mois.

## Un pipeline {#pipeline}

Un pipeline est un document JSON. Celui-ci envoie les factures payées de $1,000 ou plus, sans l’e-mail du client ni aucun numéro de téléphone, avec le type d’événement ajouté au corps et un bearer token tiré d’un secret stocké :

```json
{
  "version": 1,
  "steps": [
    { "filter": { "type": "invoice.paid", "data": { "amount": { "$gte": 100000 } } }, "note": "Paid invoices of $1,000 or more" },
    { "drop": ["data.customer.email", "**.phone"] },
    { "set": { "event_type": "{{ type }}" } },
    { "auth": { "type": "bearer", "secret": "sec_…" } }
  ]
}
```

`version` est le format du document, toujours `1` ; ce n’est pas la version de la transformation. Les étapes s’exécutent dans l’ordre où elles sont écrites. Chacune est un objet avec une clé d’étape et, en option, une `note` de 200 caractères au plus, que la console affiche sur l’étape et qu’enregistre une livraison abandonnée par un filtre. Un `filter` peut aussi prendre une `action`.

La première étape voit l’enveloppe que nous enverrions sinon, avec son `id`, son `type`, son `created_at`, ses `data` et sa `version`, et chaque étape suivante voit le corps tel que la précédente l’a laissé. Si aucune étape ne modifie le corps, le récepteur reçoit les octets d’origine de l’événement. Les étapes sont numérotées à partir de 0 dans l’API et dans les textes d’erreur, et à partir de 1 dans l’éditeur de la console.

| Étape | Dans la console | Ce qu’elle fait |
|---|---|---|
| `filter` | **Filter** | N’envoie l’événement que s’il correspond, ou, avec `"action": "drop"`, l’abandonne s’il correspond. |
| `drop` | **Remove fields** | Retire des champs du corps. |
| `set` | **Set fields** | Ajoute ou remplace des champs. |
| `map` | **Reshape the body** | Remplace le corps par un corps que vous construisez. |
| `headers` | **Headers** | Définit, retire ou renomme des headers. |
| `auth` | **Credential** | Ajoute un bearer token, une authentification basique ou une clé d’API à partir d’un secret stocké. |

### `filter` {#step-filter}

Ne garde la livraison que si l’événement correspond ; sinon, la livraison est [abandonnée](#dropped) et rien n’est envoyé. Avec `"action": "drop"`, c’est l’inverse : ce qui correspond est abandonné.

```json
{ "filter": { "data": { "status": "paid", "amount": { "$gte": 100000 } } }, "note": "Paid, $1,000 or more" }
```

- Chaque clé est une condition, et toutes doivent être remplies. Un objet imbriqué se compare par sa forme, comme `data` ici.
- Une valeur simple correspond par égalité JSON : `1` est égal à `1.0`.
- Un tableau correspond s’il est égal à la valeur ou si l’un de ses éléments correspond : `{"data": {"tags": "urgent"}}` est vrai pour `["billing", "urgent"]`, et `{"data": {"items": {"sku": "A-1", "qty": 2}}}` exige un élément qui ait les deux.
- Un champ absent de l’événement ne correspond qu’à `{"$exists": false}` et aux négations, comme `$neq`.
- Les opérateurs sont `$eq`, `$neq`, `$gt`, `$gte`, `$lt`, `$lte` (des nombres avec des nombres, du texte avec du texte ; les horodatages ISO se comparent dans l’ordre chronologique), `$in`, `$nin`, `$exists`, `$startsWith`, `$endsWith`, `$contains` (du texte, ou un tableau qui contient la valeur), et `$and`, `$or` et `$not` pour combiner des filtres.
- `$meta` teste la destination de la livraison : `{"$meta": {"endpoint": {"id": "ep_3f9a…"}}}`.

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

Sur un événement `invoice.paid` dont les `data` valent `{"id": "in_42", "amount": 150000, "currency": "usd"}`, elle envoie :

```json
{ "invoice_id": "in_42", "amount": 150000, "amount_display": "1,500.00 USD", "event": "invoice.paid" }
```

### `headers` {#step-headers}

Définit des headers avec `set`, les retire avec `remove` et les renomme avec `rename`, dans cet ordre : remove, rename, set. Les noms correspondent quelle que soit leur casse. Un pipeline démarre sans headers à lui : les headers personnalisés de l’endpoint et les nôtres sont ajoutés après son exécution, un header qu’il définit remplace un header personnalisé du même nom, et `remove` et `rename` n’atteignent que les headers définis par des étapes précédentes.

```json
{ "headers": { "set": { "X-Event-Type": "{{ type }}", "Content-Type": "application/json" } } }
```

Un pipeline ne peut pas définir un header que nous envoyons nous-mêmes, c’est-à-dire aucun header `X-Webhook-*`, la signature comprise, ni `User-Agent` ; ni un header qui appartient à la connexion, comme `Host`, `Content-Length` ou `Expect`. `Content-Type`, il peut le définir, et celui-ci devient le type de contenu de la livraison. Sans lui, la livraison part en `application/json`.

### `auth` {#step-auth}

Ajoute un justificatif d’identité à partir d’un [secret stocké](#credentials), désigné par son identifiant :

| `type` | Ajoute |
|---|---|
| `bearer` | `Authorization: Bearer` et le secret. |
| `basic` | `Authorization: Basic`, à partir d’un `username` et du secret comme mot de passe. |
| `api_key`, `"in": "header"` | Le secret dans le header nommé `name`, après un `prefix` facultatif comme `"Token "`. |
| `api_key`, `"in": "query"` | Le secret comme paramètre de requête `name`, sur l’URL de l’endpoint et pour cette requête seulement. |

```json
{ "auth": { "type": "api_key", "in": "header", "name": "X-Api-Key", "secret": "sec_…" } }
```

Les étapes `auth` viennent après toutes les autres, si bien qu’aucune étape ne peut lire, copier ni tester le justificatif.

## Chemins et valeurs {#values}

Un chemin désigne un champ du corps :

| Chemin | Désigne |
|---|---|
| `data.customer.email` | Un champ. |
| `data.items[0].sku` | Un élément d’une liste. |
| `data['first name']` | Une clé qui contient un espace, un point ou un crochet. |
| `data.items[*].sku` | Chaque élément ; dans une valeur, leur liste. |
| `**.email` | `email` à n’importe quelle profondeur ; dans un `drop` seulement. |
| `$meta.endpoint.id` | L’endpoint vers lequel va la livraison, et `$meta.endpoint.description` sa description ; dans une valeur seulement. |

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

La galerie propose des pipelines tout faits pour démarrer. Dans la console, ils figurent sous **Start from a template**, sous les étapes : **Use Slack message**, ou le bouton de n’importe quel autre modèle, place les étapes de ce modèle dans l’éditeur, après confirmation si elles devaient remplacer les vôtres. Via l’API, `GET /v1/transformations/templates` renvoie chacun avec son `pipeline`.

| Modèle | Ce qu’il envoie |
|---|---|
| **Slack message** | Pour un incoming webhook de Slack : le type de l’événement comme en-tête, son identifiant et son heure, et ses données dans un bloc de code. |
| **Discord message** | Pour le webhook d’un canal Discord : un embed avec le type de l’événement, ses données dans un bloc de code, et son identifiant et son heure. Il ne mentionne personne. |
| **Microsoft Teams card** | Pour un webhook de workflow Teams : une Adaptive Card avec le type de l’événement, son identifiant et son heure, et ses données en police à chasse fixe. |
| **Keep only these fields** | L’`id`, le `type`, le `created_at` et la `version` de l’événement, et seulement les champs de `data` que liste son `map`, à commencer par `data.id`. Un champ listé absent de l’événement est envoyé à `null`. |
| **Drop personal data** | L’événement sans `email`, `phone`, `first_name`, `last_name`, `address`, `billing_address`, `shipping_address`, `date_of_birth` ni `ip_address`, à n’importe quelle profondeur. Un simple `name` reste, car il désigne souvent un plan ou un produit. |

Enregistrer un modèle crée un pipeline qui vous appartient : modifiez-le comme n’importe quel autre ; rien ne le relie plus au modèle. Chaque modèle de chat est une étape `map` suivie d’une étape `headers` qui définit `Content-Type: application/json`, et il fonctionne avec n’importe quel événement. Un type absent s’affiche « Event » et un identifiant ou une heure absents « — », les données sont coupées pour tenir dans les limites de l’app, et rien dans l’événement ne peut mettre en forme le message, mentionner quelqu’un ni fermer le bloc de code avant la fin.

Slack, Discord et Teams ne peuvent pas répondre au [challenge de vérification](/docs/product-webhooks/endpoint-verification#cannot-echo) : un endpoint qui vise l’un d’eux a donc besoin que la vérification soit désactivée pour son projet, ce que permettent les plans payants.

**Les presets sont désormais des modèles.** Un endpoint qui exécute déjà un preset, c’est-à-dire un script, continue de l’exécuter tel quel, et seul un tel endpoint propose encore **Preset** parmi ses choix. Le modèle du même nom fait le même travail sans script, sur tous les plans.

## Justificatifs d’identité {#credentials}

Une étape `auth` désigne un secret par son identifiant (`sec_…`), jamais par sa valeur. Un secret appartient à un projet, comme une transformation, et seuls les pipelines de ce projet peuvent le désigner. Sa valeur est stockée chiffrée et n’est jamais renvoyée : l’API liste les secrets par nom et par identifiant, un pipeline relu ne porte que l’identifiant, un test affiche le justificatif sous la forme `••••`, et une livraison ne garde que les noms des headers et des paramètres de requête qu’elle a ajoutés.

Dans la console, **Secret**, dans une étape **Credential**, liste les secrets du projet. Pour en stocker un nouveau, choisissez **New secret…**, remplissez **Secret name** et **Secret value**, puis choisissez **Save secret**.

Via l’API, avec la valeur lue dans une variable d’environnement :

```bash
curl -sX POST {{WEBHOOKS_BASE_URL}}/v1/secrets \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"project_id\": \"prj_…\", \"name\": \"CRM token\", \"value\": \"$CRM_TOKEN\"}"
```

```json
{ "id": "sec_…", "project_id": "prj_…", "name": "CRM token", "transformation_count": 0, "created_at": "…", "updated_at": "…" }
```

`PATCH /v1/secrets/{id}` renomme un secret ou remplace sa valeur ; chaque pipeline qui le désigne envoie la nouvelle valeur dès la tentative suivante, réessais de livraisons antérieures compris. `DELETE /v1/secrets/{id}` est refusé avec `409 secret_in_use` tant que la version actuelle d’un pipeline désigne le secret. La console ne fait que créer des secrets ; renommez-les, remplacez-les et supprimez-les via l’API.

## Scripts {#script}

Un script est une seule fonction nommée `transform`, sur Starter, Pro et Custom :

```js
function transform(event, context) {
  // event:   { id, type, created_at, data, version }, the envelope we would otherwise send
  // context: { endpoint: { id, description }, attempt }
  if (event.type !== "invoice.paid") return null; // send nothing
  return {
    body: { text: `Invoice ${event.data.id} paid` },
    headers: { "X-Team": "billing" },
  };
}
```

Elle renvoie la requête à envoyer, ou `null` pour ne rien envoyer. Un `body` qui est un objet ou une liste part en JSON ; une chaîne part telle quelle, en `text/plain; charset=utf-8`. `contentType` définit un autre type de contenu, à la place d’un header `Content-Type`, et `headers` ajoute des headers soumis aux règles des headers personnalisés d’un endpoint. L’URL et la méthode restent celles de l’endpoint. Tout ce que le script écrit avec `console.log` est conservé avec la livraison, jusqu’à 4 KiB.

Le script est un simple fichier de JavaScript, sans réseau, sans système de fichiers, sans timers et sans imports : une bibliothèque dont il a besoin doit donc y être intégrée. À l’enregistrement, nous le chargeons d’abord dans la sandbox, sans l’appeler : une erreur de syntaxe, l’absence de fonction `transform` ou un code de premier niveau qui échoue est refusé avec `422 invalid_transformation`, et rien n’est enregistré.

## Tester {#test}

**Test**, sous l’éditeur, exécute ce qui se trouve dans l’éditeur, enregistré ou non, sur **A recent event**, tiré des dernières livraisons de l’endpoint, ou sur **An event you paste**. Choisissez **Run test** : rien n’est envoyé et rien n’est enregistré. Un pipeline s’exécute avec les secrets de son projet, et la réponse affiche chaque justificatif sous la forme `••••`. La réponse est l’une de celles-ci :

- **Would send** : le type de contenu, la taille, les headers et le corps que recevrait le récepteur.
- **Would send nothing** : un filtre l’a abandonnée, à l’étape indiquée, ou le script a renvoyé `null`.
- **Failed** : pourquoi et, pour un pipeline, à quelle étape.

Via l’API, envoyez le pipeline, ou le `code` d’un script, avec un événement :

```bash
curl -sX POST {{WEBHOOKS_BASE_URL}}/v1/transformations/test \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d '{"project_id": "prj_…",
       "pipeline": {"version": 1, "steps": [
         {"map": {"text": "{{ type }}: {{ data.id }}"}},
         {"auth": {"type": "bearer", "secret": "sec_…"}}]},
       "event": {"id": "evt_1", "type": "invoice.paid", "created_at": "2026-11-03T10:00:00Z", "data": {"id": "in_42"}, "version": "1"}}'
```

```json
{ "status": "ok", "body": "{\"text\":\"invoice.paid: in_42\"}", "content_type": null, "headers": { "Authorization": "Bearer ••••" }, "logs": "", "reason": null, "error": null, "fuel": 0, "duration_ms": 0.2, "query": {}, "step": null }
```

`status` vaut `ok`, `dropped` ou `failed`. Pour un abandon ou un échec, `step` est l’étape, comptée à partir de 0 ; `reason` est le mot-clé, comme `no_match` (ou `matched` pour un filtre avec `"action": "drop"`) ou `set_conflict` ; et `error` le dit en toutes lettres, avec la note du filtre en cas d’abandon. `content_type` vaut `null` sauf si une étape l’a défini. Un test qui abandonne ou échoue donne quand même un `200`, mais un pipeline qui ne pourrait jamais s’exécuter est refusé avec `422 invalid_pipeline`, comme le serait son enregistrement.

Tester un pipeline fonctionne sur tous les plans. Tester un script demande un plan qui inclut les scripts, partage avec l’enregistrement des scripts un budget de 60 par minute et par espace de travail, avec des bursts de 10, et renvoie en plus les `logs` et le `fuel` du script.

Le **Send test ping** d’un endpoint envoie son ping fixe sans la transformation, donc sans les justificatifs d’un pipeline : un récepteur qui les vérifie le refuse. **Test**, ou un véritable événement, montre ce que recevra votre récepteur.

## Versions et mise en pause {#versions}

Enregistrer un pipeline ou un script modifié crée sa version suivante ; en enregistrer un identique à la version actuelle n’en crée aucune. Les 50 dernières versions sont conservées, et chaque livraison enregistre la version qui l’a mise en forme. Dans la console, **Versions** les liste, et **Load into editor** charge une version antérieure dans l’éditeur ; l’enregistrer en fait la version la plus récente. Via l’API, `GET /v1/transformations/{id}/versions` les liste, de la plus récente à la plus ancienne, et `GET /v1/transformations/{id}/versions/{version}` en renvoie une avec son pipeline ou son code.

**Pause** arrête une transformation sans la détacher, tout comme `PATCH /v1/transformations/{id}` avec `{"status": "disabled"}`. Les livraisons de ses endpoints attendent au lieu de partir sans transformation : elles apparaissent en `failed`, avec le `last_error` « paused: the endpoint's transformation is not running », et partent quand vous la relancez avec **Resume** (`{"status": "enabled"}`), avec la version alors actuelle. Mettre en pause et relancer un pipeline fonctionne sur tous les plans.

## L’attacher à un endpoint {#set-up}

Dans la console, ouvrez le menu de l’endpoint sur la page **Endpoints** et choisissez **Transformation**, ou cliquez sur son entrée dans la colonne **Transformation**. Ensuite :

1. Choisissez **Pipeline** et construisez-le : avec **Add a step**, à partir d’un modèle, ou en collant un document entier sous **JSON** puis en choisissant **Apply JSON**. Ou choisissez **Script** et écrivez la fonction.
2. [Testez la transformation](#test).
3. Choisissez **Save**. Les prochaines livraisons de l’endpoint passent par elle.

**Off** puis **Save** la désactivent après confirmation, et les livraisons repartent sous la forme de l’enveloppe de l’événement. Si aucun autre endpoint n’exécute la transformation, elle est supprimée avec ses versions. Comme le type ne peut pas changer, faire passer un endpoint d’un script à un pipeline, ou l’inverse, enregistre une nouvelle transformation à la place de l’ancienne, et supprime l’ancienne si aucun autre endpoint ne l’exécute. Quand une transformation s’exécute sur plusieurs endpoints, l’enregistrer la modifie pour tous.

Via l’API, créez la transformation dans le projet de l’endpoint, puis faites pointer l’endpoint vers elle :

```bash
curl -sX POST {{WEBHOOKS_BASE_URL}}/v1/transformations \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "Paid invoices to the CRM", "project_id": "prj_…",
       "pipeline": {"version": 1, "steps": [
         {"filter": {"type": "invoice.paid"}, "note": "Paid invoices only"},
         {"drop": ["**.email"]},
         {"auth": {"type": "bearer", "secret": "sec_…"}}]}}'

curl -sX PATCH {{WEBHOOKS_BASE_URL}}/v1/endpoints/ep_3f9a… \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d '{"transformation_id": "trf_…"}'
```

Un script prend `code` à la place de `pipeline` ; envoyer les deux, ou aucun, est refusé. Pour modifier le document plus tard, envoyez `PATCH /v1/transformations/{id}` avec un nouveau `pipeline`. Si la nouvelle version a une étape `auth` et que des endpoints exécutent la transformation, le `PATCH` doit aussi contenir `confirm_destinations` : l’URL de chacun de ces endpoints, comme les liste `destinations` de la transformation, car le justificatif part vers tous. `POST /v1/endpoints` accepte aussi `transformation_id`, `{"transformation_id": null}` détache la transformation, et une transformation d’un autre projet est refusée comme introuvable. Créer, modifier et tester des transformations et des secrets demande une clé `admin` ; une clé `read` peut les lister et les lire. Une personne, contrairement à une clé, a aussi besoin du rôle de propriétaire ou d’admin pour stocker ou modifier un secret, pour enregistrer un pipeline dont l’étape `auth` en désigne un, ou pour attacher un tel pipeline à un endpoint.

## Un pipeline conservé dans Transforms {#reference}

Une transformation peut exécuter un pipeline conservé dans [Transforms](/docs/product-transforms) au lieu d’avoir le sien. Son type est `reference`, sur tous les plans, et nous enregistrons quel pipeline elle désigne, pas une copie. Le pipeline s’exécute toujours ici, à côté de la livraison, et Transforms ne participe pas à l’envoi. Les exécutions comptent aussi ici, dans `transformation_runs`. Les [tests](#test), la [mise en pause](#versions), [ce que montre une livraison](#deliveries) et le [décompte des échecs](#failures) fonctionnent comme pour n’importe quel pipeline.

La console ne propose pas ce type. Créez-en une via l’API, dans le projet de l’endpoint, puis [faites pointer l’endpoint vers elle](#set-up) avec `transformation_id` :

```bash
curl -sX POST {{WEBHOOKS_BASE_URL}}/v1/transformations \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "Paid invoices to the CRM", "project_id": "prj_…",
       "pipeline_ref": {"id": "pipe_…", "secrets": {"sec_1f0a…": "sec_9c4e…"}}}'
```

| Champ de `pipeline_ref` | Ce que c’est |
|---|---|
| `id` | L’`id` du pipeline dans Transforms, qui doit appartenir à cet espace de travail. |
| `version` | Une version à figer. Sans elle, la référence suit la version actuelle, et une nouvelle version atteint les livraisons en moins d’une minute. |
| `secrets` | Jusqu’à 20 paires : l’identifiant d’un [emplacement](/docs/product-transforms#credentials) que nomme le pipeline, puis l’identifiant d’un [secret](#credentials) de ce projet. Chaque emplacement que nomme la version en demande un, et un pipeline sans étape `auth` n’en demande aucun. |

Transforms ne détient aucun justificatif : ils viennent donc de cette association. Chaque étape `auth` s’exécute avec le secret de ce projet à la place de son emplacement. Une référence qui associe un secret suit les règles d’une étape `auth` : une personne a besoin du rôle de propriétaire ou d’admin pour l’enregistrer, une nouvelle version doit nommer tous les endpoints dans `confirm_destinations`, et le secret ne peut pas être supprimé tant que la référence l’associe. Un pipeline dans Transforms appartient à tout l’espace de travail : le choisir demande donc une clé ou une connexion qui couvre tout l’espace de travail. Une clé ou une connexion limitée à certains projets est refusée avec `403` `project_confined`, mais peut encore lire, renommer et attacher ce qui est déjà enregistré.

Pour changer de pipeline, de version ou de secrets, envoyez `PATCH /v1/transformations/{id}` avec un nouveau `pipeline_ref`, ce qui enregistre la version suivante de la transformation. Une nouvelle version dans Transforms ne demande aucun `PATCH`, sauf si la référence en fige une. Pour tester, envoyez `pipeline_ref` à la place de `pipeline` à `POST /v1/transformations/test` : le test exécute ce que la référence exécute maintenant, avec chaque justificatif masqué, même pendant que le pipeline est désactivé dans Transforms. Pour une livraison, `GET /v1/deliveries/{id}/transform` ajoute `pipeline_version`, la version du pipeline qui s’est exécutée, à côté de `version`, celle de la transformation.

Un événement n’est jamais envoyé sans transformation. Quand le pipeline ne peut pas s’exécuter :

| Ce qui s’est passé | Ce que fait la livraison |
|---|---|
| Transforms est injoignable | Une version déjà récupérée continue de s’exécuter. Sans rien sur quoi s’appuyer, la livraison attend sans consommer de tentative et regarde à nouveau toutes les 5 minutes. Elle apparaît comme `failed`, avec un `last_error` qui commence par `paused:`. |
| Le pipeline est désactivé dans Transforms | En moins d’une minute, que la référence fige une version ou non, les livraisons attendent de la même façon, et partent dès qu’il est réactivé. |
| Le pipeline a été supprimé | La livraison échoue avec `pipeline_failed: reference_missing: …` et part dans la dead-letter queue. |
| Une version plus récente nomme un emplacement que la référence n’associe pas | La livraison échoue de la même façon avec `secret_missing`, qui nomme l’emplacement. Associez-le avec un `PATCH`. |
| Une version plus récente contient ce que nous refusons, comme un header que nous envoyons nous-mêmes | La livraison échoue de la même façon, avec la raison, comme `managed_header`. Un enregistrement dans Transforms ne vérifie pas nos règles de headers. |

Chaque échec est imputé à la transformation, comme pour tout pipeline ([Quand une exécution échoue](#failures)). Transforms liste `webhookd` parmi les services qui exécutent un pipeline, et une nouvelle version avec une étape `auth`, ou la suppression du pipeline, doit d’abord le nommer ([Qui exécute un pipeline](/docs/product-transforms/reference#destinations)).

## Ce que montre une livraison {#deliveries}

Une transformation s’exécute une fois par livraison, à sa première tentative. Ce qu’elle a produit est stocké avec la livraison, et chaque réessai renvoie ce même corps, signé à nouveau, avec les headers de l’endpoint tels qu’ils sont à cette tentative. Les justificatifs d’un pipeline ne sont jamais stockés : chaque tentative les ajoute de nouveau à partir de la valeur du secret à ce moment-là. [Relivrer](/docs/product-webhooks/deliveries#replay) exécute de nouveau la version actuelle de la transformation.

Dans la console, ouvrez une livraison sur la page **Deliveries**. **Transformed by** nomme la transformation et la version qui a été exécutée, et le résultat est l’un de ceux-ci :

- **Transformed** : le type de contenu, la taille, les headers qu’elle a définis, les noms des justificatifs qu’elle a ajoutés et le corps envoyé.
- **Dropped** : un filtre a abandonné la livraison, ou le script a renvoyé `null`, et rien n’a été envoyé.
- **Failed** : pourquoi l’exécution a échoué. La livraison est dans la dead-letter queue.

Via l’API, `GET /v1/deliveries/{id}/transform` renvoie l’exécution, ou `null` quand aucune n’a eu lieu : `transformation_id`, `version`, `status` (`ok`, `dropped` ou `failed`), `reason`, `error`, `body`, `content_type`, `header_names`, `credential_headers` et `credential_query` (des noms, jamais des valeurs) et `duration_ms`. L’exécution d’un script comporte aussi `logs` et `fuel`.

### Livraisons abandonnées {#dropped}

Quand un filtre abandonne une livraison, ou qu’un script renvoie `null`, rien n’est envoyé et aucune tentative n’est faite. La livraison passe à `sent` avec `"dropped": true`, la console l’affiche comme **dropped**, et les statistiques de l’endpoint et de l’espace de travail la comptent à part des livraisons effectuées : un taux de réussite se calcule sur ce qui devait être envoyé. Un abandon n’est pas un échec, ni pour l’endpoint ni pour la transformation. Une livraison abandonnée ne compte pas non plus dans le [quota mensuel de livraisons](/docs/product-webhooks#objects) : le quota compte chaque livraison au moment où son événement est publié, avant qu’un filtre ou un script ne s’exécute, et cesse de la compter quand elle est abandonnée. Une fois le quota épuisé, une publication est donc toujours refusée, même si un filtre devait abandonner toutes ses livraisons.

## Quand une exécution échoue {#failures}

Un pipeline qui a pu être enregistré peut tout de même échouer sur un événement donné : un `set` qui écrirait à l’intérieur d’une valeur qui n’est pas un objet (`set_conflict`), un corps ou une valeur au-delà de sa [limite](#limits), une valeur qu’un header ne peut pas porter, ou un justificatif dont le secret n’existe plus (`secret_missing`) ou ne peut pas être envoyé (`invalid_secret`). Le même pipeline échoue de la même façon sur le même événement : la livraison part donc directement dans la dead-letter queue, sans être envoyée, avec un `last_error` comme `pipeline_failed: step 2: set_conflict: …`.

Un script échoue quand il lève une exception, manque de temps ou de mémoire, dépasse la profondeur de récursion ou renvoie autre chose qu’une requête (un objet avec un `body`, ou `null`). Sa livraison part dans la dead-letter queue avec un `last_error` qui commence par `transform_failed:`.

Nous n’envoyons jamais l’événement non transformé à la place : le récepteur peut être un tiers à qui la transformation sert justement à ne pas transmettre certaines données.

Chaque exécution en échec est imputée à la transformation, comme les livraisons en échec le sont à un endpoint, et une exécution qui envoie ou abandonne met fin à la série. Après 20 échecs d’affilée, la transformation est désactivée (**turned off after failures** dans la console, `auto_disabled` dans l’API), les livraisons de ses endpoints attendent, et nous envoyons un e-mail au propriétaire de l’espace de travail ainsi qu’un [webhook opérationnel](/docs/product-webhooks/deliveries#operational) `transformation.disabled`. Corrigez-la, testez-la et relancez-la avec **Resume**, ou envoyez `PATCH /v1/transformations/{id}` avec `{"status": "enabled"}` : les livraisons en attente partent, et celles passées dans la dead-letter queue peuvent être [relivrées](/docs/product-webhooks/deliveries#replay).

## Limites {#limits}

Un pipeline n’a ni boucles, ni horloge, ni E/S : le même pipeline fait donc toujours la même chose sur le même événement, et des plafonds fixes bornent chaque exécution :

| Pipeline | Limite |
|---|---|
| Étapes | 20 |
| Chemins dans un `drop`, champs dans un `set`, noms dans chaque partie d’une étape `headers` | 50 |
| Les réglages d’une étape, en JSON compact | 16 KiB |
| La note d’une étape | 200 caractères |
| Imbrication, dans une étape et dans un corps | 32 niveaux |
| Le corps que lit une étape, et le corps envoyé | 256 KiB |
| Une valeur produite par une étape | 64 KiB |
| Travail d’une exécution | 100,000 valeurs lues ou copiées, le texte comptant pour une par KiB |
| Headers à la fin d’une exécution | 50 |
| Une valeur de header | 8 KiB |
| La valeur d’un secret | 4,096 caractères d’ASCII imprimable, sans espace au début ni à la fin |

| Script | Limite |
|---|---|
| CPU | Environ 50 ms de temps de script, comptés en instructions plutôt que mesurés : un même script dispose donc du même budget, quelle que soit notre charge |
| Temps écoulé | 1 seconde |
| Mémoire | 64 MiB |
| Taille du script | 1 MiB |
| Sortie | 256 KiB |
| Logs | 4 KiB |
| Scripts exécutés en même temps, par espace de travail | 2 sur Starter, 4 sur Pro ; sur Custom, ceux du plan sur lequel repose le contrat |

## Erreurs {#errors}

Un pipeline qui ne pourrait jamais s’exécuter est refusé à l’enregistrement ou au test, avec `422 invalid_pipeline`. Le refus nomme le premier problème : `details.reason`, `details.path` (un JSON Pointer vers lui) et `details.step` (compté à partir de 0), chacun quand il s’applique.

```json
{ "error": { "code": "invalid_pipeline", "message": "…", "details": { "reason": "managed_header", "path": "/steps/0/headers/set/User-Agent", "step": 0 }, "request_id": "…" } }
```

| `reason` | Ce qui ne va pas |
|---|---|
| `invalid_document` | Ce n’est pas un objet avec une `version` et une liste de `steps`. |
| `unsupported_version` | `version` ne vaut pas `1`. |
| `no_steps` | Il n’y a aucune étape. |
| `too_many_steps` | Il y a plus de 20 étapes. |
| `invalid_step` | Une étape n’est pas un objet avec une seule clé d’étape, sans rien d’autre à côté qu’une `note` et, pour un filtre, une `action`. |
| `unknown_step` | Une clé d’étape n’est ni `filter`, ni `drop`, ni `set`, ni `map`, ni `headers`, ni `auth`. |
| `invalid_value` | Un réglage n’est pas de ceux que prend son étape, comme un `drop` vide ou une note de plus de 200 caractères. |
| `invalid_path` | Un chemin ne peut pas être lu, ou contient un joker là où son étape n’en accepte pas. |
| `invalid_template` | Une expression ne peut pas être lue, ou nomme un filtre qui n’existe pas. |
| `invalid_filter` | Un filtre n’est pas valide, par exemple parce qu’il utilise un opérateur inconnu. |
| `invalid_header` | Un nom de header n’est pas valide ou appartient à la connexion, ou une valeur n’est pas de l’ASCII imprimable sur une seule ligne. |
| `invalid_secret` | Le `secret` d’une étape `auth` n’est pas l’identifiant d’un secret. Une valeur collée là n’est jamais reprise dans un message. |
| `auth_not_last` | Une étape vient après une étape `auth`. |
| `too_deep` | Quelque chose est imbriqué sur plus de 32 niveaux. |
| `too_large` | Les réglages d’une étape dépassent 16 KiB. |
| `not_json` | Le document contient une valeur qui n’est pas du JSON. |
| `managed_header` | Une étape définit un header que nous envoyons nous-mêmes : `X-Webhook-*` ou `User-Agent`. |
| `forbidden_header` | Une étape définit un header hop-by-hop ou de contrôle, comme `Expect`. |
| `unknown_secret` | Une étape `auth`, ou les `secrets` d’une référence, désignent un secret que leur projet ne détient pas. |
| `unknown_pipeline` | Une [référence](#reference) désigne un pipeline que cet espace de travail n’a pas dans Transforms. |
| `unknown_pipeline_version` | Une référence fige une version que Transforms n’a pas. |
| `unbound_secret` | La version qu’exécute une référence nomme un emplacement que ses `secrets` n’associent pas. |

Les autres refus :

| Statut | Code | Quand |
|---|---|---|
| `422` | `validation_error` | Une transformation envoyée avec plus d’un champ parmi `code`, `pipeline` et `pipeline_ref`, ou sans aucun, ou un `PATCH` avec le champ d’un autre type. |
| `402` | `not_entitled` (`feature: transformations`) | Créer un script, enregistrer du nouveau code, relancer un script ou en tester un sur un plan sans scripts. |
| `422` | `invalid_transformation` | Un script qui ne se charge pas : `syntax_error`, `no_transform`, `code_too_large` ou `load_failed`. |
| `409` | `conflict` (`transformation_in_use`) | Supprimer une transformation qu’un endpoint exécute encore. Détachez-la d’abord. |
| `409` | `conflict` (`secret_in_use`) | Supprimer un secret que désigne la version actuelle d’un pipeline. Modifiez d’abord le pipeline. |
| `409` | `conflict` (`destinations_unconfirmed`) | Un `PATCH` qui enregistre une étape `auth` sans nommer dans `confirm_destinations` tous les endpoints qui exécutent la transformation. `details.destinations` liste leurs URL, et rien n’est enregistré. |
| `403` | `forbidden` (`role`) | Un membre qui stocke ou modifie un secret, enregistre un pipeline dont l’étape `auth` en désigne un, ou attache un tel pipeline à un endpoint. |
| `403` | `forbidden` (`project_confined`) | Une clé ou une connexion limitée à certains projets qui choisit ou teste un pipeline de Transforms. |
| `404` | `not_found` (`transformation`, `transformation_version`, `secret`) | Il n’existe pas, cette version n’est plus conservée, ou un endpoint désigne une transformation d’un autre projet. |
| `429` | `rate_limited` | Au-delà de 60 enregistrements et tests de scripts par minute et par espace de travail. |
| `503` | `unavailable` (`transform`) | La sandbox n’a pas pu exécuter le script à ce moment-là. Rien n’a été enregistré ; réessayez. |
| `503` | `unavailable` (`transforms`) | Transforms n’a pas pu être interrogé sur le pipeline d’une référence. Rien n’a été enregistré ; réessayez. |

## Étapes suivantes {#next-steps}

- [Slack, Teams et Discord](/docs/product-webhooks/chat-apps) — obtenir l’URL de webhook d’un canal et y envoyer des événements.
- [Livraisons et réessais](/docs/product-webhooks/deliveries) — états, réessais et renvois.
- [Vérification des endpoints](/docs/product-webhooks/endpoint-verification) — le challenge, et les récepteurs qui ne peuvent pas y répondre.
- [Transforms](/docs/product-transforms) — créer, versionner et tester des pipelines au même endroit, et les exécuter ici par référence.
- [API Webhooks](/docs/reference/webhooks) — toutes les routes, dont `/v1/transformations` et `/v1/secrets`.
- [Vue d’ensemble de Webhooks](/docs/product-webhooks) — événements, endpoints et abonnements.
