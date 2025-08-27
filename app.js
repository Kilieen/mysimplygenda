// app.js
// Ce fichier contient la logique de l’agenda et l’interface principale après
// authentification. Il s’appuie sur Supabase pour stocker les événements
// personnels. Les cours prédéfinis (emploi du temps) sont intégrés en local.

// Utilisateur Supabase actuellement connecté (rempli dans initAppAfterAuth).
let supabaseUser = null;

// Variables de configuration pour l’agenda
const PIXELS_PER_HOUR_MIN = 15;
const PIXELS_PER_HOUR_MAX = 100;
let PIXELS_PER_HOUR = 32; // Valeur initiale dézoomée; modifiable via zoom

// Semaine courante (lundi comme début de semaine)
let currentWeekStart;

// Liste des événements personnels stockés en base pour l’utilisateur
let personalEvents = [];

// Définition de l’emploi du temps scolaire (classes CFC1)
// Les heures sont au format HH:MM. Jour : 1=lundi … 5=vendredi.
const weeklySchoolEvents = [
  // Lundi
  { day: 1, start: '08:20', end: '09:55', title: 'DCO B' },
  { day: 1, start: '09:55', end: '12:00', title: 'Anglais' },
  { day: 1, start: '13:10', end: '14:40', title: 'DCO D' },
  { day: 1, start: '14:40', end: '16:00', title: 'Rattrapage / Congé' },
  // Mardi
  { day: 2, start: '08:20', end: '09:55', title: 'DCO A' },
  { day: 2, start: '09:55', end: '12:00', title: 'DCO B' },
  { day: 2, start: '13:10', end: '14:40', title: 'DCO E' },
  { day: 2, start: '14:40', end: '16:00', title: 'DCO C' },
  // Mercredi
  { day: 3, start: '08:20', end: '10:35', title: 'DCO C' },
  { day: 3, start: '10:35', end: '12:00', title: 'DCO E' },
  { day: 3, start: '13:10', end: '14:40', title: 'Anglais' },
  { day: 3, start: '14:40', end: '16:00', title: 'DCO D' },
  // Jeudi
  { day: 4, start: '08:20', end: '12:00', title: 'Sport' },
  { day: 4, start: '13:10', end: '15:20', title: 'DCO E' },
  { day: 4, start: '15:20', end: '16:00', title: 'Dactylographie' },
  // Vendredi
  { day: 5, start: '08:20', end: '12:00', title: 'EPCO' },
  { day: 5, start: '13:10', end: '16:00', title: 'DCO D' },
];

// Palette de couleurs pour chaque matière afin de différencier visuellement les cours.
const courseColors = {
  'DCO A': '#E57373',
  'DCO B': '#F06292',
  'DCO C': '#BA68C8',
  'DCO D': '#9575CD',
  'DCO E': '#64B5F6',
  'EPCO': '#4DB6AC',
  'Anglais': '#7986CB',
  'Sport': '#81C784',
  'Dactylographie': '#FFD54F',
  'Rattrapage / Congé': '#90A4AE',
};

// Liste des enseignants par matière (facultatif). Peut être enrichie selon les besoins.
const courseTeachers = {
  'DCO A': 'M. Martin',
  'DCO B': 'Mme Dupont',
  'DCO C': 'M. Bernard',
  'DCO D': 'Mme Leroy',
  'DCO E': 'M. Petit',
  'EPCO': 'Mme Muller',
  'Anglais': 'M. Stewart',
  'Sport': 'Coach',
  'Dactylographie': 'Mme Lopez',
  'Rattrapage / Congé': '',
};

// Périodes de vacances (inclusives) basées sur le calendrier CFC 2025‑2026
const holidayRanges = [
  { start: '2025-08-01', end: '2025-08-01' },
  { start: '2025-10-13', end: '2025-10-24' },
  { start: '2025-12-22', end: '2026-01-04' },
  { start: '2026-02-09', end: '2026-02-20' },
  { start: '2026-04-06', end: '2026-04-17' },
  { start: '2026-07-06', end: '2026-08-16' },
];

// Périodes d’examens semestriels (inclusives) basées sur le calendrier
const examRanges = [
  { start: '2025-12-15', end: '2025-12-19' },
  { start: '2026-03-16', end: '2026-03-20' },
  { start: '2026-06-15', end: '2026-06-19' },
];

// Fonction utilitaire : calcule le lundi de la semaine d’une date donnée
function startOfWeek(date) {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7; // convertit dimanche (0) en 6
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day);
  return d;
}

// Retourne une copie de la date mais avec heure/minute définies par hh:mm (string)
function dateWithTime(date, hhmm) {
  const [hh, mm] = hhmm.split(':').map((s) => parseInt(s, 10));
  const d = new Date(date);
  d.setHours(hh, mm, 0, 0);
  return d;
}

// Test si une date (Date) se situe dans un intervalle de jours [start, end] inclusif (format yyyy-mm-dd)
function inDateRange(date, range) {
  const ymd = date.toISOString().slice(0, 10);
  return ymd >= range.start && ymd <= range.end;
}

// Charge les événements personnels depuis Supabase pour l’utilisateur connecté
async function loadPersonalEvents() {
  if (!supabaseUser || !supabase) {
    personalEvents = [];
    return;
  }
  try {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('user_id', supabaseUser.id)
      .eq('deleted', false);
    if (error) throw error;
    // Convertir les timestamps en objets Date pour l’affichage
    personalEvents = (data || []).map((ev) => ({
      id: ev.id,
      title: ev.title,
      start: new Date(ev.start),
      end: new Date(ev.end),
      color: ev.color || '#e91e63',
      reminder: ev.reminder || 0,
    }));
  } catch (err) {
    console.error('Erreur de chargement des événements :', err);
    personalEvents = [];
  }
}

// Sauvegarde un nouvel événement personnel ou met à jour un événement existant
async function savePersonalEvent(event) {
  if (!supabaseUser || !supabase) return;
  try {
    if (event.id) {
      // Mise à jour
      const { error } = await supabase
        .from('events')
        .update({
          title: event.title,
          start: event.start.toISOString(),
          end: event.end.toISOString(),
          color: event.color,
          reminder: event.reminder,
        })
        .eq('id', event.id);
      if (error) throw error;
    } else {
      // Insertion
      const { data, error } = await supabase
        .from('events')
        .insert({
          user_id: supabaseUser.id,
          title: event.title,
          start: event.start.toISOString(),
          end: event.end.toISOString(),
          type: 'personnel',
          color: event.color,
          reminder: event.reminder,
          deleted: false,
        })
        .select()
        .single();
      if (error) throw error;
      event.id = data.id;
    }
    // Recharger la liste d’événements après modification
    await loadPersonalEvents();
    renderCalendar();
  } catch (err) {
    alert(err.message || 'Erreur lors de la sauvegarde de l’événement.');
  }
}

// Supprime (marque deleted=true) un événement personnel
async function deletePersonalEvent(eventId) {
  if (!supabaseUser || !supabase) return;
  try {
    const { error } = await supabase
      .from('events')
      .update({ deleted: true })
      .eq('id', eventId);
    if (error) throw error;
    await loadPersonalEvents();
    renderCalendar();
  } catch (err) {
    alert(err.message || 'Erreur lors de la suppression.');
  }
}

// Rendu du calendrier pour la semaine courante
function renderCalendar() {
  const container = document.getElementById('calendarContainer');
  if (!container) return;
  container.innerHTML = '';

  // Création de la colonne des heures (8h→18h)
  const timeCol = document.createElement('div');
  timeCol.className = 'time-column';
  for (let h = 8; h <= 18; h++) {
    const slot = document.createElement('div');
    slot.className = 'time-slot';
    slot.style.height = `var(--slot-height)`;
    slot.textContent = `${String(h).padStart(2, '0')}:00`;
    timeCol.appendChild(slot);
  }
  container.appendChild(timeCol);

  // Calcul des jours de la semaine
  const weekDays = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(currentWeekStart);
    d.setDate(d.getDate() + i);
    weekDays.push(d);
  }

  // Savoir si un jour est un jour de vacances ou d’examens
  function getDayState(date) {
    const holiday = holidayRanges.some((r) => inDateRange(date, r));
    const exam = examRanges.some((r) => inDateRange(date, r));
    return { holiday, exam };
  }

  // Rendu des colonnes de jours
  weekDays.forEach((date, index) => {
    const col = document.createElement('div');
    col.className = 'day-column';
    const dayIndex = (index + 1); // 1=lundi ... 7=dimanche
    const { holiday, exam } = getDayState(date);
    if (holiday) col.classList.add('holiday');
    if (exam) col.classList.add('exam');
    const todayCheck = new Date();
    if (date.toDateString() === todayCheck.toDateString()) {
      col.classList.add('today');
    }
    // Entête du jour
    const header = document.createElement('div');
    header.className = 'day-header';
    const options = { weekday: 'long', day: 'numeric', month: 'short' };
    header.textContent = date.toLocaleDateString('fr-CH', options);
    col.appendChild(header);

    // Hauteur totale pour 10 heures (8h→18h) : 10 * PIXELS_PER_HOUR
    const colHeight = PIXELS_PER_HOUR * 10;
    col.style.height = `${colHeight}px`;

    // Si période d’examens, afficher un bloc plein
    if (exam) {
      const examDiv = document.createElement('div');
      examDiv.className = 'event examen';
      examDiv.style.top = '0';
      examDiv.style.height = '100%';
      examDiv.textContent = 'Examens';
      col.appendChild(examDiv);
      container.appendChild(col);
      return;
    }
    // Si vacances, ne rien afficher
    if (holiday) {
      container.appendChild(col);
      return;
    }

    // Cours prédéfinis pour ce jour (si 1-5)
    weeklySchoolEvents.forEach((ev) => {
      if (ev.day === dayIndex) {
        const start = dateWithTime(date, ev.start);
        const end = dateWithTime(date, ev.end);
        const top = ((start.getHours() + start.getMinutes() / 60) - 8) * PIXELS_PER_HOUR;
        const height = ((end - start) / 3600000) * PIXELS_PER_HOUR;
        const div = document.createElement('div');
        div.className = 'event scolaire';
        div.style.top = `${top}px`;
        div.style.height = `${height}px`;
        // Utiliser une couleur spécifique et afficher l’enseignant si disponible
        const color = courseColors[ev.title] || '#3f51b5';
        const teacher = courseTeachers[ev.title] || '';
        div.style.backgroundColor = color;
        div.textContent = teacher ? `${ev.title} – ${teacher}` : ev.title;
        col.appendChild(div);
      }
    });

    // Événements personnels pour ce jour
    personalEvents.forEach((ev) => {
      const evDate = new Date(ev.start);
      if (evDate.toDateString() === date.toDateString()) {
        const start = new Date(ev.start);
        const end = new Date(ev.end);
        const top = ((start.getHours() + start.getMinutes() / 60) - 8) * PIXELS_PER_HOUR;
        const height = ((end - start) / 3600000) * PIXELS_PER_HOUR;
        const div = document.createElement('div');
        div.className = 'event personnel';
        div.style.top = `${top}px`;
        div.style.height = `${height}px`;
        div.style.backgroundColor = ev.color || '#e91e63';
        div.textContent = ev.title;
        // Cliquer pour modifier/supprimer
        div.addEventListener('click', () => {
          openEventModal(ev);
        });
        col.appendChild(div);
      }
    });

    container.appendChild(col);
  });

  // Mettre à jour l’étiquette de semaine
  const weekLabel = document.getElementById('weekLabel');
  if (weekLabel) {
    const start = weekDays[0];
    const end = weekDays[6];
    const options = { day: 'numeric', month: 'short', year: 'numeric' };
    weekLabel.textContent =
      start.toLocaleDateString('fr-CH', options) +
      ' – ' +
      end.toLocaleDateString('fr-CH', options);
  }
  // Mettre à jour la ligne « actuel » et le statut
  updateNowLine();
}

// Met à jour la ligne indiquant l’heure actuelle et le statut (heure/événement)
function updateNowLine() {
  // Supprimer l’ancienne ligne
  document.querySelectorAll('.now-line').forEach((el) => el.remove());
  const container = document.getElementById('calendarContainer');
  if (!container) return;
  const days = container.querySelectorAll('.day-column');
  // Calcul position actuelle
  const now = new Date();
  const hours = now.getHours() + now.getMinutes() / 60;
  const top = (hours - 8) * PIXELS_PER_HOUR;
  days.forEach((col) => {
    if (top >= 0 && top <= PIXELS_PER_HOUR * 10) {
      const line = document.createElement('div');
      line.className = 'now-line';
      line.style.top = `${top}px`;
      col.appendChild(line);
    }
  });
  // Mettre à jour la barre de statut
  const statusBar = document.getElementById('statusBar');
  if (statusBar) {
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    // Déterminer l’événement actuel (cours ou personnel)
    let current = null;
    // Rechercher d’abord dans l’emploi du temps scolaire
    const dow = (now.getDay() + 6) % 7 + 1; // 1=lundi
    weeklySchoolEvents.forEach((ev) => {
      if (!current && ev.day === dow) {
        const start = dateWithTime(now, ev.start);
        const end = dateWithTime(now, ev.end);
        if (now >= start && now < end) {
          current = ev.title;
        }
      }
    });
    // Puis dans les événements personnels
    personalEvents.forEach((ev) => {
      if (!current) {
        const st = ev.start;
        const en = ev.end;
        if (now >= st && now < en) {
          current = ev.title;
        }
      }
    });
    // Inclure la date complète dans la barre de statut pour plus de clarté
    const dateStr = now.toLocaleDateString('fr-CH', { weekday: 'long', day: 'numeric', month: 'numeric', year: 'numeric' });
    statusBar.textContent = `${dateStr} • ${hh}:${mm} • ${current || '—'}`;
  }
}

// Ouvre la modale pour créer ou modifier un événement personnel
function openEventModal(event) {
  const modal = document.getElementById('eventModal');
  if (!modal) return;
  const titleInput = document.getElementById('eventTitle');
  const startInput = document.getElementById('eventStart');
  const endInput = document.getElementById('eventEnd');
  const colorInput = document.getElementById('eventColor');
  const reminderInput = document.getElementById('eventReminder');
  const deleteBtn = document.getElementById('deleteEvent');
  const saveBtn = document.getElementById('saveEvent');
  const cancelBtn = document.getElementById('cancelEvent');
  const modalTitle = document.getElementById('modalTitle');
  // Préremplir
  if (event && event.id) {
    modalTitle.textContent = 'Modifier l’événement';
    titleInput.value = event.title;
    startInput.value = event.start.toISOString().slice(0, 16);
    endInput.value = event.end.toISOString().slice(0, 16);
    colorInput.value = event.color || '#e91e63';
    reminderInput.value = event.reminder || 0;
    deleteBtn.classList.remove('hidden');
  } else {
    modalTitle.textContent = 'Nouvel événement';
    const now = new Date();
    now.setMinutes(0, 0, 0);
    const start = new Date(now);
    start.setHours(now.getHours() + 1);
    const end = new Date(start);
    end.setHours(start.getHours() + 1);
    titleInput.value = '';
    startInput.value = start.toISOString().slice(0, 16);
    endInput.value = end.toISOString().slice(0, 16);
    colorInput.value = '#e91e63';
    reminderInput.value = 10;
    deleteBtn.classList.add('hidden');
  }
  modal.classList.remove('hidden');
  // Sauvegarde
  saveBtn.onclick = async (e) => {
    e.preventDefault();
    const newEv = {
      id: event && event.id,
      title: titleInput.value.trim() || 'Événement',
      start: new Date(startInput.value),
      end: new Date(endInput.value),
      color: colorInput.value,
      reminder: parseInt(reminderInput.value, 10) || 0,
    };
    if (newEv.end <= newEv.start) {
      alert('La fin doit être après le début.');
      return;
    }
    await savePersonalEvent(newEv);
    modal.classList.add('hidden');
  };
  // Suppression
  deleteBtn.onclick = async (e) => {
    e.preventDefault();
    if (event && event.id) {
      if (confirm('Supprimer cet événement ?')) {
        await deletePersonalEvent(event.id);
        modal.classList.add('hidden');
      }
    }
  };
  // Annuler
  cancelBtn.onclick = (e) => {
    e.preventDefault();
    modal.classList.add('hidden');
  };
}

// Initialisation de l’application après authentification
async function initAppAfterAuth() {
  if (!supabase || !supabase.auth) {
    console.error('Supabase non initialisé.');
    return;
  }
  // Récupérer l’utilisateur et ses métadonnées
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    console.error('Impossible de récupérer l’utilisateur.');
    return;
  }
  supabaseUser = user;
  // Mettre à jour l’en-tête et le sidebar
  const appTitle = document.getElementById('appTitle');
  const userClass = document.getElementById('userClass');
  const userName = document.getElementById('userName');
  const meta = user.user_metadata || {};
  if (appTitle) {
    const klass = meta.classChoice && meta.classChoice !== 'custom' ? ` – ${meta.classChoice}` : '';
    appTitle.textContent = `MySimplyGenda${klass}`;
  }
  if (userClass) {
    userClass.textContent = meta.role === 'student' ? (meta.classChoice || '') : 'Privé';
  }
  if (userName) {
    userName.textContent = `${meta.firstname || ''} ${meta.lastname || ''}`;
  }

  // Afficher l’établissement si renseigné (sur la page d’accueil / bandeau)
  if (meta.school && appTitle) {
    appTitle.textContent += meta.school ? ` – ${meta.school}` : '';
  }
  // Charger les événements personnels
  await loadPersonalEvents();
  // Initialiser la semaine courante
  currentWeekStart = startOfWeek(new Date());
  renderCalendar();
  // Gestion du changement de semaine
  const prevBtn = document.getElementById('prevWeek');
  const nextBtn = document.getElementById('nextWeek');
  if (prevBtn) {
    prevBtn.onclick = () => {
      currentWeekStart.setDate(currentWeekStart.getDate() - 7);
      renderCalendar();
    };
  }
  if (nextBtn) {
    nextBtn.onclick = () => {
      currentWeekStart.setDate(currentWeekStart.getDate() + 7);
      renderCalendar();
    };
  }
  // Gestion du zoom
  const zoomInBtn = document.getElementById('zoomIn');
  const zoomOutBtn = document.getElementById('zoomOut');
  if (zoomInBtn && zoomOutBtn) {
    zoomInBtn.onclick = () => {
      PIXELS_PER_HOUR = Math.min(PIXELS_PER_HOUR_MAX, Math.round(PIXELS_PER_HOUR * 1.25));
      document.documentElement.style.setProperty('--slot-height', `${PIXELS_PER_HOUR}px`);
      renderCalendar();
    };
    zoomOutBtn.onclick = () => {
      PIXELS_PER_HOUR = Math.max(PIXELS_PER_HOUR_MIN, Math.round(PIXELS_PER_HOUR / 1.25));
      document.documentElement.style.setProperty('--slot-height', `${PIXELS_PER_HOUR}px`);
      renderCalendar();
    };
  }
  // Bouton ajout
  const fab = document.getElementById('fabAdd');
  if (fab) {
    fab.onclick = () => {
      openEventModal(null);
    };
  }
  // Navigation latérale
  const sideNav = document.getElementById('sideNav');
  const agendaMain = document.getElementById('agendaMain');
  const notesMain = document.getElementById('notesMain');
  const profileMain = document.getElementById('profileMain');
  const sideNotesBtn = document.getElementById('sideNotes');
  const sideLogoutBtn = document.getElementById('sideLogout');
  const profileBtn = document.querySelector('button[data-target="profileMain"]');
  function activateSection(sectionId) {
    [agendaMain, notesMain, profileMain].forEach((sec) => {
      if (sec) sec.classList.add('hidden');
    });
    const target = document.getElementById(sectionId);
    if (target) target.classList.remove('hidden');
    // Marquer le bouton actif
    sideNav.querySelectorAll('button').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.target === sectionId);
    });
    // Notes : charger les notes si la fonction existe
    if (sectionId === 'notesMain' && typeof renderNotes === 'function') {
      renderNotes();
    }
    if (sectionId === 'profileMain') {
      populateProfile();
    }
  }
  // Boutons latéraux
  if (sideNav) {
    sideNav.querySelectorAll('button[data-target]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.target;
        activateSection(target);
      });
    });
  }
  // Déconnexion
  if (sideLogoutBtn) {
    sideLogoutBtn.onclick = async () => {
      await supabase.auth.signOut();
      // Recharger la page pour revenir à la landing
      window.location.reload();
    };
  }
  // Par défaut, afficher l’agenda
  activateSection('agendaMain');

  // Gérer l'affichage/masquage de la barre latérale
  const sidebarToggle = document.getElementById('sidebarToggle');
  const appPageEl = document.getElementById('appPage');
  if (sidebarToggle && appPageEl) {
    sidebarToggle.onclick = () => {
      appPageEl.classList.toggle('collapsed');
    };
  }
}

// Remplit la section profileMain avec les informations de l’utilisateur
function populateProfile() {
  const details = document.getElementById('accountDetails');
  if (!details || !supabaseUser) return;
  const meta = supabaseUser.user_metadata || {};
  details.innerHTML = '';
  // Gérer l’affichage de la photo de profil
  const avatarImg = document.getElementById('profileAvatar');
  const avatarFileInput = document.getElementById('avatarFile');
  if (avatarImg) {
    const url = meta.avatar_url || '';
    if (url) {
      avatarImg.src = url;
      avatarImg.classList.remove('hidden');
    } else {
      avatarImg.classList.add('hidden');
    }
  }
  const fields = [
    { label: 'Prénom', value: meta.firstname || '' },
    { label: 'Nom', value: meta.lastname || '' },
    { label: 'E‑mail', value: supabaseUser.email || '' },
    { label: 'Date de naissance', value: meta.birthdate || '' },
    { label: 'Adresse', value: meta.address || '' },
    { label: 'Rôle', value: meta.role === 'student' ? 'Étudiant·e' : 'Privé' },
    { label: 'Classe', value: meta.classChoice || '' },
  ];
  fields.forEach((f) => {
    const row = document.createElement('div');
    row.className = 'account-row';
    row.innerHTML = `<strong>${f.label} :</strong> ${f.value}`;
    details.appendChild(row);
  });
  // Bouton changer de mot de passe – pour l’instant, redirige vers Supabase UI (ou affiche un message)
  const changePwBtn = document.getElementById('changePassword');
  if (changePwBtn) {
    changePwBtn.onclick = () => {
      alert('Pour changer votre mot de passe, utilisez la fonction de réinitialisation de mot de passe via Supabase.');
    };
  }

  // Gestion du changement de photo de profil
  if (avatarFileInput) {
    avatarFileInput.onchange = async () => {
      const file = avatarFileInput.files && avatarFileInput.files[0];
      if (!file) return;
      // Générer un nom de fichier unique basé sur l’ID utilisateur et la date
      const fileExt = file.name.split('.').pop();
      const fileName = `${supabaseUser.id}-${Date.now()}.${fileExt}`;
      try {
        // Télécharger le fichier dans le bucket avatars (à créer au préalable dans Supabase)
        const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, file, { upsert: true });
        if (uploadError) throw uploadError;
        // Récupérer l’URL publique du fichier
        const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
        const publicUrl = data.publicUrl;
        // Mettre à jour les métadonnées de l’utilisateur avec l’URL de l’avatar
        const { error: metaErr } = await supabase.auth.updateUser({ data: { avatar_url: publicUrl } });
        if (metaErr) throw metaErr;
        // Mettre à jour l’affichage
        if (avatarImg) {
          avatarImg.src = publicUrl;
          avatarImg.classList.remove('hidden');
        }
        alert('Photo de profil mise à jour !');
      } catch (err) {
        console.error(err);
        alert(err.message || 'Erreur lors de la mise à jour de la photo de profil.');
      }
    };
  }
}

// Expose initAppAfterAuth dans l’espace global afin qu’auth.js puisse l’appeler
window.initAppAfterAuth = initAppAfterAuth;
// Expose createDefaultScheduleForUser (optionnel) pour compatibilité, ici vide
window.createDefaultScheduleForUser = async function() {
  // Dans cette version simplifiée, l’horaire par défaut est intégré directement
  return;
};
// Expose loadStoredEvents pour compatibilité
window.loadStoredEvents = loadPersonalEvents;
// Expose renderCalendar pour compatibilité
window.renderCalendar = renderCalendar;