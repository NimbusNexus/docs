---
title: "Failover multirregión"
description: "Failover a nivel de DNS entre dos regiones, con enrutamiento basado en comprobaciones de estado. RTO de ~30 s."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: guide
---

# Failover multirregión

Las IPs flotantes son de alcance regional — no se pueden mover entre regiones. Para un failover entre regiones (caída de una región entera, degradación de la latencia en una región), la primitiva adecuada es el enrutamiento a nivel de DNS con comprobaciones de estado. El enrutamiento por latencia lleva a cada usuario a su región sana más cercana; si falla una región, la capa de DNS la saca de la rotación.

RTO objetivo con esta configuración: **20–60 segundos**, según el TTL y la rapidez con la que tus resolutores DNS vuelvan a consultar.

## Lo que vas a configurar {#overview}

```text
                    your customers
                          │
                  app.example.com  ← DNS A record set
                          │
            ┌─────────────┴─────────────┐
            ↓                           ↓
       us-east-1                   eu-central-1
   (203.0.113.5/32)             (198.51.100.5/32)
        VM-A                        VM-B
        │                            │
        └─ replicated DB ───────────┘
              (logical replication)
```

El DNS resuelve a la región que esté más cerca del resolutor. Si una región falla su comprobación de estado, el DNS deja de devolver la IP de esa región hasta que se recupera.

## Requisitos previos {#prereqs}

- Dos VMs en regiones distintas, cada una detrás de una [IP flotante](/docs/api/floating-ips).
- Tu aplicación en ejecución en ambas VMs, lista para servir tráfico.
- Una base de datos o un almacén con estado que exista en ambas regiones, con replicación entre ellas. Para Postgres, la [replicación lógica como la de la migración desde RDS](/docs/guides/migrate-from-rds) es la misma primitiva. Para Redis, replica los fallos de caché; para el almacenamiento de objetos, usa la [replicación entre regiones](/docs/api/object-storage#cross-region).
- Una zona DNS alojada en el DNS de NimbusNexus (o en cualquier proveedor de DNS que admita conjuntos de registros con comprobaciones de estado — Route53, Cloudflare, etc.).
- Un endpoint de comprobación de estado que verifique de verdad que tu aplicación puede servir tráfico (no solo un `200 OK` en `/healthz`).

```bash
export NIMBUS_KEY="nn_live_xxxxxxxxxxxxxxxx"
export ZONE_ID="zone_01HG7..."
export EAST_IP_ID="ip_01HG7Y3..."      # floating IP in us-east-1
export WEST_IP_ID="ip_01HG7Y4..."      # floating IP in eu-central-1
```

## 1 · Crea el conjunto de registros multivalor {#record-set}

Añade un conjunto de registros A con las IPs de ambas regiones y enrutamiento por latencia:

```bash
EAST_IPV4=$(curl -s {{API_BASE_URL}}/v1/floating-ips/$EAST_IP_ID \
  -H "Authorization: Bearer $NIMBUS_KEY" | jq -r '.ipv4')

WEST_IPV4=$(curl -s {{API_BASE_URL}}/v1/floating-ips/$WEST_IP_ID \
  -H "Authorization: Bearer $NIMBUS_KEY" | jq -r '.ipv4')

curl -X POST {{API_BASE_URL}}/v1/dns/zones/$ZONE_ID/records \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"app.example.com\",
    \"type\": \"A\",
    \"routing_policy\": \"latency\",
    \"ttl\": 60,
    \"values\": [
      { \"value\": \"$EAST_IPV4\", \"region\": \"us-east-1\" },
      { \"value\": \"$WEST_IPV4\", \"region\": \"eu-central-1\" }
    ]
  }"
```

Campos clave:

- `routing_policy: 'latency'` — los resolutores DNS reciben la IP que corresponda a la región geográficamente más cercana. Alternativas: `'weighted'` (reparto por porcentajes), `'failover'` (primaria/secundaria, nunca round-robin), `'geo'` (enrutamiento por país del cliente).
- `ttl: 60` — TTL de 60 segundos. Un TTL más bajo = failover más rápido (los resolutores vuelven a consultar antes), a costa de más consultas DNS. Para un servicio con necesidades de alta disponibilidad, 60 es lo adecuado; para configuraciones con un SLA menos exigente, 300 está bien.

## 2 · Añade comprobaciones de estado {#health-checks}

Cada valor del conjunto de registros tiene su comprobación de estado. Si la comprobación falla, ese valor sale de la rotación:

```bash
curl -X POST {{API_BASE_URL}}/v1/dns/zones/$ZONE_ID/records/$RECORD_ID/health-checks \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "value_index": 0,
    "type": "https",
    "path": "/healthz",
    "expected_status": 200,
    "interval_seconds": 10,
    "failure_threshold": 3,
    "success_threshold": 2
  }'
```

Repite con `value_index: 1` (la segunda región). Qué hace cada campo:

- `interval_seconds: 10` — comprueba cada 10 segundos.
- `failure_threshold: 3` — tres fallos consecutivos antes de dar el valor por caído. Junto con `interval_seconds`, son 30 segundos hasta que una región sale — algo por encima del umbral de los fallos de red puntuales y muy por debajo de "ya lo estamos viendo en PagerDuty".
- `success_threshold: 2` — dos éxitos consecutivos antes de dar el valor por recuperado. Evita oscilaciones durante una recuperación inestable.

El endpoint de comprobación de estado importa. No hagas que se limite a `return 200 OK` sin condiciones — eso le quita todo el sentido. Haz que compruebe de verdad sus dependencias (la conexión a la base de datos, la caché, la cola), para que falle cuando fallaría la aplicación.

## 3 · Pruébalo {#test}

Fuerza un "fallo" bloqueando la sonda de la comprobación de estado en una región:

```bash
# On the us-east-1 VM, drop traffic from the health-check source CIDR
sudo iptables -A INPUT -s <healthcheck-cidr> -j DROP
```

(Obtén los CIDRs de origen de las comprobaciones de estado con `GET /v1/dns/healthcheck-source-cidrs`.)

En menos de 30 segundos, el conjunto de registros debería dejar de devolver la IP de us-east-1:

```bash
dig +short app.example.com
# Should return only the eu-central-1 IP for the next several seconds
```

Deshaz la regla de iptables para restaurar la región. En menos de 20 segundos (`2 * interval_seconds`), debería volver a la rotación.

## 4 · Replicación de la base de datos {#db}

La capa de DNS decide adónde llega el tráfico; la capa de datos es más difícil. Los patrones:

**Para cargas de trabajo principalmente de lectura:**

- La base de datos primaria en una región y una réplica de lectura en la otra.
- La aplicación lee de la región local (de la réplica cuando está en la región secundaria).
- Las escrituras siempre van al primario (así que la región secundaria tiene más latencia de escritura).
- Si falla la región primaria: promociona la réplica a primario y haz failover de lecturas + escrituras al nuevo primario.

**Para cargas de trabajo con muchas escrituras que toleran multimaestro:**

- Usa una base de datos que admita replicación activo-activo (CockroachDB, YugabyteDB).
- Ambas regiones leen y escriben en local; el motor resuelve los conflictos.
- Es más complejo de operar; solo se justifica cuando la latencia de escritura con un único maestro es un problema real.

**Para caché y colas:**

- Caché: da por hecho que estará fría después del failover. La mayoría de las aplicaciones se recuperan en minutos; el impacto en el SLA es tolerable.
- Cola: mantén colas por región; la aplicación asume que una cola regional puede no estar disponible hasta que la región se recupere.

NimbusNexus todavía no ofrece un producto de base de datos multirregión activo-activo. De momento, gestiona tú la replicación mediante replicación lógica (Postgres), binlog (MySQL) o change streams (MongoDB).

## Lo que no es {#not}

- **No es failover activo-activo para el estado**: las escrituras siguen concentradas en un único primario. La capa de DNS dirige a los usuarios; la capa de base de datos sigue teniendo un único maestro la mayor parte del tiempo.
- **No es transparente para los clientes**: las conexiones TCP a la IP de la región caída se reinician; los clientes se reconectan (la mayoría de los clientes HTTP lo gestionan bien; algunos clientes de long polling o SSE necesitan un handler de reintentos).
- **No es RTO cero**: 20–60 segundos es el mínimo con TTL = 60. Un TTL más bajo ayuda, pero a costa de más volumen de consultas DNS.

## Próximos pasos {#next-steps}

- [Zonas DNS](/docs/api/dns-zones) — la API de zonas en la que vive el conjunto de registros.
- [Registros DNS](/docs/api/dns-records) — todas las políticas de enrutamiento + la semántica de los campos.
- [IPs flotantes](/docs/api/floating-ips) — la primitiva de failover dentro de una región en la que se basa esto.
- [Despliegues blue/green](/docs/guides/blue-green) — la misma idea, dentro de una región.
