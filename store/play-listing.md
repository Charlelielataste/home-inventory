# Fiche Play Store — Chez Moi

Textes à copier dans la Play Console et réponses aux questionnaires.
À tenir à jour si l'app change (nouvelle permission, envoi de données, pub…).

## Fiche principale (Croissance › Présentation sur le Store)

**Nom de l'appli** (30 caractères max)

```
Chez Moi – Inventaire maison
```

**Description courte** (80 caractères max)

```
Range ta maison : pièces, placards, objets, dates de péremption et courses.
```

**Description complète** (4000 caractères max)

```
Où est passée la deuxième boîte de thé ? Reste-t-il des piles ? Le poulet du congélateur, il date de quand ?

Chez Moi est un inventaire de ta maison, simple et chaleureux. Tu décris ton logement pièce par pièce, rangement par rangement, et tu sais toujours ce que tu as et où c'est rangé.

🏠 TA MAISON, PIÈCE PAR PIÈCE
• Crée tes pièces (cuisine, salon, garage…) et leurs rangements (frigo, placard, tiroir…)
• Ajoute tes objets avec une quantité et une unité (pièces, paquets, grammes, litres…)
• Ajuste les quantités d'un geste avec − et +
• Saisie rapide : suggestions pendant la frappe, catégorie et unité remplies pour toi

🔎 RETROUVE TOUT EN UN INSTANT
• Recherche dans toute la maison : tu sais tout de suite dans quel rangement se trouve un objet
• Déplace un objet d'un rangement à l'autre en deux appuis

📅 FINI LE GASPILLAGE
• Dates de péremption : les produits périmés ou à finir bientôt sont mis en avant
• Congélateur : note quand tu as congelé un produit, l'app te prévient après 3 mois
• Rappels par notification la veille d'une péremption

🛒 LISTE DE COURSES AUTOMATIQUE
• Fixe un stock minimum : quand il est atteint, l'objet arrive dans ta liste de courses
• Partage la liste en un appui (SMS, messagerie…)
• De retour des courses, remets en stock directement depuis la liste

📷 SCAN DE CODES-BARRES
• Scanne un produit pour remplir son nom et sa catégorie automatiquement (base ouverte Open Food Facts)

🔒 TES DONNÉES RESTENT CHEZ TOI
• Aucun compte, aucune publicité, aucun suivi
• Tout est enregistré sur ton téléphone et fonctionne hors ligne
• Sauvegarde et restauration de ton inventaire dans un fichier
```

**Catégorie** : Appli › Maison et habitat
**Tags** : inventaire, organisation, courses
**Coordonnées** : e-mail de contact obligatoire (affiché sur la fiche) → l'adresse dédiée du compte développeur. Site web : facultatif.
**Politique de confidentialité** : https://charlelielataste.github.io/home-inventory/privacy/

### Images

| Élément | Format | Statut |
|---|---|---|
| Icône | 512 × 512 PNG, 1 Mo max | `store/icon-512.png` |
| Image de présentation | 1024 × 500 PNG/JPG | à créer |
| Captures téléphone | 2 à 8, 16:9 ou 9:16, côté min. 320 px | à faire sur Android (accueil, rangement, fiche objet, Péremption, Courses) |

## Contenu de l'appli (Règles › Contenu de l'appli)

**Accès à l'appli** : toutes les fonctionnalités sont disponibles sans restriction (pas de connexion).

**Annonces** : Non, l'appli ne contient pas d'annonces.

**Classification du contenu** (questionnaire IARC)
- Catégorie : « Toutes les autres catégories d'applis » (utilitaire, productivité)
- Violence, sexualité, langage, drogues, jeux d'argent : Non partout
- Interaction entre utilisateurs / partage de contenu généré : Non
- Partage de la position : Non ; achats numériques : Non
- → classification attendue : PEGI 3 / Tout public

**Public cible** : 18 ans et plus (évite les obligations du programme Familles ; l'app n'est pas conçue pour les enfants). L'appli n'attire pas particulièrement les enfants : Non.

**Sécurité des données**
- L'appli collecte-t-elle ou partage-t-elle des types de données utilisateur obligatoires ? **Non.**
  - Justification : toutes les données restent sur l'appareil. Le scan envoie seulement le numéro de code-barres d'un produit à Open Food Facts : ce n'est pas une donnée utilisateur au sens de Google (pas de lien avec la personne ni l'appareil), et rien d'autre ne l'accompagne.
  - Les fichiers de sauvegarde et la liste partagée sont envoyés par l'utilisateur lui-même via le menu de partage du système : non concerné.
- Chiffrement en transit : sans objet (aucune donnée collectée). Requêtes Open Food Facts en HTTPS.
- Suppression des données : dans l'app (Réglages › Tout effacer) ou en désinstallant.

**Applis gouvernementales** : Non. **Fonctionnalités financières** : aucune. **Santé** : Non. **Appli d'actualités** : Non.

**Identifiant publicitaire** : Non (aucune pub ni SDK d'analyse).

## Publication

1. Build : `npx eas-cli@latest build -p android --profile production` (AAB, signé par EAS ; Google re-signe avec la clé Play App Signing).
2. Premier envoi : Tests › Tests internes › Créer une release → importer l'AAB à la main.
3. Testeurs : liste d'adresses e-mail (Gmail des testeurs) → lien d'acceptation à leur envoyer.
4. Passage APK → Play : les testeurs exportent leur sauvegarde (Réglages), désinstallent l'APK, installent depuis le Play Store, puis importent la sauvegarde (signatures différentes : impossible d'installer par-dessus).
5. Production (compte perso récent) : test fermé avec au moins 12 testeurs pendant 14 jours d'affilée.
