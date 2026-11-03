---
title: "Slack, Teams et Discord"
description: "Envoyez des événements vers un canal Slack, Microsoft Teams ou Discord, avec un modèle qui fait de chaque événement un message que le canal accepte."
publishedAt: 2026-10-30
updatedAt: 2026-11-03
kind: guide
---

# Slack, Teams et Discord

Slack, Microsoft Teams et Discord donnent chacun à un canal une URL de webhook qui publie dans le canal tout ce qu’elle reçoit — mais seulement dans leur propre format de message : ils refusent donc l’enveloppe d’événement que nous envoyons normalement. Une [transformation](/docs/product-webhooks/transformations) comble cet écart. À la fin de ce guide, vous aurez :

- un endpoint dirigé vers l’URL de webhook de votre canal ;
- le modèle de cette application, qui fait de chaque événement un message qu’elle accepte ;
- un événement de test affiché dans le canal.

Durée totale : environ 10 minutes.

## Prérequis {#prereqs}

- Un espace de travail Webhooks, sur n’importe quel plan : les modèles de chat sont des pipelines, que tous les plans incluent.
- Le droit d’ajouter un webhook au canal : dans Slack, celui d’installer une application dans l’espace de travail ; dans Teams, celui de créer un workflow ; dans Discord, la permission **Manage Webhooks**.
- La [vérification des endpoints](/docs/product-webhooks/endpoint-verification#cannot-echo) désactivée pour le projet où vous placez l’endpoint. Ces canaux n’acceptent que leurs propres messages : ils ne peuvent donc jamais répondre au challenge de vérification, et un endpoint qui doit le réussir ne reçoit rien. Les plans payants permettent de désactiver la vérification ; sur un plan qui l’exige, ces canaux sont inutilisables.

## 1 · Récupérer l’URL de webhook du canal {#webhook-url}

### Slack {#slack}

Créez une application Slack pour votre espace de travail et activez **Incoming Webhooks** dans ses paramètres. Choisissez **Add New Webhook to Workspace**, sélectionnez le canal et autorisez l’application. Copiez l’URL, de la forme `https://hooks.slack.com/services/T…/B…/…`. Slack décrit ces étapes dans [Envoyer des messages avec les incoming webhooks](https://docs.slack.dev/messaging/sending-messages-using-incoming-webhooks).

### Microsoft Teams {#teams}

Dans Teams, ouvrez **Workflows** et partez du modèle **Send webhook alerts to a channel**. Choisissez l’équipe et le canal, enregistrez le workflow, puis copiez l’URL de webhook depuis ses détails. Microsoft décrit ces étapes dans [Créer des incoming webhooks avec Workflows pour Microsoft Teams](https://support.microsoft.com/en-us/office/create-incoming-webhooks-with-workflows-for-microsoft-teams-8ae491c7-0394-4861-ba59-055e33f75498).

### Discord {#discord}

Dans Discord, ouvrez **Server Settings → Integrations → Webhooks** et créez un webhook. Choisissez le canal dans lequel il publie, puis **Copy Webhook URL** ; l’URL est de la forme `https://discord.com/api/webhooks/…/…`. Discord décrit ces étapes dans [Introduction aux webhooks](https://support.discord.com/hc/en-us/articles/228383668-Intro-to-Webhooks).

Traitez l’URL comme un secret : ces canaux ne vérifient pas notre signature, et quiconque la détient peut donc publier dans le canal.

## 2 · Ajouter l’endpoint {#endpoint}

Dans la console, choisissez **New endpoint** sur la page **Endpoints**, collez l’URL et abonnez l’endpoint aux événements que le canal doit voir. Gardez une liste courte : un canal est lu par des personnes, et chaque événement correspondant devient un message.

Via l’API :

```bash
curl -sX POST {{WEBHOOKS_BASE_URL}}/v1/endpoints \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://hooks.slack.com/services/T…/B…/…", "project_id": "prj_…",
       "subscriptions": [{"match_kind": "exact", "pattern": "invoice.paid"}]}'
```

## 3 · Partir du modèle {#preset}

Ouvrez le menu de l’endpoint sur la page **Endpoints** et choisissez **Transformation**. Sélectionnez **Pipeline** puis, sous **Start from a template**, le modèle de votre application — **Use Slack message**, **Use Microsoft Teams card** ou **Use Discord message** — et choisissez **Save**. Dès lors, chaque livraison vers cet endpoint est envoyée sous forme de message :

| Modèle | Ce qu’affiche le canal |
|---|---|
| Slack message | Le type d’événement comme en-tête, son identifiant et son heure, et ses données dans un bloc de code. |
| Microsoft Teams card | Une Adaptive Card avec le type d’événement, son identifiant et son heure, et ses données en police à chasse fixe. |
| Discord message | Un embed avec le type d’événement pour titre, ses données dans un bloc de code JSON et, en dessous, son identifiant et son heure. Il ne mentionne personne. |

Chaque modèle coupe les données pour tenir dans les limites de l’application, et rien dans l’événement ne peut mettre en forme le message, mentionner quelqu’un ni fermer le bloc de code avant la fin. À l’enregistrement, le pipeline devient le vôtre : il ne change pas quand le modèle change.

Via l’API, `GET /v1/transformations/templates` renvoie chaque modèle avec son `pipeline` : [créez une transformation](/docs/product-webhooks/transformations#set-up) avec ce document, puis faites-y pointer le `transformation_id` de l’endpoint.

Un endpoint qui exécute déjà l’un des anciens presets, qui sont des scripts, continue de l’exécuter sans changement.

## 4 · Le tester {#test}

Sous **Test**, sur la même page, choisissez **Run test**. Le pipeline de l’éditeur s’exécute alors sur un événement récent tiré des livraisons de l’endpoint, ou sur un événement que vous collez, et le message qu’il enverrait s’affiche. Rien n’est envoyé.

Envoyez ensuite un vrai événement : **Send test event** sur la page Overview de la console, ou publiez un événement auquel l’endpoint est abonné :

```bash
curl -sX POST {{WEBHOOKS_BASE_URL}}/v1/events \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"event_type": "invoice.paid", "project_id": "prj_…", "payload": {"id": "in_123", "amount": 125000, "currency": "usd"}}'
```

Le message apparaît dans le canal en quelques secondes. Le **Send test ping** de l’endpoint ne sert à rien ici : il envoie son ping fixe sans transformation, et le canal le refuse.

## Récapitulatif {#summary}

Chaque événement auquel l’endpoint est abonné publie désormais un message dans votre canal. Ouvrez une livraison sur la page **Deliveries** pour voir le message envoyé ; si l’application a répondu par une erreur, elle s’y trouve aussi, dans les tentatives de la livraison.

## L’adapter à vos besoins {#customize}

Les étapes du modèle sont désormais celles de votre pipeline : modifiez-les comme n’importe quelles autres. Pour réserver le canal aux événements dont ses lecteurs ont besoin, ajoutez une étape **Filter** avec **Send only matching events** et deux conditions, `type` **is** `invoice.paid` et `data.amount` **is at least** `100000`, puis remontez-la tout en haut, pour qu’elle teste l’événement avant que le message ne soit construit. En JSON :

```json
{ "filter": { "type": "invoice.paid", "data": { "amount": { "$gte": 100000 } } } }
```

Une livraison que le filtre abandonne n’est pas envoyée et ne compte pas comme un échec. Pour changer le contenu du message, modifiez l’étape **Reshape the body**, qui le construit ; la console l’affiche en JSON : modifiez-le là, puis choisissez **Apply**. Ses valeurs lisent l’événement au moyen de [chemins et de filtres](/docs/product-webhooks/transformations#values), comme `{{ data.amount | money(data.currency) }}`. Testez avant d’enregistrer : une exécution qui échoue place la livraison dans la dead-letter queue, et l’événement non transformé n’est jamais envoyé.

## Étapes suivantes {#next-steps}

- [Transformations](/docs/product-webhooks/transformations#templates) — les modèles, les étapes d’un pipeline, les tests et ce qui se passe quand une exécution échoue.
- [Vérification des endpoints](/docs/product-webhooks/endpoint-verification#cannot-echo) — les récepteurs qui ne peuvent pas répondre au challenge.
- [Livraisons et réessais](/docs/product-webhooks/deliveries) — les états, les réessais et les renvois.
