---
title: "Deploys blue/green com IPs flutuantes"
description: "Deploys sem downtime movendo um IP flutuante entre duas VMs já aquecidas."
publishedAt: 2026-05-20
updatedAt: 2026-11-04
kind: guide
---

# Deploys blue/green com IPs flutuantes

O padrão blue/green clássico: mantenha a produção atual atrás de um IP flutuante, monte a nova versão em uma VM separada, rode smoke tests nela enquanto ela ainda está fora do caminho público e, então, mova o IP flutuante da VM antiga para a nova. O tráfego muda assim que o IP é anexado. Se algo der errado, mova o IP de volta.

Este guia pressupõe uma carga de trabalho de uma única VM (uma VM de produção e uma VM de staging). Para cargas de trabalho com várias VMs atrás de um balanceador de carga, veja [Balanceadores de carga](/docs/api/load-balancers) — o mesmo padrão se aplica, mas, em vez disso, você troca os pools de destino do balanceador de carga.

## Pré-requisitos {#prereqs}

- Duas VMs na mesma região. Vamos chamá-las de `blue` (a que está servindo agora) e `green` (a próxima versão).
- Um [IP flutuante](/docs/api/floating-ips) atualmente anexado à `blue`.
- Um registro DNS A apontando para o IP flutuante.
- `curl` e `jq`, com `$NIMBUS_KEY` definido como uma [chave de API](/docs/authentication) que possa fazer essas chamadas.

```bash
export NIMBUS_KEY="<your-api-key>"
export BLUE_ID="<blue-vm-id>"     # currently serving
export GREEN_ID="<green-vm-id>"    # new version
export FLOATING_IP_ID="<floating-ip-id>"
```

`GET /api/v1/instance/` lista suas VMs e `GET /api/v1/floating_ip/`, seus IPs flutuantes, com os respectivos ids.

## 1 · Montar a VM green {#build-green}

Suba a nova versão com o código e a configuração atualizados, mas sem o IP flutuante anexado. Nesta etapa, ela é uma VM independente com o próprio endereço; nada em produção chega até ela.

Implante sua aplicação nela, rode as migrações do banco de dados (se forem compatíveis com versões futuras — veja "migrações de schema" abaixo), aqueça os caches e execute qualquer trabalho de inicialização que deva acontecer antes de o tráfego chegar.

## 2 · Fazer o smoke test da green {#smoke}

Acesse diretamente o endereço próprio da green, a partir de um lugar que consiga alcançá-lo: outra VM na mesma rede ou, se a green estiver na rede externa, qualquer lugar. `GET /api/v1/instance/{server_id}/interfaces/` lista as interfaces de uma VM, uma por rede; `.data[0]`, abaixo, é a primeira.

```bash
GREEN_IP=$(curl -s {{API_BASE_URL}}/api/v1/instance/$GREEN_ID/interfaces/ \
  -H "X-API-Key: $NIMBUS_KEY" | jq -r '.data[0].fixed_ips[0].ip_address')

curl -H "Host: app.example.com" "http://$GREEN_IP/healthz"
curl -H "Host: app.example.com" "http://$GREEN_IP/api/critical-endpoint"
```

O header `Host` permite testar comportamentos que dependem do hostname canônico (por exemplo, roteamento, CORS, qualquer coisa com certificado fixado) sem alterar o DNS. Se o seu serviço exige HTTPS e você fixou um certificado em `app.example.com`, configure o certificado na green com antecedência.

Rode quaisquer outros testes que você rodaria antes de promover:

- A suíte completa de smoke tests
- Verificação de conectividade com o banco de dados (principalmente se a green estiver atrás de uma configuração diferente de pooler de conexões)
- Verificação de assinatura de webhooks (se você rotacionou o segredo)

## 3 · Mover o IP flutuante {#swing}

Este é o cutover: duas chamadas de API, uma para desanexar e outra para anexar. Primeiro, leia o que a chamada de anexar exige, a porta da green e a rede externa à qual o IP pertence:

```bash
GREEN_PORT_ID=$(curl -s {{API_BASE_URL}}/api/v1/instance/$GREEN_ID/interfaces/ \
  -H "X-API-Key: $NIMBUS_KEY" | jq -r '.data[0].port_id')

FLOATING_NETWORK_ID=$(curl -s {{API_BASE_URL}}/api/v1/floating_ip/ \
  -H "X-API-Key: $NIMBUS_KEY" \
  | jq -r ".data[] | select(.id == \"$FLOATING_IP_ID\") | .network")
```

Depois, mova-o:

```bash
# Detach the IP from blue
curl -X POST {{API_BASE_URL}}/api/v1/floating_ip/deallocate \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{ \"id\": \"$FLOATING_IP_ID\" }"

# Attach it to green
curl -X POST {{API_BASE_URL}}/api/v1/floating_ip/allocate \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"floating_ip_id\": \"$FLOATING_IP_ID\",
    \"floating_network_id\": \"$FLOATING_NETWORK_ID\",
    \"vm_port_id\": \"$GREEN_PORT_ID\",
    \"vm_ip_address\": \"$GREEN_IP\"
  }"
```

O que acontece:

- O IP flutuante é desanexado da `blue`. Entre as duas chamadas, o endereço fica sem nenhuma VM por trás, então execute-as uma logo depois da outra.
- O IP flutuante é anexado à `green`, e o IP passa a servir a partir da green.
- As novas conexões chegam à green. Um cliente com uma conexão aberta pelo IP flutuante pode precisar se reconectar.

Para a maioria das cargas de trabalho HTTP, na prática, não há downtime. Usuários em conexões de longa duração (SSE, WebSocket) são reconectados automaticamente pelos seus clientes.

## 4 · Observar a green sob tráfego {#watch}

Acompanhe os logs na green, observe as taxas de erro e o gráfico de requisições do painel. Aqui aparecem anomalias de tráfego real que os smoke tests não pegaram.

A janela em que o rollback sai barato são os primeiros ~5 minutos. Depois disso, a blue está "rodando código antigo sem tráfego" e você está pagando por ela; você vai querer uma destas opções:

- Promover a green e parar a blue (o caminho feliz)
- Parar as duas e recomeçar (raro)

## 5 · Parar a blue {#stop-blue}

Se estiver tudo verde (literalmente), pare a blue:

```bash
curl -X POST {{API_BASE_URL}}/api/v1/instance/action \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{ \"servers\": [\"$BLUE_ID\"], \"cmd\": \"stop\" }"
```

Não a exclua imediatamente: uma VM parada pode voltar com `start` como um rollback rápido. Mas ela continua sendo cobrada, porque uma VM é cobrada da criação até a exclusão. Quando não precisar mais do rollback, exclua-a com `"cmd": "delete"`.

## Caminho de rollback {#rollback}

Se a green se comportar mal sob tráfego, o rollback é simétrico. Inicie a blue de novo se você a parou (`"cmd": "start"`) e, depois, mova o IP de volta:

```bash
BLUE_PORT_ID=$(curl -s {{API_BASE_URL}}/api/v1/instance/$BLUE_ID/interfaces/ \
  -H "X-API-Key: $NIMBUS_KEY" | jq -r '.data[0].port_id')

BLUE_IP=$(curl -s {{API_BASE_URL}}/api/v1/instance/$BLUE_ID/interfaces/ \
  -H "X-API-Key: $NIMBUS_KEY" | jq -r '.data[0].fixed_ips[0].ip_address')

curl -X POST {{API_BASE_URL}}/api/v1/floating_ip/deallocate \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{ \"id\": \"$FLOATING_IP_ID\" }"

curl -X POST {{API_BASE_URL}}/api/v1/floating_ip/allocate \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"floating_ip_id\": \"$FLOATING_IP_ID\",
    \"floating_network_id\": \"$FLOATING_NETWORK_ID\",
    \"vm_port_id\": \"$BLUE_PORT_ID\",
    \"vm_ip_address\": \"$BLUE_IP\"
  }"
```

As mesmas duas chamadas, e o tráfego volta para a blue. Os rollbacks ficam mais difíceis se as migrações do banco de dados não forem compatíveis com versões futuras — mantenha as migrações de schema desacopladas das implantações de código e a opção de rollback continua disponível.

## Migrações de schema {#migrations}

O padrão que faz o blue/green funcionar sem complicações com mudanças de schema: **desacople a migração do deploy**.

Cada mudança de schema vira dois PRs, com uma semana de intervalo:

1. **PR de migração.** Uma migração de schema compatível com versões anteriores. Novas tabelas, novas colunas anuláveis, novos índices. O código antigo continua funcionando com o novo schema. Implante este PR pelos canais normais (sem precisar de blue/green — a compatibilidade com versões anteriores significa que a migração pode entrar com segurança de forma independente).
2. **PR de código.** O código que usa o novo schema. Implante este PR via blue/green.

Quando você precisa remover uma coluna ou mudar um tipo, a sequência é a inversa: o código deixa de usar a coluna → deploy do código → a migração remove a coluna. Sempre dois PRs separados no tempo. Entre um e outro, sempre é seguro fazer uma pausa.

Esse padrão dá mais trabalho do que "sempre implantar schema + código juntos", mas preserva a segurança do rollback, que é justamente a razão de ser do blue/green.

## Próximos passos {#next-steps}

- [Referência de IPs flutuantes](/docs/api/floating-ips) — todos os endpoints do recurso que torna esse padrão possível.
- [Balanceadores de carga](/docs/api/load-balancers) — a versão com várias VMs do mesmo padrão.
- [Failover entre regiões](/docs/guides/multi-region) — a mesma ideia, aplicada a pares geograficamente distantes.
