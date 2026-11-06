---
title: "Modèle de sécurité"
description: "Comment clés API, rôles, règles d’accès et projets se combinent pour limiter le rayon d’impact."
publishedAt: 2026-05-20
updatedAt: 2026-11-06
kind: concept
---

# Modèle de sécurité

Sur l’API d’infrastructure, trois choses limitent ce qu’un justificatif d’identité peut faire : les projets sont l’unité d’isolation, les rôles indiquent ce qu’une clé peut faire sur son projet, et les règles d’accès restreignent les appels qu’elle peut faire. Cette page est la vue d’ensemble conceptuelle ; chaque élément a sa propre page de référence pour les détails.

## La frontière de confiance {#trust-boundary}

Un projet unique est la frontière de confiance. Au sein d’un projet, chaque appelant autorisé peut agir sur chaque ressource. D’un projet à l’autre, rien ne peut agir sur rien, à moins que vous n’ouvriez l’accès : une ressource appartient à un seul projet, les quotas sont par projet et une clé fonctionne dans un seul projet.

C’est voulu. Si deux charges de travail doivent être isolées l’une de l’autre (la production du staging, le client A du client B), placez-les dans des projets différents. N’essayez pas d’assurer l’isolation par des règles d’accès à l’intérieur d’un même projet : elles restreignent ce qu’une seule clé peut faire, mais une autre clé du projet, avec des règles plus larges, garde un accès complet.

## Justificatifs d’identité {#api-keys}

L’API accepte deux types de justificatif d’identité : une **clé API** dans le header `X-API-Key`, pour les outils et les scripts, et une **session connectée**, pour une personne dans la console.

Les clés sont :

- **Par projet.** Une clé propre au projet `acme-prod` ne peut rien lire dans `acme-staging`, même depuis le même compte.
- **Personnelles.** Chaque clé appartient à la personne qui l’a créée et agit avec des rôles que cette personne détient.
- **Créées depuis une session connectée**, dans la console ou avec `POST /api/v1/api_keys/`.
- **Valables jusqu’à ce que vous les supprimiez**, ou jusqu’au `expires_at` que vous leur avez donné. Il n’existe pas d’appel de rotation : pour remplacer une clé, créez la nouvelle, passez vos outils dessus, puis supprimez l’ancienne.

Voir [Authentification](/docs/authentication) pour le format des requêtes et les détails.

## Rôles et règles d’accès {#scopes}

Une clé agit avec des `roles` sur son projet, et ses `access_rules` limitent les appels qu’elle peut faire : chaque règle indique un service, une méthode et un chemin. `unrestricted: true` signifie qu’il n’y a aucune règle d’accès : la clé peut donc faire tout appel que ses rôles permettent. Une clé qui n’a ni l’un ni l’autre ne peut que lire sa propre session.

La bonne méthode : **commencer étroit, élargir en cas d’échec**. Créez la clé avec uniquement les appels dont vous savez avoir besoin. Un appel hors de ceux-ci répond `403`, et vous créez alors une nouvelle clé qui l’inclut. Cela détecte les erreurs du type « j’ai donné les droits admin à mon job de CI par erreur » pendant le développement, pas en production.

## Projets {#projects}

Les projets sont la brique d’isolation la plus forte : ils sont à la fois la frontière des ressources et la frontière du contrôle d’accès. La facturation se fait par espace de travail. Une personne qui a un rôle sur le projet `acme-prod` ne peut pas voir les ressources du projet `acme-staging`, à moins d’y détenir aussi un rôle.

La plupart des équipes veulent **au moins un projet par environnement** (`prod`, `staging`, `dev`). La raison : une clé de dev compromise ne doit pas pouvoir atteindre les données de production. Encore mieux : un projet par combinaison environnement + service (`acme-prod-api`, `acme-prod-batch`), pour qu’une fuite de justificatif dans le job batch ne permette pas de lire les données clients de l’API.

Voir [Projets](/docs/api/projects) pour les détails.

## Modèle réseau {#network}

Une VM sur un réseau privé n’est pas joignable depuis internet. Pour accéder à internet en sortie, connectez le réseau à un [routeur](/docs/api/routers) doté d’une passerelle externe. Pour accepter du trafic entrant, attachez une [IP flottante](/docs/api/floating-ips). Chaque VM a au moins un [groupe de sécurité](/docs/api/security-groups), qui refuse tout le trafic entrant jusqu’à ce que vous l’autorisiez.

Les réseaux appartiennent à un seul projet. Une VM du projet `acme-prod` ne peut pas envoyer de trafic à une VM du projet `acme-staging` par des IP privées, à moins que vous ne partagiez un réseau entre eux avec le [partage de réseau](/docs/api/network-sharing). Il n’y a pas de peering entre les réseaux des projets. Sinon, la méthode consiste à « exposer une API publique et l’appeler via internet », la même frontière de confiance que si les deux charges de travail appartenaient à des entreprises différentes.

## Données en transit {#in-transit}

L’API est servie en HTTPS. Sur le produit [Webhooks](/docs/product-webhooks), les livraisons utilisent aussi TLS : l’URL d’un endpoint doit être en `https`.

## Signaler une vulnérabilité {#disclosure}

Vous avez trouvé un problème de sécurité ? N’ouvrez pas d’issue GitHub (c’est public) et n’envoyez pas de ticket de support ordinaire (tri plus lent). Le [formulaire de signalement de sécurité]({{BASE_URL}}/contact/security) arrive directement à l’équipe sécurité, accepte les messages chiffrés avec PGP et fait l’objet d’un accusé de réception sous 24 heures.

Les conditions de safe harbor se trouvent sur [{{BASE_URL}}/legal/security-policy]({{BASE_URL}}/legal/security-policy). La recherche menée de bonne foi est la bienvenue.

## Étapes suivantes {#next-steps}

- [Authentification](/docs/authentication) — comment les clés, les rôles et les règles d’accès fonctionnent en pratique.
- [Projets](/docs/api/projects) — l’unité d’isolation.
- [Partage de réseau](/docs/api/network-sharing) — la façon contrôlée de connecter les réseaux de deux projets.
