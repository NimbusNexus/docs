---
title: "Endereços e a frase"
description: "Por que um endereço descartável recusa e-mails sem a frase no assunto e como expiração, retenção e exclusão se diferenciam."
publishedAt: 2026-08-18
updatedAt: 2026-10-27
kind: concept
---

# Endereços e a frase

Um endereço descartável é público por natureza: ele vai parar em um formulário de cadastro, em um log de CI, talvez em uma captura de tela. Qualquer pessoa que o veja pode enviar e-mails para ele. Esta página trata dos dois mecanismos que tornam isso seguro — a **frase** e o fato de que os endereços **morrem**.

## A frase {#phrase}

Uma caixa de entrada do plano gratuito sempre recebe um token curto junto com o endereço. No Starter, no Pro e no Custom, ela só recebe um quando você pede, com `"phrase": true` na alocação ou em um `PATCH` posterior. Uma caixa de entrada com frase só aceita uma mensagem se a frase aparecer no **assunto**; uma sem frase aceita qualquer assunto:

```text
Subject: nn-re89dr Your verification code   ← accepted
Subject: Your verification code             ← refused
```

A frase não é uma senha nem um segredo — ela trafega em texto puro em uma linha de assunto. O que ela é, na verdade, é um *incômodo em forma de segredo compartilhado*: ela faz com que um endereço vazado não seja, sozinho, um endereço utilizável.

Essa distinção é o produto. Sem ela, um endereço descartável encontrado em um log de CI público poderia ser usado para cadastrar contas em outros serviços, receber os e-mails de confirmação deles e entregar a alguém uma conta que você não vê e não criou. O endereço seria um gerador gratuito de identidades anônimas. Exigir a frase significa que quem tem o endereço também precisa ter recebido a frase da mesma chamada de API que o emitiu — o que não é o caso de quem vasculha a saída do seu build.

Isso também significa que **você controla o que o endereço aceita**. Um sistema sob teste que você configura vai colocar a frase no assunto porque você mandou. Um envio oportunista, não.

Onde colocá-la: em qualquer parte do assunto. A correspondência é verificada só no assunto — uma frase no corpo não conta, porque o corpo é a parte que um atacante consegue encher de qualquer coisa com mais facilidade.

## A recusa é explícita {#refusal}

Os e-mails que falham em qualquer regra de aceitação são recusados **durante a conversa SMTP**, e não aceitos e escondidos:

- o endereço é desconhecido, expirou, foi excluído ou está desativado;
- a caixa de entrada tem uma frase e o assunto não a contém;
- o workspace passou da sua franquia mensal;
- a mensagem é maior que 5 MiB.

Isso importa mais do que parece. A alternativa — aceitar e depois descartar em silêncio — produz uma caixa de entrada vazia que parece exatamente igual a um remetente que nunca enviou nada. Recusar logo na entrada significa que o remetente recebe uma rejeição que ele pode registrar em log, e uma caixa de entrada vazia no seu teste significa que *nada foi enviado*, o que é um bug diferente de *algo foi enviado e rejeitado*.

Os e-mails recusados nunca são armazenados e nunca contam para o uso.

## Três formas de um endereço terminar {#lifecycle}

Elas são fáceis de confundir e se comportam de formas diferentes.

| | O que acontece | Reversível |
| --- | --- | --- |
| **Expiração** | A caixa de entrada chega a `expires_at`, o endereço dela é aposentado e os e-mails armazenados nela são excluídos. | Não |
| **Exclusão** | Você o encerra antes: **Delete inbox…** no painel, ou `DELETE /v1/inboxes/{id}`. Ele é aposentado na hora, como na expiração. | Não |
| **Desativação** | O endereço para de aceitar e-mails e a caixa de entrada mantém o que já tem: **Disable** no painel, ou `PATCH` com `{"status": "disabled"}`. | Sim — ative-o de novo |

No painel, essas opções ficam no menu ⋯ da página da caixa de entrada, junto com **Rename…** e **Empty inbox…**, que exclui os e-mails da caixa de entrada e mantém a caixa de entrada e o endereço dela. Os membros podem renomear, desativar e ativar uma caixa de entrada; esvaziá-la e excluí-la cabe aos proprietários e admins do workspace. A página de uma caixa de entrada desativada indica isso, com um botão **Enable**. O tempo de vida de uma caixa de entrada é escolhido quando ela é criada e não pode ser alterado depois; uma vez expirada ou excluída, a página dela diz "This inbox no longer exists".

Um endereço aposentado **nunca é reemitido**, nem para você nem para ninguém: todo endereço que já existiu fica registrado, e um novo é conferido contra esse registro antes de ser emitido. Isso é uma propriedade de segurança, e não um detalhe de implementação — reciclar um endereço descartável acabaria entregando a redefinição de senha de um desconhecido na execução de testes de outra pessoa. O estoque não se esgota: um endereço tem 12 caracteres de um alfabeto de 32 caracteres, cerca de 1,15 × 10¹⁸ combinações.

Recorra à **desativação** quando uma suíte de testes estiver inundando um endereço e você quiser que isso pare por uma hora. Recorra ao **esvaziamento** quando quiser manter o endereço e recomeçar sem nenhum e-mail. Recorra à **exclusão** quando tiver terminado e quiser a vaga de volta — os planos limitam quantas caixas de entrada você pode ter ao mesmo tempo. Versões antigas desta documentação, e o log de auditoria da API, chamam a exclusão de *release*.

## Expiração não é retenção {#expiry-vs-retention}

São dois relógios diferentes, e confundi-los é a causa habitual de "minha mensagem sumiu":

- A **expiração** (`expires_at`) é quanto tempo o **endereço** vive.
- A **retenção** é por quanto tempo uma **mensagem** aceita continua legível, e é definida pelo seu plano.

O menor dos dois prevalece. Em um plano com retenção de 24 horas, uma mensagem recebida hoje fica ilegível amanhã, mesmo que o próprio endereço viva por uma semana. Quando o endereço expira, tudo o que há nele é excluído de uma vez, independentemente da retenção.

A exclusão é real. Não há arquivo nem como desfazer uma exclusão, então um teste que faz asserções sobre e-mails mais antigos que a janela de retenção vai falhar de um jeito que parece um problema de entrega, mas não é.

## Os endereços ficam em um domínio próprio {#domain}

Os endereços alocados ficam em um domínio de caixas de entrada dedicado, e não em `{{ROOT_DOMAIN}}` nem no seu. Isso é proposital: um domínio que acumula tráfego de endereços descartáveis acumula a reputação que vem com ele, e manter isso longe do domínio de onde saem os seus e-mails reais vale um registro DNS a mais.

A consequência prática é que você nunca deve deduzir o domínio do endereço a partir do domínio do produto. Leia o `address` na resposta da alocação e use-o exatamente como veio.
