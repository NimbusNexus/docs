---
title: "CLI de Webhooks"
description: "nn-webhooks — um único binário estático para publicar eventos, gerenciar endpoints e esvaziar a dead-letter queue."
publishedAt: 2026-08-05
updatedAt: 2026-10-20
kind: cli
---

# CLI de Webhooks

`nn-webhooks` é a interface de linha de comando do [NimbusNexus Webhooks](/docs/product-webhooks). Um único binário estático — sem runtime, sem virtualenv, nada para instalar antes. Hoje é a única CLI da NimbusNexus; uma CLI para a Infraestrutura ainda não está disponível.

Esse é todo o motivo de ela ser escrita em Go. Um operador que está esvaziando uma dead-letter queue às 3 da manhã muitas vezes está em uma máquina sem nada instalado, e "primeiro instale o runtime de uma linguagem" não é um passo aceitável em um incidente.

## Instalar {#install}

A versão atual é **{{WEBHOOKS_CLI_VERSION}}**. Cada versão publicada no [repositório público webhooks-go](https://github.com/NimbusNexus/webhooks-go/releases) traz arquivos compactados para macOS, Linux e Windows em amd64 e arm64, com um `checksums.txt`, e o Homebrew instala esses mesmos arquivos.

No macOS, o Homebrew é o caminho mais curto. O tap distribui um cask, e o Homebrew só instala casks no macOS:

```bash
brew install nimbusnexus/tap/nn-webhooks
nn-webhooks version
```

No Linux, ou no macOS sem Homebrew, baixe o arquivo compactado, confira-o com os checksums da versão e coloque o binário no seu `PATH`. Defina `OS` como `linux` ou `darwin` e `ARCH` como `amd64` ou `arm64`:

```bash
VERSION={{WEBHOOKS_CLI_VERSION}}
OS=linux
ARCH=amd64
BASE=https://github.com/NimbusNexus/webhooks-go/releases/download/v$VERSION
curl -fsSLO "$BASE/nn-webhooks_${VERSION}_${OS}_${ARCH}.tar.gz"
curl -fsSLO "$BASE/checksums.txt"
shasum -a 256 --check --ignore-missing checksums.txt
tar -xzf "nn-webhooks_${VERSION}_${OS}_${ARCH}.tar.gz" nn-webhooks
sudo install -m 0755 nn-webhooks /usr/local/bin/nn-webhooks
nn-webhooks version
```

A etapa do checksum precisa imprimir `OK` para o arquivo compactado; pare por aí se isso não acontecer. O Windows usa os arquivos `.zip`: [Configurar a CLI](/docs/setup/cli#windows) traz os passos para PowerShell.

Com um toolchain de Go (1.25 ou mais recente), compile-a a partir do código-fonte em vez disso:

```bash
go install github.com/NimbusNexus/webhooks-go/cmd/nn-webhooks@latest
```

## Entrar {#sign-in}

```bash
nn-webhooks login         # opens your browser; approve, and the CLI is signed in
nn-webhooks whoami        # the workspace, key name, permissions and expiry
nn-webhooks logout        # revokes that key and removes the profile
```

`login` imprime um código curto e abre [{{ACCOUNT_BASE_URL}}/device]({{ACCOUNT_BASE_URL}}/device) no seu navegador. Entre como você costuma entrar, confira se o código na página é igual ao do seu terminal e aprove. A CLI então salva no perfil uma chave de API chamada `nn-webhooks on <your hostname>`. A chave vale por 90 dias e aparece em **API keys** no console, onde você pode revogá-la a qualquer momento.

Um proprietário ou admin do workspace aprova a solicitação e pode restringir as permissões dela (**Read & write**, **Publish** ou **Read**) ou limitar a chave a um projeto. Um membro vê a solicitação, mas não pode aprová-la: peça a um admin ou [configure](#configure) uma chave que um admin criou para você.

Só aprove um login que você mesmo iniciou. Um código que outra pessoa envia para você daria a ela acesso ao seu workspace.

Em uma máquina sem navegador, como uma sessão SSH ou um contêiner, execute `nn-webhooks login --no-browser` e abra o link impresso em qualquer dispositivo. O código vale por 15 minutos. Entrar de novo substitui a chave do perfil e revoga a antiga.

## Configurar {#configure}

`configure` salva uma chave que você já tem, como uma que um admin gerou no console para a CI:

```bash
nn-webhooks configure     # prompts for the API URL and key
nn-webhooks whoami        # what would be used, and where it came from
```

`nn-webhooks keys create` e `keys revoke` ainda estão no binário e ainda aparecem no `--help`, mas as rotas `/v1/api-keys` por trás deles foram removidas, então os dois agora falham com um `404`. Gere uma chave no console da sua conta NimbusNexus, em **API keys**, escolhendo **Webhooks** como produto — veja [Como obter acesso](/docs/product-webhooks#access). Uma chave `whsk_…` de antes da mudança não autentica mais, então um perfil que ainda tenha uma precisa ser reconfigurado com uma substituta.

As credenciais ficam em `$XDG_CONFIG_HOME/nn-webhooks/credentials.json` — ou em `~/.config/nn-webhooks/credentials.json` quando `XDG_CONFIG_HOME` não está definida, o que é o padrão no macOS —, com modo `0600`, como **perfis nomeados**, então uma segunda implantação é só uma flag, em vez de sobrescrever a primeira:

```bash
nn-webhooks --profile staging configure --url {{WEBHOOKS_BASE_URL}}
nn-webhooks --profile staging endpoints list
```

Para CI, dispense o arquivo completamente:

```bash
export NN_WEBHOOKS_URL={{WEBHOOKS_BASE_URL}}
export NN_WEBHOOKS_API_KEY="<your-api-key>"
nn-webhooks deliveries list --status dead
```

A precedência é `--api-key`, depois `$NN_WEBHOOKS_API_KEY`, depois o perfil — e `whoami` informa **qual deles venceu**. Isso importa mais do que parece: uma variável de ambiente antiga encobrindo em silêncio o perfil que você acabou de gravar é a confusão mais comum, e um simples "configured" não consegue explicá-la.

A chave em si nunca é impressa, só os últimos quatro caracteres dela. A saída de um comando de diagnóstico é exatamente o que acaba colado em um chamado de suporte.

## Comandos {#commands}

```bash
nn-webhooks publish deploy.completed --data '{"id":1}' --idempotency-key deploy-1

nn-webhooks endpoints list
nn-webhooks endpoints create --url https://example.com/hook --subscribe prefix:deploy.
nn-webhooks endpoints get ep_123
nn-webhooks endpoints update ep_123 --set max_attempts=10 --set status=disabled
nn-webhooks endpoints replace-subscriptions ep_123 --subscribe exact:deploy.completed --subscribe suffix:.failed
nn-webhooks endpoints rotate-secret ep_123
nn-webhooks endpoints enable ep_123

nn-webhooks deliveries list --status dead
nn-webhooks deliveries redeliver dlv_456

nn-webhooks verify --secret whsec_... --signature sha256=... --timestamp 1785984800 < body.json
```

As inscrições são passadas como `kind:pattern`, repetíveis — `--subscribe prefix:deploy.` ou
`--subscribe exact:deploy.completed`. Os valores passados a `--set` são interpretados como JSON e, se isso
não for possível, como string, e `null` limpa um campo.

`update` não consegue alterar inscrições, porque o webhookd as ignora em um PATCH: `replace-subscriptions` define a lista inteira de uma vez, substituindo o que havia, e `--none` remove todas as inscrições do endpoint.

Tudo imprime JSON, então a saída vai direto para o `jq` sem uma flag `--format` para lembrar:

```bash
nn-webhooks deliveries list --status dead | jq -r '.items[].id' | \
  xargs -n1 nn-webhooks deliveries redeliver
```

`nn-webhooks verify` verifica um webhook que você recebeu — útil para confirmar que a rejeição de um handler é por causa da assinatura, e não do tratamento do corpo pelo framework, que é o culpado mais comum. Passe `--timestamp`: sem ele, o HMAC é calculado só sobre o corpo, o que nunca corresponde a uma entrega real, então toda verificação falha. O comando imprime `ok`/`failed` em vez de JSON e termina com código de saída 0/1.

## Versões {#versions}

```bash
nn-webhooks version
```

São informados dois números, e é legítimo que eles sejam diferentes:

- `version` — a versão de onde este binário veio, gravada no momento do build
- `sdk` — a biblioteca cliente compilada nele

Um binário compilado a partir do código-fonte não tem uma tag para indicar, então ele informa a versão do SDK com o sufixo `+source`, em vez de se apresentar como uma versão publicada.

## Próximos passos {#next-steps}

- [SDKs](/docs/product-webhooks/sdks) — as mesmas operações a partir do código da aplicação.
- [Início rápido](/docs/product-webhooks/quickstart) — o fluxo que estes comandos automatizam.
- [Verificação de assinatura](/docs/product-webhooks/signatures) — o que `nn-webhooks verify` verifica.
- [Visão geral de Webhooks](/docs/product-webhooks) — objetos e semântica de entrega.
