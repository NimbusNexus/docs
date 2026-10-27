---
title: "Backups"
description: "Backups programados y bajo demanda, con deduplicación, políticas de retención y restauración entre regiones."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: reference
---

# Backups

Los backups son copias gestionadas de VMs, volúmenes y bases de datos, que se guardan en el tier de almacenamiento en frío con deduplicación y retención configurable. Los endpoints admiten tanto backups **bajo demanda** (puntuales: llamas tú a POST) como backups **programados** (recurrentes, controlados por una política asociada al recurso de origen).

## Backups frente a snapshots {#backups-vs-snapshots}

Ambos son copias en un momento dado; se diferencian en cómo funcionan en la práctica:

|                                 | Snapshot                               | Backup                                                                        |
| ------------------------------- | -------------------------------------- | ----------------------------------------------------------------------------- |
| Creado por                      | Solo una llamada directa a la API      | Una llamada directa O una política recurrente                                 |
| Retención                       | 7 días por defecto, ampliable a mano   | La fija una política de retención explícita (niveles diario/semanal/mensual)  |
| Precios                         | \$0.04/GB·mes (tier frío, deduplicado) | \$0.04/GB·mes + cargos de recuperación por cada restauración                  |
| Replicación entre regiones      | Manual: restaurar y después copiar     | Integrada en la política                                                      |
| Restaurar como recurso nuevo    | Sí                                     | Sí                                                                            |
| Registro de auditoría           | Estándar                               | Estándar + metadatos que lo atribuyen a la política                           |

Usa snapshots para copias puntuales que vas a consumir tú mismo. Usa backups para el patrón recurrente de "siempre tenemos una copia de hace 7 días, otra de hace 30 y otra de hace 365" — esa es la forma basada en políticas.

## Backups basados en políticas {#policies}

Asocia una política de backup a una VM / un volumen / una base de datos con:

```json
{
  "source_id": "vm_01H...",
  "source_kind": "vm",
  "schedule": "daily",
  "retention": {
    "daily": 7,
    "weekly": 4,
    "monthly": 12,
    "yearly": 5
  }
}
```

Esa política mantiene 7 diarios + 4 semanales + 12 mensuales + 5 anuales = 28 backups activos en régimen estable. Los backups más antiguos caducan automáticamente; no tienes que hacer limpieza a mano.

Los endpoints de políticas están en `/v1/backups/policies` (no aparecen en el ejemplo mínimo de abajo — la referencia completa está en la especificación publicada).

## Bloqueos de retención {#retention}

Un backup sujeto a un nivel de retención activo (p. ej. "diario, conservar 7") queda **bloqueado por retención** durante ese periodo. Si intentas borrarlo antes de que caduque, se devuelve un 409. Esta es la función de cumplimiento normativo: un usuario no puede borrar un backup que sigue dentro de la ventana de retención, aunque tenga permisos de administrador.

Para saltarte el bloqueo, tendrías que desasociar el origen de la política (con lo que el backup queda huérfano y deja de estar bloqueado por retención) y después borrarlo. Que el backup quede huérfano se anota en el registro de auditoría.

## Replicación entre regiones {#cross-region}

Una política puede indicar una región secundaria: cada backup que crea la política se replica en la secundaria en ~10 minutos desde su creación. La copia replicada se factura como almacenamiento entre regiones (\$0.005/GB·mes por encima de la primaria).

Restaurar desde la secundaria no requiere ningún paso adicional — `POST /v1/backups/{id}/restore` con el id de la copia secundaria; por defecto, la región de destino es la de la secundaria. Un simulacro de DR habitual: restaurar cada mes desde la secundaria en un proyecto sandbox, validar y destruir.

## Próximos pasos {#next-steps}

- [Snapshots](/docs/api/snapshots) — su pariente para copias puntuales.
- [Almacenamiento en frío](/docs/api/cold-storage) — el tier en el que se guardan los backups.
- [Máquinas virtuales](/docs/api/vms), [Almacenamiento en bloques](/docs/api/block-storage), [Bases de datos gestionadas](/docs/api/managed-databases) — los tres tipos de recurso de origen.
