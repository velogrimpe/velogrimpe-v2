# Plan : Fonctionnalité "Sorties"

## Résumé

Création d'une page permettant aux utilisateurs de proposer des sorties d'escalade et à d'autres de demander à participer, avec modération admin pour les mises en contact.

**Décision** : Les sorties sont publiées immédiatement (pas de validation admin). Seules les demandes de participation passent par l'admin.

---

## 1. Base de données

### Table `sorties`

```sql
CREATE TABLE sorties (
  sortie_id int(11) PRIMARY KEY AUTO_INCREMENT,
  organisateur_nom varchar(255) NOT NULL,
  organisateur_email varchar(255) NOT NULL,
  ville_depart varchar(255) NOT NULL,
  ville_id smallint(6) DEFAULT NULL,
  falaise_principale_nom varchar(255) NOT NULL,
  falaise_principale_id smallint(6) DEFAULT NULL,
  falaises_alternatives text,              -- JSON: [{nom, id?}, ...]
  velo_nom varchar(255) DEFAULT NULL,
  velo_id smallint(6) DEFAULT NULL,
  lien_groupe text NOT NULL,               -- URL Signal/WhatsApp
  description text NOT NULL,
  date_debut date NOT NULL,
  date_fin date DEFAULT NULL,              -- NULL = journée unique
  sortie_public tinyint(4) DEFAULT 1,      -- 1=publiée (publication immédiate)
  nb_interesses int(11) DEFAULT 0,
  edit_token varchar(64) NOT NULL,         -- Pour l'organisateur
  delete_token varchar(64) NOT NULL,       -- Pour l'admin (anti-spam)
  date_creation timestamp DEFAULT CURRENT_TIMESTAMP,
  date_modification timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### Table `participation_requests`

```sql
CREATE TABLE participation_requests (
  request_id int(11) PRIMARY KEY AUTO_INCREMENT,
  sortie_id int(11) NOT NULL,
  participant_nom varchar(255) NOT NULL,
  participant_email varchar(255) NOT NULL,
  participant_telephone varchar(32),
  preferences_contact text NOT NULL,       -- JSON: {signal, whatsapp, email, telephone}
  message text,
  request_status tinyint(4) DEFAULT 2,     -- 1=validé, 2=en attente, 3=rejeté
  validation_token varchar(64) NOT NULL,
  date_creation timestamp DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sortie_id) REFERENCES sorties(sortie_id) ON DELETE CASCADE
);
```

---

## 2. Pages PHP

| Fichier | Description |
|---------|-------------|
| `public_html/sorties.php` | Page principale avec calendrier et drawer |
| `public_html/ajout/ajout_sortie.php` | Formulaire de proposition |
| `public_html/ajout/confirmation_sortie.php` | Page de confirmation |

---

## 3. Endpoints API

### Publics (`/api/`)

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `add_sortie.php` | POST | Créer une sortie |
| `add_participation.php` | POST | Demander à participer |
| `fetch_sorties.php` | GET | Liste des sorties (filtres: ville_id, mois) |
| `fetch_sortie_velos.php` | GET | Itinéraires vélo d'une falaise |

### Privés (`/api/private/`)

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `validate_participation.php` | GET | Admin valide → mail à l'organisateur |
| `reject_participation.php` | GET | Admin rejette la demande |
| `delete_sortie.php` | GET | Admin supprime une sortie (anti-spam, via token) |
| `edit_sortie.php` | POST | Organisateur modifie (via edit_token) |
| `delete_sortie_organizer.php` | POST | Organisateur supprime (via edit_token) |

---

## 4. Composants Vue

### Nouveaux composants (`frontend/src/components/sorties/`)

| Composant | Description |
|-----------|-------------|
| `SortiesApp.vue` | Composant racine |
| `SortiesCalendar.vue` | Grille calendrier mensuel |
| `SortieCard.vue` | Carte compacte d'une sortie |
| `SortieDrawer.vue` | Drawer latéral avec détails |
| `SortiesFilter.vue` | Filtre par ville |
| `ParticipationModal.vue` | Dialog de demande de participation |
| `SortieForm.vue` | Formulaire de création |

### Composant partagé à créer

| Composant | Description |
|-----------|-------------|
| `DatePicker.vue` | Sélecteur de date (simple ou plage) |

---

## 5. Store Pinia

Nouveau store : `frontend/src/stores/sorties.ts`

- État : sorties, villes, selectedSortie, filterVilleId, currentMonth
- Actions : initialize, selectSortie, setFilterVille, navigateMonth
- Computed : filteredSorties, sortiesForMonth

---

## 6. Points d'entrée Vite

Ajouter dans `vite.config.ts` :

```typescript
input: {
  // ... existants
  "sorties": resolve(__dirname, "src/apps/sorties.ts"),
  "ajout-sortie": resolve(__dirname, "src/apps/ajout-sortie.ts"),
}
```

---

## 7. Emails

**Note** : Utilise `$config['contact_mail']` de config.php pour tous les envois admin.

### Confirmation création (à l'organisateur)

- **Quand** : Nouvelle sortie créée
- **À** : Email de l'organisateur
- **Contenu** : Récapitulatif de la sortie + lien d'édition (edit_token)

### Notification admin (nouvelle sortie)

- **Quand** : Nouvelle sortie proposée
- **À** : `$config['contact_mail']`
- **Contenu** : Détails de la sortie + **lien Supprimer** (anti-spam)
- **Pas de validation requise** : la sortie est déjà publiée

### Notification suppression (à l'organisateur)

- **Quand** : Admin supprime une sortie (spam)
- **À** : Email de l'organisateur
- **Contenu** : Notification que la sortie a été supprimée

### Notification admin (demande de participation)

- **Quand** : Nouvelle demande de participation
- **À** : `$config['contact_mail']`
- **Contenu** : Infos participant + liens Valider/Rejeter

### Transfert à l'organisateur

- **Quand** : Admin valide la demande
- **À** : Email de l'organisateur
- **Contenu** : Coordonnées du participant + message

---

## 8. Organisation des fichiers

```
public_html/
├── sorties.php
├── ajout/
│   ├── ajout_sortie.php
│   └── confirmation_sortie.php
└── api/
    ├── add_sortie.php
    ├── add_participation.php
    ├── fetch_sorties.php
    ├── fetch_sortie_velos.php
    └── private/
        ├── validate_participation.php
        ├── reject_participation.php
        ├── edit_sortie.php
        └── delete_sortie.php

frontend/src/
├── apps/
│   ├── sorties.ts
│   └── ajout-sortie.ts
├── components/
│   ├── sorties/
│   │   ├── index.ts
│   │   ├── SortiesApp.vue
│   │   ├── SortiesCalendar.vue
│   │   ├── SortieCard.vue
│   │   ├── SortieDrawer.vue
│   │   ├── SortiesFilter.vue
│   │   ├── ParticipationModal.vue
│   │   └── SortieForm.vue
│   └── shared/
│       └── DatePicker.vue
├── stores/
│   └── sorties.ts
└── types/
    └── sortie.ts
```

---

## 9. Phases d'implémentation

### Phase 1 : Base de données & API
- Créer les tables SQL
- Implémenter add_sortie.php, fetch_sorties.php
- Configurer les emails admin

### Phase 2 : Page principale
- Créer sorties.php
- Implémenter SortiesCalendar.vue
- Ajouter le filtre ville
- Créer le drawer de détails

### Phase 3 : Formulaire de création
- Créer ajout_sortie.php
- Implémenter SortieForm.vue avec autocompletes
- Page de confirmation

### Phase 4 : Flux de participation
- Implémenter ParticipationModal
- API add_participation.php
- Pages de validation admin
- Transfert email

### Phase 5 : Fonctions organisateur
- Édition/suppression via edit_token
- Gestion des sorties passées

---

## 10. Vérification

- Tester la création d'une sortie (formulaire → BDD → affichage calendrier)
- Tester le filtre par ville
- Tester la demande de participation → email admin → validation → email organisateur
- Vérifier l'affichage des sorties passées (grisées, bouton Participer désactivé)
- Tester sur mobile (responsive)

**Tests email** : utiliser uniquement `yoann@couble.eu` pour les tests d'envoi.

---

## Fichiers de référence (patterns existants)

- [carte.php](public_html/carte.php) - Structure page PHP + Vue
- [FormAutocomplete.vue](frontend/src/components/shared/FormAutocomplete.vue) - Autocomplete
- [filters.ts](frontend/src/stores/filters.ts) - Store Pinia
- [add_comment.php](public_html/api/add_comment.php) - API avec notification email
- [newsletter_confirmation.php](public_html/api/newsletter_confirmation.php) - Validation par token
