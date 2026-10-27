---
title: "CLI"
description: "nimbus — l’interface en ligne de commande de l’API REST NimbusNexus."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: cli
---

# CLI

> **Statut : préversion.** La CLI est en développement actif. Cette page décrit la forme de la v1.0 ; tant que le binaire n’est pas publié, utilisez directement l’API REST, comme l’expliquent [Authentification](/docs/authentication) et [Conventions](/docs/conventions).

`nimbus` est l’interface en ligne de commande officielle. Un seul binaire statique, sans dépendance d’exécution, disponible pour macOS (Intel + Apple Silicon), Linux (amd64 + arm64) et Windows.

> **Vous cherchez `nn-webhooks` ?** C’est la CLI du [produit Webhooks](/docs/product-webhooks), qui est distinct — un autre binaire, déjà publié, documenté dans [CLI Webhooks](/docs/product-webhooks/cli). Cette page couvre `nimbus`, la CLI de la plateforme cloud.

## Installer (une fois publiée) {#install}

```bash
# macOS / Linux — Homebrew
brew install nimbusnexus/tap/nimbus

# Linux — curl + install
curl -fsSL {{BASE_URL}}/cli/install.sh | sh

# Verify
nimbus --version
```

Le script d’installation télécharge un binaire signé pour votre plateforme, vérifie sa signature avec notre clé publique publiée et l’installe dans `/usr/local/bin/nimbus`. Lisez le script avant de le passer à `sh` si vous préférez d’abord comprendre ce qu’il fait.

## S’authentifier {#auth}

```bash
nimbus auth login
# Opens a browser window, exchanges for an API key, stores it in your OS keychain.

# Or set an existing key directly:
export NIMBUS_KEY=nn_live_...
```

Le flux `auth login` génère une clé de portée initiale, liée à l’utilisateur actuellement connecté à la console. Pour la CI / l’automatisation, générez une clé de longue durée dans la console et placez-la dans `NIMBUS_KEY`.

## Commandes courantes {#common}

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

Chaque type de ressource a au minimum `list`, `get`, `create`, `delete`, plus des commandes propres au type (par exemple `vms reboot`, `databases restore`, `dns records bulk-import`).

## Formats de sortie {#output}

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

`--output json` renvoie la réponse brute de l’API. `--output ids` est un raccourci pour le cas courant « obtenir les identifiants à passer à une autre commande ».

## Configuration + profils {#config}

`nimbus` lit sa configuration dans `~/.config/nimbus/config.toml` (Linux/macOS) ou `%APPDATA%\nimbus\config.toml` (Windows). Plusieurs profils pour différents projets :

```toml
default_profile = "prod"

[profiles.prod]
api_key_keychain = "nimbus-prod"  # OS keychain reference
default_region = "us-east-1"

[profiles.staging]
api_key_keychain = "nimbus-staging"
default_region = "us-west-1"
```

Changez de profil pour une seule commande :

```bash
nimbus --profile staging vms list
```

Ou pour toute une session shell :

```bash
export NIMBUS_PROFILE=staging
nimbus vms list
```

Le champ `api_key_keychain` fait référence à une entrée du trousseau de l’OS ; la clé brute n’est jamais stockée dans le fichier de configuration. Pour la CI / les systèmes non interactifs, définissez directement `NIMBUS_KEY`.

## Modèles de script {#scripting}

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

`wait` bloque jusqu’à ce qu’une ressource atteigne l’état demandé (ou jusqu’au timeout). `--stdin` lit les identifiants depuis stdin. `--yes` saute les demandes de confirmation (à n’utiliser que dans des scripts dont vous êtes sûr).

## Complétion du shell {#completion}

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

La complétion couvre les identifiants de ressource (complétés à partir des appels de liste récents mis en cache), les régions, les tailles, les noms d’image et chaque commande/sous-commande.

## État actuel {#status}

La CLI est construite sur le SDK Go, mais n’est pas encore publiée. En attendant :

- Utilisez directement l’API REST. Chaque commande de la CLI correspond 1:1 à un appel d’API.
- La forme présentée sur cette page est la conception d’API à laquelle nous nous engageons.
- Abonnez-vous au [changelog]({{BASE_URL}}/changelog) pour l’annonce de la publication.

## Étapes suivantes {#next-steps}

- [Authentification](/docs/authentication) — ce que fait `auth login` en coulisses.
- [SDK Go](/docs/sdks/go) — le SDK sur lequel la CLI est construite.
- [Webhooks de la plateforme](/docs/webhooks) — `nimbus webhooks endpoints` les gère depuis la ligne de commande.
