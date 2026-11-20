/**
 * Privacy policy: single source for the in-app screen (`/privacy`) and the public
 * web page required by Google Play (`docs/privacy/index.html`, GitHub Pages).
 * After any change: `node scripts/build-privacy.mjs`, then commit and push.
 * Plain data only (no imports): the build script loads this file with Node.
 */

export const PRIVACY_URL = 'https://charlelielataste.github.io/home-inventory/privacy/';
export const PRIVACY_UPDATED = '16 novembre 2026';

export const PRIVACY_INTRO =
  'Chez Moi est une application d’inventaire de la maison qui fonctionne entièrement sur ton téléphone. Cette page explique, simplement, ce qu’elle fait (et ne fait pas) de tes données.';

export const PRIVACY_SECTIONS: { title: string; body: string[] }[] = [
  {
    title: 'Tes données restent sur ton téléphone',
    body: [
      'Les pièces, rangements et objets que tu saisis (noms, quantités, dates, notes…) sont enregistrés uniquement dans la mémoire de ton téléphone.',
      'Il n’y a ni compte, ni serveur, ni synchronisation : personne d’autre que toi n’y a accès, pas même le développeur.',
    ],
  },
  {
    title: 'Aucune collecte, aucun suivi, aucune publicité',
    body: [
      'L’application ne collecte aucune donnée personnelle, ne contient aucun outil de mesure d’audience ni de suivi, et n’affiche aucune publicité.',
      'Rien n’est vendu ni partagé avec des tiers.',
    ],
  },
  {
    title: 'Scan de codes-barres',
    body: [
      'L’appareil photo sert uniquement à lire les codes-barres de tes produits. Aucune photo ni vidéo n’est enregistrée ou envoyée.',
      'Pour trouver le nom d’un produit scanné, seul le numéro du code-barres est envoyé aux bases ouvertes Open Food Facts, Open Beauty Facts et Open Products Facts (association Open Food Facts). Aucune autre information ne l’accompagne. Le résultat est ensuite gardé sur ton téléphone.',
    ],
  },
  {
    title: 'Notifications',
    body: [
      'Les rappels (péremption, congélateur) sont des notifications locales, programmées par le téléphone lui-même. Aucun serveur n’est contacté.',
      'Tu peux les activer ou les couper à tout moment dans les réglages du téléphone.',
    ],
  },
  {
    title: 'Sauvegardes',
    body: [
      'L’export crée un fichier sur ton téléphone. C’est toi qui choisis où l’envoyer (Drive, mail…) ; l’application ne l’envoie nulle part d’elle-même.',
    ],
  },
  {
    title: 'Supprimer tes données',
    body: [
      'Réglages › « Tout effacer » supprime tout l’inventaire. Désinstaller l’application supprime aussi toutes ses données.',
    ],
  },
  {
    title: 'Contact',
    body: [
      'Une question ? Écris au développeur via la page du projet : https://github.com/Charlelielataste/home-inventory/issues',
      'Si cette politique change, la nouvelle version sera publiée ici avec sa date de mise à jour.',
    ],
  },
];
