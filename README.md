# IA Juice App

PWA statique pour remplacer le fichier Excel de suivi de production et ventes.

## Fonctions incluses

- Dashboard avec synthèse automatique
- Catalogue produits
- Base clients
- Saisie de production
- Saisie de ventes avec contrôle du stock
- Vue stock et rentabilité
- Pricing, packs et coûts
- Synchronisation Supabase optionnelle

## Lancer localement

Ouvrez `index.html` dans un navigateur.

## Configuration Supabase

1. Copiez `supabase-config.example.js` en `supabase-config.js`.
2. Renseignez votre URL Supabase et votre clé `anon`.
3. Exécutez `supabase-schema.sql` dans le SQL Editor de Supabase.

## Publication GitHub

Les fichiers sensibles et locaux ne doivent pas être publiés :

- `supabase-config.js`
- `solo-prix-copy.xlsx`

Ils sont déjà exclus via `.gitignore`.
