---
title: "Slack, Teams et Discord"
description: "Envoyez des événements vers un canal Slack, Microsoft Teams ou Discord, avec une transformation prédéfinie qui fait de chaque événement un message que le canal accepte."
publishedAt: 2026-10-30
updatedAt: 2026-10-30
kind: guide
---

# Slack, Teams et Discord

Slack, Microsoft Teams et Discord donnent chacun à un canal une URL de webhook qui publie dans le canal tout ce qu’elle reçoit — mais seulement dans leur propre format de message : ils refusent donc l’enveloppe d’événement que nous envoyons normalement. Une [transformation](/docs/product-webhooks/transformations) comble cet écart. À la fin de ce guide, vous aurez :

- un endpoint dirigé vers l’URL de webhook de votre canal ;
- le preset de cette application, qui fait de chaque événement un message qu’elle accepte ;
- un événement de test affiché dans le canal.

Durée totale : environ 10 minutes.

## Prérequis {#prereqs}

- Un espace de travail Webhooks sur Starter, Pro ou Custom. Free n’inclut pas les transformations.
- Le droit d’ajouter un webhook au canal : dans Slack, celui d’installer une application dans l’espace de travail ; dans Teams, celui de créer un workflow ; dans Discord, la permission **Manage Webhooks**.
- La [vérification des endpoints](/docs/product-webhooks/endpoint-verification#cannot-echo) désactivée pour le projet où vous placez l’endpoint. Ces canaux n’acceptent que leurs propres messages : ils ne peuvent donc jamais répondre au challenge de vérification, et un endpoint qui doit le réussir ne reçoit rien. Les plans payants permettent de désactiver la vérification.

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

## 3 · Choisir le preset {#preset}

Ouvrez le menu de l’endpoint sur la page **Endpoints** et choisissez **Transformation**. Sélectionnez **Preset**, puis celui de votre application — **Slack message**, **Microsoft Teams card** ou **Discord message** — et choisissez **Save**. Dès lors, chaque livraison vers cet endpoint est envoyée sous forme de message :

| Preset | Ce qu’affiche le canal |
|---|---|
| Slack message | Le type et l’identifiant de l’événement, le moment où il s’est produit, et ses données dans un bloc de code. |
| Microsoft Teams card | Une Adaptive Card avec le type d’événement, son identifiant et son heure, et ses données. |
| Discord message | Le type et l’identifiant de l’événement, et ses données dans un bloc de code JSON. |

Chacun tronque les données pour tenir dans la limite propre à l’application, comme 3,000 caractères dans une section Slack ou 2,000 dans un message Discord.

Un preset est un script comme un autre : il n’y a donc pas de preset à désigner dans l’API, [créez une transformation](/docs/product-webhooks/transformations#set-up) avec le script de votre choix. Dans la console, **Edit this script** affiche le code de chaque preset, comme point de départ.

## 4 · Le tester {#test}

Sous **Test**, sur la même page, choisissez **Run test**. Le preset s’exécute alors sur un événement récent tiré des livraisons de l’endpoint, ou sur un événement que vous collez, et le message qu’il enverrait s’affiche. Rien n’est envoyé.

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

Choisissez **Edit this script** pour changer le contenu du message ou les événements qui en publient un. Renvoyer `null` n’envoie rien : un script peut donc réserver le canal aux événements dont ses lecteurs ont besoin. Pour Slack :

```js
function transform(event) {
  if (event.type !== "invoice.paid" || event.data.amount < 100000) return null;
  return { body: { text: `Invoice ${event.data.id} paid: ${event.data.amount / 100} ${event.data.currency}` } };
}
```

Pour Discord, envoyez `content` là où Slack prend `text` ; pour Teams, gardez la carte du preset et changez-en le texte. Une livraison que le script abandonne n’est pas envoyée et ne compte pas comme un échec. Testez le script avant de l’enregistrer : une exécution qui échoue place la livraison dans la dead-letter queue, et l’événement non transformé n’est jamais envoyé.

## Étapes suivantes {#next-steps}

- [Transformations](/docs/product-webhooks/transformations) — le contrat du script, les limites et ce qui se passe quand un script échoue.
- [Vérification des endpoints](/docs/product-webhooks/endpoint-verification#cannot-echo) — les récepteurs qui ne peuvent pas répondre au challenge.
- [Livraisons et réessais](/docs/product-webhooks/deliveries) — les états, les réessais et les renvois.
