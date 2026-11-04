---
title: "Régions"
description: "Les régions desservies par NimbusNexus, et comment votre session en choisit une."
publishedAt: 2026-05-19
updatedAt: 2026-11-03
kind: reference
---

# Régions

Une région NimbusNexus est un emplacement géographique qui compte au moins une zone de disponibilité. Chaque ressource que vous créez — VM, volumes, buckets — vit dans exactement une région.

## Régions actuelles {#current}

L’environnement de production dessert aujourd’hui une seule région, à Francfort, en Allemagne.

`GET /api/v1/account/datacenters` liste les régions, chacune avec son `region_name`, un `label` et un `order` d’affichage, et un indicateur `healthy` ; `current` est la région de votre session. `GET /api/v1/account/rescope?region=<region_name>` fait passer la session dans une autre région. C’est la réponse de l’API qui fait foi.

## Comment choisir une région {#picking}

Trois éléments comptent :

1. **La latence vers vos utilisateurs.** Choisissez la région la plus proche de l’endroit d’où viennent la plupart de vos requêtes. Sous 50 ms d’aller-retour, l’expérience paraît réactive ; au-delà de 200 ms, elle paraît lente, même avec du bon code.

2. **La latence vers vos dépendances.** Si vous appelez d’autres services (bases de données, API tierces, votre propre infrastructure), placez la VM dans la région la plus proche d’eux. Les allers-retours entre calcul et stockage ont lieu à chaque requête ; les allers-retours entre l’utilisateur et le calcul ont lieu une fois par chargement de page.

3. **Les exigences de résidence des données.** Le RGPD / la DSGVO / les lois sur les données au niveau des États peuvent imposer l’endroit où les données des clients doivent résider. L’unique région actuelle se trouve à Francfort, en Allemagne.

## Étapes suivantes {#next-steps}

- [Machines virtuelles](/docs/api/vms) — une VM est créée dans la région actuelle de votre session.
- [Vue d’ensemble du compte](/docs/api/account-overview) — là où sont documentés la liste des régions et le basculement de la session.
- [Demandes de région](/docs/api/region-requests) — demander une région qui n’est pas encore desservie.
