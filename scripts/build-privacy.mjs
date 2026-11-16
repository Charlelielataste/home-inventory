// Generates the public privacy policy page (GitHub Pages, linked from Google Play)
// from src/lib/privacy.ts, the same text as the in-app screen.
// Usage: node scripts/build-privacy.mjs  → docs/privacy/index.html
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

process.removeAllListeners('warning'); // "module type not specified" when loading .ts

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const privacy = await import(join(root, 'src/lib/privacy.ts'));
const { colors } = await import(join(root, 'src/ui/theme.ts'));

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// Turns bare URLs into links (after escaping)
const linkify = (s) => esc(s).replace(/https:\/\/[^\s<]+/g, (url) => `<a href="${url}">${url}</a>`);

const sections = privacy.PRIVACY_SECTIONS.map(
  (s) => `    <section>
      <h2>${esc(s.title)}</h2>
${s.body.map((p) => `      <p>${linkify(p)}</p>`).join('\n')}
    </section>`,
).join('\n');

const html = `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Chez Moi – Politique de confidentialité</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    body { margin: 0; background: ${colors.background}; color: ${colors.text}; font: 17px/1.55 Fredoka, system-ui, sans-serif; }
    main { max-width: 680px; margin: 0 auto; padding: 32px 16px 48px; }
    h1 { font-size: 30px; margin: 0 0 4px; }
    .updated { color: ${colors.textMuted}; margin: 0 0 24px; }
    section { background: ${colors.surface}; border-radius: 20px; padding: 4px 20px; margin: 0 0 16px;
      box-shadow: 0 3px 0 ${colors.edge}, 0 5px 6px ${colors.shadow}; }
    h2 { font-size: 19px; font-weight: 600; margin: 16px 0 8px; }
    a { color: ${colors.primary}; overflow-wrap: anywhere; }
  </style>
</head>
<body>
  <main>
    <h1>Politique de confidentialité</h1>
    <p class="updated">Chez Moi · mise à jour le ${esc(privacy.PRIVACY_UPDATED)}</p>
    <p>${linkify(privacy.PRIVACY_INTRO)}</p>
${sections}
  </main>
</body>
</html>
`;

const out = join(root, 'docs/privacy/index.html');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, html);
console.log(`Written ${out}`);
