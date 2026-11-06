---
title: "Despliegues blue/green con IPs flotantes"
description: "Despliegues sin downtime moviendo una IP flotante entre dos VMs en caliente."
publishedAt: 2026-05-20
updatedAt: 2026-11-04
kind: guide
---

# Despliegues blue/green con IPs flotantes

El patrón blue/green clásico: ejecuta la producción actual detrás de una IP flotante, construye la nueva versión en una VM aparte, ejecuta smoke tests contra ella mientras sigue fuera del tráfico público y, después, mueve la IP flotante de la VM antigua a la nueva. El tráfico cambia en cuanto se asocia la IP. Si algo sale mal, devuelve la IP a la VM antigua.

Esta guía supone una carga de trabajo de una sola VM (una VM de producción y una VM de staging). Para cargas de trabajo de varias VMs detrás de un balanceador de carga, consulta [Balanceadores de carga](/docs/api/load-balancers) — se aplica el mismo patrón, pero lo que intercambias son los pools de destino del balanceador.

## Requisitos previos {#prereqs}

- Dos VMs en la misma región. Las llamaremos `blue` (la que sirve ahora) y `green` (la siguiente versión).
- Una [IP flotante](/docs/api/floating-ips) asociada ahora a `blue`.
- Un registro DNS A que apunte a la IP flotante.
- `curl` y `jq`, con `$NIMBUS_KEY` definida con una [clave de API](/docs/authentication) que pueda hacer estas llamadas.

```bash
export NIMBUS_KEY="<your-api-key>"
export BLUE_ID="<blue-vm-id>"     # currently serving
export GREEN_ID="<green-vm-id>"    # new version
export FLOATING_IP_ID="<floating-ip-id>"
```

`GET /api/v1/instance/` lista tus VMs y `GET /api/v1/floating_ip/`, tus IPs flotantes, con sus ids.

## 1 · Construye la VM green {#build-green}

Levanta la nueva versión con el código y la configuración actualizados, pero sin la IP flotante asociada. En esta fase es una VM independiente con su propia dirección; no le llega nada de producción.

Despliega tu aplicación en ella, ejecuta las migraciones de base de datos (si son compatibles hacia adelante — consulta "migraciones de esquema" más abajo), calienta las cachés y ejecuta cualquier tarea de arranque que deba hacerse antes de que llegue el tráfico.

## 2 · Prueba green con smoke tests {#smoke}

Haz peticiones directamente a la dirección propia de green, desde algún sitio que pueda llegar a ella: otra VM de la misma red, o cualquier sitio si green está en la red externa. `GET /api/v1/instance/{server_id}/interfaces/` lista las interfaces de una VM, una por red; el `.data[0]` de abajo es la primera.

```bash
GREEN_IP=$(curl -s {{API_BASE_URL}}/api/v1/instance/$GREEN_ID/interfaces/ \
  -H "X-API-Key: $NIMBUS_KEY" | jq -r '.data[0].fixed_ips[0].ip_address')

curl -H "Host: app.example.com" "http://$GREEN_IP/healthz"
curl -H "Host: app.example.com" "http://$GREEN_IP/api/critical-endpoint"
```

La cabecera `Host` te permite probar comportamientos que dependen del nombre de host canónico (p. ej. el enrutamiento, CORS o cualquier cosa con un certificado fijado) sin cambiar el DNS. Si tu servicio exige HTTPS y has fijado un certificado para `app.example.com`, configura el certificado en green con antelación.

Ejecuta cualquier otro test que lanzarías antes de promocionarla:

- La suite completa de smoke tests
- Comprobación de la conectividad con la base de datos (sobre todo si green está detrás de una configuración de connection pooler distinta)
- Verificación de firmas de webhooks (si has rotado el secreto)

## 3 · Mueve la IP flotante {#swing}

Este es el cutover: dos llamadas a la API, una para desasociar y otra para asociar. Lee primero lo que necesita la llamada de asociar, el puerto de green y la red externa a la que pertenece la IP:

```bash
GREEN_PORT_ID=$(curl -s {{API_BASE_URL}}/api/v1/instance/$GREEN_ID/interfaces/ \
  -H "X-API-Key: $NIMBUS_KEY" | jq -r '.data[0].port_id')

FLOATING_NETWORK_ID=$(curl -s {{API_BASE_URL}}/api/v1/floating_ip/ \
  -H "X-API-Key: $NIMBUS_KEY" \
  | jq -r ".data[] | select(.id == \"$FLOATING_IP_ID\") | .network")
```

Después, muévela:

```bash
# Detach the IP from blue
curl -X POST {{API_BASE_URL}}/api/v1/floating_ip/deallocate \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{ \"id\": \"$FLOATING_IP_ID\" }"

# Attach it to green
curl -X POST {{API_BASE_URL}}/api/v1/floating_ip/allocate \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"floating_ip_id\": \"$FLOATING_IP_ID\",
    \"floating_network_id\": \"$FLOATING_NETWORK_ID\",
    \"vm_port_id\": \"$GREEN_PORT_ID\",
    \"vm_ip_address\": \"$GREEN_IP\"
  }"
```

Lo que ocurre:

- La IP flotante se desasocia de `blue`. Entre las dos llamadas, la dirección no tiene ninguna VM detrás, así que ejecútalas una justo después de la otra.
- La IP flotante se asocia a `green`, y la IP empieza a servir desde green.
- Las conexiones nuevas llegan a green. Un cliente con una conexión abierta a través de la IP flotante puede tener que volver a conectarse.

Para la mayoría de las cargas de trabajo HTTP, esto es en la práctica un cambio sin downtime. A los usuarios con conexiones de larga duración (SSE, WebSocket) sus clientes los reconectan automáticamente.

## 4 · Vigila green con tráfico {#watch}

Sigue los logs de green, vigila las tasas de error y la gráfica de peticiones del panel. Aquí aparecen anomalías del tráfico real que los smoke tests no detectaron.

La ventana en la que volver atrás sale barato son los primeros ~5 minutos. Pasado ese tiempo, blue está "ejecutando código antiguo sin tráfico" y lo estás pagando; querrás hacer una de estas dos cosas:

- Promocionar green y detener blue (el caso ideal)
- Detener las dos y empezar de nuevo (poco habitual)

## 5 · Detén blue {#stop-blue}

Si todo está en verde (literalmente), detén blue:

```bash
curl -X POST {{API_BASE_URL}}/api/v1/instance/action \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{ \"servers\": [\"$BLUE_ID\"], \"cmd\": \"stop\" }"
```

No la borres enseguida: una VM detenida puede volver a arrancar con `start` como rollback rápido. Eso sí, se sigue facturando, porque una VM se factura desde que se crea hasta que se borra. Cuando ya no necesites el rollback, bórrala con `"cmd": "delete"`.

## Cómo volver atrás {#rollback}

Si green se comporta mal con tráfico, el rollback es simétrico. Vuelve a arrancar blue si la has detenido (`"cmd": "start"`) y, después, devuelve la IP a blue:

```bash
BLUE_PORT_ID=$(curl -s {{API_BASE_URL}}/api/v1/instance/$BLUE_ID/interfaces/ \
  -H "X-API-Key: $NIMBUS_KEY" | jq -r '.data[0].port_id')

BLUE_IP=$(curl -s {{API_BASE_URL}}/api/v1/instance/$BLUE_ID/interfaces/ \
  -H "X-API-Key: $NIMBUS_KEY" | jq -r '.data[0].fixed_ips[0].ip_address')

curl -X POST {{API_BASE_URL}}/api/v1/floating_ip/deallocate \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{ \"id\": \"$FLOATING_IP_ID\" }"

curl -X POST {{API_BASE_URL}}/api/v1/floating_ip/allocate \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"floating_ip_id\": \"$FLOATING_IP_ID\",
    \"floating_network_id\": \"$FLOATING_NETWORK_ID\",
    \"vm_port_id\": \"$BLUE_PORT_ID\",
    \"vm_ip_address\": \"$BLUE_IP\"
  }"
```

Las mismas dos llamadas, y el tráfico vuelve a blue. Los rollbacks se complican si tus migraciones de base de datos no eran compatibles hacia adelante — mantén las migraciones de esquema desacopladas de los despliegues de código y conservarás la opción de hacer rollback.

## Migraciones de esquema {#migrations}

El patrón que hace que blue/green funcione bien con cambios de esquema: **desacopla la migración del despliegue**.

Cada cambio de esquema son dos PRs, separados por una semana:

1. **PR de migración.** Una migración de esquema compatible hacia atrás. Tablas nuevas, columnas nuevas que admiten nulos, índices nuevos. El código antiguo sigue funcionando con el esquema nuevo. Despliégalo por los canales habituales (no hace falta blue/green — la compatibilidad hacia atrás significa que la migración se puede aplicar por separado sin riesgo).
2. **PR de código.** El código que usa el esquema nuevo. Despliégalo con blue/green.

Cuando necesites eliminar una columna o cambiar un tipo, la secuencia es la inversa: el código deja de usar la columna → despliegas el código → la migración elimina la columna. Siempre dos PRs separados en el tiempo. Y entre uno y otro, siempre puedes parar sin riesgo.

Este patrón da más trabajo que "desplegar siempre esquema + código a la vez", pero conserva la seguridad del rollback, que es precisamente para lo que sirve blue/green.

## Próximos pasos {#next-steps}

- [Referencia de IPs flotantes](/docs/api/floating-ips) — todos los endpoints del recurso que hace posible este patrón.
- [Balanceadores de carga](/docs/api/load-balancers) — la versión de varias VMs del mismo patrón.
