---
title: "Inicio rápido"
description: "Genera una clave de API, consulta tus opciones y crea tu primera VM."
publishedAt: 2026-05-19
updatedAt: 2026-11-04
kind: quickstart
---

# Inicio rápido

Esta guía te lleva de una cuenta con la sesión iniciada en el panel a una máquina virtual en ejecución en unas pocas llamadas a la API. Todo lo que hagas aquí es reversible: borra la VM cuando termines. Una VM se factura desde que se crea hasta que se borra, así que no la dejes en ejecución por descuido; en [Datos de precios](/docs/api/pricing-data) están los precios.

## Antes de empezar {#prereqs}

Necesitas tres cosas:

- Una cuenta de NimbusNexus. Regístrate en [{{ROOT_DOMAIN}}]({{BASE_URL}}/register).
- La herramienta de línea de comandos `curl`, o el cliente HTTP que prefieras, y `jq` para leer las respuestas. Los ejemplos de esta página usan `curl`; las mismas llamadas funcionan en cualquier lenguaje.
- Unos cinco minutos.

Todavía no necesitas tener SSH configurado: esta VM arranca sin clave. Para iniciar sesión en una VM más adelante, registra primero una clave ([Claves SSH](/docs/api/ssh-keys)) e indícala en `sshs` al crear la VM.

## 1 · Genera una clave de API {#api-key}

Inicia sesión en el panel y ve a **Seguridad → Tokens de API → Crear token**. Ponle al token un nombre que reconozcas después (p. ej. `quickstart`) y elige el alcance **Admin**, que crea una clave sin restricciones. Los otros dos alcances crean una clave sin reglas de acceso, y esa clave solo puede leer su propia sesión. Copia el valor con la etiqueta **Clave de API**, no **Secreto**, en un lugar seguro — solo lo verás una vez.

Expórtala como variable de entorno para que los ejemplos de abajo puedan usarla:

```bash
export NIMBUS_KEY="<your-api-key>"
```

Envíala en la cabecera `X-API-Key` en cada llamada. Las claves de API tienen el alcance de un único proyecto. El proyecto por defecto que se crea con tu cuenta te sirve por ahora. [Autenticación](/docs/authentication#scopes) explica las claves limitadas a las llamadas que necesitan.

## 2 · Consulta tus opciones {#region}

Hoy, NimbusNexus opera en una sola región, en Fráncfort (Alemania), así que no hay ninguna región que elegir; en [Regiones](/docs/api/regions) están los detalles. Pregúntale a la API qué puedes crear allí:

```bash
curl -s {{API_BASE_URL}}/api/v1/instance/artifacts \
  -H "X-API-Key: $NIMBUS_KEY" \
  | jq '.data | {
      images: [.images.data[] | { id, name }],
      vm_options: [.vm_options.data[] | { architecture: .label, vm_classes: [.children[]?.label] }],
      networks: [.networks.data[] | { id, name, external, subnets: [.subnets[].cidr] }],
      security_groups: [.security_groups.data[] | { id, name }]
    }'
```

El tipo de volumen del disco de arranque sale de una segunda llamada:

```bash
curl -s {{API_BASE_URL}}/api/v1/storage/artifacts \
  -H "X-API-Key: $NIMBUS_KEY" \
  | jq '[.data.volume_options.data[].label]'
```

Elige uno de cada y expórtalos. Las imágenes, las redes y los grupos de seguridad se indican por su `id`; las arquitecturas, las clases de VM y los tipos de volumen, por su etiqueta. Elige una red con `external: false` que tenga una subred: unirse a una red externa también necesita `bandwidth_mbps` y `subscription.bandwidth`, y sin ellos la llamada responde `400`.

```bash
export IMAGE_ID="<image-id>"
export ARCHITECTURE="<architecture>"
export VM_CLASS="<vm-class>"
export VOLUME_TYPE="<volume-type>"
export NETWORK_ID="<network-id>"
export SECURITY_GROUP_ID="<security-group-id>"
```

## 3 · Crea tu primera VM {#first-vm}

La configuración de una VM es su número de `cpu` y su `ram` en MB. Su disco de arranque es de `volume_size` GB. Arranca una con una vCPU, 2 GB de RAM y un disco de 25 GB:

```bash
curl -X POST {{API_BASE_URL}}/api/v1/instance/ \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"quickstart\",
    \"image\": \"$IMAGE_ID\",
    \"spec\": {
      \"architecture\": \"$ARCHITECTURE\",
      \"vm_class\": \"$VM_CLASS\",
      \"cpu\": 1,
      \"ram\": 2048,
      \"volume_type\": \"$VOLUME_TYPE\"
    },
    \"volume_size\": 25,
    \"network\": [\"$NETWORK_ID\"],
    \"security_group\": [\"$SECURITY_GROUP_ID\"]
  }"
```

Una configuración que no se ofrece para esa arquitectura y esa clase responde `400`; [Datos de precios](/docs/api/pricing-data) las enumera. Si no, la llamada pone el trabajo en cola y responde sin ningún id:

```json
{
  "success": true
}
```

Busca la VM nueva por su nombre y lee su `status`:

```bash
curl -s {{API_BASE_URL}}/api/v1/instance/ \
  -H "X-API-Key: $NIMBUS_KEY" \
  | jq '.data[] | select(.name == "quickstart") | { id, status, nics, fault }'
```

`status` es `BUILD` al principio y después `ACTIVE`, con las direcciones de la VM en `nics`:

```json
{
  "id": "3f0c9e1a-6b7d-4c2e-9a51-7d2b8f4e1c60",
  "status": "ACTIVE",
  "nics": {
    "my-network": [
      { "addr": "10.0.0.12", "version": 4, "OS-EXT-IPS:type": "fixed" }
    ]
  },
  "fault": null
}
```

Haz polling de vez en cuando hasta que `status` sea `ACTIVE`. Si es `ERROR`, `fault` indica qué ha fallado. Guarda el id:

```bash
export VM_ID="<vm-id>"
```

## Lo que has hecho {#summary}

Has creado una clave de API, has consultado tus opciones y has provisionado una máquina virtual real. Muchos recursos funcionan igual: una llamada a `artifacts` lista tus opciones, `POST` crea y `GET` lee. El borrado varía según el recurso, así que consulta su página de referencia. La clave de API y la cabecera son las mismas en todo `{{API_HOST}}`.

## Próximos pasos {#next-steps}

- Explora la **referencia de la API** para ver todos los endpoints con sus parámetros, esquemas de petición/respuesta y códigos de error.
- Asocia una [IP flotante](/docs/api/floating-ips) para llegar a la VM desde internet.
- Lee sobre la **autenticación** para entender cómo funcionan las claves de API junto con el alcance por proyecto, los roles y las reglas de acceso.
- Lee las **convenciones** para conocer los patrones que sigue la API — paginación, formatos de error, trabajo que termina después de la respuesta.
- Prueba el **explorador interactivo de la API** en [{{API_HOST}}/docs/external]({{API_BASE_URL}}/docs/external) — es una instancia de Swagger UI conectada a la API real; "Try it out" hace llamadas reales contra tu cuenta.

Cuando termines, borra la VM para que dejemos de facturarte. Su volumen de arranque se borra con ella:

```bash
curl -X POST {{API_BASE_URL}}/api/v1/instance/action \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{ \"servers\": [\"$VM_ID\"], \"cmd\": \"delete\" }"
```
