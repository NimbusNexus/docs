---
title: "Otimizar a fatura mensal"
description: "Para onde vai a fatura da sua infraestrutura e como encontrar os recursos pelos quais você pode parar de pagar."
publishedAt: 2026-05-20
updatedAt: 2026-11-06
kind: guide
---

# Otimizar a fatura mensal

Na NimbusNexus, você paga principalmente pelo que alocou, esteja usando ou não: VMs, volumes, IPs flutuantes, portas públicas e a largura de banda delas, e imagens personalizadas. Por isso, quando uma fatura vem maior do que você esperava, procure primeiro o que continua alocado e não é mais necessário. Este guia percorre esses lugares, com as chamadas que encontram cada um deles.

Os preços estão em [Dados de preços](/docs/api/pricing-data). O faturamento é por workspace, enquanto uma chave de API funciona em um único projeto, então repita estas chamadas para cada projeto do workspace.

## Pré-requisitos {#prereqs}

- `curl` e `jq`, com `$NIMBUS_KEY` definido como uma [chave de API](/docs/authentication) que possa fazer essas chamadas.

```bash
export NIMBUS_KEY="<your-api-key>"
```

As chamadas abaixo que excluem ou alteram algo usam os ids que as listas imprimem, como `$VM_ID`, `$FLOATING_IP_ID`, `$VOLUME_ID` e `$PORT_ID`.

## 1 · VMs paradas que você esqueceu {#stopped-vms}

Parar uma VM não interrompe a cobrança: uma VM é cobrada da criação até a exclusão ([Máquinas virtuais](/docs/api/vms#lifecycle)). Encontre as que estão paradas:

```bash
curl -s {{API_BASE_URL}}/api/v1/instance/ \
  -H "X-API-Key: $NIMBUS_KEY" \
  | jq '.data[] | select(.status == "SHUTOFF") | { id, name, vcores, memory }'
```

Por algum tempo, uma VM parada é uma candidata razoável a rollback, como em um [deploy blue/green](/docs/guides/blue-green#stop-blue). Quando deixar de ser, exclua-a:

```bash
curl -X POST {{API_BASE_URL}}/api/v1/instance/action \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{ \"servers\": [\"$VM_ID\"], \"cmd\": \"delete\" }"
```

Excluir uma VM exclui o volume de boot criado a partir da imagem dela, e isso não pode ser desfeito, então copie antes tudo de que você ainda precisa. Os volumes que você anexou depois continuam lá, e a etapa 3 os encontra.

## 2 · IPs flutuantes sem nada por trás {#unattached-ips}

Um IP flutuante é cobrado desde o momento em que é criado até ser excluído, esteja anexado ou não ([IPs flutuantes](/docs/api/floating-ips#billing)). Encontre os que não estão anexados:

```bash
curl -s {{API_BASE_URL}}/api/v1/floating_ip/ \
  -H "X-API-Key: $NIMBUS_KEY" \
  | jq '.data[] | select(.port_id == null) | { id, ip_address, description }'
```

Exclua os de que você não precisa, listando os ids deles em `ids`:

```bash
curl -X DELETE {{API_BASE_URL}}/api/v1/floating_ip/ \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{ \"ids\": [\"$FLOATING_IP_ID\"] }"
```

Se algo incluir um endereço em uma allow-list em outro lugar, mude isso primeiro: depois de excluir um endereço, talvez você não o consiga de volta.

## 3 · Volumes que nenhuma VM está usando {#volumes}

Um volume é cobrado da mesma forma, esteja anexado ou não ([Armazenamento em blocos](/docs/api/block-storage#lifecycle)). É fácil esquecer os volumes que sobrevivem à VM deles. Encontre-os:

```bash
curl -s {{API_BASE_URL}}/api/v1/storage/ \
  -H "X-API-Key: $NIMBUS_KEY" \
  | jq '.data[] | select(.status == "available") | { id, name, size, type }'
```

Um volume excluído não pode ser recuperado, então [faça um backup dele](/docs/api/backups#create) antes se houver chance de você querer os dados. Depois, exclua-o:

```bash
curl -X DELETE {{API_BASE_URL}}/api/v1/storage/ \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{ \"ids\": [\"$VOLUME_ID\"] }"
```

## 4 · VMs superprovisionadas {#over-provisioned}

O preço de uma VM depende de `architecture`, `vm_class`, `cpu` e `ram`. Se a CPU e a memória de uma VM ficam baixas o tempo todo, ela pode rodar em uma configuração menor. Meça antes de decidir: [Monitorar uma frota de VMs](/docs/guides/monitoring-vms) configura as métricas.

Redimensione com um novo `spec`; [Início rápido](/docs/quickstart#region) mostra de onde vêm `$ARCHITECTURE` e `$VM_CLASS`. A VM reinicia na nova configuração e fica aguardando em `VERIFY_RESIZE`:

```bash
curl -X POST {{API_BASE_URL}}/api/v1/instance/$VM_ID/resize \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"spec\": {
      \"architecture\": \"$ARCHITECTURE\",
      \"vm_class\": \"$VM_CLASS\",
      \"cpu\": 2,
      \"ram\": 4096
    }
  }"
```

Verifique a VM sob carga real e depois mantenha a nova configuração ou volte à anterior com `revert_resize`:

```bash
curl -X POST {{API_BASE_URL}}/api/v1/instance/$VM_ID/confirm_resize \
  -H "X-API-Key: $NIMBUS_KEY"
```

[Tamanhos de VM](/docs/api/vm-sizes#resizing) traz os detalhes.

## 5 · Portas públicas e largura de banda {#bandwidth}

Uma porta na rede externa é cobrada até você excluí-la, e a largura de banda dela é cobrada junto, assim como a largura de banda no gateway externo de um roteador ([Portas de rede](/docs/api/network-ports), [Roteadores](/docs/api/routers)). Uma VM que não precisa ser alcançada pela internet pode ficar, em vez disso, em uma rede privada ([Configuração de rede do projeto](/docs/guides/networking-setup)).

Liste as portas da rede externa; `GET /api/v1/floating_ip/artifacts` lista as redes externas:

```bash
curl -s "{{API_BASE_URL}}/api/v1/portal/port/?network_id=$EXTERNAL_NETWORK_ID" \
  -H "X-API-Key: $NIMBUS_KEY" \
  | jq '.data[] | { id, name, device_id, status }'
```

Uma porta com `device_id` vazio não está anexada a nada. Exclua-a com `DELETE /api/v1/portal/port/{port_id}`.

Se você precisa da porta, mas não de toda a largura de banda dela, reduza-a com `POST /api/v1/bandwidth/resize`, que altera o limite em uma porta, um IP flutuante ou um gateway de roteador, e a cobrança junto com ele. `bandwidth_mbps` precisa ser um múltiplo de 10:

```bash
curl -X POST {{API_BASE_URL}}/api/v1/bandwidth/resize \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"resource_type\": \"port\",
    \"resource_id\": \"$PORT_ID\",
    \"bandwidth_mbps\": 100,
    \"bandwidth_subscription\": \"Monthly\"
  }"
```

## 6 · Imagens personalizadas {#images}

Uma imagem personalizada é cobrada por GB, arredondado para cima até um GB inteiro, como um produto próprio ([Imagens de VM](/docs/api/vm-images)). Liste suas imagens privadas e depois exclua, com `DELETE /api/v1/image/`, aquelas a partir das quais nada mais faz boot:

```bash
curl -s "{{API_BASE_URL}}/api/v1/image/?visibility=private" \
  -H "X-API-Key: $NIMBUS_KEY" \
  | jq '.data[] | { id, name, size, created_at }'
```

## Analisar a fatura em si {#invoice}

`GET /api/v1/billing/public/balances` mostra as cobranças em aberto, o crédito promocional e o saldo pré-pago do seu workspace, e `GET /api/v1/billing/public/accrued_charges`, o total cobrado até agora que ainda não foi quitado. Essas chamadas exigem uma sessão conectada, não uma chave de API, e as faturas em si não estão disponíveis pela API ([Faturamento](/docs/api/invoices)).

## Próximos passos {#next-steps}

- [Dados de preços](/docs/api/pricing-data) — quanto custa cada um desses recursos.
- [Faturamento](/docs/api/invoices) — os seus saldos e as cobranças ainda não quitadas.
- [Tamanhos de VM](/docs/api/vm-sizes) — as configurações e o redimensionamento em detalhes.
- [Backups](/docs/api/backups) — como copiar um volume antes de excluí-lo e por quanto tempo os agendamentos mantêm as cópias.
- [Cotas](/docs/api/quotas) — os limites de recursos por projeto, que são separados do faturamento.
