---
title: "Padrões de deploy de contêineres"
description: "Uma única VM, Docker gerenciado pelo systemd, atrás de um IP flutuante. O padrão que resolve 80% dos casos."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: guide
---

# Padrões de deploy de contêineres

A NimbusNexus (ainda) não oferece um serviço de Kubernetes gerenciado. O padrão que resolve 80% dos casos para rodar um pequeno número de serviços em contêineres aqui: uma VM por serviço, o Docker como runtime de contêineres, o systemd como supervisor e um IP flutuante como endereço público. Simples, observável e fácil de depurar.

Este guia percorre o padrão de referência. Para serviços escalados horizontalmente em que você realmente precisa de orquestração (>10 serviços interagindo, roteamento de tráfego complexo, autoscaling), traga seu próprio Kubernetes (k3s ou k0s em um pequeno cluster de VMs, ou uma oferta gerenciada em outro lugar); isso está fora do escopo desta página.

## O que você terá no final {#overview}

- Uma VM rodando seu contêiner sob o systemd
- Um [IP flutuante](/docs/api/floating-ips) apontando para ela
- Logs fluindo para o journald (e, de lá, para onde você quiser)
- Um fluxo limpo de deploys graduais para atualizações de código

## 1 · Provisionar uma VM {#vm}

Escolha um tamanho adequado ao seu serviço. Para a maioria das cargas de trabalho stateless de API/web, `gp-1-2` (1 vCPU, 2 GB de RAM) é um bom ponto de partida — aumente se precisar de mais.

```bash
curl -X POST {{API_BASE_URL}}/v1/vms \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "api-prod",
    "size": "gp-1-2",
    "region": "us-east-1",
    "image": "ubuntu-24.04",
    "user_data": "#!/bin/bash\napt-get update && apt-get install -y docker.io"
  }'
```

O `user_data` roda no primeiro boot — aqui, ele instala o Docker. Quando a VM passa para `running`, o Docker já está pronto.

## 2 · Alocar um IP flutuante {#floating-ip}

```bash
curl -X POST {{API_BASE_URL}}/v1/floating-ips \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{ \"region\": \"us-east-1\", \"vm_id\": \"$VM_ID\" }"
```

O IP é anexado à VM e se torna o endereço público dela. Salve o IPv4:

```bash
export PUBLIC_IP=$(curl -s {{API_BASE_URL}}/v1/floating-ips/$FLOATING_IP_ID \
  -H "Authorization: Bearer $NIMBUS_KEY" | jq -r '.ipv4')
```

Aponte seu DNS para ele ([Registros DNS](/docs/api/dns-records) ou o seu registrador atual).

## 3 · Fazer o build + push da imagem do contêiner {#image}

Faça o build da imagem do contêiner em algum lugar (localmente, no CI). Faça o push dela para o registry que você preferir:

- **Docker Hub** — gratuito para imagens públicas.
- **GitHub Container Registry** (`ghcr.io`) — gratuito para repositórios públicos, incluído no GitHub.
- **Armazenamento de objetos da NimbusNexus** — se você prefere hospedar por conta própria, envie tarballs para um bucket privado e baixe-os na unidade do systemd (dá um pouco mais de trabalho gerenciar as tags).

Neste guia, vamos usar `ghcr.io/yourorg/api:v1.4.2`.

## 4 · Configurar a unidade do systemd na VM {#systemd}

Conecte-se à VM por SSH:

```bash
ssh ubuntu@$PUBLIC_IP
```

Crie o arquivo da unidade em `/etc/systemd/system/api.service`:

```ini
[Unit]
Description=API container
After=docker.service network-online.target
Requires=docker.service

[Service]
Restart=always
RestartSec=5
TimeoutStartSec=60

# Pull the image; ignore failures (we'll retry on next start)
ExecStartPre=-/usr/bin/docker pull ghcr.io/yourorg/api:v1.4.2
# Stop any existing container; ignore failure (no container = fine)
ExecStartPre=-/usr/bin/docker stop api
ExecStartPre=-/usr/bin/docker rm api

ExecStart=/usr/bin/docker run \
  --name api \
  --rm \
  --network host \
  --env-file /etc/api/env \
  ghcr.io/yourorg/api:v1.4.2

ExecStop=/usr/bin/docker stop api

[Install]
WantedBy=multi-user.target
```

Algumas observações:

- **`--network host`** — o contêiner se vincula diretamente à rede da VM. É mais simples que a rede bridge padrão e funciona para uma configuração com um único contêiner. Não use isso se você estiver rodando vários contêineres que precisam se comunicar entre si em portas privadas.
- **`--rm`** — remove o contêiner depois que ele termina. Em conjunto com `Restart=always`, o systemd o recria em caso de falha.
- **`--env-file /etc/api/env`** — carrega segredos + configuração de um arquivo. Mantenha esse arquivo legível apenas pelo root (`chmod 600`).
- **`Restart=always`** — o systemd traz o contêiner de volta em caso de falha. O `RestartSec` de cinco segundos evita loops de falha em sequência rápida.

Coloque seus segredos em `/etc/api/env`:

```env
DATABASE_URL=postgresql://app:••••@{{DB_HOST_DEMO}}:6432/app?sslmode=verify-full
NIMBUS_KEY=nn_live_xxxxxxxxxxxxxxxx
JWT_SECRET=...
```

Ative e inicie:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now api.service
```

## 5 · Verificar se está servindo {#verify}

```bash
curl http://$PUBLIC_IP/healthz
```

Se você vir a resposta do seu serviço, está pronto.

## 6 · Deploys graduais {#deploys}

Para implantar uma nova versão, basta atualizar a tag da imagem no arquivo da unidade e reiniciar:

```bash
sudo sed -i 's|api:v1.4.2|api:v1.4.3|g' /etc/systemd/system/api.service
sudo systemctl daemon-reload
sudo systemctl restart api.service
```

Isso causa uma interrupção de 1–2 segundos (parada do contêiner → pull da imagem → início do novo contêiner).

Para não ter downtime, use o [padrão blue/green](/docs/guides/blue-green): duas VMs, dois contêineres, e mova o IP flutuante entre elas no cutover.

## 7 · Logs {#logs}

O stdout/stderr do contêiner vai para o journald automaticamente:

```bash
sudo journalctl -u api.service -f
```

Para reter logs por mais tempo, envie-os do journald para onde você armazena logs:

- **systemd-journal-remote** — upload nativo para outra máquina com systemd.
- **Vector** — várias saídas, incluindo armazenamento de objetos compatível com S3 (envie para um bucket da NimbusNexus).
- **Promtail + Loki** — agregação de logs da stack do Grafana.

## Por que este padrão em vez do Kubernetes {#why}

**Para um único serviço:** o Kubernetes é 80% overhead. O plano de controle, o scheduler, o YAML dos manifestos — tudo isso para rodar um contêiner. O systemd faz o mesmo trabalho em 30 linhas.

**Para dois serviços:** ainda não. Duas VMs, duas unidades do systemd. O tráfego entre serviços passa pelos IPs flutuantes públicos (ou por uma [rede](/docs/api/networks) privada, se você quiser tirá-los da internet).

**Para cinco ou mais serviços:** a relação overhead/valor se inverte. Nesse ponto, considere o Kubernetes (k3s em um pequeno cluster de VMs é um meio-termo pragmático) ou o Nomad (mais leve que o k8s, projetado para esse porte).

## O que este padrão não faz {#limitations}

- **Sem autoscaling.** Um `nimbus vms create` manual aumenta a capacidade; um `nimbus vms delete` manual a reduz. Serve para cargas de trabalho estáveis; é ruim para as que variam com o tráfego.
- **Sem descoberta de serviços.** Os serviços se encontram por IPs públicos conhecidos ou por DNS — não por consultas dentro do cluster. Para configurações de dois ou três serviços, tudo bem; além disso, você vai querer um registro de serviços.
- **Sem reinícios baseados em verificação de integridade além do código de saída do contêiner.** O systemd reinicia em caso de falha; ele não reinicia quando "o processo está rodando, mas não está saudável". Adicione seu próprio watchdog (um sidecar que acessa `/healthz` e aplica `kill -1` no contêiner em caso de falha) se precisar disso.

## Próximos passos {#next-steps}

- [Deploys blue/green](/docs/guides/blue-green) — a versão sem downtime do fluxo de deploy acima.
- [Máquinas virtuais](/docs/api/vms) — todas as opções da chamada de criação.
- [Monitorar uma frota de VMs](/docs/guides/monitoring-vms) — configuração do Prometheus + Grafana.
- [Guia de site estático](/docs/guides/static-site) — para conteúdo puramente estático, este padrão é exagero; use o armazenamento de objetos.
