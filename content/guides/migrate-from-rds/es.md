---
title: "Migra desde AWS RDS"
description: "Migra en vivo una base de datos Postgres o MySQL desde RDS sin pérdida de datos y con ~30 s de downtime."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: guide
---

# Migra desde AWS RDS

Esta guía traslada una base de datos Postgres o MySQL de producción desde AWS RDS a las bases de datos gestionadas de NimbusNexus mediante replicación lógica. El patrón: haz la copia masiva en vivo (sin downtime), transmite en streaming los cambios que se vayan produciendo mediante WAL/binlog y, después, haz el cutover con una breve pausa de las conexiones.

Downtime previsto: **~30 segundos** para el cutover. Tiempo total transcurrido: depende del tamaño de los datos (8–30 minutos para la copia inicial con tamaños habituales).

Funciona con:

- Postgres 12+
- MySQL 8.0+

## Requisitos previos {#prereqs}

En el lado de AWS:

- La instancia de RDS debe tener activada la replicación lógica (`rds.logical_replication = 1` para Postgres; `binlog_format = ROW` para MySQL).
- Un usuario con permisos de replicación (o puedes usar el usuario maestro).
- Acceso de red entrante desde las IPs de NimbusNexus (obtendremos los CIDRs concretos en un momento).
- Un backup reciente de la instancia de RDS. Por si acaso.

En el lado de NimbusNexus:

- Una clave de API.
- Una región elegida. La latencia entre el host de migración y la instancia de RDS de origen importa — elige la región más cercana a la región de RDS (p. ej. `us-east-1` para RDS en `us-east-1`).

```bash
export NIMBUS_KEY="nn_live_xxxxxxxxxxxxxxxx"
export REGION="us-east-1"
```

## 1 · Provisiona el cluster de destino {#provision}

Crea el cluster de destino con el mismo motor y la misma versión que el de origen:

```bash
curl -X POST {{API_BASE_URL}}/v1/databases \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "app-prod-migrated",
    "engine": "postgres",
    "engine_version": "16",
    "tier": "production-4-16",
    "region": "us-east-1",
    "high_availability": true,
    "tls_required": true
  }'
```

Iguala la clase de instancia del origen lo máximo posible. Si eliges una bastante más pequeña, te arriesgas a que el destino se quede atrás durante la fase de streaming de WAL/binlog. Puedes redimensionarlo cuando termine la migración.

Guarda el id del cluster:

```bash
export DB_ID="db_01HG7..."
```

Espera a `state: running` (4–7 minutos).

## 2 · Añade las IPs de NimbusNexus a la lista de permitidos de RDS {#allowlist}

Obtén los CIDRs de salida de nuestros workers de migración en tu región:

```bash
curl {{API_BASE_URL}}/v1/databases/migration-source-cidrs?region=us-east-1 \
  -H "Authorization: Bearer $NIMBUS_KEY"
```

La respuesta es una lista de bloques `/24`. Añádelos a las reglas de entrada del grupo de seguridad de RDS en el puerto de Postgres o MySQL. Limita el acceso solo a esos CIDRs — no abras `0.0.0.0/0`.

## 3 · Inicia la migración {#kick-off}

```bash
curl -X POST {{API_BASE_URL}}/v1/databases/$DB_ID/migrate \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "source": {
      "host": "mydb.abc123.us-east-1.rds.amazonaws.com",
      "port": 5432,
      "database": "app",
      "username": "migration_user",
      "password": "••••",
      "tls_required": true
    },
    "mode": "logical-replication"
  }'
```

La respuesta incluye un `migration_id`:

```bash
export MIG_ID="mig_01HG7Y3..."
```

La migración pasa por tres fases que la API muestra de forma explícita:

1. **`copying`** — la copia masiva. Lee todas las filas del origen y las escribe en el destino. Es lo que más tiempo lleva. El origen sigue plenamente operativo mientras tanto; las lecturas y escrituras continúan con normalidad.
2. **`streaming`** — cuando termina la copia, el destino empieza a seguir el WAL (Postgres) o el binlog (MySQL) del origen. El retraso en este punto suele ser < 1 segundo.
3. **`cutover-ready`** — la copia ha terminado y el streaming se ha puesto al día. Ya puedes hacer el cutover.

## 4 · Sigue el progreso {#progress}

```bash
while true; do
  curl -s {{API_BASE_URL}}/v1/databases/migrations/$MIG_ID \
    -H "Authorization: Bearer $NIMBUS_KEY" \
    | jq '{ phase, rows_copied, rows_total, lag_seconds }'
  sleep 30
done
```

Fíjate en:

- `phase: 'copying'` → `phase: 'streaming'` (copia inicial terminada)
- `lag_seconds` bajando a 0–2 (al día)
- `phase: 'cutover-ready'` (puedes hacer el cutover)

Para bases de datos grandes (~100 GB+), suscríbete al [webhook `database.migration.cutover_ready`](/docs/webhooks#events) para recibir un aviso cuando llegue el momento.

## 5 · El cutover {#cutover}

Cuando llegues a `cutover-ready`, la ventana de cutover es así:

1. **Pausa las escrituras en el origen.** Detén tu aplicación o pon la instancia de RDS en solo lectura. Paso crítico — lo que se escriba en el origen a partir de aquí no llegará al destino.
2. **Espera a `lag_seconds: 0`.** Debería ser casi instantáneo, porque las escrituras están en pausa.
3. **Promociona el destino:**

   ```bash
   curl -X POST {{API_BASE_URL}}/v1/databases/migrations/$MIG_ID/cut-over \
     -H "Authorization: Bearer $NIMBUS_KEY"
   ```

4. **Apunta tu aplicación a la nueva cadena de conexión.** Obtén la nueva cadena de conexión de `GET /v1/databases/$DB_ID/connection`.
5. **Reanuda el tráfico.** Tu aplicación ya escribe en el nuevo cluster.

Tiempo total de los pasos 1–5: normalmente 20–40 segundos.

La llamada de promoción es también un paso de confirmación — hasta que la hagas, el destino sigue al origen. Así que, si algo sale mal a mitad del cutover, la instancia de RDS original sigue siendo la de referencia; basta con reanudar el tráfico allí. Puedes volver a lanzar la migración cuando quieras.

## 6 · Verificación {#verify}

Después del cutover, lanza una consulta rápida para confirmarlo:

```bash
psql "postgresql://app:••••@{{DB_HOST_DEMO}}:5432/app?sslmode=verify-full" \
  -c "SELECT count(*) FROM users;"
```

Compara los recuentos con los que anotaste antes de la migración. Revisa algunas filas al azar.

## 7 · Elimina el job de migración y da de baja RDS {#cleanup}

```bash
curl -X DELETE {{API_BASE_URL}}/v1/databases/migrations/$MIG_ID \
  -H "Authorization: Bearer $NIMBUS_KEY"
```

El job de migración deja de seguir al origen y libera sus recursos. El cluster de destino sigue funcionando con normalidad; solo desaparece la infraestructura de la migración.

Da de baja RDS en el lado de AWS — primero haz un snapshot y después elimina la instancia. Conserva el snapshot una semana como red de seguridad.

## Errores típicos {#gotchas}

- **Secuencias desincronizadas.** La replicación lógica de Postgres no replica el avance de las secuencias. Después del cutover, ejecuta `SELECT pg_catalog.setval(seq_name, max(id)) FROM ...` en cada secuencia para que avance más allá del valor máximo de la tabla correspondiente.
- **Los roles y los permisos no se replican.** Vuelve a crearlos en el destino antes del cutover. Usa `pg_dumpall --roles-only` (Postgres) o un equivalente.
- **Las extensiones no se replican.** Si tu origen usa `pgvector`, `postgis`, etc., actívalas en el destino antes de iniciar la migración.
- **No te olvides del historial de `pg_stat_statements`.** La replicación lógica no lo copia. Ejecuta `SELECT pg_stat_statements_reset()` en el destino después del cutover para que tu monitorización parta de una línea base limpia.

## Próximos pasos {#next-steps}

- [Referencia de bases de datos gestionadas](/docs/api/managed-databases) — todas las opciones del cluster de destino.
- [Postgres de producción en 10 minutos](/docs/guides/postgres-production) — la misma configuración, sin la migración.
- [Backups](/docs/api/backups) — programa backups diarios + PITR de 7 días en el nuevo cluster.
