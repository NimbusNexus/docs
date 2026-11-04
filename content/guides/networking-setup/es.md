---
title: "Configuración de red del proyecto"
description: "Redes, subredes, routers y grupos de seguridad — la configuración de referencia para una aplicación multicapa."
publishedAt: 2026-05-20
updatedAt: 2026-11-04
kind: guide
---

# Configuración de red del proyecto

La configuración de red de referencia de NimbusNexus para una aplicación multicapa: una red privada por capa (una de cara al público y otra solo para la base de datos), un router que las conecta entre sí y a internet, y grupos de seguridad que restringen el tráfico entre capas. Esta guía recorre la configuración de principio a fin y explica por qué existe cada pieza.

Al final tendrás:

- Dos redes, cada una con una subred (`10.0.1.0/24` para la web y `10.0.2.0/24` para la base de datos)
- Un router con gateway externo, conectado a las dos subredes
- Dos grupos de seguridad: `web-sg` (HTTPS abierto a internet) y `db-sg` (puerto 5432 solo desde `web-sg`)
- Una forma de probar que el aislamiento funciona

## Por qué esta disposición {#why}

Las aplicaciones de una sola VM no necesitan nada de esto — una VM en la red externa tiene directamente una dirección pública. Esta disposición es para aplicaciones que:

- Tienen varios componentes (capa web + base de datos, capa web + capa de workers + caché, ...)
- Necesitan mantener partes del stack fuera de internet
- Quieren imponer que "la capa web puede hablar con la capa de base de datos; nada más puede"

Para una aplicación que de verdad es de una sola VM, consulta [Patrones de despliegue de contenedores](/docs/guides/container-deploy).

## Requisitos previos {#prereqs}

- Una clave de API que pueda hacer estas llamadas: `unrestricted`, o reglas de acceso que las nombren ([Qué puede hacer una clave](/docs/authentication#scopes)).
- Una idea aproximada de qué VMs / servicios quieres en cada capa.

Todo lo que crees aquí queda en la [región](/docs/api/regions) de tu sesión.

```bash
export NIMBUS_KEY="<your-api-key>"
```

## 1 · Crea las redes {#network}

Una red es el dominio de broadcast L2 — todas las VMs y recursos conectados a la misma red pueden llegar unos a otros (según lo que permitan los grupos de seguridad). Crea una por capa: una VM se une a una red, no a una subred, así que en una red con dos subredes no podrías elegir en qué subred queda.

```bash
curl -X POST {{API_BASE_URL}}/api/v1/network/ \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "name": "web-network" }'

curl -X POST {{API_BASE_URL}}/api/v1/network/ \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "name": "db-network" }'
```

Cada respuesta lleva el `id` de la red nueva en `data`. Guarda los dos:

```bash
export WEB_NET_ID="<web-network-id>"
export DB_NET_ID="<db-network-id>"
```

## 2 · Crea dos subredes {#subnets}

Dale a cada red un bloque de direcciones. Elige uno que no se solape con la VPN de tu oficina, la red de tu casa ni ninguna otra red a la que puedas conectarte más adelante (por eso `192.168.0.0/16` suele ser una mala elección — se usa demasiado). Los bloques dentro de `10.0.0.0/16` sirven para la mayoría de las configuraciones; `172.16.0.0/12` también está bien.

```bash
# Web subnet
curl -X POST {{API_BASE_URL}}/api/v1/subnet/ \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"web\",
    \"network_id\": \"$WEB_NET_ID\",
    \"ip_version\": 4,
    \"cidr\": \"10.0.1.0/24\",
    \"gateway_ip\": \"10.0.1.1\"
  }"

# Database subnet
curl -X POST {{API_BASE_URL}}/api/v1/subnet/ \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"db\",
    \"network_id\": \"$DB_NET_ID\",
    \"ip_version\": 4,
    \"cidr\": \"10.0.2.0/24\",
    \"gateway_ip\": \"10.0.2.1\"
  }"
```

La IP del gateway es la dirección de la interfaz del router en esa subred. Las VMs la usan como ruta por defecto.

Guarda los `id` de las dos subredes:

```bash
export WEB_SUBNET_ID="<web-subnet-id>"
export DB_SUBNET_ID="<db-subnet-id>"
```

## 3 · Crea el router y conéctalo a las dos subredes {#router}

El router es lo que saca el tráfico de las subredes a internet (y lo trae de vuelta), y lo lleva de una subred a la otra. `GET /api/v1/router/artifacts` lista las redes externas a las que puede conectarse:

```bash
curl -s {{API_BASE_URL}}/api/v1/router/artifacts \
  -H "X-API-Key: $NIMBUS_KEY" | jq '.data.external_networks.data'
```

```bash
export EXTERNAL_NET_ID="<external-network-id>"

curl -X POST {{API_BASE_URL}}/api/v1/router/ \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"app-router\",
    \"external_gateway_info\": { \"network_id\": \"$EXTERNAL_NET_ID\" },
    \"bandwidth_subscription\": \"Monthly\",
    \"bandwidth_mbps\": 100
  }"
```

`external_gateway_info` reserva una IP pública en el router y activa SNAT para el tráfico saliente de las subredes conectadas a él. También necesita `bandwidth_subscription` y `bandwidth_mbps` (un múltiplo de 10): el gateway queda limitado a ese ancho de banda, y el ancho de banda se factura ([Datos de precios](/docs/api/pricing-data)).

Guarda el id del router y conéctalo a las dos subredes:

```bash
export ROUTER_ID="<router-id>"

curl -X PUT {{API_BASE_URL}}/api/v1/router/$ROUTER_ID/interface \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{ \"subnet_id\": \"$WEB_SUBNET_ID\" }"

curl -X PUT {{API_BASE_URL}}/api/v1/router/$ROUTER_ID/interface \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{ \"subnet_id\": \"$DB_SUBNET_ID\" }"
```

La capa web ya puede llegar a la capa de base de datos, y las VMs de la base de datos pueden llegar a internet para cosas como las actualizaciones de paquetes. Desde internet no se puede llegar a una VM que no tenga IP flotante — así es como mantienes la capa de base de datos fuera de internet.

## 4 · Crea los grupos de seguridad {#security-groups}

Los grupos de seguridad son firewalls con estado que se aplican a las interfaces de red de una VM. Controlan el tráfico entrante (ingress) y el saliente (egress). "Con estado" significa que el tráfico de vuelta de una conexión iniciada desde dentro se permite automáticamente — solo necesitas reglas para las conexiones iniciadas desde fuera. Un grupo nuevo deja salir todo el tráfico y no deja entrar nada, así que estos dos solo necesitan reglas de entrada.

```bash
curl -X POST {{API_BASE_URL}}/api/v1/security_group/ \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "name": "web-sg", "description": "Web tier" }'

curl -X POST {{API_BASE_URL}}/api/v1/security_group/ \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "name": "db-sg", "description": "Database tier" }'
```

Guarda los `id` de los dos grupos y, después, añade una regla por llamada:

```bash
export WEB_SG_ID="<web-sg-id>"
export DB_SG_ID="<db-sg-id>"

# Web security group — HTTPS open to the internet
curl -X POST {{API_BASE_URL}}/api/v1/security_group/rule \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"security_group_id\": \"$WEB_SG_ID\",
    \"direction\": \"ingress\",
    \"ether\": \"IPv4\",
    \"protocol\": \"tcp\",
    \"port_min\": 443,
    \"remote_cidr\": \"0.0.0.0/0\",
    \"description\": \"HTTPS\"
  }"

# Web security group — SSH from your office
curl -X POST {{API_BASE_URL}}/api/v1/security_group/rule \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"security_group_id\": \"$WEB_SG_ID\",
    \"direction\": \"ingress\",
    \"ether\": \"IPv4\",
    \"protocol\": \"tcp\",
    \"port_min\": 22,
    \"remote_cidr\": \"203.0.113.5/32\",
    \"description\": \"SSH from office\"
  }"

# DB security group — port 5432 only from the web SG
curl -X POST {{API_BASE_URL}}/api/v1/security_group/rule \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"security_group_id\": \"$DB_SG_ID\",
    \"direction\": \"ingress\",
    \"ether\": \"IPv4\",
    \"protocol\": \"tcp\",
    \"port_min\": 5432,
    \"remote_sec_grp\": \"$WEB_SG_ID\",
    \"description\": \"Postgres from web tier\"
  }"
```

El `remote_sec_grp` de la regla del grupo de seguridad de la base de datos es lo que impone que "solo la capa web puede conectarse" — en lugar de un CIDR estático, la regla hace referencia al propio grupo de seguridad. Cualquier VM de `web-sg` puede llegar a la base de datos. Añade o quita VMs de `web-sg` y la lista de acceso se actualiza automáticamente.

El grupo de seguridad web abre el puerto 22 (SSH) a una IP concreta de la oficina, no a todo el mundo. No abras SSH a `0.0.0.0/0` — en todas las nubes hay escáneres que prueban el 22 en busca de contraseñas débiles.

## 5 · Conecta las VMs {#attach}

Al crear una VM, indica la red y los grupos de seguridad. [Inicio rápido](/docs/quickstart#region) muestra de dónde salen la imagen y los valores de `spec`. `sshs` indica una [clave SSH](/docs/api/ssh-keys) que hayas registrado.

```bash
export SSH_KEY_NAME="<ssh-key-name>"

# Web tier VM
curl -X POST {{API_BASE_URL}}/api/v1/instance/ \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"web-01\",
    \"image\": \"$IMAGE_ID\",
    \"spec\": {
      \"architecture\": \"$ARCHITECTURE\",
      \"vm_class\": \"$VM_CLASS\",
      \"cpu\": 2,
      \"ram\": 4096,
      \"volume_type\": \"$VOLUME_TYPE\"
    },
    \"volume_size\": 25,
    \"network\": [\"$WEB_NET_ID\"],
    \"security_group\": [\"$WEB_SG_ID\"],
    \"sshs\": \"$SSH_KEY_NAME\"
  }"

# Database tier VM (if running DB on your own VM)
curl -X POST {{API_BASE_URL}}/api/v1/instance/ \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"db-01\",
    \"image\": \"$IMAGE_ID\",
    \"spec\": {
      \"architecture\": \"$ARCHITECTURE\",
      \"vm_class\": \"$VM_CLASS\",
      \"cpu\": 4,
      \"ram\": 8192,
      \"volume_type\": \"$VOLUME_TYPE\"
    },
    \"volume_size\": 50,
    \"network\": [\"$DB_NET_ID\"],
    \"security_group\": [\"$DB_SG_ID\"],
    \"sshs\": \"$SSH_KEY_NAME\"
  }"
```

Para el acceso externo a la VM web, reserva una [IP flotante](/docs/api/floating-ips) y asóciala. La VM de la base de datos nunca recibe una IP flotante — así es como funciona el aislamiento de red.

## 6 · Verifica el aislamiento {#verify}

Prueba que el diseño impone de verdad lo que querías. Busca la dirección de la VM de la base de datos en el `nics` que devuelve `GET /api/v1/instance/`; supongamos que es `10.0.2.10`.

```bash
# From the web VM, can we reach the DB on 5432? (Should: yes)
nc -v -w 3 10.0.2.10 5432

# From the web VM, can we reach the DB on 22 (SSH)? (Should: no — DB SG only opens 5432)
nc -v -w 3 10.0.2.10 22

# From your laptop, can we reach the DB directly? (Should: no — the DB VM has no public IP)
nc -v -w 3 10.0.2.10 5432
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
- [Referencia de routers](/docs/api/routers) — rutas estáticas y cómo funciona el NAT.
- [IPs flotantes](/docs/api/floating-ips) — la primitiva de IP pública que conecta todo esto con el exterior.
