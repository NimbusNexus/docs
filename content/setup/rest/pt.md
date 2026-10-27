---
title: "Configurar a API REST"
description: "Obtenha uma chave de API, envie-a em um header e faça sua primeira chamada a um produto da NimbusNexus com curl, TypeScript, Python ou Go."
publishedAt: 2026-10-19
updatedAt: 2026-10-22
kind: quickstart
---

# Configurar a API REST

Todo produto NimbusNexus é uma API REST: JSON sobre HTTPS, com sua chave de API no header `Authorization`. Esta página leva você de nenhuma chave até a primeira chamada bem-sucedida. Escolha uma linguagem no topo da página e os exemplos a acompanham. REST significa `curl`; TypeScript, Python e Go usam o cliente HTTP habitual de cada linguagem, sem precisar de SDK.

## 1 · Obter uma chave de API {#key}

**Apps: Webhooks, Inboxes, Códigos QR e Request Bins.** Abra **API keys** no [console da sua conta]({{ACCOUNT_BASE_URL}}/api-keys) e crie uma chave para o produto que você quer chamar. Cada chave pertence a um produto. Escolha o escopo dela ali: `admin`, `read` ou, para Webhooks, também `publish`. Copie a chave quando ela aparecer, porque ela é mostrada só uma vez. Uma chave de app é um JWT, então começa com `eyJ`.

**Infraestrutura: VMs, armazenamento, bancos de dados e rede.** Crie a chave no painel, em **Settings → API keys**. Ela tem escopo de um projeto. [Autenticação](/docs/authentication) cobre escopos e rotação.

Mantenha a chave fora do seu código-fonte. Exporte-a no seu shell ou guarde-a no seu cofre de segredos:

```bash
export WEBHOOKS_API_KEY="<your-api-key>"
```

## 2 · Enviar a chave em toda requisição {#auth}

Envie a chave como um token Bearer. As APIs dos apps também a aceitam como `X-API-Key: <key>`.

```http
Authorization: Bearer <your-api-key>
```

Cada produto tem a própria URL base:

| Produto | URL base |
| --- | --- |
| Webhooks | `{{WEBHOOKS_BASE_URL}}/v1` |
| Inboxes | `{{INBOXES_BASE_URL}}/v1` |
| Códigos QR | `{{QR_BASE_URL}}/v1` |
| Request Bins | `https://bins.nimbusnexus.net/v1` |
| Infraestrutura | `{{API_BASE_URL}}` |

## 3 · Fazer a primeira chamada {#first-call}

`GET /v1/auth/me` no Webhooks retorna a chave que você enviou: o escopo dela e o workspace ao qual ela pertence. Ele não lê mais nada, então qualquer chave válida pode chamá-lo.

```bash
curl {{WEBHOOKS_BASE_URL}}/v1/auth/me \
  -H "Authorization: Bearer $WEBHOOKS_API_KEY"
```

```ts
const res = await fetch('{{WEBHOOKS_BASE_URL}}/v1/auth/me', {
  headers: { Authorization: `Bearer ${process.env.WEBHOOKS_API_KEY}` },
})
console.log(await res.json())
```

```python
import os
import requests

res = requests.get(
    "{{WEBHOOKS_BASE_URL}}/v1/auth/me",
    headers={"Authorization": f"Bearer {os.environ['WEBHOOKS_API_KEY']}"},
)
print(res.json())
```

```go
req, err := http.NewRequest("GET", "{{WEBHOOKS_BASE_URL}}/v1/auth/me", nil)
if err != nil {
    log.Fatal(err)
}
req.Header.Set("Authorization", "Bearer "+os.Getenv("WEBHOOKS_API_KEY"))
res, err := http.DefaultClient.Do(req)
if err != nil {
    log.Fatal(err)
}
defer res.Body.Close()
```

A resposta indica o seu workspace:

```json
{
  "scope": "admin",
  "workspace_id": "{{WORKSPACE_ID}}"
}
```

Os outros campos dizem que tipo de credencial é esta. Para uma chave de API, `email` e `created_at` são `null`.

## 4 · Ler os erros {#errors}

Uma requisição que falha responde com um status 4xx ou 5xx e um único formato de erro em todos os produtos:

```json
{
  "error": {
    "code": "unauthorized",
    "message": "…",
    "details": { "reason": "missing" },
    "request_id": "…"
  }
}
```

Tome decisões com base em `code`, não no status nem na mensagem. `unauthorized` significa que nenhuma chave chegou ou que a chave foi revogada. `invalid_credential` significa que a chave não é válida: gere uma nova, porque tentar de novo não vai ajudar. `forbidden` significa que a chave é válida, mas não pode fazer isso: falta o escopo ou a função, ou o produto não está ativado para o seu workspace. [Autenticação](/docs/authentication#errors) e [Erros](/docs/errors) listam todos os códigos. Informe o `request_id` quando falar com o suporte.

## Próximos passos {#next-steps}

- [Referência da API](/docs/reference): todas as operações de todos os produtos, com a chamada na sua linguagem.
- [SDKs](/docs/setup/sdk) e a [CLI](/docs/setup/cli): as mesmas chamadas, com retentativas, verificação de assinatura e paginação resolvidas para você.
- Inícios rápidos dos produtos: [Webhooks](/docs/product-webhooks/quickstart), [Inboxes](/docs/product-inboxes/quickstart), [Request Bins](/docs/product-bins/quickstart), [sua primeira VM](/docs/quickstart).
