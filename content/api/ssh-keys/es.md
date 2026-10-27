---
title: "Claves SSH"
description: "Claves públicas registradas en el proyecto e inyectadas en las VMs al arrancar."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: reference
---

# Claves SSH

Las claves SSH son la forma de iniciar sesión en las VMs Linux después de que arranquen. Registra tu clave pública en el proyecto; cada VM nueva la recibe en el `~/.ssh/authorized_keys` del usuario por defecto mediante cloud-init.

## Cómo funciona {#how-it-works}

Solo registras la clave **pública** — NimbusNexus nunca ve tu clave privada. Al arrancar, el servicio de metadatos expone a cloud-init las claves públicas registradas en el proyecto, y cloud-init las escribe en el archivo authorized_keys del usuario por defecto (`ubuntu` en Ubuntu, `debian` en Debian, `rocky` en Rocky, `Administrator` en Windows mediante WinRM).

Las claves que se añaden **después** de que arranque una VM no se envían automáticamente a las VMs en ejecución. O reinicias la VM (por defecto, cloud-init solo se ejecuta en el primer arranque, así que esto solo sirve con imágenes que activan la reejecución) o añades la clave dentro de la VM con tu herramienta habitual de gestión de la configuración.

## Formatos admitidos {#formats}

Aceptamos:

- **ed25519** — recomendado; pequeño, rápido y moderno
- **ecdsa-sha2-nistp256 / nistp384 / nistp521**
- **RSA** — 2048 bits como mínimo; se recomiendan 4096 bits; rechazamos < 2048

DSA se rechaza (está obsoleto en el proyecto original desde OpenSSH 7.0).

La cadena de la clave tiene que estar en formato OpenSSH — la única línea que empieza por `ssh-ed25519`, `ecdsa-sha2-nistp...` o `ssh-rsa`, seguida del material de la clave codificado en base64 y, opcionalmente, de un comentario. Eso es lo que contienen por defecto los archivos `~/.ssh/id_*.pub`.

## Huellas digitales + duplicados {#fingerprints}

Cada clave tiene una **huella digital SHA256** estable. La API rechaza los duplicados por huella digital — añadir la misma clave dos veces (aunque sea con otra etiqueta) devuelve un 409. Así se detecta el error habitual de "he añadido la clave de mi portátil a dos proyectos" antes de que cause confusión en la atribución de cuentas.

## Eliminación de una clave {#removing}

Borrar una clave del proyecto la quita de los arranques futuros de VMs. **Las VMs que ya han arrancado conservan la clave** en su archivo authorized_keys — cloud-init no es un reconciliador de estado, es un instalador de primer arranque. Para revocar una clave de las VMs en ejecución, tienes dos opciones:

1. Recrear las VMs a partir de un snapshot reciente, o
2. Editar `~/.ssh/authorized_keys` directamente dentro de la VM (o con tu herramienta de gestión de la configuración).

Si lo que buscas es revocarla rápido porque la clave se ha visto comprometida: el panel tiene la opción "revoke from all projects", de un solo clic, que envía la eliminación mediante el servicio de metadatos. El equivalente en la API está en la referencia de IAM (próximamente).

## Próximos pasos {#next-steps}

- [Máquinas virtuales](/docs/api/vms) — las VMs usan estas claves al arrancar.
- [Autenticación](/docs/authentication) — las claves de API no tienen nada que ver; son para la API de gestión, no para iniciar sesión en las VMs.
