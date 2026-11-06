---
title: "Modelo de seguridad"
description: "Cómo se combinan claves de API, roles, reglas de acceso y proyectos para acotar el radio de impacto."
publishedAt: 2026-05-20
updatedAt: 2026-11-06
kind: concept
---

# Modelo de seguridad

En la API de infraestructura, tres cosas acotan lo que puede hacer una credencial: los proyectos son la unidad de aislamiento, los roles indican lo que una clave puede hacer en su proyecto y las reglas de acceso restringen qué llamadas puede hacer. Esta página es la visión general conceptual; cada pieza tiene su propia página de referencia con los detalles.

## El límite de confianza {#trust-boundary}

Un único proyecto es el límite de confianza. Dentro de un proyecto, cualquier llamante autorizado puede afectar a cualquier recurso. Entre proyectos, nada puede afectar a nada a menos que lo abras: un recurso pertenece a un proyecto, las cuotas son por proyecto y una clave funciona en un proyecto.

Así está diseñado. Si dos cargas de trabajo tienen que estar aisladas entre sí (producción de staging, el cliente A del cliente B), ponlas en proyectos distintos. No intentes aislarlas con reglas de acceso dentro de un mismo proyecto: restringen lo que puede hacer una sola clave, pero otra clave del proyecto con reglas más amplias sigue teniendo acceso a todo.

## Credenciales {#api-keys}

La API acepta dos tipos de credencial: una **clave de API** en la cabecera `X-API-Key`, para herramientas y scripts, y una **sesión iniciada**, para una persona en el panel.

Las claves son:

- **Por proyecto.** Una clave con el alcance del proyecto `acme-prod` no puede leer nada de `acme-staging`, aunque sea de la misma cuenta.
- **Personales.** Cada clave pertenece a la persona que la creó y actúa con roles que esa persona tiene.
- **Creadas desde una sesión iniciada**, en el panel o con `POST /api/v1/api_keys/`.
- **Válidas hasta que las borres**, o hasta el `expires_at` que les pusiste. No hay ninguna llamada para rotar: para sustituir una clave, crea la nueva, pasa tus herramientas a ella y después borra la antigua.

Consulta [Autenticación](/docs/authentication) para ver el formato de las peticiones y los detalles.

## Roles y reglas de acceso {#scopes}

Una clave actúa con `roles` en su proyecto, y sus `access_rules` limitan qué llamadas puede hacer: cada regla indica un servicio, un método y una ruta. `unrestricted: true` significa que no hay reglas de acceso, así que la clave puede hacer cualquier llamada que permitan sus roles. Una clave sin ninguna de las dos cosas solo puede leer su propia sesión.

El patrón adecuado: **empieza restringido y amplía cuando algo falle**. Crea la clave solo con las llamadas que sabes que necesitas. Una llamada fuera de ellas responde `403`, y creas una clave nueva que la incluya. Así detectas errores del tipo "le he dado permisos de administrador a mi job de CI sin querer" durante el desarrollo, no en producción.

## Proyectos {#projects}

Los proyectos son la primitiva de aislamiento más fuerte: son el límite de los recursos y el del control de acceso. La facturación es por workspace. Una persona con un rol en el proyecto `acme-prod` no puede ver los recursos del proyecto `acme-staging` a menos que también tenga un rol allí.

La mayoría de los equipos quieren **al menos un proyecto por entorno** (`prod`, `staging`, `dev`). El motivo: una clave de desarrollo comprometida no debería poder llegar a los datos de producción. Mejor aún: un proyecto por cada combinación de entorno + servicio (`acme-prod-api`, `acme-prod-batch`), para que una filtración de credenciales en el job batch no pueda leer los datos de los clientes de la API.

Consulta [Proyectos](/docs/api/projects) para ver los detalles.

## Modelo de red {#network}

Desde internet no se puede llegar a una VM en una red privada. Para salir a internet, conecta la red a un [router](/docs/api/routers) con gateway externo. Para aceptar tráfico entrante, asocia una [IP flotante](/docs/api/floating-ips). Cada VM tiene al menos un [grupo de seguridad](/docs/api/security-groups), que deniega todo el tráfico entrante hasta que lo permitas.

Las redes pertenecen a un proyecto. Una VM del proyecto `acme-prod` no puede enviar tráfico a una VM del proyecto `acme-staging` por IPs privadas a menos que compartas una red entre ellos con [redes compartidas](/docs/api/network-sharing). No hay peering entre las redes de los proyectos. Si no, el patrón es "expón una API pública y llámala por internet", el mismo límite de confianza que si las dos cargas de trabajo estuvieran en empresas distintas.

## Datos en tránsito {#in-transit}

La API se sirve por HTTPS. En el producto [Webhooks](/docs/product-webhooks), las entregas también usan TLS: la URL de un endpoint debe ser `https`.

## Cómo notificar una vulnerabilidad {#disclosure}

¿Has encontrado un problema de seguridad? No abras un issue en GitHub (es público) ni envíes un ticket de soporte normal (el triaje es más lento). El [formulario de divulgación de vulnerabilidades]({{BASE_URL}}/contact/security) llega directamente al equipo de seguridad, acepta mensajes cifrados con PGP y confirmamos su recepción en un plazo de 24 horas.

Las condiciones de puerto seguro (safe harbor) están en [{{BASE_URL}}/legal/security-policy]({{BASE_URL}}/legal/security-policy). La investigación de buena fe es bienvenida.

## Próximos pasos {#next-steps}

- [Autenticación](/docs/authentication) — cómo funcionan en la práctica las claves, los roles y las reglas de acceso.
- [Proyectos](/docs/api/projects) — la unidad de aislamiento.
- [Redes compartidas](/docs/api/network-sharing) — la forma controlada de conectar las redes de dos proyectos.
