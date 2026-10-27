---
title: "Almacenamiento de objetos"
description: "Buckets compatibles con S3, con tres clases de almacenamiento y transferencia gratuita a las VMs de la misma región."
publishedAt: 2026-05-19
updatedAt: 2026-05-19
kind: reference
---

# Almacenamiento de objetos

El Almacenamiento de objetos de NimbusNexus expone la **API de AWS S3**. Las herramientas y librerías que ya usas — la CLI `aws s3`, boto3, los SDKs oficiales de Java/Go/Node, cualquier framework que hable S3 — funcionan sin cambios después de apuntarlas a nuestro endpoint y poner nuestras credenciales.

## Qué es compatible con S3 y qué no {#compat}

Implementamos las operaciones que usa el 90 % de quienes llaman a S3:

- CRUD de buckets (`PutBucket`, `GetBucket`, `DeleteBucket`)
- CRUD de objetos (`PutObject`, `GetObject`, `DeleteObject`, `HeadObject`, `ListObjects`/`ListObjectsV2`)
- Subida multiparte (`CreateMultipartUpload`, `UploadPart`, `CompleteMultipartUpload`)
- URLs prefirmadas (sig v4)
- Metadatos de objetos, content-type, cabeceras personalizadas
- Cifrado en el servidor (siempre activado, AES-256)

**No** implementamos:

- El IAM específico de AWS (tenemos el nuestro — usa el modelo de token bearer de [Autenticación](/docs/authentication) para la API de gestión; las credenciales de S3 se emiten por separado).
- S3 Object Lock / cumplimiento WORM (previsto para el cuarto trimestre de 2026).
- S3 Select (consultas en el servidor).
- La replicación entre regiones mediante la API de S3 (en su lugar la ofrecemos mediante la API de gestión, con precios más claros).

Si tu aplicación usa una función de S3 que no está en la lista de las admitidas, recibirá un `501 Not Implemented` con el nombre de la operación en `error.code`. Cambia al equivalente admitido o abre una solicitud de función.

## Clases de almacenamiento {#classes}

Tres clases, que se eligen al subir el objeto (o por defecto para cada bucket):

| Clase      | Por GB·mes | Latencia del primer byte | Duración mínima de almacenamiento | Cuándo usarlo                                                                                                                                                                                                       |
| ---------- | ---------- | ------------------------ | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `standard` | \$0.013    | <50 ms                   | Ninguna                           | Datos calientes — assets web, lecturas frecuentes, todo lo que se sirve en directo.                                                                                                                                 |
| `ia`       | \$0.007    | <50 ms                   | 30 días                           | "Infrequent access" (acceso poco frecuente) — se accede a veces, pero quieres que sea rápido cuando lo haces. El mismo rendimiento de recuperación que Standard, la mitad de la tarifa de almacenamiento y un cargo de recuperación por GB. |
| `cold`     | \$0.004    | 1–60 minutos             | 90 días                           | Archivo — backups, logs en bruto, retención por cumplimiento normativo. Más barato de conservar, más lento de recuperar.                                                                                             |

Duración mínima de almacenamiento significa: si borras un objeto antes de que acabe la ventana mínima, pagas la tarifa por GB del resto de la ventana. Ese es el "infrequent" de IA: es barato si dejas los objetos quietos y caro si los creas y borras continuamente.

Para necesidades de archivo puro en las que casi nunca lees los datos, consulta [Almacenamiento en frío]({{BASE_URL}}/cold-storage) — un producto de archivo dedicado con tarifas aún más baratas (\$0.004/GB·mes fijos, más cargos de recuperación).

## El egress, lo que de verdad es distinto {#egress}

La mayor diferencia con AWS S3 es **cómo se cobra el egress**:

- VM ↔ almacenamiento de objetos **en la misma región**: **gratis**, siempre. Esta es la ruta de carga de la mayoría de las cargas de trabajo — tus VMs hablan con tus buckets — y no la facturamos. Egress efectivo del tráfico de producción que se queda dentro de una región: \$0.
- Egress a internet pública: \$0.009/GB, con el primer **1 TB gratis al mes** por proyecto. Para comparar, AWS S3 cobra \$0.09/GB por los primeros 10 TB.
- Egress entre regiones: \$0.005/GB. Más bajo que el egress a internet pública porque la ruta va por nuestra red troncal, no por internet abierta.

La frase "transferencia gratuita a las VMs de la misma región" de la página comercial es un compromiso real de arquitectura, no una promoción. La idea es que las arquitecturas multicapa (el almacenamiento de objetos como fuente de verdad, con VMs delante que leen y sirven) salgan económicas.

## Nombres de los buckets {#naming}

Los nombres de los buckets son **únicos a nivel global entre todos los tenants de NimbusNexus** — la misma regla que en AWS. Compatibles con DNS: en minúsculas, 3–63 caracteres, sin guiones bajos y sin guiones al principio ni al final. La ocupación de nombres de bucket por terceros es el principal motivo para reservar pronto los nombres importantes.

Los nombres de los buckets aparecen en la URL: `https://<bucket>.{{S3_HOST_US_EAST_1}}/<key>` o, con estilo de ruta, en `{{S3_ENDPOINT_US_EAST_1}}/<bucket>/<key>`. Los dos estilos funcionan; los clientes de los SDKs eligen uno según su configuración.

## Listado, paginación y rendimiento {#listing}

`ListObjectsV2` devuelve hasta 1.000 claves por petición, ordenadas lexicográficamente por clave. Por encima de 1.000, pagina con `continuation_token` — igual que en S3.

Para buckets muy anchos (millones de claves), usa el **listado con delimitador**: pasa `delimiter=/` para obtener un listado tipo directorio en el que las claves se agrupan por prefijo. Listar un "directorio" con un delimitador solo recorre sus hijos inmediatos, no todo el bucket.

Los objetos de clase Cold aparecen en una respuesta de listado igual que los de Standard / IA — listar no provoca una recuperación; solo `GetObject` lo hace. Puedes recorrer gratis un bucket Cold de 100 millones de objetos; restaurar un objeto de Cold tiene su propio cargo por GB.

## Próximos pasos {#next-steps}

- [Autenticación](/docs/authentication) — autenticación con token bearer para la API de gestión. Las credenciales de S3 (clave de acceso + clave secreta) se emiten por separado mediante la API de gestión.
- [Almacenamiento en bloques](/docs/api/block-storage) — cuando quieres un sistema de archivos en lugar de un almacén clave-valor, o necesitas semántica POSIX.
- [Editor Mosaic]({{BASE_URL}}/products/mosaic) — editor en el navegador para archivos YAML/JSON/Markdown dentro de tus buckets. Gratis con cualquier cuenta de almacenamiento.
