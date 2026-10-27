---
title: "Início rápido"
description: "Gere uma chave de API, escolha uma região e crie sua primeira VM em três requisições."
publishedAt: 2026-05-19
updatedAt: 2026-05-19
kind: quickstart
---

# Início rápido

Este guia leva você de uma conta conectada ao painel até uma máquina virtual em execução, em três chamadas de API. Tudo o que você faz aqui é reversível — destrua a VM quando terminar e você terá gastado no máximo alguns centavos.

## Antes de começar {#prereqs}

Você precisa de três coisas:

- Uma conta NimbusNexus. Cadastre-se em [{{ROOT_DOMAIN}}]({{BASE_URL}}/register) — você recebe um crédito inicial que cobre este início rápido com folga.
- A ferramenta de linha de comando `curl` ou qualquer cliente HTTP de sua preferência. Os exemplos desta página usam `curl`; as mesmas chamadas funcionam em qualquer linguagem.
- Cerca de cinco minutos.

Você ainda não precisa ter SSH configurado. Vamos criar uma chave como parte da segunda chamada.

## 1 · Gerar uma chave de API {#api-key}

Entre no painel e vá para **Settings → API keys → New key**. Dê à chave um rótulo que você reconheça depois (por exemplo, `quickstart`) e copie o valor para um lugar seguro — você só o vê uma vez.

Exporte-o como variável de ambiente para que os exemplos abaixo possam usá-lo:

```bash
export NIMBUS_KEY="nn_live_xxxxxxxxxxxxxxxx"
```

As chaves de API têm escopo de um único projeto. O projeto padrão criado com a sua conta serve por enquanto; depois, você pode dividir as cargas de trabalho entre projetos sem rotacionar chaves.

## 2 · Escolher uma região {#region}

A NimbusNexus opera em quatro regiões:

| Região              | Código           | Status         |
| ------------------- | ---------------- | -------------- |
| Virgínia, EUA       | `us-east-1`      | Ativa          |
| Los Angeles, EUA    | `us-west-1`      | Ativa          |
| Frankfurt, Alemanha | `eu-central-1`   | Ativa          |
| Singapura           | `ap-southeast-1` | Pré-lançamento |

Escolha a mais próxima de onde estão seus usuários (ou sua infraestrutura atual). O tráfego entre regiões dentro da NimbusNexus é gratuito; o egress para a internet pública é a única transferência cobrada.

Você pode pedir a lista oficial à API a qualquer momento:

```bash
curl {{API_BASE_URL}}/v1/regions \
  -H "Authorization: Bearer $NIMBUS_KEY"
```

## 3 · Criar sua primeira VM {#first-vm}

A menor VM útil para trabalho real é uma `gp-1-2` — uma vCPU, 2 GB de RAM, 25 GB de SSD. Ela custa cerca de um centavo por hora. Inicie uma na Virgínia com:

```bash
curl -X POST {{API_BASE_URL}}/v1/vms \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "quickstart",
    "size": "gp-1-2",
    "region": "us-east-1",
    "image": "ubuntu-24.04"
  }'
```

A resposta inclui o id da VM e o estado atual. O estado fica `provisioning` nos primeiros segundos e depois passa a `running`:

```json
{
  "id": "vm_01H...",
  "name": "quickstart",
  "size": "gp-1-2",
  "region": "us-east-1",
  "image": "ubuntu-24.04",
  "state": "provisioning",
  "ipv4": null,
  "created_at": "2026-05-19T18:30:00Z"
}
```

Faça polling da VM uma vez por segundo até que `state` seja `running` e `ipv4` esteja preenchido — isso leva cerca de 28 segundos com uma imagem em cache, ou 60–90 segundos quando a imagem é baixada pela primeira vez.

## O que você fez {#summary}

Você criou uma chave de API, escolheu uma região e provisionou uma máquina virtual de verdade. O mesmo padrão de três chamadas funciona para todos os recursos da API: `POST` para criar, `GET` para ler, `DELETE` para destruir. Autenticação, códigos de região e ids de recurso são os mesmos em todos os tipos de recurso — a API foi projetada para que você a aprenda uma vez e a aplique a qualquer coisa.

## Próximos passos {#next-steps}

- Navegue pela **referência da API** para ver todos os endpoints, com parâmetros, schemas de requisição/resposta e códigos de erro.
- Leia sobre **autenticação** para entender como as chaves de API funcionam junto com o escopo de projeto, os tokens que expiram e a assinatura de webhooks.
- Leia **convenções** para conhecer os padrões que a API segue em todo lugar — idempotência, paginação, formatos de erro, operações de longa duração.
- Experimente o **explorador interativo da API** em [{{API_HOST}}/docs/external]({{API_BASE_URL}}/docs/external) — é um Swagger UI conectado à API real; "Try it out" faz chamadas reais na sua conta.

Quando terminar, destrua a VM para deixar de ser cobrado:

```bash
curl -X DELETE {{API_BASE_URL}}/v1/vms/vm_01H... \
  -H "Authorization: Bearer $NIMBUS_KEY"
```
