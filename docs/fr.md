# Vélos en libre-service (GBFS)

Les **vélos disponibles** et les **places libres** de vos stations de vélos en
libre-service, pour **n'importe quel réseau** qui publie ses données au
standard ouvert **GBFS** (General Bikeshare Feed Specification, versions 1.0
à 3.0) : Vélib' Métropole (Paris), Vélo'v (Lyon), Naolib (Nantes), V'lille,
VélôToulouse, Villo! (Bruxelles), Citi Bike (New York), BiciMAD (Madrid) et
un millier d'autres, recensés dans le catalogue officiel de MobilityData.
**Sans compte ni clé.**

Une ville qui a son intégration Gladys dédiée y sera peut-être mieux servie :
Tisséo (Toulouse, VélôToulouse compris), Le Vélo (Bordeaux), STM (Montréal,
BIXI compris), TCL (Lyon). Celle-ci est le complément générique, pour tous
les autres réseaux.

Cette intégration est un projet communautaire, sans lien avec MobilityData ni
avec aucun opérateur de vélos en libre-service. Elle a été testée sur les
vrais flux de cinq réseaux, pas encore sur beaucoup d'installations Gladys :
vos retours sont les bienvenus.

## Ce que vous obtenez

- **Un appareil par station surveillée** : vélos disponibles, vélos
  mécaniques et électriques (quand le réseau les distingue), places libres,
  et si la station est en service, permet de prendre un vélo, permet d'en
  rendre un.
- **Widget « Stations vélo »** : vos stations façon tableau d'affichage, ou
  des tuiles en direct pour une seule station.
- **Quatre déclencheurs de scène** : plus de vélos, vélos de retour, plus de
  places, places de retour, au nombre que vous choisissez.
- **Action de scène « Lire une station vélo »**, avec une phrase prête à
  envoyer (« Préfecture : 4 vélos, 29 places libres. »).
- Jusqu'à **5 réseaux** et **30 stations**.

## Prérequis

- Gladys Assistant **5.2.0** ou plus récent.
- Un accès à Internet depuis la machine Gladys (les flux sont en ligne).
- Pour la recherche autour de la maison : la **position de votre maison**
  renseignée dans Gladys (Paramètres → Maisons). L'intégration la demande à
  l'installation.

## Installation

1. Dans Gladys, ouvrez **Intégrations → Installer depuis GitHub**.
2. Saisissez `https://github.com/guim31/gladys-gbfs`.
3. Acceptez l'accès demandé (la position de vos maisons, utilisée seulement
   pour trouver les stations les plus proches).

## Configuration

### Réglages

- **Langue des textes** : noms des fonctionnalités, noms des stations (quand
  le réseau les traduit) et phrases envoyées aux scènes. Les noms de
  fonctionnalités sont figés à la création de l'appareil.
- **Fréquence de mise à jour** : 1, 2, 5 ou 10 minutes. L'intégration ne lit
  jamais un réseau plus vite que son `ttl` ne le permet (jusqu'à 5 minutes,
  voir « Données, rafraîchissement et volume »).

### Ajouter un réseau

1. Lancez **Chercher un réseau** avec un nom de réseau, une ville ou un code
   pays (`Vélib'`, `Lyon`, `BE`). Chaque résultat affiche son identifiant
   entre crochets, par exemple `Vélib' Metropole — Paris, FR [Paris] · GBFS 1.0`.
2. Lancez **Ajouter un réseau** avec cet identifiant (ou le nom exact).
   L'intégration lit la liste des stations, et vous dit combien elle en a
   trouvé et si elle distingue vélos mécaniques et électriques.

Un réseau absent du catalogue : donnez l'adresse de son `gbfs.json`. Le
catalogue recense aussi des trottinettes, des voitures et des vélos en
free-floating : seuls les systèmes **à stations** peuvent être ajoutés, et
ceux qui demandent une clé d'accès ne sont pas pris en charge.

### Ajouter une station

1. Lancez **Chercher une station** : vide, elle liste les dix stations les
   plus proches de la maison, avec leur distance et leurs vélos du moment ;
   avec un nom ou un numéro de station (les numéros Vélib' comme `16107`
   marchent), les stations qui correspondent.
2. Lancez **Ajouter une station** avec l'identifiant entre crochets.
3. Ouvrez l'onglet **Découverte** de l'intégration et créez l'appareil.

Avec plusieurs réseaux, remplissez le champ **Réseau** pour n'en chercher
qu'un. Avec plusieurs maisons, choisissez la **Maison** autour de laquelle
chercher.

### Retirer, vérifier les flux

- **Retirer** arrête de surveiller une station (par nom ou identifiant) ou
  tout un réseau avec ses stations. Les appareils restent dans Gladys jusqu'à
  ce que vous les supprimiez.
- **État** affiche chaque réseau : sa version GBFS, sa liste de stations,
  l'âge de la dernière lecture, le rythme, le volume téléchargé par heure,
  les stations surveillées et la dernière erreur.

## Appareils

### Station

| Fonctionnalité     | Type             | Signification                                           |
| ------------------ | ---------------- | ------------------------------------------------------- |
| Vélos disponibles  | compteur         | vélos que l'on peut prendre (trottinettes non comptées) |
| Vélos mécaniques   | compteur         | seulement quand le réseau les distingue                 |
| Vélos électriques  | compteur         | idem                                                    |
| Places libres      | compteur         | places pour rendre un vélo                              |
| Station en service | entrée (binaire) | 1 = installée (`is_installed`)                          |
| Location possible  | entrée (binaire) | 1 = on peut prendre un vélo                             |
| Retour possible    | entrée (binaire) | 1 = on peut rendre un vélo                              |

Les compteurs vont de 0 à la capacité de la station : une jauge ou un
graphique s'y cale.

## Widget du tableau de bord

**Stations vélo** : choisissez les stations à afficher (vide : toutes, dix au
plus). Chaque ligne affiche les vélos (mécaniques et électriques quand le
réseau les distingue) et les places
libres, en vert, en orange à deux vélos ou moins, en rouge sans vélo, en gris
hors service. Avec une seule station dont l'appareil est créé, le widget
affiche des tuiles en direct.

## Déclencheurs de scène

- **Plus de vélos à une station** : les vélos (tous, mécaniques ou
  électriques) descendent au nombre choisi ou en dessous (0, 1, 2, 3, 5 ou 10).
- **Vélos de retour à une station** : ils repassent au-dessus du nombre
  choisi.
- **Plus de places à une station** : les places libres descendent au nombre
  choisi ou en dessous.
- **Places de retour à une station** : elles repassent au-dessus.

Chaque déclencheur transmet à la scène le nom de la station, les vélos (tous,
mécaniques, électriques) et les places libres à ce moment-là. Les seuils
mécaniques et électriques ne se déclenchent que sur les réseaux qui les
distinguent.

## Action de scène

**Lire une station vélo** renvoie une phrase prête pour un message ou une
enceinte (« Benjamin Godard - Victor Hugo : 25 vélos (21 mécaniques, 4
électriques), 10 places libres. »), et des nombres utilisables dans une étape
« Continuer seulement si » : vélos, mécaniques, électriques, places, location
(1/0), retour (1/0).

## Exemples de scènes

- **Avant de partir au travail** : à 8 h en semaine, lire la station en bas
  de chez soi et envoyer la phrase sur Telegram.
- **Plus de vélo électrique** : « Plus de vélos », vélos électriques, au plus
  0, à votre station habituelle : une notification, pour partir un peu plus
  tôt.
- **Le retour du soir** : « Plus de places », au plus 2, à la station près du
  bureau : être prévenu avant d'y aller.

## Données, rafraîchissement et volume

- Le **catalogue** des réseaux (`systems.csv` de MobilityData, 180 Ko) n'est
  lu que pour une recherche ou un ajout, et gardé un jour.
- La **liste des stations** de chaque réseau est lue à l'ajout, puis au plus
  une fois par jour, et gardée dans le volume `/data` de l'intégration.
- L'**état des stations** est lu à la fréquence choisie, une minute au
  moins, jamais plus vite que le `ttl` annoncé par le réseau. Un `ttl` de
  plus de cinq minutes est plafonné : Vélib' annonce une heure pour des
  données rafraîchies chaque minute, il est lu toutes les 5 minutes. Quand le
  serveur le permet, un flux inchangé n'est pas téléchargé de nouveau.
- Volume : de quelques Ko par lecture (petits réseaux) à environ 1 Mo (Citi
  Bike) ; Vélib' pèse environ 460 Ko par lecture. L'action **État** affiche
  le volume par heure de vos réseaux.
- Un serveur qui répond « 429 Too Many Requests » ou « 503 » est laissé
  tranquille le temps qu'il demande.
- Les données appartiennent à chaque opérateur et sont publiées sous sa
  propre licence (souvent ODbL ou une licence ouverte) : vérifiez-la avant de
  les réutiliser ailleurs.

## Dépannage

- **« ne publie pas de stations »** : le système est en free-floating (vélos
  ou trottinettes garés n'importe où) : il n'a pas de station à surveiller.
- **« est illisible (… HTTP 404) »** : l'opérateur a déplacé ses flux.
  Cherchez de nouveau le réseau, ou donnez l'adresse actuelle de son
  `gbfs.json`.
- **Pas de fonctionnalités mécaniques/électriques** : le réseau ne les
  distingue pas dans son flux (Naolib, V'lille…), ou n'a que des vélos
  électriques.
- **Un appareil affiche de vieilles valeurs** : lancez **État** ; la dernière
  erreur dit pourquoi. Les états reviennent seuls dès que le flux répond.
- **La recherche autour de la maison est vide** : renseignez la position de
  votre maison dans Gladys, ou cherchez par nom.
- **`docker logs`** : discret par défaut ; mettez `LOG_LEVEL=debug` pour voir
  chaque lecture.

## Limites

- Stations seulement : les véhicules en free-floating (`free_bike_status`,
  `vehicle_status`) ne sont pas lus.
- Les flux qui demandent une clé ou un jeton ne sont pas pris en charge.
- Les noms et la liste des fonctionnalités sont fixés à la création de
  l'appareil : un réseau qui se met à distinguer les vélos plus tard propose
  « Mettre à jour » dans l'onglet Découverte.
- Jusqu'à 5 réseaux et 30 stations, dix lignes dans le widget.
- La qualité des données est celle de l'opérateur : certains réseaux ne
  mettent leur flux à jour que toutes les quelques minutes.

## Crédits

- [GBFS](https://github.com/MobilityData/gbfs) et son catalogue des systèmes :
  MobilityData et les contributeurs de GBFS (Apache 2.0 pour la
  spécification).
- Même usage que la plateforme `citybikes` de Home Assistant et
  l'intégration `gbfs` de HACS ; aucun code n'en est repris. Les stations vélo
  de l'intégration Tisséo en ont été le premier jet.
- Fixtures de test : vrais flux de Vélib' Métropole, Naolib, V'lille,
  Vélibéo et Citi Bike, réduits à quelques stations.
- Données des stations : chaque opérateur de réseau (Smovengo pour Vélib',
  JCDecaux, Ilévia, Lyft, Ecovélo…).
