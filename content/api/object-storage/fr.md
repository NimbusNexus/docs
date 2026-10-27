---
title: "Stockage objet"
description: "Buckets compatibles S3, avec trois classes de stockage et un transfert intra-région gratuit vers les VM."
publishedAt: 2026-05-19
updatedAt: 2026-05-19
kind: reference
---

# Stockage objet

Le stockage objet NimbusNexus expose l’**API AWS S3**. Les outils et bibliothèques existants — la CLI `aws s3`, boto3, les SDK officiels Java/Go/Node, tous les frameworks qui parlent S3 — fonctionnent tels quels dès que vous les faites pointer vers notre endpoint et que vous leur fournissez nos identifiants.

## Ce qui est compatible S3, ce qui ne l’est pas {#compat}

Nous implémentons les opérations qu’utilisent 90 % des clients S3 :

- CRUD des buckets (`PutBucket`, `GetBucket`, `DeleteBucket`)
- CRUD des objets (`PutObject`, `GetObject`, `DeleteObject`, `HeadObject`, `ListObjects`/`ListObjectsV2`)
- Upload multipart (`CreateMultipartUpload`, `UploadPart`, `CompleteMultipartUpload`)
- URL présignées (sig v4)
- Métadonnées d’objet, content-type, headers personnalisés
- Chiffrement côté serveur (toujours actif, AES-256)

Nous n’implémentons **pas** :

- L’IAM propre à AWS (nous avons le nôtre — utilisez le modèle de token Bearer de la page [Authentification](/docs/authentication) pour l’API de gestion ; les identifiants S3 sont émis séparément).
- S3 Object Lock / la conformité WORM (prévu pour Q4 2026).
- S3 Select (requêtes côté serveur).
- La réplication inter-région via l’API S3 (nous la proposons plutôt via l’API de gestion, avec une tarification plus lisible).

Si votre application utilise une fonctionnalité S3 qui ne figure pas dans la liste prise en charge, elle reçoit un `501 Not Implemented` avec le nom de l’opération dans `error.code`. Passez à l’équivalent pris en charge ou ouvrez une demande de fonctionnalité.

## Classes de stockage {#classes}

Trois classes, choisies à l’écriture de l’objet (ou définies par défaut pour chaque bucket) :

| Classe | Par GB-mois | Latence du premier octet | Durée minimale de stockage | Quand l’utiliser |
| --- | --- | --- | --- | --- |
| `standard` | \$0.013 | <50 ms | Aucune | Données chaudes — ressources web, lectures fréquentes, tout ce qui est servi en direct. |
| `ia` | \$0.007 | <50 ms | 30 jours | « Infrequent access » — consulté de temps en temps, mais vous voulez y accéder rapidement quand c’est le cas. Mêmes performances de récupération que Standard, la moitié du tarif de stockage, des frais de récupération par GB. |
| `cold` | \$0.004 | 1–60 minutes | 90 jours | Archive — sauvegardes, logs bruts, rétention pour la conformité. Moins cher à conserver, plus lent à récupérer. |

Durée minimale de stockage signifie : si vous supprimez un objet avant la fin de la fenêtre minimale, vous payez le tarif par GB pour le reste de la fenêtre. C’est tout le sens du « infrequent » d’IA : bon marché si vous laissez les objets en place, cher si vous les renouvelez sans cesse.

Pour un besoin d’archivage pur, où vous ne lisez presque jamais les données, voir [Stockage à froid]({{BASE_URL}}/cold-storage) — un produit d’archivage dédié aux tarifs encore plus bas (\$0.004/GB-mois forfaitaire, plus les frais de récupération).

## L’egress, ce qui change vraiment {#egress}

La plus grande différence avec AWS S3, c’est **la façon dont l’egress est facturé** :

- VM ↔ stockage objet **dans la même région** : **gratuit**, toujours. C’est par là que passe l’essentiel du trafic de la plupart des charges de travail — vos VM parlent à vos buckets — et nous ne le facturons pas. Egress effectif pour le trafic de production qui reste dans une seule région : \$0.
- Egress vers l’internet public : \$0.009/GB, avec **1 TB gratuit par mois** et par projet. Pour comparaison, AWS S3 facture \$0.09/GB pour les 10 premiers TB.
- Egress inter-région : \$0.005/GB. Moins cher que l’egress vers l’internet public, car le trafic passe par notre backbone et non par l’internet ouvert.

La mention « transfert intra-région gratuit vers les VM » de la page marketing est un véritable engagement d’architecture, pas une promotion. Le but est de rendre économiques les architectures multi-tiers (le stockage objet comme source de vérité, avec devant lui des VM qui lisent et servent les données).

## Nommage des buckets {#naming}

Les noms de bucket sont **uniques au niveau mondial, pour tous les tenants NimbusNexus** — même règle qu’AWS. Compatibles DNS : minuscules, 3–63 caractères, pas de tirets bas, pas de tiret en début ni en fin. Le squatting de noms de bucket est la principale raison de réserver tôt les noms importants.

Le nom du bucket apparaît dans l’URL : `https://<bucket>.{{S3_HOST_US_EAST_1}}/<key>`, ou en style chemin, `{{S3_ENDPOINT_US_EAST_1}}/<bucket>/<key>`. Les deux styles fonctionnent ; les clients SDK choisissent l’un ou l’autre selon leur configuration.

## Listage, pagination, performances {#listing}

`ListObjectsV2` renvoie jusqu’à 1,000 clés par requête, triées par ordre lexicographique de clé. Au-delà de 1,000, paginez avec `continuation_token` — comme dans S3.

Pour les buckets très larges (des millions de clés), utilisez le **listage avec délimiteur** : passez `delimiter=/` pour obtenir un listage de type répertoire, où les clés sont regroupées par préfixe. Lister un « répertoire » avec un délimiteur ne parcourt que ses enfants directs, pas tout le bucket.

Dans une réponse de listage, les objets de classe Cold sont renvoyés exactement comme les objets Standard / IA — le listage ne déclenche pas de récupération, seul `GetObject` le fait. Vous pouvez parcourir gratuitement un bucket Cold de 100M objets ; restaurer un objet depuis Cold a son propre coût par GB.

## Étapes suivantes {#next-steps}

- [Authentification](/docs/authentication) — l’authentification par token Bearer pour l’API de gestion. Les identifiants S3 (clé d’accès + clé secrète) sont émis séparément via l’API de gestion.
- [Stockage en bloc](/docs/api/block-storage) — quand vous voulez un système de fichiers plutôt qu’un stockage clé-valeur, ou que vous avez besoin de la sémantique POSIX.
- [Éditeur Mosaic]({{BASE_URL}}/products/mosaic) — éditeur dans le navigateur pour les fichiers YAML/JSON/Markdown de vos buckets. Gratuit avec chaque compte de stockage.
