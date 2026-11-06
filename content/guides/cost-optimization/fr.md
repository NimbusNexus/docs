---
title: "Optimiser votre facture mensuelle"
description: "Où part votre facture d’infrastructure, et comment trouver les ressources que vous pouvez cesser de payer."
publishedAt: 2026-05-20
updatedAt: 2026-11-06
kind: guide
---

# Optimiser votre facture mensuelle

Ce que vous payez sur NimbusNexus, c’est surtout ce que vous avez alloué, que vous l’utilisiez ou non : VM, volumes, IP flottantes, ports publics et leur bande passante, et images personnalisées. Quand une facture est plus élevée que prévu, cherchez donc d’abord ce qui est encore alloué et dont vous n’avez plus besoin. Ce guide passe ces postes en revue, avec les appels qui permettent de trouver chacun d’eux.

Les prix se trouvent dans [Données tarifaires](/docs/api/pricing-data). La facturation se fait par espace de travail, alors qu’une clé API fonctionne dans un projet : répétez donc ces appels pour chaque projet de l’espace de travail.

## Prérequis {#prereqs}

- `curl` et `jq`, avec `$NIMBUS_KEY` défini sur une [clé API](/docs/authentication) qui peut faire ces appels.

```bash
export NIMBUS_KEY="<your-api-key>"
```

Les appels ci-dessous qui suppriment ou modifient quelque chose utilisent les identifiants affichés par les listes, sous la forme `$VM_ID`, `$FLOATING_IP_ID`, `$VOLUME_ID` et `$PORT_ID`.

## 1 · Les VM arrêtées oubliées {#stopped-vms}

Arrêter une VM n’arrête pas sa facturation : une VM est facturée de sa création à sa suppression ([Machines virtuelles](/docs/api/vms#lifecycle)). Trouvez celles qui sont arrêtées :

```bash
curl -s {{API_BASE_URL}}/api/v1/instance/ \
  -H "X-API-Key: $NIMBUS_KEY" \
  | jq '.data[] | select(.status == "SHUTOFF") | { id, name, vcores, memory }'
```

Une VM arrêtée reste une candidate valable pour un retour arrière pendant quelque temps, comme dans un [déploiement blue/green](/docs/guides/blue-green#stop-blue). Quand ce n’est plus le cas, supprimez-la :

```bash
curl -X POST {{API_BASE_URL}}/api/v1/instance/action \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{ \"servers\": [\"$VM_ID\"], \"cmd\": \"delete\" }"
```

Supprimer une VM supprime le volume de démarrage créé à partir de son image, et c’est irréversible : copiez donc d’abord ailleurs tout ce dont vous avez encore besoin. Les volumes que vous avez attachés ensuite restent, et l’étape 3 les retrouve.

## 2 · Les IP flottantes sans rien derrière elles {#unattached-ips}

Une IP flottante est facturée de sa création à sa suppression, qu’elle soit attachée ou non ([IP flottantes](/docs/api/floating-ips#billing)). Trouvez celles qui ne sont pas attachées :

```bash
curl -s {{API_BASE_URL}}/api/v1/floating_ip/ \
  -H "X-API-Key: $NIMBUS_KEY" \
  | jq '.data[] | select(.port_id == null) | { id, ip_address, description }'
```

Supprimez celles dont vous n’avez pas besoin, en listant leurs identifiants dans `ids` :

```bash
curl -X DELETE {{API_BASE_URL}}/api/v1/floating_ip/ \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{ \"ids\": [\"$FLOATING_IP_ID\"] }"
```

Si une adresse figure ailleurs dans une liste d’autorisation, changez cela d’abord : une fois qu’une adresse est supprimée, vous ne la récupérerez peut-être pas.

## 3 · Les volumes qu’aucune VM n’utilise {#volumes}

Un volume est facturé de la même façon, qu’il soit attaché ou non ([Stockage en bloc](/docs/api/block-storage#lifecycle)). Les volumes qui survivent à leur VM sont faciles à oublier. Trouvez-les :

```bash
curl -s {{API_BASE_URL}}/api/v1/storage/ \
  -H "X-API-Key: $NIMBUS_KEY" \
  | jq '.data[] | select(.status == "available") | { id, name, size, type }'
```

Un volume supprimé est impossible à récupérer : [sauvegardez-le](/docs/api/backups#create) donc d’abord si vous risquez de vouloir ses données. Supprimez-le ensuite :

```bash
curl -X DELETE {{API_BASE_URL}}/api/v1/storage/ \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{ \"ids\": [\"$VOLUME_ID\"] }"
```

## 4 · Les VM surdimensionnées {#over-provisioned}

Le prix d’une VM dépend de son `architecture`, de sa `vm_class`, de son `cpu` et de sa `ram`. Si le CPU et la mémoire d’une VM restent bas en permanence, elle peut tourner sur une forme plus petite. Mesurez avant de décider : [Surveiller une flotte de VM](/docs/guides/monitoring-vms) met en place les métriques.

Redimensionnez avec une nouvelle `spec` ; [Démarrage rapide](/docs/quickstart#region) montre d’où viennent `$ARCHITECTURE` et `$VM_CLASS`. La VM redémarre sur la nouvelle forme et attend dans l’état `VERIFY_RESIZE` :

```bash
curl -X POST {{API_BASE_URL}}/api/v1/instance/$VM_ID/resize \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"spec\": {
      \"architecture\": \"$ARCHITECTURE\",
      \"vm_class\": \"$VM_CLASS\",
      \"cpu\": 2,
      \"ram\": 4096
    }
  }"
```

Vérifiez la VM sous une charge réelle, puis conservez la nouvelle forme, ou revenez en arrière avec `revert_resize` :

```bash
curl -X POST {{API_BASE_URL}}/api/v1/instance/$VM_ID/confirm_resize \
  -H "X-API-Key: $NIMBUS_KEY"
```

[Tailles de VM](/docs/api/vm-sizes#resizing) donne les détails.

## 5 · Les ports publics et la bande passante {#bandwidth}

Un port sur le réseau externe est facturé jusqu’à ce que vous le supprimiez, et sa bande passante est facturée avec lui, tout comme la bande passante de la passerelle externe d’un routeur ([Ports réseau](/docs/api/network-ports), [Routeurs](/docs/api/routers)). Une VM qui n’a pas besoin d’être joignable depuis internet peut plutôt se trouver sur un réseau privé ([Configuration réseau d’un projet](/docs/guides/networking-setup)).

Listez les ports du réseau externe ; `GET /api/v1/floating_ip/artifacts` liste les réseaux externes :

```bash
curl -s "{{API_BASE_URL}}/api/v1/portal/port/?network_id=$EXTERNAL_NETWORK_ID" \
  -H "X-API-Key: $NIMBUS_KEY" \
  | jq '.data[] | { id, name, device_id, status }'
```

Un port dont le `device_id` est vide n’est attaché à rien. Supprimez-le avec `DELETE /api/v1/portal/port/{port_id}`.

Si vous avez besoin du port, mais pas de toute sa bande passante, réduisez-la avec `POST /api/v1/bandwidth/resize`, qui change la limite d’un port, d’une IP flottante ou d’une passerelle de routeur, et sa facturation en même temps. `bandwidth_mbps` doit être un multiple de 10 :

```bash
curl -X POST {{API_BASE_URL}}/api/v1/bandwidth/resize \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"resource_type\": \"port\",
    \"resource_id\": \"$PORT_ID\",
    \"bandwidth_mbps\": 100,
    \"bandwidth_subscription\": \"Monthly\"
  }"
```

## 6 · Les images personnalisées {#images}

Une image personnalisée est facturée au GB, arrondi au GB entier supérieur, comme un produit à part entière ([Images de VM](/docs/api/vm-images)). Listez vos images privées, puis supprimez avec `DELETE /api/v1/image/` celles à partir desquelles plus rien ne démarre :

```bash
curl -s "{{API_BASE_URL}}/api/v1/image/?visibility=private" \
  -H "X-API-Key: $NIMBUS_KEY" \
  | jq '.data[] | { id, name, size, created_at }'
```

## Examiner la facture elle-même {#invoice}

`GET /api/v1/billing/public/balances` montre les frais restant dus, le crédit promotionnel et le solde prépayé de votre espace de travail, et `GET /api/v1/billing/public/accrued_charges` le total facturé jusqu’à présent qui n’a pas encore été réglé. Ces appels prennent une session connectée, pas une clé API, et les factures elles-mêmes ne sont pas disponibles via l’API ([Facturation](/docs/api/invoices)).

## Étapes suivantes {#next-steps}

- [Données tarifaires](/docs/api/pricing-data) — ce que coûte chacune de ces ressources.
- [Facturation](/docs/api/invoices) — vos soldes et les frais non réglés.
- [Tailles de VM](/docs/api/vm-sizes) — les formes, et le redimensionnement en détail.
- [Sauvegardes](/docs/api/backups) — copier un volume avant de le supprimer, et la durée pendant laquelle les planifications conservent les copies.
- [Quotas](/docs/api/quotas) — les limites de ressources par projet, qui sont distinctes de la facturation.
