---
title: "Despliega un sitio estático"
description: "El almacenamiento de objetos como destino de hosting — bucket, lectura pública, dominio propio, ~5 minutos."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: guide
---

# Despliega un sitio estático

El almacenamiento de objetos compatible con S3 también sirve como hosting de sitios estáticos. Subes los archivos compilados a un bucket, los marcas como de lectura pública, apuntas tu dominio a la URL del bucket y tienes un sitio estático respaldado por un CDN por unos céntimos al mes.

Esta guía te lleva de un directorio `dist/` compilado (la salida de cualquier generador moderno de sitios estáticos — Next.js export, Astro, Hugo, HTML plano) a un sitio en producción en tu dominio.

## Requisitos previos {#prereqs}

- Una cuenta de NimbusNexus con una clave de API.
- Un sitio compilado en un directorio `dist/` local.
- Un dominio que controles (o usa un subdominio emitido por NimbusNexus para saltarte el paso del dominio).
- `awscli` configurado para hablar con el almacenamiento de objetos de NimbusNexus (o cualquier cliente compatible con S3 — `rclone`, `mc`, `s3cmd`).

```bash
export NIMBUS_KEY="nn_live_xxxxxxxxxxxxxxxx"
export BUCKET="my-site"
export REGION="us-east-1"
```

## 1 · Crea el bucket {#create-bucket}

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

Qué hace cada opción:

- `public_read: true` — cualquiera en internet puede hacer `GET` de cualquier objeto del bucket. Obligatorio para el hosting estático; el nombre del bucket aparece en las URLs.
- `website.enabled: true` — activa el modo de sitio estático. El bucket empieza a servir HTML con el `Content-Type` correcto, usa `index_document` para las peticiones de directorios y muestra `error_document` en los 4xx.

La respuesta incluye la URL del bucket:

```json
{
  "id": "bkt_01HG7Y3...",
  "url": "https://my-site.{{S3_HOST_US_EAST_1}}",
  "website_endpoint": "https://my-site.{{S3_HOST_US_EAST_1}}"
}
```

## 2 · Configura la CLI de S3 {#configure-cli}

```bash
aws configure set aws_access_key_id $NIMBUS_KEY
aws configure set aws_secret_access_key $NIMBUS_SECRET
aws configure set region $REGION
aws configure set s3.endpoint_url {{S3_ENDPOINT_US_EAST_1}}
```

`$NIMBUS_SECRET` es la mitad secreta de una clave de acceso compatible con S3, que se genera en el panel en **Settings → Object Storage Keys → New key**. No la confundas con la clave de API normal — son distintas.

## 3 · Sube tu sitio {#upload}

```bash
aws s3 sync ./dist s3://$BUCKET \
  --delete \
  --cache-control "public, max-age=3600" \
  --endpoint-url {{S3_ENDPOINT_US_EAST_1}}
```

`--delete` elimina los archivos del bucket que ya no están en `./dist`. `--cache-control` pone una cabecera de caché de 1 hora en cada objeto — lo bastante larga para que los navegadores no los vuelvan a descargar en cada carga de página y lo bastante corta para no tener que invalidar cachés a mano al corregir una errata.

Para los archivos que NUNCA deben ir a caché (tu `index.html`):

```bash
aws s3 cp ./dist/index.html s3://$BUCKET/index.html \
  --cache-control "no-cache, max-age=0" \
  --endpoint-url {{S3_ENDPOINT_US_EAST_1}}
```

El patrón: caché larga en los assets con hash (`/_app/[hash].js`) y no-cache en el HTML de entrada que los referencia. Es el mismo patrón que usan internamente Vercel, Netlify y Cloudflare Pages.

## 4 · Comprueba que funciona {#verify}

Abre `https://my-site.{{S3_HOST_US_EAST_1}}` en un navegador. Deberías ver tu sitio.

Si en su lugar ves XML, el endpoint del sitio web no está enrutando bien — casi siempre porque no se activó `public_read` o `website.enabled`. Revisa la configuración del bucket:

```bash
curl {{API_BASE_URL}}/v1/buckets/$BUCKET \
  -H "Authorization: Bearer $NIMBUS_KEY"
```

## 5 · Dominio propio (opcional) {#custom-domain}

Añade en tu registrador un registro DNS que apunte tu dominio al bucket:

```text
www.example.com   CNAME   my-site.{{S3_HOST_US_EAST_1}}
```

Para un dominio raíz (`example.com` sin `www.`), los CNAME no funcionan — según el RFC, los registros CNAME en la raíz del dominio no están permitidos. Dos opciones:

1. Usa `www.example.com` como dominio canónico y redirige la raíz → www
2. Añade un registro A en la raíz que apunte a una [IP flotante](/docs/api/floating-ips) asociada a una VM diminuta que haga la redirección (300 líneas de configuración de nginx, ~$5/mes)

Cuando el registro DNS se propague (de 1 minuto a 24 horas, según el TTL de tu registrador):

```bash
curl -X PATCH {{API_BASE_URL}}/v1/buckets/$BUCKET \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "custom_domains": ["www.example.com"]
  }'
```

Esto indica al bucket que acepte peticiones con `Host: www.example.com` y que emita un certificado TLS para ese nombre de host (de Let's Encrypt, con renovación automática).

## 6 · Monta una pipeline de despliegue {#cd}

Lo anterior es el despliegue puntual. Para CI/CD, el patrón es el mismo `aws s3 sync` desde una GitHub Action (o cualquier runner de CI):

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

La mayoría de los sistemas de CI ya tienen acciones de despliegue compatibles con S3; las apuntas a nuestro endpoint y funcionan sin cambios.

## Coste {#cost}

Almacenamiento: $0.013/GB·mes en standard. Un sitio de 50 MB cuesta alrededor de un céntimo al mes.

Egress: gratis los primeros 100 GB/mes y $0.01/GB a partir de ahí. Un sitio que sirve 100k páginas vistas a 200 KB por página son 20 GB — todavía dentro del tier gratuito.

Frente a la misma carga de trabajo en AWS CloudFront + S3: normalmente 4–6× más barato en la línea de egress y parecido en la de almacenamiento.

## Próximos pasos {#next-steps}

- [Referencia de almacenamiento de objetos](/docs/api/object-storage) — la API completa de buckets.
- [Zonas DNS](/docs/api/dns-zones) — aloja tu DNS directamente en NimbusNexus en lugar de en tu registrador.
- [Almacenamiento en frío](/docs/api/cold-storage) — para las partes de tu almacenamiento que casi nunca lees (artefactos de compilación, versiones antiguas).
