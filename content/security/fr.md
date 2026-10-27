---
title: "Modèle de sécurité"
description: "Comment clés, portées, projets et journaux d’audit se combinent pour limiter le rayon d’impact."
publishedAt: 2026-05-20
updatedAt: 2026-10-16
kind: concept
---

# Modèle de sécurité

La sécurité de NimbusNexus repose sur quatre piliers : les clés API sont le seul moyen de s’authentifier, les projets sont l’unité d’isolation, les portées restreignent ce que chaque clé peut faire et les journaux d’audit enregistrent tout ce qui compte. Cette page est la vue d’ensemble conceptuelle ; chaque élément a sa propre page de référence pour les détails.

## La frontière de confiance {#trust-boundary}

Un projet unique est la frontière de confiance. Au sein d’un projet, chaque appelant autorisé peut agir sur chaque ressource. D’un projet à l’autre, rien ne peut agir sur rien — les projets ne partagent ni réseaux, ni autorisations IAM, ni quotas.

C’est voulu. Si deux charges de travail doivent être isolées l’une de l’autre (la production du staging, le client A du client B), placez-les dans des projets différents. N’essayez pas d’assurer l’isolation par des portées ou des étiquettes à l’intérieur d’un même projet — les portées restreignent ce qu’une seule clé peut faire, mais une clé admin compromise dans le projet garde un accès complet.

## Clés API {#api-keys}

Le seul justificatif d’identité qu’accepte l’API est une clé API. Pas de flux OAuth par utilisateur, pas de flux de signature JWT, pas de mTLS — uniquement des clés Bearer. Pourquoi un seul mécanisme : chaque type de justificatif supplémentaire ajoute de la surface d’attaque (flux d’émission, flux de révocation, propagation), et nous préférons rendre parfaitement étanche celui que nous avons.

Les clés sont :

- **Par projet.** Une clé propre au projet `acme-prod` ne peut rien lire dans `acme-staging`, même depuis le même compte.
- **De longue durée, avec rotation possible.** Une clé créée aujourd’hui reste valide jusqu’à ce que vous la fassiez tourner ou la révoquiez. La rotation prévoit une fenêtre de recouvrement de 24 heures pour que vous puissiez déployer la nouvelle clé sans interruption.
- **Créées uniquement depuis la console.** Aucune API pour créer des clés. Une clé compromise ne peut pas servir à amorcer une autre clé — la récupération doit passer par un canal hors bande.

Voir [Authentification](/docs/authentication) pour le format des requêtes, la liste des portées, le processus de rotation et les codes d’erreur.

## Portées {#scopes}

Chaque clé porte un ensemble de portées qui limitent ce qu’elle peut faire dans son projet. La liste complète suit les types de ressources :

- `vms:read`, `vms:write`, `vms:create`, `vms:delete`
- `databases:*`, `block-storage:*`, `object-storage:*`, `iam:*`, ...

Les portées forment un système additif : une clé a l’union de toutes les portées qui lui ont été accordées. Pas de négation, pas de règles de priorité, pas de rôles à démêler.

La bonne méthode : **commencer étroit, élargir en cas d’échec**. Créez la clé avec uniquement les portées dont vous savez avoir besoin ; laissez l’application échouer avec `403 forbidden` (`details.reason` vaut `scope`) si vous en avez oublié une, puis ajoutez-la. Cela détecte les erreurs du type « j’ai donné les droits admin à mon job de CI par erreur » pendant le développement, pas en production.

## Projets {#projects}

Les projets sont la brique d’isolation la plus forte — ils sont à la fois la frontière des ressources, la frontière de facturation et la frontière du contrôle d’accès. Un utilisateur admin sur le projet `acme-prod` ne peut pas voir les ressources du projet `acme-staging`, à moins d’y être aussi admin (ou d’y avoir une portée quelconque).

La plupart des équipes veulent **au moins un projet par environnement** (`prod`, `staging`, `dev`). La raison : une clé de dev compromise ne doit pas pouvoir atteindre les données de production. Encore mieux : un projet par combinaison environnement + service (`acme-prod-api`, `acme-prod-batch`), pour qu’une fuite de justificatif dans le job batch ne permette pas de lire les données clients de l’API.

Voir [Projets](/docs/api/projects) pour le format de la ressource et le fonctionnement de la hiérarchie.

## Modèle réseau {#network}

Par défaut, une VM est isolée. Pour accéder à internet en sortie, attachez une [IP flottante](/docs/api/floating-ips) ou placez la VM dans un réseau doté d’un routeur. Pour accepter du trafic entrant, attachez l’IP flottante et (en général) placez un [groupe de sécurité](/docs/api/security-groups) devant, pour un filtrage par pare-feu avec état.

Le réseau inter-projets n’existe pas. Une VM du projet `acme-prod` ne peut pas envoyer de trafic à une VM du projet `acme-staging`, point final, même par des IP privées — le commutateur virtuel sous-jacent impose l’isolation au niveau du projet. Si vous avez besoin d’une communication inter-projets (c’est rare), la bonne méthode consiste à « exposer une API publique et l’appeler via internet » — la même frontière de confiance que si les deux charges de travail appartenaient à des entreprises différentes.

Le peering VPC et les briques réseau inter-projets similaires pourraient arriver plus tard ; aujourd’hui, ils n’existent pas, et c’est une contrainte délibérée.

## Journaux d’audit {#audit}

Chaque requête authentifiée qui modifie un état est journalisée avec :

- `request_id` — le même identifiant que celui qui apparaît dans les réponses d’erreur
- `key_id` — la clé qui a fait l’appel (préfixe + 4 derniers caractères, jamais le secret complet)
- `user_id` — l’utilisateur qui a créé la clé
- `operation` — `vms.create`, `database.delete`, etc.
- `resource_id` — la ressource concernée
- `project_id` — le projet
- `result` — `success`, `validation_error`, `unauthorized`, etc.
- `client_ip` — l’IP source
- `timestamp` — ISO 8601 UTC

Les journaux d’audit sont disponibles dans la console, avec filtre + export, et via l’API d’audit IAM. La rétention est de **365 jours** sur les niveaux Free et Starter, de **2 ans** sur Production et configurable sur Enterprise.

Les `GET` sont journalisés pour les ressources signalées comme sensibles (IAM, facturation, moyens de paiement) ; ils ne le sont pas pour les lectures courantes (lister les VM), afin de garder un volume de logs gérable. La liste des « lectures sensibles » est documentée sur la page de référence IAM.

## Données au repos {#at-rest}

- **Volumes block :** AES-256-XTS avec des clés par volume, gérées par nous. Les clés de chiffrement gérées par le client (CMK) sont sur la feuille de route ; pas encore disponibles.
- **Stockage objet :** AES-256 côté serveur par défaut ; SSE-C (clés fournies par le client) et SSE-KMS (CMK via KMS) disponibles.
- **Sauvegardes + snapshots :** même chiffrement que le volume/l’objet source.
- **Sauvegardes de bases de données :** même chiffrement + le chiffrement au repos propre au moteur de base de données, s’il est activé.

## Données en transit {#in-transit}

Tout le trafic de l’API passe en TLS 1.3 (TLS 1.2 accepté ; les versions plus anciennes sont rejetées à la passerelle). Les connexions au stockage objet et aux bases de données utilisent TLS 1.3, avec une rotation automatique de nos certificats. Les livraisons de webhooks que nous vous envoyons utilisent TLS ; nous n’acceptons pas d’URL en `http://` simple pour les endpoints de webhooks.

## Signaler une vulnérabilité {#disclosure}

Vous avez trouvé un problème de sécurité ? N’ouvrez pas d’issue GitHub (c’est public) et n’envoyez pas de ticket de support ordinaire (tri plus lent). Le [formulaire de signalement de sécurité]({{BASE_URL}}/contact/security) arrive directement à l’équipe sécurité, accepte les messages chiffrés avec PGP et fait l’objet d’un accusé de réception sous 24 heures.

Les conditions de safe harbor se trouvent sur [{{BASE_URL}}/legal/security-policy]({{BASE_URL}}/legal/security-policy). La recherche menée de bonne foi est la bienvenue.

## Étapes suivantes {#next-steps}

- [Authentification](/docs/authentication) — comment les clés, les portées et la rotation fonctionnent en pratique.
- [Projets](/docs/api/projects) — l’unité d’isolation.
- [Webhooks de la plateforme](/docs/webhooks) — sécuriser les livraisons entrantes que nous envoyons à vos endpoints.
