---
title: "Postgres de producción en 10 minutos"
description: "Provisiona un Postgres gestionado con HA, backups y actualizaciones sin downtime — tres llamadas a la API."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: guide
---

# Postgres de producción en 10 minutos

Al terminar esta guía tendrás un cluster de Postgres 16 gestionado con:

- Tres nodos (un primario y dos réplicas) repartidos entre zonas de disponibilidad
- Backups diarios automáticos + recuperación a un punto en el tiempo de 7 días
- Connection pooler activado
- Acceso solo por TLS desde una IP de la lista de permitidos
- Una cadena de conexión lista para usar en tu aplicación

Tiempo total: unos 10 minutos (casi todo, el paso de aprovisionamiento del cluster).

## Requisitos previos {#prereqs}

- Una cuenta de NimbusNexus con una clave de API. Consulta [Inicio rápido](/docs/quickstart) si todavía no tienes una.
- La región que quieras — Virginia (`us-east-1`), Los Ángeles (`us-west-1`), Fráncfort (`eu-central-1`) o Singapur (`ap-southeast-1`).
- `psql` instalado en local si quieres conectarte al final.

```bash
export NIMBUS_KEY="nn_live_xxxxxxxxxxxxxxxx"
export REGION="us-east-1"
```

## 1 · Crea el cluster {#create}

```bash
curl -X POST {{API_BASE_URL}}/v1/databases \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "app-prod",
    "engine": "postgres",
    "engine_version": "16",
    "tier": "production-4-16",
    "region": "us-east-1",
    "high_availability": true,
    "backup_retention_days": 7,
    "connection_pooler": true,
    "tls_required": true
  }'
```

Qué hace cada opción:

- `tier: 'production-4-16'` — 4 vCPU, 16 GB de RAM, 200 GB de SSD. El tamaño adecuado para aplicaciones de tráfico bajo o medio (~1.000 QPS). Consulta [la tabla de tiers](/docs/api/managed-databases) para ver la lista completa de tamaños.
- `high_availability: true` — primario + dos réplicas repartidos entre AZs. Suma ~80 % al coste; resta muchos incidentes de guardia.
- `backup_retention_days: 7` — backup completo diario + streaming continuo del WAL, restaurable a cualquier punto de los últimos 7 días.
- `connection_pooler: true` — PgBouncer activado en el puerto 6432. Úsalo desde cualquier aplicación en la que controles el tamaño del pool de conexiones (casi todas).
- `tls_required: true` — las conexiones sin TLS se rechazan en el listener. Actívalo siempre.

La respuesta incluye el `id` del cluster. Guárdalo:

```bash
export DB_ID="db_01HG7..."
```

## 2 · Espera a que esté listo {#wait}

El aprovisionamiento tarda 4–7 minutos. Haz polling hasta que `state` sea `running`:

```bash
while true; do
  state=$(curl -s {{API_BASE_URL}}/v1/databases/$DB_ID \
    -H "Authorization: Bearer $NIMBUS_KEY" | jq -r '.state')
  echo "state: $state"
  [ "$state" = "running" ] && break
  sleep 10
done
```

O, si prefieres recibir un webhook, [suscríbete a `database.created`](/docs/webhooks#events) y sáltate el bucle de polling.

## 3 · Añade tu IP a la lista de permitidos {#allowlist}

Por defecto, el cluster acepta conexiones de cualquier origen al que pueda enrutar. En producción quieres una lista de permitidos explícita:

```bash
MY_IP=$(curl -s ifconfig.me)/32

curl -X POST {{API_BASE_URL}}/v1/databases/$DB_ID/allowlist \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{ \"cidr\": \"$MY_IP\", \"description\": \"my laptop\" }"
```

Añade una entrada por cada CIDR al que quieras dejar entrar. Para una VM que tenga que llegar a esta base de datos, añade el CIDR de su IP flotante (o el CIDR de su NAT de salida, si está detrás de uno). Las entradas de la lista de permitidos tienen estado — al quitar una se cortan las conexiones nuevas; las existentes siguen activas hasta que caducan por inactividad o reinicias el cluster.

## 4 · Conéctate {#connect}

Obtén los datos de conexión:

```bash
curl -s {{API_BASE_URL}}/v1/databases/$DB_ID/connection \
  -H "Authorization: Bearer $NIMBUS_KEY"
```

Respuesta:

```json
{
  "host": "{{DB_HOST_DEMO}}",
  "port": 5432,
  "pooler_port": 6432,
  "database": "app",
  "username": "app",
  "password": "•••• (one-time view in dashboard)",
  "tls_root_cert_url": "{{BASE_URL}}/ca-certs/nimbusnexus-root.pem"
}
```

Descarga el certificado raíz una vez:

```bash
curl -o ~/.postgresql/nn-root.crt {{BASE_URL}}/ca-certs/nimbusnexus-root.pem
```

Conéctate:

```bash
psql "postgresql://app:••••@{{DB_HOST_DEMO}}:6432/app?sslmode=verify-full&sslrootcert=~/.postgresql/nn-root.crt"
```

Usa el puerto `6432` (pooler) desde los servidores de aplicaciones, y el puerto `5432` solo para herramientas de administración o migración que necesiten acceso directo al primario (p. ej. `pg_dump`, `pg_restore` o herramientas de migración de esquemas que toman advisory locks).

`sslmode=verify-full` comprueba el certificado contra el nombre de host — el valor por defecto adecuado. `verify-ca` también es aceptable; `require` es aceptable fuera de producción, pero se salta la comprobación del nombre de host (y, con ella, la protección frente a un tipo de ataque MITM). No uses nunca `prefer` ni `disable`.

## Lo que has hecho {#summary}

Ahora tienes un cluster de Postgres con calidad de producción:

- Tres nodos, failover automático
- Backups diarios + PITR de 7 días
- Connection pooler activado (puerto 6432)
- TLS obligatorio, lista de permitidos
- Coste: unos $200/mes por el tier `production-4-16` con HA + backups de 7 días en us-east-1

La misma estructura sirve para MySQL, MongoDB, Redis, Kafka y OpenSearch — cambia `engine` y `engine_version`; el resto de las opciones se mantienen, con valores por defecto adecuados para cada motor.

## Próximos pasos {#next-steps}

- [Referencia de bases de datos gestionadas](/docs/api/managed-databases) — todas las opciones de la llamada de creación y todos los endpoints para gestionar el cluster.
- [Guía de migración desde AWS RDS](/docs/guides/migrate-from-rds) — la misma configuración, con una migración de datos de una sola vez desde un cluster de RDS existente.
- [Webhooks de la plataforma](/docs/webhooks) — conecta los eventos `database.created`, `database.upgrade_completed` y `backup.completed` a tu monitorización.
- [Snapshots](/docs/api/snapshots) — copias en un momento dado bajo demanda, como comprobación de seguridad antes de desplegar.
