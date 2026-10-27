---
title: "CLI de Webhooks"
description: "nn-webhooks — un único binario estático para publicar eventos, gestionar endpoints y vaciar la cola dead-letter."
publishedAt: 2026-08-05
updatedAt: 2026-10-20
kind: cli
---

# CLI de Webhooks

`nn-webhooks` es la interfaz de línea de comandos de [NimbusNexus Webhooks](/docs/product-webhooks). Un único binario estático — sin entorno de ejecución, sin virtualenv, sin nada que instalar antes. Hoy es la única CLI de NimbusNexus; todavía no hay una CLI para Infraestructura.

Esa es toda la razón de que esté escrita en Go. Un operador que vacía una cola dead-letter a las tres de la madrugada suele estar en una máquina en la que no hay nada instalado, y "primero instala el entorno de ejecución de un lenguaje" no es un paso aceptable en plena incidencia.

## Instalación {#install}

La versión actual es **{{WEBHOOKS_CLI_VERSION}}**. Cada versión del [repositorio público webhooks-go](https://github.com/NimbusNexus/webhooks-go/releases) incluye archivos comprimidos para macOS, Linux y Windows en amd64 y arm64, con un `checksums.txt`, y Homebrew instala esos mismos archivos.

En macOS, Homebrew es el camino más corto. El tap incluye un cask, y Homebrew solo instala casks en macOS:

```bash
brew install nimbusnexus/tap/nn-webhooks
nn-webhooks version
```

En Linux, o en macOS sin Homebrew, descarga el archivo comprimido, compruébalo con las sumas de comprobación de la versión y pon el binario en tu `PATH`. Asigna a `OS` el valor `linux` o `darwin`, y a `ARCH`, `amd64` o `arm64`:

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

El paso de la suma de comprobación debe imprimir `OK` para el archivo comprimido; si no lo hace, detente ahí. Windows usa los archivos `.zip`: [Configura la CLI](/docs/setup/cli#windows) tiene los pasos para PowerShell.

Con la cadena de herramientas de Go (1.25 o posterior), compílala en su lugar desde el código fuente:

```bash
go install github.com/NimbusNexus/webhooks-go/cmd/nn-webhooks@latest
```

## Iniciar sesión {#sign-in}

```bash
nn-webhooks login         # opens your browser; approve, and the CLI is signed in
nn-webhooks whoami        # the workspace, key name, permissions and expiry
nn-webhooks logout        # revokes that key and removes the profile
```

`login` imprime un código corto y abre [{{ACCOUNT_BASE_URL}}/device]({{ACCOUNT_BASE_URL}}/device) en tu navegador. Inicia sesión como de costumbre, comprueba que el código de la página coincide con el de tu terminal y aprueba. La CLI guarda entonces en su perfil una clave de API llamada `nn-webhooks on <your hostname>`. La clave es válida durante 90 días y aparece en **API keys** en la consola, donde puedes revocarla en cualquier momento.

Un propietario o administrador del workspace aprueba la solicitud, y puede restringir sus permisos (**Read & write**, **Publish** o **Read**) o limitar la clave a un proyecto. Un miembro ve la solicitud pero no puede aprobarla: pídeselo a un administrador, o [configura](#configure) una clave que un administrador haya creado para ti.

Aprueba solo un inicio de sesión que hayas empezado tú. Un código que te envíe otra persona le daría acceso a tu workspace.

En una máquina sin navegador, como una sesión SSH o un contenedor, ejecuta `nn-webhooks login --no-browser` y abre el enlace impreso en cualquier dispositivo. El código es válido durante 15 minutos. Volver a iniciar sesión sustituye la clave del perfil y revoca la anterior.

## Configuración {#configure}

`configure` guarda una clave que ya tienes, como una que un administrador haya emitido en la consola para CI:

```bash
nn-webhooks configure     # prompts for the API URL and key
nn-webhooks whoami        # what would be used, and where it came from
```

`nn-webhooks keys create` y `keys revoke` siguen en el binario y siguen apareciendo en `--help`, pero las rutas `/v1/api-keys` que usan se eliminaron, así que ahora ambos fallan con un `404`. Emite una clave en tu consola de la cuenta de NimbusNexus, en **API keys**, eligiendo **Webhooks** como producto — consulta [Cómo obtener acceso](/docs/product-webhooks#access). Una clave `whsk_…` de antes del cambio ya no sirve para autenticarse, así que un perfil que todavía tenga una hay que reconfigurarlo con una de sustitución.

Las credenciales se guardan en `$XDG_CONFIG_HOME/nn-webhooks/credentials.json` — o en `~/.config/nn-webhooks/credentials.json` si `XDG_CONFIG_HOME` no está definida, como ocurre por defecto en macOS — con modo `0600`, como **perfiles con nombre**, así que un segundo despliegue es una opción en lugar de sobrescribir el primero:

```bash
nn-webhooks --profile staging configure --url {{WEBHOOKS_BASE_URL}}
nn-webhooks --profile staging endpoints list
```

Para CI, prescinde del archivo por completo:

```bash
export NN_WEBHOOKS_URL={{WEBHOOKS_BASE_URL}}
export NN_WEBHOOKS_API_KEY="<your-api-key>"
nn-webhooks deliveries list --status dead
```

La precedencia es `--api-key`, después `$NN_WEBHOOKS_API_KEY` y después el perfil — y `whoami` indica **cuál ha ganado**. Esto importa más de lo que parece: una variable de entorno antigua que oculta sin avisar el perfil que acabas de escribir es la confusión habitual, y un simple "configured" no puede explicarlo.

La clave en sí nunca se imprime, solo sus cuatro últimos caracteres. La salida de un comando de diagnóstico es justo lo que acaba pegado en un ticket de soporte.

## Comandos {#commands}

```bash
nn-webhooks publish deploy.completed --data '{"id":1}' --idempotency-key deploy-1

nn-webhooks endpoints list
nn-webhooks endpoints create --url https://example.com/hook --subscribe prefix:deploy.
nn-webhooks endpoints get ep_123
nn-webhooks endpoints update ep_123 --set max_attempts=10 --set status=disabled
nn-webhooks endpoints replace-subscriptions ep_123 --subscribe exact:deploy.completed --subscribe suffix:.failed
nn-webhooks endpoints rotate-secret ep_123
nn-webhooks endpoints enable ep_123

nn-webhooks deliveries list --status dead
nn-webhooks deliveries redeliver dlv_456

nn-webhooks verify --secret whsec_... --signature sha256=... --timestamp 1785984800 < body.json
```

Las suscripciones se indican como `kind:pattern`, y se pueden repetir — `--subscribe prefix:deploy.` o
`--subscribe exact:deploy.completed`. Los valores que se pasan a `--set` se interpretan como JSON y, si no lo son,
como cadena, y `null` borra un campo.

`update` no puede cambiar las suscripciones, porque webhookd las ignora en un PATCH: `replace-subscriptions` fija la lista completa de una vez, sustituyendo la que había, y `--none` da de baja el endpoint de todo.

Todo imprime JSON, así que se puede pasar a `jq` por una tubería sin tener que recordar una opción `--format`:

```bash
nn-webhooks deliveries list --status dead | jq -r '.items[].id' | \
  xargs -n1 nn-webhooks deliveries redeliver
```

`nn-webhooks verify` comprueba un webhook que has recibido — útil para confirmar que un rechazo de tu handler se debe a la firma y no a cómo trata el cuerpo el framework, que es el culpable más habitual. Pasa `--timestamp`: sin él, el HMAC se calcula solo sobre el cuerpo, lo que nunca coincide con una entrega real, así que todas las comprobaciones fallan. Imprime `ok`/`failed` en lugar de JSON, y termina con el código de salida 0/1.

## Versiones {#versions}

```bash
nn-webhooks version
```

Se muestran dos números, y pueden ser distintos con toda legitimidad:

- `version` — la versión de la que procede este binario, grabada en tiempo de compilación
- `sdk` — la librería cliente compilada en él

Un binario compilado desde el código fuente no tiene ninguna etiqueta que mostrar, así que indica la versión del SDK con el sufijo `+source` en lugar de presentarse como una versión publicada.

## Próximos pasos {#next-steps}

- [SDKs](/docs/product-webhooks/sdks) — las mismas operaciones desde el código de tu aplicación.
- [Inicio rápido](/docs/product-webhooks/quickstart) — el flujo que automatizan estos comandos.
- [Verificación de firmas](/docs/product-webhooks/signatures) — lo que comprueba `nn-webhooks verify`.
- [Resumen de Webhooks](/docs/product-webhooks) — los objetos y la semántica de entrega.
