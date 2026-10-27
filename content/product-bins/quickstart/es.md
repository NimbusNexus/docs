---
title: "Inicio rápido de Request Bins"
description: "Crea un bin, envíale una petición con curl y lee lo que registró — primero en la consola y después por la API."
publishedAt: 2026-10-22
updatedAt: 2026-10-26
kind: quickstart
---

# Inicio rápido de Request Bins

De cero a una petición registrada en un par de minutos. Vas a crear un bin, enviarle una petición con `curl` y leer exactamente lo que llegó: primero en la consola y después por la API.

## Antes de empezar {#before}

- **En la consola, con cualquier plan.** Abre `https://bins.nimbusnexus.net` e inicia sesión con tu cuenta de NimbusNexus. Los pasos 1 a 3 no necesitan nada más, también en Free.
- **Por la API, con una clave.** El paso 4 necesita una clave de API creada en tu [consola de la cuenta]({{ACCOUNT_BASE_URL}}/api-keys?product=bins) con **Request Bins** como producto y **Read & write** como permiso. Una clave puede crear bins en cualquier plan; leer con una clave lo que registraron requiere Starter o superior, y en Free esas rutas responden `402` `not_entitled`.

## 1. Crea un bin {#create}

En la consola, elige **Create a bin** (**New bin** cuando ya tengas uno). La etiqueta es opcional y los emisores nunca la ven. En un plan de pago también puedes elegir una vida útil, que no se puede cambiar después. Elige **Create bin**.

Se abre la página del bin. Arriba están su **Bin URL**, como `https://nnbin.net/b/k7xq2mbn9tfa`, y un comando **Try it**, cada uno con un botón para copiarlo.

## 2. Envíale una petición {#send}

Desde cualquier terminal, envía al bin un `POST` con una ruta y una query después del slug. Usa la URL de tu propio bin:

```bash
curl -X POST "https://nnbin.net/b/k7xq2mbn9tfa/orders?source=quickstart" \
  -H "Content-Type: application/json" \
  -d '{"order_id": 1042, "status": "paid"}'
```

```json
{"status":"accepted"}
```

Esa respuesta es la misma para todas las peticiones a la URL de un bin, se registren o no, así que no le dice nada al emisor sobre tu bin. Lo que llegó es lo que muestra la consola.

Funciona cualquier método, ruta, cabecera o cuerpo. En un uso real, pon la URL del bin dondequiera que una aplicación, la configuración de webhooks de un proveedor, un script o un job de CI espere una URL, y deja que envíe.

## 3. Mírala en la consola {#console}

De vuelta en la página del bin, la petición aparece arriba de la lista en pocos segundos; la lista se actualiza cada 3 segundos. Selecciónala para ver:

- el método y la ruta después del slug: `POST /orders`;
- la query, decodificada: `source=quickstart`;
- las cabeceras, en orden de llegada;
- el cuerpo, formateado como JSON, con el texto en bruto a un clic;
- la dirección de origen, su tamaño y cuándo llegó.

En Free, este es todo el flujo: la consola lee lo que registraron los bins en todos los planes.

## 4. Haz lo mismo por la API {#api}

Pon tu clave en una variable de entorno:

```bash
export BINS_API_KEY="<your-api-key>"
```

Todas las rutas siguientes son relativas a `https://bins.nimbusnexus.net`, y todas las peticiones llevan `Authorization: Bearer <your key>`. Primero, crea un bin:

```bash
curl -X POST https://bins.nimbusnexus.net/v1/bins \
  -H "Authorization: Bearer $BINS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"label": "Quickstart"}'
```

```json
{
  "id": "bin_3f9a1c7e5b2d8f4a6c0e9b17",
  "slug": "w4tz8hcv2qnd",
  "url": "https://nnbin.net/b/w4tz8hcv2qnd",
  "label": "Quickstart",
  "status": "active",
  "expires_at": null,
  "created_at": "2026-10-22T09:12:01Z",
  "request_count": 0
}
```

Aquí la respuesta está recortada; [el objeto bin](/docs/product-bins/reference#bin) enumera todos los campos. Ahora importan dos:

- **`url`** es lo que le das a un emisor.
- **`id`** es lo que usan todas las llamadas posteriores. Guárdalo.

`expires_at` es `null` porque en un plan de pago un bin vive hasta que lo borras; en Free es 24 horas después de `created_at`. Free permite un bin a la vez, así que ahí esta llamada responde `402` `quota_exceeded` mientras exista el bin del paso 1. En ese caso, busca ese bin por su URL, con `GET /v1/bins?url=https://nnbin.net/b/k7xq2mbn9tfa`.

Envía al nuevo bin la petición del paso 2, con su propia URL, y luego lista lo que registró:

```bash
curl https://bins.nimbusnexus.net/v1/bins/bin_3f9a1c7e5b2d8f4a6c0e9b17/requests \
  -H "Authorization: Bearer $BINS_API_KEY"
```

```json
{
  "items": [
    {
      "id": "req_8d2e6b1f4a9c3e7d5b0f2a61",
      "bin_id": "bin_3f9a1c7e5b2d8f4a6c0e9b17",
      "method": "POST",
      "path": "/orders",
      "query": "source=quickstart",
      "source_ip": "203.0.113.24",
      "content_type": "application/json",
      "size_bytes": 36,
      "truncated": false,
      "seen_count": 1,
      "received_at": "2026-10-22T09:12:04Z",
      "expires_at": "2026-10-29T09:12:04Z"
    }
  ],
  "next_offset": null
}
```

La petición más reciente va primero. Su `expires_at` indica cuándo se borrará: aquí, 7 días después, la retención de Starter.

Para leer una petición completa, con su query, sus cabeceras y su cuerpo:

```bash
curl https://bins.nimbusnexus.net/v1/requests/req_8d2e6b1f4a9c3e7d5b0f2a61 \
  -H "Authorization: Bearer $BINS_API_KEY"
```

```json
{
  "id": "req_8d2e6b1f4a9c3e7d5b0f2a61",
  "method": "POST",
  "path": "/orders",
  "query": "source=quickstart",
  "headers": [
    {"name": "user-agent", "value": "curl/8.7.1"},
    {"name": "accept", "value": "*/*"},
    {"name": "content-type", "value": "application/json"},
    {"name": "content-length", "value": "36"}
  ],
  "body_base64": "eyJvcmRlcl9pZCI6IDEwNDIsICJzdGF0dXMiOiAicGFpZCJ9",
  "size_bytes": 36,
  "truncated": false,
  "request_id": "4b8f2c1d9e7a46b3a0c5d8e2f1a7b9c3"
}
```

Esta también está recortada: la respuesta completa lleva todos los campos del elemento de la lista, y la lista real de cabeceras también incluye las que añaden los proxies que hay delante de `nnbin.net`, como `x-forwarded-for`. El cuerpo está en base64 porque un cuerpo no tiene por qué ser texto. Para imprimirlo:

```bash
curl -s https://bins.nimbusnexus.net/v1/requests/req_8d2e6b1f4a9c3e7d5b0f2a61 \
  -H "Authorization: Bearer $BINS_API_KEY" | jq -r .body_base64 | base64 --decode
```

```text
{"order_id": 1042, "status": "paid"}
```

## Polling, no push {#polling}

No hay stream ni callback. Para esperar una petición, haz polling de la lista con `since` igual al `received_at` más reciente que hayas visto; solo devuelve las peticiones recibidas después de ese instante:

```bash
curl -G https://bins.nimbusnexus.net/v1/bins/bin_3f9a1c7e5b2d8f4a6c0e9b17/requests \
  --data-urlencode "since=2026-10-22T09:12:04Z" \
  -H "Authorization: Bearer $BINS_API_KEY"
```

`-G` con `--data-urlencode` pone `since` codificado en la query, así que un desfase horario como `+00:00` llega intacto. Una petición enviada de nuevo es una fila nueva e independiente, así que también vuelve en esta lista, con su propio `id` y su propio `received_at`.

No hagas polling un número fijo de veces para comprobar después la última respuesta. Comprueba que la petición *aparece*, con un timeout, o un emisor lento parecerá uno que nunca envió nada.

## Limpieza {#cleanup}

En un plan de pago, un bin vive hasta que lo borras, salvo que lo hayas creado con `expires_in_minutes`, y todos los planes limitan cuántos bins puedes tener a la vez, así que bórralo cuando termines:

```bash
curl -X DELETE https://bins.nimbusnexus.net/v1/bins/bin_3f9a1c7e5b2d8f4a6c0e9b17 \
  -H "Authorization: Bearer $BINS_API_KEY"
```

Borrar es **permanente**: la URL deja de registrar al instante, lo que registró el bin se borra y su slug nunca se vuelve a emitir, ni para ti ni para nadie. Los emisores siguen recibiendo `200` de ella. Para dejar de registrar durante un tiempo, haz `PATCH` del bin con `{"status": "disabled"}`, y más adelante vuelve a `{"status": "active"}`. Para conservar el bin y borrar lo que contiene, vacíalo con `DELETE /v1/bins/{id}/requests`. En Free, un bin caduca 24 horas después de crearse, y eso lo termina igual que borrarlo.

## Próximos pasos {#next-steps}

- [Resumen del producto](/docs/product-bins) — planes y límites, bins suspendidos y lo que no hace Request Bins.
- [Reenvío](/docs/product-bins/forwarding) — reenvía también cada petición a tu propio servidor, en un plan de pago.
- [Referencia de Request Bins](/docs/product-bins/reference) — todas las rutas y campos, qué responde la URL de un bin, roles y alcances.
- [API de Request Bins](/docs/reference/bins) — todas las operaciones, con la petición en curl, TypeScript, Python o Go.
