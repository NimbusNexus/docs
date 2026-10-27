---
title: "Démarrage rapide"
description: "Générez une clé API, choisissez une région et créez votre première VM en trois requêtes."
publishedAt: 2026-05-19
updatedAt: 2026-05-19
kind: quickstart
---

# Démarrage rapide

Ce guide vous mène d’un compte connecté à la console à une machine virtuelle en marche, en trois appels d’API. Tout ce que vous faites ici est réversible — détruisez la VM quand vous avez terminé, et vous aurez dépensé quelques centimes tout au plus.

## Avant de commencer {#prereqs}

Il vous faut trois choses :

- Un compte NimbusNexus. Inscrivez-vous sur [{{ROOT_DOMAIN}}]({{BASE_URL}}/register) — vous recevrez un crédit de bienvenue qui couvre ce démarrage rapide, et plus encore.
- L’outil en ligne de commande `curl`, ou le client HTTP de votre choix. Les exemples de cette page utilisent `curl` ; les mêmes appels fonctionnent dans n’importe quel langage.
- Environ cinq minutes.

Vous n’avez pas encore besoin d’avoir configuré SSH. Nous créerons une clé lors du deuxième appel.

## 1 · Générer une clé API {#api-key}

Connectez-vous à la console et allez dans **Settings → API keys → New key**. Donnez à la clé un libellé que vous reconnaîtrez plus tard (par exemple `quickstart`) et copiez sa valeur en lieu sûr — vous ne la voyez qu’une fois.

Exportez-la comme variable d’environnement pour que les exemples ci-dessous puissent y faire référence :

```bash
export NIMBUS_KEY="nn_live_xxxxxxxxxxxxxxxx"
```

Les clés API sont propres à un seul projet. Le projet par défaut, créé avec votre compte, convient pour l’instant ; vous pourrez répartir vos charges de travail entre plusieurs projets plus tard, sans faire tourner vos clés.

## 2 · Choisir une région {#region}

NimbusNexus fonctionne dans quatre régions :

| Région          | Code             | Statut        |
| --------------- | ---------------- | ------------- |
| Virginie, US    | `us-east-1`      | Active        |
| Los Angeles, US | `us-west-1`      | Active        |
| Francfort, DE   | `eu-central-1`   | Active        |
| Singapour       | `ap-southeast-1` | Pré-lancement |

Choisissez celle qui est la plus proche de vos utilisateurs (ou de votre infrastructure existante). Le trafic entre les régions de NimbusNexus est gratuit ; le trafic sortant vers l’internet public est le seul transfert facturé.

Vous pouvez demander à tout moment la liste de référence à l’API :

```bash
curl {{API_BASE_URL}}/v1/regions \
  -H "Authorization: Bearer $NIMBUS_KEY"
```

## 3 · Créer votre première VM {#first-vm}

La plus petite VM utile pour un vrai travail est une `gp-1-2` — un vCPU, 2 GB de RAM, 25 GB de SSD. Elle coûte environ un centime de l’heure. Démarrez-en une en Virginie avec :

```bash
curl -X POST {{API_BASE_URL}}/v1/vms \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "quickstart",
    "size": "gp-1-2",
    "region": "us-east-1",
    "image": "ubuntu-24.04"
  }'
```

La réponse inclut l’identifiant de la VM et son état actuel. L’état sera `provisioning` pendant les premières secondes, puis `running` :

```json
{
  "id": "vm_01H...",
  "name": "quickstart",
  "size": "gp-1-2",
  "region": "us-east-1",
  "image": "ubuntu-24.04",
  "state": "provisioning",
  "ipv4": null,
  "created_at": "2026-05-19T18:30:00Z"
}
```

Interrogez la VM une fois par seconde jusqu’à ce que `state` soit `running` et que `ipv4` soit renseigné — cela prend environ 28 secondes avec une image en cache, ou 60–90 secondes lors d’un premier téléchargement.

## Récapitulatif {#summary}

Vous avez créé une clé API, choisi une région et provisionné une vraie machine virtuelle. Le même schéma en trois appels fonctionne pour chaque ressource de l’API : `POST` pour créer, `GET` pour lire, `DELETE` pour détruire. L’authentification, les codes de région et les identifiants de ressource sont stables d’un type de ressource à l’autre — l’API a été conçue pour que vous l’appreniez une fois et l’appliquiez à tout.

## Étapes suivantes {#next-steps}

- Parcourez la **référence de l’API** pour voir chaque endpoint avec ses paramètres, ses schémas de requête/réponse et ses codes d’erreur.
- Renseignez-vous sur l’**authentification** pour comprendre comment les clés API fonctionnent avec la portée par projet, les tokens qui expirent et la signature des webhooks.
- Lisez les **conventions** pour découvrir les règles que l’API suit partout — idempotence, pagination, formats d’erreur, opérations longues.
- Essayez l’**explorateur d’API interactif** sur [{{API_HOST}}/docs/external]({{API_BASE_URL}}/docs/external) — c’est un Swagger UI branché sur l’API réelle ; « Try it out » fait de vrais appels sur votre compte.

Quand vous avez terminé, détruisez la VM pour ne plus être facturé :

```bash
curl -X DELETE {{API_BASE_URL}}/v1/vms/vm_01H... \
  -H "Authorization: Bearer $NIMBUS_KEY"
```
