---
title: "Configuration réseau d’un projet"
description: "Réseaux, sous-réseaux, routeurs et groupes de sécurité — le câblage de référence d’une application multi-tiers."
publishedAt: 2026-05-20
updatedAt: 2026-11-04
kind: guide
---

# Configuration réseau d’un projet

La configuration réseau NimbusNexus de référence pour une application multi-tiers : un réseau privé par tier (l’un exposé au public, l’autre réservé à la base de données), un routeur qui les relie entre eux et à internet, et des groupes de sécurité qui restreignent le trafic entre les tiers. Ce guide décrit la mise en place de bout en bout et explique la raison d’être de chaque élément.

À la fin, vous aurez :

- Deux réseaux, chacun avec un sous-réseau (`10.0.1.0/24` pour le web, `10.0.2.0/24` pour la base de données)
- Un routeur avec une passerelle externe, attaché aux deux sous-réseaux
- Deux groupes de sécurité : `web-sg` (HTTPS ouvert à internet) et `db-sg` (port 5432 uniquement depuis `web-sg`)
- Une méthode de test pour vérifier que l’isolation fonctionne

## Pourquoi cette architecture {#why}

Les applications sur une seule VM n’ont besoin de rien de tout cela — une VM sur le réseau externe détient directement une adresse publique. Cette architecture s’adresse aux applications qui :

- Ont plusieurs composants (tier web + base de données, tier web + tier worker + cache, ...)
- Doivent garder une partie de la stack hors de l’internet public
- Veulent imposer « le tier web peut parler au tier base de données ; rien d’autre ne le peut »

Pour une application vraiment mono-VM, voir plutôt [Modèles de déploiement de conteneurs](/docs/guides/container-deploy).

## Prérequis {#prereqs}

- Une clé API qui peut faire ces appels : `unrestricted`, ou des règles d’accès qui les nomment ([Ce qu’une clé peut faire](/docs/authentication#scopes)).
- Une idée approximative des VM / services que vous voulez dans chaque tier.

Tout ce que vous créez ici se retrouve dans la [région](/docs/api/regions) de votre session.

```bash
export NIMBUS_KEY="<your-api-key>"
```

## 1 · Créer les réseaux {#network}

Un réseau est le domaine de diffusion L2 — toutes les VM et ressources attachées au même réseau peuvent se joindre (sous réserve des groupes de sécurité). Créez-en un par tier : une VM rejoint un réseau, pas un sous-réseau ; sur un réseau à deux sous-réseaux, vous ne pourriez donc pas choisir celui dans lequel elle se retrouve.

```bash
curl -X POST {{API_BASE_URL}}/api/v1/network/ \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "name": "web-network" }'

curl -X POST {{API_BASE_URL}}/api/v1/network/ \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "name": "db-network" }'
```

Chaque réponse contient l’`id` du nouveau réseau sous `data`. Enregistrez les deux :

```bash
export WEB_NET_ID="<web-network-id>"
export DB_NET_ID="<db-network-id>"
```

## 2 · Créer deux sous-réseaux {#subnets}

Donnez à chaque réseau un bloc d’adresses. Choisissez une plage qui ne chevauche ni le VPN de votre bureau, ni votre réseau domestique, ni aucun autre réseau auquel vous pourriez vous connecter plus tard (`192.168.0.0/16` est donc en général un mauvais choix — trop courant). Les blocs à l’intérieur de `10.0.0.0/16` conviennent à la plupart des configurations ; `172.16.0.0/12` aussi.

```bash
# Web subnet
curl -X POST {{API_BASE_URL}}/api/v1/subnet/ \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"web\",
    \"network_id\": \"$WEB_NET_ID\",
    \"ip_version\": 4,
    \"cidr\": \"10.0.1.0/24\",
    \"gateway_ip\": \"10.0.1.1\"
  }"

# Database subnet
curl -X POST {{API_BASE_URL}}/api/v1/subnet/ \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"db\",
    \"network_id\": \"$DB_NET_ID\",
    \"ip_version\": 4,
    \"cidr\": \"10.0.2.0/24\",
    \"gateway_ip\": \"10.0.2.1\"
  }"
```

L’IP de passerelle est l’adresse de l’interface du routeur sur ce sous-réseau. Les VM l’utilisent comme route par défaut.

Enregistrez les `id` des deux sous-réseaux :

```bash
export WEB_SUBNET_ID="<web-subnet-id>"
export DB_SUBNET_ID="<db-subnet-id>"
```

## 3 · Créer le routeur et l’attacher aux deux sous-réseaux {#router}

C’est le routeur qui fait sortir le trafic des sous-réseaux vers internet (et le fait revenir), et qui le fait passer d’un sous-réseau à l’autre. `GET /api/v1/router/artifacts` liste les réseaux externes auxquels il peut se connecter :

```bash
curl -s {{API_BASE_URL}}/api/v1/router/artifacts \
  -H "X-API-Key: $NIMBUS_KEY" | jq '.data.external_networks.data'
```

```bash
export EXTERNAL_NET_ID="<external-network-id>"

curl -X POST {{API_BASE_URL}}/api/v1/router/ \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"app-router\",
    \"external_gateway_info\": { \"network_id\": \"$EXTERNAL_NET_ID\" },
    \"bandwidth_subscription\": \"Monthly\",
    \"bandwidth_mbps\": 100
  }"
```

`external_gateway_info` alloue une IP publique au routeur et active le SNAT pour le trafic sortant des sous-réseaux qui lui sont attachés. Il demande aussi `bandwidth_subscription` et `bandwidth_mbps` (un multiple de 10) : la passerelle est plafonnée à cette bande passante, et la bande passante est facturée ([Données tarifaires](/docs/api/pricing-data)).

Enregistrez l’identifiant du routeur et attachez-le aux deux sous-réseaux :

```bash
export ROUTER_ID="<router-id>"

curl -X PUT {{API_BASE_URL}}/api/v1/router/$ROUTER_ID/interface \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{ \"subnet_id\": \"$WEB_SUBNET_ID\" }"

curl -X PUT {{API_BASE_URL}}/api/v1/router/$ROUTER_ID/interface \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{ \"subnet_id\": \"$DB_SUBNET_ID\" }"
```

Le tier web peut maintenant atteindre le tier base de données, et les VM de base de données peuvent atteindre internet, par exemple pour les mises à jour de paquets. Rien sur internet ne peut atteindre une VM sans IP flottante — c’est ainsi que le tier base de données reste hors de l’internet public.

## 4 · Créer les groupes de sécurité {#security-groups}

Les groupes de sécurité sont des pare-feu avec état appliqués aux interfaces réseau d’une VM. Ils contrôlent le trafic qui entre (ingress) et celui qui sort (egress). « Avec état » signifie que le retour d’une connexion initiée de l’intérieur est automatiquement autorisé — vous n’avez besoin de règles que pour les connexions initiées de l’extérieur. Un nouveau groupe laisse sortir tout le trafic et n’en laisse entrer aucun : ces deux groupes n’ont donc besoin que de règles entrantes.

```bash
curl -X POST {{API_BASE_URL}}/api/v1/security_group/ \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "name": "web-sg", "description": "Web tier" }'

curl -X POST {{API_BASE_URL}}/api/v1/security_group/ \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "name": "db-sg", "description": "Database tier" }'
```

Enregistrez les `id` des deux groupes, puis ajoutez une règle par appel :

```bash
export WEB_SG_ID="<web-sg-id>"
export DB_SG_ID="<db-sg-id>"

# Web security group — HTTPS open to the internet
curl -X POST {{API_BASE_URL}}/api/v1/security_group/rule \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"security_group_id\": \"$WEB_SG_ID\",
    \"direction\": \"ingress\",
    \"ether\": \"IPv4\",
    \"protocol\": \"tcp\",
    \"port_min\": 443,
    \"remote_cidr\": \"0.0.0.0/0\",
    \"description\": \"HTTPS\"
  }"

# Web security group — SSH from your office
curl -X POST {{API_BASE_URL}}/api/v1/security_group/rule \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"security_group_id\": \"$WEB_SG_ID\",
    \"direction\": \"ingress\",
    \"ether\": \"IPv4\",
    \"protocol\": \"tcp\",
    \"port_min\": 22,
    \"remote_cidr\": \"203.0.113.5/32\",
    \"description\": \"SSH from office\"
  }"

# DB security group — port 5432 only from the web SG
curl -X POST {{API_BASE_URL}}/api/v1/security_group/rule \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"security_group_id\": \"$DB_SG_ID\",
    \"direction\": \"ingress\",
    \"ether\": \"IPv4\",
    \"protocol\": \"tcp\",
    \"port_min\": 5432,
    \"remote_sec_grp\": \"$WEB_SG_ID\",
    \"description\": \"Postgres from web tier\"
  }"
```

C’est le `remote_sec_grp` de la règle du SG de la base qui impose « seul le tier web peut se connecter » — au lieu d’un CIDR statique, la règle référence le SG lui-même. Toute VM de `web-sg` peut atteindre la base. Ajoutez des VM à `web-sg` ou retirez-en : la liste d’accès se met à jour automatiquement.

Le SG web n’ouvre le port 22 (SSH) qu’à une IP de bureau précise, pas au monde entier. N’ouvrez pas SSH à `0.0.0.0/0` — sur chaque cloud, des scanners testent le port 22 à la recherche de mots de passe faibles.

## 5 · Attacher les VM {#attach}

À la création d’une VM, indiquez le réseau et les groupes de sécurité. [Démarrage rapide](/docs/quickstart#region) montre d’où viennent l’image et les valeurs de `spec`. `sshs` nomme une [clé SSH](/docs/api/ssh-keys) que vous avez enregistrée.

```bash
export SSH_KEY_NAME="<ssh-key-name>"

# Web tier VM
curl -X POST {{API_BASE_URL}}/api/v1/instance/ \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"web-01\",
    \"image\": \"$IMAGE_ID\",
    \"spec\": {
      \"architecture\": \"$ARCHITECTURE\",
      \"vm_class\": \"$VM_CLASS\",
      \"cpu\": 2,
      \"ram\": 4096,
      \"volume_type\": \"$VOLUME_TYPE\"
    },
    \"volume_size\": 25,
    \"network\": [\"$WEB_NET_ID\"],
    \"security_group\": [\"$WEB_SG_ID\"],
    \"sshs\": \"$SSH_KEY_NAME\"
  }"

# Database tier VM (if running DB on your own VM)
curl -X POST {{API_BASE_URL}}/api/v1/instance/ \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"db-01\",
    \"image\": \"$IMAGE_ID\",
    \"spec\": {
      \"architecture\": \"$ARCHITECTURE\",
      \"vm_class\": \"$VM_CLASS\",
      \"cpu\": 4,
      \"ram\": 8192,
      \"volume_type\": \"$VOLUME_TYPE\"
    },
    \"volume_size\": 50,
    \"network\": [\"$DB_NET_ID\"],
    \"security_group\": [\"$DB_SG_ID\"],
    \"sshs\": \"$SSH_KEY_NAME\"
  }"
```

Pour un accès externe à la VM web, allouez une [IP flottante](/docs/api/floating-ips) et attachez-la. La VM de base de données ne reçoit jamais d’IP flottante — c’est ainsi que fonctionne l’isolation réseau.

## 6 · Vérifier l’isolation {#verify}

Vérifiez que l’architecture impose bien ce que vous vouliez. Trouvez l’adresse de la VM de base de données dans le `nics` que renvoie `GET /api/v1/instance/` ; disons que c’est `10.0.2.10`.

```bash
# From the web VM, can we reach the DB on 5432? (Should: yes)
nc -v -w 3 10.0.2.10 5432

# From the web VM, can we reach the DB on 22 (SSH)? (Should: no — DB SG only opens 5432)
nc -v -w 3 10.0.2.10 22

# From your laptop, can we reach the DB directly? (Should: no — the DB VM has no public IP)
nc -v -w 3 10.0.2.10 5432
```

Si l’un de ces tests ne se comporte pas comme prévu, les règles des groupes de sécurité ou les rattachements réseau/sous-réseau sont incorrects. Revérifiez-les.

## Ce que ce n’est pas {#not}

- **Pas du peering VPC.** Il s’agit du réseau interne d’un seul projet. Les réseaux de deux projets NimbusNexus ne sont pas appairés — c’est voulu (voir [Modèle de sécurité](/docs/security#network)).
- **Pas une couche WAF ou anti-DDoS complète.** Les groupes de sécurité opèrent en L3/L4 — ils ne peuvent pas inspecter le corps des requêtes HTTP. Pour un filtrage applicatif, faites tourner un WAF (par exemple ModSecurity derrière nginx) dans le tier web.
- **Pas d’autoscaling.** Vous gérez les VM à la main. Pour des flottes en autoscaling, les mêmes briques réseau fonctionnent, mais il vous faudrait de l’infrastructure-as-code (Terraform, Pulumi) pour les gérer à grande échelle.

## Étapes suivantes {#next-steps}

- [Référence des réseaux](/docs/api/networks) — toutes les options de l’appel de création.
- [Référence des sous-réseaux](/docs/api/subnets) — configuration IPv6, options DHCP, remplacement des serveurs de noms DNS.
- [Référence des groupes de sécurité](/docs/api/security-groups) — la syntaxe complète des règles.
- [Référence des routeurs](/docs/api/routers) — routes statiques et fonctionnement du NAT.
- [IP flottantes](/docs/api/floating-ips) — la brique d’IP publique qui relie tout cela au monde extérieur.
