---
title: "Zonas DNS"
description: "Zonas DNS autoritativas alojadas en los servidores de nombres de NimbusNexus."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: reference
---

# Zonas DNS

Una zona DNS es un dominio autoritativo alojado en los servidores de nombres de NimbusNexus. Crea una zona para `example.com`, apunta tu registrador de dominios a nuestros servidores de nombres y después añade [registros](/docs/api/dns-records) para publicar direcciones, el enrutamiento del correo y tokens de verificación de ese dominio.

## Delegación {#delegation}

Al crear una zona, la respuesta incluye los cuatro servidores de nombres que tienes que configurar en tu registrador:

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

## DNSSEC {#dnssec}

DNSSEC está activado por defecto en todas las zonas que alojamos. Los registros DS que tienes que publicar en tu registrador se devuelven en el recurso de la zona y se pueden volver a obtener en cualquier momento. Rotamos la ZSK + la KSK cada 90 días; las rotaciones de la KSK requieren actualizar el DS en el registrador.

## Precios {#pricing}

- **Zonas:** \$0.50 por zona al mes.
- **Consultas:** el primer millón de consultas/mes es gratis por zona; \$0.40 por millón a partir de ahí.

Para comparar: el DNS autoritativo de Cloudflare es gratis en el tier básico, Route 53 cuesta \$0.50/zona + un cargo por consulta y AWS Cloud Map es más caro. Nuestros precios nos sitúan entre Cloudflare y Route 53.

## Próximos pasos {#next-steps}

- [Registros DNS](/docs/api/dns-records) — los registros de dentro de una zona.
- [IPs flotantes](/docs/api/floating-ips) — destino típico de un registro A o AAAA.
- [Balanceadores de carga](/docs/api/load-balancers) — otro destino típico de los registros.
