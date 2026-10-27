---
title: "Configuration réseau d’un projet"
description: "Réseaux, sous-réseaux, routeurs et groupes de sécurité — le câblage de référence d’une application multi-tiers."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: guide
---

# Configuration réseau d’un projet

La configuration réseau NimbusNexus de référence pour une application multi-tiers : un réseau privé avec deux sous-réseaux (l’un exposé au public, l’autre réservé à la base de données), un routeur qui relie le sous-réseau public à internet, et des groupes de sécurité qui restreignent le trafic entre les tiers. Ce guide décrit la mise en place de bout en bout et explique la raison d’être de chaque élément.

À la fin, vous aurez :

- Un réseau avec deux sous-réseaux (`10.0.1.0/24` pour le web, `10.0.2.0/24` pour la base de données)
- Un routeur avec une passerelle externe, attaché au sous-réseau web
- Deux groupes de sécurité : `web-sg` (HTTPS ouvert à internet) et `db-sg` (port 5432 uniquement depuis `web-sg`)
- Une méthode de test pour vérifier que l’isolation fonctionne

## Pourquoi cette architecture {#why}

Les applications sur une seule VM n’ont besoin de rien de tout cela — une VM avec une IP flottante et sans configuration réseau fonctionne très bien. Cette architecture s’adresse aux applications qui :

- Ont plusieurs composants (tier web + base de données, tier web + tier worker + cache, ...)
- Doivent garder une partie de la stack hors de l’internet public
- Veulent imposer « le tier web peut parler au tier base de données ; rien d’autre ne le peut »

Pour une application vraiment mono-VM, voir plutôt [Modèles de déploiement de conteneurs](/docs/guides/container-deploy).

## Prérequis {#prereqs}

- Une clé API avec les portées `networks:write` et `vms:write`.
- Une région choisie (nous utiliserons `us-east-1`).
- Une idée approximative des VM / services que vous voulez dans chaque tier.

```bash
export NIMBUS_KEY="nn_live_xxxxxxxxxxxxxxxx"
export REGION="us-east-1"
```

## 1 · Créer le réseau {#network}

Un réseau est le domaine de diffusion L2 — toutes les VM et ressources attachées au même réseau peuvent se joindre (sous réserve des groupes de sécurité).

```bash
curl -X POST {{API_BASE_URL}}/v1/networks \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "app-network",
    "region": "us-east-1",
    "cidr": "10.0.0.0/16"
  }'
```

Le bloc `10.0.0.0/16` est l’espace d’adressage de tout ce qui se trouve dans ce réseau. Choisissez une plage qui ne chevauche ni le VPN de votre bureau, ni votre réseau domestique, ni aucun autre réseau avec lequel vous pourriez établir un peering plus tard (`192.168.0.0/16` est donc en général un mauvais choix — trop courant). `10.0.0.0/16` convient à la plupart des configurations ; `172.16.0.0/12` aussi.

Enregistrez l’identifiant du réseau :

```bash
export NET_ID="net_01HG7Y3..."
```

## 2 · Créer deux sous-réseaux {#subnets}

Découpez le réseau en deux sous-réseaux — l’un pour ce qui est exposé à l’internet public, l’autre pour ce qui ne doit pas l’être.

```bash
# Web subnet — VMs that need internet access
curl -X POST {{API_BASE_URL}}/v1/subnets \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"web\",
    \"network_id\": \"$NET_ID\",
    \"cidr\": \"10.0.1.0/24\",
    \"gateway_ip\": \"10.0.1.1\"
  }"

# Database subnet — for tier-2 resources
curl -X POST {{API_BASE_URL}}/v1/subnets \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"db\",
    \"network_id\": \"$NET_ID\",
    \"cidr\": \"10.0.2.0/24\",
    \"gateway_ip\": \"10.0.2.1\"
  }"
```

L’IP de passerelle est l’adresse de l’interface du routeur sur ce sous-réseau. Les VM l’utilisent comme route par défaut.

## 3 · Créer le routeur et l’attacher au sous-réseau web {#router}

C’est le routeur qui fait sortir le trafic du sous-réseau web vers internet (et le fait revenir). Le sous-réseau de la base de données n’est pas relié au routeur — c’est ainsi qu’il reste hors de l’internet public.

```bash
curl -X POST {{API_BASE_URL}}/v1/routers \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"app-router\",
    \"region\": \"us-east-1\",
    \"external_gateway\": true
  }"
```

`external_gateway: true` alloue une IP publique au routeur et active le SNAT pour le trafic sortant des sous-réseaux qui lui sont attachés.

Enregistrez l’identifiant du routeur et attachez-le au sous-réseau web :

```bash
export ROUTER_ID="rtr_01HG7Y3..."

curl -X POST {{API_BASE_URL}}/v1/routers/$ROUTER_ID/interfaces \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{ \"subnet_id\": \"$WEB_SUBNET_ID\" }"
```

Le sous-réseau de la base de données reste hors du routeur. Ce qui s’y trouve ne peut atteindre que ce qui est joignable via le réseau L2 — c’est-à-dire les autres éléments du même réseau, sous le contrôle des groupes de sécurité.

## 4 · Créer les groupes de sécurité {#security-groups}

Les groupes de sécurité sont des pare-feu avec état appliqués aux interfaces réseau d’une VM. Ils contrôlent le trafic qui entre (ingress) et celui qui sort (egress). « Avec état » signifie que le retour d’une connexion initiée de l’intérieur est automatiquement autorisé — vous n’avez besoin de règles que pour les connexions initiées de l’extérieur.

```bash
# Web security group — HTTPS open to the internet
curl -X POST {{API_BASE_URL}}/v1/security-groups \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "web-sg",
    "region": "us-east-1",
    "ingress_rules": [
      { "protocol": "tcp", "port": 443, "source_cidr": "0.0.0.0/0", "description": "HTTPS" },
      { "protocol": "tcp", "port": 22, "source_cidr": "203.0.113.5/32", "description": "SSH from office" }
    ],
    "egress_rules": [
      { "protocol": "any", "destination_cidr": "0.0.0.0/0", "description": "anywhere" }
    ]
  }'

# DB security group — port 5432 only from the web SG
curl -X POST {{API_BASE_URL}}/v1/security-groups \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "db-sg",
    "region": "us-east-1",
    "ingress_rules": [
      { "protocol": "tcp", "port": 5432, "source_security_group": "web-sg", "description": "Postgres from web tier" }
    ],
    "egress_rules": [
      { "protocol": "any", "destination_cidr": "0.0.0.0/0", "description": "anywhere" }
    ]
  }'
```

C’est le `source_security_group` de la règle du SG de la base qui impose « seul le tier web peut se connecter » — au lieu d’un CIDR statique, la règle référence le SG lui-même. Toute VM marquée `web-sg` peut atteindre la base. Ajoutez des VM à `web-sg` ou retirez-en : la liste d’accès se met à jour automatiquement.

Le SG web n’ouvre le port 22 (SSH) qu’à une IP de bureau précise, pas au monde entier. N’ouvrez pas SSH à `0.0.0.0/0` — sur chaque cloud, des scanners testent le port 22 à la recherche de mots de passe faibles.

## 5 · Attacher les VM {#attach}

À la création d’une VM, indiquez le réseau, le sous-réseau et les groupes de sécurité :

```bash
# Web tier VM
curl -X POST {{API_BASE_URL}}/v1/vms \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"web-01\",
    \"size\": \"gp-2-4\",
    \"region\": \"us-east-1\",
    \"image\": \"ubuntu-24.04\",
    \"network_interfaces\": [
      { \"subnet_id\": \"$WEB_SUBNET_ID\", \"security_groups\": [\"web-sg\"] }
    ]
  }"

# Database tier VM (if running DB on your own VM rather than managed DB)
curl -X POST {{API_BASE_URL}}/v1/vms \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"db-01\",
    \"size\": \"gp-4-8\",
    \"region\": \"us-east-1\",
    \"image\": \"ubuntu-24.04\",
    \"network_interfaces\": [
      { \"subnet_id\": \"$DB_SUBNET_ID\", \"security_groups\": [\"db-sg\"] }
    ]
  }"
```

Pour un accès externe à la VM web, allouez une [IP flottante](/docs/api/floating-ips) et attachez-la. La VM de base de données ne reçoit jamais d’IP flottante — c’est ainsi que fonctionne l’isolation réseau.

## 6 · Vérifier l’isolation {#verify}

Vérifiez que l’architecture impose bien ce que vous vouliez :

```bash
# From the web VM, can we reach the DB on 5432? (Should: yes)
nc -v -w 3 10.0.2.10 5432

# From the web VM, can we reach the DB on 22 (SSH)? (Should: no — DB SG only opens 5432)
nc -v -w 3 10.0.2.10 22

# From your laptop, can we reach the DB directly? (Should: no — DB subnet isn't routable from internet)
nc -v -w 3 <DB_PUBLIC_IP> 5432  # there's no public IP, this fails
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
- [Référence des routeurs](/docs/api/routers) — routes statiques, annonces BGP, câblage plus avancé.
- [IP flottantes](/docs/api/floating-ips) — la brique d’IP publique qui relie tout cela au monde extérieur.
