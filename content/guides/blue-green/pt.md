---
title: "Deploys blue/green com IPs flutuantes"
description: "Deploys sem downtime movendo um IP flutuante entre duas VMs já aquecidas."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: guide
---

# Deploys blue/green com IPs flutuantes

O padrão blue/green clássico: mantenha a produção atual atrás de um IP flutuante, monte a nova versão em uma VM separada, rode smoke tests nela enquanto ela ainda está fora do caminho público e, então, mova o IP flutuante da VM antiga para a nova. O tráfego muda em ~2 segundos. Se algo der errado, mova o IP de volta.

Este guia pressupõe uma carga de trabalho de uma única VM (uma VM de produção e uma VM de staging). Para cargas de trabalho com várias VMs atrás de um balanceador de carga, veja [Balanceadores de carga](/docs/api/load-balancers) — o mesmo padrão se aplica, mas, em vez disso, você troca os pools de destino do balanceador de carga.

## Pré-requisitos {#prereqs}

- Duas VMs na mesma região. Vamos chamá-las de `blue` (a que está servindo agora) e `green` (a próxima versão).
- Um [IP flutuante](/docs/api/floating-ips) atualmente anexado à `blue`.
- Um registro DNS A apontando para o IP flutuante.
- A CLI `nimbus` instalada, ou o curl com $NIMBUS_KEY definido.

```bash
export NIMBUS_KEY="nn_live_xxxxxxxxxxxxxxxx"
export BLUE_ID="vm_01HG7Y3..."     # currently serving
export GREEN_ID="vm_01HG7Y4..."    # new version
export FLOATING_IP_ID="ip_01HG7..."
```

## 1 · Montar a VM green {#build-green}

Suba a nova versão com o código e a configuração atualizados, mas sem o IP flutuante anexado. Nesta etapa, ela é uma VM independente com um IP público padrão; nada em produção chega até ela.

Implante sua aplicação nela, rode as migrações do banco de dados (se forem compatíveis com versões futuras — veja "migrações de schema" abaixo), aqueça os caches e execute qualquer trabalho de inicialização que deva acontecer antes de o tráfego chegar.

## 2 · Fazer o smoke test da green {#smoke}

Acesse diretamente o IP público padrão da green:

```bash
GREEN_IP=$(curl -s {{API_BASE_URL}}/v1/vms/$GREEN_ID \
  -H "Authorization: Bearer $NIMBUS_KEY" | jq -r '.ipv4')

curl -H "Host: app.example.com" "http://$GREEN_IP/healthz"
curl -H "Host: app.example.com" "http://$GREEN_IP/api/critical-endpoint"
```

O header `Host` permite testar comportamentos que dependem do hostname canônico (por exemplo, roteamento, CORS, qualquer coisa com certificado fixado) sem alterar o DNS. Se o seu serviço exige HTTPS e você fixou um certificado em `app.example.com`, configure o certificado na green com antecedência (o Let's Encrypt com o desafio HTTP-01 contra o IP padrão da green funciona).

Rode quaisquer outros testes que você rodaria antes de promover:

- A suíte completa de smoke tests
- Verificação de conectividade com o banco de dados (principalmente se a green estiver atrás de uma configuração diferente de pooler de conexões)
- Verificação de assinatura de webhooks (se você rotacionou o segredo)

## 3 · Mover o IP flutuante {#swing}

Este é o cutover. Uma chamada de API:

```bash
curl -X POST {{API_BASE_URL}}/v1/floating-ips/$FLOATING_IP_ID/attach \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{ \"vm_id\": \"$GREEN_ID\" }"
```

O que acontece:

- O IP flutuante é desanexado da `blue` (ela mantinha o IP como um de seus endereços públicos)
- O IP flutuante é anexado à `green`
- A propagação na rede leva ~2 segundos; o IP passa a servir a partir da green
- As conexões TCP com o IP da VM antiga continuam abertas até expirarem por inatividade (normalmente 30–60 segundos para keepalive HTTP); as novas conexões chegam à green

Para a maioria das cargas de trabalho HTTP, na prática, não há downtime. As conexões existentes concluem suas requisições na blue; as novas requisições chegam à green. Usuários em conexões de longa duração (SSE, WebSocket) são reconectados automaticamente pelos seus clientes.

## 4 · Observar a green sob tráfego {#watch}

Acompanhe os logs na green, observe as taxas de erro e o gráfico de requisições do painel. Aqui aparecem anomalias de tráfego real que os smoke tests não pegaram.

A janela em que o rollback sai barato são os primeiros ~5 minutos. Depois disso, a blue está "rodando código antigo sem tráfego" e você está pagando por ela; você vai querer uma destas opções:

- Promover a green e parar a blue (o caminho feliz)
- Parar as duas e recomeçar (raro)

## 5 · Parar a blue {#stop-blue}

Se estiver tudo verde (literalmente), pare a blue para não pagar mais por ela:

```bash
curl -X POST {{API_BASE_URL}}/v1/vms/$BLUE_ID/stop \
  -H "Authorization: Bearer $NIMBUS_KEY"
```

Não faça `delete` nela imediatamente. VMs paradas custam ~10% do valor de VMs em execução (só o armazenamento) e permitem que você faça `start` nelas de novo como um rollback rápido por ~24 horas. Depois de 24 horas, exclua-as.

## Caminho de rollback {#rollback}

Se a green se comportar mal sob tráfego, o rollback é simétrico:

```bash
curl -X POST {{API_BASE_URL}}/v1/floating-ips/$FLOATING_IP_ID/attach \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{ \"vm_id\": \"$BLUE_ID\" }"
```

Os mesmos ~2 segundos, e o tráfego volta para a blue. Os rollbacks ficam mais difíceis se as migrações do banco de dados não forem compatíveis com versões futuras — mantenha as migrações de schema desacopladas das implantações de código e a opção de rollback continua disponível.

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
