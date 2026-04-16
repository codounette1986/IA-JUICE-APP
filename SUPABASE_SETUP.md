# Supabase

1. Dans Supabase, ouvrez `SQL Editor`.
2. Exécutez le contenu de [supabase-schema.sql](C:\Users\CodouNdiaye\Documents\IA JUICE\IA JUICE APP\supabase-schema.sql).
3. Renseignez votre projet dans [supabase-config.js](C:\Users\CodouNdiaye\Documents\IA JUICE\IA JUICE APP\supabase-config.js):

```js
window.IAJUICE_SUPABASE = {
  url: "https://VOTRE-PROJET.supabase.co",
  anonKey: "VOTRE_ANON_KEY",
};
```

4. Rechargez l’application.

Comportement:
- sans configuration, l’application reste en stockage local,
- avec configuration Supabase, l’application charge les données distantes au démarrage,
- chaque modification locale est ensuite resynchronisée vers Supabase.
