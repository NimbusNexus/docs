---
title: "Configura la API REST"
description: "Obtén una clave de API, envíala en una cabecera y haz una primera llamada a un producto de NimbusNexus desde curl, TypeScript, Python o Go."
publishedAt: 2026-10-19
updatedAt: 2026-10-22
kind: quickstart
---

# Configura la API REST

Cada producto de NimbusNexus es una API REST: JSON sobre HTTPS, con tu clave de API en la cabecera `Authorization`. Esta página te lleva de no tener ninguna clave a una primera llamada correcta. Elige un lenguaje en la parte superior de la página y los ejemplos lo siguen. REST significa `curl`; TypeScript, Python y Go usan el cliente HTTP habitual de cada lenguaje, sin necesidad de SDK.

## 1 · Obtén una clave de API {#key}

**Apps: Webhooks, Inboxes, códigos QR y Request Bins.** Abre **API keys** en la [consola de tu cuenta]({{ACCOUNT_BASE_URL}}/api-keys) y crea una clave para el producto al que quieras llamar. Cada clave pertenece a un producto. Elige allí su alcance: `admin`, `read` o, para Webhooks, también `publish`. Copia la clave cuando aparezca, porque se muestra una sola vez. Una clave de app es un JWT, así que empieza por `eyJ`.

**Infraestructura: VMs, almacenamiento, bases de datos y red.** Crea la clave en el panel, en **Settings → API keys**. Tiene el alcance de un proyecto. [Autenticación](/docs/authentication) explica los alcances y la rotación.

No pongas la clave en tu código fuente. Expórtala en tu shell o guárdala en tu almacén de secretos:

```bash
export WEBHOOKS_API_KEY="<your-api-key>"
```

## 2 · Envíala en cada petición {#auth}

Envía la clave como token bearer. Las APIs de las apps también la aceptan como `X-API-Key: <key>`.

```http
Authorization: Bearer <your-api-key>
```

Cada producto tiene su propia URL base:

| Producto | URL base |
| --- | --- |
| Webhooks | `{{WEBHOOKS_BASE_URL}}/v1` |
| Inboxes | `{{INBOXES_BASE_URL}}/v1` |
| Códigos QR | `{{QR_BASE_URL}}/v1` |
| Request Bins | `https://bins.nimbusnexus.net/v1` |
| Infraestructura | `{{API_BASE_URL}}` |

## 3 · Haz una primera llamada {#first-call}

`GET /v1/auth/me` en Webhooks devuelve la clave que has enviado: su alcance y el workspace al que pertenece. No lee nada más, así que cualquier clave válida puede llamarlo.

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

La respuesta indica tu workspace:

```json
{
  "scope": "admin",
  "workspace_id": "{{WORKSPACE_ID}}"
}
```

Los demás campos indican qué tipo de credencial es. Para una clave de API, `email` y `created_at` son `null`.

## 4 · Lee los errores {#errors}

Una petición fallida responde con un estado 4xx o 5xx y un único formato de error en todos los productos:

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

Decide en función de `code`, no del estado ni del mensaje. `unauthorized` significa que no ha llegado ninguna clave o que la clave se ha revocado. `invalid_credential` significa que la clave no es válida: emite una nueva, porque reintentar no servirá de nada. `forbidden` significa que la clave es válida pero no puede hacer esto: le falta el alcance o el rol, o el producto no está activado en tu workspace. [Autenticación](/docs/authentication#errors) y [Errores](/docs/errors) enumeran todos los códigos. Indica el `request_id` cuando contactes con soporte.

## Próximos pasos {#next-steps}

- [Referencia de la API](/docs/reference): todas las operaciones de todos los productos, con la llamada en tu lenguaje.
- [SDKs](/docs/setup/sdk) y la [CLI](/docs/setup/cli): las mismas llamadas, con los reintentos, la comprobación de firmas y la paginación resueltos por ti.
- Inicios rápidos de los productos: [Webhooks](/docs/product-webhooks/quickstart), [Inboxes](/docs/product-inboxes/quickstart), [Request Bins](/docs/product-bins/quickstart) y [tu primera VM](/docs/quickstart).
