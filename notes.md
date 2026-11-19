- [x] faire une passe sur les méthodes d'auth, plus de ?admin=
- [x] demander la liste des fonctionalités des cartes pour passer définitivement à la version maplibre.
- [ ] migrer les baseMaps vers le fichier dédié préparé.
- [ ] Il faudrait pouvoir proposer en optionel un gpx pour les acces piétons, il faudrait une durée obligatoire ou calculée via un calc. d'itinéraire piéton, et D+/D- en optionnel

---

- [ ] Rajouter les horaires dans la liste des accès
- [ ] Uniformiser les accès bus (même format que accès train + vélo) + proposition pour renseigner un accès bus, tester des tabs.

- [ ] Supprimer la case velo_apiedpossible dans le form et règle de décision auto = km <= 5km
- [ ] Aussi accessible à pied --> Accessible sans vélo (apiedpossible || variante à pied || lien arret falaise)

- [ ] Restaurer le tooltip permanent au clic sur la falaise, et tenter d'enlever le nom du layer pmtile

---

- [ ] Durcissement auth (suite de l'audit des endpoints admin) — solution légère :
  - **Jeton en query string** (`?admin=…` sur `accept_falaise`, `accept_velo`, `backfill_*`, `batch-geocode`, `edit_velo`, `add_*` en mode admin) : il fuit dans les logs Apache, l'historique et les `Referer`. Les liens des mails de validation en ont besoin ; les remplacer par un jeton à usage unique et à courte durée (HMAC de `action|id|expiration` signé avec `admin_token`, vérifié par l'endpoint) plutôt que par le jeton d'admin lui-même. Les appels d'admin (batch, backfill) passent en `Authorization: Bearer`.
  - **Comparaisons non constantes** (`==`, `!==` sur le jeton) : une fonction `vg_is_admin()` dans `lib/` (`hash_equals` sur le Bearer, `$_POST['admin']` et `$_GET['admin']`), puis remplacer les ~25 contrôles copiés-collés par un `vg_require_admin()` d'une ligne. Règle un seul endroit à auditer et évite qu'un nouvel endpoint oublie le contrôle (cas d'`add_ligne`).
  - **`api/private/` sans `.htaccess`** : ajouter un `RewriteCond %{HTTP:Authorization} !^Bearer` → 401 au niveau Apache pour les dossiers `newsletter/` et `pages/` (filet de sécurité, sans remplacer le contrôle PHP). Les liens de validation par jeton propre (`validate_participation`, `delete_sortie`…) et les crons (`vg_token`) restent hors de ce filet.

