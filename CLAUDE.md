# CLAUDE.md — Inventaire maison

Lire aussi `AGENTS.md` (règles Expo génériques : docs versionnées, `npx expo install`, CNG).

## Le produit

App mobile perso d'**inventaire de la maison**, nommée **« Chez Moi »** sur le téléphone (`app.json > name`). L'utilisateur décrit son logement en 3 niveaux :

1. **Pièces** (Cuisine, Salon, Garage…)
2. **Rangements / meubles** dans chaque pièce (Frigo, Placard, Armoire, Tiroir…) — appelés `furniture` dans le code
3. **Objets** dans chaque rangement, avec une **quantité** et une **unité**

- **Cible : Android uniquement.** iOS sert seulement à tester (iPhone via Expo Go ou Xcode) : ne pas ajouter de fonctionnalité spécifique iOS, mais l'app doit rester utilisable sur iPhone pour les tests.
- **100 % local et hors ligne** : aucune donnée ne quitte le téléphone, pas de compte, pas de backend.
- **Direction artistique « Village »** : cozy, chaleureuse, arrondie (esprit jeu de simulation de vie, sans reprendre d'assets existants). Fond crème, texte brun bois, accent **Lagon** (`#2E4A5E`), pastels derrière les illustrations, cartes et boutons avec une « épaisseur » en bas qui s'enfonce à l'appui (`depth()` / `sunk()` de `theme.ts`, une ombre décalée : jamais de `borderBottom`, qui s'amincit en croissant dans les coins arrondis). L'ombre ne prend pas de place : un élément opaque juste en dessous la masque (d'où `SectionTitle` transparent, opaque seulement avec `sticky`). Typo **Fredoka**. Toutes les couleurs, espacements et typos passent par `src/ui/theme.ts` ; ne jamais coder une couleur en dur dans un écran.
- Langue de l'UI : **français**, tutoiement.
- Langue du **code : anglais** — identifiants, composants, commentaires (y compris SQL). Seuls les textes affichés dans l'app (et les exemples qui les citent entre guillemets) restent en français.

## Stack

- Expo **SDK 58**, React Native 0.88, React 19.3, TypeScript strict, React Compiler activé (`app.json > experiments`)
- **Expo Router** (routes dans `src/app/`), typed routes activées
- **expo-sqlite** (base `inventaire.db`) — choisi plutôt qu'AsyncStorage/JSON car données relationnelles (cascade, requêtes transversales, écritures ciblées, transactions, migrations). SQL écrit à la main, pas d'ORM (Drizzle envisageable plus tard).
- expo-camera (scan code-barres), expo-file-system (nouvelle API `File` / `Paths`), expo-sharing, expo-document-picker
- expo-notifications : **notifications locales uniquement** (pas de push, pas de serveur). Fonctionne dans Expo Go Android (avertissement « push indisponible » en console : normal). Petite icône Android = `assets/images/notification-icon.png` (silhouette blanche, générée par `build-app-icons.mjs`).
- Icônes : composant unique `Icon` (`src/ui/icon.tsx`, rendu via `SvgXml` de react-native-svg). **Fluent Emoji Flat** (illustrations en couleur) en majorité, **Phosphor** pour les glyphes d'interface manquants (+, −, chevron, corbeille, partage…). Seules les icônes listées dans `scripts/build-icons.mjs` sont embarquées : ajouter une clé puis `node scripts/build-icons.mjs` (régénère `src/ui/icons-data.ts`, ne pas l'éditer à la main).
- Icône de l'app + splash : illustrations sources dans `assets/source/` (`icon.png` opaque fond Lagon, `icon-transparent.png` détourée). `node scripts/build-app-icons.mjs` (via `@resvg/resvg-js`, dev) régénère `assets/images/` : icône, couches de l'icône adaptative Android (sujet dans les 56 % centraux), icône monochrome (contours), splash (fond crème) et favicon.
- Police : `@expo-google-fonts/fredoka`, chargée dans `_layout.tsx` (splash maintenu jusqu'au chargement). Sur Android, une graisse = une famille : utiliser `fonts.*` / `font.*` de `theme.ts`, jamais `fontWeight`.
- Tous les modules natifs utilisés sont inclus dans **Expo Go** : garder ça vrai tant que possible (sinon il faudra un dev build).
- Pas de date picker natif : dates saisies en `JJ/MM/AAAA` + raccourcis (+3 j, +1 mois…).

## Commandes

```bash
npm install
npx expo start            # Expo Go sur le téléphone
npx tsc --noEmit          # typecheck (npm run typecheck) — à lancer avant de considérer une tâche finie
npx expo export --platform android   # vérifie que le bundle Android compile
```

## Arborescence

```
src/
  app/
    _layout.tsx            Chargement Fredoka + SQLiteProvider (onInit = migrate, enableChangeListener) + AlertsProvider + ThemeProvider + Stack racine
    (tabs)/_layout.tsx     Onglets JS (expo-router/js-tabs) : Chez moi, Rechercher, Courses, Péremption, Réglages ; pastilles de compteur ; appui sur une notification → onglet Péremption
    (tabs)/index.tsx       Bandeau d'alertes cliquable (une ligne par type) + grille de pièces (Tile), FAB +, appui long = renommer/supprimer, "Créer les pièces de base"
    (tabs)/search.tsx      Recherche d'OBJETS uniquement (nom, catégorie, notes) dans toute la maison
    (tabs)/shopping.tsx    Onglet Courses : objets en stock bas, liste partageable, panier par ligne (remise en stock) ; sélection → supprimer
    (tabs)/alerts.tsx      Onglet Péremption : périmés, bientôt périmés (7 j), congelés depuis 3 mois ; quantité affichée sans − / + (inutile ici) ; sélection → supprimer / ignorer
    (tabs)/settings.tsx    Stats, rappels (permission notifications), export/import JSON, vider l'historique de saisie, tout effacer
    room/[id].tsx          Rangements d'une pièce
    furniture/[id].tsx     Objets d'un rangement, boutons − / +, filtre si > 8 objets ; appui long = mode sélection → suppression groupée
    item/[id].tsx          Formulaire objet en modal ; id = "new" (+ param furnitureId) pour créer
    privacy.tsx            Politique de confidentialité (Réglages › À propos)
  components/
    autocomplete-input.tsx Champ nom d'objet + autocomplétion (historique puis dictionnaire)
    barcode-scanner.tsx    Modal caméra (EAN-13/8, UPC-A/E)
    location-picker.tsx    Choix / déplacement du rangement d'un objet (SectionList par pièce)
    item-row.tsx           Ligne objet réutilisée partout (quantité, badges, − / + via onChanged, action optionnelle)
    selection.tsx          Sélection multiple : useSelection() (état, en-tête, retour Android), SelectionBar, confirmDeleteItems()
  db/
    schema.ts              Schéma + version (PRAGMA user_version) ; base recréée si la version change
    queries.ts             Toutes les requêtes + types (Room, Furniture, Item, KnownProduct…)
  lib/
    units.ts               Unités, formatage "3 pièces" / "1,5 L", parseNumber (virgule acceptée)
    dates.ts               ISO <-> JJ/MM/AAAA, daysUntil, describeExpiry, EXPIRY_WARNING_DAYS = 7
    catalog.ts             Catégories, suggestions pièces/meubles, icônes (roomIcon, furnitureIcon, categoryIcon), dictionnaire objets
    text.ts                normalize() (minuscules sans accents, sans Intl), matchesWordStart(), filterByQuery(), plural(), formatLocation(), matchesItem()
    openfoodfacts.ts       Lookup code-barres OFF → Open Beauty Facts → Open Products Facts
    backup.ts              Export / import JSON
    use-query.ts           Hook useQuery(loader, key) : charge depuis SQLite et recharge au focus de l'écran
    alerts.tsx             AlertsProvider / useAlerts() / alertCounts() : alertes partagées (bandeau, pastilles), recalculées à chaque écriture SQLite et au retour au premier plan
    reminders.ts           Notifications locales : planReminders() (pur) + syncReminders(db) qui reprogramme tout
    privacy.ts             Texte de la politique de confidentialité (source unique : écran + page web)
  ui/
    theme.ts               Couleurs, tints pastel (tintFor), tons des badges, spacing, radius, fonts/font, card
    icon.tsx               Composant Icon (SVG) ; icons-data.ts = généré par scripts/build-icons.mjs
    components.tsx         Button, IconButton, Fab, TextField, Chip, ChipRow, ListRow, Tile, IconTile, Badge, SectionTitle,
                           Separator, EmptyState, SuggestionDropdown, PromptModal, CheckMark, Checkbox,
                           DialogHost, showDialog, showMessage, confirm, showRenameDeleteMenu
```

## Modèle de données (SQLite)

- `rooms(id, name, position, created_at)`
- `furniture(id, room_id → rooms ON DELETE CASCADE, name, position, created_at)`
- `items(id, furniture_id → furniture ON DELETE CASCADE, name, quantity REAL, unit, category, subcategory, min_quantity, expires_at 'AAAA-MM-JJ', frozen_at 'AAAA-MM-JJ', frozen_snoozed_until 'AAAA-MM-JJ', barcode, notes, created_at, updated_at)`
- `known_products(name PK COLLATE NOCASE, unit, category, subcategory, barcode, use_count, last_used)` : historique de saisie → alimente l'autocomplétion et sert de cache hors ligne des codes-barres déjà scannés. Mis à jour (upsert) à chaque enregistrement d'objet.

`PRAGMA foreign_keys = ON` est activé dans `migrate()` (indispensable pour les cascades).

**L'app est entre les mains de testeurs : leurs données doivent survivre à chaque mise à jour.**
- Schéma = **migrations incrémentales** dans `MIGRATIONS` (`schema.ts`), clé = version cible, version courante dans `PRAGMA user_version`. La v4 est la base (premier APK distribué) ; une nouvelle install l'exécute puis toutes les suivantes.
- Faire évoluer le schéma = **ajouter** une migration `N+1` (jamais modifier une migration déjà livrée dans un build). Préférer `ADD COLUMN` / `CREATE` ; changer une colonne = reconstruire la table (créer → copier → supprimer → renommer).
- Tester la montée de version depuis une base existante (pas seulement une install neuve).
- `backup.ts` : mettre à jour les colonnes exportées/importées ; l'import doit continuer à lire les anciennes sauvegardes (colonnes absentes → valeurs par défaut). Incrémenter `BACKUP_VERSION` seulement si le format change.
- Ne jamais changer `android.package` ni la clé de signature (gérée par EAS) : sinon impossible d'installer la mise à jour par-dessus. `versionCode` auto-incrémenté par EAS à chaque build.

## Règles métier

- **Unités** (volontairement peu nombreuses) : `pcs` (pièce), `portion`, `paquet`, `g`, `kg`, `ml`, `l`, `cm`, `m`. Les unités comptables s'accordent au pluriel, les unités de mesure affichent un symbole. Chaque unité a un `step` pour les boutons − / + (1, 100 g, 0,5 kg, 100 mL, 0,5 L, 10 cm, 1 m).
- **Catégories → sous-catégories** : liste fixe `CATEGORIES` + `SUBCATEGORIES[catégorie]` dans `catalog.ts` (ex. Alimentaire › Viande / Poisson / Épicerie sèche…). Sous-catégorie optionnelle, remise à null quand la catégorie change. Affichage via `formatCategory()` (« Alimentaire › Viande »). Le scan devine la sous-catégorie depuis les tags Open Food Facts quand c'est possible.
- **Congelé ≠ Surgelés** (choix utilisateur, garder les deux) : la case « Congelé » = produit frais mis au congélateur par l'utilisateur ; la catégorie « Surgelés » = produit acheté déjà surgelé.
- **Congelé** : case sous la date de péremption → `items.frozen_at` (date de congélation). Un objet congelé est exclu de l'onglet Péremption et affiche le badge « CONGELÉ » au lieu des badges de date ; la date de péremption est conservée. Cochée automatiquement quand l'objet est créé dans / déplacé vers un rangement dont le nom contient « congel » (`isFreezer()`).
- **Sortie du congélateur** : déplacer un objet congelé vers un rangement qui n'est pas un congélateur décoche « Congelé » et met la péremption à aujourd'hui + `THAWED_SHELF_DAYS` (2 j, recommandation 24-48 h après décongélation).
- **Rappel de congélation** : congelé depuis plus de `FREEZER_WARNING_MONTHS` (3) mois → section dédiée dans l'onglet Péremption + badge « CONGELÉ DEPUIS N MOIS ». Bouton « Ignorer » = `frozen_snoozed_until` à aujourd'hui + 3 mois (revient ensuite, indéfiniment). Le report est remis à zéro si `frozen_at` change (`updateItem`).
- Quantité jamais négative (`MAX(0, …)` en SQL). 0 = badge "ÉPUISÉ".
- **Alertes de l'accueil** (bandeau, une ligne cliquable par type, masqué si rien) : périmés, à finir bientôt, congelés depuis 3 mois → onglet Péremption ; à racheter → onglet Courses. Pastilles : Courses = stock bas, Péremption = périmés + bientôt + congelés.
- **Rappels (notifications locales)** à `REMINDER_HOUR` (9 h) : la veille de chaque péremption (ou le jour même s'il est trop tard pour la veille), et le jour où un produit atteint 3 mois au congélateur (ou la fin de son report). Objets regroupés par heure, 60 max (limite iOS 64). Reprogrammés entièrement à chaque changement de la base (`syncReminders`, ignoré si rien n'a changé). Permission demandée depuis Réglages uniquement. `DELETE` sans `WHERE` ne déclenche pas l'écouteur SQLite (truncate optimization) : appeler `useAlerts().refresh()` après « Tout effacer » / import.
- **Courses, remise en stock** : sur chaque ligne, − / + choisissent la quantité **achetée** (pas enregistrée, un pas de l'unité par défaut), le bouton « Ajouter » l'ajoute au stock (`ItemRow purchase` : commandes sur une ligne à part sous l'objet, via `ListRow footer`, pour laisser toute la largeur au texte ; à droite, le stock actuel « N en stock »). Un « J'ai acheté » groupé à quantité devinée (2 × minimum) a été essayé puis retiré : pas clair pour l'utilisateur.
- **Stock bas** si `min_quantity` défini et `quantity <= min_quantity` → onglet Courses + badge. Libellé du champ côté UI : « Stock minimum ».
- **Doublon** à la création : même nom (insensible à la casse) + même unité + même état congelé dans le même rangement → proposer "Additionner" / "Créer à part". « Additionner » (`mergeIntoItem`) ajoute la quantité, garde la date de péremption / congélation la plus proche et complète les champs vides.
- Noms d'objets capitalisés à l'enregistrement.
- **Sélection multiple** (rangement, Courses, Péremption ; `useSelection()` dans `components/selection.tsx`) : appui long sur un objet → mode sélection (cases à cocher, « Tout » / « Aucun » dans l'en-tête, barre d'actions en bas). Décocher le dernier, la croix, le retour Android ou quitter l'écran / l'onglet quittent le mode. Actions : « Supprimer » (confirmation listant les objets) partout ; « Ignorer (N) » sur les congelés sélectionnés (Péremption).
- Onglets : un écran qui change son titre d'en-tête (sélection) ne doit pas changer le libellé de l'onglet → `tabBarLabel` explicite dans `(tabs)/_layout.tsx`.
- Suppression d'une pièce ou d'un meuble = suppression en cascade, toujours précédée d'une confirmation qui annonce ce qui sera perdu.

## Autocomplétion

- **Objets** : 100 % hors ligne. Ordre : `known_products` (historique de l'utilisateur, trié par usage) puis dictionnaire intégré `CATALOG` (~200 objets, format `Nom|unité|Catégorie|Sous-catégorie` dans `catalog.ts`). Choisir une suggestion pré-remplit unité + catégorie + sous-catégorie.
- **Pièces / meubles** : `PromptModal` + `SuggestionDropdown` ; pour les meubles, les noms déjà utilisés dans la maison passent avant la liste intégrée.
- UX attendue par l'utilisateur : une **vraie liste déroulante qui se filtre pendant la frappe** (pas des chips/badges). La liste est rendue dans le flux (pas en position absolue) pour rester fiable dans un ScrollView.
- Pourquoi pas d'API : la recherche texte Open Food Facts est limitée à 10 req/min et ne couvre que l'alimentaire. L'API sert uniquement au **scan de code-barres** (lecture produit : 100 req/min par utilisateur). Le scan doit toujours dégrader proprement hors ligne.

## Conventions

- Composants UI de base uniquement depuis `@/ui/components` ; styles via `theme.ts`.
- Accès DB : uniquement via les fonctions de `src/db/queries.ts` (pas de SQL dans les écrans, sauf exception justifiée).
- Données d'écran : `useQuery(loader, key)` + `reload()` après une mutation.
- Comparaisons/recherches texte : toujours via `normalize()` (gère les accents sans dépendre d'Intl/Hermes).
- Recherche / autocomplétion **par début de mot uniquement** (`matchesWordStart()` dans `text.ts`) : « poul » trouve « Poulet », pas « Ampoules ». Le nom exact tapé reste proposé en tête des suggestions (pour pré-remplir unité et catégorie).
- **Jamais de popup native** (`Alert.alert` interdit) : dialogues maison via `showDialog({ title, message, buttons })`, `showMessage()`, `confirm()`, `showRenameDeleteMenu()` (`components.tsx`). Rendus par `<DialogHost />` (layout racine) ; un écran présenté en modal natif (fiche objet) monte son propre `<DialogHost />`, sinon rien ne s'affiche sur iOS. Styles de boutons : `primary` (Lagon), `destructive` (rouge), `default` (crème), `cancel` (discret, en bas, aussi déclenché par retour / appui hors de la carte).
- iOS 26 : la barre de navigation native est transparente + floue par défaut (liquid glass). Choix utilisateur : en-tête **opaque** (`headerTransparent: false` + `headerStyle` dans la Stack racine). Garder quand même `contentInsetAdjustmentBehavior="automatic"` sur les ScrollView/FlatList de la Stack (sans effet avec un en-tête opaque, utile si on y revient). `EmptyState` le gère déjà.
- Navigation : `router.push({ pathname: '/room/[id]', params: { id } })` (forme objet, compatible typed routes).
- Pas de nouvelle dépendance sans vérifier qu'elle est dans Expo Go et l'installer via `npx expo install`.

## Build et distribution

- **Politique de confidentialité** (obligatoire sur Google Play) : texte dans `src/lib/privacy.ts`, affiché dans l'app (`/privacy`) et publié sur GitHub Pages (`docs/privacy/index.html`, dépôt public, branche `main`, dossier `/docs`) → `PRIVACY_URL`. Après chaque modif du texte : `node scripts/build-privacy.mjs` (couleurs reprises de `theme.ts`), mettre à jour `PRIVACY_UPDATED`, commit + push. Si l'app se met à collecter ou envoyer quoi que ce soit, mettre à jour ce texte **et** le formulaire « Sécurité des données » de la Play Console.

- Projet EAS `@hawkcio/inventaire-maison`. APK testeurs : `npx eas-cli@latest build -p android --profile preview` (lien d'installation sur expo.dev). Profil `production` = AAB pour le Play Store (pas encore utilisé).

## Décisions prises avec l'utilisateur

- Onglet Rechercher conservé, **recherche limitée aux objets** (pas les pièces ni les meubles).
- Autocomplétion en liste déroulante pendant la saisie, pas de chips de suggestions.
- Direction artistique « Village » avec l'accent Lagon, illustrations Fluent Emoji en majorité + Phosphor pour le reste (choisie sur maquettes).

## Idées pour la suite (non faites)

- Mode sombre « soirée »
- Photos d'objets, réordonner pièces/meubles par glisser-déposer, déplacer un meuble vers une autre pièce (`moveFurniture` existe déjà dans `queries.ts`)
- Rappels : réglage de l'heure / du délai, interrupteur dans l'app (aujourd'hui : permission système)
