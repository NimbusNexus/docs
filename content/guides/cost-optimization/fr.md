---
title: "Optimiser votre facture mensuelle"
description: "Les cinq leviers les plus efficaces si votre facture NimbusNexus est plus élevée que prévu."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: guide
---

# Optimiser votre facture mensuelle

Si votre facture NimbusNexus est plus élevée que prévu, d’après notre expérience, 90 % du surcoût vient des cinq mêmes postes. Les passer en revue dans l’ordre prend environ 30 minutes et permet en général d’économiser 30–60 % de la facture.

L’ordre compte — les leviers les plus efficaces d’abord.

## 1 · Les VM arrêtées oubliées {#stopped-vms}

Les VM arrêtées coûtent encore ~10 % de leur coût en fonctionnement (vous payez le disque + l’IP réservée). Trois mois d’une `gp-8-32` arrêtée coûtent à peu près autant qu’un mois d’une `gp-8-32` en marche.

Trouvez-les :

```bash
curl "{{API_BASE_URL}}/v1/vms?state=stopped" \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  | jq '.items[] | { id, name, stopped_at, size }'
```

Pour chacune, décidez :

- **Arrêtée il y a < 1 semaine et vous savez pourquoi** → n’y touchez pas, c’est une candidate pour un retour arrière.
- **Arrêtée il y a > 2 semaines, sans savoir pourquoi** → prenez-en un snapshot (pour garder l’image disque), puis `DELETE`.
- **Arrêtée il y a > 1 mois** → supprimez-la. Ce qu’elle contenait ne servira plus pour un retour arrière.

```bash
# Snapshot first
curl -X POST {{API_BASE_URL}}/v1/snapshots \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{ \"source_vm_id\": \"$VM_ID\", \"name\": \"archive-$(date +%Y-%m-%d)\" }"

# Then delete the VM
curl -X DELETE {{API_BASE_URL}}/v1/vms/$VM_ID \
  -H "Authorization: Bearer $NIMBUS_KEY"
```

Le snapshot coûte bien moins cher que la VM arrêtée (le stockage des snapshots est à $0.04/GB ; les IP réservées et le disque réservé d’une VM arrêtée coûtent plus).

## 2 · Les IP flottantes non attachées {#unattached-ips}

Les IP flottantes non attachées coûtent $2.50/mois chacune — autant qu’une IP attachée à une VM arrêtée. La ligne de facture est faible par IP, mais les comptes ouverts depuis un moment en accumulent.

```bash
curl "{{API_BASE_URL}}/v1/floating-ips?state=detached" \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  | jq '.items[] | { id, ipv4, region, allocated_at }'
```

Libérez toutes celles dont vous n’avez pas d’usage actif :

```bash
curl -X DELETE {{API_BASE_URL}}/v1/floating-ips/$IP_ID \
  -H "Authorization: Bearer $NIMBUS_KEY"
```

Si vous risquez de vouloir récupérer la même IPv4 plus tard (parce qu’elle est autorisée quelque part ailleurs), notez quelles IP étaient les vôtres avant de les libérer. Nous ne réservons pas les IP libérées — elles retournent dans le pool régional. Il n’existe aucun moyen de « geler » une IP sans la garder allouée.

## 3 · Les VM surdimensionnées {#over-provisioned}

Une VM qui tourne en permanence à 5–10 % de CPU paie 10× ce dont elle a besoin. Lancez `node_exporter` (ou consultez simplement le graphique par VM de la console) et cherchez les VM dont le P99 CPU sur 90 jours est inférieur à ~30 %.

Pour chaque VM surdimensionnée, la bonne décision dépend du profil de trafic :

- **Trafic faible et stable** → réduisez la taille. `POST /v1/vms/$ID/resize` vers une taille plus petite. Prend ~30 secondes. Le redimensionnement à chaud est possible au sein d’une même famille (`gp-4-16` → `gp-2-8` fonctionne ; `gp-4-16` → `co-4-8` nécessite un arrêt, un redimensionnement puis un redémarrage, car l’architecture change).
- **Trafic en pics** → envisagez les tailles Compute optimized (famille `co-`) ; elles ont des ratios CPU/RAM plus élevés. Moins chères par vCPU pour les charges limitées par le CPU.
- **VM GPU sans rien sur le GPU** → quittez complètement la famille `gx-`. Les VM GPU sont 5–10× plus chères ; si vous n’utilisez pas le GPU, vous jetez de l’argent par les fenêtres.

## 4 · Classe de stockage objet inadaptée {#storage-class}

Le stockage objet a trois classes :

| Classe | Prix du stockage | Prix de récupération | Usage |
|---|---|---|---|
| Standard | $0.013/GB-mois | Gratuit | Données chaudes (lues souvent) |
| Infrequent Access (IA) | $0.007/GB-mois | $0.005/GB | Données tièdes (lues chaque mois) |
| Cold | $0.004/GB-mois | Plus élevé, selon la classe (Expedited, Standard, Bulk) | Archives (lues rarement) |

La plupart des comptes laissent tout en Standard par défaut et n’y reviennent jamais. Le levier :

```bash
# What buckets do you have, and what class?
curl {{API_BASE_URL}}/v1/buckets \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  | jq '.items[] | { name, region, storage_class, size_gb }'
```

Pour chaque bucket, regardez le timestamp du dernier accès aux plus gros objets (l’« object explorer » de la console l’affiche). Tout ce qui n’a pas été lu depuis un mois devrait être en IA ; tout ce qui n’a pas été lu depuis 6 mois devrait probablement être en Cold.

Vous n’avez pas à déplacer les objets un par un à la main — définissez une règle lifecycle :

```bash
curl -X PUT {{API_BASE_URL}}/v1/buckets/$BUCKET/lifecycle \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "rules": [
      {
        "id": "tier-warm",
        "filter": { "prefix": "archive/" },
        "transitions": [
          { "after_days": 30,  "storage_class": "infrequent-access" },
          { "after_days": 180, "storage_class": "cold" }
        ]
      }
    ]
  }'
```

Les données changent ainsi automatiquement de classe en vieillissant. C’est la solution la moins chère pour les charges du type « je produis ces données une fois et je les relis rarement » (logs, artefacts de build, anciens rapports).

## 5 · Les snapshots dont vous n’avez plus besoin {#stale-snapshots}

Les snapshots coûtent $0.04/GB-mois — bien moins cher que le disque d’une VM, mais ils s’accumulent vite si vous en prenez un chaque nuit sans jamais les supprimer. Un snapshot de 200 GB conservé un an coûte $96.

```bash
curl "{{API_BASE_URL}}/v1/snapshots?older_than_days=180" \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  | jq '.items[] | { id, name, size_gb, created_at, source_vm_id }'
```

Trois règles empiriques pour la rétention des snapshots :

- **Snapshots quotidiens** d’une VM de production → gardez-en 14, supprimez le reste.
- **Snapshots hebdomadaires** → gardez-en 8 (deux mois).
- **Snapshots mensuels** → gardez-en 12 (un an). Au-delà, ne gardez que ceux de fin d’année.

Mettez en place une [politique de sauvegarde planifiée](/docs/api/backups) qui intègre ces règles de rétention, pour que cela ne grossisse plus jamais sans limite.

## Rappels sur le modèle tarifaire {#reminders}

Quelques points qui surprennent les nouveaux clients :

- **Le trafic intra-région entre ressources NimbusNexus est gratuit.** Deux VM de `us-east-1` qui communiquent entre elles ne paient pas d’egress. Le trafic inter-région entre ressources NimbusNexus est aussi gratuit (une différence voulue avec AWS, où c’est la ligne de facture la plus surprenante).
- **Le trafic sortant vers internet coûte $0.01/GB au-delà des 100 premiers GB/mois.** Par rapport à AWS (où il coûte $0.09/GB), cela compte dès que vous servez un volume non négligeable de contenu public.
- **Facturation à la seconde pour les VM.** Une VM qui tourne 90 secondes coûte 1.5 minute. Pas d’arrondi à l’heure entamée. Les charges de courte durée (runners de CI, jobs batch) sont donc vraiment bon marché — ne compliquez pas votre architecture pour « réduire le nombre d’exécutions » si elles sont courtes.
- **Le crédit de bienvenue n’est versé qu’une fois.** Les nouveaux comptes reçoivent un crédit ; il ne se renouvelle pas. Si vous faites beaucoup de tests, surveillez le solde de crédit dans la console.

## Examiner la facture elle-même {#invoice}

La page de facturation de la console détaille les lignes de la facture par ressource et par jour. Le filtre « top 10 costs » est le bon point de départ si vous ne savez pas encore ce qui coûte cher — il s’agit presque toujours d’une ou deux lignes démesurées, pas d’une multitude de petites dépenses.

Si vous voulez la facture au format JSON :

```bash
curl {{API_BASE_URL}}/v1/billing/invoices/current \
  -H "Authorization: Bearer $NIMBUS_KEY"
```

La réponse contient des projections de coût par ressource pour le reste du mois : vous pouvez ainsi agir sur ce qui coûte cher *maintenant* plutôt que de le découvrir en fin de mois.

## Étapes suivantes {#next-steps}

- [Machines virtuelles](/docs/api/vms) — `resize` pour le cas des VM surdimensionnées.
- [Stockage objet](/docs/api/object-storage) — les règles lifecycle en détail.
- [Snapshots](/docs/api/snapshots) et [Sauvegardes](/docs/api/backups) — la syntaxe des politiques de rétention.
- [Quotas](/docs/api/quotas) — le tableau des limites par projet (distinct de la facturation, mais lié).
