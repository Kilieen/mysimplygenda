// notes.js
// Gère l'affichage et la mise à jour des notes pour les matières.

// Liste des sujets/matières extraits de l'emploi du temps
function getSubjects() {
  const set = new Set();
  // weeklySchoolEvents est défini dans app.js
  weeklySchoolEvents.forEach(ev => {
    // Exclure les intitulés qui ne correspondent pas à une matière
    const skip = ['Rattrapage / Congé', 'Rattrapage', 'Congé', 'Test', 'Examens'];
    if (!skip.some(s => ev.title.toLowerCase().includes(s.toLowerCase()))) {
      set.add(ev.title);
    }
  });
  return Array.from(set).sort();
}

// Afficher la page des notes
async function renderNotes() {
  const container = document.getElementById('notesContainer');
  if (!container) return;
  // Effacer le contenu précédent
  container.innerHTML = '';
  // Vérifier l'utilisateur connecté
  if (!supabaseUser) {
    container.textContent = 'Connectez-vous pour voir vos notes.';
    return;
  }
  const role = supabaseUser.user_metadata?.role;
  if (role !== 'student') {
    container.textContent = 'La fonction Notes est réservée aux étudiants.';
    return;
  }
  // Récupérer les sujets et les notes de la base
  const subjects = getSubjects();
  // Charger toutes les notes depuis la base et les grouper par matière
  const notesBySubject = {};
  try {
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .eq('user_id', supabaseUser.id);
    if (error) throw error;
    data.forEach(row => {
      if (!notesBySubject[row.subject]) {
        notesBySubject[row.subject] = [];
      }
      notesBySubject[row.subject].push(row.grade);
    });
  } catch (err) {
    console.warn('Erreur de chargement des notes:', err);
  }
  // Créer un tableau pour afficher les notes et leurs moyennes
  const table = document.createElement('table');
  table.className = 'notes-table';
  const thead = document.createElement('thead');
  const hr = document.createElement('tr');
  ['Matière', 'Notes', 'Ajouter une note', 'Moyenne'].forEach(txt => {
    const th = document.createElement('th');
    th.textContent = txt;
    hr.appendChild(th);
  });
  thead.appendChild(hr);
  table.appendChild(thead);
  const tbody = document.createElement('tbody');
  subjects.forEach(subject => {
    const tr = document.createElement('tr');
    // Colonne matière
    const tdSubject = document.createElement('td');
    tdSubject.textContent = subject;
    tr.appendChild(tdSubject);
    // Colonne notes listées
    const tdNotes = document.createElement('td');
    const grades = notesBySubject[subject] || [];
    tdNotes.textContent = grades.length ? grades.join(', ') : '—';
    tr.appendChild(tdNotes);
    // Colonne bouton ajouter
    const tdAdd = document.createElement('td');
    const addBtn = document.createElement('button');
    addBtn.textContent = 'Ajouter';
    addBtn.className = 'primary';
    addBtn.addEventListener('click', async () => {
      const inputVal = prompt(`Ajouter une note pour ${subject} (0–6) :`);
      if (inputVal === null) return;
      const val = parseFloat(inputVal);
      if (isNaN(val) || val < 0 || val > 6) {
        alert('Veuillez saisir une note entre 0 et 6.');
        return;
      }
      try {
        const { error } = await supabase.from('notes').insert({
          user_id: supabaseUser.id,
          subject: subject,
          grade: val,
        });
        if (error) throw error;
        // Recharger l’affichage des notes après insertion
        renderNotes();
      } catch (err) {
        alert(err.message || 'Erreur lors de la sauvegarde de la note.');
      }
    });
    tdAdd.appendChild(addBtn);
    tr.appendChild(tdAdd);
    // Colonne moyenne
    const tdAvg = document.createElement('td');
    const avg = grades.length
      ? (grades.reduce((sum, g) => sum + g, 0) / grades.length).toFixed(2)
      : '—';
    tdAvg.textContent = avg;
    tr.appendChild(tdAvg);
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  container.appendChild(table);
}