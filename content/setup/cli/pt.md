---
title: "Configurar a CLI"
description: "Instale o nn-webhooks com o Homebrew, um download verificado ou go install, configure uma chave de API e faça sua primeira chamada."
publishedAt: 2026-10-19
updatedAt: 2026-10-19
kind: cli
---

# Configurar a CLI

O `nn-webhooks` é a ferramenta de linha de comando do [Webhooks](/docs/product-webhooks): um único binário estático para macOS, Linux e Windows, sem mais nada para instalar. Ele publica eventos, gerencia endpoints e reenvia entregas que falharam. Hoje, é a única CLI da NimbusNexus. Uma CLI para Infraestrutura ainda não está disponível; use a [API REST](/docs/setup/rest) em vez dela.

A versão atual é a **{{WEBHOOKS_CLI_VERSION}}**. Os arquivos compactados e o `checksums.txt` correspondente ficam anexados a cada versão do [repositório público webhooks-go](https://github.com/NimbusNexus/webhooks-go/releases), e o Homebrew instala esses mesmos arquivos.

## 1 · Instalar {#install}

### macOS: Homebrew {#homebrew}

```bash
brew install nimbusnexus/tap/nn-webhooks
nn-webhooks version
```

O tap distribui um cask, e o Homebrew só instala casks no macOS. Para atualizar depois, use `brew upgrade nn-webhooks`.

### Linux e macOS: download {#download}

Defina `OS` como `linux` ou `darwin` e `ARCH` como `amd64` ou `arm64`. Depois, baixe o arquivo compactado, confira-o com os checksums da versão e coloque o binário no seu `PATH`:

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

A etapa do checksum precisa imprimir `OK` para o arquivo compactado; se não imprimir, pare por aí. Onde não houver `shasum`, `sha256sum --check --ignore-missing checksums.txt` faz o mesmo. Sem `sudo`, instale em um diretório seu que esteja no seu `PATH`, por exemplo `~/.local/bin`.

### Windows: download {#windows}

No PowerShell, baixe o zip, compare o hash dele com a linha correspondente do `checksums.txt` e descompacte-o em uma pasta que esteja no seu `PATH`:

```powershell
$Version = "{{WEBHOOKS_CLI_VERSION}}"
$Base = "https://github.com/NimbusNexus/webhooks-go/releases/download/v$Version"
Invoke-WebRequest "$Base/nn-webhooks_${Version}_windows_amd64.zip" -OutFile nn-webhooks.zip
Invoke-WebRequest "$Base/checksums.txt" -OutFile checksums.txt
(Get-FileHash nn-webhooks.zip -Algorithm SHA256).Hash.ToLower()
Select-String "windows_amd64.zip" checksums.txt
Expand-Archive nn-webhooks.zip -DestinationPath "$env:LOCALAPPDATA\nn-webhooks"
```

Os dois hashes precisam ser iguais. Depois, adicione `%LOCALAPPDATA%\nn-webhooks` ao seu `PATH` e execute `nn-webhooks version`. Em ARM, use `windows_arm64` nos dois nomes de arquivo.

### Com um toolchain do Go {#go-install}

```bash
go install github.com/NimbusNexus/webhooks-go/cmd/nn-webhooks@latest
```

Isso exige Go 1.25 ou posterior. Um binário compilado a partir do código-fonte informa a versão do SDK com o sufixo `+source` em vez de um número de versão.

## 2 · Configurar uma chave {#configure}

Na sua própria máquina, entre pelo navegador:

```bash
nn-webhooks login
```

Ele imprime um código e abre o console da sua conta. Aprove a solicitação lá, depois de conferir que o código é o mesmo, e a CLI salva uma chave de 90 dias no perfil dela. Os detalhes estão em [Entrar](/docs/product-webhooks/cli#sign-in).

Para usar, em vez disso, uma chave que você já tem, como uma para CI, crie uma chave de Webhooks no [console da sua conta]({{ACCOUNT_BASE_URL}}/api-keys), em **API keys**; os detalhes estão em [Obter uma chave de API](/docs/setup/rest#key). Depois, salve-a em um perfil:

```bash
nn-webhooks configure --url {{WEBHOOKS_BASE_URL}}
nn-webhooks whoami
```

O `configure` pede a chave e a armazena em `~/.config/nn-webhooks/credentials.json` com o modo `0600`. O `whoami` mostra qual URL e qual chave seriam usadas e de onde cada uma veio; ele imprime só os quatro últimos caracteres da chave. Em CI, dispense o arquivo e defina as variáveis de ambiente:

```bash
export NN_WEBHOOKS_URL={{WEBHOOKS_BASE_URL}}
export NN_WEBHOOKS_API_KEY="<your-api-key>"
```

## 3 · Fazer a primeira chamada {#first-call}

```bash
nn-webhooks deliveries list
```

Todo comando imprime JSON, então a saída vai direto para o `jq` por pipe. Uma lista `items` vazia significa que a chave funciona e que nada foi entregue ainda.

## Próximos passos {#next-steps}

- [CLI de Webhooks](/docs/product-webhooks/cli): todos os comandos, perfis, precedência e versões.
- [Referência da API de Webhooks](/docs/reference/webhooks): cada operação com o respectivo comando `nn-webhooks`, quando houver.
- [SDKs](/docs/setup/sdk): as mesmas operações pelo código.
