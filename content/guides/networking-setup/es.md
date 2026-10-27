---
title: "Configuración de red del proyecto"
description: "Redes, subredes, routers y grupos de seguridad — la configuración de referencia para una aplicación multicapa."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: guide
---

# Configuración de red del proyecto

La configuración de red de referencia de NimbusNexus para una aplicación multicapa: una red privada con dos subredes (una de cara al público y otra solo para la base de datos), un router que conecta la subred pública a internet y grupos de seguridad que restringen el tráfico entre capas. Esta guía recorre la configuración de principio a fin y explica por qué existe cada pieza.

Al final tendrás:

- Una red con dos subredes (`10.0.1.0/24` para la web y `10.0.2.0/24` para la base de datos)
- Un router con gateway externo, conectado a la subred web
- Dos grupos de seguridad: `web-sg` (HTTPS abierto a internet) y `db-sg` (puerto 5432 solo desde `web-sg`)
- Una forma de probar que el aislamiento funciona

## Por qué esta disposición {#why}

Las aplicaciones de una sola VM no necesitan nada de esto — una VM con una IP flotante y sin configuración de red funciona bien. Esta disposición es para aplicaciones que:

- Tienen varios componentes (capa web + base de datos, capa web + capa de workers + caché, ...)
- Necesitan mantener partes del stack fuera de internet
- Quieren imponer que "la capa web puede hablar con la capa de base de datos; nada más puede"

Para una aplicación que de verdad es de una sola VM, consulta [Patrones de despliegue de contenedores](/docs/guides/container-deploy).

## Requisitos previos {#prereqs}

- Una clave de API con los alcances `networks:write` y `vms:write`.
- Una región elegida (usaremos `us-east-1`).
- Una idea aproximada de qué VMs / servicios quieres en cada capa.

```bash
export NIMBUS_KEY="nn_live_xxxxxxxxxxxxxxxx"
export REGION="us-east-1"
```

## 1 · Crea la red {#network}

Una red es el dominio de broadcast L2 — todas las VMs y recursos conectados a la misma red pueden enrutar entre sí (según lo que permitan los grupos de seguridad).

```bash
curl -X POST {{API_BASE_URL}}/v1/networks \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "app-network",
    "region": "us-east-1",
    "cidr": "10.0.0.0/16"
  }'
```

El bloque `10.0.0.0/16` es el espacio de direcciones de todo lo que hay dentro de esta red. Elige uno que no se solape con la VPN de tu oficina, la red de tu casa ni ninguna otra red con la que puedas hacer peering más adelante (por eso `192.168.0.0/16` suele ser una mala elección — se usa demasiado). `10.0.0.0/16` sirve para la mayoría de las configuraciones; `172.16.0.0/12` también está bien.

Guarda el id de la red:

```bash
export NET_ID="net_01HG7Y3..."
```

## 2 · Crea dos subredes {#subnets}

Divide la red en dos subredes — una para lo que está de cara a internet y otra para lo que no debería estarlo.

```bash
# Web subnet — VMs that need internet access
curl -X POST {{API_BASE_URL}}/v1/subnets \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"web\",
    \"network_id\": \"$NET_ID\",
    \"cidr\": \"10.0.1.0/24\",
    \"gateway_ip\": \"10.0.1.1\"
  }"

# Database subnet — for tier-2 resources
curl -X POST {{API_BASE_URL}}/v1/subnets \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"db\",
    \"network_id\": \"$NET_ID\",
    \"cidr\": \"10.0.2.0/24\",
    \"gateway_ip\": \"10.0.2.1\"
  }"
```

La IP del gateway es la dirección de la interfaz del router en esa subred. Las VMs la usan como ruta por defecto.

## 3 · Crea el router y conéctalo a la subred web {#router}

El router es lo que saca el tráfico de la subred web a internet (y lo trae de vuelta). La subred de la base de datos no se conecta al router — así es como la mantienes fuera de internet.

```bash
curl -X POST {{API_BASE_URL}}/v1/routers \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"app-router\",
    \"region\": \"us-east-1\",
    \"external_gateway\": true
  }"
```

`external_gateway: true` reserva una IP pública en el router y activa SNAT para el tráfico saliente de las subredes conectadas a él.

Guarda el id del router y conéctalo a la subred web:

```bash
export ROUTER_ID="rtr_01HG7Y3..."

curl -X POST {{API_BASE_URL}}/v1/routers/$ROUTER_ID/interfaces \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{ \"subnet_id\": \"$WEB_SUBNET_ID\" }"
```

La subred de la base de datos se queda fuera del router. Lo que haya en ella solo puede llegar a lo que sea accesible por la red L2 — es decir, a otras cosas de la misma red, controladas por los grupos de seguridad.

## 4 · Crea los grupos de seguridad {#security-groups}

Los grupos de seguridad son firewalls con estado que se aplican a las interfaces de red de una VM. Controlan el tráfico entrante (ingress) y el saliente (egress). "Con estado" significa que el tráfico de vuelta de una conexión iniciada desde dentro se permite automáticamente — solo necesitas reglas para las conexiones iniciadas desde fuera.

```bash
# Web security group — HTTPS open to the internet
curl -X POST {{API_BASE_URL}}/v1/security-groups \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "web-sg",
    "region": "us-east-1",
    "ingress_rules": [
      { "protocol": "tcp", "port": 443, "source_cidr": "0.0.0.0/0", "description": "HTTPS" },
      { "protocol": "tcp", "port": 22, "source_cidr": "203.0.113.5/32", "description": "SSH from office" }
    ],
    "egress_rules": [
      { "protocol": "any", "destination_cidr": "0.0.0.0/0", "description": "anywhere" }
    ]
  }'

# DB security group — port 5432 only from the web SG
curl -X POST {{API_BASE_URL}}/v1/security-groups \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "db-sg",
    "region": "us-east-1",
    "ingress_rules": [
      { "protocol": "tcp", "port": 5432, "source_security_group": "web-sg", "description": "Postgres from web tier" }
    ],
    "egress_rules": [
      { "protocol": "any", "destination_cidr": "0.0.0.0/0", "description": "anywhere" }
    ]
  }'
```

El `source_security_group` de la regla del grupo de seguridad de la base de datos es lo que impone que "solo la capa web puede conectarse" — en lugar de un CIDR estático, la regla hace referencia al propio grupo de seguridad. Cualquier VM etiquetada con `web-sg` puede llegar a la base de datos. Añade o quita VMs de `web-sg` y la lista de acceso se actualiza automáticamente.

El grupo de seguridad web abre el puerto 22 (SSH) a una IP concreta de la oficina, no a todo el mundo. No abras SSH a `0.0.0.0/0` — en todas las nubes hay escáneres que prueban el 22 en busca de contraseñas débiles.

## 5 · Conecta las VMs {#attach}

Al crear una VM, indica la red, la subred y los grupos de seguridad:

```bash
# Web tier VM
curl -X POST {{API_BASE_URL}}/v1/vms \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"web-01\",
    \"size\": \"gp-2-4\",
    \"region\": \"us-east-1\",
    \"image\": \"ubuntu-24.04\",
    \"network_interfaces\": [
      { \"subnet_id\": \"$WEB_SUBNET_ID\", \"security_groups\": [\"web-sg\"] }
    ]
  }"

# Database tier VM (if running DB on your own VM rather than managed DB)
curl -X POST {{API_BASE_URL}}/v1/vms \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"db-01\",
    \"size\": \"gp-4-8\",
    \"region\": \"us-east-1\",
    \"image\": \"ubuntu-24.04\",
    \"network_interfaces\": [
      { \"subnet_id\": \"$DB_SUBNET_ID\", \"security_groups\": [\"db-sg\"] }
    ]
  }"
```

Para el acceso externo a la VM web, reserva una [IP flotante](/docs/api/floating-ips) y asóciala. La VM de la base de datos nunca recibe una IP flotante — así es como funciona el aislamiento de red.

## 6 · Verifica el aislamiento {#verify}

Prueba que el diseño impone de verdad lo que querías:

```bash
# From the web VM, can we reach the DB on 5432? (Should: yes)
nc -v -w 3 10.0.2.10 5432

# From the web VM, can we reach the DB on 22 (SSH)? (Should: no — DB SG only opens 5432)
nc -v -w 3 10.0.2.10 22

# From your laptop, can we reach the DB directly? (Should: no — DB subnet isn't routable from internet)
nc -v -w 3 <DB_PUBLIC_IP> 5432  # there's no public IP, this fails
```

Si alguna de estas pruebas no se comporta como esperabas, algo falla en las reglas de los grupos de seguridad o en las conexiones a la red o la subred. Revísalas.

## Lo que no es {#not}

- **No es VPC peering.** Es la red interna de un proyecto. Las redes de dos proyectos de NimbusNexus no hacen peering entre sí — por diseño (consulta [Modelo de seguridad](/docs/security#network)).
- **No es un WAF ni una capa anti-DDoS completos.** Los grupos de seguridad trabajan en L3/L4 — no pueden inspeccionar el cuerpo de las peticiones HTTP. Para filtrar en la capa de aplicación, ejecuta un WAF (p. ej. ModSecurity detrás de nginx) en la capa web.
- **No es autoescalado.** Gestionas las VMs a mano. Para flotas con autoescalado sirven las mismas primitivas de red, pero te convendrá usar infraestructura como código (Terraform, Pulumi) para gestionarlas a escala.

## Próximos pasos {#next-steps}

- [Referencia de redes](/docs/api/networks) — todas las opciones de la llamada de creación.
- [Referencia de subredes](/docs/api/subnets) — configuración de IPv6, opciones de DHCP y servidores de nombres DNS personalizados.
- [Referencia de grupos de seguridad](/docs/api/security-groups) — la sintaxis completa de las reglas.
- [Referencia de routers](/docs/api/routers) — rutas estáticas, anuncio por BGP y configuraciones más avanzadas.
- [IPs flotantes](/docs/api/floating-ips) — la primitiva de IP pública que conecta todo esto con el exterior.
