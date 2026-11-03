---
title: "Claves SSH"
description: "Claves públicas registradas en tu usuario e instaladas en una VM al arrancar."
publishedAt: 2026-05-20
updatedAt: 2026-11-03
kind: reference
---

# Claves SSH

Las claves SSH son la forma de iniciar sesión en las VMs Linux después de que arranquen. Registra una clave en tu usuario y luego indícala en `sshs` al crear una VM; cloud-init la escribe en el `~/.ssh/authorized_keys` del usuario por defecto.

## Cómo funciona {#how-it-works}

Hay dos formas de registrar una clave:

- `POST /api/v1/ssh/add_public` con un `name` y tu `ssh_public_key`. Solo envías la clave **pública**; la clave privada se queda contigo.
- `POST /api/v1/ssh/` con un `name` genera un par de claves y devuelve su `private_key` una sola vez. Guárdala en ese momento: la API no vuelve a mostrarla nunca.

Una VM recibe la única clave que indicas en `sshs` al crearla. Al arrancar, el servicio de metadatos expone esa clave pública a cloud-init, que la escribe en el archivo authorized_keys del usuario por defecto.

Las claves que se añaden **después** de que arranque una VM no se envían automáticamente a las VMs en ejecución. Una VM conserva la clave con la que se creó, así que añade una clave nueva dentro de la VM con tu herramienta habitual de gestión de la configuración.

## Formatos admitidos {#formats}

La cadena de la clave tiene que estar en formato OpenSSH — la única línea que empieza por `ssh-ed25519`, `ecdsa-sha2-nistp...` o `ssh-rsa`, seguida del material de la clave codificado en base64 y, opcionalmente, de un comentario. Eso es lo que contienen por defecto los archivos `~/.ssh/id_*.pub`.

## Huellas digitales + duplicados {#fingerprints}

Cada clave tiene una **huella digital SHA256** estable. `GET /api/v1/ssh/` lista tus claves con su `fingerprint` y su `key` pública. Los nombres de las claves deben ser únicos entre tus claves: registrar una segunda clave con un nombre que ya usas responde `409`.

## Eliminación de una clave {#removing}

`DELETE /api/v1/ssh/` con el id de la clave en `ssh_keys` la borra, así que las VMs nuevas no pueden usarla. **Las VMs que ya han arrancado conservan la clave** en su archivo authorized_keys — cloud-init no es un reconciliador de estado, es un instalador de primer arranque. Para revocar una clave de las VMs en ejecución, tienes dos opciones:

1. Recrear las VMs con otra clave en `sshs`, o
2. Editar `~/.ssh/authorized_keys` directamente dentro de la VM (o con tu herramienta de gestión de la configuración).

## Próximos pasos {#next-steps}

- [Máquinas virtuales](/docs/api/vms) — las VMs usan estas claves al arrancar.
- [Autenticación](/docs/authentication) — las claves de API son para la API de gestión, no para iniciar sesión en las VMs. Los endpoints de claves SSH necesitan una sesión iniciada, no una clave de API.
