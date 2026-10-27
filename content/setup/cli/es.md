---
title: "Configura la CLI"
description: "Instala nn-webhooks con Homebrew, una descarga verificada o go install, configura una clave de API y haz una primera llamada."
publishedAt: 2026-10-19
updatedAt: 2026-10-19
kind: cli
---

# Configura la CLI

`nn-webhooks` es la herramienta de línea de comandos de [Webhooks](/docs/product-webhooks): un único binario estático para macOS, Linux y Windows, sin nada más que instalar. Publica eventos, gestiona endpoints y vuelve a entregar las entregas fallidas. Hoy es la única CLI de NimbusNexus. Todavía no hay una CLI para Infraestructura; usa la [API REST](/docs/setup/rest) en su lugar.

La versión actual es **{{WEBHOOKS_CLI_VERSION}}**. Sus archivos comprimidos y su `checksums.txt` se adjuntan a cada versión del [repositorio webhooks-go](https://github.com/NimbusNexus/webhooks-go/releases), que es público, y Homebrew instala esos mismos archivos.

## 1 · Instalación {#install}

### macOS: Homebrew {#homebrew}

```bash
brew install nimbusnexus/tap/nn-webhooks
nn-webhooks version
```

El tap incluye un cask, y Homebrew solo instala casks en macOS. Para actualizar más adelante, usa `brew upgrade nn-webhooks`.

### Linux y macOS: descarga {#download}

Pon `OS` a `linux` o `darwin` y `ARCH` a `amd64` o `arm64`. Después descarga el archivo comprimido, compruébalo con las sumas de comprobación de la versión y pon el binario en tu `PATH`:

```bash
VERSION={{WEBHOOKS_CLI_VERSION}}
OS=linux
ARCH=amd64
BASE=https://github.com/NimbusNexus/webhooks-go/releases/download/v$VERSION
curl -fsSLO "$BASE/nn-webhooks_${VERSION}_${OS}_${ARCH}.tar.gz"
curl -fsSLO "$BASE/checksums.txt"
shasum -a 256 --check --ignore-missing checksums.txt
tar -xzf "nn-webhooks_${VERSION}_${OS}_${ARCH}.tar.gz" nn-webhooks
sudo install -m 0755 nn-webhooks /usr/local/bin/nn-webhooks
nn-webhooks version
```

El paso de la suma de comprobación debe imprimir `OK` para el archivo comprimido; si no lo hace, detente ahí. Donde no haya `shasum`, `sha256sum --check --ignore-missing checksums.txt` hace lo mismo. Sin `sudo`, instálalo en un directorio tuyo que esté en tu `PATH`, por ejemplo `~/.local/bin`.

### Windows: descarga {#windows}

En PowerShell, descarga el zip, compara su hash con la línea correspondiente de `checksums.txt` y después descomprímelo en una carpeta de tu `PATH`:

```powershell
$Version = "{{WEBHOOKS_CLI_VERSION}}"
$Base = "https://github.com/NimbusNexus/webhooks-go/releases/download/v$Version"
Invoke-WebRequest "$Base/nn-webhooks_${Version}_windows_amd64.zip" -OutFile nn-webhooks.zip
Invoke-WebRequest "$Base/checksums.txt" -OutFile checksums.txt
(Get-FileHash nn-webhooks.zip -Algorithm SHA256).Hash.ToLower()
Select-String "windows_amd64.zip" checksums.txt
Expand-Archive nn-webhooks.zip -DestinationPath "$env:LOCALAPPDATA\nn-webhooks"
```

Los dos hashes deben coincidir. Después añade `%LOCALAPPDATA%\nn-webhooks` a tu `PATH` y ejecuta `nn-webhooks version`. En ARM, usa `windows_arm64` en los dos nombres de archivo.

### Con la cadena de herramientas de Go {#go-install}

```bash
go install github.com/NimbusNexus/webhooks-go/cmd/nn-webhooks@latest
```

Necesita Go 1.25 o posterior. Un binario compilado desde el código fuente indica su versión del SDK con el sufijo `+source` en lugar de un número de versión.

## 2 · Configura una clave {#configure}

En tu propia máquina, inicia sesión desde el navegador:

```bash
nn-webhooks login
```

Imprime un código y abre la consola de tu cuenta. Aprueba allí la solicitud, después de comprobar que el código coincide, y la CLI guarda una clave de 90 días en su perfil. Los detalles están en [Iniciar sesión](/docs/product-webhooks/cli#sign-in).

Para usar en su lugar una clave que ya tengas, como una para CI, crea una clave de Webhooks en la [consola de tu cuenta]({{ACCOUNT_BASE_URL}}/api-keys), en **API keys**; los detalles están en [Obtén una clave de API](/docs/setup/rest#key). Después guárdala en un perfil:

```bash
nn-webhooks configure --url {{WEBHOOKS_BASE_URL}}
nn-webhooks whoami
```

`configure` te pide la clave y la guarda en `~/.config/nn-webhooks/credentials.json` con el modo `0600`. `whoami` muestra qué URL y qué clave se usarían, y de dónde sale cada una; de la clave solo imprime los cuatro últimos caracteres. En CI, prescinde del archivo y usa variables de entorno:

```bash
export NN_WEBHOOKS_URL={{WEBHOOKS_BASE_URL}}
export NN_WEBHOOKS_API_KEY="<your-api-key>"
```

## 3 · Haz una primera llamada {#first-call}

```bash
nn-webhooks deliveries list
```

Todos los comandos imprimen JSON, así que la salida se puede pasar directamente a `jq`. Una lista `items` vacía significa que la clave funciona y que todavía no se ha entregado nada.

## Próximos pasos {#next-steps}

- [CLI de Webhooks](/docs/product-webhooks/cli): todos los comandos, los perfiles, la precedencia y las versiones.
- [Referencia de la API de Webhooks](/docs/reference/webhooks): cada operación con su comando `nn-webhooks`, cuando lo tiene.
- [SDKs](/docs/setup/sdk): las mismas operaciones desde el código.
