---
title: "Types d’événements"
description: "Le catalogue des noms d’événements d’un espace de travail, la politique pour les noms qu’il n’a jamais vus et des JSON Schema facultatifs auxquels les payloads doivent correspondre."
publishedAt: 2026-10-19
updatedAt: 2026-10-19
kind: concept
---

# Types d’événements

Chaque événement a un type — `order.created`, `stripe.invoice.paid` — et les endpoints [s’abonnent](/docs/product-webhooks#objects) aux types par motif. Le catalogue des types d’événements est la liste des noms qu’utilise votre espace de travail, avec pour chacun une description et un JSON Schema facultatifs. C’est aussi là que vous décidez de ce qui se passe quand arrive un nom que personne n’a enregistré.

## Faut-il enregistrer les types ? {#register}

Non — pas avec la politique par défaut. Avec **Lenient**, tout type que vous publiez (ou qu’une [source](/docs/product-webhooks/sources) reçoit) est accepté et ajouté au catalogue la première fois qu’il apparaît. La plupart des espaces de travail n’enregistrent jamais un type à la main.

Enregistrez-en un quand vous voulez :

- le **décrire** pour ceux qui développent à partir de vos webhooks ;
- **vérifier ses payloads** par rapport à un JSON Schema (ci-dessous) ;
- ou passer à **Strict**, où seuls les types enregistrés peuvent être publiés.

Dans tous les cas, la correspondance des abonnements d’endpoints se fait sur le nom ; un abonnement à `order.` n’a pas besoin que `order.created` figure dans le catalogue.

## La politique pour les types non enregistrés {#policy}

| Politique | Un type non enregistré… |
|---|---|
| **Lenient** (par défaut) | est accepté et ajouté au catalogue. |
| **Strict** | est refusé avec `422 unknown_event_type`. |

Strict convient à un espace de travail où l’ensemble des types est un contrat — une faute de frappe chez un producteur échoue alors bruyamment à la publication, au lieu de créer en silence un type auquel aucun endpoint n’est abonné. La requête d’une source refusée de cette façon apparaît comme `unknown_event_type` dans les [requêtes capturées](/docs/product-webhooks/captured-requests#outcomes).

La politique se définit pour l’espace de travail et peut être définie par projet (`PUT /v1/event-types/policy`, avec `?project_id=` pour un projet). Dans la console, c’est le contrôle **When an unregistered type arrives** de la page Event types, et il suit le sélecteur de projet.

## Schémas de payload {#schemas}

Un type peut porter un [JSON Schema](https://json-schema.org/) (draft 7). Dès lors, chaque publication de ce type est vérifiée par rapport à lui, et un payload qui n’y correspond pas est refusé avec `422 invalid_payload`, avec la liste de ce qui a échoué.

```bash
curl -sX POST {{WEBHOOKS_BASE_URL}}/v1/event-types \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{
        "name": "order.created",
        "description": "A customer placed an order",
        "payload_schema": {
          "type": "object",
          "required": ["order_id", "total"],
          "properties": {"order_id": {"type": "string"}, "total": {"type": "integer"}}
        }
      }'
```

Les schémas sont vérifiés à l’enregistrement : un schéma qui n’est pas un JSON Schema valide, ou dont les expressions régulières pourraient rendre la mise en correspondance extrêmement lente, est refusé avec une explication.

## Types pour tout l’espace de travail et types par projet {#scope}

Un type enregistré sans projet s’applique à tous les projets. Un type enregistré avec `project_id` ne s’applique qu’à ce projet, et y prime sur une entrée de même nom valable pour tout l’espace de travail — un projet peut ainsi avoir sa propre description ou un schéma plus strict. La colonne **Applies to** de la console indique lequel est lequel.

## D’où vient un type {#origin}

| Origine | Dans la console | Comment il est arrivé là |
|---|---|---|
| `manual` | added here | Enregistré dans la console ou avec `POST /v1/event-types`. |
| `ingest` | from a source | Arrivé pour la première fois par une source, sous Lenient. |
| `lenient` | auto-added | Publié pour la première fois via l’API, sous Lenient. |

## `webhook.received` {#webhook-received}

Si le catalogue liste `webhook.received` alors que vous ne l’avez jamais publié : une source a reçu des requêtes dont elle n’a pas pu lire le type, et n’avait aucun type par défaut sur lequel se rabattre. Donnez un type par défaut à cette source, ou indiquez-lui le header ou le chemin JSON qui porte le type — voir [Types d’événements d’une source](/docs/product-webhooks/sources#event-types).

## Étapes suivantes {#next-steps}

- [Sources](/docs/product-webhooks/sources) — comment une source lit le type dans la requête d’un fournisseur.
- [Vue d’ensemble de Webhooks](/docs/product-webhooks) — les abonnements et les autres objets.
- [Erreurs](/docs/errors) — `unknown_event_type`, `invalid_payload` et les autres.
