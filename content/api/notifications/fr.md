---
title: "Notifications"
description: "Préférences de notification par compte — ce que nous vous envoyons par e-mail et ce que vous faites passer par des webhooks."
publishedAt: 2026-05-21
updatedAt: 2026-05-21
kind: reference
openapiTag: notifications
---

# Notifications

Les préférences de notification déterminent quels événements déclenchent un e-mail vers quel contact, et lesquels déclenchent à la place une livraison de webhook (ou en plus). Les catégories comprennent les alertes de facturation, les événements de sécurité, les avertissements de quota, les annonces de maintenance planifiée et les sorties de nouvelles fonctionnalités.

Les valeurs par défaut sont raisonnables — la facturation et la sécurité vont toujours au contact de facturation / de sécurité, quelles que soient les préférences. Les catégories configurables sont les catégories opérationnelles : fenêtres de maintenance, seuils de quota, annonces de fonctionnalités en bêta, etc.

Pour les équipes plus grandes, le schéma habituel consiste à acheminer les notifications opérationnelles par webhooks vers votre système de gestion des incidents (PagerDuty, Opsgenie) plutôt que par e-mail vers un seul contact. L’acheminement par webhook utilise ici la même sémantique de livraison que celle décrite dans la page [Webhooks de la plateforme](/docs/webhooks).

## Étapes suivantes {#next-steps}

- [Webhooks de la plateforme](/docs/webhooks) — le canal de livraison pour l’acheminement autre que par e-mail.
- [Vue d’ensemble du compte](/docs/api/account-overview) — là où se trouvent les contacts de facturation et de sécurité.
