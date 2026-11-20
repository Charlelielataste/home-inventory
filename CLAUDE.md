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
- **Sons et vibrations** : expo-audio (effets courts, `playsInSilentMode: false` = muets en silencieux / vibreur, `mixWithOthers` = ne coupe jamais la musique) + expo-haptics. Tout passe par `giveFeedback(kind)` de `src/lib/feedback.ts`. Sons dans `assets/sounds/` (`.m4a` / `.mp3` : jamais d'`.ogg`, illisible sur iOS ; conversion avec `afconvert -f m4af -d aac`).
- Icônes : composant unique `Icon` (`src/ui/icon.tsx`, rendu via `SvgXml` de react-native-svg). **Fluent Emoji Flat** (illustrations en couleur) en majorité, **Phosphor** pour les glyphes d'interface manquants (+, −, chevron, corbeille, partage…). Seules les icônes listées dans `scripts/build-icons.mjs` sont embarquées : ajouter une clé puis `node scripts/build-icons.mjs` (régénère `src/ui/icons-data.ts`, ne pas l'éditer à la main). La grille « Personnalisé » propose la liste ordonnée `src/ui/icon-choices.ts` (illustrations Fluent uniquement, chacune avec un libellé français lu par le lecteur d’écran).
- Icône de l'app + splash : illustrations sources dans `assets/source/` (`icon.png` opaque fond Lagon, `icon-transparent.png` détourée). `node scripts/build-app-icons.mjs` (via `@resvg/resvg-js`, dev) régénère `assets/images/` : icône, couches de l'icône adaptative Android (sujet dans les 56 % centraux), icône monochrome (contours), splash (fond crème) et favicon.
- Police : `@expo-google-fonts/fredoka`, chargée dans `_layout.tsx` (splash maintenu jusqu'au chargement). Sur Android, une graisse = une famille : utiliser `fonts.*` / `font.*` de `theme.ts`, jamais `fontWeight`.
- Tous les modules natifs utilisés sont inclus dans **Expo Go** : garder ça vrai tant que possible (sinon il faudra un dev build).
- Pas de date picker natif : dates saisies en `JJ/MM/AAAA` + raccourcis (+3 j, +1 mois…).

## Commandes

```bash
npm install
npx expo start            # Expo Go sur le téléphone
npx tsc --noEmit          # typecheck (npm run typecheck) — à lancer avant de considérer une tâche finie
npm run format            # Prettier sur tout le projet (npm run format:check pour vérifier sans écrire)
npx expo export --platform android   # vérifie que le bundle Android compile
```

## Arborescence

```
src/
  app/
    _layout.tsx            Chargement Fredoka + SQLiteProvider (onInit = migrate, enableChangeListener) + AlertsProvider + ThemeProvider + Stack racine
    (tabs)/_layout.tsx     Onglets JS (expo-router/js-tabs) : Chez moi, Rechercher, Courses, Péremption, Réglages ; pastilles de compteur ; appui sur une notification → onglet Péremption
    (tabs)/index.tsx       Bandeau d'alertes cliquable (une ligne par type : péremption, dates manquantes) + pièces dans leur ordre en tuiles (`RoomTile`, grille `flexWrap` 2 colonnes) ; appui = tiroir de la pièce (`RoomDrawer`) ; une pièce créée ou un rangement ajouté ouvre / rouvre ce tiroir (ScrollView, pas de liste virtualisée) ; FAB + = nouvelle pièce ; "Créer les pièces de base"
    (tabs)/search.tsx      Recherche d'OBJETS uniquement (nom, catégorie, notes) dans toute la maison (cartes `ItemCard`, emplacement dans les détails)
    (tabs)/shopping.tsx    Onglet Courses : objets en stock bas, liste partageable, panier par ligne (remise en stock) ; sélection → supprimer
    (tabs)/alerts.tsx      Onglet Péremption : périmés, roue crantée dans l'en-tête = modale des délais de rappel (`ReminderSettingsModal`), périmés, bientôt périmés (N jours = délai choisi), congelés depuis N mois (délai choisi) ; quantité affichée sans − / + (inutile ici) ; sélection → supprimer / ignorer
    (tabs)/settings.tsx    Stats, rappels (permission notifications ; les délais se règlent dans l'onglet Péremption), export/import JSON, vider l'historique de saisie, tout effacer
    furniture/[id].tsx     Objets d'un rangement (pièce en sous-titre de l'en-tête) en cartes `ItemCard` repliables, filtre si > 8 objets ; appui long = mode sélection → suppression groupée ; bouton code-barres rond à gauche du + (et « Scanner un produit » quand le rangement est vide) = scan rapide (pas dans l'en-tête : choix utilisateur)
    item/[id].tsx          Formulaire objet en modal ; id = "new" (+ param furnitureId) pour créer. Orchestration seulement (chargement, produit choisi, déplacement, enregistrement anti double appui, suppression) : sections et hooks dans `components/item-form/`
    undated.tsx            « Dates manquantes » : objets datés seulement en partie (2 × 27/11 + 1 sans date), atteint UNIQUEMENT par le bandeau de l'accueil ; appui = fiche (déjà en mode lots)
    privacy.tsx            Politique de confidentialité (Réglages › À propos)
  components/
    item-form/             Morceaux de la fiche objet : use-stock-fields (quantité / contenance / reste), use-barcode-lookup (scan, historique puis Open Food Facts, même code / autre produit), stock-section, category-picker, expiry-section (date unique, lots, congelé), resolve-duplicate (dialogues « Additionner » / « Créer à part » → 'merge' | 'separate' | 'cancel')
    batch-editor.tsx       Lots de dates de la fiche (`BatchEditor` : une ligne par date, « N sans date », modale nombre + date) ; `RestockDateModal` = date demandée à la remise en stock depuis Courses ; `EXPIRY_SHORTCUTS`
    autocomplete-input.tsx Champ nom d'objet = NameField + suggestions (historique puis dictionnaire)
    barcode-scanner.tsx    Modal caméra (EAN-13/8, UPC-A/E) ; `continuous` = reste ouverte (scan rapide), un même code n'est relu qu'après 1,2 s hors de la caméra ; `status` = résultat affiché sur l'image
    location-picker.tsx    Choix / déplacement du rangement d'un objet (SectionList par pièce)
    room-tile.tsx          Tuile d'une pièce de l'accueil (`RoomTile`, demi-largeur : grande icône, nom, résumé `roomSummary()`) : appui = son tiroir, appui long = modifier (nom + icône) / supprimer (pas de bouton ⋯ : choix utilisateur pour limiter les boutons visibles)
    room-drawer.tsx        Tiroir d'une pièce (`RoomDrawer`, choix utilisateur après l'essai de tuiles qui se déplient en lignes, abandonné : animation jamais propre) : monte du bas sur fond assombri, en-tête de la pièce, rangements en lignes (appui = ses objets ; pas d’appui long : modifier / supprimer depuis l’écran du rangement, choix utilisateur) + « Ajouter un rangement » ; fermé par le fond, le retour ou en le glissant vers le bas (poignée, en-tête, ou n'importe où une fois la liste en haut). L'action choisie s'exécute une fois le tiroir fermé (iOS : pas d'écran ni de modale tant qu'une modale est affichée). `Modal` maison et non `ModalFrame` (fondu centré) : il faut la montée du bas et le glissement ; même fond, mêmes fermetures. Enchaînement de modales : toujours attendre `onDismiss` sur iOS (tiroir, `PromptModal`, scanner), jamais un délai fixe
    item-card.tsx          Carte objet repliable (rangement, recherche ; ressort `useFold`) : repliée = nom sur 2 lignes, badges, quantité en lecture seule (« 2 pcs · 800 g », `formatPieces()`), chevron rond ; couleur animée (carte `surface` repliée → panneau `panel` dépliée, touches `light` dessus) ; dépliée = − / + sur la quantité, catégorie et sous-catégorie en `Chip` en lecture seule (comme la fiche objet), bordure 2 px comme les tuiles de pièce, détails (contenance, stock minimum, congelé le, péremption, notes…) et en bas « Modifier » (primary, Lagon) puis, à droite, « Épuisé » (variant `warn`, terracotta, sans icône (comme « Modifier » : choix utilisateur), comme le badge qui apparaît ensuite ; met quantité et reste à 0 en un appui, sans confirmation : − / + pour corriger ; libellé neutre choisi par l'utilisateur, valable pour une chaise comme pour du riz : pas « J’en ai plus » (lu « plus » = +), « Tout fini » (trop nourriture) ni « Mettre à 0 ») (la carte n'ouvre plus la fiche : un appui la plie / déplie, choix utilisateur)
    item-row.tsx           Ligne objet des onglets Courses et Péremption (appui = fiche ; quantité, badges, `showLocation`, action optionnelle)
    reminder-settings.tsx  Modale des délais de rappel (péremption 1-10 j, congélateur 1-6 mois ; − / +, « Enregistrer »), ouverte par la roue crantée de l'onglet Péremption ; textes qui disent que les délais règlent l'onglet ET les notifications
    selection.tsx          Sélection multiple : useSelection(items visibles) (état, `chosen`, en-tête, retour Android ; décoche ce qui n'est plus affiché), SelectionBar, DeleteSelectedButton
    tab-header-button.tsx  Bouton rond de l'en-tête d'un onglet (+ de Courses, roue crantée de Péremption)
  db/
    schema.ts              Schéma + version (PRAGMA user_version) ; base recréée si la version change
    queries.ts             Toutes les requêtes + types (Room, Furniture, Item, KnownProduct…)
  lib/
    units.ts               Unités de contenance, formatStock() « 2 · 1 kg », formatSize(), formatMeasure() (g → kg auto), parseNumber (virgule acceptée), parseCount (entiers)
    stock-form.ts          Fiche objet (pur) : lecture des champs de stock, état initial, withQuantity, pas du reste / de la contenance, buildItemInput() (validation → { input } | { error })
    freezer.ts             Règle congélateur (pur) : locationChange() (entrée = cochée, sortie = décochée + péremption J+THAWED_SHELF_DAYS, retour au congélateur = dates d'origine restaurées), thawNote()
    batches.ts             Lots de péremption (pur) : cleanBatches, fitBatches (retire les plus proches d'abord), undatedCount, parseBatches, isSingleDate
    dates.ts               ISO <-> JJ/MM/AAAA, daysUntil, describeExpiry, monthsBetween, monthsLaterIso (même seuil que l'onglet Péremption) ; réexporte les délais de reminder-prefs
    catalog.ts             Catégories (+ DEFAULT_CATEGORY, champs péremption / congelé par catégorie), suggestions pièces/meubles, icônes (roomIcon, furnitureIcon, categoryIcon), dictionnaire objets
    text.ts                normalize() (minuscules sans accents, sans Intl), WORD_SEPARATORS, matchesWordStart(), rankByQuery() / filterByQuery(), plural(), willBeDeleted(), formatLocation(), matchesItem()
    openfoodfacts.ts       Lookup code-barres OFF → Open Beauty Facts → Open Products Facts
    backup.ts              Export / import JSON (format v2 ; une sauvegarde v1 est convertie comme la migration 6)
    use-query.ts           Hook useQuery(loader, key) : charge depuis SQLite et recharge au focus de l'écran
    use-keyboard-height.ts Hauteur du clavier (0 si fermé) : pied de la fiche objet (modal natif), où KeyboardAvoidingView calcule mal le décalage et cachait le bouton « Ajouter »
    alerts.tsx             AlertsProvider / useAlerts() / alertCounts() : alertes partagées (bandeau, pastilles), recalculées à chaque écriture SQLite et au retour au premier plan
    reminder-prefs.ts      Délais de rappel choisis par l'utilisateur (kv-store, hors sauvegarde) : getReminderPrefs() / useReminderPrefs(), expiryWarningDays() / freezerWarningMonths() et leurs libellés
    kv-pref.ts             createKvPref(key, parse) → { get, set, use } : préférence kv-store partagée (feedback, reminder-prefs)
    badges.ts              itemBadges() (pur) : badges d'état d'un objet (épuisé, stock bas, péremption, congelé)
    reminders.ts           Notifications locales : planReminders() (pur) + syncReminders(db) qui reprogramme tout
    privacy.ts             Texte de la politique de confidentialité (source unique : écran + page web)
    feedback.ts            giveFeedback(kind) : son + vibration (tap, tick, open, close, hold, success, delete, error, scan) ; préférences Sons / Vibrations (kv-store, hors sauvegarde) ; preloadFeedback() dans _layout
  ui/
    theme.ts               Couleurs, tints pastel (tintFor), tons des badges, spacing, radius, fonts/font, card
    icon.tsx               Composant Icon (SVG), isIconName() ; icons-data.ts = généré par scripts/build-icons.mjs
    icon-choices.ts        Icônes proposées dans la grille « Personnalisé », par thème
    components.tsx         Barrel (seul point d'import des écrans) qui réexporte :
      buttons.tsx          Button, IconButton (`repeat`), Fab (`secondary` = bouton crème à gauche du principal)
      fields.tsx           TextField, Chip, ChipRow, Checkbox, CheckMark, SelectionMark, FieldLabel, Hint
      lists.tsx            IconTile, ListRow, HeaderTitle, AddTile, BadgeRow, SectionTitle, Separator, EmptyState
      name-field.tsx       NameField (suggestions + grille d'icônes), PromptModal
      dialogs.tsx          ModalFrame, ModalCard (`avoidKeyboard`), DialogHost, showDialog, showMessage, showError, confirm, showEditDeleteMenu
      stepper.tsx          Stepper (− valeur +), StepperField (− champ +, fiche objet)
    fold.tsx               useFold() + FoldChevron : ressort de pliage d'ItemCard (hors barrel : `@/ui/fold`)
```

## Modèle de données (SQLite)

- `rooms(id, name, icon, position, created_at)`
- `furniture(id, room_id → rooms ON DELETE CASCADE, name, icon, position, created_at)`
- `items(id, furniture_id → furniture ON DELETE CASCADE, name, icon, quantity REAL (nombre d'exemplaires, entier), size REAL, size_unit, amount REAL (reste au total, v7), category, subcategory, min_quantity, expires_at 'AAAA-MM-JJ', frozen_at 'AAAA-MM-JJ', frozen_snoozed_until 'AAAA-MM-JJ', barcode, notes, created_at, updated_at)`
- `item_batches(id, item_id → items ON DELETE CASCADE, quantity INTEGER, expires_at 'AAAA-MM-JJ')` (v9) : lots de péremption, voir « Lots » plus bas. `items.expires_at` = date du lot le plus proche (dénormalisée, tenue à jour par `syncBatches()`).
- `known_products(name PK COLLATE NOCASE, size, size_unit, category, subcategory, barcode, icon, pack_quantity (v8, exemplaires par pack scanné : 6 × 33 cl → 6), use_count, last_used)` : historique de saisie → alimente l'autocomplétion et sert de cache hors ligne des codes-barres déjà scannés. Mis à jour (upsert) à chaque enregistrement d'objet.

`PRAGMA foreign_keys = ON` est activé dans `migrate()` (indispensable pour les cascades).

`icon` (v5) = icône personnalisée, clé de `icons-data.ts` ; NULL = icône automatique (déduite du nom pour pièces / rangements, de la catégorie pour les objets). Toujours afficher via `roomIconOf()` / `furnitureIconOf()` / `itemIcon()` de `catalog.ts` (une clé inconnue de ce build retombe sur l'automatique). L'icône d'un objet est mémorisée dans `known_products` et revient avec la suggestion.

**L'app est entre les mains de testeurs : leurs données doivent survivre à chaque mise à jour.**

- Schéma = **migrations incrémentales** dans `MIGRATIONS` (`schema.ts`), clé = version cible, version courante dans `PRAGMA user_version`. La v4 est la base (premier APK distribué) ; une nouvelle install l'exécute puis toutes les suivantes.
- Faire évoluer le schéma = **ajouter** une migration `N+1` (jamais modifier une migration déjà livrée dans un build). Préférer `ADD COLUMN` / `CREATE` ; changer une colonne = reconstruire la table (créer → copier → supprimer → renommer).
- Tester la montée de version depuis une base existante (pas seulement une install neuve).
- `backup.ts` (format v3 : `item_batches` exporté ; une sauvegarde v1 / v2 reçoit un lot par objet daté) : mettre à jour les colonnes exportées/importées ; l'import doit continuer à lire les anciennes sauvegardes (colonnes absentes → valeurs par défaut). Incrémenter `BACKUP_VERSION` seulement si le format change.
- Ne jamais changer `android.package` ni la clé de signature (gérée par EAS) : sinon impossible d'installer la mise à jour par-dessus. `versionCode` auto-incrémenté par EAS à chaque build.

## Règles métier

- **Quantité ≠ contenance** (v6, choix utilisateur) : `quantity` = **nombre d'exemplaires**, entier, − / + par 1 ; c'est lui qui fait le stock, le stock minimum et les courses. La **contenance** d'un exemplaire (`size` + `size_unit`, optionnelle) n'est qu'informative : « 2 paquets de poulet de 500 g ». Unités de contenance : `g`, `kg`, `ml`, `l`, `cm`, `m` (plus de pièce / portion / paquet). Dans la fiche, la contenance a aussi ses − / + (comme la quantité), d'un pas de l'unité choisie (100 g, 0,5 kg, 100 mL, 0,5 L, 10 cm, 1 m). Une unité est toujours choisie (`g` par défaut, non désélectionnable : une contenance sans unité n'a pas de sens), recalé sur ce pas (250 g → 300 / 200 g) ; 0 = pas de contenance. Affichage `formatStock()` : « 2 · 1 kg » = nombre · **total** (2 × 500 g), « 2 » sans contenance ; total dans l'unité la plus lisible (1500 g → 1,5 kg). Migration des anciennes données : objet mesuré (1,5 kg de farine) → 1 exemplaire de 1,5 kg (0 si vide), stock minimum → 1 ; objet compté → arrondi à l'entier (un entamé compte pour 1). Scan : « 6 x 33 cl » → 6 exemplaires de 330 mL.
- **Reste au total** (`amount`, v7, choix utilisateur) : ce qu'il reste vraiment, dans l'unité de la contenance, modifiable à part (2 paquets de 500 g, 200 g mangés → « 2 · 800 g »). NULL = tout plein ; toujours lire via `totalOf()`. Règles (SQL `adjustQuantity()` / `adjustAmount()`, mêmes règles en JS `totalForQuantity()` / `quantityForTotal()` pour la fiche) : +1 exemplaire = +1 plein ; −1 = l'entamé disparaît (800 g → 1 × 500 g) ; baisser le reste ajuste le nombre d'exemplaires à l'arrondi supérieur (500 g → 1). Changer la contenance ou l'unité dans la fiche remet « tout plein ». Carte objet dépliée : ligne « Reste » avec − / + d'un pas de l'unité ; fiche : champ « Reste au total » sous la contenance. Courses : « Ajouter » ajoute des exemplaires pleins.
- **Lots de péremption** (v9, choix utilisateur : un objet, plusieurs dates) : racheté alors qu'il en reste, un produit garde une carte unique mais chaque achat garde sa date (« 1 × 22/11 », « 2 × 28/11 »). `items.quantity` reste le total (stock, minimum, courses) ; exemplaires sans date = quantité − somme des lots (jamais stockés). Retirer des exemplaires (−, reste, Épuisé, Courses) retire **le lot le plus proche d'abord** ; + (carte, scan rapide) ajoute des exemplaires sans date. Toute écriture de stock passe par `syncBatches()` (`queries.ts`) : un lot par date, pas plus de datés que le stock, `items.expires_at` = lot le plus proche → badges, bandeau, onglet Péremption lisent toujours cette colonne. Lots lus via `itemBatches(item)` (colonne JSON `batches_json` de `listItems` / `ITEM_WITH_LOCATION`). Fiche : une seule date pour tout (comme avant) ; « Pas tous la même date ? » (≥ 2 exemplaires) passe en mode lots (`BatchEditor` ; une date ne couvre jamais plus que ses exemplaires + ceux sans date, compteur plafonné : pour dater des exemplaires en plus, augmenter d'abord la quantité ; « Ajouter une date » masqué quand tout est daté), ouvert d'office si l'objet a déjà plusieurs dates ; sortie du congélateur → retour à une date unique. Carte dépliée : « Péremption » au-dessus, puis une ligne par lot en colonnes (nombre, date, délai court « dans 3 j » coloré si périmé / bientôt) + « N pcs sans date » ; une seule date = date et délai à droite du libellé. Péremption : sous-titre « Périmé depuis 2 jours : 1 sur 3 » si seul une partie est concernée. Rappels : un par lot (même nom regroupé une fois par jour). Courses « Ajouter N » d'un objet à péremption (non congelé) : date demandée, facultative (`RestockDateModal`, « Sans date »). « Additionner » (doublon) ajoute les lots de la saisie. Migration v9 / ancienne sauvegarde : chaque date existante = un lot couvrant tout le stock (un objet à 0 perd sa date).
- **Catégorie obligatoire** dans la fiche objet : « Autre » (`DEFAULT_CATEGORY`) présélectionnée pour une saisie manuelle, remplacée par celle du scan / de la suggestion ; un appui sur la catégorie choisie ne la désélectionne pas. Un ancien objet sans catégorie s'ouvre sur « Autre » (enregistré ainsi s'il est modifié). `category` peut rester NULL en base (anciennes données, imports).
- **Catégories → sous-catégories** : liste fixe `CATEGORIES` + `SUBCATEGORIES[catégorie]` dans `catalog.ts` (ex. Alimentaire › Viande / Poisson / Épicerie sèche…). Sous-catégorie optionnelle, remise à null quand la catégorie change. Affichage via `formatCategory()` (« Alimentaire › Viande »). Le scan devine la sous-catégorie depuis les tags Open Food Facts quand c'est possible.
- **Congelé ≠ Surgelés** (choix utilisateur, garder les deux) : la case « Congelé » = produit frais mis au congélateur par l'utilisateur ; la catégorie « Surgelés » = produit acheté déjà surgelé.
- **Champs selon la catégorie** (`categoryHasExpiry()` / `categoryCanFreeze()`, table `CATEGORY_FIELDS` de `catalog.ts`) : date de péremption + « Congelé » pour Alimentaire, sans catégorie et Autre ; péremption seule pour Boissons, Surgelés, Hygiène, Pharmacie ; aucun des deux pour Entretien, Bricolage, Linge, Cuisine, Électronique, Papeterie, Loisirs. Un champ masqué n'est pas enregistré (valeur remise à null), sauf si l'objet enregistré en avait déjà une : le champ reste alors affiché pour ne jamais perdre une donnée en silence. Le cochage auto en congélateur ne se fait que si la catégorie l'autorise.
- **Congelé** : case sous la date de péremption → `items.frozen_at` (date de congélation). Un objet congelé est exclu de l'onglet Péremption et affiche le badge « CONGELÉ » au lieu des badges de date ; la date de péremption est conservée. Cochée automatiquement quand l'objet est créé dans / déplacé vers un rangement dont le nom contient « congel » (`isFreezer()`).
- **Sortie du congélateur** : déplacer un objet congelé vers un rangement qui n'est pas un congélateur décoche « Congelé » et met la péremption à aujourd'hui + `THAWED_SHELF_DAYS` (2 j, recommandation 24-48 h après décongélation).
- **Rappel de congélation** : congelé depuis plus de `freezerWarningMonths()` mois (réglage 1 à 6, 3 par défaut) → section dédiée dans l'onglet Péremption + badge « CONGELÉ DEPUIS N MOIS ». Bouton « Ignorer » = `frozen_snoozed_until` à aujourd'hui + N mois (revient ensuite, indéfiniment). Le report est remis à zéro si `frozen_at` change (`updateItem`).
- Quantité jamais négative (`MAX(0, …)` en SQL). 0 = badge "ÉPUISÉ".
- **Alertes de l'accueil** (bandeau, une ligne cliquable par type, masqué si rien) : périmés, à finir bientôt, congelés depuis N mois → onglet Péremption ; **dates manquantes** (objet non congelé dont une partie du stock a une date et l'autre non : somme des lots < quantité ; `getAlerts().partlyDated`) → écran `/undated`, accessible seulement par là (choix utilisateur), compté nulle part ailleurs (ni pastille, ni rappel). Pas de ligne « à racheter » (retirée, choix utilisateur : la pastille de l'onglet Courses suffit). Pastilles : Courses = stock bas, Péremption = périmés + bientôt + congelés.
- **Rappels (notifications locales)** à `REMINDER_HOUR` (9 h) : N jours avant chaque péremption (réglage global 1 à 10, 7 par défaut ; s'il est trop tard : la veille, sinon le jour même), et le jour où un produit atteint N mois au congélateur (ou la fin de son report). **Réglage global, pas par objet**, dans une modale ouverte depuis l'onglet Péremption (pas dans Réglages, pas de carte sur la page) (choix utilisateur). **Tout est lié au réglage** : fenêtre « bientôt périmés » de l'onglet, badge « PÉRIME DANS N J », bandeau et pastille = exactement le délai choisi (1 j = seulement ce qui périme d'ici demain). Changer un délai → `useAlerts().refresh()` (alertes + reprogrammation). Objets regroupés par heure, 60 max (limite iOS 64). Reprogrammés entièrement à chaque changement de la base (`syncReminders`, ignoré si rien n'a changé). Permission demandée depuis Réglages uniquement. `DELETE` sans `WHERE` ne déclenche pas l'écouteur SQLite (truncate optimization) : appeler `useAlerts().refresh()` après « Tout effacer » / import.
- **Courses, remise en stock** : sur chaque ligne, − / + choisissent la quantité **achetée** (pas enregistrée, 1 par défaut), le bouton « Ajouter N » (sans libellé à côté des − / + : choix utilisateur) l'ajoute au stock (`ItemRow purchase` : commandes sur une ligne à part sous l'objet, via `ListRow footer`, pour laisser toute la largeur au texte ; à droite, le stock actuel « N en stock »). Un « J'ai acheté » groupé à quantité devinée (2 × minimum) a été essayé puis retiré : pas clair pour l'utilisateur.
- **Ajout direct aux courses** (choix utilisateur) : + dans l'en-tête de l'onglet Courses (comme la roue crantée de Péremption) et bouton dans l'état vide → fiche objet avec le param `shopping=1` (titre « À acheter », bouton « Ajouter à la liste ») : nom (sans scan), catégorie, contenance, emplacement (« où le ranger une fois acheté »), notes ; **ni quantité, ni reste, ni péremption, ni congelé, ni stock minimum**. Enregistré avec quantité 0 et stock minimum 0 : il quitte la liste dès qu'un exemplaire est ajouté et y revient quand il est de nouveau épuisé. Doublon dans le même rangement : déjà sur la liste → simple message, sinon « Ajouter à part » / « Annuler ».
- **Stock bas** si `min_quantity` défini et `quantity <= min_quantity` → onglet Courses + badge. Libellé du champ côté UI : « Stock minimum ».
- **Scan** (choix utilisateur) : bouton « Scanner un code-barres » seulement à la création d'un objet ; en modification, le code-barres enregistré est affiché en lecture seule (même cadre que le bouton, `Button readOnly`) (rien s'il n'y en a pas). Dans la fiche, rescanner le **même** code-barres additionne (quantité + 1 pack, le reste suit) ; un code **différent** remplace le produit (nom, contenance, catégorie, quantité = taille du pack). La taille du pack (Open Food Facts « 6 x 33 cl » → 6) est mémorisée dans `known_products.pack_quantity` et redonnée au rescan (1 par défaut). **Scan rapide** (bouton code-barres à gauche du + d'un rangement) : produit déjà rangé là (`findItemByBarcode` : même code, ou sans code mais même nom que l'historique ; le non congelé d'abord) → + 1 pack via `adjustQuantity`, caméra laissée ouverte avec le résultat affiché ; sinon → fiche « Nouvel objet » ouverte avec le param `barcode` (recherche lancée à l'ouverture ; sur iOS après la fermeture de la caméra, deux modals ne pouvant se chevaucher).
- **Doublon** à la création : même nom (insensible à la casse) + même contenance + même état congelé dans le même rangement → proposer "Additionner" / "Créer à part". « Additionner » (`mergeIntoItem`) ajoute la quantité, garde la date de péremption / congélation la plus proche et complète les champs vides.
- Noms d'objets capitalisés à l'enregistrement.
- **Sélection multiple** (rangement, Courses, Péremption ; `useSelection()` dans `components/selection.tsx`) : appui long sur un objet → mode sélection (cases à cocher, « Tout » / « Aucun » dans l'en-tête, barre d'actions en bas). Décocher le dernier, la croix, le retour Android ou quitter l'écran / l'onglet quittent le mode. Actions : « Supprimer » (confirmation listant les objets) partout ; « Ignorer (N) » sur les congelés sélectionnés (Péremption).
- Onglets : un écran qui change son titre d'en-tête (sélection) ne doit pas changer le libellé de l'onglet → `tabBarLabel` explicite dans `(tabs)/_layout.tsx`.
- **Accueil = pièces en tuiles (2 colonnes), rangements dans un tiroir** (choix utilisateur) : appui sur une pièce → tiroir avec ses rangements, appui sur un rangement → ses objets directement (pas d'écran pièce, supprimé pour gagner une étape). Essais abandonnés : pièces repliables en panneaux pleine largeur, puis tuiles qui s'élargissent en lignes (transition jamais propre).
- Suppression d'une pièce ou d'un meuble = suppression en cascade, toujours précédée d'une confirmation qui annonce ce qui sera perdu.

## Autocomplétion

- **Champ nom = `NameField`** (pièces, rangements, objets) : le champ est seul, avec en dessous deux boutons **toujours visibles** « Une suggestion ? » et « Personnalisé ». Le premier ouvre la liste de suggestions (filtrée pendant la frappe), le second une grille d'icônes de **même hauteur** ; un appui sur le bouton actif referme. Rien n'est obligatoire : sans eux, texte exact tapé + icône automatique. Choisir une suggestion remet l'icône de la suggestion ; « Personnalisé » ensuite ne change que l'icône (le texte reste). La tuile à gauche du champ prévisualise l'icône enregistrée (appui = grille). Première case de la grille = « Auto ». Hauteur = 4 lignes (`panelRows`), 3 dans `PromptModal` ; le cadre rétrécit encore (jusqu'à 1 ligne) si la place manque au-dessus du clavier, pour que la modale ne déborde jamais.
- **Objets** : 100 % hors ligne. Ordre : `known_products` (historique de l'utilisateur, trié par usage) puis dictionnaire intégré `CATALOG` (~200 objets, format `Nom|unité|Catégorie|Sous-catégorie` dans `catalog.ts`). Choisir une suggestion pré-remplit unité + catégorie + sous-catégorie.
- **Pièces / meubles** : `PromptModal` + `SuggestionDropdown` ; pour les meubles, les noms déjà utilisés dans la maison passent avant la liste intégrée.
- UX attendue par l'utilisateur : une **vraie liste déroulante qui se filtre pendant la frappe** (pas des chips/badges). La liste est rendue dans le flux (pas en position absolue) pour rester fiable dans un ScrollView.
- Pourquoi pas d'API : la recherche texte Open Food Facts est limitée à 10 req/min et ne couvre que l'alimentaire. L'API sert uniquement au **scan de code-barres** (lecture produit : 100 req/min par utilisateur). Le scan doit toujours dégrader proprement hors ligne.

## Conventions

- **Formatage = Prettier** (`.prettierrc.json` : guillemets simples, 120 colonnes, `>` JSX en fin de ligne). Toujours via la config du projet (`npm run format` ou `npx prettier --write <fichier>`), jamais avec des options en ligne de commande. Les listes de données compactées à la main (`ICON_CHOICES`, `SUBCATEGORIES`, suggestions de pièces / meubles, `ACCENTS`…) sont protégées par `// prettier-ignore` : garder ce commentaire, et l'ajouter sur une nouvelle liste du même genre. Fichiers générés exclus via `.prettierignore`.
- Composants UI de base uniquement depuis `@/ui/components` ; styles via `theme.ts`.
- **Son / vibration** : `Button`, `IconButton`, `ListRow`, `Fab`, `AddTile` jouent `tap` ; `Chip`, `Checkbox`, liste de suggestions jouent `tick` ; appui long = `hold` (vibration seule). Prop `feedback` pour changer (`"tick"` sur les − / +, `"close"` sur annuler / fermer) ou `feedback={false}` quand l'action joue le sien après coup : enregistrer → `success`, saisie invalide → `error`, suppression effectuée → `delete` (appelé après l'écriture, pas sur le bouton). Erreur affichée → `showError()` (joue `error`), pas `showMessage()`. Boutons de dialogue : `cancel` → `close`, `destructive` → muet (l'action joue `delete`), autres → `tap`, sinon `feedback` sur le `DialogButton`. `Pressable` brut : `withFeedback(kind, handler)`. Pas de son sur le défilement, la frappe ni les onglets.
- **− / + d'une quantité** : `IconButton repeat` = appui maintenu qui répète l'action de plus en plus vite (fiche objet : quantité et contenance ; cartes objet ; Courses). Le gestionnaire doit utiliser la forme fonctionnelle de `setState` (appelé plusieurs fois d'affilée) ; son / vibration limités à un toutes les 90 ms.
- Accès DB : uniquement via les fonctions de `src/db/queries.ts` (pas de SQL dans les écrans, sauf exception justifiée).
- Données d'écran : `useQuery(loader, key)` + `reload()` après une mutation.
- Comparaisons/recherches texte : toujours via `normalize()` (gère les accents sans dépendre d'Intl/Hermes).
- Recherche / autocomplétion **par début de mot uniquement** (`matchesWordStart()` dans `text.ts`) : « poul » trouve « Poulet », pas « Ampoules ». Le nom exact tapé reste proposé en tête des suggestions (pour pré-remplir unité et catégorie).
- **Jamais de popup native** (`Alert.alert` interdit) : dialogues maison via `showDialog({ title, message, buttons })`, `showMessage()`, `confirm()`, `showEditDeleteMenu()` (`ui/dialogs.tsx`). Rendus par `<DialogHost />` (layout racine) ; un écran présenté en modal natif (fiche objet) monte son propre `<DialogHost />`, sinon rien ne s'affiche sur iOS. Styles de boutons : `primary` (Lagon), `destructive` (rouge), `default` (crème), `cancel` (discret, en bas, aussi déclenché par retour / appui hors de la carte).
- iOS 26 : la barre de navigation native est transparente + floue par défaut (liquid glass). Choix utilisateur : en-tête **opaque** (`headerTransparent: false` + `headerStyle` dans la Stack racine). Garder quand même `contentInsetAdjustmentBehavior="automatic"` sur les ScrollView/FlatList de la Stack (sans effet avec un en-tête opaque, utile si on y revient). `EmptyState` le gère déjà.
- Navigation : `router.push({ pathname: '/furniture/[id]', params: { id } })` (forme objet, compatible typed routes).
- Pas de nouvelle dépendance sans vérifier qu'elle est dans Expo Go et l'installer via `npx expo install`.

## Build et distribution

- **Politique de confidentialité** (obligatoire sur Google Play) : texte dans `src/lib/privacy.ts`, affiché dans l'app (`/privacy`) et publié sur GitHub Pages (`docs/privacy/index.html`, dépôt public, branche `main`, dossier `/docs`) → `PRIVACY_URL`. Après chaque modif du texte : `node scripts/build-privacy.mjs` (couleurs reprises de `theme.ts`), mettre à jour `PRIVACY_UPDATED`, commit + push. Si l'app se met à collecter ou envoyer quoi que ce soit, mettre à jour ce texte **et** le formulaire « Sécurité des données » de la Play Console.

- Projet EAS `@hawkcio/inventaire-maison`. APK testeurs : `npx eas-cli@latest build -p android --profile preview` (lien d'installation sur expo.dev). Profil `production` = AAB pour le Play Store (pas encore utilisé).
- **Permissions Android** : seulement CAMERA, INTERNET (Open Food Facts), VIBRATE (notifications, vibrations) et MODIFY_AUDIO_SETTINGS (permission « normale » imposée par le manifeste d'expo-audio, sans demande à l'utilisateur). Plugin expo-audio configuré sans micro ni lecture en arrière-plan. Celles ajoutées par des dépendances sans être utiles (SYSTEM_ALERT_WINDOW, stockage externe, RECORD_AUDIO) sont retirées via `android.blockedPermissions`. Vérifier avec `npx expo config --type introspect` après l'ajout d'un module. Toute nouvelle permission = revoir la fiche Play (sécurité des données) et la politique de confidentialité.

## Décisions prises avec l'utilisateur

- Onglet Rechercher conservé, **recherche limitée aux objets** (pas les pièces ni les meubles).
- Autocomplétion en liste déroulante pendant la saisie, pas de chips de suggestions ; ouverte à la demande (« Une suggestion ? »), jamais imposée.
- Icône personnalisable (« Personnalisé ») pour pièces, rangements et objets. Le menu d'appui long dit « Modifier » (nom + icône).
- Direction artistique « Village » avec l'accent Lagon, illustrations Fluent Emoji en majorité + Phosphor pour le reste (choisie sur maquettes).

## Idées pour la suite (non faites)

- Mode sombre « soirée »
- Photos d'objets, réordonner pièces/meubles par glisser-déposer, déplacer un meuble vers une autre pièce (`moveFurniture` existe déjà dans `queries.ts`)
- Rappels : réglage de l'heure, interrupteur dans l'app (aujourd'hui : permission système), délai par objet (écarté pour l'instant)
