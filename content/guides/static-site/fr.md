---
title: "Déployer un site statique"
description: "Le stockage objet comme hébergement — bucket, lecture publique, domaine personnalisé, ~5 minutes."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: guide
---

# Déployer un site statique

Le stockage objet compatible S3 sert aussi d’hébergement de site statique. Vous téléversez vos fichiers compilés dans un bucket, les marquez en lecture publique, faites pointer votre domaine vers l’URL du bucket, et vous obtenez un site statique servi par un CDN pour quelques centimes par mois.

Ce guide vous mène d’un répertoire `dist/` compilé (la sortie de n’importe quel générateur de site statique moderne — export Next.js, Astro, Hugo, HTML simple) à un site en ligne sur votre domaine.

## Prérequis {#prereqs}

- Un compte NimbusNexus avec une clé API.
- Un site compilé dans un répertoire `dist/` local.
- Un domaine que vous contrôlez (ou un sous-domaine fourni par NimbusNexus, pour sauter l’étape du domaine).
- `awscli` configuré pour communiquer avec le stockage objet NimbusNexus (ou tout client compatible S3 — `rclone`, `mc`, `s3cmd`).

```bash
export NIMBUS_KEY="nn_live_xxxxxxxxxxxxxxxx"
export BUCKET="my-site"
export REGION="us-east-1"
```

## 1 · Créer le bucket {#create-bucket}

```bash
curl -X POST {{API_BASE_URL}}/v1/buckets \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"$BUCKET\",
    \"region\": \"$REGION\",
    \"storage_class\": \"standard\",
    \"public_read\": true,
    \"website\": {
      \"enabled\": true,
      \"index_document\": \"index.html\",
      \"error_document\": \"404.html\"
    }
  }"
```

Le rôle de chaque option :

- `public_read: true` — n’importe qui sur internet peut faire un `GET` sur n’importe quel objet du bucket. Obligatoire pour l’hébergement statique ; le nom du bucket apparaît dans les URL.
- `website.enabled: true` — active le mode site statique. Le bucket sert alors le HTML avec le bon `Content-Type`, suit `index_document` pour les requêtes de répertoire et affiche `error_document` en cas de 4xx.

La réponse contient l’URL du bucket :

```json
{
  "id": "bkt_01HG7Y3...",
  "url": "https://my-site.{{S3_HOST_US_EAST_1}}",
  "website_endpoint": "https://my-site.{{S3_HOST_US_EAST_1}}"
}
```

## 2 · Configurer la CLI S3 {#configure-cli}

```bash
aws configure set aws_access_key_id $NIMBUS_KEY
aws configure set aws_secret_access_key $NIMBUS_SECRET
aws configure set region $REGION
aws configure set s3.endpoint_url {{S3_ENDPOINT_US_EAST_1}}
```

`$NIMBUS_SECRET` est la partie secrète d’une clé d’accès compatible S3, générée dans la console sous **Settings → Object Storage Keys → New key**. Ne la confondez pas avec la clé API habituelle — ce sont deux clés différentes.

## 3 · Téléverser votre site {#upload}

```bash
aws s3 sync ./dist s3://$BUCKET \
  --delete \
  --cache-control "public, max-age=3600" \
  --endpoint-url {{S3_ENDPOINT_US_EAST_1}}
```

`--delete` supprime du bucket les fichiers qui ne sont plus dans `./dist`. `--cache-control` définit un header de cache d’une heure sur chaque objet — assez long pour que les navigateurs ne retéléchargent pas les fichiers à chaque chargement de page, assez court pour ne pas avoir à invalider les caches à la main après la correction d’une coquille.

Pour les fichiers qui ne doivent JAMAIS être mis en cache (votre `index.html`) :

```bash
aws s3 cp ./dist/index.html s3://$BUCKET/index.html \
  --cache-control "no-cache, max-age=0" \
  --endpoint-url {{S3_ENDPOINT_US_EAST_1}}
```

Le principe : un cache long sur les assets hachés (`/_app/[hash].js`), no-cache sur le HTML d’entrée qui les référence. C’est le même principe que Vercel + Netlify + Cloudflare Pages appliquent en coulisses.

## 4 · Vérifier que tout fonctionne {#verify}

Ouvrez `https://my-site.{{S3_HOST_US_EAST_1}}` dans un navigateur. Vous devriez voir votre site.

Si vous voyez du XML à la place, l’endpoint du site web ne route pas correctement — le plus souvent parce que `public_read` ou `website.enabled` n’a pas été défini. Revérifiez la configuration du bucket :

```bash
curl {{API_BASE_URL}}/v1/buckets/$BUCKET \
  -H "Authorization: Bearer $NIMBUS_KEY"
```

## 5 · Domaine personnalisé (facultatif) {#custom-domain}

Ajoutez chez votre registrar un enregistrement DNS qui fait pointer votre domaine vers le bucket :

```text
www.example.com   CNAME   my-site.{{S3_HOST_US_EAST_1}}
```

Pour un domaine apex (`example.com` sans `www.`), les CNAME ne fonctionnent pas — les enregistrements CNAME à l’apex sont interdits par la RFC. Deux options :

1. Utiliser `www.example.com` comme domaine canonique et rediriger l’apex → www
2. Ajouter sur l’apex un enregistrement A qui pointe vers une [IP flottante](/docs/api/floating-ips) attachée à une petite VM qui fait la redirection (300 lignes de configuration nginx, ~$5/mois)

Une fois l’enregistrement DNS propagé (de 1 minute à 24 heures selon le TTL de votre registrar) :

```bash
curl -X PATCH {{API_BASE_URL}}/v1/buckets/$BUCKET \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "custom_domains": ["www.example.com"]
  }'
```

Le bucket accepte alors les requêtes avec `Host: www.example.com` et émet un certificat TLS pour ce nom d’hôte (fourni par Let’s Encrypt, renouvelé automatiquement).

## 6 · Mettre en place un pipeline de déploiement {#cd}

Ce qui précède est un déploiement ponctuel. Pour la CI/CD, le principe est le même `aws s3 sync`, lancé depuis une GitHub Action (ou n’importe quel runner de CI) :

```yaml
# .github/workflows/deploy.yml (abbreviated)
- name: Deploy
  run: |
    aws s3 sync ./dist s3://$BUCKET --delete --endpoint-url $ENDPOINT
  env:
    AWS_ACCESS_KEY_ID:     ${{ secrets.NIMBUS_S3_KEY }}
    AWS_SECRET_ACCESS_KEY: ${{ secrets.NIMBUS_S3_SECRET }}
    BUCKET:                my-site
    ENDPOINT:              {{S3_ENDPOINT_US_EAST_1}}
```

La plupart des systèmes de CI ont déjà des actions de déploiement compatibles S3 ; faites-les pointer vers notre endpoint et elles fonctionnent sans modification.

## Coût {#cost}

Stockage : $0.013/GB-mois en Standard. Un site de 50 MB coûte environ un centime par mois.

Egress : gratuit pour les 100 premiers GB/mois, $0.01/GB au-delà. Un site qui sert 100k pages vues à 200 KB par page représente 20 GB — toujours dans la tranche gratuite.

Par rapport à la même charge sur AWS CloudFront + S3 : en général 4–6× moins cher sur la ligne egress, comparable sur la ligne stockage.

## Étapes suivantes {#next-steps}

- [Référence du stockage objet](/docs/api/object-storage) — l’API complète des buckets.
- [Zones DNS](/docs/api/dns-zones) — héberger votre DNS directement sur NimbusNexus plutôt que chez votre registrar.
- [Stockage à froid](/docs/api/cold-storage) — pour la partie de vos données que vous ne lisez presque jamais (artefacts de build, anciennes versions).
