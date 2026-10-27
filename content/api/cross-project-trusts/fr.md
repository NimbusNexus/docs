---
title: "Délégations inter-projets"
description: "Des permissions accordées entre projets pour une durée limitée. La bonne brique pour l’automatisation inter-projets."
publishedAt: 2026-05-21
updatedAt: 2026-05-21
kind: reference
openapiTag: cross-project-trusts
---

# Délégations inter-projets

Une délégation accorde à un utilisateur d’un projet une permission temporaire d’agir dans un autre projet — sans que cet utilisateur ait besoin d’y être membre ou de disposer d’une clé API partagée. La délégation porte un rôle précis, une date d’expiration et une portée d’emprunt d’identité facultative.

Le cas d’usage type : un pipeline CI/CD identifié auprès du projet `shared-infra` qui doit déployer des ressources dans `acme-prod`. Sans délégation, vous devriez soit donner à la clé de la CI le rôle admin sur les deux projets (rayon d’impact trop large), soit copier des clés d’un projet à l’autre (pire). Avec une délégation, `shared-infra` émet une autorisation `vms:write` limitée dans le temps dans `acme-prod` ; les appels de la CI présentent la délégation en plus de leurs justificatifs d’identité habituels.

Les délégations respectent le modèle de sécurité — l’utilisateur qui accorde la délégation ne peut accorder que des rôles qu’il détient lui-même, et la délégation expire au plus tard en même temps que l’autorisation à partir de laquelle il délègue. Il n’existe aucune voie d’élévation de privilèges.

## Étapes suivantes {#next-steps}

- [Rôles](/docs/api/roles) — ce que transmet une délégation.
- [Utilisateurs](/docs/api/users) et [Projets](/docs/api/projects) — les deux extrémités d’une délégation.
- [Modèle de sécurité](/docs/security) — le contexte plus large de la conception IAM.
