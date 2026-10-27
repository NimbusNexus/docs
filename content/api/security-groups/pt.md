---
title: "Grupos de segurança"
description: "Conjuntos de regras de firewall stateful aplicados às interfaces de rede das VMs."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: reference
---

# Grupos de segurança

Grupos de segurança são conjuntos de regras de **firewall stateful**. Você anexa um ou mais grupos à interface de rede de uma VM; o que é aplicado é a união das regras de todos os grupos. Comportamento padrão: **negar todo o tráfego de entrada, permitir todo o tráfego de saída** — allow-list explícita para o tráfego que chega, saída liberada até você dizer o contrário.

## O que significa stateful {#stateful}

Você só escreve regras para a direção que **inicia** a conexão. Se você permite TCP de entrada na porta 443, os pacotes de resposta ao cliente são permitidos automaticamente — não é preciso uma regra de egress separada para o tráfego de retorno.

Compare com uma ACL stateless (por exemplo, as Network ACLs da AWS), em que você precisaria de regras simétricas nas duas direções. Os grupos de segurança são mais fáceis de entender para firewall no nível da aplicação; as ACLs stateless são mais fáceis de entender para políticas de rede de tenant em uma camada abaixo da VM.

## Formato da regra {#rules}

Cada regra tem:

- **Direção** — `ingress` ou `egress`
- **Protocolo** — `tcp`, `udp`, `icmp` ou `any`
- **Intervalo de portas** — porta única (`80`), intervalo (`8000-9000`) ou "any"
- **Origem / destino** — um bloco CIDR (`0.0.0.0/0`, `10.0.0.0/8`) OU o id de outro grupo de segurança

O modo "a origem é outro grupo de segurança" é o que mais vale a pena conhecer. Uma regra como "permitir a porta 5432 a partir de `web-tier-sg`" deixa toda VM do grupo `web-tier-sg` acessar sua VM de Postgres na 5432 — sem precisar enumerar IPs, e a regra continua funcionando conforme as VMs entram e saem do `web-tier-sg` com o escalonamento.

## Um padrão comum {#pattern}

Para um app web de 3 camadas:

1. **`web-tier-sg`** — entrada: permitir `tcp/80` e `tcp/443` a partir de `0.0.0.0/0` (público)
2. **`app-tier-sg`** — entrada: permitir `tcp/8080` a partir de `web-tier-sg` (só a camada web consegue acessar a camada de app)
3. **`db-tier-sg`** — entrada: permitir `tcp/5432` a partir de `app-tier-sg` (só a camada de app consegue acessar o banco de dados)

Isso se combina; você pode adicionar um 4º grupo para uma VPN de operações que permite SSH a partir dos IPs do seu escritório e anexá-lo junto com o `db-tier-sg` nas VMs de banco de dados, sem mexer nas regras do app.

## Próximos passos {#next-steps}

- [Máquinas virtuais](/docs/api/vms) — onde os grupos de segurança são anexados.
- [Redes](/docs/api/networks) e [Sub-redes](/docs/api/subnets) — as primitivas de rede que os grupos de segurança protegem.
