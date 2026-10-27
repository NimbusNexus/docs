---
title: "API Webhooks"
description: "Toutes les opérations de l’API REST Webhooks, avec l’appel REST, l’appel SDK en Python, TypeScript ou Go, et la commande nn-webhooks."
publishedAt: 2026-10-19
updatedAt: 2026-10-19
kind: reference
---

# API Webhooks

L’API REST derrière [Webhooks](/docs/product-webhooks) : publiez des événements, gérez les endpoints qui les reçoivent, et inspectez, relivrez et rejouez les livraisons. Chaque opération ci-dessous montre sa requête dans le langage choisi en haut de la page. Quand le [SDK](/docs/product-webhooks/sdks) ou la [CLI](/docs/product-webhooks/cli) propose l’opération, vous voyez cet appel ; sinon, vous voyez une simple requête HTTP.

Les appels demandent une clé API Webhooks, créée dans votre [console de compte]({{ACCOUNT_BASE_URL}}/api-keys). Sa portée détermine ce qu’elle peut faire : `admin` peut tout faire, `publish` peut seulement publier et `read` peut seulement lire. Les écritures rattachées à un projet s’appliquent au projet par défaut de l’espace de travail, sauf si vous passez `project_id`.
