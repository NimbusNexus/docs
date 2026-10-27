---
title: "Inboxes"
description: "Endereços de e-mail descartáveis para testes — crie um, aponte o sistema sob teste para ele e leia o que chega no painel ou pela API."
publishedAt: 2026-08-18
updatedAt: 2026-10-27
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
| Ler o que chegou | `GET /v1/inboxes/{id}/messages`, ou `GET /v1/messages` para todas as caixas de entrada de uma vez (planos pagos; no plano gratuito, a leitura é feita no painel) |
| Buscar no que chegou | `q` em qualquer uma das duas listas, restrito com `in` ou `header` ([Busca de mensagens](#search)) |
| Excluir uma caixa de entrada | `DELETE /v1/inboxes/{id}` — permanente, e o endereço nunca mais é emitido |
| Todas as rotas, com exemplos | A [referência da API de Inboxes](/docs/reference/inboxes) |

## Como funciona {#how}

1. **Crie** uma caixa de entrada — no painel, com **Create an inbox**, ou com `POST /v1/inboxes`.
2. **Envie** e-mails para o endereço dela a partir do sistema sob teste, com a `phrase` da caixa de entrada no assunto, se ela tiver uma.
3. **Leia** o que chegou. A mensagem aparece em segundos no painel e, nos planos pagos, em `GET /v1/inboxes/{id}/messages`. Para encontrar uma mensagem entre muitas, busque nos assuntos, remetentes, headers e corpos: **Search** acima da lista no painel, `q` na API ([Busca de mensagens](#search)). **All inboxes** no painel, e `GET /v1/messages` na API, listam de uma vez o que chegou a todas as caixas de entrada.
4. **Exclua** a caixa de entrada quando terminar, ou deixe que ela expire.

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
| Caixas de entrada ao mesmo tempo | 1 | 5 | 25 | 250 |
| Mensagens por mês | 1.000 | 25.000 | 250.000 | 5.000.000 |
| Mantidas por (retenção) | 1 dia | 7 dias | 30 dias | 90 dias |
| Tempo de vida da caixa de entrada | 24 horas | até ser excluída, ou até 7 dias se você definir um | até ser excluída, ou até 30 dias | até ser excluída, ou qualquer tempo de vida |
| Frase no assunto | sempre obrigatória | opcional | opcional | opcional |
| Leitura pela API | não (só no painel) | sim | sim | sim |
| E-mails aceitos por minuto, por caixa de entrada | 60 | 300 | 1.200 | 6.000 |

Os limites de tamanho são os mesmos em todos os planos:

| | Limite |
| --- | --- |
| Um e-mail | 5 MiB. E-mails maiores são recusados, nunca truncados. |
| Corpo em texto ou HTML | São mantidos 256K caracteres de cada um; o resto é cortado e a mensagem é marcada com `truncated: true`. |
| Anexos | São mantidos o nome, o tipo de conteúdo, o tamanho e o digest. O arquivo em si não é armazenado, em nenhum plano. |

## Como uma caixa de entrada termina {#lifecycle}

| | O que acontece | Dá para desfazer? |
| --- | --- | --- |
| **Desativação** | A caixa de entrada para de aceitar e-mails e mantém o que já tem; os e-mails enviados para ela são recusados. | Sim — ative-a de novo |
| **Exclusão** | A caixa de entrada e os e-mails dela são excluídos, e o endereço dela é aposentado: ele nunca mais é emitido, nem para você nem para ninguém. | Não |
| **Expiração** | Em `expires_at`, o mesmo que a Exclusão. Toda caixa de entrada do plano gratuito expira em no máximo 24 horas; em um plano pago, só expira uma caixa de entrada criada com um tempo de vida. | Não |

No painel, o menu ⋯ na página de uma caixa de entrada traz **Rename…**, **Disable** ou **Enable**, **Empty inbox…**, que exclui os e-mails dela e mantém a caixa de entrada, e **Delete inbox…**. A exclusão é feita com `DELETE /v1/inboxes/{id}`; versões antigas desta documentação e o log de auditoria da API chamam isso de *release*. Um endereço aposentado nunca é reemitido, de propósito: um endereço reciclado entregaria a redefinição de senha de um desconhecido a quem ficasse com ele depois. [Endereços e a frase](/docs/product-inboxes/addresses#lifecycle) traz os detalhes, incluindo como a expiração e a retenção interagem.

## Leitura pela API {#reading}

As mensagens podem ser lidas no painel em todos os planos, inclusive no gratuito. Lê-las **programaticamente** é o que os planos pagos acrescentam: `GET /v1/inboxes/{id}/messages` lista as mensagens de uma caixa de entrada, da mais nova para a mais antiga, com o remetente, o assunto e os veredictos de autenticação de cada uma e, com `extract=otp`, um campo `extracted` com qualquer código de uso único que encontramos — que geralmente é a única coisa que um teste quer. `GET /v1/messages` lista as mensagens de todas as caixas de entrada do workspace em uma única lista, cada uma com o seu `inbox_id`. `GET /v1/inboxes/{id}/messages/{message_id}` retorna uma mensagem completa: as duas partes do corpo, os detalhes dos anexos e os [headers](#headers) dela.

Toda rota recebe o `id` da caixa de entrada. O painel o mostra na página da caixa de entrada, ao lado de **ID**, com um botão de copiar. Se você só tem o endereço, faça a busca:

```bash
curl "{{INBOXES_BASE_URL}}/v1/inboxes?address=ff25m3tue9vm@nninbox.com" \
  -H "Authorization: Bearer $INBOXES_API_KEY"
```

A resposta é a lista de sempre, com no máximo um item. `GET /v1/inboxes` e `GET /v1/inboxes/{id}` retornam o `id`, o `address` e a `phrase` juntos, então uma única chamada traz tudo o que é preciso para enviar e para ler.

## Busca de mensagens {#search}

As duas listas de mensagens aceitam uma busca: `GET /v1/inboxes/{id}/messages` para uma caixa de entrada e `GET /v1/messages` para todas elas. O campo **Search** do painel, acima de cada lista, envia os mesmos parâmetros:

| Parâmetro | Descrição |
| --- | --- |
| `q` | Só as mensagens que contêm este texto, com até 200 caracteres, sem diferenciar maiúsculas de minúsculas. |
| `in` | Onde `q` procura: `all`, o padrão, ou só `subject`, `from` (o remetente, como aparece no header From), `headers` (cada um como `name: value`) ou `body` (o corpo em texto ou, para um e-mail que só tem corpo em HTML, o texto desse HTML). |
| `header` | Só os valores deste header, sem diferenciar maiúsculas de minúsculas no nome, e qualquer um deles quando o header chegou mais de uma vez. Sem `q`, toda mensagem que traz o header. Ele combina com `in` `all` ou `headers`. |

```bash
curl -G "{{INBOXES_BASE_URL}}/v1/inboxes/inb_7f820a77f64ea18174499945/messages" \
  --data-urlencode "q=verification code" \
  --data-urlencode "in=subject" \
  -H "Authorization: Bearer $INBOXES_API_KEY"
```

`since`, `until`, `extract` e `limit` funcionam com uma busca da mesma forma que sem ela. Um `header` com `in` definido como `subject`, `from` ou `body` é recusado com um `422` `validation_error` cuja entrada tem o tipo `inboxes.search_conflict`.

Uma busca é paginada de forma diferente da lista simples. Ela lê as mensagens da mais nova para a mais antiga e para quando tem `limit` correspondências ou quando já leu 16 MiB de e-mails (ou 5.000 mensagens), o que vier primeiro, então uma página pode ter menos correspondências que `limit`, ou nenhuma, enquanto ainda há mensagens mais antigas não lidas. A página de uma busca tem `next_offset` `null` e, enquanto a busca não tiver lido a mensagem mais antiga da lista, um `next_until`: passe-o de volta como `until`, com a mesma busca e o mesmo `since`, para continuar a busca de onde ela parou. Com uma busca, `offset` pula essa quantidade de mensagens antes de a busca começar a ler. Sem uma busca, `next_until` é sempre `null`, e a lista é paginada por `next_offset`.

Uma busca nos headers só encontra e-mails que chegaram depois que o Inboxes passou a manter os headers ([Headers](#headers)).

## Headers {#headers}

`GET /v1/inboxes/{id}/messages/{message_id}` traz as linhas de header do e-mail como `headers`: objetos com um `name` e um `value`, na ordem de chegada, com duplicatas mantidas, cada valor desdobrado e com as palavras codificadas (RFC 2047) decodificadas. São mantidas até 256 linhas; um nome é cortado em 256 caracteres, e um valor em 8.192. As listas não trazem headers. No painel, eles ficam na seção **Headers** da mensagem.

`headers` é `null` para um e-mail que chegou antes de o Inboxes passar a manter os headers: eles não foram mantidos para esse e-mail e não podem ser adicionados depois. O e-mail bruto não é mantido, só as partes processadas dele.

## Como obter acesso {#access}

Cadastre-se no Inboxes e você recebe um workspace no plano gratuito: uma caixa de entrada por vez, retenção de 24 horas e leitura no painel. Os preços estão na [página do Inboxes](/inboxes).

As chaves não são emitidas com o workspace, e a API de Inboxes não as emite. Gere uma no console da sua conta NimbusNexus, em **API keys**, escolhendo **Inboxes** como produto — o Identity é o único emissor de chaves de API em todos os produtos. Uma chave é um JWT, por isso começa com `eyJ`. Apresente-a como `Authorization: Bearer <key>` ou `X-API-Key: <key>`.

Escolha o escopo ao gerá-la: `admin` pode criar, alterar, esvaziar e excluir caixas de entrada, além de ler; `read` só pode ler. Uma chave do Inboxes não pode ser restrita a um único projeto.

> **Uma chave `inbx_…` não autentica mais.** O Inboxes emitia chaves próprias com esse prefixo. Se você tem uma, gere uma substituta no console da conta.

## O que ele não faz {#not}

- **Ele não envia.** Não há API de envio nem de relay. Um endereço capaz de originar e-mails seria um serviço de spam.
- **Ele não é um arquivo.** Uma mensagem é excluída quando a retenção do plano se esgota, e tudo o que está em um endereço é removido quando o endereço é excluído ou expira.
- **Ele ainda não encaminha.** Encaminhar o que chega para uma URL sua está planejado e não foi implementado.
- **Ele não captura HTTP.** Uma caixa de entrada só recebe e-mails. Para webhooks e outras requisições HTTP, use o [Request Bins](/docs/product-bins), cujas URLs registram qualquer requisição enviada a elas.

## Próximos passos {#next-steps}

- [Início rápido](/docs/product-inboxes/quickstart) — crie uma caixa de entrada, envie uma mensagem para ela e leia-a de volta.
- [Endereços e a frase](/docs/product-inboxes/addresses) — a barreira do assunto, a expiração e a retenção.
- [Referência da API de Inboxes](/docs/reference/inboxes) — todas as rotas, com a requisição em curl, TypeScript, Python ou Go.
