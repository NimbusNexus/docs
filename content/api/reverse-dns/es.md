---
title: "DNS inverso (registros PTR)"
description: "Registros PTR para IPs flotantes — el nombre de host que devuelve la resolución inversa de tu IP."
publishedAt: 2026-05-21
updatedAt: 2026-05-21
kind: reference
openapiTag: reverse-dns
---

# DNS inverso (registros PTR)

El DNS inverso es el nombre de host que obtiene alguien cuando pregunta "¿qué nombre hay detrás de esta IP?" — lo contrario de la resolución DNS normal. Los registros viven en un árbol aparte (`in-addr.arpa.` para IPv4, `ip6.arpa.` para IPv6) y son autoritativos para el bloque de IPs que cubren.

Para la mayoría de las VMs, el DNS inverso por defecto (`unused.nimbusnexus.net` o similar) está bien. Configura un PTR personalizado cuando:

- **Gestionas un servidor de correo.** La mayoría de los grandes proveedores de email rechazan el correo de IPs cuyo PTR no coincide con el DNS directo del nombre de host que envía. Sin un PTR que coincida, tu tasa de entrega cae a cero.
- **Un socio te tiene en su lista de permitidos y te identifica por PTR.** Algunos firewalls hacen una verificación de búsqueda inversa y luego directa para el TCP entrante.

Los registros PTR se limitan a las [IPs flotantes](/docs/api/floating-ips) reservadas en NimbusNexus — no puedes configurar PTRs en una IP que no sea nuestra.

## Próximos pasos {#next-steps}

- [IPs flotantes](/docs/api/floating-ips) — las IPs reservadas en las que se configuran los PTRs.
- [Zonas DNS](/docs/api/dns-zones) y [Registros DNS](/docs/api/dns-records) — el lado del DNS directo.
