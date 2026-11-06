---
title: "Référence de l’API"
description: "Toutes les opérations de tous les produits NimbusNexus, apps et infrastructure, avec l’appel REST et l’appel SDK dans le langage de votre choix."
publishedAt: 2026-10-19
updatedAt: 2026-11-06
kind: reference
---

# Référence de l’API

Chaque produit NimbusNexus est une API REST, et toutes les opérations sont listées ici. Les Apps sont les produits managés que vous appelez depuis votre code : Webhooks, Inboxes, QR Codes et Request Bins. L’infrastructure, ce sont les ressources cloud de vos projets : VM, stockage, réseau et DNS.

Chaque opération montre sa requête dans le langage choisi en haut de la page. En REST, c’est `curl`. En TypeScript, Python et Go, vous obtenez l’appel SDK quand le produit a un SDK, et sinon le client HTTP habituel du langage. Vous vous authentifiez avec une clé API, dans le header `Authorization` sur les apps et dans le header `X-API-Key` sur l’infrastructure, à configurer comme indiqué dans [API REST](/docs/setup/rest). Sur les apps, les erreurs ont toutes le même format, décrit dans [Erreurs](/docs/errors) ; sur l’infrastructure, voir [Conventions](/docs/conventions#errors).
