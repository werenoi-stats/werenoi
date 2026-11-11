# Werenoi, streams Spotify et certifications SNEP

Site qui suit chaque titre de Werenoi : streams Spotify cumulés, écoutes des dernières 24 h et certifications SNEP.

- **Streams** : relevés chaque soir sur [kworb.net](https://kworb.net/spotify/artist/3YBJLs7RqR0aPGBgU27nDh_songs.html), qui recopie les compteurs publics de Spotify.
- **Certifications** : lues chaque lundi dans la [base officielle du SNEP](https://snepmusique.com/les-certifications/?interprete=werenoi).

## Comment ça marche

Le fichier `.github/workflows/update.yml` lance `scripts/update.py` tous les jours à 19 h 41 UTC (20 h 41 à Paris en hiver). Le script réécrit `data.js` et `certs.js` seulement si la lecture est complète (nombre de titres et total de streams identiques au récapitulatif de kworb, aucune certification perdue côté SNEP), puis le site est republié sur GitHub Pages.

Pour forcer une mise à jour : onglet **Actions** > **Mise à jour du site** > **Run workflow** (case « Vérifier aussi les certifications SNEP » pour lire le SNEP un autre jour que le lundi).

Si une collecte échoue, le site garde les dernières données valides et GitHub envoie un e-mail d'alerte au propriétaire du dépôt.
