---
title: "Implantar um site estático"
description: "O armazenamento de objetos como destino de hospedagem — bucket, leitura pública, domínio próprio, ~5 minutos."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: guide
---

# Implantar um site estático

O armazenamento de objetos compatível com S3 também serve como hospedagem de sites estáticos. Você envia os arquivos gerados pelo build para um bucket, marca-os como de leitura pública, aponta seu domínio para a URL do bucket e tem um site estático servido por CDN por alguns centavos por mês.

Este guia leva você de um diretório `dist/` já gerado (a saída de qualquer gerador de sites estáticos moderno — export do Next.js, Astro, Hugo, HTML puro) até um site no ar no seu domínio.

## Pré-requisitos {#prereqs}

- Uma conta na NimbusNexus com uma chave de API.
- Um site já gerado em um diretório local `dist/`.
- Um domínio que você controla (ou use um subdomínio emitido pela NimbusNexus para pular a etapa do domínio).
- O `awscli` configurado para se comunicar com o armazenamento de objetos da NimbusNexus (ou qualquer cliente compatível com S3 — `rclone`, `mc`, `s3cmd`).

```bash
export NIMBUS_KEY="nn_live_xxxxxxxxxxxxxxxx"
export BUCKET="my-site"
export REGION="us-east-1"
```

## 1 · Criar o bucket {#create-bucket}

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

O que cada opção faz:

- `public_read: true` — qualquer pessoa na internet pode fazer `GET` em qualquer objeto do bucket. Obrigatório para hospedagem estática; o nome do bucket aparece nas URLs.
- `website.enabled: true` — ativa o modo de site estático. O bucket passa a servir HTML com o `Content-Type` correto, segue o `index_document` em requisições de diretório e renderiza o `error_document` em respostas 4xx.

A resposta inclui a URL do bucket:

```json
{
  "id": "bkt_01HG7Y3...",
  "url": "https://my-site.{{S3_HOST_US_EAST_1}}",
  "website_endpoint": "https://my-site.{{S3_HOST_US_EAST_1}}"
}
```

## 2 · Configurar a CLI do S3 {#configure-cli}

```bash
aws configure set aws_access_key_id $NIMBUS_KEY
aws configure set aws_secret_access_key $NIMBUS_SECRET
aws configure set region $REGION
aws configure set s3.endpoint_url {{S3_ENDPOINT_US_EAST_1}}
```

`$NIMBUS_SECRET` é a metade secreta de uma chave de acesso compatível com S3, gerada no painel em **Settings → Object Storage Keys → New key**. Não a confunda com a chave de API comum — são diferentes.

## 3 · Enviar seu site {#upload}

```bash
aws s3 sync ./dist s3://$BUCKET \
  --delete \
  --cache-control "public, max-age=3600" \
  --endpoint-url {{S3_ENDPOINT_US_EAST_1}}
```

`--delete` remove do bucket os arquivos que não estão mais em `./dist`. `--cache-control` define um header de cache de 1 hora em cada objeto — longo o bastante para que os navegadores não busquem tudo de novo a cada carregamento de página e curto o bastante para que você não precise invalidar caches manualmente ao corrigir um erro de digitação.

Para arquivos que NUNCA devem ir para o cache (o seu `index.html`):

```bash
aws s3 cp ./dist/index.html s3://$BUCKET/index.html \
  --cache-control "no-cache, max-age=0" \
  --endpoint-url {{S3_ENDPOINT_US_EAST_1}}
```

Padrão: cache longo nos assets com hash (`/_app/[hash].js`) e no-cache no HTML de entrada que faz referência a eles. É o mesmo padrão que Vercel + Netlify + Cloudflare Pages usam por baixo dos panos.

## 4 · Verificar se funciona {#verify}

Acesse `https://my-site.{{S3_HOST_US_EAST_1}}` em um navegador. Você deve ver seu site.

Se aparecer XML, o endpoint do site não está roteando corretamente — na maioria das vezes porque `public_read` ou `website.enabled` não foi definido. Confira de novo a configuração do bucket:

```bash
curl {{API_BASE_URL}}/v1/buckets/$BUCKET \
  -H "Authorization: Bearer $NIMBUS_KEY"
```

## 5 · Domínio próprio (opcional) {#custom-domain}

Adicione um registro DNS no seu registrador apontando seu domínio para o bucket:

```text
www.example.com   CNAME   my-site.{{S3_HOST_US_EAST_1}}
```

Para um domínio apex (`example.com` sem `www.`), CNAMEs não funcionam — registros CNAME no apex são proibidos pela RFC. Duas opções:

1. Use `www.example.com` como domínio canônico e redirecione apex → www
2. Adicione um registro A no apex apontando para um [IP flutuante](/docs/api/floating-ips) anexado a uma VM bem pequena que faz o redirecionamento (300 linhas de configuração do nginx, ~$5/mês)

Depois que o registro DNS se propagar (de 1 minuto a 24 horas, dependendo do TTL do seu registrador):

```bash
curl -X PATCH {{API_BASE_URL}}/v1/buckets/$BUCKET \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "custom_domains": ["www.example.com"]
  }'
```

Isso faz o bucket aceitar requisições com `Host: www.example.com` e emitir um certificado TLS para esse hostname (via Let's Encrypt, com renovação automática).

## 6 · Montar um pipeline de deploy {#cd}

O que está acima é o deploy pontual. Para CI/CD, o padrão é o mesmo `aws s3 sync` a partir de uma GitHub Action (ou de qualquer runner de CI):

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

A maioria dos sistemas de CI já tem actions de deploy compatíveis com S3; basta apontá-las para o nosso endpoint e elas funcionam sem alterações.

## Custo {#cost}

Armazenamento: $0,013/GB·mês na classe Standard. Um site de 50 MB custa cerca de um centavo por mês.

Egress: gratuito nos primeiros 100 GB/mês, $0,01/GB depois disso. Um site que serve 100 mil visualizações de página a 200 KB por página gera 20 GB — ainda dentro da faixa gratuita.

Em comparação com a mesma carga de trabalho no AWS CloudFront + S3: normalmente 4–6× mais barato na linha de egress e parecido na linha de armazenamento.

## Próximos passos {#next-steps}

- [Referência de armazenamento de objetos](/docs/api/object-storage) — a API completa de buckets.
- [Zonas DNS](/docs/api/dns-zones) — hospede seu DNS diretamente na NimbusNexus em vez de no seu registrador.
- [Armazenamento frio](/docs/api/cold-storage) — para as partes do seu armazenamento que você quase nunca lê (artefatos de build, releases antigas).
