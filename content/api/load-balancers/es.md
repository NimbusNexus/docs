---
title: "Balanceadores de carga"
description: "Distribución gestionada de tráfico L4 / L7 entre un pool de VMs de backend."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: reference
---

# Balanceadores de carga

Un balanceador de carga se sitúa delante de una flota de VMs con una única VIP (IP virtual), reparte el tráfico entre los backends y saca automáticamente de la rotación los que no están sanos. Dos variantes: **L4** (TCP / UDP / proxy-protocol) y **L7** (HTTP / HTTPS con enrutamiento por ruta + cabecera).

## Los cuatro subrecursos {#sub-resources}

Un balanceador de carga es en sí un contenedor; la lógica de enrutamiento vive en recursos anidados:

- **Listener** — uno por cada (protocolo, puerto) en el que el LB acepta tráfico. `HTTPS:443` es un listener; `HTTP:80` es otro. Un mismo LB puede alojar muchos listeners.
- **Pool** — un grupo de VMs de backend, definido por listener. Cada pool tiene un algoritmo (`round-robin`, `least-connections`, `source-ip-hash`) y una política de persistencia de sesión.
- **Miembro** — un backend de un pool. Hace referencia a una VM + un puerto + un peso.
- **Monitor de estado** — la comprobación de estado activa de cada pool. Los miembros que fallan salen de la rotación hasta que se recuperan.

Los endpoints de abajo operan sobre el balanceador de carga de nivel superior. El CRUD anidado de listeners/pools/miembros/monitores de estado está en `/v1/load-balancers/{id}/listeners`, etc. (no aparece en este ejemplo mínimo — lo cubre la especificación publicada).

## Terminación SSL {#ssl}

Para los listeners HTTPS tienes dos opciones:

- **TLS terminado en el LB.** Sube un certificado (o usa Let's Encrypt con el complemento cert-manager), y el LB sirve TLS a los clientes mientras habla en texto plano con tus VMs. Más fácil de gestionar; permite al LB inspeccionar las cabeceras HTTP para el enrutamiento L7.
- **TLS passthrough.** El LB solo hace reenvío TCP en L4; tus VMs gestionan el TLS. Es necesario cuando el backend tiene que ver el certificado original del cliente.

## Comprobaciones de estado {#health-checks}

Un monitor de estado sondea cada miembro periódicamente (por defecto, cada 10 s) en una ruta / un puerto configurados. Tres resultados:

- **Healthy** (sano) — los 2 últimos sondeos han tenido éxito (por defecto; configurable). El miembro recibe tráfico.
- **Unhealthy** (no sano) — los 3 últimos sondeos han fallado (configurable). El miembro sale de la rotación; se deja que terminen las conexiones en curso.
- **Recovering** (en recuperación) — no estaba sano y vuelve a superar los sondeos. Tras 2 sondeos correctos pasa a sano.

En las comprobaciones de estado HTTP, el LB envía un GET a `/healthz` (configurable) y espera un 200. Implementa `/healthz` en tu aplicación para que devuelva un cuerpo rápido — y evita que la comprobación haga trabajo real, o la propia comprobación se convertirá en la carga.

## Precios {#pricing}

Los balanceadores de carga se facturan con una tarifa plana por hora y por región (\$0.024/h para el tier estándar en la referencia de precios en inglés). Crear listeners / pools / miembros / monitores de estado es gratis. El tráfico entre LBs de distintas regiones cuenta como egress entre regiones estándar.

## Próximos pasos {#next-steps}

- [Máquinas virtuales](/docs/api/vms) — lo que se convierte en miembros del pool.
- [IPs flotantes](/docs/api/floating-ips) — la alternativa para dar acceso público a una sola VM sin LB.
- [Grupos de seguridad](/docs/api/security-groups) — el firewall en la interfaz de la VM; los LBs respetan los grupos de seguridad de los miembros.
