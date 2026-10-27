---
title: "Autenticação"
description: "Chaves de API, escopos, fronteiras de projeto e como rotacionar credenciais com segurança."
publishedAt: 2026-05-19
updatedAt: 2026-10-15
kind: concept
---

# Autenticação

A API da NimbusNexus usa **chaves de API** como tokens Bearer. Existe um único mecanismo para todos os endpoints — nenhum formato de credencial por recurso, nenhum esquema de assinatura separado para chamadas "avançadas". Se você consegue fazer uma requisição autenticada, consegue fazer todas.

## Como é uma requisição {#request-shape}

Envie a chave no header `Authorization`. O formato é a palavra literal `Bearer` seguida da sua chave:

```bash
curl {{API_BASE_URL}}/v1/vms \
  -H "Authorization: Bearer nn_live_xxxxxxxxxxxxxxxx"
```

As chaves têm um prefixo por ambiente: `nn_live_*` para produção, `nn_test_*` para o sandbox. Depois do prefixo, elas têm 32–48 caracteres de um alfabeto seguro para base32.

## Gerar uma chave {#generating}

No painel: **Settings → API keys → New key**. Você vê o valor da chave uma única vez, no momento da criação; copie-o nessa hora. Depois disso, o painel mostra apenas o prefixo + os 4 últimos caracteres, para que você saiba qual chave é qual sem expor o segredo.

De propósito, não existe uma API para criar chaves de API. O caminho de recuperação quando uma chave é comprometida precisa de um canal fora de banda que a chave comprometida não alcance — ter que usar o painel é o gargalo que torna essa recuperação limpa.

## Escopo de projeto {#project-scope}

Toda chave de API tem escopo de um **único projeto**. A chave pode ler e gravar recursos no seu projeto; ela não vê recursos de outros projetos, nem dentro da mesma conta.

Os projetos são a unidade de controle de acesso, faturamento e isolamento. O projeto padrão que vem com uma conta nova serve para desenvolvimento individual; times de produção costumam querer um projeto por ambiente (`prod`, `staging`, `dev`), para que uma chave de dev comprometida não alcance dados de produção.

Trocar de projeto = gerar uma nova chave no projeto de destino. Não existe um mecanismo do tipo "use esta chave, mas finja que está em outro projeto"; isso enfraqueceria a garantia de isolamento.

## Escopos (capacidades) {#scopes}

As chaves carregam **escopos** que limitam o que elas podem fazer dentro do seu projeto. O conjunto de escopos padrão de uma chave nova é leitura+gravação em tudo no projeto; na criação, você pode restringi-lo, por exemplo, a apenas `vms:read` para um agente de monitoramento que nunca precisa criar recursos.

A lista completa de escopos espelha os tipos de recurso:

- `vms:read`, `vms:write`, `vms:create`, `vms:delete`
- `databases:read`, `databases:write`, …
- `block-storage:read`, `block-storage:write`, …
- `object-storage:read`, `object-storage:write`, …
- `iam:read`, `iam:write` (gerenciar os próprios usuários, projetos e chaves)

Uma requisição a um endpoint que exige um escopo que a chave não tem retorna `403 Forbidden` com `error.code: 'forbidden'`, e `error.message` diz o que faltou. Isso torna barato começar com escopos restritos e ampliá-los só quando algo falhar. (Versões anteriores desta página prometiam `scope_required`, com o escopo em `error.fields.scope`; a API nunca enviou nenhum dos dois.)

## Rotação {#rotation}

Cada chave pode ser rotacionada de forma independente. Rotacionar uma chave:

1. Gera um novo valor de chave.
2. Marca a chave antiga como **descontinuada**, mas a mantém válida por **24 horas**.
3. Registra o uso das duas chaves durante essa janela, para que você confirme que a nova chave está em uso antes de a antiga deixar de funcionar.

Para a rotação automatizada (que recomendamos), chame a API de IAM para rotacionar segundo um agendamento e deixe a sobreposição de 24 horas absorver a janela de implantação. Ferramentas que guardam a chave por muito tempo (CI/CD, agentes implantados) devem relê-la ao iniciar o processo, para que uma rotação se propague dentro de um ciclo de deploy.

Se você suspeitar que uma chave foi comprometida, **revogue-a** em vez de rotacioná-la — isso pula o período de carência de 24 horas e invalida a chave antiga imediatamente. O painel tem uma revogação com um clique; também há um endpoint de IAM para revogação de emergência programática.

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
- Para configurações de serviço a serviço dentro da sua própria infraestrutura, você também pode criar **relações de confiança** entre projetos — veja a referência de IAM (em breve).
