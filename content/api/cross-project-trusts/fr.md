---
title: "Délégations inter-projets"
description: "Des délégations de courte durée qui permettent à NimbusNexus d’agir pour vous sur un projet, pour les tâches en file d’attente et les identifiants du stockage objet."
publishedAt: 2026-05-21
updatedAt: 2026-11-03
kind: reference
openapiTag: cross-project-trusts
---

# Délégations inter-projets

Une délégation est une autorisation de courte durée que vous accordez, sur l’un de vos projets, à l’utilisateur de service propre à NimbusNexus. NimbusNexus en crée une lorsqu’il doit terminer un travail pour vous après le retour de votre appel, comme la création ou la suppression d’une VM mise en file d’attente ou la création d’un volume, et lorsque vous émettez un identifiant du stockage objet. La fiche d’une délégation indique le `trustor_user_id` (vous), le `trustee_user_id` (NimbusNexus), le `project_id`, les `roles` (`member` sur chaque délégation que crée NimbusNexus), un `expires_at` et un indicateur `impersonation`.

La délégation que vous créez de votre propre initiative est un identifiant du stockage objet. `POST /api/v1/object_storage/credentials` en émet un pour votre projet actuel et renvoie son `trust_id`. Un éditeur autonome présente cet ID dans le header `X-Trust-Id` lors des appels au stockage objet : il accède ainsi au stockage du projet sans détenir votre token complet. `ttl_seconds` n’est qu’une indication ; le serveur le plafonne.

`GET /api/v1/trusts/` liste vos délégations, et `GET /api/v1/trusts/{trust_id}` en lit une. `DELETE /api/v1/trusts/{trust_id}` en révoque une, par exemple un identifiant de stockage dont vous n’avez plus besoin.

## Étapes suivantes {#next-steps}

- [Rôles](/docs/api/roles) — ce que transmet une délégation.
- [Utilisateurs](/docs/api/users) et [Projets](/docs/api/projects) — les deux extrémités d’une délégation.
- [Stockage objet](/docs/api/object-storage) — là où s’utilise un identifiant de stockage.
- [Modèle de sécurité](/docs/security) — le contexte plus large de la conception IAM.
