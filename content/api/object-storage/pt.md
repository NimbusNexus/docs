---
title: "Armazenamento de objetos"
description: "Contêineres e objetos do seu projeto, com opções de leitura pública e credenciais de curta duração."
publishedAt: 2026-05-19
updatedAt: 2026-11-03
kind: reference
---

# Armazenamento de objetos

O armazenamento de objetos da NimbusNexus guarda arquivos como objetos em contêineres que pertencem ao seu projeto. Você gerencia os dois por `/api/v1/object_storage/`, com as mesmas credenciais do resto da API.

## Contêineres {#containers}

`POST /api/v1/object_storage/` cria um contêiner. Defina `public_read: true` para deixar qualquer pessoa ler objetos individuais cuja URL ela conheça, e acrescente `public_listing: true` para deixar qualquer pessoa listar também o conteúdo do contêiner; `public_listing` sem `public_read` retorna `400`. Um nome que já existe retorna `409`.

`GET /api/v1/object_storage/` lista os seus contêineres com o `bytes` e o `count` de cada um. `PATCH /api/v1/object_storage/{container_name}` atualiza os metadados de um contêiner, e `DELETE /api/v1/object_storage/{container_name}` exclui um contêiner vazio; um contêiner que ainda tem objetos retorna `409`.

## Nomes de contêineres {#naming}

Um nome de contêiner tem de 3 a 63 caracteres entre letras minúsculas, dígitos e hífens, e começa e termina com uma letra ou um dígito. Sublinhados, pontos e espaços não são permitidos, nem um nome formatado como um endereço IP.

## Objetos {#objects}

- `POST /api/v1/object_storage/{container_name}/objects` envia um novo objeto como `file` multipart, com o nome `object_name` ou, sem ele, com o nome do arquivo. Um nome que já existe retorna `409`.
- `PUT /api/v1/object_storage/{container_name}/objects/{object_name}/content` substitui o conteúdo de um objeto.
- `GET /api/v1/object_storage/{container_name}/objects/{object_name}/content` baixa o objeto: texto como UTF-8, conteúdo binário codificado em base64.
- `GET` e `PATCH /api/v1/object_storage/{container_name}/objects/{object_name}` leem e atualizam os metadados dele, e `DELETE` no mesmo caminho o exclui.
- `POST /api/v1/object_storage/{container_name}/objects/{object_name}/copy` e `/move` copiam ou movem o objeto para um novo nome ou para outro contêiner.

Um nome de objeto pode conter `/`, que é lido como um caminho de pastas.

## Listagem e paginação {#listing}

`GET /api/v1/object_storage/{container_name}/objects` lista os objetos de um contêiner. Pagine com `limit` e `marker` (o último nome que você viu), ou defina `full_listing=true` para receber todos em uma única resposta. `prefix` mantém só os nomes que começam com ele.

Passe `delimiter=/` para uma listagem no estilo de pastas: os objetos deste nível vêm em `objects`, e os prefixos um nível abaixo, em `subdirs`.

## Credenciais de curta duração {#credentials}

`POST /api/v1/object_storage/credentials` emite uma credencial de curta duração, com escopo de projeto, para o projeto do escopo atual da sua sessão, e retorna o `trust_id` e o `expires_at` dela. Você pode pedir uma duração com `ttl_seconds`; o servidor impõe um teto. Um editor independente envia o `trust_id` em um header `X-Trust-Id` nas chamadas seguintes ao armazenamento de objetos e, assim, chega ao armazenamento do projeto sem ter o seu token completo nem nenhum segredo duradouro; cada chamada continua sendo autenticada normalmente. `DELETE /api/v1/object_storage/credentials/{trust_id}` a revoga.

## Próximos passos {#next-steps}

- [Autenticação](/docs/authentication) — as chaves de API vão no header `X-API-Key`.
- [Armazenamento em blocos](/docs/api/block-storage) — quando você quer um sistema de arquivos em vez de um armazenamento chave-valor, ou precisa de semântica POSIX.
- [Editor Mosaic]({{BASE_URL}}/products/mosaic) — editor no navegador para arquivos YAML/JSON/Markdown dentro dos seus contêineres.
