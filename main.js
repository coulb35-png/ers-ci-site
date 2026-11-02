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
  var form = document.getElementById('form-devis');
  if (form) {
    var composer = function () {
      var d = new FormData(form);
      var lignes = ['Bonjour ERS-CI, je souhaite un devis.'];
      [['travaux', 'Travaux'], ['lieu', 'Lieu'], ['quantite', 'Dimensions ou quantités'], ['delai', 'Délai souhaité'], ['details', 'Précisions'], ['nom', 'Nom'], ['telephone', 'Téléphone']].forEach(function (c) {
        var v = (d.get(c[0]) || '').toString().trim();
        if (v) lignes.push(c[1] + ' : ' + v);
      });
      return lignes.join('\n');
    };
    // Un champ oublié est dit en clair, sous le champ, et l'écran y remonte
    var valider = function () {
      var premier = null;
      form.querySelectorAll('[required]').forEach(function (c) {
        var msg = c.parentNode.querySelector('.champ__erreur');
        var vide = !c.value.trim();
        c.setAttribute('aria-invalid', String(vide));
        if (vide && !msg) {
          msg = document.createElement('p');
          msg.className = 'champ__erreur';
          msg.id = c.id + '-erreur';
          msg.textContent = 'À remplir : « ' + c.labels[0].textContent + ' ».';
          c.parentNode.appendChild(msg);
          c.setAttribute('aria-describedby', msg.id);
        } else if (!vide && msg) {
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
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!valider()) return;
      window.open('https://wa.me/2250717859090?text=' + encodeURIComponent(composer()), '_blank', 'noopener');
    });
    var parEmail = document.getElementById('devis-email');
    if (parEmail) parEmail.addEventListener('click', function () {
      if (!valider()) return;
      window.location.href = 'mailto:coulb35@gmail.com?subject=' + encodeURIComponent('Demande de devis') + '&body=' + encodeURIComponent(composer());
    });
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
