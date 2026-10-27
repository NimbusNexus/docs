---
title: "Configurer la CLI"
description: "Installez nn-webhooks avec Homebrew, un téléchargement vérifié ou go install, configurez une clé API et faites un premier appel."
publishedAt: 2026-10-19
updatedAt: 2026-10-19
kind: cli
---

# Configurer la CLI

`nn-webhooks` est l’outil en ligne de commande de [Webhooks](/docs/product-webhooks) : un binaire statique unique pour macOS, Linux et Windows, sans rien d’autre à installer. Il publie des événements, gère les endpoints et relivre les livraisons en échec. C’est aujourd’hui la seule CLI NimbusNexus. Il n’existe pas encore de CLI pour l’infrastructure ; utilisez plutôt l’[API REST](/docs/setup/rest).

La version actuelle est **{{WEBHOOKS_CLI_VERSION}}**. Ses archives et leur `checksums.txt` sont jointes à chaque version publiée du [dépôt public webhooks-go](https://github.com/NimbusNexus/webhooks-go/releases), et Homebrew installe les mêmes archives.

## 1 · Installer {#install}

### macOS : Homebrew {#homebrew}

```bash
brew install nimbusnexus/tap/nn-webhooks
nn-webhooks version
```

Le tap fournit un cask, et Homebrew n’installe les casks que sur macOS. Pour mettre à jour la CLI plus tard : `brew upgrade nn-webhooks`.

### Linux et macOS : téléchargement {#download}

Définissez `OS` sur `linux` ou `darwin`, et `ARCH` sur `amd64` ou `arm64`. Téléchargez ensuite l’archive, vérifiez-la avec les sommes de contrôle de la version, puis placez le binaire dans votre `PATH` :

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

L’étape de vérification des sommes de contrôle doit afficher `OK` pour l’archive ; arrêtez-vous là si ce n’est pas le cas. Si `shasum` est absent, `sha256sum --check --ignore-missing checksums.txt` fait la même chose. Sans `sudo`, installez le binaire dans un répertoire qui vous appartient et qui se trouve dans votre `PATH`, par exemple `~/.local/bin`.

### Windows : téléchargement {#windows}

Dans PowerShell, téléchargez le zip, comparez son hash avec la ligne correspondante de `checksums.txt`, puis décompressez-le dans un dossier de votre `PATH` :

```powershell
$Version = "{{WEBHOOKS_CLI_VERSION}}"
$Base = "https://github.com/NimbusNexus/webhooks-go/releases/download/v$Version"
Invoke-WebRequest "$Base/nn-webhooks_${Version}_windows_amd64.zip" -OutFile nn-webhooks.zip
Invoke-WebRequest "$Base/checksums.txt" -OutFile checksums.txt
(Get-FileHash nn-webhooks.zip -Algorithm SHA256).Hash.ToLower()
Select-String "windows_amd64.zip" checksums.txt
Expand-Archive nn-webhooks.zip -DestinationPath "$env:LOCALAPPDATA\nn-webhooks"
```

Les deux hashs doivent être identiques. Ajoutez ensuite `%LOCALAPPDATA%\nn-webhooks` à votre `PATH` et lancez `nn-webhooks version`. Sur ARM, utilisez `windows_arm64` dans les deux noms de fichier.

### Avec une chaîne d’outils Go {#go-install}

```bash
go install github.com/NimbusNexus/webhooks-go/cmd/nn-webhooks@latest
```

Il faut Go 1.25 ou ultérieur. Un binaire compilé depuis les sources indique sa version du SDK avec un suffixe `+source` plutôt qu’un numéro de version publiée.

## 2 · Configurer une clé {#configure}

Sur votre propre machine, connectez-vous via le navigateur :

```bash
nn-webhooks login
```

La commande affiche un code et ouvre votre console de compte. Approuvez-y la demande, après avoir vérifié que le code correspond : la CLI enregistre alors une clé valable 90 jours dans son profil. [Se connecter](/docs/product-webhooks/cli#sign-in) donne les détails.

Pour utiliser plutôt une clé que vous avez déjà, par exemple une clé pour la CI, créez une clé Webhooks dans votre [console de compte]({{ACCOUNT_BASE_URL}}/api-keys), sous **API keys** ; [Obtenir une clé API](/docs/setup/rest#key) donne les détails. Enregistrez-la ensuite dans un profil :

```bash
nn-webhooks configure --url {{WEBHOOKS_BASE_URL}}
nn-webhooks whoami
```

`configure` demande la clé et l’enregistre dans `~/.config/nn-webhooks/credentials.json` avec le mode `0600`. `whoami` montre quelle URL et quelle clé seraient utilisées, et d’où vient chacune ; la commande n’affiche que les quatre derniers caractères de la clé. En CI, passez-vous du fichier et définissez plutôt les variables d’environnement :

```bash
export NN_WEBHOOKS_URL={{WEBHOOKS_BASE_URL}}
export NN_WEBHOOKS_API_KEY="<your-api-key>"
```

## 3 · Faire un premier appel {#first-call}

```bash
nn-webhooks deliveries list
```

Chaque commande affiche du JSON : sa sortie se redirige donc directement vers `jq`. Une liste `items` vide signifie que la clé fonctionne et que rien n’a encore été livré.

## Étapes suivantes {#next-steps}

- [CLI Webhooks](/docs/product-webhooks/cli) : toutes les commandes, les profils, l’ordre de priorité et les versions.
- [Référence de l’API Webhooks](/docs/reference/webhooks) : chaque opération, avec sa commande `nn-webhooks` quand elle existe.
- [SDK](/docs/setup/sdk) : les mêmes opérations depuis votre code.
