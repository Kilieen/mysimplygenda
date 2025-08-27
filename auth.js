// auth.js
// Ce fichier gère la navigation entre les pages (accueil, connexion, inscription) et
// l’authentification avec Supabase. Après connexion/inscription, il déclenche
// l’initialisation de l’application via initAppAfterAuth() définie dans app.js.

document.addEventListener('DOMContentLoaded', async () => {
  // Récupération des éléments de page
  const landingPage = document.getElementById('landingPage');
  const loginPage = document.getElementById('loginPage');
  const signupPage = document.getElementById('signupPage');
  const appPage = document.getElementById('appPage');

  // Boutons de navigation sur la page d’accueil
  const landingLogin = document.getElementById('landingLogin');
  const landingSignup = document.getElementById('landingSignup');

  // Boutons de retour depuis login/signup vers l’accueil
  const backToLanding1 = document.getElementById('backToLanding1');
  const backToLanding2 = document.getElementById('backToLanding2');

  // Liens pour basculer entre login et signup
  const linkToSignup = document.getElementById('linkToSignup');
  const linkToLogin = document.getElementById('linkToLogin');

  // Formulaires
  const loginForm = document.getElementById('loginForm');
  const signupForm = document.getElementById('signupForm');

  // Champs du formulaire d’inscription
  const signupRole = document.getElementById('signupRole');
  const classSelector = document.getElementById('classSelector');
  const signupClass = document.getElementById('signupClass');

  // Fonction utilitaire : afficher une seule page et cacher les autres
  function showOnly(pageElement) {
    const pages = [landingPage, loginPage, signupPage, appPage];
    pages.forEach((p) => {
      if (p === pageElement) {
        p.classList.remove('hidden');
      } else {
        p.classList.add('hidden');
      }
    });
  }

  // Gestion des actions sur la landing
  if (landingLogin) {
    landingLogin.addEventListener('click', () => {
      showOnly(loginPage);
    });
  }
  if (landingSignup) {
    landingSignup.addEventListener('click', () => {
      showOnly(signupPage);
    });
  }

  // Liens retour vers l’accueil
  if (backToLanding1) {
    backToLanding1.addEventListener('click', (e) => {
      e.preventDefault();
      showOnly(landingPage);
    });
  }
  if (backToLanding2) {
    backToLanding2.addEventListener('click', (e) => {
      e.preventDefault();
      showOnly(landingPage);
    });
  }

  // Liens bascule entre login et signup depuis les formulaires
  if (linkToSignup) {
    linkToSignup.addEventListener('click', (e) => {
      e.preventDefault();
      showOnly(signupPage);
    });
  }
  if (linkToLogin) {
    linkToLogin.addEventListener('click', (e) => {
      e.preventDefault();
      showOnly(loginPage);
    });
  }

  // Afficher le sélecteur de classe uniquement si rôle = student
  if (signupRole) {
    signupRole.addEventListener('change', () => {
      if (signupRole.value === 'student') {
        classSelector.classList.remove('hidden');
      } else {
        classSelector.classList.add('hidden');
      }
    });
  }

  // Connexion
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!supabase) {
        alert('Supabase n’est pas initialisé. Vérifiez config.js.');
        return;
      }
      const email = document.getElementById('loginEmail').value.trim();
      const password = document.getElementById('loginPassword').value;
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        // Authentification réussie → passer à l’app
        showOnly(appPage);
        if (typeof initAppAfterAuth === 'function') {
          await initAppAfterAuth();
        }
      } catch (err) {
        alert(err.message || 'Connexion échouée.');
      }
    });
  }

  // Inscription
  if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!supabase) {
        alert('Supabase n’est pas initialisé. Vérifiez config.js.');
        return;
      }
      // Récupérer les valeurs du formulaire
      const firstname = document.getElementById('signupFirstname').value.trim();
      const lastname = document.getElementById('signupLastname').value.trim();
      const email = document.getElementById('signupEmail').value.trim();
      const password = document.getElementById('signupPassword').value;
      const birthdate = document.getElementById('signupBirthdate').value || null;
      const address = document.getElementById('signupAddress').value.trim();
      const role = signupRole.value;
      const klass = role === 'student' ? signupClass.value : '';
      if (!firstname || !lastname || !email || !password) {
        alert('Veuillez remplir tous les champs requis.');
        return;
      }
      try {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              firstname,
              lastname,
              role,
              classChoice: klass,
              birthdate,
              address,
            },
          },
        });
        if (error) throw error;
        // Inscription réussie : afficher la page app et initialiser
        showOnly(appPage);
        if (typeof initAppAfterAuth === 'function') {
          await initAppAfterAuth();
        }
        // Si étudiant CFC1 → créer l’horaire par défaut
        if (role === 'student' && klass === 'CFC1' && typeof createDefaultScheduleForUser === 'function') {
          try {
            await createDefaultScheduleForUser();
            await loadStoredEvents();
            renderCalendar();
          } catch (e) {
            console.error('Erreur lors du chargement de l’horaire par défaut :', e);
          }
        }
      } catch (err) {
        alert(err.message || "Échec de l'inscription.");
      }
    });
  }

  // Vérifier l’état de session au chargement
  if (supabase) {
    const { data: { session } } = await supabase.auth.getSession();
    if (session && session.user) {
      // Utilisateur déjà connecté
      showOnly(appPage);
      if (typeof initAppAfterAuth === 'function') {
        await initAppAfterAuth();
      }
    } else {
      // Aucun utilisateur → afficher landing
      showOnly(landingPage);
    }
  } else {
    // Supabase non initialisé → afficher landing
    showOnly(landingPage);
  }
});