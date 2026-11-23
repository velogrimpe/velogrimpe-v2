-- Pages CMS des deux éditions GRAVE 2027 (Savoie/Ain et Royans), 4 pages chacune,
-- contenu « à venir ». Rejouable : les slugs existants ne sont pas touchés (INSERT IGNORE).
INSERT IGNORE INTO pages (slug, title, short_title, banner_img, banner_title, description, status, sections)
SELECT CONCAT(e.dir, '/', p.slug),
       CONCAT(p.titre, e.titre_suffixe),
       p.short_title,
       '/images/mw/078-focus-groupe.webp',
       e.banner_title,
       CONCAT(p.titre, ' du Grand Rassemblement À Vélo-Escalade ', e.banner_title, ' : contenu à venir.'),
       'published',
       '[{"type":"text","html":"<p>Contenu à venir...</p>"}]'
FROM (
  SELECT 'grand-rassemblement-velo-escalade-savoie-ain-2027' AS dir, 'GRAVE Savoie/Ain 2027' AS banner_title, ' - GRAVE Savoie/Ain 2027' AS titre_suffixe
  UNION ALL
  SELECT 'grand-rassemblement-velo-escalade-royan-2027', 'GRAVE Royans 2027', ' - GRAVE Royans 2027'
) e
CROSS JOIN (
  SELECT 1 AS ord, 'presentation' AS slug, 'Présentation' AS titre, 'Présentation' AS short_title
  UNION ALL SELECT 2, 'programme', 'Programme', 'Programme'
  UNION ALL SELECT 3, 'falaises-et-acces', 'Falaises et accès', 'Falaises et accès'
  UNION ALL SELECT 4, 'infos-pratiques', 'Infos pratiques', 'Infos pratiques'
) p
ORDER BY e.dir DESC, p.ord;
