---
title: "Cuotas"
description: "Límites por proyecto de VMs, vCPU, RAM, almacenamiento, IPs flotantes y otros recursos."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: reference
---

# Cuotas

Las cuotas son límites por proyecto que acotan cuánto de cada recurso puede tener un proyecto. Evitan que el gasto se dispare por bucles accidentales y garantizan que el consumo de un proyecto no pueda agotar la capacidad de una región.

## Qué tiene cuota {#what}

Cada proyecto tiene una cuota para cada uno de estos recursos:

| Recurso                        | Cuota por defecto | Notas                                                                                  |
| ------------------------------ | ----------------- | -------------------------------------------------------------------------------------- |
| VMs                            | 50                | Por región; "VM" cuenta todos los estados salvo `terminated`                           |
| vCPU                           | 200               | Total entre todas las VMs en ejecución                                                 |
| RAM (GB)                       | 800               | Total entre todas las VMs en ejecución                                                 |
| Almacenamiento en bloques (GB) | 5.000             | Suma de todos los volúmenes (conectados + desconectados)                               |
| Almacenamiento de objetos (GB) | ilimitado         | Solo es un límite flexible: te contactaremos por encima de ~50 TB para alinear expectativas |
| Snapshots                      | 200               | Por región; los snapshots borrados no cuentan                                          |
| Backups                        | 500               | Por región                                                                             |
| IPs flotantes                  | 20                | Por región                                                                             |
| Redes                          | 10                | Por región                                                                             |
| Grupos de seguridad            | 50                | Por región                                                                             |
| Balanceadores de carga         | 10                | Por región                                                                             |
| Zonas DNS                      | 50                | A nivel de proyecto                                                                    |
| Usuarios                       | 25                | A nivel de proyecto                                                                    |

Los valores por defecto son conservadores. A la mayoría de los proyectos de producción se les sube a 5–10× en los ejes más usados (vCPU, RAM, almacenamiento) poco después del lanzamiento.

## Cuota frente a consumo {#quota-vs-usage}

Los endpoints exponen ambas cosas:

- `GET /v1/quotas` — los **límites** (50 VMs, 200 vCPU, etc.)
- `GET /v1/quotas/usage` — el **consumo actual** (12 VMs usadas de 50, 48 vCPU de 200, etc.)

Comprueba siempre el consumo antes de crear recursos en bloque; una petición que te haría superar la cuota devuelve un 429 con `Retry-After` vacío (como la cuota no tiene límite temporal, reintentar no sirve de nada — tienes que borrar algo o aumentar la cuota).

## Aumento de cuota {#raising}

Los aumentos de cuota se tramitan con el formulario de contacto de soporte, no con la API. Tres motivos:

1. **Planificación de capacidad.** Los aumentos grandes (10× o más) requieren reservar hardware en la región de destino.
2. **Cumplimiento normativo.** Algunos aumentos de cuota requieren una breve conversación sobre la forma de la carga de trabajo.
3. **Prevención de abusos.** Un endpoint de autoservicio para aumentar cuotas sería lo primero a lo que llamaría una cuenta comprometida.

La mayoría de los aumentos se resuelven en menos de un día laborable. Las migraciones de producción se resuelven el mismo día si lo indicas en la solicitud.

## Cuotas en varias regiones {#regions}

La mayoría de las cuotas son **por región** (VMs, snapshots, redes). Unas pocas son **a nivel de proyecto** (zonas DNS, usuarios). La respuesta del endpoint lo indica explícitamente — cada entrada de cuota lleva un campo `scope` (`region: us-east-1` o `project`).

## Próximos pasos {#next-steps}

- [Proyectos](/docs/api/projects) — el contenedor al que se aplican las cuotas.
- [Autenticación](/docs/authentication) — cómo llamar a estos endpoints.
- El **formulario de contacto de soporte** en [/contact/support]({{BASE_URL}}/contact/support) — donde se tramitan los aumentos de cuota.
