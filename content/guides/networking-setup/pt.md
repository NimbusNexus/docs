---
title: "Configuração de rede do projeto"
description: "Redes, sub-redes, roteadores e grupos de segurança — a montagem de referência para uma aplicação multicamadas."
publishedAt: 2026-05-20
updatedAt: 2026-11-04
kind: guide
---

# Configuração de rede do projeto

A configuração de rede de referência da NimbusNexus para uma aplicação multicamadas: uma rede privada por camada (uma voltada para o público e outra só para o banco de dados), um roteador conectando-as entre si e à internet e grupos de segurança restringindo o tráfego entre as camadas. Este guia percorre a configuração de ponta a ponta e explica por que cada peça existe.

No final, você terá:

- Duas redes, cada uma com uma sub-rede (`10.0.1.0/24` para web, `10.0.2.0/24` para banco de dados)
- Um roteador com gateway externo, anexado às duas sub-redes
- Dois grupos de segurança: `web-sg` (HTTPS aberto para a internet) e `db-sg` (porta 5432 apenas a partir do `web-sg`)
- Um padrão de teste para verificar se o isolamento funciona

## Por que esta estrutura {#why}

Apps de uma única VM não precisam de nada disso — uma VM na rede externa tem um endereço público diretamente. Esta estrutura é para apps que:

- Têm vários componentes (camada web + banco de dados, camada web + camada de workers + cache, ...)
- Precisam manter partes da stack fora da internet pública
- Querem garantir que "a camada web pode falar com a camada de banco de dados; nada mais pode"

Para uma aplicação que de fato roda em uma única VM, veja [Padrões de deploy de contêineres](/docs/guides/container-deploy).

## Pré-requisitos {#prereqs}

- Uma chave de API que possa fazer essas chamadas: `unrestricted` ou com regras de acesso que as indiquem ([O que uma chave pode fazer](/docs/authentication#scopes)).
- Uma ideia aproximada de quais VMs / serviços você quer em cada camada.

Tudo o que você criar aqui fica na [região](/docs/api/regions) da sua sessão.

```bash
export NIMBUS_KEY="<your-api-key>"
```

## 1 · Criar as redes {#network}

Uma rede é o domínio de broadcast L2 — todas as VMs e recursos anexados à mesma rede conseguem se alcançar (sujeito aos grupos de segurança). Crie uma por camada: uma VM entra em uma rede, não em uma sub-rede, então, em uma rede com duas sub-redes, você não conseguiria escolher em qual sub-rede ela fica.

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

Cada resposta traz o `id` da nova rede em `data`. Salve os dois:

```bash
export WEB_NET_ID="<web-network-id>"
export DB_NET_ID="<db-network-id>"
```

## 2 · Criar duas sub-redes {#subnets}

Dê a cada rede um bloco de endereços. Escolha algo que não se sobreponha à VPN do escritório, à sua rede doméstica ou a qualquer outra rede à qual você possa se conectar depois (por isso `192.168.0.0/16` costuma ser uma escolha ruim — é usado com muita frequência). Blocos dentro de `10.0.0.0/16` funcionam para a maioria das configurações; `172.16.0.0/12` também serve.

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

O IP do gateway é o endereço da interface do roteador naquela sub-rede. As VMs o usam como rota padrão.

Salve os `id`s das duas sub-redes:

```bash
export WEB_SUBNET_ID="<web-subnet-id>"
export DB_SUBNET_ID="<db-subnet-id>"
```

## 3 · Criar o roteador e anexá-lo às duas sub-redes {#router}

O roteador é o que leva o tráfego das sub-redes para a internet (e de volta), e de uma sub-rede para a outra. `GET /api/v1/router/artifacts` lista as redes externas às quais ele pode se conectar:

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

`external_gateway_info` aloca um IP público no roteador e ativa o SNAT para o tráfego de saída das sub-redes anexadas a ele. Ele também exige `bandwidth_subscription` e `bandwidth_mbps` (um múltiplo de 10): o gateway fica limitado a essa largura de banda, e a largura de banda é cobrada ([Dados de preços](/docs/api/pricing-data)).

Salve o id do roteador e anexe-o às duas sub-redes:

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

Agora a camada web consegue alcançar a camada de banco de dados, e as VMs de banco de dados conseguem alcançar a internet para coisas como atualizações de pacotes. Nada na internet consegue alcançar uma VM sem IP flutuante — é assim que você mantém a camada de banco de dados fora da internet pública.

## 4 · Criar os grupos de segurança {#security-groups}

Grupos de segurança são firewalls stateful aplicados às interfaces de rede de uma VM. Eles controlam o tráfego que entra (ingress) e o que sai (egress). "Stateful" significa que o retorno de uma conexão iniciada de dentro é permitido automaticamente — você só precisa de regras para conexões iniciadas de fora. Um grupo novo deixa sair todo o tráfego e não deixa entrar nenhum, então estes dois só precisam de regras de ingress.

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

Salve os `id`s dos dois grupos e depois adicione uma regra por chamada:

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

O `remote_sec_grp` na regra do grupo de segurança do banco de dados é o que garante que "só a camada web pode se conectar" — em vez de um CIDR estático, a regra faz referência ao próprio grupo de segurança. Qualquer VM no `web-sg` consegue alcançar o banco de dados. Adicione ou remova VMs do `web-sg` e a lista de acesso é atualizada automaticamente.

O grupo de segurança web abre a porta 22 (SSH) para um IP específico do escritório, não para o mundo todo. Não abra o SSH para `0.0.0.0/0` — toda nuvem tem scanners testando a porta 22 em busca de senhas fracas.

## 5 · Anexar VMs {#attach}

Ao criar uma VM, especifique a rede e os grupos de segurança. [Início rápido](/docs/quickstart#region) mostra de onde vêm a imagem e os valores de `spec`. `sshs` indica uma [chave SSH](/docs/api/ssh-keys) que você registrou.

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

Para dar acesso externo à VM web, aloque um [IP flutuante](/docs/api/floating-ips) e anexe-o. A VM do banco de dados nunca recebe um IP flutuante — é assim que o isolamento da rede funciona.

## 6 · Verificar o isolamento {#verify}

Teste se o desenho realmente garante o que você queria. Encontre o endereço da VM do banco de dados em `nics`, na resposta de `GET /api/v1/instance/`; vamos supor que seja `10.0.2.10`.

```bash
# From the web VM, can we reach the DB on 5432? (Should: yes)
nc -v -w 3 10.0.2.10 5432

# From the web VM, can we reach the DB on 22 (SSH)? (Should: no — DB SG only opens 5432)
nc -v -w 3 10.0.2.10 22

# From your laptop, can we reach the DB directly? (Should: no — the DB VM has no public IP)
nc -v -w 3 10.0.2.10 5432
```

Se algum desses testes não se comportar como esperado, há algo errado nas regras dos grupos de segurança ou nos anexos de rede/sub-rede. Verifique de novo.

## O que isto não é {#not}

- **Não é VPC peering.** Esta é a rede interna de um projeto. As redes de dois projetos da NimbusNexus não fazem peering entre si — por design (veja [Modelo de segurança](/docs/security#network)).
- **Não é uma camada completa de WAF ou de proteção contra DDoS.** Grupos de segurança atuam em L3/L4 — não conseguem inspecionar o corpo de requisições HTTP. Para filtragem na camada de aplicação, rode um WAF (por exemplo, ModSecurity atrás do nginx) na camada web.
- **Não é autoscaling.** Você gerencia as VMs manualmente. Para frotas com autoscaling, as mesmas primitivas de rede funcionam, mas você vai querer infraestrutura como código (Terraform, Pulumi) para gerenciá-las em escala.

## Próximos passos {#next-steps}

- [Referência de redes](/docs/api/networks) — todas as opções da chamada de criação.
- [Referência de sub-redes](/docs/api/subnets) — configuração de IPv6, opções de DHCP, substituição dos servidores de nomes DNS.
- [Referência de grupos de segurança](/docs/api/security-groups) — a sintaxe completa das regras.
- [Referência de roteadores](/docs/api/routers) — rotas estáticas e como o NAT funciona.
- [IPs flutuantes](/docs/api/floating-ips) — a primitiva de IP público que conecta tudo isso ao mundo externo.
