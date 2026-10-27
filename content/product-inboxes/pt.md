---
title: "Inboxes"
description: "Endereços de e-mail descartáveis para testes — crie um, aponte o sistema sob teste para ele e leia o que chega no painel ou pela API."
publishedAt: 2026-08-18
updatedAt: 2026-10-26
kind: concept
---

# Inboxes

O NimbusNexus Inboxes oferece **endereços de e-mail** descartáveis que aceitam e-mails reais. Você cria um, aponta para ele um formulário de cadastro ou uma suíte de testes e lê o que chegou no painel ou pela API REST.

> **Não é a página que você procurava?** O Inboxes só recebe e-mails. Para *enviar* e-mails da sua aplicação, este não é o produto. Para capturar **requisições HTTP** — os webhooks de um provedor, ou o que o seu próprio app envia —, use o [Request Bins](/docs/product-bins).

## Em resumo {#at-a-glance}

| | |
| --- | --- |
| O que você cria | Uma **caixa de entrada**: um endereço de e-mail descartável |
| URL base da API | `{{INBOXES_BASE_URL}}` |
| Autenticação | `Authorization: Bearer <key>`, uma chave gerada no console da conta com **Inboxes** como produto |
| Identificador que toda rota recebe | O `id` da caixa de entrada, por exemplo `inb_7f820a77f64ea18174499945` — nunca o endereço |
| Encontrar uma caixa de entrada pelo endereço | `GET /v1/inboxes?address=<address>` |
| Ler o que chegou | `GET /v1/inboxes/{id}/messages` (planos pagos; no plano gratuito, a leitura é feita no painel) |
| Excluir uma caixa de entrada | `DELETE /v1/inboxes/{id}` — permanente, e o endereço nunca mais é emitido |
| Todas as rotas, com exemplos | A [referência da API de Inboxes](/docs/reference/inboxes) |

## Como funciona {#how}

1. **Crie** um endereço — no painel, com **New address**, ou com `POST /v1/inboxes`.
2. **Envie** e-mails para ele a partir do sistema sob teste, com a `phrase` da caixa de entrada no assunto, se ela tiver uma.
3. **Leia** o que chegou. A mensagem aparece em segundos no painel e, nos planos pagos, em `GET /v1/inboxes/{id}/messages`.
4. **Exclua** o endereço quando terminar, ou deixe que ele expire.

O [início rápido](/docs/product-inboxes/quickstart) faz as quatro etapas com `curl`.

Use o `address` exatamente como a API o retorna. Os endereços ficam em um domínio dedicado, e não em `{{ROOT_DOMAIN}}`, para que o tráfego descartável nunca compartilhe reputação com o domínio que os seus e-mails reais usam.

## Como a aceitação funciona {#acceptance}

Os e-mails são recusados logo na entrada, em vez de aceitos e escondidos. Uma mensagem só é armazenada se todas estas condições forem atendidas:

- o endereço de destino é uma caixa de entrada existente e ativada;
- o **assunto contém a frase dessa caixa de entrada**, se ela tiver uma;
- o workspace está dentro da sua franquia mensal;
- a mensagem não passa de 5 MiB.

Qualquer outra coisa é recusada durante a conversa SMTP, então o servidor de envio é avisado e gera o bounce. Uma mensagem recusada nunca é armazenada e nunca conta para o seu uso.

Os e-mails aceitos são sanitizados antes do armazenamento: o HTML passa por um sanitizador baseado em allow-list, e o painel o renderiza em um frame com sandbox, com as imagens remotas bloqueadas até você pedir para vê-las. Qualquer pessoa pode enviar e-mails para um endereço descartável, por isso o conteúdo é tratado como escrito por um atacante.

## Limites por plano {#limits}

| | Free | Starter | Pro | Custom |
| --- | --- | --- | --- | --- |
| Endereços ao mesmo tempo | 1 | 5 | 25 | 250 |
| Mensagens por mês | 1.000 | 25.000 | 250.000 | 5.000.000 |
| Mantidas por (retenção) | 1 dia | 7 dias | 30 dias | 90 dias |
| Tempo de vida do endereço | 24 horas | até ser excluído, ou até 7 dias se você definir um | até ser excluído, ou até 30 dias | até ser excluído, ou qualquer tempo de vida |
| Frase no assunto | sempre obrigatória | opcional | opcional | opcional |
| Leitura pela API | não (só no painel) | sim | sim | sim |
| E-mails aceitos por minuto, por endereço | 60 | 300 | 1.200 | 6.000 |

Os limites de tamanho são os mesmos em todos os planos:

| | Limite |
| --- | --- |
| Um e-mail | 5 MiB. E-mails maiores são recusados, nunca truncados. |
| Corpo em texto ou HTML | São mantidos 256K caracteres de cada um; o resto é cortado e a mensagem é marcada com `truncated: true`. |
| Anexos | São mantidos o nome, o tipo de conteúdo, o tamanho e o digest. O arquivo em si não é armazenado, em nenhum plano. |

## Como um endereço termina {#lifecycle}

| | O que acontece | Dá para desfazer? |
| --- | --- | --- |
| **Desativação** | O endereço para de aceitar e-mails e mantém o que já tem; os e-mails enviados para ele são recusados. | Sim — ative-o de novo |
| **Exclusão** | O endereço e os e-mails dele são excluídos, e o endereço é aposentado: ele nunca mais é emitido, nem para você nem para ninguém. | Não |
| **Expiração** | Em `expires_at`, o mesmo que a Exclusão. Só expiram os endereços do plano gratuito (24 horas) e os endereços criados com `expires_in_minutes`. | Não |

A exclusão é feita com `DELETE /v1/inboxes/{id}`; versões antigas desta documentação e o log de auditoria da API chamam isso de *release*. Um endereço aposentado nunca é reemitido, de propósito: um endereço reciclado entregaria a redefinição de senha de um desconhecido a quem ficasse com ele depois. [Endereços e a frase](/docs/product-inboxes/addresses#lifecycle) traz os detalhes, incluindo como a expiração e a retenção interagem.

## Leitura pela API {#reading}

As mensagens podem ser lidas no painel em todos os planos, inclusive no gratuito. Lê-las **programaticamente** é o que os planos pagos acrescentam: `GET /v1/inboxes/{id}/messages` retorna a mensagem processada, as duas partes do corpo, os veredictos de autenticação e um campo `extracted` com qualquer código de uso único que encontramos — que geralmente é a única coisa que um teste quer.

Toda rota recebe o `id` da caixa de entrada. O painel o mostra no card do endereço, com um botão de copiar. Se você só tem o endereço, faça a busca:

```bash
curl "{{INBOXES_BASE_URL}}/v1/inboxes?address=ff25m3tue9vm@nninbox.com" \
  -H "Authorization: Bearer $INBOXES_API_KEY"
```

A resposta é a lista de sempre, com no máximo um item. `GET /v1/inboxes` e `GET /v1/inboxes/{id}` retornam o `id`, o `address` e a `phrase` juntos, então uma única chamada traz tudo o que é preciso para enviar e para ler.

## Como obter acesso {#access}

Cadastre-se no Inboxes e você recebe um workspace no plano gratuito: um endereço por vez, retenção de 24 horas e leitura no painel. Os preços estão na [página do Inboxes](/inboxes).

As chaves não são emitidas com o workspace, e a API de Inboxes não as emite. Gere uma no console da sua conta NimbusNexus, em **API keys**, escolhendo **Inboxes** como produto — o Identity é o único emissor de chaves de API em todos os produtos. Uma chave é um JWT, por isso começa com `eyJ`. Apresente-a como `Authorization: Bearer <key>` ou `X-API-Key: <key>`.

Escolha o escopo ao gerá-la: `admin` pode criar, alterar e excluir endereços, além de ler; `read` só pode ler. Uma chave do Inboxes não pode ser restrita a um único projeto.

> **Uma chave `inbx_…` não autentica mais.** O Inboxes emitia chaves próprias com esse prefixo. Se você tem uma, gere uma substituta no console da conta.

## O que ele não faz {#not}

- **Ele não envia.** Não há API de envio nem de relay. Um endereço capaz de originar e-mails seria um serviço de spam.
- **Ele não é um arquivo.** Uma mensagem é excluída quando a retenção do plano se esgota, e tudo o que está em um endereço é removido quando o endereço é excluído ou expira.
- **Ele ainda não encaminha.** Encaminhar o que chega para uma URL sua está planejado e não foi implementado.
- **Ele não captura HTTP.** Uma caixa de entrada só recebe e-mails. Para webhooks e outras requisições HTTP, use o [Request Bins](/docs/product-bins), cujas URLs registram qualquer requisição enviada a elas.

## Próximos passos {#next-steps}

- [Início rápido](/docs/product-inboxes/quickstart) — crie um endereço, envie uma mensagem para ele e leia-a de volta.
- [Endereços e a frase](/docs/product-inboxes/addresses) — a barreira do assunto, a expiração e a retenção.
- [Referência da API de Inboxes](/docs/reference/inboxes) — todas as rotas, com a requisição em curl, TypeScript, Python ou Go.
