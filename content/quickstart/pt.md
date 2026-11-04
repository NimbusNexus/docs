---
title: "Início rápido"
description: "Gere uma chave de API, consulte suas opções e crie sua primeira VM."
publishedAt: 2026-05-19
updatedAt: 2026-11-04
kind: quickstart
---

# Início rápido

Este guia leva você de uma conta conectada ao painel até uma máquina virtual em execução, em algumas chamadas de API. Tudo o que você faz aqui é reversível: exclua a VM quando terminar. Uma VM é cobrada da criação até a exclusão, então não a deixe em execução por acidente; os preços estão em [Dados de preços](/docs/api/pricing-data).

## Antes de começar {#prereqs}

Você precisa de três coisas:

- Uma conta NimbusNexus. Cadastre-se em [{{ROOT_DOMAIN}}]({{BASE_URL}}/register).
- A ferramenta de linha de comando `curl` ou qualquer cliente HTTP de sua preferência, e `jq` para ler as respostas. Os exemplos desta página usam `curl`; as mesmas chamadas funcionam em qualquer linguagem.
- Cerca de cinco minutos.

Você ainda não precisa ter SSH configurado: esta VM faz o boot sem chave. Para entrar em uma VM depois, registre uma chave primeiro ([Chaves SSH](/docs/api/ssh-keys)) e indique-a em `sshs` ao criar a VM.

## 1 · Gerar uma chave de API {#api-key}

Entre no painel e vá para **Segurança → Tokens de API → Criar token**. Dê ao token um nome que você reconheça depois (por exemplo, `quickstart`) e escolha o escopo **Administrador**, que gera uma chave sem restrições. Os outros dois escopos geram uma chave sem regras de acesso, e essa chave só consegue ler a própria sessão. Copie o valor com o rótulo **Chave de API**, não **Segredo**, para um lugar seguro — você só o vê uma vez.

Exporte-o como variável de ambiente para que os exemplos abaixo possam usá-lo:

```bash
export NIMBUS_KEY="<your-api-key>"
```

Envie-o no header `X-API-Key` em toda chamada. As chaves de API têm escopo de um único projeto. O projeto padrão criado com a sua conta serve por enquanto. [Autenticação](/docs/authentication#scopes) cobre as chaves limitadas às chamadas de que precisam.

## 2 · Consultar suas opções {#region}

Hoje, a NimbusNexus atende uma região, em Frankfurt, na Alemanha, então não há região para escolher; os detalhes estão em [Regiões](/docs/api/regions). Pergunte à API o que você pode criar lá:

```bash
curl -s {{API_BASE_URL}}/api/v1/instance/artifacts \
  -H "X-API-Key: $NIMBUS_KEY" \
  | jq '.data | {
      images: [.images.data[] | { id, name }],
      vm_options: [.vm_options.data[] | { architecture: .label, vm_classes: [.children[]?.label] }],
      networks: [.networks.data[] | { id, name, external, subnets: [.subnets[].cidr] }],
      security_groups: [.security_groups.data[] | { id, name }]
    }'
```

O tipo de volume do disco de boot vem de uma segunda chamada:

```bash
curl -s {{API_BASE_URL}}/api/v1/storage/artifacts \
  -H "X-API-Key: $NIMBUS_KEY" \
  | jq '[.data.volume_options.data[].label]'
```

Escolha um de cada e exporte-os. Imagens, redes e grupos de segurança são identificados pelo `id`; arquiteturas, classes de VM e tipos de volume, pelo rótulo. Escolha uma rede com `external: false` que tenha uma sub-rede: entrar em uma rede externa também exige `bandwidth_mbps` e `subscription.bandwidth` e, sem eles, a chamada recebe `400`.

```bash
export IMAGE_ID="<image-id>"
export ARCHITECTURE="<architecture>"
export VM_CLASS="<vm-class>"
export VOLUME_TYPE="<volume-type>"
export NETWORK_ID="<network-id>"
export SECURITY_GROUP_ID="<security-group-id>"
```

## 3 · Criar sua primeira VM {#first-vm}

A configuração de uma VM é a quantidade de `cpu` e a `ram` em MB. O disco de boot dela tem `volume_size` GB. Inicie uma com uma vCPU, 2 GB de RAM e um disco de 25 GB:

```bash
curl -X POST {{API_BASE_URL}}/api/v1/instance/ \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"quickstart\",
    \"image\": \"$IMAGE_ID\",
    \"spec\": {
      \"architecture\": \"$ARCHITECTURE\",
      \"vm_class\": \"$VM_CLASS\",
      \"cpu\": 1,
      \"ram\": 2048,
      \"volume_type\": \"$VOLUME_TYPE\"
    },
    \"volume_size\": 25,
    \"network\": [\"$NETWORK_ID\"],
    \"security_group\": [\"$SECURITY_GROUP_ID\"]
  }"
```

Uma configuração que não é oferecida para essa arquitetura e essa classe recebe `400`; [Dados de preços](/docs/api/pricing-data) as lista. Caso contrário, a chamada coloca o trabalho na fila e responde sem id:

```json
{
  "success": true
}
```

Encontre a nova VM pelo nome e leia o `status` dela:

```bash
curl -s {{API_BASE_URL}}/api/v1/instance/ \
  -H "X-API-Key: $NIMBUS_KEY" \
  | jq '.data[] | select(.name == "quickstart") | { id, status, nics, fault }'
```

O `status` é `BUILD` no início e depois `ACTIVE`, com os endereços da VM em `nics`:

```json
{
  "id": "3f0c9e1a-6b7d-4c2e-9a51-7d2b8f4e1c60",
  "status": "ACTIVE",
  "nics": {
    "my-network": [
      { "addr": "10.0.0.12", "version": 4, "OS-EXT-IPS:type": "fixed" }
    ]
  },
  "fault": null
}
```

Faça polling de vez em quando até que o `status` seja `ACTIVE`. Se for `ERROR`, `fault` diz o que deu errado. Salve o id:

```bash
export VM_ID="<vm-id>"
```

## O que você fez {#summary}

Você criou uma chave de API, consultou suas opções e provisionou uma máquina virtual de verdade. Muitos recursos funcionam da mesma forma: uma chamada `artifacts` lista suas opções, `POST` cria e `GET` lê. A exclusão varia conforme o recurso, então consulte a página de referência dele. A chave de API e o header são os mesmos em todo o `{{API_HOST}}`.

## Próximos passos {#next-steps}

- Navegue pela **referência da API** para ver todos os endpoints, com parâmetros, schemas de requisição/resposta e códigos de erro.
- Anexe um [IP flutuante](/docs/api/floating-ips) para alcançar a VM pela internet.
- Leia sobre **autenticação** para entender como as chaves de API funcionam junto com o escopo de projeto, as funções e as regras de acesso.
- Leia **convenções** para conhecer os padrões que a API segue — paginação, formatos de erro, trabalho que termina depois da resposta.
- Experimente o **explorador interativo da API** em [{{API_HOST}}/docs/external]({{API_BASE_URL}}/docs/external) — é um Swagger UI conectado à API real; "Try it out" faz chamadas reais na sua conta.

Quando terminar, exclua a VM para deixar de ser cobrado. O volume de boot vai junto com ela:

```bash
curl -X POST {{API_BASE_URL}}/api/v1/instance/action \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{ \"servers\": [\"$VM_ID\"], \"cmd\": \"delete\" }"
```
