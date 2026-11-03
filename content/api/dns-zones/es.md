---
title: "Zonas DNS"
description: "Zonas DNS autoritativas alojadas en los servidores de nombres de NimbusNexus."
publishedAt: 2026-05-20
updatedAt: 2026-11-03
kind: reference
---

# Zonas DNS

Una zona DNS es un dominio autoritativo alojado en los servidores de nombres de NimbusNexus. Crea una con `POST /api/v1/zones/`, indicando su `name` con el punto final (`example.com.`) y un `email` de administrador; la zona pertenece al proyecto que hace la llamada. Después apunta tu registrador de dominios a nuestros servidores de nombres y añade [registros](/docs/api/dns-records) para publicar direcciones, el enrutamiento del correo y tokens de verificación de ese dominio.

## Delegación {#delegation}

Estos son los servidores de nombres que tienes que configurar en tu registrador:

```text
{{DNS_NS1}}
{{DNS_NS2}}
{{DNS_NS3}}
{{DNS_NS4}}
```

Configúralos como registros NS de tu dominio en tu registrador (GoDaddy, Cloudflare Registrar, Porkbun, etc.). Cuando termine la propagación (normalmente entre unos minutos y unas pocas horas, según los TTLs del registrador), nuestros servidores de nombres pasan a ser autoritativos para el dominio.

Puedes seguir usando tu proveedor de DNS actual en paralelo durante una migración — los registros NS de ambos proveedores pueden coexistir durante un breve periodo si configuras el registrador para usar los dos conjuntos; después, quita el conjunto antiguo cuando hayas trasladado todos los registros.

## Zona frente a subdominio {#zone-vs-subdomain}

Una zona = un dominio. `example.com` es una zona; `api.example.com` es un subdominio que se gestiona con un registro A o CNAME dentro de la zona `example.com`, no una zona aparte — salvo que quieras delegar expresamente `api.example.com` a otro proveedor de DNS, en cuyo caso crearías por separado tanto `example.com` (con registros NS que apunten al otro proveedor para el subdominio) como la zona del subdominio.

Para el uso habitual, lo adecuado es una zona por dominio registrado.

## Próximos pasos {#next-steps}

- [Registros DNS](/docs/api/dns-records) — los registros de dentro de una zona.
- [IPs flotantes](/docs/api/floating-ips) — destino típico de un registro A o AAAA.
- [Balanceadores de carga](/docs/api/load-balancers) — otro destino típico de los registros.
