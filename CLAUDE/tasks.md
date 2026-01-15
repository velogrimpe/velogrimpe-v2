# Tâches en cours

## 1. Système d'icônes unifié

**Priorité:** Haute

**Objectif:** Permettre l'utilisation d'icônes à la fois dans Vue et dans les templates PHP, de manière cohérente et maintenable.

### État des lieux actuel

**PHP (templates):**
- Utilise un sprite SVG : `/symbols/icons.svg` (898 KB - set Remix Icons complet)
- Syntaxe : `<svg><use xlink:href="/symbols/icons.svg#ri-search-line"></use></svg>`
- Fichiers concernés : `carte.php`, `falaise.php`, `tableau.php`, `contact.php`, `communaute.php`, `components/newsletter-form.php`

**Vue (composants):**
- Utilise des SVG inline (chemins copiés-collés dans chaque composant)
- Pas de système centralisé
- Composants concernés : `FilterPanel.vue`, `TableauFilterPanel.vue`, `InfoPanel.vue`, `TransitousStationSearch.vue`, `RoseDesVents.vue`, `MultiSelect.vue`

**Problèmes actuels:**
- Sprite SVG trop volumineux (898 KB pour quelques icônes utilisées)
- Duplication des SVG dans les composants Vue
- Pas de cohérence entre PHP et Vue
- Maintenance difficile (changement d'icône = modifier plusieurs fichiers)

### Solutions possibles

| Solution | PHP | Vue | Avantages | Inconvénients |
|----------|-----|-----|-----------|---------------|
| **Sprite SVG optimisé** | `<use xlink:href>` | `<use xlink:href>` | Simple, même syntaxe partout | Requiert build step pour générer sprite |
| **Composant Vue + helper PHP** | `<?= icon('search') ?>` | `<Icon name="search" />` | API unifiée, tree-shaking possible | Plus complexe à mettre en place |
| **Lucide Icons** | Web components ou helper | Package Vue officiel | Moderne, léger, bien maintenu | Dépendance externe |
| **Iconify** | Runtime ou helper | Package Vue | Énorme choix d'icônes | Dépendance externe, potentiellement lourd |

### Plan d'action proposé

1. Lister toutes les icônes utilisées dans le projet
2. Choisir une solution (recommandé : sprite optimisé ou Lucide)
3. Créer un composant Vue `<Icon>`
4. Créer un helper PHP `icon($name, $class = '')`
5. Migrer progressivement les fichiers existants

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
