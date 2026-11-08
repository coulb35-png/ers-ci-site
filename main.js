// ERS-CI — menu, arrivées, route qui se trace, diaporama, compteurs.
// Tout le contenu reste visible si ce script ne tourne pas.
(function () {
  var doc = document.documentElement;
  doc.classList.add('js');
  var calme = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Menu téléphone
  var bouton = document.querySelector('.entete__menu-bouton');
  var menu = document.getElementById('menu');
  if (bouton && menu) {
    bouton.addEventListener('click', function () {
      var ouvert = bouton.getAttribute('aria-expanded') === 'true';
      bouton.setAttribute('aria-expanded', String(!ouvert));
      menu.classList.toggle('est-ouvert', !ouvert);
    });
    // Toucher en dehors du menu le referme
    document.addEventListener('click', function (e) {
      if (!menu.classList.contains('est-ouvert') || menu.contains(e.target) || bouton.contains(e.target)) return;
      bouton.setAttribute('aria-expanded', 'false');
      menu.classList.remove('est-ouvert');
    });
  }

  var annee = document.querySelector('[data-annee]');
  if (annee) annee.textContent = new Date().getFullYear();

  // Compteur : seulement des chiffres vrais, écrits dans la page
  function compter(el) {
    var cible = parseInt(el.getAttribute('data-compte'), 10);
    var depart = parseInt(el.getAttribute('data-depart') || '0', 10);
    if (calme) return;
    var debut = null, duree = 1400;
    function pas(t) {
      if (!debut) debut = t;
      var p = Math.min((t - debut) / duree, 1);
      var v = Math.round(depart + (cible - depart) * (1 - Math.pow(1 - p, 3)));
      el.textContent = cible >= 10000 ? v.toLocaleString('fr-FR').replace(/ | /g, ' ') : String(v);
      if (p < 1) requestAnimationFrame(pas);
    }
    requestAnimationFrame(pas);
  }

  // Apparitions au défilement, une seule fois
  var aObserver = document.querySelectorAll('[data-arrivee], .phases, .route');
  if ('IntersectionObserver' in window) {
    var obs = new IntersectionObserver(function (entrees) {
      entrees.forEach(function (e) {
        if (!e.isIntersecting) return;
        var el = e.target;
        el.classList.add(el.classList.contains('route') ? 'est-tracee' : 'est-visible');
        el.querySelectorAll && el.querySelectorAll('[data-compte]').forEach(compter);
        obs.unobserve(el);
      });
    }, { threshold: 0, rootMargin: '0px 0px -8% 0px' });
    aObserver.forEach(function (el, i) {
      if (el.hasAttribute('data-arrivee') && el.closest('.ouverture')) {
        el.style.transitionDelay = (i * 90) + 'ms';
      }
      obs.observe(el);
    });
  } else {
    aObserver.forEach(function (el) { el.classList.add('est-visible', 'est-tracee'); });
  }

  // Filet de sécurité : tout ce qui est déjà passé sous les yeux s'affiche,
  // même si l'observateur a manqué un défilement très rapide.
  function rattraper() {
    var bas = window.innerHeight;
    aObserver.forEach(function (el) {
      if (el.getBoundingClientRect().top < bas) {
        el.classList.add(el.classList.contains('route') ? 'est-tracee' : 'est-visible');
      }
    });
  }
  window.addEventListener('scroll', rattraper, { passive: true });
  window.addEventListener('load', function () { setTimeout(rattraper, 300); });

  // Réalisations : tri par métier
  var boutonsTri = document.querySelectorAll('.tri button');
  boutonsTri.forEach(function (b) {
    b.addEventListener('click', function () {
      var choix = b.getAttribute('data-filtre');
      boutonsTri.forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      document.querySelectorAll('.fiches--toutes .fiche').forEach(function (f) {
        f.hidden = choix !== 'tout' && f.getAttribute('data-metier') !== choix;
        if (!f.hidden) f.classList.add('est-visible');
      });
    });
  });

  // Devis : compose le message, puis l'ouvre dans WhatsApp ou dans la messagerie.
  // Rien n'est envoyé ni enregistré par le site lui-même.
  // La demande de location suit le même chemin, avec ses propres champs.
  var form = document.getElementById('form-devis') || document.getElementById('form-location');
  if (form) {
    var location_ = form.id === 'form-location';
    var objet = location_ ? 'Demande de location avec opérateur' : 'Demande de devis';
    var intro = location_ ? 'Bonjour ERS-CI, je souhaite louer du matériel avec opérateur.' : 'Bonjour ERS-CI, je souhaite un devis.';
    var champs = location_
      ? [['materiel', 'Matériel'], ['lieu', 'Site du chantier'], ['travaux', 'Travail à réaliser'], ['debut', 'Début souhaité'], ['jours', 'Durée avec opérateur'], ['quantite', 'Quantité estimée'], ['details', 'Précisions'], ['profil', 'Client'], ['nom', 'Nom ou entreprise'], ['contact', 'Personne à contacter'], ['telephone', 'Téléphone'], ['email', 'E-mail']]
      : [['travaux', 'Travaux'], ['lieu', 'Lieu'], ['quantite', 'Dimensions ou quantités'], ['delai', 'Délai souhaité'], ['dispo', 'Disponibilités pour la visite'], ['details', 'Précisions'], ['nom', 'Nom'], ['telephone', 'Téléphone']];
    // La date de début ne peut pas être passée
    if (form.debut) form.debut.min = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    // Mini-devis de la location : tarif journalier, opérateur compris
    var tarifs = {
      scie: { nom: 'Scie à sol', prix: 95000, depuis: false, lame: true },
      compacteur: { nom: 'Compacteur double bille', prix: 45000, depuis: true, lame: false }
    };
    var fcfa = function (n) { return n.toLocaleString('fr-FR').replace(/\s/g, ' ') + ' FCFA'; };
    var estimer = function () {
      if (!location_) return null;
      var option = form.materiel.options[form.materiel.selectedIndex];
      var cles = (option.getAttribute('data-tarif') || '').split(' ').filter(Boolean);
      var jours = form.jours.validity.valid ? Number(form.jours.value) : 0;
      if (!cles.length || !jours) return null;
      var e = { jours: jours, total: 0, depuis: false, lame: false, lignes: [] };
      cles.forEach(function (c) {
        var t = tarifs[c];
        e.total += t.prix * jours;
        e.depuis = e.depuis || t.depuis;
        e.lame = e.lame || t.lame;
        e.lignes.push({ nom: t.nom, calcul: fcfa(t.prix) + ' × ' + jours + (jours > 1 ? ' jours' : ' jour'), montant: fcfa(t.prix * jours), depuis: t.depuis });
      });
      // Remise unique sur le total quand les deux machines sont louées ensemble
      e.remise = cles.length === 2 ? 5000 : 0;
      e.total -= e.remise;
      e.exclus = (e.lame ? 'Lame de scie et frais' : 'Frais') + ' de déplacement du matériel non compris.';
      return e;
    };
    var bloc = document.getElementById('mini-devis');
    var element = function (parent, balise, classe, texte) {
      var n = document.createElement(balise);
      if (classe) n.className = classe;
      if (texte) n.textContent = texte;
      parent.appendChild(n);
      return n;
    };
    var afficherMini = function () {
      if (!bloc) return;
      var e = estimer();
      bloc.textContent = '';
      bloc.hidden = !e;
      if (!e) return;
      element(bloc, 'p', 'mini-devis__titre', 'Estimation de votre location');
      e.lignes.forEach(function (l) {
        var ligne = element(bloc, 'div', 'mini-devis__ligne');
        element(ligne, 'b', '', l.nom);
        element(ligne, 'small', '', (l.depuis ? 'À partir de ' : '') + l.calcul);
        element(ligne, 'strong', '', l.montant);
      });
      if (e.remise) {
        var remise = element(bloc, 'div', 'mini-devis__ligne');
        element(remise, 'span', '', 'Remise pour les deux machines');
        element(remise, 'strong', '', '− ' + fcfa(e.remise));
      }
      var total = element(bloc, 'div', 'mini-devis__total');
      element(total, 'span', '', e.depuis ? 'Total, à partir de' : 'Total');
      element(total, 'strong', '', fcfa(e.total));
      element(bloc, 'p', 'mini-devis__note', 'Montant TTC, opérateur compris. ' + e.exclus + ' Montant confirmé avant tout engagement.');
    };
    if (bloc) { form.addEventListener('input', afficherMini); form.addEventListener('change', afficherMini); }
    var composer = function () {
      var d = new FormData(form);
      var lignes = [intro];
      champs.forEach(function (c) {
        var v = c[0] === 'dispo' ? d.getAll('dispo').join(', ') : (d.get(c[0]) || '').toString().trim();
        if (v && c[0] === 'debut') v = v.split('-').reverse().join('/');
        if (v && c[0] === 'jours') v += Number(v) > 1 ? ' jours' : ' jour';
        if (v) lignes.push(c[1] + ' : ' + v);
      });
      var e = estimer();
      if (e) lignes.push('Estimation de votre location : ' + (e.depuis ? 'à partir de ' : '') + fcfa(e.total) + ' TTC, opérateur compris' + (e.remise ? ', remise de ' + fcfa(e.remise) + ' déduite' : '') + '. ' + e.exclus);
      return lignes.join('\n');
    };
    // Un champ oublié est dit en clair, sous le champ, et l'écran y remonte
    var valider = function () {
      var premier = null;
      form.querySelectorAll('[required]').forEach(function (c) {
        var msg = c.parentNode.querySelector('.champ__erreur');
        var manque = !c.value.trim();
        var vide = manque || !c.validity.valid;
        c.setAttribute('aria-invalid', String(vide));
        if (vide && !msg) {
          msg = document.createElement('p');
          msg.className = 'champ__erreur';
          msg.id = c.id + '-erreur';
          c.parentNode.appendChild(msg);
          c.setAttribute('aria-describedby', msg.id);
        }
        if (vide) {
          msg.textContent = manque ? 'À remplir : « ' + c.labels[0].textContent + ' ».'
            : c.type === 'date' ? 'Choisissez une date à venir.' : 'Indiquez un nombre entier de jours, au moins 1.';
        } else if (msg) {
          msg.remove();
          c.removeAttribute('aria-describedby');
        }
        if (vide && !premier) premier = c;
      });
      if (premier) {
        premier.scrollIntoView({ behavior: calme ? 'auto' : 'smooth', block: 'center' });
        premier.focus({ preventScroll: true });
      }
      return !premier;
    };
    form.addEventListener('input', function (e) {
      if (e.target.getAttribute('aria-invalid') === 'true') valider();
    });
    var ouvrirWhatsApp = function () {
      window.open('https://wa.me/2250717859090?text=' + encodeURIComponent(composer()), '_blank', 'noopener');
    };
    var ouvrirEmail = function () {
      window.location.href = 'mailto:coulb35@gmail.com?subject=' + encodeURIComponent(objet) + '&body=' + encodeURIComponent(composer());
    };
    // Après le clic, le formulaire cède la place au remerciement.
    // Le site ne sait pas si le message a été envoyé : il rappelle la dernière étape.
    var merci = document.getElementById('devis-merci');
    var dernierEnvoi = ouvrirWhatsApp;
    var remercier = function (canal, ouvrir) {
      dernierEnvoi = ouvrir;
      if (!merci) return;
      var nom = form.nom.value.trim();
      merci.querySelector('[data-merci-nom]').textContent = nom ? ', ' + nom : '';
      merci.querySelector('[data-merci-tel]').textContent = form.telephone.value.trim();
      merci.querySelector('[data-merci-canal]').textContent = canal === 'email' ? 'votre messagerie' : 'WhatsApp';
      merci.querySelector('[data-merci-souci]').textContent = canal === 'email' ? 'Votre messagerie ne s\'est pas ouverte ?' : 'WhatsApp ne s\'est pas ouvert ?';
      form.hidden = true;
      merci.hidden = false;
      merci.scrollIntoView({ behavior: calme ? 'auto' : 'smooth', block: 'start' });
      merci.querySelector('.merci__titre').focus({ preventScroll: true });
    };
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!valider()) return;
      ouvrirWhatsApp();
      remercier('whatsapp', ouvrirWhatsApp);
    });
    var parEmail = document.getElementById('devis-email');
    if (parEmail) parEmail.addEventListener('click', function () {
      if (!valider()) return;
      remercier('email', ouvrirEmail);
      ouvrirEmail();
    });
    if (merci) {
      document.getElementById('merci-reessayer').addEventListener('click', function () { dernierEnvoi(); });
      document.getElementById('merci-nouvelle').addEventListener('click', function () {
        form.reset();
        afficherMini();
        merci.hidden = true;
        form.hidden = false;
        form.scrollIntoView({ behavior: calme ? 'auto' : 'smooth', block: 'start' });
        form.querySelector('select, input').focus({ preventScroll: true });
      });
    }
  }

  // Diaporama du haut de page : fondu enchaîné lent
  var images = document.querySelectorAll('.diaporama img');
  if (images.length > 1 && !calme) {
    var i = 0;
    setInterval(function () {
      images[i].classList.remove('est-visible');
      i = (i + 1) % images.length;
      images[i].classList.add('est-visible');
    }, 5000);
  }
})();
