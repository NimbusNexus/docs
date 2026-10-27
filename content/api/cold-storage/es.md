---
title: "Almacenamiento en frío"
description: "Almacenamiento del tier de archivado, con la tarifa por GB más baja y la recuperación medida aparte."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: reference
---

# Almacenamiento en frío

El almacenamiento en frío es el tier de archivado — barato de conservar; recuperar es más lento y se mide aparte. Elígelo cuando casi nunca vayas a leer los datos: backups históricos, retención por cumplimiento normativo, logs en bruto para auditorías.

## Qué pagas {#pricing}

Tres componentes de coste, cada uno medido por separado:

| Concepto                         | Tarifa                  | Cuándo pagas                                                              |
| -------------------------------- | ----------------------- | ------------------------------------------------------------------------- |
| **Almacenamiento**               | \$0.004/GB·mes          | De forma continua mientras exista el archivo                              |
| **Recuperación**                 | \$0.02–\$0.05/GB        | Por cada solicitud de restauración; varía según la clase de recuperación  |
| **Cargo por borrado anticipado** | por GB × días restantes | Si borras antes de 90 días                                                |

Para comparar: la clase Standard del almacenamiento de objetos cuesta \$0.013/GB·mes (3,25× la tarifa) — y esa clase Standard no tiene cargo por recuperación ni duración mínima de almacenamiento. El compromiso es: pagas menos por conservar y más por leer.

## Duración mínima de almacenamiento {#min-duration}

Cada archivo conlleva un **cargo mínimo de 90 días de almacenamiento**. Si borras un archivo a los 30 días, se te facturarán los 60 días restantes como parte del borrado. Es el mismo modelo que usa AWS Glacier; es lo que permite que la tarifa de almacenamiento sea tan baja.

En la práctica: no crees y borres objetos del almacenamiento en frío continuamente. El patrón adecuado es escribir una vez y conservar o borrar pasados 90 días.

## Clases de recuperación {#retrieval-classes}

| Clase       | Latencia    | Coste por GB | Cuándo usarlo                                                                      |
| ----------- | ----------- | ------------ | ---------------------------------------------------------------------------------- |
| `expedited` | 1–5 minutos | \$0.05       | Recuperaciones por cumplimiento normativo; auditorías puntuales con fecha límite   |
| `standard`  | 3–5 horas   | \$0.02       | La opción por defecto; rentable para lecturas no planificadas                      |
| `bulk`      | 5–12 horas  | \$0.005      | Restaurar decenas de TB o más durante la noche                                     |

Una recuperación no saca los datos del archivo de forma permanente — crea una copia temporal en la clase Standard del almacenamiento de objetos durante 24 horas, accesible mediante una URL prefirmada. El archivo en sí no cambia.

## Cuándo NO usar el almacenamiento en frío {#when-not-to-use}

- Cualquier cosa que puedas leer más de ~una vez por trimestre — los cargos de recuperación superan el ahorro en almacenamiento.
- Cualquier cosa en la que el tiempo de lectura importe — incluso la recuperación `expedited` tarda 1–5 minutos, no segundos.
- Datos con un ciclo de vida corto y conocido — el mínimo de 90 días encarece crear y borrar continuamente.

En los tres casos, el [Almacenamiento de objetos](/docs/api/object-storage) con la clase de almacenamiento IA o Cold encaja mejor (cargos de recuperación más bajos y una duración mínima más corta o inexistente).

## Próximos pasos {#next-steps}

- [Almacenamiento de objetos](/docs/api/object-storage) — la misma familia de productos, para patrones de acceso más frecuentes.
- [Snapshots](/docs/api/snapshots) — los snapshots de VMs y volúmenes se guardan por defecto en el tier frío.
