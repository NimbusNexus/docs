---
title: "Optimiza tu factura mensual"
description: "Las cinco medidas más eficaces si tu factura de NimbusNexus es mayor de lo que esperabas."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: guide
---

# Optimiza tu factura mensual

Si tu factura de NimbusNexus es mayor de lo esperado, según nuestra experiencia el 90 % del exceso de gasto sale de los mismos cinco sitios. Revisarlos por orden lleva unos 30 minutos y suele ahorrar un 30–60 % de la factura.

El orden importa — primero, lo que más impacto tiene.

## 1 · VMs detenidas de las que te has olvidado {#stopped-vms}

Las VMs detenidas siguen costando ~10 % de lo que cuestan en ejecución (pagas el disco + la IP reservada). Tres meses de una `gp-8-32` detenida cuestan más o menos lo mismo que un mes de una en ejecución.

Encuéntralas:

```bash
curl "{{API_BASE_URL}}/v1/vms?state=stopped" \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  | jq '.items[] | { id, name, stopped_at, size }'
```

Para cada una, decide:

- **Detenida hace < 1 semana y recuerdas por qué** → déjala, es candidata a rollback.
- **Detenida hace > 2 semanas y no recuerdas por qué** → hazle un snapshot (para conservar la imagen del disco) y después `DELETE`.
- **Detenida hace > 1 mes** → elimínala. Lo que tuviera ya no es candidato a rollback.

```bash
# Snapshot first
curl -X POST {{API_BASE_URL}}/v1/snapshots \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{ \"source_vm_id\": \"$VM_ID\", \"name\": \"archive-$(date +%Y-%m-%d)\" }"

# Then delete the VM
curl -X DELETE {{API_BASE_URL}}/v1/vms/$VM_ID \
  -H "Authorization: Bearer $NIMBUS_KEY"
```

El snapshot es mucho más barato que la VM detenida (el almacenamiento de snapshots cuesta $0.04/GB; las IPs reservadas y el disco reservado de una VM detenida cuestan más).

## 2 · IPs flotantes sin asociar {#unattached-ips}

Las IPs flotantes sin asociar cuestan $2.50/mes cada una — lo mismo que una IP asociada a una VM detenida. La línea de la factura es pequeña por IP, pero las cuentas con cierta antigüedad las van acumulando.

```bash
curl "{{API_BASE_URL}}/v1/floating-ips?state=detached" \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  | jq '.items[] | { id, ipv4, region, allocated_at }'
```

Libera todas las que no estés usando activamente:

```bash
curl -X DELETE {{API_BASE_URL}}/v1/floating-ips/$IP_ID \
  -H "Authorization: Bearer $NIMBUS_KEY"
```

Si es posible que más adelante quieras recuperar la misma IPv4 (porque algo la tiene en una lista de permitidos en otro sitio), apunta qué IPs eran tuyas antes de liberarlas. No reservamos las IPs liberadas — vuelven al pool regional. No hay forma de "congelar" una IP sin mantenerla reservada.

## 3 · VMs sobredimensionadas {#over-provisioned}

Una VM que funciona todo el tiempo al 5–10 % de CPU está pagando 10× lo que necesita. Ejecuta `node_exporter` (o simplemente mira la gráfica por VM del panel) y busca las VMs cuyo P99 de CPU a 90 días esté por debajo de ~30 %.

Para cada VM sobredimensionada, la medida adecuada depende de la forma del tráfico:

- **Tráfico bajo y constante** → redimensiona a la baja. `POST /v1/vms/$ID/resize` a un tier más pequeño. Tarda ~30 segundos. El redimensionado en caliente se admite dentro de la misma familia (`gp-4-16` → `gp-2-8` funciona; `gp-4-16` → `co-4-8` requiere detener, redimensionar y arrancar, porque cambia la arquitectura).
- **Tráfico a ráfagas** → plantéate tamaños optimizados para cómputo (familia `co-`); tienen una relación CPU/RAM más alta. Son más baratos por vCPU para cargas de trabajo limitadas por CPU.
- **VMs con GPU sin nada en la GPU** → redimensiónalas fuera de la familia `gx-` por completo. Las VMs con GPU son 5–10× más caras; si no usas la GPU, estás tirando el dinero.

## 4 · Clase de almacenamiento de objetos inadecuada {#storage-class}

El almacenamiento de objetos tiene tres clases:

| Clase | Precio de almacenamiento | Precio de recuperación | Para qué |
|---|---|---|---|
| Standard | $0.013/GB·mes | Gratis | Datos calientes (se leen a menudo) |
| Infrequent Access (IA) | $0.007/GB·mes | $0.005/GB | Datos templados (se leen cada mes) |
| Cold | $0.004/GB·mes | Más alto, según la clase (Expedited, Standard, Bulk) | Archivo (se lee rara vez) |

La mayoría de las cuentas usan Standard para todo por defecto y nunca lo revisan. Dónde está el ahorro:

```bash
# What buckets do you have, and what class?
curl {{API_BASE_URL}}/v1/buckets \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  | jq '.items[] | { name, region, storage_class, size_gb }'
```

En cada bucket, mira el timestamp del último acceso de los objetos más grandes (el "object explorer" del panel lo muestra). Lo que no se haya leído en el último mes debería estar en IA; lo que no se haya leído en 6 meses probablemente debería estar en Cold.

No hace falta moverlos objeto a objeto a mano — define una regla de lifecycle:

```bash
curl -X PUT {{API_BASE_URL}}/v1/buckets/$BUCKET/lifecycle \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "rules": [
      {
        "id": "tier-warm",
        "filter": { "prefix": "archive/" },
        "transitions": [
          { "after_days": 30,  "storage_class": "infrequent-access" },
          { "after_days": 180, "storage_class": "cold" }
        ]
      }
    ]
  }'
```

Así los datos cambian de tier automáticamente a medida que envejecen. Es lo más barato para cargas de trabajo del tipo "genero estos datos una vez y casi nunca los vuelvo a leer" (logs, artefactos de compilación, informes antiguos).

## 5 · Snapshots que ya no necesitas {#stale-snapshots}

Los snapshots cuestan $0.04/GB·mes — mucho menos que el disco de una VM, pero se acumulan rápido si haces uno cada noche y nunca los borras. Un snapshot de 200 GB guardado durante un año cuesta $96.

```bash
curl "{{API_BASE_URL}}/v1/snapshots?older_than_days=180" \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  | jq '.items[] | { id, name, size_gb, created_at, source_vm_id }'
```

Tres reglas prácticas para la retención de snapshots:

- **Snapshots diarios** de una VM de producción → conserva 14 y borra el resto.
- **Snapshots semanales** → conserva 8 (dos meses).
- **Snapshots mensuales** → conserva 12 (un año). Más allá de eso, conserva solo los de fin de año.

Configura una [política de backups programados](/docs/api/backups) con esas reglas de retención incorporadas para que esto no vuelva a crecer sin límite.

## Recordatorios sobre el modelo de precios {#reminders}

Algunas cosas que sorprenden a los clientes nuevos:

- **El tráfico en la misma región entre recursos de NimbusNexus es gratis.** Dos VMs en `us-east-1` que se comunican entre sí no pagan egress. El tráfico entre regiones entre recursos de NimbusNexus también es gratis (una diferencia deliberada con AWS, donde esta es la línea de la factura que más sorprende).
- **El tráfico saliente a internet cuesta $0.01/GB a partir de los primeros 100 GB/mes.** Frente a AWS (donde cuesta $0.09/GB), esto importa en cuanto sirves contenido público no trivial.
- **Facturación por segundo de las VMs.** Una VM que funciona 90 segundos cuesta 1,5 minutos. Las horas parciales no se redondean. Así, las cargas de trabajo de corta duración (runners de CI, jobs por lotes) son realmente baratas — no compliques el diseño para "minimizar ejecuciones" si las ejecuciones son cortas.
- **El crédito inicial se concede una sola vez.** Las cuentas nuevas reciben un crédito que no se repone. Si estás haciendo muchas pruebas, vigila el saldo de crédito en el panel.

## La factura en sí {#invoice}

La página de facturación del panel desglosa las líneas de la factura por recurso y por día. El filtro "top 10 costs" es el punto de partida adecuado si todavía no sabes qué es lo caro — casi siempre son una o dos líneas desproporcionadas, no un goteo de muchos gastos pequeños.

Si quieres la factura en JSON:

```bash
curl {{API_BASE_URL}}/v1/billing/invoices/current \
  -H "Authorization: Bearer $NIMBUS_KEY"
```

La respuesta incluye proyecciones de coste por recurso para lo que queda de mes, así que puedes actuar sobre lo que es caro *ahora* en lugar de descubrirlo a final de mes.

## Próximos pasos {#next-steps}

- [Máquinas virtuales](/docs/api/vms) — `resize` para el caso de las VMs sobredimensionadas.
- [Almacenamiento de objetos](/docs/api/object-storage) — las reglas de lifecycle al completo.
- [Snapshots](/docs/api/snapshots) y [Backups](/docs/api/backups) — la sintaxis de las políticas de retención.
- [Cuotas](/docs/api/quotas) — la tabla de límites por proyecto (distinta de la facturación, pero relacionada).
