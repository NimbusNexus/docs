---
title: "Démarrage rapide"
description: "Générez une clé API, consultez vos options et créez votre première VM."
publishedAt: 2026-05-19
updatedAt: 2026-11-04
kind: quickstart
---

# Démarrage rapide

Ce guide vous mène d’un compte connecté à la console à une machine virtuelle en marche, en quelques appels d’API. Tout ce que vous faites ici est réversible : supprimez la VM quand vous avez terminé. Une VM est facturée de sa création à sa suppression, alors ne la laissez pas tourner par mégarde ; les prix se trouvent dans [Données tarifaires](/docs/api/pricing-data).

## Avant de commencer {#prereqs}

Il vous faut trois choses :

- Un compte NimbusNexus. Inscrivez-vous sur [{{ROOT_DOMAIN}}]({{BASE_URL}}/register).
- L’outil en ligne de commande `curl`, ou le client HTTP de votre choix, et `jq` pour lire les réponses. Les exemples de cette page utilisent `curl` ; les mêmes appels fonctionnent dans n’importe quel langage.
- Environ cinq minutes.

Vous n’avez pas encore besoin d’avoir configuré SSH : cette VM démarre sans clé. Pour vous connecter à une VM plus tard, enregistrez d’abord une clé ([Clés SSH](/docs/api/ssh-keys)) et indiquez son nom dans `sshs` quand vous créez la VM.

## 1 · Générer une clé API {#api-key}

Connectez-vous à la console et allez dans **Sécurité → Jetons API → Créer un jeton**. Donnez au jeton un nom que vous reconnaîtrez plus tard (par exemple `quickstart`) et choisissez la portée **Admin**, qui crée une clé sans restriction. Les deux autres portées créent une clé sans règle d’accès, et cette clé ne peut que lire sa propre session. Copiez en lieu sûr la valeur intitulée **Clé API**, et non **Secret** — vous ne la voyez qu’une fois.

Exportez-la comme variable d’environnement pour que les exemples ci-dessous puissent y faire référence :

```bash
export NIMBUS_KEY="<your-api-key>"
```

Envoyez-la dans le header `X-API-Key` à chaque appel. Les clés API sont propres à un seul projet. Le projet par défaut, créé avec votre compte, convient pour l’instant. [Authentification](/docs/authentication#scopes) couvre les clés limitées aux appels dont elles ont besoin.

## 2 · Consulter vos options {#region}

NimbusNexus dessert aujourd’hui une seule région, à Francfort, en Allemagne : il n’y a donc pas de région à choisir ; [Régions](/docs/api/regions) donne les détails. Demandez à l’API ce que vous pouvez y créer :

```bash
curl -s {{API_BASE_URL}}/api/v1/instance/artifacts \
  -H "X-API-Key: $NIMBUS_KEY" \
  | jq '.data | {
      images: [.images.data[] | { id, name }],
      vm_options: [.vm_options.data[] | { architecture: .label, vm_classes: [.children[]?.label] }],
      networks: [.networks.data[] | { id, name, external, subnets: [.subnets[].cidr] }],
      security_groups: [.security_groups.data[] | { id, name }]
    }'
```

Le type de volume du disque de démarrage vient d’un second appel :

```bash
curl -s {{API_BASE_URL}}/api/v1/storage/artifacts \
  -H "X-API-Key: $NIMBUS_KEY" \
  | jq '[.data.volume_options.data[].label]'
```

Choisissez une option de chaque sorte et exportez-les. Les images, les réseaux et les groupes de sécurité se désignent par leur `id` ; les architectures, les classes de VM et les types de volume, par leur libellé. Choisissez un réseau avec `external: false` qui a un sous-réseau : rejoindre un réseau externe exige aussi `bandwidth_mbps` et `subscription.bandwidth`, et sans eux, l’appel répond `400`.

```bash
export IMAGE_ID="<image-id>"
export ARCHITECTURE="<architecture>"
export VM_CLASS="<vm-class>"
export VOLUME_TYPE="<volume-type>"
export NETWORK_ID="<network-id>"
export SECURITY_GROUP_ID="<security-group-id>"
```

## 3 · Créer votre première VM {#first-vm}

La forme d’une VM, c’est son nombre de `cpu` et sa `ram` en MB. Son disque de démarrage fait `volume_size` GB. Démarrez-en une avec un vCPU, 2 GB de RAM et un disque de 25 GB :

```bash
curl -X POST {{API_BASE_URL}}/api/v1/instance/ \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"quickstart\",
    \"image\": \"$IMAGE_ID\",
    \"spec\": {
      \"architecture\": \"$ARCHITECTURE\",
      \"vm_class\": \"$VM_CLASS\",
      \"cpu\": 1,
      \"ram\": 2048,
      \"volume_type\": \"$VOLUME_TYPE\"
    },
    \"volume_size\": 25,
    \"network\": [\"$NETWORK_ID\"],
    \"security_group\": [\"$SECURITY_GROUP_ID\"]
  }"
```

Pour une forme qui n’est pas proposée avec cette architecture et cette classe, l’appel répond `400` ; [Données tarifaires](/docs/api/pricing-data) liste celles qui le sont. Sinon, l’appel met le travail en file d’attente et répond sans identifiant :

```json
{
  "success": true
}
```

Retrouvez la nouvelle VM par son nom et lisez son `status` :

```bash
curl -s {{API_BASE_URL}}/api/v1/instance/ \
  -H "X-API-Key: $NIMBUS_KEY" \
  | jq '.data[] | select(.name == "quickstart") | { id, status, nics, fault }'
```

`status` vaut d’abord `BUILD`, puis `ACTIVE`, avec les adresses de la VM dans `nics` :

```json
{
  "id": "3f0c9e1a-6b7d-4c2e-9a51-7d2b8f4e1c60",
  "status": "ACTIVE",
  "nics": {
    "my-network": [
      { "addr": "10.0.0.12", "version": 4, "OS-EXT-IPS:type": "fixed" }
    ]
  },
  "fault": null
}
```

Interrogez la VM de temps en temps jusqu’à ce que `status` soit `ACTIVE`. S’il vaut `ERROR`, `fault` indique ce qui a échoué. Enregistrez l’identifiant :

```bash
export VM_ID="<vm-id>"
```

## Récapitulatif {#summary}

Vous avez créé une clé API, consulté vos options et provisionné une vraie machine virtuelle. Beaucoup de ressources fonctionnent de la même façon : un appel `artifacts` liste vos options, `POST` crée et `GET` lit. La suppression varie selon la ressource : consultez donc sa page de référence. La clé API et le header sont les mêmes partout sur `{{API_HOST}}`.

## Étapes suivantes {#next-steps}

- Parcourez la **référence de l’API** pour voir chaque endpoint avec ses paramètres, ses schémas de requête/réponse et ses codes d’erreur.
- Attachez une [IP flottante](/docs/api/floating-ips) pour joindre la VM depuis internet.
- Renseignez-vous sur l’**authentification** pour comprendre comment les clés API fonctionnent avec la portée par projet, les rôles et les règles d’accès.
- Lisez les **conventions** pour découvrir les règles que l’API suit — pagination, formats d’erreur, travail qui se termine après la réponse.
- Essayez l’**explorateur d’API interactif** sur [{{API_HOST}}/docs/external]({{API_BASE_URL}}/docs/external) — c’est un Swagger UI branché sur l’API réelle ; « Try it out » fait de vrais appels sur votre compte.

Quand vous avez terminé, supprimez la VM pour ne plus être facturé. Son volume de démarrage est supprimé avec elle :

```bash
curl -X POST {{API_BASE_URL}}/api/v1/instance/action \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{ \"servers\": [\"$VM_ID\"], \"cmd\": \"delete\" }"
```
