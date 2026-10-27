---
title: "Demandes de région"
description: "Demandez l’accès à une région à laquelle vous n’avez pas accès actuellement, ou une augmentation de quota dans une région où vous l’avez déjà."
publishedAt: 2026-05-21
updatedAt: 2026-05-21
kind: reference
openapiTag: region-requests
---

# Demandes de région

Par défaut, les nouveaux comptes ont accès à une seule région (celle choisie à l’inscription). Ajouter l’accès à d’autres régions nécessite une demande de région — un court formulaire qui explique la charge de travail qui a besoin de la nouvelle région. La plupart des comptes de production sont approuvés en un jour ouvré ; ce contrôle existe pour la planification de capacité et pour repérer les comportements inhabituels (un tout nouveau compte qui demande de la capacité dans cinq régions dès le premier jour mérite une brève discussion).

Cet endpoint gère aussi les augmentations de quota — une demande pour relever le nombre de VM, de vCPU ou la limite de stockage dans une région à laquelle vous avez déjà accès. Même raison pour ce contrôle : les grosses demandes nécessitent une planification de capacité. Voir [Quotas](/docs/api/quotas) pour le modèle de quotas lui-même.

Ces endpoints existent pour qu’un déploiement automatisé puisse envoyer la demande sans attendre de réponse ; l’approbation reste manuelle de notre côté (c’est, par conception, l’un des rares recoins de l’API qui ne soit pas entièrement en libre-service).

## Étapes suivantes {#next-steps}

- [Régions](/docs/api/regions) — la liste des régions disponibles.
- [Quotas](/docs/api/quotas) — les limites par projet qu’une demande de région peut aussi ajuster.
- [Vue d’ensemble du compte](/docs/api/account-overview) — le contexte du compte pour l’accès aux régions.
