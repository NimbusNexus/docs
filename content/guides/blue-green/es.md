---
title: "Despliegues blue/green con IPs flotantes"
description: "Despliegues sin downtime moviendo una IP flotante entre dos VMs en caliente."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: guide
---

# Despliegues blue/green con IPs flotantes

El patrón blue/green clásico: ejecuta la producción actual detrás de una IP flotante, construye la nueva versión en una VM aparte, ejecuta smoke tests contra ella mientras sigue fuera del tráfico público y, después, mueve la IP flotante de la VM antigua a la nueva. El tráfico cambia en ~2 segundos. Si algo sale mal, devuelve la IP a la VM antigua.

Esta guía supone una carga de trabajo de una sola VM (una VM de producción y una VM de staging). Para cargas de trabajo de varias VMs detrás de un balanceador de carga, consulta [Balanceadores de carga](/docs/api/load-balancers) — se aplica el mismo patrón, pero lo que intercambias son los pools de destino del balanceador.

## Requisitos previos {#prereqs}

- Dos VMs en la misma región. Las llamaremos `blue` (la que sirve ahora) y `green` (la siguiente versión).
- Una [IP flotante](/docs/api/floating-ips) asociada ahora a `blue`.
- Un registro DNS A que apunte a la IP flotante.
- La CLI `nimbus` instalada, o curl con la variable $NIMBUS_KEY definida.

```bash
export NIMBUS_KEY="nn_live_xxxxxxxxxxxxxxxx"
export BLUE_ID="vm_01HG7Y3..."     # currently serving
export GREEN_ID="vm_01HG7Y4..."    # new version
export FLOATING_IP_ID="ip_01HG7..."
```

## 1 · Construye la VM green {#build-green}

Levanta la nueva versión con el código y la configuración actualizados, pero sin la IP flotante asociada. En esta fase es una VM independiente con una IP pública por defecto; no le llega nada de producción.

Despliega tu aplicación en ella, ejecuta las migraciones de base de datos (si son compatibles hacia adelante — consulta "migraciones de esquema" más abajo), calienta las cachés y ejecuta cualquier tarea de arranque que deba hacerse antes de que llegue el tráfico.

## 2 · Prueba green con smoke tests {#smoke}

Haz peticiones directamente a la IP pública por defecto de green:

```bash
GREEN_IP=$(curl -s {{API_BASE_URL}}/v1/vms/$GREEN_ID \
  -H "Authorization: Bearer $NIMBUS_KEY" | jq -r '.ipv4')

curl -H "Host: app.example.com" "http://$GREEN_IP/healthz"
curl -H "Host: app.example.com" "http://$GREEN_IP/api/critical-endpoint"
```

La cabecera `Host` te permite probar comportamientos que dependen del nombre de host canónico (p. ej. el enrutamiento, CORS o cualquier cosa con un certificado fijado) sin cambiar el DNS. Si tu servicio exige HTTPS y has fijado un certificado para `app.example.com`, configura el certificado en green con antelación (funciona Let's Encrypt con el desafío HTTP-01 contra la IP por defecto de green).

Ejecuta cualquier otro test que lanzarías antes de promocionarla:

- La suite completa de smoke tests
- Comprobación de la conectividad con la base de datos (sobre todo si green está detrás de una configuración de connection pooler distinta)
- Verificación de firmas de webhooks (si has rotado el secreto)

## 3 · Mueve la IP flotante {#swing}

Este es el cutover. Una sola llamada a la API:

```bash
curl -X POST {{API_BASE_URL}}/v1/floating-ips/$FLOATING_IP_ID/attach \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{ \"vm_id\": \"$GREEN_ID\" }"
```

Lo que ocurre:

- La IP flotante se desasocia de `blue` (que la tenía como una de sus direcciones públicas)
- La IP flotante se asocia a `green`
- La propagación en la red tarda ~2 segundos; la IP empieza a servir desde green
- Las conexiones TCP a la IP de la VM antigua siguen abiertas hasta que caducan por inactividad (normalmente 30–60 segundos con el keepalive de HTTP); las conexiones nuevas llegan a green

Para la mayoría de las cargas de trabajo HTTP, esto es en la práctica un cambio sin downtime. Las conexiones existentes terminan sus peticiones en blue; las peticiones nuevas llegan a green. A los usuarios con conexiones de larga duración (SSE, WebSocket) sus clientes los reconectan automáticamente.

## 4 · Vigila green con tráfico {#watch}

Sigue los logs de green, vigila las tasas de error y la gráfica de peticiones del panel. Aquí aparecen anomalías del tráfico real que los smoke tests no detectaron.

La ventana en la que volver atrás sale barato son los primeros ~5 minutos. Pasado ese tiempo, blue está "ejecutando código antiguo sin tráfico" y lo estás pagando; querrás hacer una de estas dos cosas:

- Promocionar green y detener blue (el caso ideal)
- Detener las dos y empezar de nuevo (poco habitual)

## 5 · Detén blue {#stop-blue}

Si todo está en verde (literalmente), detén blue para dejar de pagar por ella:

```bash
curl -X POST {{API_BASE_URL}}/v1/vms/$BLUE_ID/stop \
  -H "Authorization: Bearer $NIMBUS_KEY"
```

No la elimines con `delete` enseguida. Las VMs detenidas cuestan ~10 % de lo que cuestan en ejecución (solo el almacenamiento) y, durante ~24 horas, te permiten volver a arrancarlas con `start` como rollback rápido. Pasadas 24 horas, elimínalas.

## Cómo volver atrás {#rollback}

Si green se comporta mal con tráfico, el rollback es simétrico:

```bash
curl -X POST {{API_BASE_URL}}/v1/floating-ips/$FLOATING_IP_ID/attach \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{ \"vm_id\": \"$BLUE_ID\" }"
```

Los mismos ~2 segundos, y el tráfico vuelve a blue. Los rollbacks se complican si tus migraciones de base de datos no eran compatibles hacia adelante — mantén las migraciones de esquema desacopladas de los despliegues de código y conservarás la opción de hacer rollback.

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
- [Failover multirregión](/docs/guides/multi-region) — la misma idea, aplicada a parejas geográficamente distantes.
