---
title: "Funções"
description: "Funções predefinidas e personalizadas, mais os endpoints de atribuição de função que concedem a um usuário uma função em um projeto."
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: reference
---

# Funções

Uma função é um pacote de permissões. A **atribuição de função** é o ato de conceder uma função a um usuário em um projeto. O mesmo usuário pode ter funções diferentes em projetos diferentes; um usuário sem nenhuma função em um projeto não consegue nem vê-lo.

## Funções predefinidas {#built-in}

Todo projeto vem com quatro funções predefinidas que você pode atribuir sem definir nada personalizado:

| Função              | O que pode fazer                                                                                                                         |
| ------------------- | -------------------------------------------------------------------------------------------------------- |
| **`viewer`**        | Ler todos os recursos. Sem gravações, sem exclusões. Indicada para ferramentas de monitoramento, auditores.                              |
| **`editor`**        | Criar + atualizar a maioria dos recursos. Não pode gerenciar IAM (usuários, funções, chaves). Indicada para desenvolvedores no dia a dia. |
| **`admin`**         | Tudo o que `editor` pode fazer, mais IAM. Pode criar usuários, conceder/revogar funções, gerenciar chaves de API.                        |
| **`billing-admin`** | Ler faturas, trocar o método de pagamento, ver + aumentar a cota. Sem acesso a recursos. Indicada para o financeiro.                     |

A função `admin` **não** inclui `billing-admin`, e vice-versa. Por design — o engenheiro que opera a API não deveria ser também quem aprova a fatura.

## Funções granulares {#granular}

Além das quatro predefinidas, oferecemos funções granulares por recurso para os casos em que `editor` é demais:

- `vms:operator` — só criar / iniciar / parar / destruir VMs, sem rede
- `storage:operator` — gerenciar volumes, buckets, snapshots, backups
- `dns:admin` — gerenciamento completo de zonas DNS + registros; nada além disso
- `networking:admin` — redes, sub-redes, grupos de segurança, IPs flutuantes, LBs
- `databases:admin` — bancos de dados gerenciados + os backups deles

Você as atribui do mesmo jeito que as predefinidas, via `POST /v1/role-assignments`.

## Funções personalizadas {#custom}

Defina as suas em `POST /v1/roles` (fora da amostra mínima abaixo) listando as permissões que quer agrupar. Os nomes de permissão seguem o padrão `<resource>:<action>` — por exemplo, `vms:read`, `volumes:create`, `databases:snapshot`. O catálogo completo de permissões fica em `GET /v1/permissions`.

Casos de uso para funções personalizadas: "ler tudo, exceto faturamento" para um auditor de segurança; "gerenciar registros DNS, mas não zonas" para um time de marketing que é dono do conteúdo dos subdomínios, mas não da delegação da zona.

## Como as atribuições de função se combinam {#compose}

Um usuário pode ter várias atribuições de função em um projeto. O conjunto efetivo de permissões é a **união** — a lista de funções é aditiva, não multiplicativa. Conceder `viewer` + `vms:operator` ao mesmo usuário dá a ele leitura em tudo + escrita especificamente em VMs.

Revogar uma função não revoga as outras. Para tirar todo o acesso de um usuário, exclua cada atribuição, uma de cada vez, ou exclua o usuário (o que revoga todas as atribuições de forma atômica).

## Próximos passos {#next-steps}

- [Usuários](/docs/api/users) — a quem você concede funções.
- [Projetos](/docs/api/projects) — onde você concede funções.
- [Autenticação](/docs/authentication) — como as chaves de API se relacionam com as funções dos usuários.
