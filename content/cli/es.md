---
title: "CLI"
description: "nimbus — la interfaz de línea de comandos de la API REST de NimbusNexus."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: cli
---

# CLI

> **Estado: versión preliminar.** La CLI está en desarrollo activo. Esta página documenta la forma de la v1.0; hasta que se publique el binario, usa directamente la API REST, como se explica en [Autenticación](/docs/authentication) y [Convenciones](/docs/conventions).

`nimbus` es la interfaz de línea de comandos oficial. Un único binario estático, sin dependencias en tiempo de ejecución, disponible para macOS (Intel + Apple Silicon), Linux (amd64 + arm64) y Windows.

> **¿Buscas `nn-webhooks`?** Es la CLI del [producto Webhooks](/docs/product-webhooks), que es independiente — otro binario, ya publicado y documentado en [CLI de Webhooks](/docs/product-webhooks/cli). Esta página trata de `nimbus`, la CLI de la plataforma en la nube.

## Instalación (cuando se publique) {#install}

```bash
# macOS / Linux — Homebrew
brew install nimbusnexus/tap/nimbus

# Linux — curl + install
curl -fsSL {{BASE_URL}}/cli/install.sh | sh

# Verify
nimbus --version
```

El script de instalación descarga un binario firmado para tu plataforma, verifica la firma con nuestra clave pública publicada y lo instala en `/usr/local/bin/nimbus`. Lee el script antes de pasárselo a `sh` si prefieres entender primero lo que hace.

## Autenticación {#auth}

```bash
nimbus auth login
# Opens a browser window, exchanges for an API key, stores it in your OS keychain.

# Or set an existing key directly:
export NIMBUS_KEY=nn_live_...
```

El flujo de `auth login` genera una clave con alcance inicial vinculada al usuario que tiene la sesión iniciada en el panel. Para CI / automatización, genera una clave de larga duración en el panel y ponla en `NIMBUS_KEY`.

## Comandos habituales {#common}

```bash
# Resources mirror the REST API structure
nimbus vms list --region us-east-1
nimbus vms create --name web-01 --size gp-1-2 --region us-east-1 --image ubuntu-24.04
nimbus vms get vm_01HG7Y3...
nimbus vms delete vm_01HG7Y3...

# Databases
nimbus databases list
nimbus databases create --engine postgres --tier production-2x4 --region us-east-1

# Object storage
nimbus buckets list
nimbus buckets create my-bucket --region us-east-1
nimbus buckets cp ./file.txt nn://my-bucket/file.txt

# DNS
nimbus dns zones create example.com
nimbus dns records create example.com A www 203.0.113.5

# Floating IPs
nimbus floating-ips allocate --region us-east-1
nimbus floating-ips attach ip_01H... --to vm_01HG7Y3...
```

Cada tipo de recurso tiene como mínimo `list`, `get`, `create` y `delete`, más comandos propios de cada tipo (p. ej. `vms reboot`, `databases restore`, `dns records bulk-import`).

## Formatos de salida {#output}

```bash
# Human-readable table (default for terminals)
nimbus vms list

# JSON for scripting
nimbus vms list --output json

# JSONL (newline-delimited, good for piping)
nimbus vms list --output jsonl | jq -r '.id'

# Just the IDs
nimbus vms list --output ids
```

`--output json` devuelve la respuesta de la API en bruto. `--output ids` es un atajo para el patrón habitual de "dame los IDs para pasarlos a otro comando".

## Configuración + perfiles {#config}

`nimbus` lee la configuración de `~/.config/nimbus/config.toml` (Linux/macOS) o de `%APPDATA%\nimbus\config.toml` (Windows). Varios perfiles para distintos proyectos:

```toml
default_profile = "prod"

[profiles.prod]
api_key_keychain = "nimbus-prod"  # OS keychain reference
default_region = "us-east-1"

[profiles.staging]
api_key_keychain = "nimbus-staging"
default_region = "us-west-1"
```

Cambia de perfil en cada comando:

```bash
nimbus --profile staging vms list
```

O en cada sesión de shell:

```bash
export NIMBUS_PROFILE=staging
nimbus vms list
```

El campo `api_key_keychain` hace referencia a una entrada del llavero del SO; la clave en sí nunca se guarda en el archivo de configuración. Para CI / sistemas no interactivos, define `NIMBUS_KEY` directamente.

## Patrones para scripts {#scripting}

```bash
# Wait for a VM to be running
nimbus vms wait $VM_ID --state running --timeout 5m

# Bulk operations from a file
nimbus vms create --from-file vms.yaml

# Pipe IDs into deletion (with confirmation)
nimbus vms list --output ids --filter "state=stopped" | nimbus vms delete --stdin --yes

# Tail audit logs
nimbus audit-logs tail --project my-project
```

`wait` se bloquea hasta que un recurso llega al estado pedido (o se agota el tiempo de espera). `--stdin` lee IDs de stdin. `--yes` se salta las preguntas de confirmación (úsalo solo en scripts en los que estés seguro).

## Autocompletado del shell {#completion}

```bash
# Bash
nimbus completion bash > /etc/bash_completion.d/nimbus

# Zsh
nimbus completion zsh > "${fpath[1]}/_nimbus"

# Fish
nimbus completion fish > ~/.config/fish/completions/nimbus.fish

# PowerShell
nimbus completion powershell | Out-String | Invoke-Expression
```

El autocompletado cubre los IDs de recursos (los completa a partir de las llamadas de listado recientes guardadas en caché), las regiones, los tamaños, los nombres de imagen y todos los comandos/subcomandos.

## Estado actual {#status}

La CLI se está construyendo sobre el SDK de Go, pero todavía no se ha publicado. Mientras esperas:

- Usa directamente la API REST. Cada comando de la CLI corresponde 1:1 a una llamada a la API.
- La forma que describe esta página es el diseño de la API con el que nos comprometemos.
- Suscríbete al [changelog]({{BASE_URL}}/changelog) para recibir el anuncio del lanzamiento.

## Próximos pasos {#next-steps}

- [Autenticación](/docs/authentication) — lo que hace `auth login` por debajo.
- [SDK de Go](/docs/sdks/go) — el SDK sobre el que se construye la CLI.
- [Webhooks de la plataforma](/docs/webhooks) — `nimbus webhooks endpoints` los gestiona desde la línea de comandos.
