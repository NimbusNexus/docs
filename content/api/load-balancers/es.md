---
title: "Balanceadores de carga"
description: "Distribución gestionada de tráfico L4 / L7 entre un pool de VMs de backend."
publishedAt: 2026-05-20
updatedAt: 2026-11-03
kind: reference
---

# Balanceadores de carga

Un balanceador de carga se sitúa delante de una flota de VMs con una única VIP (IP virtual), reparte el tráfico entre los backends y saca automáticamente de la rotación los que no están sanos. Un listener habla `TCP`, `UDP`, `SCTP`, `HTTP`, `HTTPS`, `TERMINATED_HTTPS` o `PROMETHEUS`, y envía todo su tráfico a su pool por defecto; no hay reglas de enrutamiento por ruta ni por cabecera.

## Los cuatro subrecursos {#sub-resources}

Un balanceador de carga es en sí un contenedor; la lógica de enrutamiento vive en recursos anidados:

- **Listener** — uno por cada (protocolo, puerto) en el que el LB acepta tráfico. `HTTPS:443` es un listener; `HTTP:80` es otro. Un mismo LB puede alojar muchos listeners.
- **Pool** — un grupo de backends, vinculado a un listener (`listener_id`) o al balanceador de carga (`loadbalancer_id`). Cada pool tiene un `protocol` (`HTTP`, `HTTPS`, `TCP`, `UDP`, `SCTP`, `PROXY` o `PROXYV2`) y un `lb_algorithm`: `ROUND_ROBIN`, `LEAST_CONNECTIONS`, `SOURCE_IP` o `SOURCE_IP_PORT`. No hay ningún ajuste de persistencia de sesión.
- **Miembro** — un backend de un pool: una `address` IP y un `protocol_port`, con un `weight` (0–256, por defecto 1).
- **Monitor de estado** — la comprobación de estado activa de cada pool. Los miembros que fallan salen de la rotación hasta que se recuperan.

Cada uno tiene sus propios endpoints, que se listan abajo: `/api/v1/loadbalancers/`, `/api/v1/listeners/`, `/api/v1/pools/`, `/api/v1/pools/{pool_id}/members/` y `/api/v1/health_monitors/`.

## Terminación SSL {#ssl}

Para los listeners HTTPS tienes dos opciones:

- **TLS terminado en el LB.** Usa un listener `TERMINATED_HTTPS` y apunta `default_tls_container_ref` (y `sni_container_refs`, para más certificados) a un contenedor de certificados existente. El LB sirve TLS a los clientes mientras habla en texto plano con tus VMs. Esta API no sube ni emite certificados.
- **TLS passthrough.** El LB solo hace reenvío TCP en L4; tus VMs gestionan el TLS. Es necesario cuando el backend tiene que ver el certificado original del cliente. Usa un listener `HTTPS` o `TCP`.

## Comprobaciones de estado {#health-checks}

Un monitor de estado sondea cada miembro cada `delay` segundos y espera una respuesta durante `timeout` segundos, menos que `delay`; tú fijas ambos valores. Su `type` es `HTTP`, `HTTPS`, `PING`, `TCP`, `TLS-HELLO`, `UDP-CONNECT` o `SCTP`. `GET /api/v1/loadbalancers/{loadbalancer_id}/status` muestra el `operating_status` de cada miembro.

- Un miembro sale de la rotación tras `max_retries_down` sondeos fallidos (3 si no lo indicas).
- Vuelve a la rotación tras `max_retries` sondeos correctos, un valor que tienes que fijar.

En las comprobaciones HTTP y HTTPS, fija la `url_path`, el `http_method` y los `expected_codes`. Apunta `url_path` a algo de tu aplicación que devuelva un cuerpo rápido — y evita que la comprobación haga trabajo real, o la propia comprobación se convertirá en la carga.

## Próximos pasos {#next-steps}

- [Máquinas virtuales](/docs/api/vms) — lo que se convierte en miembros del pool.
- [IPs flotantes](/docs/api/floating-ips) — la alternativa para dar acceso público a una sola VM sin LB.
- [Grupos de seguridad](/docs/api/security-groups) — el firewall en la interfaz de la VM; los LBs respetan los grupos de seguridad de los miembros.
