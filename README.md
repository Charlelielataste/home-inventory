# Inventaire maison

App mobile (React Native + Expo SDK 58) pour gérer l'inventaire de sa maison :
**pièces → meubles / rangements → objets avec quantités**. Cible : Android (testable sur iPhone).
Tout est stocké en local (SQLite), l'app fonctionne entièrement hors ligne.

## Démarrer

```bash
npm install
npx expo start
```

- **iPhone** : ouvrir le QR code avec l'app Expo Go (tous les modules utilisés sont inclus dans Expo Go).
  Ou en natif via Xcode : `npx expo run:ios --device`.
- **Android** : Expo Go, ou `npx expo run:android` (Android Studio requis).
- **APK / build final Android** : `npx eas-cli@latest build -p android --profile preview`
  (ajouter un profil `preview` avec `"android": { "buildType": "apk" }` dans `eas.json` pour obtenir un APK installable directement).

Vérifications : `npx tsc --noEmit`, `npx expo-doctor`.

## Fonctionnalités

- **Pièces** (avec bouton « Créer les pièces de base »), **rangements** (frigo, placard, armoire…), **objets**.
  Appui long sur une pièce / un rangement → renommer ou supprimer.
- **Catégories et sous-catégories** (ex. Alimentaire › Viande, Poisson, Épicerie sèche…), optionnelles.
- **Quantités + unités** : pièce, portion, paquet, g, kg, mL, L, cm, m. Boutons − / + directement dans la liste
  (le pas s'adapte à l'unité : 1 pièce, 100 g, 0,5 L…).
- **Autocomplétion hors ligne** : ton historique de saisie d'abord, puis un dictionnaire intégré d'environ 200 objets
  courants (unité et catégorie pré-remplies). Insensible aux accents.
- **Scan de code-barres** : Open Food Facts → Open Beauty Facts → Open Products Facts (gratuit, sans clé).
  Le résultat est mémorisé : un produit déjà scanné est reconnu même hors ligne.
- **Doublons** : ajouter un objet qui existe déjà dans le même rangement propose d'additionner les quantités.
- **Recherche globale** « où est-ce que j'ai rangé… ? » sur toute la maison.
- **Courses** : objets sous leur stock minimum (optionnel, par objet) → liste de courses partageable.
- **Péremption** : produits périmés / qui périment sous 7 jours.
- **Sauvegarde** : export / import JSON (partage vers Drive, mail…), puisque les données ne vivent que sur le téléphone.
- Design **noir et blanc** volontairement minimal : toutes les couleurs sont dans `src/ui/theme.ts`.

## Pourquoi pas d'API pour l'autocomplétion ?

La recherche texte d'Open Food Facts est limitée à 10 requêtes / minute et ne couvre que l'alimentaire :
inutilisable pour une suggestion à chaque frappe. La lecture par code-barres (100 req/min) est utilisée pour le scan.

## Structure

```
src/
  app/                 Écrans (Expo Router)
    (tabs)/            Maison, Rechercher, Courses, Péremption, Réglages
    room/[id].tsx      Rangements d'une pièce
    furniture/[id].tsx Objets d'un rangement
    item/[id].tsx      Formulaire objet (id = "new" pour créer)
  components/          Autocomplétion, scanner, sélecteur d'emplacement, ligne d'objet
  db/                  Schéma SQLite (PRAGMA user_version) et requêtes
  lib/                 Unités, dates, dictionnaire, Open Food Facts, sauvegarde
  ui/                  Thème et composants de base
```

Pour faire évoluer la base (pré-production) : modifier `SCHEMA` et incrémenter `DB_VERSION` dans `src/db/schema.ts`. La base locale est alors **effacée et recréée** au lancement suivant.
