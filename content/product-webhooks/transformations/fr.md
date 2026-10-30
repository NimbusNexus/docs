---
title: "Transformations"
description: "Remodelez, filtrez ou abandonnez chaque livraison avec une courte fonction JavaScript qui s’exécute dans une sandbox avant que la livraison ne soit signée et envoyée."
publishedAt: 2026-10-30
updatedAt: 2026-10-30
kind: concept
---

# Transformations

Une transformation est une courte fonction JavaScript attachée à un endpoint. Elle reçoit chaque événement avant que nous ne le livrions et renvoie la requête à envoyer à sa place, ou `null` pour ne rien envoyer. Elle s’exécute une fois par livraison, dans une sandbox sans accès au réseau et avec un budget fixe de CPU et de mémoire ; ce qu’elle renvoie est signé avec le secret de l’endpoint et envoyé comme n’importe quelle autre livraison.

## À quoi ça sert {#what-for}

- **Les récepteurs qui attendent leur propre format.** Slack, Microsoft Teams et Discord n’acceptent que leurs propres formats de message et refusent notre enveloppe. Une transformation fait de chaque événement un message qu’ils acceptent ; les [presets](#presets) s’en chargent pour vous.
- **Un format différent pour chaque récepteur.** Votre propre service reçoit le payload entier, un CRM trois champs, un fournisseur d’analytics rien qui contienne des données personnelles.
- **Le filtrage selon le payload.** Un [abonnement](/docs/product-webhooks#objects) ne porte que sur le type d’événement. « Seulement les `invoice.paid` de plus de $1,000 » demande de lire le payload, ce que peut faire un script.

## Le script {#script}

Une transformation est une seule fonction, nommée `transform` :

```js
function transform(event, context) {
  // event:   { id, type, created_at, data, version }, the envelope we would otherwise send
  // context: { endpoint: { id, description }, attempt }
  if (event.type === "invoice.paid" && event.data.amount < 100000) {
    return null; // send nothing for small invoices
  }
  return {
    body: { text: `Invoice ${event.data.id} paid: ${event.data.amount / 100} ${event.data.currency}` },
    headers: { "X-Team": "billing" },
  };
}
```

Ce qu’elle renvoie détermine ce qui est envoyé :

| Valeur renvoyée | Ce qui est envoyé |
|---|---|
| `{ body: { … } }` ou `{ body: [ … ] }` | Le corps en JSON, avec `Content-Type: application/json`. |
| `{ body: "…" }` | La chaîne telle quelle, avec `Content-Type: text/plain; charset=utf-8`. |
| `{ body: …, contentType: "…" }` | Le corps, avec ce type de contenu. |
| `{ body: …, headers: { … } }` | Le corps, avec ces headers en plus, soumis aux mêmes règles que les headers personnalisés d’un endpoint. Définissez `contentType` plutôt qu’un header `Content-Type`. |
| `null` | Rien. La livraison est [abandonnée](#dropped). |

L’URL et la méthode restent celles de l’endpoint : l’URL est celle qui a été enregistrée, contrôlée et, là où c’est exigé, [vérifiée](/docs/product-webhooks/endpoint-verification). Tout ce que le script écrit avec `console.log` est conservé avec la livraison, jusqu’à 4 KiB.

Le script est un simple fichier de JavaScript moderne. Il n’a accès ni au réseau ni au système de fichiers, n’a pas de timers et ne peut pas importer de modules : une bibliothèque dont il a besoin doit donc être intégrée au fichier.

## Presets {#presets}

Les presets sont des scripts que nous écrivons et maintenons, pour les récepteurs les plus demandés :

| Preset | Envoie |
|---|---|
| **Slack message** | Le type, l’identifiant et les données de l’événement sous forme de message Slack, pour un incoming webhook de Slack. |
| **Microsoft Teams card** | L’événement sous forme d’Adaptive Card, pour un webhook de workflow Teams. |
| **Discord message** | Le type, l’identifiant et les données de l’événement sous forme de message Discord, pour le webhook d’un canal Discord. |
| **Keep only these fields** | L’enveloppe, avec seulement les champs de `data` que vous listez. Un nom à points comme `customer.id` atteint les champs imbriqués. |

Choisir un preset enregistre son script comme votre propre transformation : vous pouvez donc l’ouvrir et la modifier comme n’importe quelle autre. [Slack, Teams et Discord](/docs/product-webhooks/chat-apps) guide la mise en place de chaque récepteur, à partir de zéro.

## En configurer une {#set-up}

Dans la console, ouvrez le menu de l’endpoint sur la page **Endpoints** et choisissez **Transformation**. Sélectionnez **Preset** ou **Script**, [testez-la](#test), puis choisissez **Save** : les prochaines livraisons de l’endpoint passent par elle. **Off** la retire.

Via l’API, créez la transformation dans le projet de l’endpoint, puis faites pointer l’endpoint vers elle :

```bash
curl -sX POST {{WEBHOOKS_BASE_URL}}/v1/transformations \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "CRM fields", "project_id": "prj_…", "code": "function transform(event) { return { body: { id: event.id, total: event.data.total } }; }"}'

curl -sX PATCH {{WEBHOOKS_BASE_URL}}/v1/endpoints/ep_3f9a… \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"transformation_id": "tr_…"}'
```

Avant d’enregistrer le script, nous le chargeons dans la sandbox, sans l’appeler : s’il contient une erreur de syntaxe, s’il n’a pas de fonction `transform` ou si son code de premier niveau échoue, il est refusé avec `422 invalid_transformation` et rien n’est enregistré. Un endpoint exécute au plus une transformation ; une même transformation peut servir plusieurs endpoints de son projet. `{"transformation_id": null}` la détache.

## Tester un script {#test}

**Test** exécute le script de l’éditeur, enregistré ou non, dans la même sandbox que les livraisons, sur un événement récent tiré des livraisons de l’endpoint ou sur un événement que vous collez. Il affiche ce qui serait envoyé, les headers, les logs et la durée d’exécution. Rien n’est envoyé et rien n’est enregistré.

Via l’API :

```bash
curl -sX POST {{WEBHOOKS_BASE_URL}}/v1/transformations/test \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"code": "function transform(event) { return { body: { text: event.type } }; }",
       "event": {"id": "evt_1", "type": "invoice.paid", "created_at": "2026-10-30T12:00:00+00:00", "data": {}, "version": "1"}}'
```

```json
{ "status": "ok", "body": "{\"text\":\"invoice.paid\"}", "content_type": "application/json", "headers": {}, "logs": "", "reason": null, "error": null, "fuel": 2764502, "duration_ms": 3.6 }
```

`status` vaut `ok`, `dropped` (le script a renvoyé `null`) ou `failed`, avec `reason` et `error` qui indiquent pourquoi. Un script qui échoue donne quand même un `200`. Les tests et les vérifications à l’enregistrement partagent un même budget de 60 par minute et par espace de travail, avec des bursts de 10.

Le **Send test ping** d’un endpoint envoie toujours son corps de ping fixe, sans transformation ; utilisez **Test** pour voir ce qui parviendra à votre récepteur.

## Ce qu’enregistre une livraison {#deliveries}

Le script s’exécute une fois par livraison, à sa première tentative. Ce qu’il renvoie est stocké avec la livraison et signé avec le secret de l’endpoint comme n’importe quel autre corps, et chaque réessai renvoie ces mêmes octets sans relancer le script : un réessai ne peut donc pas changer ce qui parvient au récepteur. [Relivrer](/docs/product-webhooks/deliveries#replay) exécute à nouveau la version actuelle de la transformation.

Dans la console, ouvrez une livraison sur la page **Deliveries** pour voir la transformation et la version qui l’ont mise en forme, la durée de l’exécution, le corps envoyé, et les logs ou l’erreur. Via l’API, `GET /v1/deliveries/{id}/transform` renvoie cette exécution, ou `null` quand aucune n’a eu lieu.

### Livraisons abandonnées {#dropped}

Quand le script renvoie `null`, rien n’est envoyé et aucune tentative n’est faite. La livraison passe à `sent` avec `"dropped": true`, la console l’affiche comme **dropped**, et les statistiques de l’endpoint et de l’espace de travail la comptent à part des livraisons effectuées : un taux de réussite se calcule sur ce qui devait être envoyé.

## Quand un script échoue {#failures}

Une exécution échoue quand le script lève une exception, manque de temps ou de mémoire, dépasse la profondeur de récursion, ou renvoie autre chose qu’une requête (un objet avec un `body`, ou `null`). La livraison part alors directement dans la dead-letter queue, avec un `last_error` qui commence par `transform_failed:`. Nous n’envoyons jamais l’événement non transformé à la place : le récepteur peut être un tiers à qui le script sert justement à ne pas transmettre certaines données.

Chaque exécution en échec est imputée à la transformation, comme les livraisons en échec le sont à un endpoint. Après 20 échecs d’affilée, la transformation est désactivée automatiquement, les livraisons de ses endpoints attendent, et nous envoyons un e-mail au propriétaire de l’espace de travail ainsi qu’un [webhook opérationnel](/docs/product-webhooks/deliveries#operational) `transformation.disabled`. Corrigez le script, testez-le, puis réactivez la transformation (**Resume** dans la console, ou `PATCH /v1/transformations/{id}` avec `{"status": "enabled"}`) : les livraisons en attente partent, et celles passées dans la dead-letter queue peuvent être [relivrées](/docs/product-webhooks/deliveries#replay).

## Mise en pause et versions {#versions}

**Pause** (`{"status": "disabled"}`) arrête une transformation sans la détacher. Les livraisons de ses endpoints attendent au lieu de partir sans mise en forme : elles apparaissent en `failed`, avec le `last_error` « paused: the endpoint's transformation is not running », et partent quand vous la relancez.

Chaque enregistrement de nouveau code crée une nouvelle version. Les 50 dernières versions sont conservées (`GET /v1/transformations/{id}/versions`), et chaque livraison enregistre la version qui l’a mise en forme. Pour revenir à une version antérieure, chargez-la dans l’éditeur et enregistrez-la : elle devient la version la plus récente.

## Limites {#limits}

Chaque exécution dispose de :

| Limite | Valeur |
|---|---|
| CPU | Environ 50 ms de temps de script, comptés en instructions plutôt que mesurés : un même script dispose donc du même budget, quelle que soit notre charge |
| Temps écoulé | 1 seconde |
| Mémoire | 64 MiB |
| Taille du script | 1 MiB |
| Sortie | 256 KiB |
| Logs | 4 KiB |

Les scripts s’exécutent dans un service à part, à l’écart de la livraison, et chaque espace de travail ne peut en exécuter que quelques-uns à la fois : un script lent ou défaillant ne pénalise donc que ses propres livraisons, pas celles des autres. Un script typique prend quelques millisecondes.

## Plans {#plans}

Les transformations, presets comme scripts, font partie de tous les plans payants : Starter, Pro et Custom. Free ne les inclut pas. Les plans diffèrent par le nombre de scripts d’un espace de travail qui peuvent s’exécuter en même temps : 2 sur Starter, 4 sur Pro, et ce que prévoit le contrat sur Custom. La carte du plan, sur la page Overview de la console, compte les exécutions du mois. Les exécutions sont comptées, pas facturées.

Un espace de travail qui quitte son plan payant conserve ses transformations et peut toujours les renommer, les mettre en pause, les détacher et les supprimer, mais pas enregistrer de nouveau code, ni en tester ou en relancer une. Les livraisons vers un endpoint qui en a encore une attendent que le plan inclue de nouveau les transformations, ou que vous la détachiez.

## Erreurs {#errors}

| Statut | Code | Quand |
|---|---|---|
| `402` | `not_entitled` (`feature: transformations`) | Créer une transformation, enregistrer du nouveau code, en activer une ou lancer un test sur un plan sans transformations. |
| `422` | `invalid_transformation` | Le script ne s’est pas chargé : `syntax_error`, `no_transform`, `code_too_large` ou `load_failed`, avec la cause. |
| `409` | `conflict` (`transformation_in_use`) | Supprimer une transformation qu’un endpoint exécute encore. Détachez-la d’abord. |
| `404` | `not_found` (`transformation`, `transformation_version`) | Elle n’existe plus, ou cette version n’est plus conservée. |
| `429` | `rate_limited` | Au-delà des 60 tests et vérifications à l’enregistrement par minute. |
| `503` | `unavailable` (`transform`) | La sandbox n’a pas pu exécuter le script à ce moment-là. Rien n’a été enregistré ; réessayez. |

## Étapes suivantes {#next-steps}

- [Slack, Teams et Discord](/docs/product-webhooks/chat-apps) — envoyer des événements vers un canal avec un preset.
- [Livraisons et réessais](/docs/product-webhooks/deliveries) — ce qu’il advient d’une livraison après l’exécution de son script.
- [Vérification des endpoints](/docs/product-webhooks/endpoint-verification) — pourquoi les récepteurs de messagerie exigent que la vérification soit désactivée.
- [Vue d’ensemble de Webhooks](/docs/product-webhooks) — événements, endpoints et abonnements.
