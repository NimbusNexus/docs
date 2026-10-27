---
title: "Politique de versionnage"
description: "Comment nous faisons évoluer l’API sans casser votre code."
publishedAt: 2026-05-20
updatedAt: 2026-10-15
kind: concept
---

# Politique de versionnage

L’API NimbusNexus est en **v1**, et elle restera en v1 indéfiniment. Les changements cassants ne sont pas livrés sur la v1 — ils le seraient derrière une nouvelle version (`v2`, etc.), et la v1 continuerait de fonctionner sans changement. C’est la même politique de versionnage que celle de Stripe, Twilio et AWS pour leurs API principales.

## Ce qu’est un changement cassant {#breaking}

Tout ce qui pourrait empêcher du code existant de fonctionner :

- Supprimer un endpoint
- Supprimer un champ d’une réponse
- Retirer un code de statut des réponses possibles d’un endpoint
- Renommer un champ
- Changer le type d’un champ (par exemple `string` → `number`)
- Changer le comportement par défaut d’un endpoint existant
- Durcir la validation des requêtes (un corps auparavant accepté et désormais rejeté)
- Ajouter un nouveau paramètre de requête obligatoire

Ces changements n’arrivent jamais sur `v1`. Point final.

> **Mis à jour le 2026-10-15.** Avant le lancement de la v1, des graphies d’erreur déjà en cours de renommage, et quelques changements qui les accompagnaient, ont été livrés sans la période de 12 mois décrite ci-dessous. Sur Inboxes : `invalid_request`, le `unauthorized` que l’API envoyait pour une clé qu’elle ne reconnaît pas ou ne peut pas vérifier, son `error` tout court, la raison `project` de `forbidden` et les clés `max_inboxes`, `max_http_bins`, `monthly_messages`, `plan` et `inbox_id` de `details`. Sur Webhooks : `internal`, `unprocessable` et `plan_violation`, le `402` que l’API envoyait pour un `max_attempts` au-dessus du plafond du plan et son `409` de rejeu en masse (tous deux devenus un `422`), ainsi que ses `details` de validation et ses types d’entrée. Deux champs de réponse d’Inboxes ont aussi été supprimés : `paid_plans_enabled` sur `GET /v1/plan`, qui valait alors `true` pour tous les espaces de travail, et le `project_id` d’une boîte, que l’API avait cessé de renseigner. [Erreurs](/docs/errors#renames) fait la correspondance pour chaque changement d’erreur. À partir du lancement de la v1, chaque changement suit cette page.

## Ce qu’est un changement additif {#additive}

Ce que nous livrerons sur `v1` sans prévenir :

- De nouveaux endpoints
- De nouveaux paramètres de requête facultatifs
- De nouveaux champs dans les réponses (vous devez ignorer les champs inconnus lors de l’analyse)
- De nouveaux codes d’erreur (vous devez traiter les valeurs inconnues de `error.code` comme la famille de leur code de statut)
- De nouveaux types d’événements de webhook
- De nouvelles valeurs d’enum (vous devez traiter les valeurs d’enum inconnues comme opaques)
- De nouveaux codes de statut de la famille que l’endpoint renvoie déjà

Nous documentons les changements additifs dans le [changelog](/changelog), mais ne les plaçons pas derrière un flag. Le code existant continue de fonctionner ; le nouveau code peut les adopter.

## Compatibilité ascendante (forward compatibility) — comment écrire du code qui dure {#forward-compat}

Trois règles :

**1. Ignorez les champs inconnus lors de l’analyse.** L’apparition d’un nouveau champ dans une réponse ne doit pas être une erreur pour votre client. La plupart des bibliothèques JSON se comportent ainsi par défaut.

```ts
// Correct
const { id, name, state } = await res.json()

// Wrong (will reject responses with new fields)
const allowedKeys = ['id', 'name', 'state']
for (const k of Object.keys(json)) {
  if (!allowedKeys.includes(k)) throw new Error('unknown field')
}
```

**2. Traitez les valeurs d’enum inconnues comme opaques.** Si vous faites des branchements sur `state`, gérez les valeurs connues ; pour les inconnues, affichez la chaîne brute et ne plantez pas.

```ts
switch (vm.state) {
  case 'running': return 'green'
  case 'stopped': return 'gray'
  case 'provisioning': return 'amber'
  default: return 'gray' // Don't throw, don't assume — we may add 'migrating'
}
```

**3. Basez-vous sur `error.code`, pas sur `status`.** Les codes de statut regroupent les erreurs (`4xx` contre `5xx`) ; `error.code` les distingue. Nous pouvons ajouter de nouveaux codes à des codes de statut existants ; votre code doit passer par un cas par défaut plutôt que de traiter les codes non reconnus comme des bugs fatals.

## Politique de dépréciation {#deprecation}

Nous faisons tout pour ne pas en avoir besoin sur la v1. Si un jour nous marquons un endpoint ou un champ comme déprécié :

- L’endpoint ou le champ continue de fonctionner sans changement pendant **au moins 12 mois**
- Un header `Deprecation` est ajouté aux réponses (RFC 9745)
- Un header `Sunset` porte la date de fin de vie
- La console signale, par projet, l’utilisation des endpoints dépréciés

Douze mois, c’est long. En pratique, aucune dépréciation n’a eu lieu sur la v1 depuis le lancement — l’évolution additive couvre la plupart des besoins.

## Quand la v2 sortira {#v2}

Si nous sortons un jour une v2 (nous n’en avons pas l’intention à court terme), le déploiement se ferait ainsi :

- La v2 lancée sur `/v2/...` à côté de `/v1/...` — les deux en service en parallèle
- La v1 continue de recevoir des corrections de bugs et de nouvelles fonctionnalités (additives) pendant au moins 24 mois
- La v2 a une URL de base distincte (`{{API_BASE_URL}}/v2/...`), pour que l’URL elle-même indique la version

Vous migreriez quand vous seriez prêt, pas quand vous y seriez forcé. La démarche consiste à utiliser les endpoints `/v2` dans le nouveau code et à migrer l’ancien code à votre rythme — pas de bascule à date fixe.

## Pourquoi c’est important {#why}

Une plateforme cloud dont l’API casse tous les deux ans n’est pas une infrastructure digne de confiance. La raison pour laquelle la v1 survivra à la plupart des autres contrats de la plateforme : le code des clients, les intégrations des partenaires et la distribution des SDK dépendent tous de la stabilité de cette surface. La casser sans prévenir serait le moyen le plus rapide de perdre la confiance.

Si vous constatez un jour un vrai changement cassant sur `v1` qui n’est pas passé par une nouvelle version : c’est un bug. Signalez-le au support et nous le corrigerons.

## Étapes suivantes {#next-steps}

- [Changelog](/changelog) — le journal continu des changements additifs.
- [Authentification](/docs/authentication) — l’interface la plus stable de l’API.
- [Conventions](/docs/conventions) — format des requêtes, codes de statut, familles d’erreurs.
