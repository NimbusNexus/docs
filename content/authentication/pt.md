---
title: "Autenticação"
description: "Chaves de API, funções e regras de acesso, fronteiras de projeto e como substituir uma chave com segurança."
publishedAt: 2026-05-19
updatedAt: 2026-11-04
kind: concept
---

# Autenticação

A API da NimbusNexus em `{{API_HOST}}` recebe uma **chave de API** no header `X-API-Key`. Cada chave pertence a uma pessoa e funciona em um projeto, com as funções e as regras de acesso com que foi criada.

## Como é uma requisição {#request-shape}

Envie a chave no header `X-API-Key`:

```bash
curl {{API_BASE_URL}}/api/v1/instance/ \
  -H "X-API-Key: $NIMBUS_KEY"
```

A chave é o valor `api_key` devolvido quando você a cria: o ID da chave e o segredo dela, unidos por dois-pontos e codificados em base64. Uma chave que a API não consegue decodificar ou não reconhece recebe `401`.

## Gerar uma chave {#generating}

Crie uma chave no painel ou com `POST /api/v1/api_keys/` a partir de uma sessão conectada com escopo do projeto da chave. Dê a ela um `name` único entre as suas chaves e, opcionalmente, uma `description` e um `expires_at`. A resposta traz a chave uma única vez, em `api_key`; copie-a nessa hora. Depois disso, a API devolve o nome, as funções, as regras de acesso e a expiração da chave, mas nunca o segredo.

## Escopo de projeto {#project-scope}

Toda chave de API tem escopo de um **único projeto**. A chave pode ler e gravar recursos no seu projeto; ela não vê recursos de outros projetos, nem dentro da mesma conta.

Os projetos são a unidade de controle de acesso e isolamento; o faturamento é por workspace. O projeto padrão que vem com uma conta nova serve para desenvolvimento individual; times de produção costumam querer um projeto por ambiente (`prod`, `staging`, `dev`), para que uma chave de dev comprometida não alcance dados de produção.

Trocar de projeto = gerar uma nova chave no projeto de destino. Não existe um mecanismo do tipo "use esta chave, mas finja que está em outro projeto"; isso enfraqueceria a garantia de isolamento.

## O que uma chave pode fazer {#scopes}

Uma chave age com **funções** no projeto dela, e **regras de acesso** limitam as chamadas que ela pode fazer:

- `roles` — as funções com que a chave age, escolhidas entre as que você tem no projeto. Se você omitir o campo, a chave recebe todas.
- `access_rules` — as chamadas que a chave pode fazer. Cada regra é um `service` (`api` para esta API), um `method` e um `path`, como `GET` e `/api/v1/instance/`. `GET /api/v1/api_keys/access_rules_artifacts` lista todos os métodos e caminhos que você pode indicar; para um caminho que não existe, criar a chave retorna `422`.
- `unrestricted: true` — sem regras de acesso: a chave pode fazer qualquer chamada que as funções dela permitam.

Uma chave sem regras de acesso e sem `unrestricted` só consegue ler a própria sessão (`GET /api/v1/account/get_session_auth_data`). Uma chamada fora das regras de acesso de uma chave recebe `403`, com a mensagem "API key is restricted for this path!". Isso torna barato começar com regras restritas e acrescentar chamadas só quando uma for recusada.

## Rotação {#rotation}

Não existe chamada de rotação. Para substituir uma chave, crie a nova, passe as suas ferramentas para ela e depois exclua a antiga com `DELETE /api/v1/api_keys/{api_key_id}`. A API confere a chave a cada requisição, então uma chave excluída deixa de funcionar já na chamada seguinte. Ferramentas que guardam a chave por muito tempo (CI/CD, agentes implantados) devem relê-la ao iniciar o processo, para que uma rotação se propague dentro de um ciclo de deploy. Dê às chaves um `expires_at`, para que uma chave esquecida pare de funcionar sozinha.

Se você suspeitar que uma chave foi comprometida, exclua-a na hora, no painel ou com `DELETE /api/v1/api_keys/{api_key_id}` a partir de uma sessão conectada.

## Erros comuns {#errors}

As APIs de Webhooks e de Inboxes respondem a um problema de credencial com estes códigos. Elas diferem em um ponto: `invalid_credential`, uma chave que a API não reconhece, é um `403` no Webhooks e um `401` no Inboxes.

| Status    | error.code           | API   | O que significa                                                                                                                                                                         |
| --------- | -------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 401       | `unauthorized`       | Ambas | Nenhuma credencial foi enviada (nem `Authorization` nem `X-API-Key`), ou a chave foi revogada.                                                                                          |
| 401 / 403 | `invalid_credential` | Ambas | A chave ou o token não é válido: um `401` no Inboxes, um `403` no Webhooks. Substitua-o; enviá-lo de novo não vai funcionar.                                                            |
| 403       | `forbidden`          | Ambas | A chave é válida, mas não pode fazer isso: a falta de um escopo ou de uma função, uma chave limitada a certos projetos usada fora deles ou um produto não ativado para o seu workspace. |

`message` diz em qual caso você caiu; tome decisões com base em `code`, não no status: `invalid_credential` é um `403` no Webhooks e um `401` no Inboxes. Trate-o junto com `unauthorized`, como "esta credencial não serve".

Versões anteriores desta página listavam `no_credentials`, `invalid_credentials`, `expired_credentials`, `scope_required` e `wrong_project`. As APIs nunca enviaram esses códigos. Elas enviam `unauthorized` onde a página dizia `no_credentials`; `invalid_credential` onde dizia `invalid_credentials` ou `expired_credentials`, já que uma chave expirada é uma chave que a API não consegue verificar; e `forbidden` onde dizia `scope_required` ou `wrong_project`.

Os erros acima usam o formato de erro padrão descrito em [Erros](/docs/errors).

## Próximos passos {#next-steps}

- Leia [Convenções](/docs/conventions) para conhecer os padrões que todo endpoint segue (ids de recurso, paginação, erros, idempotência).
- Leia a [referência de máquinas virtuais](/docs/api/vms) para ver um exemplo concreto e completo de uma API de recurso.
