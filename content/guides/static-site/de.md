---
title: "Statische Site deployen"
description: "Objektspeicher als Hosting-Ziel — Bucket, öffentlicher Lesezugriff, eigene Domain, ~5 Minuten."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: guide
---

# Statische Site deployen

S3-kompatibler Objektspeicher eignet sich auch als Host für statische Sites. Sie laden Ihre gebauten Dateien in einen Bucket hoch, geben sie öffentlich zum Lesen frei, richten Ihre Domain auf die URL des Buckets aus und haben eine statische Site mit CDN für ein paar Cent pro Monat.

Diese Anleitung bringt Sie von einem gebauten Verzeichnis `dist/` (der Ausgabe eines beliebigen modernen Static-Site-Generators — Next.js-Export, Astro, Hugo, reines HTML) zu einer Live-Site unter Ihrer Domain.

## Voraussetzungen {#prereqs}

- Ein NimbusNexus-Konto mit einem API-Key.
- Eine gebaute Site in einem lokalen Verzeichnis `dist/`.
- Eine Domain, die Sie kontrollieren (oder Sie verwenden eine von NimbusNexus vergebene Subdomain und überspringen den Schritt mit der Domain).
- `awscli`, konfiguriert für den Objektspeicher von NimbusNexus (oder ein beliebiger S3-kompatibler Client — `rclone`, `mc`, `s3cmd`).

```bash
export NIMBUS_KEY="nn_live_xxxxxxxxxxxxxxxx"
export BUCKET="my-site"
export REGION="us-east-1"
```

## 1 · Bucket erstellen {#create-bucket}

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

Was die einzelnen Optionen bewirken:

- `public_read: true` — jeder im Internet kann jedes Objekt im Bucket per `GET` abrufen. Für statisches Hosting erforderlich; der Bucket-Name erscheint in URLs.
- `website.enabled: true` — aktiviert den Modus für statische Sites. Der Bucket liefert dann HTML mit dem richtigen `Content-Type` aus, verwendet `index_document` für Requests auf Verzeichnisse und rendert bei 4xx das `error_document`.

Die Antwort enthält die URL des Buckets:

```json
{
  "id": "bkt_01HG7Y3...",
  "url": "https://my-site.{{S3_HOST_US_EAST_1}}",
  "website_endpoint": "https://my-site.{{S3_HOST_US_EAST_1}}"
}
```

## 2 · S3-CLI konfigurieren {#configure-cli}

```bash
aws configure set aws_access_key_id $NIMBUS_KEY
aws configure set aws_secret_access_key $NIMBUS_SECRET
aws configure set region $REGION
aws configure set s3.endpoint_url {{S3_ENDPOINT_US_EAST_1}}
```

`$NIMBUS_SECRET` ist der geheime Teil eines S3-kompatiblen Access-Keys, den Sie im Dashboard unter **Settings → Object Storage Keys → New key** generieren. Verwechseln Sie ihn nicht mit dem regulären API-Key — das sind verschiedene Keys.

## 3 · Site hochladen {#upload}

```bash
aws s3 sync ./dist s3://$BUCKET \
  --delete \
  --cache-control "public, max-age=3600" \
  --endpoint-url {{S3_ENDPOINT_US_EAST_1}}
```

`--delete` entfernt Dateien im Bucket, die nicht mehr in `./dist` liegen. `--cache-control` setzt auf jedem Objekt einen Cache-Header von 1 Stunde — lang genug, dass Browser nicht bei jedem Seitenaufruf neu laden, und kurz genug, dass Sie nach einer Tippfehlerkorrektur keine Caches manuell invalidieren müssen.

Für Dateien, die NIE gecacht werden sollen (Ihre `index.html`):

```bash
aws s3 cp ./dist/index.html s3://$BUCKET/index.html \
  --cache-control "no-cache, max-age=0" \
  --endpoint-url {{S3_ENDPOINT_US_EAST_1}}
```

Muster: langes Caching für gehashte Assets (`/_app/[hash].js`), kein Caching für das Einstiegs-HTML, das auf sie verweist. Dasselbe Muster nutzen Vercel + Netlify + Cloudflare Pages intern.

## 4 · Prüfen, ob es funktioniert {#verify}

Öffnen Sie `https://my-site.{{S3_HOST_US_EAST_1}}` im Browser. Sie sollten Ihre Site sehen.

Wenn Sie stattdessen XML sehen, routet der Website-Endpoint nicht korrekt — meist, weil `public_read` oder `website.enabled` nicht gesetzt wurde. Prüfen Sie die Bucket-Konfiguration erneut:

```bash
curl {{API_BASE_URL}}/v1/buckets/$BUCKET \
  -H "Authorization: Bearer $NIMBUS_KEY"
```

## 5 · Eigene Domain (optional) {#custom-domain}

Legen Sie bei Ihrem Registrar einen DNS-Eintrag an, der Ihre Domain auf den Bucket verweist:

```text
www.example.com   CNAME   my-site.{{S3_HOST_US_EAST_1}}
```

Für eine Apex-Domain (`example.com` ohne `www.`) funktionieren CNAMEs nicht — CNAME-Einträge auf dem Apex sind laut RFC unzulässig. Zwei Optionen:

1. Verwenden Sie `www.example.com` als maßgebliche Adresse und leiten Sie den Apex → www weiter
2. Legen Sie auf dem Apex einen A-Eintrag an, der auf eine [Floating-IP](/docs/api/floating-ips) zeigt, die an einer kleinen VM mit einer Weiterleitung hängt (300 Zeilen nginx-Konfiguration, ~$5/Monat)

Sobald sich der DNS-Eintrag verbreitet hat (1 Minute bis 24 Stunden, je nach TTL Ihres Registrars):

```bash
curl -X PATCH {{API_BASE_URL}}/v1/buckets/$BUCKET \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "custom_domains": ["www.example.com"]
  }'
```

Damit akzeptiert der Bucket Requests mit `Host: www.example.com` und stellt ein TLS-Zertifikat für diesen Hostnamen aus (über Let's Encrypt, automatisch erneuert).

## 6 · Deployment-Pipeline einrichten {#cd}

Das oben Beschriebene ist das einmalige Deployment. Für CI/CD ist das Muster dasselbe `aws s3 sync`, aus einer GitHub Action (oder einem beliebigen CI-Runner):

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

Die meisten CI-Systeme haben bereits S3-kompatible Deploy-Actions; Sie richten sie auf unseren Endpoint aus, und sie funktionieren unverändert.

## Kosten {#cost}

Speicher: $0,013/GB-Monat in der Klasse Standard. Eine Site mit 50 MB kostet etwa einen Cent pro Monat.

Egress: kostenlos für die ersten 100 GB/Monat, danach $0,01/GB. Eine Site mit 100.000 Seitenaufrufen bei 200 KB pro Seite kommt auf 20 GB — noch im kostenlosen Kontingent.

Im Vergleich zum selben Workload auf AWS CloudFront + S3: beim Egress typischerweise 4–6× günstiger, beim Speicher ähnlich.

## Nächste Schritte {#next-steps}

- [Referenz für Objektspeicher](/docs/api/object-storage) — die vollständige Bucket-API.
- [DNS-Zonen](/docs/api/dns-zones) — hosten Sie Ihr DNS direkt bei NimbusNexus statt bei Ihrem Registrar.
- [Cold Storage](/docs/api/cold-storage) — für die Teile Ihres Speichers, die Sie fast nie lesen (Build-Artefakte, alte Releases).
