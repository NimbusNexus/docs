---
title: "Les adresses et la phrase"
description: "Pourquoi une adresse jetable refuse le courrier dont l’objet ne contient pas sa phrase, et ce qui distingue expiration, rétention et suppression."
publishedAt: 2026-08-18
updatedAt: 2026-10-27
kind: concept
---

# Les adresses et la phrase

Une adresse jetable est publique par construction : elle finit dans un formulaire d’inscription, dans un log de CI, peut-être dans une capture d’écran. Quiconque la voit peut lui écrire. Cette page décrit les deux mécanismes qui rendent cela sûr — la **phrase**, et le fait que les adresses **meurent**.

## La phrase {#phrase}

Une boîte du plan gratuit reçoit toujours un court token en plus de son adresse. Sur Starter, Pro et Custom, elle n’en reçoit un que si vous le demandez, avec `"phrase": true` à l’allocation ou dans un `PATCH` ultérieur. Une boîte avec une phrase n’accepte un message que si la phrase apparaît dans l’**objet** ; une boîte sans phrase accepte n’importe quel objet :

```text
Subject: nn-re89dr Your verification code   ← accepted
Subject: Your verification code             ← refused
```

La phrase n’est ni un mot de passe ni un secret — elle circule en clair dans une ligne d’objet. C’est plutôt une *gêne en forme de secret partagé* : une adresse divulguée n’est pas, à elle seule, une adresse utilisable.

Cette distinction, c’est le produit. Sans elle, une adresse jetable trouvée dans un log de CI public pourrait servir à créer des comptes sur d’autres services, à recevoir leurs e-mails de confirmation, et à remettre à quelqu’un un compte que vous ne voyez pas et que vous n’avez pas créé. L’adresse serait un générateur gratuit d’identités anonymes. Exiger la phrase signifie que quiconque détient l’adresse doit aussi avoir reçu la phrase par le même appel d’API que celui qui a émis l’adresse — ce qui n’est pas le cas de la personne qui aspire la sortie de votre build.

Cela signifie aussi que **vous contrôlez ce que l’adresse acceptera**. Un système testé que vous configurez mettra la phrase dans son objet parce que vous le lui avez demandé. Un expéditeur de passage ne le fera pas.

Où la mettre : n’importe où dans l’objet. La correspondance porte uniquement sur l’objet — une phrase dans le corps ne compte pas, car le corps est la partie qu’un attaquant peut le plus facilement remplir de n’importe quoi.

## Le refus est explicite {#refusal}

Le courrier qui enfreint une règle d’acceptation est refusé **pendant la conversation SMTP**, et non accepté puis caché :

- l’adresse est inconnue, expirée, supprimée ou désactivée ;
- la boîte a une phrase et l’objet ne la contient pas ;
- l’espace de travail a dépassé son quota mensuel ;
- le message dépasse 5 MiB.

C’est plus important qu’il n’y paraît. L’autre option — accepter, puis jeter discrètement — produit une boîte vide qui ressemble exactement à un expéditeur qui n’a jamais envoyé. Refuser à l’entrée signifie que l’expéditeur reçoit un rejet qu’il peut journaliser, et qu’une boîte vide dans votre test signifie que *rien n’a été envoyé*, ce qui est un autre bug que *quelque chose a été envoyé et rejeté*.

Le courrier refusé n’est jamais stocké et n’est jamais décompté de la consommation.

## Trois façons dont une adresse prend fin {#lifecycle}

Elles sont faciles à confondre et se comportent différemment.

| | Ce qui se passe | Réversible |
| --- | --- | --- |
| **Expiration** | La boîte atteint `expires_at`, son adresse est retirée, et son courrier stocké est supprimé. | Non |
| **Supprimer** | Vous y mettez fin plus tôt : **Delete inbox…** dans la console, ou `DELETE /v1/inboxes/{id}`. Retirée immédiatement, comme à l’expiration. | Non |
| **Désactiver** | L’adresse cesse d’accepter du courrier et la boîte conserve ce qu’elle contient déjà : **Disable** dans la console, ou `PATCH` avec `{"status": "disabled"}`. | Oui — réactivez-la |

Dans la console, ces actions se trouvent dans le menu ⋯ de la page de la boîte, avec **Rename…** et **Empty inbox…**, qui supprime le courrier de la boîte et conserve la boîte et son adresse. Les membres peuvent renommer, désactiver et activer une boîte ; seuls les propriétaires et les admins de l’espace de travail peuvent la vider et la supprimer. La page d’une boîte désactivée l’indique, avec un bouton **Enable**. La durée de vie d’une boîte est choisie à sa création et ne peut pas être modifiée ensuite ; une fois la boîte expirée ou supprimée, sa page affiche « This inbox no longer exists ».

Une adresse retirée n’est **jamais réattribuée**, ni à vous ni à personne : chaque adresse ayant existé est enregistrée, et une nouvelle adresse est comparée à ce registre avant d’être émise. C’est une propriété de sécurité plutôt qu’un détail d’implémentation — recycler une adresse jetable finirait par livrer la réinitialisation de mot de passe d’un inconnu dans l’exécution de test de quelqu’un d’autre. Le stock ne s’épuise pas : une adresse fait 12 caractères tirés d’un alphabet de 32 caractères, soit environ 1.15 × 10¹⁸ combinaisons.

Choisissez **désactiver** quand une suite de tests bombarde une adresse et que vous voulez que cela cesse pendant une heure. Choisissez **vider** quand vous voulez garder l’adresse et repartir sans aucun courrier. Choisissez **supprimer** quand vous avez terminé et voulez récupérer l’emplacement — les plans plafonnent le nombre de boîtes que vous pouvez détenir à la fois. Les anciennes versions de cette documentation, ainsi que le journal d’audit de l’API, appellent la suppression *release*.

## L’expiration n’est pas la rétention {#expiry-vs-retention}

Deux horloges différentes, et les confondre est la source habituelle du « mon message a disparu » :

- L’**expiration** (`expires_at`) indique combien de temps vit l’**adresse**.
- La **rétention** indique combien de temps un **message** accepté reste lisible, et elle est fixée par votre plan.

La plus courte l’emporte. Sur un plan avec une rétention de 24 heures, un message reçu aujourd’hui est illisible demain, même si l’adresse elle-même vit une semaine. Quand l’adresse expire, tout son contenu disparaît d’un coup, quelle que soit la rétention.

La suppression est réelle. Il n’y a ni archive ni restauration : un test qui fait une assertion sur du courrier plus ancien que sa fenêtre de rétention échouera d’une façon qui ressemble à un problème de livraison, alors que ce n’en est pas un.

## Les adresses vivent sur leur propre domaine {#domain}

Les adresses allouées sont sur un domaine de boîtes dédié, ni sur `{{ROOT_DOMAIN}}` ni sur le vôtre. C’est délibéré : un domaine qui accumule le trafic d’adresses jetables accumule la réputation qui va avec, et tenir celle-ci à l’écart du domaine d’où part votre vrai courrier vaut bien un enregistrement DNS de plus.

La conséquence pratique est que vous ne devez jamais déduire le domaine de l’adresse de celui du produit. Lisez `address` dans la réponse d’allocation et utilisez-la telle quelle.
