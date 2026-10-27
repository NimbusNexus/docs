---
title: "Configuração de rede do projeto"
description: "Redes, sub-redes, roteadores e grupos de segurança — a montagem de referência para uma aplicação multicamadas."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: guide
---

# Configuração de rede do projeto

A configuração de rede de referência da NimbusNexus para uma aplicação multicamadas: uma rede privada com duas sub-redes (uma voltada para o público e outra só para o banco de dados), um roteador conectando a sub-rede pública à internet e grupos de segurança restringindo o tráfego entre as camadas. Este guia percorre a configuração de ponta a ponta e explica por que cada peça existe.

No final, você terá:

- Uma rede com duas sub-redes (`10.0.1.0/24` para web, `10.0.2.0/24` para banco de dados)
- Um roteador com gateway externo, anexado à sub-rede web
- Dois grupos de segurança: `web-sg` (HTTPS aberto para a internet) e `db-sg` (porta 5432 apenas a partir do `web-sg`)
- Um padrão de teste para verificar se o isolamento funciona

## Por que esta estrutura {#why}

Apps de uma única VM não precisam de nada disso — uma VM com um IP flutuante e sem configuração de rede funciona bem. Esta estrutura é para apps que:

- Têm vários componentes (camada web + banco de dados, camada web + camada de workers + cache, ...)
- Precisam manter partes da stack fora da internet pública
- Querem garantir que "a camada web pode falar com a camada de banco de dados; nada mais pode"

Para uma aplicação que de fato roda em uma única VM, veja [Padrões de deploy de contêineres](/docs/guides/container-deploy).

## Pré-requisitos {#prereqs}

- Uma chave de API com os escopos `networks:write` e `vms:write`.
- Uma região escolhida (vamos usar `us-east-1`).
- Uma ideia aproximada de quais VMs / serviços você quer em cada camada.

```bash
export NIMBUS_KEY="nn_live_xxxxxxxxxxxxxxxx"
export REGION="us-east-1"
```

## 1 · Criar a rede {#network}

Uma rede é o domínio de broadcast L2 — todas as VMs e recursos anexados à mesma rede conseguem se alcançar por roteamento (sujeito aos grupos de segurança).

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

O bloco `10.0.0.0/16` é o espaço de endereços de tudo o que fica dentro desta rede. Escolha algo que não se sobreponha à VPN do escritório, à sua rede doméstica ou a qualquer outra rede com a qual você possa fazer peering depois (por isso `192.168.0.0/16` costuma ser uma escolha ruim — é usado com muita frequência). `10.0.0.0/16` funciona para a maioria das configurações; `172.16.0.0/12` também serve.

Salve o id da rede:

```bash
export NET_ID="net_01HG7Y3..."
```

## 2 · Criar duas sub-redes {#subnets}

Divida a rede em duas sub-redes — uma para o que fica exposto à internet pública e outra para o que não deveria ficar.

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

O IP do gateway é o endereço da interface do roteador naquela sub-rede. As VMs o usam como rota padrão.

## 3 · Criar o roteador e anexá-lo à sub-rede web {#router}

O roteador é o que leva o tráfego da sub-rede web para a internet (e de volta). A sub-rede do banco de dados não recebe conexão com o roteador — é assim que você a mantém fora da internet pública.

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

`external_gateway: true` aloca um IP público no roteador e ativa o SNAT para o tráfego de saída das sub-redes anexadas a ele.

Salve o id do roteador e anexe-o à sub-rede web:

```bash
export ROUTER_ID="rtr_01HG7Y3..."

curl -X POST {{API_BASE_URL}}/v1/routers/$ROUTER_ID/interfaces \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{ \"subnet_id\": \"$WEB_SUBNET_ID\" }"
```

A sub-rede do banco de dados fica fora do roteador. Tudo o que está nela só alcança o que for acessível pela rede L2 — ou seja, outras coisas na mesma rede, controladas pelos grupos de segurança.

## 4 · Criar os grupos de segurança {#security-groups}

Grupos de segurança são firewalls stateful aplicados às interfaces de rede de uma VM. Eles controlam o tráfego que entra (ingress) e o que sai (egress). "Stateful" significa que o retorno de uma conexão iniciada de dentro é permitido automaticamente — você só precisa de regras para conexões iniciadas de fora.

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

O `source_security_group` na regra do grupo de segurança do banco de dados é o que garante que "só a camada web pode se conectar" — em vez de um CIDR estático, a regra faz referência ao próprio grupo de segurança. Qualquer VM marcada com `web-sg` consegue alcançar o banco de dados. Adicione ou remova VMs do `web-sg` e a lista de acesso é atualizada automaticamente.

O grupo de segurança web abre a porta 22 (SSH) para um IP específico do escritório, não para o mundo todo. Não abra o SSH para `0.0.0.0/0` — toda nuvem tem scanners testando a porta 22 em busca de senhas fracas.

## 5 · Anexar VMs {#attach}

Ao criar uma VM, especifique a rede, a sub-rede e os grupos de segurança:

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

Para dar acesso externo à VM web, aloque um [IP flutuante](/docs/api/floating-ips) e anexe-o. A VM do banco de dados nunca recebe um IP flutuante — é assim que o isolamento da rede funciona.

## 6 · Verificar o isolamento {#verify}

Teste se o desenho realmente garante o que você queria:

```bash
# From the web VM, can we reach the DB on 5432? (Should: yes)
nc -v -w 3 10.0.2.10 5432

# From the web VM, can we reach the DB on 22 (SSH)? (Should: no — DB SG only opens 5432)
nc -v -w 3 10.0.2.10 22

# From your laptop, can we reach the DB directly? (Should: no — DB subnet isn't routable from internet)
nc -v -w 3 <DB_PUBLIC_IP> 5432  # there's no public IP, this fails
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
- [Referência de roteadores](/docs/api/routers) — rotas estáticas, anúncio BGP, montagens mais avançadas.
- [IPs flutuantes](/docs/api/floating-ips) — a primitiva de IP público que conecta tudo isso ao mundo externo.
