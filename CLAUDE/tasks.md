# Tâches en cours

## 1. Système d'icônes unifié

**Priorité:** Haute
**Statut:** ✅ Infrastructure en place, migration en cours

**Objectif:** Permettre l'utilisation d'icônes à la fois dans Vue et dans les templates PHP, de manière cohérente et maintenable.

### Solution implémentée

**Sprite SVG optimisé** généré à partir d'une liste d'icônes TypeScript.

| Avant | Après |
|-------|-------|
| 898 KB (2271 icônes Remix Icons) | 17 KB (36 icônes utilisées) |

### Fichiers créés

- `frontend/src/icons/icons.ts` - Définitions des icônes (paths SVG)
- `frontend/build-icons.ts` - Script de génération du sprite
- `frontend/src/components/shared/Icon.vue` - Composant Vue
- `public_html/lib/icons.php` - Helper PHP

### Utilisation

**PHP:**
```php
<?php require_once 'lib/icons.php'; ?>
<?= icon('search') ?>
<?= icon('filter', 'w-6 h-6 text-primary') ?>
```

**Vue:**
```vue
<script setup>
import Icon from '@/components/shared/Icon.vue'
</script>
<template>
  <Icon name="search" />
  <Icon name="filter" class="w-6 h-6 text-primary" />
</template>
```

**Ajouter une icône:**
1. Ajouter la définition dans `frontend/src/icons/icons.ts`
2. Exécuter `bun run build:icons`

### Migration restante

- [ ] Migrer les templates PHP (remplacer `ri-*` par nouveaux noms)
- [ ] Migrer les composants Vue (remplacer SVG inline par `<Icon>`)

---

## 2. Migration templates PHP → Vue + API PHP

**Priorité:** Moyenne

**Objectif:** Transformer les pages PHP monolithiques en applications Vue avec API PHP backend.

### Pages candidates (par ordre de complexité)

| Page | Lignes | Complexité | Notes |
|------|--------|------------|-------|
| `tableau.php` | ~216 | Faible | Déjà partiellement migré (filtres Vue) |
| `falaise.php` | ~1279 | Moyenne | Commentaires déjà en Vue, reste le contenu principal |
| `carte.php` | ~1022 | Haute | Beaucoup d'interactions Leaflet, filtres déjà Vue |
| `ajout/ajout_*.php` | ~200-400 | Moyenne | Formulaires avec validation |

### Architecture cible

```
PHP (API)                    Vue (Frontend)
────────────                 ──────────────
/api/falaises.php      →     FalaisePage.vue
/api/carte-data.php    →     CartePage.vue
/api/tableau-data.php  →     TableauPage.vue
```

### Approche recommandée

1. Commencer par les pages les plus simples
2. Créer les endpoints API nécessaires
3. Garder le routage PHP (pas de SPA complet)
4. Migrer section par section, pas page entière d'un coup

---

## 3. Éditeur de falaise en Vue

**Priorité:** Moyenne

**Objectif:** Convertir l'éditeur de falaise (admin) en composant Vue réutilisable pour l'intégrer aux formulaires d'ajout et de modification.

### Contexte

- L'éditeur actuel est dans `admin/oblyk.php` (page très longue, ~14K lignes)
- Formulaires d'ajout dans `ajout/ajout_falaise.php`
- Besoin d'un composant unifié pour créer/éditer une falaise

### Fonctionnalités à inclure

- [ ] Champs de base (nom, localisation, cotations, exposition)
- [ ] Sélecteur de position sur carte (Leaflet)
- [ ] Gestion des secteurs et voies
- [ ] Upload/gestion d'images
- [ ] Preview en temps réel
- [ ] Validation des données

### Architecture proposée

```
frontend/src/components/falaise/
├── FalaiseEditor.vue        # Composant principal
├── FalaiseForm.vue          # Formulaire de base
├── FalaiseMapPicker.vue     # Sélection position carte
├── SecteurEditor.vue        # Édition des secteurs
└── ExpositionPicker.vue     # Sélection exposition (rose des vents)
```

### Étapes

1. Analyser le formulaire existant dans `ajout_falaise.php`
2. Identifier les champs et validations nécessaires
3. Créer le composant `FalaiseEditor.vue`
4. Créer l'API `/api/falaise.php` (CRUD)
5. Intégrer dans `ajout_falaise.php`
6. Intégrer dans l'admin pour l'édition

---

## Backlog

- [ ] Optimisation bundle map.js (actuellement 479KB)
- [ ] Tests automatisés (PHPUnit, Vitest)
- [ ] PWA / mode offline pour la carte
- [ ] Amélioration SEO (meta tags dynamiques)
