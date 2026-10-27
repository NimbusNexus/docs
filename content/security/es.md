---
title: "Modelo de seguridad"
description: "Cómo se combinan claves, alcances, proyectos y registros de auditoría para acotar el radio de impacto."
publishedAt: 2026-05-20
updatedAt: 2026-10-16
kind: concept
---

# Modelo de seguridad

La postura de seguridad de NimbusNexus se apoya en cuatro pilares: las claves de API son la única forma de autenticarse, los proyectos son la unidad de aislamiento, los alcances restringen lo que puede hacer cada clave y los registros de auditoría recogen todo lo que importa. Esta página es la visión general conceptual; cada pieza tiene su propia página de referencia con los detalles.

## El límite de confianza {#trust-boundary}

Un único proyecto es el límite de confianza. Dentro de un proyecto, cualquier llamante autorizado puede afectar a cualquier recurso. Entre proyectos, nada puede afectar a nada — los proyectos no comparten redes, ni concesiones de IAM, ni cuotas.

Así está diseñado. Si dos cargas de trabajo tienen que estar aisladas entre sí (producción de staging, el cliente A del cliente B), ponlas en proyectos distintos. No intentes aislarlas con alcances o etiquetas dentro de un mismo proyecto — los alcances restringen lo que puede hacer una sola clave, pero una clave de administrador comprometida en el proyecto sigue teniendo acceso a todo.

## Claves de API {#api-keys}

La única credencial que acepta la API es una clave de API. No hay flujo OAuth por usuario, ni flujo de firma de JWT, ni mTLS — solo claves bearer. Por qué un único mecanismo: cada tipo de credencial adicional añade superficie de ataque (flujo de emisión, flujo de revocación, propagación), y preferimos que el que tenemos sea hermético.

Las claves son:

- **Por proyecto.** Una clave con el alcance del proyecto `acme-prod` no puede leer nada de `acme-staging`, aunque sea de la misma cuenta.
- **De larga duración, pero rotables.** Una clave creada hoy es válida hasta que la rotes o la revoques. La rotación tiene un periodo de solapamiento de 24 horas para que puedas desplegar la clave nueva sin cortes de servicio.
- **Se crean solo desde el panel.** No hay API para crear claves. Una clave comprometida no puede generar otra clave — la recuperación tiene que pasar por un canal fuera de banda.

Consulta [Autenticación](/docs/authentication) para ver el formato de las peticiones, la lista de alcances, el flujo de rotación y los códigos de error.

## Alcances {#scopes}

Cada clave lleva un conjunto de alcances que limitan lo que puede hacer dentro de su proyecto. La lista completa refleja los tipos de recurso:

- `vms:read`, `vms:write`, `vms:create`, `vms:delete`
- `databases:*`, `block-storage:*`, `object-storage:*`, `iam:*`, ...

Los alcances son un sistema aditivo: una clave tiene la unión de todos los alcances que se le han concedido. No hay negación, ni reglas de precedencia, ni roles que tengas que analizar.

El patrón adecuado: **empieza restringido y amplía cuando algo falle**. Crea la clave solo con los alcances que sabes que necesitas; deja que la aplicación falle con `403 forbidden` (`details.reason` es `scope`) si te has dejado alguno, y luego añádelo. Así detectas errores del tipo "le he dado permisos de administrador a mi job de CI sin querer" durante el desarrollo, no en producción.

## Proyectos {#projects}

Los proyectos son la primitiva de aislamiento más fuerte — son el límite de los recursos, el de la facturación y el del control de acceso. Un usuario con permisos de administrador en el proyecto `acme-prod` no puede ver los recursos del proyecto `acme-staging` a menos que también tenga permisos de administrador (o cualquier alcance) allí.

La mayoría de los equipos quieren **al menos un proyecto por entorno** (`prod`, `staging`, `dev`). El motivo: una clave de desarrollo comprometida no debería poder llegar a los datos de producción. Mejor aún: un proyecto por cada combinación de entorno + servicio (`acme-prod-api`, `acme-prod-batch`), para que una filtración de credenciales en el job batch no pueda leer los datos de los clientes de la API.

Consulta [Proyectos](/docs/api/projects) para ver el formato del recurso y cómo funciona la jerarquía.

## Modelo de red {#network}

Por defecto, una VM está aislada. Para salir a internet, asóciale una [IP flotante](/docs/api/floating-ips) o colócala en una red con un router. Para aceptar tráfico entrante, asóciale la IP flotante y (normalmente) pon delante un [grupo de seguridad](/docs/api/security-groups) para tener un firewall con estado.

La red entre proyectos no existe. Una VM del proyecto `acme-prod` no puede enviar tráfico a una VM del proyecto `acme-staging`, y punto, ni siquiera por IPs privadas — el switch virtual subyacente impone el aislamiento a nivel de proyecto. Si necesitas comunicación entre proyectos (algo poco habitual), el patrón adecuado es "expón una API pública y llámala por internet" — el mismo límite de confianza que si las dos cargas de trabajo estuvieran en empresas distintas.

El VPC peering y otras primitivas de red entre proyectos parecidas podrían llegar más adelante; hoy no existen, y es una restricción deliberada.

## Registros de auditoría {#audit}

Cada petición autenticada que modifica el estado se registra con:

- `request_id` — el mismo id que aparece en las respuestas de error
- `key_id` — qué clave hizo la llamada (prefijo + 4 últimos caracteres, nunca el secreto completo)
- `user_id` — el usuario que creó la clave
- `operation` — `vms.create`, `database.delete`, etc.
- `resource_id` — el recurso afectado
- `project_id` — qué proyecto
- `result` — `success`, `validation_error`, `unauthorized`, etc.
- `client_ip` — la IP de origen
- `timestamp` — ISO 8601 en UTC

Los registros de auditoría están disponibles en el panel, con filtros + exportación, y a través de la API de auditoría de IAM. La retención es de **365 días** en los tiers Free y Starter, de **2 años** en Production y configurable en Enterprise.

Los `GET` se registran para los recursos marcados como sensibles (IAM, facturación, métodos de pago); no se registran para las lecturas rutinarias (listar VMs), para que el volumen de logs siga siendo manejable. La lista de "lecturas sensibles" está documentada en la página de referencia de IAM.

## Datos en reposo {#at-rest}

- **Volúmenes de bloques:** AES-256-XTS con claves por volumen, gestionadas por nosotros. Las claves de cifrado gestionadas por el cliente (CMK) están en la hoja de ruta; todavía no están disponibles.
- **Almacenamiento de objetos:** AES-256 en el servidor por defecto; SSE-C (claves proporcionadas por el cliente) y SSE-KMS (CMK a través de KMS) disponibles.
- **Backups + snapshots:** el mismo cifrado que el volumen/objeto de origen.
- **Backups de bases de datos:** el mismo cifrado + el cifrado en reposo propio del motor de la base de datos, si está activado.

## Datos en tránsito {#in-transit}

Todo el tráfico de la API va por TLS 1.3 (se acepta TLS 1.2; las versiones anteriores se rechazan en el gateway). Las conexiones al almacenamiento de objetos y a las bases de datos usan TLS 1.3, y nuestros certificados se rotan automáticamente. Las entregas de webhooks que te enviamos usan TLS; no aceptamos URLs `http://` sin cifrar para los endpoints de webhooks.

## Cómo notificar una vulnerabilidad {#disclosure}

¿Has encontrado un problema de seguridad? No abras un issue en GitHub (es público) ni envíes un ticket de soporte normal (el triaje es más lento). El [formulario de divulgación de vulnerabilidades]({{BASE_URL}}/contact/security) llega directamente al equipo de seguridad, acepta mensajes cifrados con PGP y confirmamos su recepción en un plazo de 24 horas.

Las condiciones de puerto seguro (safe harbor) están en [{{BASE_URL}}/legal/security-policy]({{BASE_URL}}/legal/security-policy). La investigación de buena fe es bienvenida.

## Próximos pasos {#next-steps}

- [Autenticación](/docs/authentication) — cómo funcionan en la práctica las claves, los alcances y la rotación.
- [Proyectos](/docs/api/projects) — la unidad de aislamiento.
- [Webhooks de la plataforma](/docs/webhooks) — cómo proteger las entregas entrantes que enviamos a tus endpoints.
