// notes.js
// Gère l'affichage et la mise à jour des notes pour les matières.

// Liste des sujets/matières extraits de l'emploi du temps
function getSubjects() {
  const set = new Set();
  // weeklySchoolEvents est défini dans app.js
  weeklySchoolEvents.forEach(ev => {
    set.add(ev.title);
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
  let notesMap = {};
  try {
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .eq('user_id', supabaseUser.id);
    if (error) throw error;
    data.forEach(row => {
      notesMap[row.subject] = row.grade;
    });
  } catch (err) {
    console.warn('Erreur de chargement des notes:', err);
  }
  // Créer un formulaire/tableau pour saisir les notes
  const table = document.createElement('table');
  table.className = 'notes-table';
  const thead = document.createElement('thead');
  const hr = document.createElement('tr');
  ['Matière', 'Note (0–6)'].forEach(txt => {
    const th = document.createElement('th');
    th.textContent = txt;
    hr.appendChild(th);
  });
  thead.appendChild(hr);
  table.appendChild(thead);
  const tbody = document.createElement('tbody');
  subjects.forEach(subject => {
    const tr = document.createElement('tr');
    const tdSubject = document.createElement('td');
    tdSubject.textContent = subject;
    const tdInput = document.createElement('td');
    const input = document.createElement('input');
    input.type = 'number';
    input.min = '0';
    input.max = '6';
    input.step = '0.5';
    input.value = notesMap[subject] != null ? notesMap[subject] : '';
    input.dataset.subject = subject;
    input.addEventListener('change', async () => {
      let val = parseFloat(input.value);
      if (isNaN(val) || val < 0 || val > 6) {
        alert('Veuillez saisir une note entre 0 et 6.');
        input.value = notesMap[subject] || '';
        return;
      }
      try {
        const { error } = await supabase.from('notes').upsert(
          { user_id: supabaseUser.id, subject: subject, grade: val },
          { onConflict: ['user_id', 'subject'] }
        );
        if (error) throw error;
        notesMap[subject] = val;
      } catch (err) {
        alert(err.message || 'Erreur lors de la sauvegarde de la note.');
      }
    });
    tdInput.appendChild(input);
    tr.appendChild(tdSubject);
    tr.appendChild(tdInput);
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  container.appendChild(table);
}