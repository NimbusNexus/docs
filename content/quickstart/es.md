---
title: "Inicio rápido"
description: "Genera una clave de API, elige una región y crea tu primera VM en tres peticiones."
publishedAt: 2026-05-19
updatedAt: 2026-05-19
kind: quickstart
---

# Inicio rápido

Esta guía te lleva de una cuenta con la sesión iniciada en el panel a una máquina virtual en ejecución en tres llamadas a la API. Todo lo que hagas aquí es reversible — destruye la VM cuando termines y habrás gastado, como mucho, unos céntimos.

## Antes de empezar {#prereqs}

Necesitas tres cosas:

- Una cuenta de NimbusNexus. Regístrate en [{{ROOT_DOMAIN}}]({{BASE_URL}}/register) — recibirás un crédito inicial que cubre este inicio rápido con creces.
- La herramienta de línea de comandos `curl`, o el cliente HTTP que prefieras. Los ejemplos de esta página usan `curl`; las mismas llamadas funcionan en cualquier lenguaje.
- Unos cinco minutos.

Todavía no necesitas tener SSH configurado. Crearemos una clave como parte de la segunda llamada.

## 1 · Genera una clave de API {#api-key}

Inicia sesión en el panel y ve a **Settings → API keys → New key**. Ponle a la clave una etiqueta que reconozcas después (p. ej. `quickstart`) y copia el valor en un lugar seguro — solo lo verás una vez.

Expórtala como variable de entorno para que los ejemplos de abajo puedan usarla:

```bash
export NIMBUS_KEY="nn_live_xxxxxxxxxxxxxxxx"
```

Las claves de API tienen el alcance de un único proyecto. El proyecto por defecto que se crea con tu cuenta te sirve por ahora; más adelante puedes repartir las cargas de trabajo entre proyectos sin rotar claves.

## 2 · Elige una región {#region}

NimbusNexus funciona en cuatro regiones:

| Región               | Código           | Estado         |
| -------------------- | ---------------- | -------------- |
| Virginia, EE. UU.    | `us-east-1`      | Activa         |
| Los Ángeles, EE. UU. | `us-west-1`      | Activa         |
| Fráncfort, Alemania  | `eu-central-1`   | Activa         |
| Singapur             | `ap-southeast-1` | Prelanzamiento |

Elige la más cercana a donde están tus usuarios (o tu infraestructura actual). El tráfico entre regiones dentro de NimbusNexus es gratis; el egress a internet es la única transferencia que se factura.

Puedes pedirle a la API la lista oficial en cualquier momento:

```bash
curl {{API_BASE_URL}}/v1/regions \
  -H "Authorization: Bearer $NIMBUS_KEY"
```

## 3 · Crea tu primera VM {#first-vm}

La VM más pequeña que sirve para trabajo real es una `gp-1-2` — una vCPU, 2 GB de RAM, 25 GB de SSD. Cuesta alrededor de un céntimo por hora. Arranca una en Virginia con:

```bash
curl -X POST {{API_BASE_URL}}/v1/vms \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "quickstart",
    "size": "gp-1-2",
    "region": "us-east-1",
    "image": "ubuntu-24.04"
  }'
```

La respuesta incluye el id de la VM y su estado actual. El estado será `provisioning` durante los primeros segundos y después `running`:

```json
{
  "id": "vm_01H...",
  "name": "quickstart",
  "size": "gp-1-2",
  "region": "us-east-1",
  "image": "ubuntu-24.04",
  "state": "provisioning",
  "ipv4": null,
  "created_at": "2026-05-19T18:30:00Z"
}
```

Haz polling de la VM una vez por segundo hasta que `state` sea `running` e `ipv4` tenga valor — tarda unos 28 segundos con una imagen en caché, o 60–90 segundos si es la primera vez que se descarga.

## Lo que has hecho {#summary}

Has creado una clave de API, has elegido una región y has provisionado una máquina virtual real. El mismo patrón de tres llamadas funciona con todos los recursos de la API: `POST` para crear, `GET` para leer, `DELETE` para destruir. La autenticación, los códigos de región y los ids de recursos son estables en todos los tipos de recurso — la API se diseñó para que la aprendas una vez y la apliques a cualquier cosa.

## Próximos pasos {#next-steps}

- Explora la **referencia de la API** para ver todos los endpoints con sus parámetros, esquemas de petición/respuesta y códigos de error.
- Lee sobre la **autenticación** para entender cómo funcionan las claves de API junto con el alcance por proyecto, los tokens que caducan y la firma de los webhooks.
- Lee las **convenciones** para conocer los patrones que la API sigue en todas partes — idempotencia, paginación, formatos de error, operaciones de larga duración.
- Prueba el **explorador interactivo de la API** en [{{API_HOST}}/docs/external]({{API_BASE_URL}}/docs/external) — es una instancia de Swagger UI conectada a la API real; "Try it out" hace llamadas reales contra tu cuenta.

Cuando termines, destruye la VM para que dejemos de facturarte:

```bash
curl -X DELETE {{API_BASE_URL}}/v1/vms/vm_01H... \
  -H "Authorization: Bearer $NIMBUS_KEY"
```
