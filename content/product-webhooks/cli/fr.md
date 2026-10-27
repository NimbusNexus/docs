---
title: "CLI Webhooks"
description: "nn-webhooks — un binaire statique unique pour publier des événements, gérer les endpoints et vider la dead-letter queue."
publishedAt: 2026-08-05
updatedAt: 2026-10-20
kind: cli
---

# CLI Webhooks

`nn-webhooks` est l’interface en ligne de commande de [NimbusNexus Webhooks](/docs/product-webhooks). Un seul binaire statique — pas de runtime, pas de virtualenv, rien à installer au préalable. C’est aujourd’hui la seule CLI NimbusNexus ; une CLI pour l’Infrastructure n’est pas encore disponible.

C’est toute la raison pour laquelle elle est écrite en Go. Un opérateur qui vide une dead-letter queue à 3 h du matin se trouve souvent sur une machine où rien n’est installé, et « installez d’abord un runtime de langage » n’est pas une étape acceptable en plein incident.

## Installer {#install}

La version actuelle est **{{WEBHOOKS_CLI_VERSION}}**. Chaque version publiée du [dépôt public webhooks-go](https://github.com/NimbusNexus/webhooks-go/releases) contient des archives pour macOS, Linux et Windows en amd64 et arm64, avec un `checksums.txt`, et Homebrew installe ces mêmes archives.

Sur macOS, Homebrew est le chemin le plus court. Le tap fournit un cask, et Homebrew n’installe les casks que sur macOS :

```bash
brew install nimbusnexus/tap/nn-webhooks
nn-webhooks version
```

Sur Linux, ou sur macOS sans Homebrew, téléchargez l’archive, vérifiez-la avec les sommes de contrôle de la version, et placez le binaire dans votre `PATH`. Réglez `OS` sur `linux` ou `darwin` et `ARCH` sur `amd64` ou `arm64` :

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

L’étape de vérification doit afficher `OK` pour l’archive ; arrêtez-vous là si ce n’est pas le cas. Windows utilise les archives `.zip` : [Configurer la CLI](/docs/setup/cli#windows) donne les étapes PowerShell.

Avec une chaîne d’outils Go (1.25 ou ultérieure), compilez-la plutôt depuis les sources :

```bash
go install github.com/NimbusNexus/webhooks-go/cmd/nn-webhooks@latest
```

## Se connecter {#sign-in}

```bash
nn-webhooks login         # opens your browser; approve, and the CLI is signed in
nn-webhooks whoami        # the workspace, key name, permissions and expiry
nn-webhooks logout        # revokes that key and removes the profile
```

`login` affiche un code court et ouvre [{{ACCOUNT_BASE_URL}}/device]({{ACCOUNT_BASE_URL}}/device) dans votre navigateur. Connectez-vous comme d’habitude, vérifiez que le code affiché sur la page correspond à celui de votre terminal, et approuvez. La CLI enregistre alors dans son profil une clé API nommée `nn-webhooks on <your hostname>`. La clé est valable 90 jours et figure sous **API keys** dans la console, où vous pouvez la révoquer à tout moment.

Un propriétaire ou un admin de l’espace de travail approuve la demande, et peut restreindre ses permissions (**Read & write**, **Publish** ou **Read**) ou limiter la clé à un projet. Un membre voit la demande mais ne peut pas l’approuver : demandez à un admin, ou [configurez](#configure) une clé qu’un admin a créée pour vous.

N’approuvez qu’une connexion que vous avez lancée vous-même. Un code que quelqu’un d’autre vous envoie lui donnerait accès à votre espace de travail.

Sur une machine sans navigateur, comme une session SSH ou un conteneur, lancez `nn-webhooks login --no-browser` et ouvrez le lien affiché sur n’importe quel appareil. Le code est valable 15 minutes. Se reconnecter remplace la clé du profil et révoque l’ancienne.

## Configurer {#configure}

`configure` enregistre une clé que vous avez déjà, comme une clé qu’un admin a créée dans la console pour la CI :

```bash
nn-webhooks configure     # prompts for the API URL and key
nn-webhooks whoami        # what would be used, and where it came from
```

`nn-webhooks keys create` et `keys revoke` sont toujours dans le binaire et toujours listées dans `--help`, mais les routes `/v1/api-keys` sur lesquelles elles s’appuient ont été supprimées : les deux échouent donc désormais avec un `404`. Créez une clé dans votre console de compte NimbusNexus, sous **API keys**, en choisissant **Webhooks** comme produit — voir [Obtenir l’accès](/docs/product-webhooks#access). Une clé `whsk_…` antérieure au changement ne permet plus de s’authentifier : un profil qui en contient encore une doit être reconfiguré avec une clé de remplacement.

Les justificatifs d’identité sont stockés dans `$XDG_CONFIG_HOME/nn-webhooks/credentials.json` — ou dans `~/.config/nn-webhooks/credentials.json` quand `XDG_CONFIG_HOME` n’est pas défini, ce qui est le cas par défaut sur macOS — en mode `0600`, sous forme de **profils nommés**, si bien qu’un second déploiement se gère avec un flag au lieu d’écraser le premier :

```bash
nn-webhooks --profile staging configure --url {{WEBHOOKS_BASE_URL}}
nn-webhooks --profile staging endpoints list
```

Pour la CI, passez-vous entièrement du fichier :

```bash
export NN_WEBHOOKS_URL={{WEBHOOKS_BASE_URL}}
export NN_WEBHOOKS_API_KEY="<your-api-key>"
nn-webhooks deliveries list --status dead
```

L’ordre de priorité est `--api-key`, puis `$NN_WEBHOOKS_API_KEY`, puis le profil — et `whoami` indique **lequel l’a emporté**. C’est plus important qu’il n’y paraît : une variable d’environnement périmée qui masque silencieusement le profil que vous venez d’écrire est la confusion habituelle, et un simple « configured » ne peut pas l’expliquer.

La clé elle-même n’est jamais affichée, seulement ses quatre derniers caractères. La sortie d’une commande de diagnostic est précisément ce qui finit collé dans un ticket de support.

## Commandes {#commands}

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

Les abonnements se donnent sous la forme `kind:pattern`, de façon répétable — `--subscribe prefix:deploy.` ou
`--subscribe exact:deploy.completed`. Les valeurs passées à `--set` sont converties en JSON, avec repli sur une
chaîne, et `null` efface un champ.

`update` ne peut pas modifier les abonnements, car webhookd les ignore lors d’un PATCH : `replace-subscriptions` définit toute la liste d’un coup, en remplaçant ce qui s’y trouvait, et `--none` désabonne l’endpoint de tout.

Tout s’affiche en JSON, et se redirige donc vers `jq` sans flag `--format` à retenir :

```bash
nn-webhooks deliveries list --status dead | jq -r '.items[].id' | \
  xargs -n1 nn-webhooks deliveries redeliver
```

`nn-webhooks verify` vérifie un webhook que vous avez reçu — utile pour confirmer que le rejet d’un handler vient bien de la signature et non de la gestion du corps par le framework, qui est le coupable le plus fréquent. Passez `--timestamp` : sans lui, le HMAC est calculé sur le corps seul, ce qui ne correspond jamais à une vraie livraison, et chaque vérification échoue donc. La commande affiche `ok`/`failed` plutôt que du JSON, et se termine avec le code 0/1.

## Versions {#versions}

```bash
nn-webhooks version
```

Deux numéros sont indiqués, et ils peuvent légitimement différer :

- `version` — la version publiée dont provient ce binaire, inscrite à la compilation
- `sdk` — la bibliothèque cliente compilée dedans

Un binaire compilé depuis les sources n’a pas de tag à nommer : il indique donc la version du SDK avec un suffixe `+source`, plutôt que de se faire passer pour une version publiée.

## Étapes suivantes {#next-steps}

- [SDK](/docs/product-webhooks/sdks) — les mêmes opérations depuis le code de l’application.
- [Démarrage rapide](/docs/product-webhooks/quickstart) — le parcours que ces commandes automatisent.
- [Vérification de signature](/docs/product-webhooks/signatures) — ce que vérifie `nn-webhooks verify`.
- [Vue d’ensemble de Webhooks](/docs/product-webhooks) — les objets et la sémantique de livraison.
