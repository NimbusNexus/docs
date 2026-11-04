---
title: "Quotas"
description: "Limites par projet sur les VM, les vCPU, la RAM, le stockage, les IP flottantes et les autres ressources."
publishedAt: 2026-05-20
updatedAt: 2026-11-03
kind: reference
---

# Quotas

Les quotas sont des limites par projet qui bornent la quantité de chaque ressource qu’un projet peut détenir. Ils évitent les dépenses incontrôlées dues à des boucles accidentelles, et ils garantissent que la consommation d’un projet ne peut pas épuiser la capacité d’une région.

## Ce qui est soumis à quota {#what}

Les endpoints de quota couvrent quatre services. Chacun répond avec ses propres noms de quota, par exemple :

| Service | Ce qu’il limite | Exemples de noms de quota |
| --- | --- | --- |
| `nova` | VM | `instances`, `cores`, `ram` (en MB) |
| `cinder` | Stockage en bloc | `volumes`, `gigabytes`, `snapshots`, `backups` |
| `neutron` | Réseau | `network`, `subnet`, `port`, `router`, `floatingip`, `security_group` |
| `projects` | Projets de votre espace de travail | `max_projects` |

Lisez les valeurs par défaut avec `GET /api/v1/quota/{service}?defaults=true`. `max_projects` vaut `-1`, c’est-à-dire aucune limite, sauf si une limite a été définie pour votre espace de travail.

## Quota et consommation {#quota-vs-usage}

Les endpoints exposent les deux :

- `GET /api/v1/quota/{service}` — les **limites**, sous forme de dictionnaire qui associe un nombre à chaque nom de quota.
- `GET /api/v1/quota/{service}/usage` — la **consommation actuelle** : `used`, `reserved` et `limit` pour chaque nom de quota.

`{service}` vaut `nova`, `cinder`, `neutron` ou `projects`.

Vérifiez toujours la consommation avant une création en masse ; une requête qui vous ferait dépasser le quota échoue (comme le quota n’est pas limité dans le temps, réessayer ne sert à rien — vous devez supprimer quelque chose ou augmenter le quota).

## Augmenter un quota {#raising}

Demandez une augmentation avec `POST /api/v1/quota-request/` : indiquez le `service_name`, le `quota_name` et la `new_value`, et expliquez pourquoi dans `reason`. La demande porte sur votre projet actuel, ou sur votre espace de travail quand le service est `projects`. Elle exige le rôle `manager` ou `admin`, et chaque quota ne peut avoir qu’une seule demande ouverte à la fois.

Un administrateur NimbusNexus examine chaque demande à la main. Son approbation applique la nouvelle limite ; une demande peut aussi être rejetée ou vous être renvoyée pour modification. Dans tous les cas, la réponse arrive sous forme de [notification](/docs/api/notifications). `GET /api/v1/quota-request/list` liste vos demandes, et `PATCH` ou `DELETE /api/v1/quota-request/` modifie ou retire une demande ouverte.

## Quotas et régions {#regions}

Les chiffres de `nova`, `cinder` et `neutron` portent sur la région de votre session ; changez de région avec `GET /api/v1/account/rescope?region=<region_name>`. Le quota `projects` compte les projets de tout votre espace de travail. Les réponses sont de simples dictionnaires qui associent des nombres aux noms de quota, sans champ de région ni de portée.

## Étapes suivantes {#next-steps}

- [Projets](/docs/api/projects) — le conteneur auquel s’appliquent les quotas.
- [Authentification](/docs/authentication) — comment appeler ces endpoints.
- [Notifications](/docs/api/notifications) — là où arrive la réponse à une demande de quota.
