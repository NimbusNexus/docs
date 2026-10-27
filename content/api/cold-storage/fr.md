---
title: "Stockage à froid"
description: "Le tier d’archivage : le tarif par GB le plus bas, et une récupération facturée séparément."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: reference
---

# Stockage à froid

Le stockage à froid est le tier d’archivage — bon marché pour conserver, plus lent et facturé à la récupération. Choisissez-le quand vous ne lisez presque jamais les données : sauvegardes conservées sur le long terme, rétention pour la conformité, logs bruts pour les audits.

## Ce que vous payez {#pricing}

Trois composantes de coût, toutes mesurées séparément :

| Élément | Tarif | Quand vous payez |
| --- | --- | --- |
| **Stockage** | \$0.004/GB-mois | En continu, tant que l’archive existe |
| **Récupération** | \$0.02–\$0.05/GB | À chaque demande de restauration, selon la classe de récupération |
| **Frais de suppression anticipée** | par GB × jours restants | Si vous supprimez avant 90 jours |

Pour comparaison : le stockage objet Standard coûte \$0.013/GB-mois (3.25× le tarif) — et le stockage objet Standard n’a ni frais de récupération ni durée minimale de stockage. Le compromis : payer moins pour conserver, plus pour lire.

## Durée minimale de stockage {#min-duration}

Chaque archive entraîne une **facturation minimale de 90 jours de stockage**. Si vous supprimez une archive au bout de 30 jours, les 60 jours restants vous sont facturés lors de la suppression. C’est le même modèle qu’AWS Glacier ; c’est ce qui permet un tarif de stockage aussi bas.

En pratique : ne renouvelez pas sans cesse les objets du stockage à froid. Le bon schéma : écrire une fois, puis conserver, ou supprimer après 90 jours.

## Classes de récupération {#retrieval-classes}

| Classe | Latence | Coût par GB | Quand l’utiliser |
| --- | --- | --- | --- |
| `expedited` | 1–5 minutes | \$0.05 | Récupérations liées à la conformité ; audits ponctuels avec une échéance |
| `standard` | 3–5 heures | \$0.02 | Le choix par défaut ; économique pour les lectures non planifiées |
| `bulk` | 5–12 heures | \$0.005 | Restaurer des dizaines de TB ou plus en une nuit |

Une récupération ne sort pas définitivement les données de l’archive — elle en fait une copie temporaire dans le stockage objet Standard pendant 24 heures, accessible via une URL présignée. L’archive elle-même n’est pas modifiée.

## Quand NE PAS utiliser le stockage à froid {#when-not-to-use}

- Tout ce que vous pourriez lire plus d’environ une fois par trimestre — les frais de récupération dépassent les économies réalisées sur le stockage.
- Tout ce qui doit être lu rapidement — même la récupération `expedited` prend 1–5 minutes, pas quelques secondes.
- Les données dont le cycle de vie est court et connu d’avance — le minimum de 90 jours rend coûteux le renouvellement fréquent.

Dans ces trois cas, le [stockage objet](/docs/api/object-storage) avec la classe de stockage IA ou Cold convient mieux (frais de récupération plus bas, durée minimale plus courte ou nulle).

## Étapes suivantes {#next-steps}

- [Stockage objet](/docs/api/object-storage) — même famille de produits, pour des accès plus fréquents.
- [Snapshots](/docs/api/snapshots) — les snapshots de VM et de volumes sont stockés par défaut sur le tier froid.
