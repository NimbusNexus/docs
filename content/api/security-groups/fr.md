---
title: "Groupes de sécurité"
description: "Ensembles de règles de pare-feu avec état, appliqués aux interfaces réseau des VM."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: reference
---

# Groupes de sécurité

Les groupes de sécurité sont des ensembles de règles de **pare-feu avec état**. Vous attachez un ou plusieurs groupes à l’interface réseau d’une VM ; c’est l’union des règles de tous les groupes qui s’applique. Comportement par défaut : **tout refuser en entrée, tout autoriser en sortie** — liste d’autorisation explicite pour le trafic entrant, sortie ouverte jusqu’à ce que vous en décidiez autrement.

## Ce que signifie « avec état » {#stateful}

Vous n’écrivez de règles que pour le sens **qui initie** la connexion. Si vous autorisez le TCP entrant sur le port 443, les paquets de réponse vers le client sont autorisés automatiquement — aucune règle sortante séparée n’est nécessaire pour le trafic de retour.

À comparer avec une ACL sans état (par exemple les Network ACLs d’AWS), où il faudrait des règles symétriques dans les deux sens. Les groupes de sécurité sont plus simples à appréhender pour le filtrage au niveau applicatif ; les ACL sans état sont plus simples à appréhender pour une politique de réseau tenant, à une couche sous la VM.

## Format des règles {#rules}

Chaque règle comporte :

- **Direction** — `ingress` ou `egress`
- **Protocole** — `tcp`, `udp`, `icmp` ou `any`
- **Plage de ports** — port unique (`80`), plage (`8000-9000`) ou « any »
- **Source / destination** — un bloc CIDR (`0.0.0.0/0`, `10.0.0.0/8`) OU l’identifiant d’un autre groupe de sécurité

Le mode « la source est un autre groupe de sécurité » est celui qu’il est le plus utile de connaître. Une règle comme « autoriser le port 5432 depuis `web-tier-sg` » permet à chaque VM du groupe `web-tier-sg` d’atteindre votre VM Postgres sur le port 5432 — sans avoir à énumérer les IP, et la règle continue de fonctionner à mesure que des VM entrent dans `web-tier-sg` ou en sortent lors des mises à l’échelle.

## Un schéma courant {#pattern}

Pour une application web à 3 tiers :

1. **`web-tier-sg`** — autorise en entrée `tcp/80` et `tcp/443` depuis `0.0.0.0/0` (public)
2. **`app-tier-sg`** — autorise en entrée `tcp/8080` depuis `web-tier-sg` (seul le tier web peut atteindre le tier applicatif)
3. **`db-tier-sg`** — autorise en entrée `tcp/5432` depuis `app-tier-sg` (seul le tier applicatif peut atteindre la base de données)

Ce schéma est composable ; vous pouvez ajouter un 4e groupe pour un VPN d’exploitation qui autorise SSH depuis les IP de votre bureau, et l’attacher à côté de `db-tier-sg` sur les VM de base de données sans toucher aux règles applicatives.

## Étapes suivantes {#next-steps}

- [Machines virtuelles](/docs/api/vms) — ce à quoi s’attachent les groupes de sécurité.
- [Réseaux](/docs/api/networks) et [Sous-réseaux](/docs/api/subnets) — les briques réseau que protègent les groupes de sécurité.
