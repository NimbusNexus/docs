---
title: Deploy a static site
description: Object storage as a hosting target — bucket, public read, custom domain, ~5 minutes.
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: guide
---

# Deploy a static site

S3-compatible object storage doubles as a static-site host. You upload your built files to a bucket, mark them public-read, point your domain at the bucket's URL, and you have a CDN-backed static site at a few cents per month.

This guide takes you from a built `dist/` directory (the output of any modern static-site generator — Next.js export, Astro, Hugo, plain HTML) to a live site at your domain.

## Prereqs {#prereqs}

- A NimbusNexus account with an API key.
- A built site in a local `dist/` directory.
- A domain you control (or use a NimbusNexus-issued subdomain to skip the domain step).
- `awscli` configured to talk to NimbusNexus object storage (or any S3-compatible client — `rclone`, `mc`, `s3cmd`).

```bash
export NIMBUS_KEY="nn_live_xxxxxxxxxxxxxxxx"
export BUCKET="my-site"
export REGION="us-east-1"
```

## 1 · Create the bucket {#create-bucket}

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

What each option does:

- `public_read: true` — anyone on the internet can `GET` any object in the bucket. Required for static hosting; the bucket name appears in URLs.
- `website.enabled: true` — enables static-site mode. The bucket starts serving HTML with the right `Content-Type`, follows `index_document` for directory requests, and renders `error_document` on 4xx.

The response includes the bucket's URL:

```json
{
  "id": "bkt_01HG7Y3...",
  "url": "https://my-site.{{S3_HOST_US_EAST_1}}",
  "website_endpoint": "https://my-site.{{S3_HOST_US_EAST_1}}"
}
```

## 2 · Configure S3 CLI {#configure-cli}

```bash
aws configure set aws_access_key_id $NIMBUS_KEY
aws configure set aws_secret_access_key $NIMBUS_SECRET
aws configure set region $REGION
aws configure set s3.endpoint_url {{S3_ENDPOINT_US_EAST_1}}
```

`$NIMBUS_SECRET` is the secret half of an S3-compatible access key, generated in the dashboard at **Settings → Object Storage Keys → New key**. Don't confuse it with the regular API key — they're different.

## 3 · Upload your site {#upload}

```bash
aws s3 sync ./dist s3://$BUCKET \
  --delete \
  --cache-control "public, max-age=3600" \
  --endpoint-url {{S3_ENDPOINT_US_EAST_1}}
```

`--delete` removes files in the bucket that aren't in `./dist` anymore. `--cache-control` sets a 1-hour cache header on every object — long enough that browsers don't re-fetch on every page load, short enough that you don't have to bust caches manually on a typo fix.

For files that should NEVER cache (your `index.html`):

```bash
aws s3 cp ./dist/index.html s3://$BUCKET/index.html \
  --cache-control "no-cache, max-age=0" \
  --endpoint-url {{S3_ENDPOINT_US_EAST_1}}
```

Pattern: long cache on hashed assets (`/_app/[hash].js`), no-cache on the entry HTML that references them. Same pattern Vercel + Netlify + Cloudflare Pages use under the hood.

## 4 · Verify it works {#verify}

Visit `https://my-site.{{S3_HOST_US_EAST_1}}` in a browser. You should see your site.

If you see XML instead, the website endpoint isn't routing correctly — most often because `public_read` wasn't set or `website.enabled` wasn't set. Re-check the bucket config:

```bash
curl {{API_BASE_URL}}/v1/buckets/$BUCKET \
  -H "Authorization: Bearer $NIMBUS_KEY"
```

## 5 · Custom domain (optional) {#custom-domain}

Add a DNS record at your registrar pointing your domain at the bucket:

```text
www.example.com   CNAME   my-site.{{S3_HOST_US_EAST_1}}
```

For an apex domain (`example.com` without `www.`), CNAMEs don't work — apex CNAME records are illegal per RFC. Two options:

1. Use `www.example.com` as the canonical and redirect apex → www
2. Add an A record on the apex pointing at a [floating IP](/docs/api/floating-ips) attached to a tiny VM running a redirect (300 lines of nginx config, ~$5/mo)

Once the DNS record propagates (1 minute to 24 hours depending on your registrar's TTL):

```bash
curl -X PATCH {{API_BASE_URL}}/v1/buckets/$BUCKET \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "custom_domains": ["www.example.com"]
  }'
```

This tells the bucket to accept requests with `Host: www.example.com` and to issue a TLS cert for that hostname (Let's Encrypt-backed, auto-renewed).

## 6 · Wire up a deploy pipeline {#cd}

The above is the one-shot deploy. For CI/CD, the pattern is the same `aws s3 sync` from a GitHub Action (or any CI runner):

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

Most CI systems already have S3-compatible deploy actions; you point them at our endpoint and they work unchanged.

## Cost {#cost}

Storage: $0.013/GB-month standard. A 50 MB site costs about a penny a month.

Egress: free for the first 100 GB/month, $0.01/GB after that. A site serving 100k page views at 200 KB per page is 20 GB — still free tier.

Compared to the same workload on AWS CloudFront + S3: typically 4–6× cheaper at the egress line, similar at the storage line.

## Next steps {#next-steps}

- [Object storage reference](/docs/api/object-storage) — the full bucket API.
- [DNS zones](/docs/api/dns-zones) — host your DNS on NimbusNexus directly instead of at your registrar.
- [Cold storage](/docs/api/cold-storage) — for the parts of your storage you almost never read (build artifacts, old releases).
