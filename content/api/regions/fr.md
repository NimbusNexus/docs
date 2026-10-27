---
title: "Régions"
description: "Les emplacements géographiques desservis par NimbusNexus, actifs ou en pré-lancement."
publishedAt: 2026-05-19
updatedAt: 2026-05-19
kind: reference
---

# Régions

Une région NimbusNexus est un emplacement géographique qui compte au moins une zone de disponibilité. Chaque ressource que vous créez — VM, bases de données managées, volumes, buckets — vit dans exactement une région. Les opérations inter-région (réplication, basculement, trafic entre ressources) fonctionnent, mais elles sont explicites et facturées.

## Régions actuelles {#current}

| Code | Emplacement | Statut |
| --- | --- | --- |
| `us-east-1` | Virginie, US | Active |
| `us-west-1` | Los Angeles, US | Active |
| `eu-central-1` | Francfort, DE | Active |
| `ap-southeast-1` | Singapour | Pré-lancement (~2 mois) |

La liste de référence est aussi servie par `GET /v1/regions` ; le tableau ci-dessus est donné à titre d’illustration. Au moment où vous lisez cette page, c’est la réponse de l’API qui fait foi.

## Comment choisir une région {#picking}

Trois éléments comptent :

1. **La latence vers vos utilisateurs.** Choisissez la région la plus proche de l’endroit d’où viennent la plupart de vos requêtes. Sous 50 ms d’aller-retour, l’expérience paraît réactive ; au-delà de 200 ms, elle paraît lente, même avec du bon code.

2. **La latence vers vos dépendances.** Si vous appelez d’autres services (bases de données, API tierces, votre propre infrastructure), placez la VM dans la région la plus proche d’eux. Les allers-retours entre calcul et stockage ont lieu à chaque requête ; les allers-retours entre l’utilisateur et le calcul ont lieu une fois par chargement de page.

3. **Les exigences de résidence des données.** Le RGPD / la DSGVO / les lois sur les données au niveau des États peuvent imposer l’endroit où les données des clients doivent résider. La région de Francfort (`eu-central-1`) est l’option de résidence dans l’UE ; `us-east-1` et `us-west-1` assurent toutes deux une résidence aux États-Unis. Nous ne répliquons pas de données entre régions sans votre demande explicite.

Si vos utilisateurs sont répartis dans le monde entier, **déployez dans plusieurs régions**. Un schéma courant : `us-east-1` pour les Amériques + `eu-central-1` pour la zone EMEA + `ap-southeast-1` pour la zone APAC, avec un routage basé sur le DNS (selon la latence, selon la géolocalisation, ou avec un CDN en frontal).

## Régions en pré-lancement {#preview}

Les régions en `status: 'preview'` acceptent des charges de travail avant la disponibilité générale. Concrètement :

- Elles acceptent les mêmes appels d’API que les régions actives.
- Les tarifs sont les mêmes que dans les régions actives.
- Le SLA ne s’applique **pas** pendant la préversion — des incidents peuvent encore provoquer des pannes pendant que nous rodons la région.
- La disponibilité générale arrive en général ~2 mois après l’ouverture de la préversion. Nous prévenons les admins du compte par e-mail avant de faire passer une région à `live`.

Singapour (`ap-southeast-1`) est la région actuellement en préversion.

## Étapes suivantes {#next-steps}

- Voir [Machines virtuelles](/docs/api/vms) pour créer une VM dans une région précise.
- Voir [Bases de données managées](/docs/api/managed-databases) pour la disponibilité des bases de données selon les régions (dans les nouvelles régions, Kafka et OpenSearch arrivent ~30 jours après les VM et Postgres).
- Pour les architectures multi-région avec réplication, voir le guide **Basculement multi-région** (bientôt disponible).
