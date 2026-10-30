---
title: "Webhooks"
description: "La plateforme de webhooks managée — publiez un événement une fois, nous signons, réessayons et rejouons chaque livraison vers vos abonnés."
publishedAt: 2026-08-05
updatedAt: 2026-10-30
kind: concept
---

# Webhooks

NimbusNexus Webhooks est un produit autonome pour envoyer des webhooks à *vos* abonnés. Vous publiez un événement une fois ; nous le diffusons vers chaque endpoint abonné à ce type, signons chaque livraison, réessayons les échecs et conservons tout ce qui n’arrive jamais dans une dead-letter queue que vous pouvez rejouer.

> **Ce n’est pas la page que vous cherchez ?** Si vous êtes ici pour recevoir des notifications sur *votre propre infrastructure NimbusNexus* — `vm.created`, `snapshot.completed`, `invoice.generated` — il s’agit d’une autre fonctionnalité, documentée dans [Webhooks de la plateforme](/docs/webhooks). Les deux sont des systèmes sans rapport entre eux et **leurs headers de signature diffèrent** : un code de vérification écrit pour l’un rejettera chaque livraison de l’autre.

La distinction en une ligne : les webhooks de la plateforme sont des événements que *nous* vous envoyons au sujet de votre compte ; ce produit livre des événements que *vous* envoyez à vos propres clients.

## À quoi ça sert {#what-for}

Gérer vous-même la livraison de webhooks paraît simple, jusqu’au moment où ça ne l’est plus. La livraison elle-même est un POST — le travail, c’est tout ce qui l’entoure : signer pour que les abonnés puissent faire confiance au payload, réessayer sans marteler un endpoint déjà en panne, garder un corps identique octet pour octet d’un réessai à l’autre pour que les signatures restent valides, désactiver les endpoints qui échouent depuis une semaine, et donner au support un moyen de répondre à « vous l’avez envoyé ? » preuves à l’appui.

Ce produit, c’est toute cette mécanique. Il reçoit aussi dans l’autre sens — les [sources](/docs/product-webhooks/sources) acceptent les webhooks de Stripe, de GitHub ou de tout ce qui signe ses payloads — si bien qu’un seul système gère les deux sens de votre trafic de webhooks.

## Les objets {#objects}

| Objet | Ce que c’est |
|---|---|
| **Espace de travail** | Votre compte. Tout ce que vous possédez lui est rattaché et isolé des autres espaces de travail. |
| **Projet** | Un regroupement à l’intérieur de l’espace de travail. Séparer la préproduction de la production, c’est deux projets ; faire tourner deux produits côte à côte aussi. Désigné par son identifiant (`prj_…`). |
| **Événement** | Quelque chose qui s’est produit — un type comme `order.created`, plus un payload JSON. Vous le publiez, ou une source le reçoit. |
| **Source** | Une URL à laquelle un fournisseur envoie des webhooks. Chaque requête signée devient un événement. Voir [Sources](/docs/product-webhooks/sources). |
| **Endpoint** | Une URL HTTPS enregistrée pour recevoir des webhooks, qui porte un ou plusieurs abonnements. |
| **Abonnement** | Une règle de correspondance sur un endpoint : `exact`, `prefix`, `suffix` ou `all`, plus un motif comme `order.`. |
| **Transformation** | Une courte fonction JavaScript attachée à un endpoint, qui remodèle, filtre ou abandonne chaque livraison avant qu’elle ne soit signée et envoyée. Plans payants. Voir [Transformations](/docs/product-webhooks/transformations). |
| **Livraison** | Un envoi d’un événement vers un endpoint correspondant, avec suivi des tentatives. Signée, réessayée, observable. Voir [Livraisons et réessais](/docs/product-webhooks/deliveries). |
| **Type d’événement** | Une entrée du catalogue des noms de types, avec un JSON Schema facultatif. Voir [Types d’événements](/docs/product-webhooks/event-types). |
| **Secret de signature** | Secret propre à chaque endpoint, utilisé pour signer chaque livraison en HMAC. Affiché **une seule fois**, à la création. |

Publier un événement le confronte à chaque endpoint activé dont les abonnements couvrent ce type, et crée une livraison par correspondance. Quand l’espace de travail exige la [vérification des endpoints](/docs/product-webhooks/endpoint-verification), seuls les endpoints vérifiés comptent.

Deux compteurs s’y appliquent, et la différence compte quand vous dimensionnez un plan. Une publication vaut toujours un **événement**, et ce décompte, indépendant de la diffusion, est ce que `GET /v1/usage` renvoie dans `messages_used`. Mais le quota mensuel **appliqué** compte les *livraisons* — une par endpoint correspondant — si bien que diffuser un seul événement vers dix endpoints en consomme dix. Le compteur par événement est enregistré et deviendra l’unité de facturation ; le quota de livraisons est le plafond qui rejette effectivement une publication aujourd’hui.

## Comment se comporte une livraison {#delivery}

- **Le corps est construit une seule fois.** L’enveloppe est sérialisée au moment de la publication et stockée octet pour octet : chaque réessai envoie donc des octets identiques. Chaque *tentative* est signée à nouveau avec un timestamp frais, ce qui permet à vos abonnés d’imposer une fenêtre de rejeu serrée sans qu’une livraison qui réussit une heure plus tard échoue à la vérification.
- **Au moins une fois.** Les réessais sont réels ; le même événement peut arriver deux fois. Dédupliquez sur l’identifiant de l’événement, qui figure à la fois dans le corps et dans le header `X-Webhook-Event-Id`.
- **Les réessais s’espacent.** Les livraisons échouées sont réessayées avec un backoff exponentiel, jusqu’au `max_attempts` de l’endpoint. Un endpoint peut porter un `retry_schedule` personnalisé — une liste explicite de délais en secondes — quand la courbe par défaut ne convient pas au récepteur.
- **Les livraisons épuisées sont conservées, pas abandonnées.** Elles arrivent dans la dead-letter queue, où vous pouvez les filtrer et les rejouer en masse une fois le récepteur rétabli.
- **Les endpoints en échec persistant sont désactivés** automatiquement, avec la raison enregistrée. Nous envoyons un [webhook opérationnel](/docs/product-webhooks/deliveries#operational) `endpoint.disabled` aux endpoints opérationnels de l’espace de travail : abonnez-en un pour être prévenu. La réactivation est explicite.

## S’orienter dans la console {#console}

| Section | Pages | Pour |
|---|---|---|
| **Build** | Sources, Endpoints, Event types, Pipeline | Configurer d’où viennent les événements et où ils vont ; Pipeline montre les endpoints qu’atteint chaque source, avec la transformation appliquée en chemin. |
| **Observe** | Events, Deliveries, Captured requests | Voir ce qui est arrivé, ce qui est parti et ce qui a échoué. |
| **Manage** | Operational webhooks, Audit log, Settings | Où vous êtes prévenu quand quelque chose casse ; qui a modifié quoi ; votre plan Webhooks et votre consommation, la vérification et les outils de développement. |

La page Overview propose des boutons pour ajouter une source ou un endpoint et pour envoyer un événement de test, et guide un nouvel espace de travail jusqu’à sa première livraison.

## Publier en toute sécurité {#publishing}

Envoyez un `Idempotency-Key` à chaque publication. Une publication réessayée renvoie alors l’événement d’origine au lieu d’être diffusée une seconde fois, ce qui compte surtout dans la situation même qui produit des réessais — un timeout après lequel vous n’avez jamais su si le premier appel avait réussi.

La même clé avec un corps *différent* est rejetée plutôt qu’acceptée en silence : une collision de clés apparaît ainsi comme une erreur, et non comme un événement perdu sans bruit.

Pour les producteurs qui ne peuvent pas se permettre de perdre un événement quand l’API est injoignable, les SDK fournissent une outbox (file d’envoi locale) à écriture préalable : `enqueue()` persiste localement et rend la main sans appel réseau, et un drainer envoie l’arriéré plus tard avec la même garantie d’idempotence. Voir [SDK](/docs/product-webhooks/sdks).

## Obtenir l’accès {#access}

Inscrivez-vous à Webhooks et vous obtenez un espace de travail sur le plan gratuit, créé la première fois que vous vous connectez à la console. Les tarifs sont sur la [page Webhooks](/webhooks).

Les clés ne sont pas émises avec l’espace de travail, et l’API Webhooks ne les émet pas. Vous en créez une vous-même dans votre console de compte NimbusNexus, sous **API keys**, en choisissant **Webhooks** comme produit — Identity est l’unique émetteur de clés API sur l’ensemble de la plateforme. Une clé émise par Identity est un JWT : elle commence donc par `eyJ` au lieu de porter un préfixe de produit. Elle se présente exactement comme avant : `Authorization: Bearer <key>`, ou `X-API-Key: <key>`.

Choisissez la portée à la création. `admin` donne le contrôle total ; `publish` peut produire des événements et ne peut rien lire ; `read` peut tout lire et ne peut rien produire. `publish` et `read` sont disjointes plutôt qu’échelonnées — une clé `publish` ne peut pas lister les livraisons, et une clé `read` ne peut pas publier : une tâche qui fait les deux exige donc `admin`. Une clé peut aussi être limitée à un seul projet au moment de sa création.

> **Une clé `whsk_…` existante ne permet plus de s’authentifier.** La famille `whsk_` a disparu, et une requête qui en porte une est refusée comme tout autre justificatif d’identité non reconnu. Si vous en détenez une, créez une clé de remplacement dans la console de compte.

## Étapes suivantes {#next-steps}

- [Démarrage rapide](/docs/product-webhooks/quickstart) — enregistrer un endpoint, publier un événement, vérifier la livraison.
- [Sources](/docs/product-webhooks/sources) — recevoir les webhooks de Stripe, de GitHub ou de tout expéditeur HMAC.
- [Livraisons et réessais](/docs/product-webhooks/deliveries) — les états, le calendrier des réessais et les renvois.
- [Vérification des endpoints](/docs/product-webhooks/endpoint-verification) — le challenge auquel un endpoint répond avant de recevoir des événements.
- [Transformations](/docs/product-webhooks/transformations) — remodeler, filtrer ou abandonner chaque livraison avec un court script.
- [Slack, Teams et Discord](/docs/product-webhooks/chat-apps) — envoyer des événements vers un canal avec un preset.
- [Types d’événements](/docs/product-webhooks/event-types) — le catalogue, la politique pour les types inconnus et les schémas de payload.
- [Requêtes capturées](/docs/product-webhooks/captured-requests) — les requêtes brutes reçues par une source.
- [Vérification de signature](/docs/product-webhooks/signatures) — le contrat de signature et les trois règles pour la vérifier.
- [SDK](/docs/product-webhooks/sdks) — des clients typés pour Python, TypeScript et Go.
- [CLI](/docs/product-webhooks/cli) — `nn-webhooks`, un binaire statique unique.
- [Webhooks de la plateforme](/docs/webhooks) — l’autre chose appelée webhooks : les notifications sur votre propre infrastructure.
