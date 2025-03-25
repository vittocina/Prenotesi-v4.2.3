import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabaseUrl = "https://nwxisyjucugaacoujama.supabase.co";
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53eGlzeWp1Y3VnYWFjb3VqYW1hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzkzMTIxMzYsImV4cCI6MjA1NDg4ODEzNn0.i6V5pqS_zGL7XFWhGdEJdlOJ7dyjXifLD_gGofZpnJY";
const supabase = createClient(supabaseUrl, supabaseKey);

/* ========================
   FUNZIONE DEBOUNCE
   ======================== */
function debounce(func, delay) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), delay);
  };
}

// Elementi DOM
const authSection = document.getElementById('auth-section');
const appSection = document.getElementById('app-section');
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const logoutBtn = document.getElementById('logout-btn');
const userNameDisplay = document.getElementById('user-name');
const roomSelect = document.getElementById('room-select');
const deskGrid = document.getElementById('desk-grid');
const bookingDateInput = document.getElementById('booking-date');
const bookingSummary = document.getElementById('booking-summary');
const adminDropdown = document.getElementById('admin-dropdown');
const openRoleModalTrigger = document.getElementById('open-role-modal');
const openRoomModalTrigger = document.getElementById('open-room-modal');
const adminRoleForm = document.getElementById('admin-role-form');
const adminUserEmailSelect = document.getElementById('admin-user-email');
const removeAdminBtn = document.getElementById('remove-admin-btn');
const adminRoomForm = document.getElementById('admin-room-form');
const adminRoomUserEmailSelect = document.getElementById('admin-room-user-email');
const adminRoomSelect = document.getElementById('admin-room-select');
const removeRoomBtn = document.getElementById('remove-room-btn');
const bookingForm = document.getElementById('booking-form');
const editBookingForm = document.getElementById('edit-booking-form');
const openDeleteBookingModal = document.getElementById('open-delete-booking-modal');
const deleteBookingModal = document.getElementById('deleteBookingModal');
const sidebarOverlay = document.getElementById('sidebar-overlay');
const profileBtn = document.getElementById('profile-btn');
const userInitials = document.getElementById('user-initials');
const userProfilePic = document.getElementById('user-profile-pic');


// Variabili globali
let currentUser = null;
let currentProfile = null;
let rooms = [];
let currentEditingBookingId = null;
let selectedBookings = new Set();
let currentPage = 1;
const pageSize = 7; // Numero di elementi per pagina
let filteredUserBookings = [];
let adminCurrentPage = 1;
const adminPageSize = 5; // Numero di righe per pagina nella tabella admin
let filteredAdminBookings = [];
let bookingIds = [];

// Variabili per la prenotazione corrente
let currentBookingRoomId = null;
let currentBookingDeskNumber = null;

// Variabile per memorizzare l'utente e non chiamare supabase.auth.getUser() ogni volta.
// let user = null;

/**
 * Recupera il profilo. Se non esiste, lo crea.
 */
async function getProfile(userId) {
  let { data, error } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, role, theme, profile_picture, company')
    .eq('id', userId)
    .maybeSingle();
  if (error) {
    console.error('Errore nel recupero del profilo:', error);
    return null;
  }
  if (!data) {
    console.warn('Profilo non trovato, creo un profilo di default.');
    const { data: newProfile, error: insertError } = await supabase
      .from('profiles')
      .insert([{ 
        id: userId, 
        first_name: 'Utente', 
        last_name: '', 
        theme: 'dark', 
        profile_picture: null, 
        company: 'progesi' // Aggiunto valore predefinito 'progesi'
      }])
      .select();
    if (insertError || !newProfile || newProfile.length === 0) {
      console.error('Errore durante la creazione del profilo di default:', insertError);
      return null;
    }
    return newProfile[0];
  }
  return data;
}

// Carica le stanze dal database
async function loadRooms() {
  let { data, error } = await supabase.from('rooms').select('*');
  if (!error) {
    rooms = data;
    populateRoomFilter();
  }
}

// Renderizza le opzioni del menu a tendina per la selezione della stanza
async function renderRoomOptions() {
  roomSelect.innerHTML = '';
  let availableRooms = rooms;
  if (currentProfile.role !== 'ADMIN') {
    // Prenotazioni degli altri utenti visibili solo all'ADMIN
    let { data: userRooms, error } = await supabase
      .from('user_rooms')
      .select('room_id')
      .eq('user_id', currentUser.id);
    if (error) {
      console.error("Errore nel recupero delle stanze assegnate:", error);
    }
    let assignedRoomIds = userRooms ? userRooms.map(ur => ur.room_id) : [];
    availableRooms = rooms.filter(r => assignedRoomIds.includes(r.id));
  }
  availableRooms.forEach(room => {
    let option = document.createElement('option');
    option.value = room.id;
    option.textContent = `${room.name} (Piano ${room.floor})`;
    roomSelect.appendChild(option);
  });
}

// Renderizza la griglia delle scrivanie
async function renderDeskGrid() {
  deskGrid.classList.add('opacity-50', 'transition-opacity');
  deskGrid.innerHTML = '';

  const roomId = parseInt(roomSelect.value);
  const room = rooms.find(r => r.id === roomId);
  
  if (!room) {
    deskGrid.classList.remove('opacity-50');
    return;
  }

  const bookingDate = bookingDateInput.value;
if (!bookingDate) {
  deskGrid.innerHTML = `
    <div class="col-span-full flex items-center justify-center min-h-[20vh]">
      <p id="no-date-message" class="text-center bg-table-header rounded-lg p-6 shadow-md">
        Seleziona una data per visualizzare le scrivanie
      </p>
    </div>
  `;
  deskGrid.classList.remove('opacity-50');
  return;
}

  let { data: roomBookings, error } = await supabase
    .from('bookings')
    .select('*, rooms(name, floor), profiles(first_name, last_name, profile_picture)')
    .eq('booking_date', bookingDate)
    .eq('room_id', roomId);

  if (error) {
    console.error("Errore nel recupero delle prenotazioni per la stanza:", error);
    deskGrid.classList.remove('opacity-50');
    return;
  }

  for (let i = 1; i <= room.desk_count; i++) {
    const colDiv = document.createElement('div');
    colDiv.className = 'col-span-1';
    
    const deskDiv = document.createElement('div');
    deskDiv.dataset.deskNumber = i;
    deskDiv.dataset.roomId = roomId;

    const booking = roomBookings ? roomBookings.find(b => b.desk_number === i) : null;

    if (booking) {
      const userName = booking.booking_name || `${booking.profiles.first_name} ${booking.profiles.last_name}`;
      const profilePicture = booking.profiles.profile_picture;

      // Contenuto centrato con flex e justify-center
      let deskContent = `
        <div class="flex flex-col items-center justify-center gap-2 text-center">
      `;
      
      // Aggiungi la foto se presente
      if (profilePicture) {
        deskContent += `
          <img src="${profilePicture}" alt="${userName}" class="w-8 h-8 rounded-full object-cover">
        `;
      }

      deskContent += `
          <div class="flex flex-col gap-1">
            <span class="text-base font-medium">${userName}</span>
            <span class="text-xs opacity-75">${booking.booking_slot}</span>
          </div>
        </div>
      `;

      deskDiv.innerHTML = deskContent;
      
      let borderClass = booking.user_id === currentUser.id ? 'border-green' : '';
      let bgColor = '--desk-full-day';
      let textColor = '--text-on-dark';
  
      switch (booking.booking_slot) {
        case 'Intera giornata':
          bgColor = '--desk-full-day';
          textColor = '--text-on-dark';
          break;
        case 'Mezza giornata (Mattina)':
          bgColor = '--desk-morning';
          textColor = '--text-on-dark';
          break;
        case 'Mezza giornata (Pomeriggio)':
          bgColor = '--desk-afternoon';
          textColor = '--text-on-light';
          break;
      }

      deskDiv.style.backgroundColor = `var(${bgColor})`;
      deskDiv.style.color = `var(${textColor})`;
      deskDiv.className = `p-4 rounded opacity-90 ${borderClass} 
        ${(currentProfile.role === 'ADMIN' || (currentProfile.role === 'BASE' && booking.user_id === currentUser.id)) 
        ? 'cursor-pointer hover:brightness-125' : 'cursor-default'}
        flex items-center justify-center min-h-[100px] transition-all duration-200`; // Aggiunto flex e altezza minima

      if (currentProfile.role === 'ADMIN' || (currentProfile.role === 'BASE' && booking.user_id === currentUser.id)) {
        deskDiv.addEventListener('click', () => handleDeskClick(roomId, i));
      }
    } else {
      deskDiv.textContent = `Scrivania ${i}`;
      deskDiv.className = 'desk-not-booked p-4 rounded text-center cursor-pointer transition-all duration-200 flex items-center justify-center min-h-[100px]'; // Centrato anche per scrivanie non prenotate
      deskDiv.addEventListener('click', () => handleDeskClick(roomId, i));
    }

    colDiv.appendChild(deskDiv);
    deskGrid.appendChild(colDiv);
  }

  setTimeout(() => {
    deskGrid.classList.remove('opacity-50');
  }, 300);
}
/**
 * Quando si clicca su una scrivania, pre-compila il campo "booking-name" e apre la modale di prenotazione.
 */
async function handleDeskClick(roomId, deskNumber) {
  const bookingDate = bookingDateInput.value;
  if (!bookingDate) {
    await showNotificationPopup("Seleziona una data prima di prenotare.");
    return;
  }

  currentBookingRoomId = roomId;
  currentBookingDeskNumber = deskNumber;

  // Verifica se la scrivania è già prenotata
  const { data: existingBooking, error } = await supabase
    .from('bookings')
    .select('*, profiles(first_name, last_name)')
    .eq('booking_date', bookingDate)
    .eq('room_id', roomId)
    .eq('desk_number', deskNumber)
    .maybeSingle();

  if (error) {
    console.error("Errore nel recupero della prenotazione:", error);
    return;
  }

  if (existingBooking) {
    // Se l'utente è ADMIN, mostra la modale di dettaglio
    if (currentProfile.role === 'ADMIN') {
      document.getElementById('detail-user').textContent = 
        `${existingBooking.profiles.first_name} ${existingBooking.profiles.last_name}`;
      document.getElementById('detail-slot').textContent = existingBooking.booking_slot;
      currentEditingBookingId = existingBooking.id;
      showModal('bookingDetailsModal');
    } 
    // Se l'utente è BASE e la prenotazione è sua, mostra la modale di dettaglio
    else if (currentProfile.role === 'BASE' && existingBooking.user_id === currentUser.id) {
      document.getElementById('detail-user').textContent = 
        `${existingBooking.profiles.first_name} ${existingBooking.profiles.last_name}`;
      document.getElementById('detail-slot').textContent = existingBooking.booking_slot;
      currentEditingBookingId = existingBooking.id;
      showModal('bookingDetailsModal');
    } else {
      await showNotificationPopup("Non hai i permessi per modificare questa prenotazione.");
    }
  } else {
    // Logica esistente per le nuove prenotazioni
    const bookingUserSelect = document.getElementById('booking-user-select');
    const bookingNameInput = document.getElementById('booking-name');

    if (currentProfile.role === 'ADMIN') {
      bookingUserSelect.classList.remove('hidden');
      bookingNameInput.classList.add('hidden');
      await loadUserOptions();
    } else {
      bookingUserSelect.classList.add('hidden');
      bookingNameInput.classList.remove('hidden');
      bookingNameInput.value = `${currentProfile.first_name} ${currentProfile.last_name}`;
    }
    showModal('bookingModal');
  }
}

async function loadUserOptions() {
  const { data: users, error } = await supabase.from('profiles').select('id, first_name, last_name');

  if (error) {
    console.error("Errore nel caricamento degli utenti:", error);
    return;
  }

  const bookingUserSelect = document.getElementById('booking-user-select');
  bookingUserSelect.innerHTML = '';

  users.forEach(user => {
    const option = document.createElement('option');
    option.value = user.id;
    option.textContent = `${user.first_name} ${user.last_name}`;
    bookingUserSelect.appendChild(option);
  });
}


/**
 * Gestisce il submit del form di prenotazione.
 */
bookingForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const bookingDate = bookingDateInput.value;
  if (!bookingDate) {
    await showNotificationPopup("Seleziona una data.");
    return;
  }

  const bookingSlot = document.getElementById('booking-slot-select').value;
  const bookingUserSelect = document.getElementById('booking-user-select');
  const bookingNameInput = document.getElementById('booking-name');

  let selectedUserId = currentUser.id;
  let bookingName = bookingNameInput.value;

  if (currentProfile.role === 'ADMIN') {
    selectedUserId = bookingUserSelect.value;
    const selectedOption = bookingUserSelect.options[bookingUserSelect.selectedIndex];
    bookingName = selectedOption.textContent;
  }

  if (currentProfile.role !== 'ADMIN') {
    let { data: userBookings, error: userError } = await supabase
      .from('bookings')
      .select('*')
      .eq('user_id', currentUser.id)
      .eq('booking_date', bookingDate);

    if (userError) {
      console.error("Errore nel controllo delle prenotazioni dell'utente:", userError);
      return;
    }

    if (bookingSlot === 'Intera giornata' && userBookings.length > 0) {
      await showNotificationPopup("Hai già una prenotazione per questa data.");
      return;
    }

    if (bookingSlot !== 'Intera giornata' && userBookings.filter(b => b.booking_slot.includes('Mezza giornata')).length >= 2) {
      await showNotificationPopup("Hai già prenotato due slot per questa giornata.");
      return;
    }
  }

  let { error: insertError } = await supabase
    .from('bookings')
    .insert([{
      user_id: selectedUserId,
      room_id: currentBookingRoomId,
      desk_number: currentBookingDeskNumber,
      booking_date: bookingDate,
      booking_slot: bookingSlot,
      booking_name: bookingName
    }]);

  if (insertError) {
    console.error("Errore durante la prenotazione:", insertError);
    await showNotificationPopup("Errore durante la prenotazione.");
    return;
  }

  await showNotificationPopup("Prenotazione effettuata con successo");
  hideModal('bookingModal');
  loadBookings();
  renderDeskGrid();
});

/**
 * Renderizza il riepilogo delle prenotazioni.
 * Ogni prenotazione mostra un pulsante verde (matita) per modificarla e un "-" rosso per cancellarla.
 */
async function loadBookings() {
  let { data, error } = await supabase
    .from('bookings')
    .select('*, rooms(name, floor), profiles(first_name, last_name)')
    .order('booking_date', { ascending: false });

  if (error) {
    console.error("Errore nel caricamento delle prenotazioni:", error);
    return;
  }

  const adminBookingsBody = document.getElementById('admin-bookings-body');
  const userBookingsBody = document.getElementById('user-bookings-body');
  const roomFilterSelect = document.getElementById('filter-room');
  

  adminBookingsBody.innerHTML = '';
  userBookingsBody.innerHTML = '';
  roomFilterSelect.innerHTML = '<option value="">Tutte</option>';

  let hasAdminBookings = false;
  let hasUserBookings = false;
  let roomSet = new Set();

  data.forEach(booking => {
    const tr = document.createElement('tr');
    tr.className = 'border-t border-gray-600 hover:bg-gray-700';

    // Colonna Data
    const tdData = document.createElement('td');
    tdData.className = 'p-2';
    tdData.textContent = booking.booking_date;
    tr.appendChild(tdData);

    // Colonna Stanza
    const tdStanza = document.createElement('td');
    tdStanza.className = 'p-2';
    tdStanza.textContent = booking.rooms ? `${booking.rooms.name} (Piano ${booking.rooms.floor})` : 'Sconosciuto';
    tr.appendChild(tdStanza);

    // Colonna Slot
    const tdSlot = document.createElement('td');
    tdSlot.className = 'p-2';
    tdSlot.textContent = booking.booking_slot;
    tr.appendChild(tdSlot);

    if (booking.user_id === currentUser.id) {
      const tdAzioni = document.createElement('td');
      tdAzioni.className = 'p-2 flex flex-col md:flex-row space-y-2 md:space-y-0 md:space-x-4';

      const editBtn = document.createElement('button');
      editBtn.className = 'text-green-600 hover:text-green-700 p-3 text-xl';
      editBtn.innerHTML = '<i class="fas fa-pencil-alt"></i>';
      editBtn.addEventListener('click', () => openEditBooking(booking));

      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'text-red-500 hover:text-red-600 p-3 text-xl';
      cancelBtn.innerHTML = '<i class="fas fa-trash"></i>';
      cancelBtn.addEventListener('click', () => cancelBooking(booking.id));

      tdAzioni.appendChild(editBtn);
      tdAzioni.appendChild(cancelBtn);
      tr.appendChild(tdAzioni);

      adminBookingsBody.appendChild(tr);
      hasAdminBookings = true;
    } else if (currentProfile.role === 'ADMIN') {
      const tdCheckbox = document.createElement('td');
      tdCheckbox.className = 'p-2';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'booking-checkbox rounded border-gray-400 text-blue-600 focus:ring-blue-500';
      checkbox.dataset.bookingId = booking.id;
      checkbox.addEventListener('change', () => handleBookingSelection(booking.id, checkbox.checked));
      tdCheckbox.appendChild(checkbox);
      tr.insertBefore(tdCheckbox, tr.firstChild);

      const tdUtente = document.createElement('td');
      tdUtente.className = 'p-2';
      tdUtente.textContent = booking.profiles ? `${booking.profiles.first_name} ${booking.profiles.last_name}` : 'Sconosciuto';
      tr.insertBefore(tdUtente, tr.children[1]);

      const tdAzioni = document.createElement('td');
      tdAzioni.className = 'p-2 flex flex-col md:flex-row space-y-2 md:space-y-0 md:space-x-4';

      const editBtn = document.createElement('button');
      editBtn.className = 'text-green-600 hover:text-green-700 p-3 text-xl edit-btn';
      editBtn.innerHTML = '<i class="fas fa-pencil-alt"></i>';
      editBtn.addEventListener('click', () => openEditBooking(booking));

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'text-red-500 hover:text-red-600 p-3 text-xl delete-btn';
      deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
      deleteBtn.addEventListener('click', () => cancelBooking(booking.id));

      tdAzioni.appendChild(editBtn);
      tdAzioni.appendChild(deleteBtn);
      tr.appendChild(tdAzioni);

      userBookingsBody.appendChild(tr);
      tr.classList.add('hidden'); // Nascondi inizialmente tutte le righe
      hasUserBookings = true;

      if (booking.rooms) {
        roomSet.add(`${booking.rooms.name} (Piano ${booking.rooms.floor})`);
      }
    }
  });

  roomSet.forEach(room => {
    const option = document.createElement('option');
    option.value = room;
    option.textContent = room;
    roomFilterSelect.appendChild(option);
  });

  if (hasAdminBookings) {
    document.getElementById('admin-bookings-section').classList.remove('hidden');
  }
  if (hasUserBookings) {
    document.getElementById('user-bookings-section').classList.remove('hidden');
    // Chiama setupUserBookingsToggle solo se ci sono prenotazioni di altri utenti
    setupUserBookingsToggle(); // Sposta qui per garantire che il DOM sia pronto
  }

  applyUserBookingsFilters();
  filteredAdminBookings = Array.from(document.querySelectorAll('#admin-bookings-body tr'));
  adminCurrentPage = 1;
  renderCurrentAdminPage();
  updateAdminPagination();
}


document.getElementById('filter-user').addEventListener('input', applyUserBookingsFilters);
document.getElementById('filter-date').addEventListener('change', applyUserBookingsFilters);
document.getElementById('filter-room').addEventListener('change', applyUserBookingsFilters);


/**
 * Apre la modale di modifica prenotazione e pre-compila il form.
 */
function openEditBooking(booking) {
  currentEditingBookingId = booking.id;
  document.getElementById('edit-booking-slot-select').value = booking.booking_slot;
  document.getElementById('edit-booking-name').value = booking.booking_name || `${booking.profiles.first_name} ${booking.profiles.last_name}`;
  
  // Se l'utente è BASE, disabilita il campo del nome
  if (currentProfile.role === 'BASE') {
    document.getElementById('edit-booking-name').disabled = true;
  } else {
    document.getElementById('edit-booking-name').disabled = false;
  }
  
  showModal('editBookingModal');
}

/**
 * Gestisce il submit del form di modifica prenotazione.
 */
editBookingForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const newSlot = document.getElementById('edit-booking-slot-select').value;
  const newName = document.getElementById('edit-booking-name').value;

  let updateData = { booking_slot: newSlot };
  
  // Se l'utente è ADMIN, aggiorna anche il nome
  if (currentProfile.role === 'ADMIN') {
    updateData.booking_name = newName;
  }

  let { error } = await supabase
    .from('bookings')
    .update(updateData)
    .eq('id', currentEditingBookingId);

  if (error) {
    console.error("Errore durante la modifica della prenotazione:", error);
    await showNotificationPopup("Errore durante la modifica della prenotazione.");
    return;
  }

  await showNotificationPopup("Prenotazione modificata con successo.");
  hideModal('editBookingModal');
  
  // Forza il refresh della tabella
  loadBookings();
  renderDeskGrid();
});


// Modifica la funzione cancelBooking esistente per permettere agli admin di cancellare
async function cancelBooking(bookingId) {
  const confirmed = await confirmPopup("Sei sicuro di voler cancellare questa prenotazione?");
  if (!confirmed) return;

  // Permetti agli admin di cancellare qualsiasi prenotazione
  if (currentProfile.role === 'ADMIN') {
    const { error } = await supabase
      .from('bookings')
      .delete()
      .eq('id', bookingId);

    if (error) {
      console.error("Errore nella cancellazione:", error);
      alert("Errore nella cancellazione: " + error.message);
      return;
    }
    
    await showNotificationPopup("Prenotazione cancellata con successo");
    loadBookings();
    renderDeskGrid();
    return;
  }

  // Se l'utente è BASE, può cancellare solo le proprie prenotazioni
  if (currentProfile.role === 'BASE') {
    const { error } = await supabase
      .from('bookings')
      .delete()
      .eq('id', bookingId)
      .eq('user_id', currentUser.id);

    if (error) {
      console.error("Errore nella cancellazione:", error);
      alert("Errore nella cancellazione: " + error.message);
      return;
    }
    
    await showNotificationPopup("Prenotazione cancellata con successo");
    loadBookings();
    renderDeskGrid();
  }
}

// Gestione del login
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  const errorMessage = document.getElementById('login-error');

  // Nasconde eventuali messaggi di errore precedenti
  errorMessage.classList.add('hidden');

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    errorMessage.textContent = "Credenziali non valide. Controlla email e password.";
    errorMessage.classList.remove('hidden');
    return;
  }

  currentUser = data.user;
  postAuth();
});


// Gestione della registrazione
signupForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  console.log("Form di registrazione inviato");

  const firstName = document.getElementById('signup-firstname').value;
  const lastName = document.getElementById('signup-lastname').value;
  const company = document.getElementById('register-company').value; 
  const email = document.getElementById('signup-email').value;
  const password = document.getElementById('signup-password').value;
  const successMessage = document.getElementById('signup-success');
  const errorMessage = document.getElementById('signup-error');

  successMessage.classList.add('hidden');
  errorMessage.classList.add('hidden');

  try {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      console.error("Errore nella registrazione su Supabase:", error);
      errorMessage.textContent = "Errore nella registrazione: " + error.message;
      errorMessage.classList.remove('hidden');
      return;
    }

    const newUser = data.user;
    if (!newUser) {
      console.error("Nessun utente restituito dalla registrazione");
      errorMessage.textContent = "Errore: nessun utente restituito dalla registrazione.";
      errorMessage.classList.remove('hidden');
      return;
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .insert([{ 
        id: newUser.id, 
        first_name: firstName, 
        last_name: lastName, 
        theme: 'dark', 
        role: 'BASE', 
        company: company // Aggiunta della company
      }]);

    if (profileError) {
      console.error("Errore nell'inserimento del profilo:", profileError);
      errorMessage.textContent = "Errore durante la creazione del profilo: " + profileError.message;
      errorMessage.classList.remove('hidden');
      return;
    }

    successMessage.textContent = "Registrazione avvenuta con successo. Conferma la tua email ed effettua il login.";
    successMessage.classList.remove('hidden');
    setTimeout(() => successMessage.classList.add('hidden'), 5000);
    signupForm.reset();
  } catch (err) {
    console.error("Errore imprevisto durante la registrazione:", err);
    errorMessage.textContent = "Errore imprevisto: " + err.message;
    errorMessage.classList.remove('hidden');
  }
});


// Logout
logoutBtn.addEventListener('click', async () => {
  await supabase.auth.signOut();
  currentUser = null;
  currentProfile = null;
  document.getElementById('login-container').classList.remove('hidden'); // Mostra il login
  document.getElementById('signup-container').classList.add('hidden'); // Nascondi il signup
  appSection.style.display = 'none';
  authSection.style.display = 'block'; // Assicurati che la sezione auth sia visibile
});

// Dopo il login, carica il profilo e l'applicazione
async function postAuth() {
  authSection.style.display = 'none';
  appSection.style.display = 'block';
  currentProfile = await getProfile(currentUser.id);
  if (!currentProfile) {
    await showNotificationPopup("Impossibile recuperare il profilo utente.");
    return;
  }

  applyUserTheme();
  updateProfileButton(); // Aggiorna il tasto cerchio

  if (currentProfile.role === 'ADMIN') {
    document.getElementById('admin-menu-sidebar').classList.remove('hidden');
  } else {
    document.getElementById('admin-menu-sidebar').classList.add('hidden');
  }
  userNameDisplay.textContent = currentProfile.first_name;

  // Rimuovi il vecchio hamburger-btn dal DOM
  document.getElementById('hamburger-btn').style.display = 'none';

  await loadRooms();
  await renderRoomOptions();
  renderDeskGrid();
  await loadBookings();

  const adminBookingsContainer = document.getElementById('admin-bookings-container');
  if (currentProfile.role === 'ADMIN') {
    adminBookingsContainer.classList.remove('hidden');
  } else {
    adminBookingsContainer.classList.add('hidden');
  }

  if (currentProfile.role === 'ADMIN') {
    adminDropdown.classList.remove('hidden');
    loadAdminUserList();
    loadAdminRoomOptions();
    setupUserBookingsToggle();
  } else {
    adminDropdown.classList.add('hidden');
  }

  bookingDateInput.addEventListener('change', renderDeskGrid);
}

/**
 * Carica il riepilogo degli admin e lo visualizza nella modale Assegna Ruolo Admin.
 */
async function loadAdminSummary() {
  let { data, error } = await supabase
    .from('profiles')
    .select('first_name, last_name')
    .eq('role', 'ADMIN')
    .eq('deleted', false);
  if (error) {
    console.error("Errore nel caricamento del riepilogo admin:", error);
    return;
  }
  const summaryList = document.getElementById('admin-summary-list');
  summaryList.innerHTML = '';
  data.forEach(admin => {
    const li = document.createElement('li');
    li.textContent = `${admin.first_name} ${admin.last_name}`;
    summaryList.appendChild(li);
  });
}

/**
 * Carica il riepilogo delle assegnazioni delle stanze e lo visualizza nella modale Assegna Stanza.
 * NOTA: Usiamo l'alias per forzare il join; verifica che le relazioni in Supabase siano definite con i nomi "profiles" e "rooms".
 */
async function loadRoomAssignmentSummary() {
  // Ottieni l'ID utente selezionato dal dropdown
  const selectedUserId = document.getElementById('admin-room-user-email').value;

  let { data, error } = await supabase
    .from('user_rooms')
    .select("*, profiles:profiles(first_name, last_name), rooms:rooms(name, floor)")
    .eq('user_id', selectedUserId); // Aggiunto filtro per user_id

  if (error) {
    console.error("Errore nel caricamento del riepilogo stanze assegnate:", error);
    return;
  }

  const summaryList = document.getElementById('room-assignment-summary-list');
  summaryList.innerHTML = '';
  data.forEach(assignment => {
    const li = document.createElement('li');
    li.textContent = `${assignment.profiles.first_name} ${assignment.profiles.last_name} - ${assignment.rooms.name} (Piano ${assignment.rooms.floor})`;
    summaryList.appendChild(li);
  });
}


// Carica la lista degli utenti per il menu admin
async function loadAdminUserList() {
  
  let { data, error } = await supabase
    .from('profiles')
    .select('id, first_name, last_name')
    .eq('deleted', false);
  if (error) {
    console.error("Errore nel caricamento della lista utenti:", error);
    return;
  }
  // Aggiungi l'opzione iniziale vuota
    
  [adminUserEmailSelect, adminRoomUserEmailSelect].forEach(selectElem => {
    selectElem.innerHTML = `<option value=""></option>`; // Campo vuoto iniziale
    data.forEach(user => {
      const option = document.createElement('option');
      option.value = user.id;
      option.textContent = `${user.first_name} ${user.last_name}`;
      selectElem.appendChild(option);
    });
  });
}
// Funzione per caricare tutte le prenotazioni fatte visibili solo all'amministratore
async function loadAllBookings(filter = '') {
    const container = document.getElementById('content-bookings');
    if (!container) {
        console.error("Errore: l'elemento 'content-bookings' non è stato trovato.");
        return;
    }
    const nuovoElemento = document.createElement('div');
    
    container.appendChild(nuovoElemento);
  const userFilter = document.getElementById('booking-filter-user').value.toLowerCase();
  const roomFilter = document.getElementById('booking-filter-room').value; // DECOMMENTATA questa riga
  const dateFilter = document.getElementById('booking-filter-date').value;

  let { data: bookings, error } = await supabase
    .from('bookings')
    .select(`
      id,
      booking_date,
      desk_number,
      booking_slot,
      room_id,
      rooms(id, name, floor),
      user_id(first_name, last_name)
    `)
    .order('booking_date', { ascending: false });

  if (error) {
    console.error("Errore nel caricamento:", error);
    return;
  }

  // Applica i filtri
  bookings = bookings.filter(booking => {
    const matchesUser = booking.user_id.first_name.toLowerCase().includes(userFilter) ||
                       booking.user_id.last_name.toLowerCase().includes(userFilter);
    const matchesRoom = !roomFilter || booking.room_id === parseInt(roomFilter);
    const matchesDate = !dateFilter || booking.booking_date === dateFilter;
    return matchesUser && matchesRoom && matchesDate;
  });

  // Renderizza la tabella
  const tbody = document.getElementById('all-bookings-list');
  tbody.innerHTML = '';
  const modalTbody = document.querySelector('#adminBookingsModal #all-bookings-list');
  bookings.forEach(booking => {
    const row = document.createElement('tr');
    row.className = 'hover:bg-gray-700 border-t border-gray-600';
    row.innerHTML = `
      <td class="p-2">
        <input 
          type="checkbox" 
          class="booking-checkbox rounded border-gray-400 text-blue-600 focus:ring-blue-500"
          data-booking-id="${booking.id}"
          ${selectedBookings.has(booking.id) ? 'checked' : ''}
        >
      </td>
      <td class="p-2">${booking.user_id.first_name} ${booking.user_id.last_name}</td>
      <td class="p-2">${booking.booking_date}</td>
      <td class="p-2">${booking.rooms.name} (Piano ${booking.rooms.floor})</td>
      <td class="p-2">${booking.desk_number}</td>
          `;
    [tbody, modalTbody].forEach(container => {
    const cloneRow = row.cloneNode(true);
    
  });
    updateDeleteButtonState(); // Aggiungi questa riga alla fine della funzione
  });

// Rimuovi le prenotazioni cancellate dalla selezione
  bookingIds.forEach(id => selectedBookings.delete(id));
  
  //const confirmed = await confirmPopup("Prenotazioni cancellate con successo");

// Funzione di cancellazione prenotazione per admin


// 5. Aggiungi il filtro live
document.getElementById('booking-filter-user')?.addEventListener('input', (e) => {
  loadAllBookings(e.target.value);
});

  // Aggiungi event listener ai pulsanti
document.querySelectorAll('.delete-booking-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const bookingId = e.target.dataset.bookingId;
      if (confirm('Sei sicuro di voler cancellare questa prenotazione?')) {
        await deleteBookingAdmin([bookingId]);
      }
    });
  });

  updateDeleteButtonState();
}

// Al caricamento della pagina
window.addEventListener('load', async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session && session.user) {
    currentUser = session.user;
    postAuth();
  }
  
  // Aggiungi listener per il bottone di cambio tema
  document.getElementById('theme-toggle-btn').addEventListener('click', toggleTheme);
});



async function deleteBookingAdmin(bookingIds) {
    // Mostra il popup di conferma prima di procedere con la cancellazione
  const confirmed = await confirmPopup(`Sei sicuro di voler eliminare ${bookingIds.length} prenotazioni?`);
  if (!confirmed) return;  // Se l'utente annulla, interrompe la funzione

  // Esegue la cancellazione su Supabase
  const { error } = await supabase
    .from('bookings')
    .delete()
    .in('id', bookingIds);

  if (error) {
    await showNotificationPopup("Errore durante la cancellazione: " + error.message);
    return;
  }
  
  await showNotificationPopup("Prenotazione cancellata con successo.");
  
  // Aggiorna la lista delle prenotazioni nella modale admin
  loadAllBookings(document.getElementById('booking-filter-user').value);
  // Aggiorna la griglia delle scrivanie
  renderDeskGrid();
  // Aggiungi questa riga per aggiornare il riepilogo dell'utente
  loadBookings();
}

// Funzioni per gestire i tab
function setupAdminModalTabs() {
    console.log("Inizializzazione tab modale admin");
    
    // Riferimenti ai tab e ai contenuti
    const tabBookings = document.getElementById('tab-bookings');
    const tabStatistics = document.getElementById('tab-statistics');
    const contentBookings = document.getElementById('content-bookings');
    const contentStatistics = document.getElementById('content-statistics');
    
    if (!tabBookings || !tabStatistics || !contentBookings || !contentStatistics) {
        console.error("Elementi dei tab non trovati");
        return;
    }
    
    // Funzione per attivare un tab
    function activateTab(tab, content) {
        // Rimuovi le classi attive da tutti i tab
        [tabBookings, tabStatistics].forEach(t => {
            t.classList.remove('border-blue-600', 'dark:border-blue-500', 
                'text-blue-600', 'dark:text-blue-500');
            t.classList.add('border-transparent', 'hover:text-gray-600', 
                'hover:border-gray-300', 'dark:hover:text-gray-300');
        });
        
        // Nascondi tutti i contenuti
        [contentBookings, contentStatistics].forEach(c => {
            c.classList.add('hidden');
        });
        
        // Attiva il tab selezionato
        tab.classList.remove('border-transparent', 'hover:text-gray-600', 
            'hover:border-gray-300', 'dark:hover:text-gray-300');
        tab.classList.add('border-blue-600', 'dark:border-blue-500', 
            'text-blue-600', 'dark:text-blue-500');
        
        // Mostra il contenuto corrispondente
        content.classList.remove('hidden');
    }
    
    // Rimuovi event listener precedenti
    tabBookings.removeEventListener('click', activateTab);
    tabStatistics.removeEventListener('click', activateTab);
    
    // Aggiungi event listener per i tab
    tabBookings.addEventListener('click', () => {
        console.log("Tab Prenotazioni cliccato");
        activateTab(tabBookings, contentBookings);
    });
    
    // Aggiungi event listener per i tab
    tabStatistics.addEventListener('click', () => {
        console.log("Tab Statistiche cliccato");
        activateTab(tabStatistics, contentStatistics);
        // Carica gli utenti nel filtro quando viene visualizzato il tab
        loadUsersIntoStatisticsFilter();
        // Carica le statistiche iniziali
        loadStatistics()
    });
    
    // IMPORTANTE: Aggiungi event listener per il pulsante "Applica Filtri"
    const applyFiltersBtn = document.getElementById('apply-stats-filters');
    if (applyFiltersBtn) {
        console.log("Trovato pulsante Applica Filtri");
        // Rimuovi eventuali listener precedenti
        applyFiltersBtn.removeEventListener('click', loadStatistics);
        // Aggiungi nuovo listener
        applyFiltersBtn.addEventListener('click', function() {
            console.log("Pulsante Applica Filtri cliccato");
            loadStatistics();
        });
    } else {
        console.error("Pulsante Applica Filtri non trovato");
    }
    
    // Inizializza il pulsante per esportare in Excel
    const exportExcelBtn = document.getElementById('export-stats-xlsx');
    if (exportExcelBtn) {
        exportExcelBtn.removeEventListener('click', exportStatisticsToXlsx);
        exportExcelBtn.addEventListener('click', exportStatisticsToXlsx);
    }
}


// Aggiungi questi event listeners quando viene caricato il documento
document.addEventListener('DOMContentLoaded', () => {
  
  // Event listener per "Seleziona tutti"
  document.getElementById('select-all-user-bookings').addEventListener('change', function () {
  // Recupera tutte le righe della tabella
  const allRows = document.querySelectorAll('#user-bookings-body tr');
  // Filtra solo le righe visibili (quelle con offsetParent diverso da null)
  const visibleRows = Array.from(allRows).filter(row => row.offsetParent !== null);
  // Da queste righe, prendi le checkbox
  const visibleCheckboxes = visibleRows.map(row => row.querySelector('.booking-checkbox')).filter(cb => cb);

// Inizializza i tab della modale admin
  setupAdminModalTabs();
  
  // Event listener per il pulsante applica filtri nelle statistiche
  document.getElementById('apply-stats-filters').addEventListener('click', loadStatistics);
  
  // Event listener per il pulsante esporta Excel
  document.getElementById('export-stats-xlsx').addEventListener('click', exportStatisticsToXlsx);
  
  // Carica le stanze nel filtro statistiche
  loadRoomsIntoStatisticsFilter();

  // Verifica gli elementi delle statistiche
    setTimeout(checkStatisticsElements, 1000);

  // Resetta la selezione per le righe visibili
  visibleCheckboxes.forEach(checkbox => {
    checkbox.checked = this.checked;
    if (this.checked) {
      selectedBookings.add(checkbox.dataset.bookingId);
    } else {
      selectedBookings.delete(checkbox.dataset.bookingId);
    }
  });

  updateBulkActionButtons();

    

});

// Event listeners per i pulsanti di esportazione
document.getElementById('export-csv').addEventListener('click', () => {
    exportAllBookingsCSV();
});

document.getElementById('export-excel').addEventListener('click', () => {
    exportAllBookingsExcel();
});

  // Event listener per il pulsante di eliminazione multipla
  document.getElementById('delete-selected-bookings')?.addEventListener('click', async () => {
  if (selectedBookings.size === 0) return;
  
  
  
  //if (confirm(`Sei sicuro di voler cancellare ${selectedBookings.size} prenotazioni?`)) 
  
    try {
      // Converti il Set in un array
      const bookingIds = Array.from(selectedBookings);
      
      // Chiama la funzione di cancellazione
      await deleteBookingAdmin(bookingIds);
      
      // Svuota la selezione
      selectedBookings.clear();
      //updateDeleteButtonState();
    } catch (error) {
      console.error("Errore durante la cancellazione:", error);
      alert("Si è verificato un errore durante la cancellazione.");
    }
  
});
});



// Funzione per caricare gli utenti (non cancellati) nel menu a tendina della modale
async function loadUserListForDeletion() {
  let { data, error } = await supabase
    .from('profiles')
    .select('id, first_name, last_name')
    // Includi i record in cui deleted è false o null
    .or('deleted.is.false,deleted.is.null');
  
  console.log("User data per cancellazione:", data);
  
  if (error) {
    console.error("Errore nel caricamento degli utenti per cancellazione:", error);
    return;
  }
  
  const deleteUserSelect = document.getElementById('delete-user-select');
  deleteUserSelect.innerHTML = `<option value=""></option>`;// Campo vuoto // Pulisci il menu
  
  if (!data || data.length === 0) {
    deleteUserSelect.innerHTML = `<option value="">Nessun utente disponibile</option>`;
  } else {
    data.forEach(user => {
      const option = document.createElement('option');
      option.value = user.id;
      option.textContent = `${user.first_name} ${user.last_name} `;
      deleteUserSelect.appendChild(option);
    });
  }
}

 // Funzione per eliminare più prenotazioni

async function deleteSelectedBookings() {
  if (selectedBookings.size < 2) return;

  const confirmed = await confirmPopup(`Sei sicuro di voler eliminare ${selectedBookings.size} prenotazioni?`);
  if (!confirmed) return;

  let { error } = await supabase
    .from('bookings')
    .delete()
    .in('id', Array.from(selectedBookings));

  if (error) {
    await showNotificationPopup("Errore durante la cancellazione.");
    return;
  }

  await showNotificationPopup("Prenotazioni eliminate con successo.");
  selectedBookings.clear();
  loadBookings();
}
 // funzione per aggiornare il tema nel database
async function updateUserTheme(userId, theme) {
  const { error } = await supabase
    .from('profiles')
    .update({ theme: theme })
    .eq('id', userId);
  
  if (error) {
    console.error('Errore durante l\'aggiornamento del tema:', error);
    await showNotificationPopup('Errore durante il salvataggio del tema.');
    return false;
  }
  return true;
}




// Carica le opzioni delle stanze per il menu admin
function loadAdminRoomOptions() {
  adminRoomSelect.innerHTML = '';
  rooms.forEach(room => {
    const option = document.createElement('option');
    option.value = room.id;
    option.textContent = `${room.name} (Piano ${room.floor})`;
    adminRoomSelect.appendChild(option);
  });
}

// Funzione per popolare il select delle stanze
function populateRoomFilter() {
 const roomSelect = document.getElementById('booking-filter-room');
  roomSelect.innerHTML = '<option value="">Tutte le stanze</option>';
  
  rooms.forEach(room => {
    const option = document.createElement('option');
    option.value = room.id;
    option.textContent = `${room.name} (Piano ${room.floor})`; 
    roomSelect.appendChild(option);
  });
}

// Aggiungi queste nuove funzioni


function updateDeleteButtonState() {
  const deleteButton = document.getElementById('delete-selected-bookings');
  const selectedCount = document.getElementById('selected-count');
  const selectAllCheckbox = document.getElementById('select-all-bookings');
  const bookingCheckboxes = document.querySelectorAll('.booking-checkbox');
  
  // Aggiorna il contatore
  selectedCount.textContent = selectedBookings.size;
  
  // Abilita/disabilita il pulsante di eliminazione
  deleteButton.disabled = selectedBookings.size === 0;
  
  // Aggiorna lo stato della checkbox "Seleziona tutti"
  if (bookingCheckboxes.length > 0) {
    selectAllCheckbox.checked = bookingCheckboxes.length === selectedBookings.size;
    selectAllCheckbox.indeterminate = selectedBookings.size > 0 && selectedBookings.size < bookingCheckboxes.length;
  }
}

function confirmPopup(message) {
  return new Promise((resolve, reject) => {
    const confirmationModal = document.getElementById('confirmationModal');
    const confirmationMessage = document.getElementById('confirmationMessage');
    const confirmationCancel = document.getElementById('confirmationCancel');
    const confirmationOk = document.getElementById('confirmationOk');

    // Imposta il messaggio
    confirmationMessage.textContent = message;
    // Mostra la modale
    confirmationModal.classList.remove('hidden');

    // Funzione per chiudere la modale e rimuovere gli event listener
    function closeModal() {
      confirmationModal.classList.add('hidden');
      confirmationCancel.removeEventListener('click', onCancel);
      confirmationOk.removeEventListener('click', onOk);
    }

    // Handler per "Annulla"
    function onCancel() {
      closeModal();
      resolve(false);
    }

    // Handler per "Conferma"
    function onOk() {
      closeModal();
      resolve(true);
    }

    confirmationCancel.addEventListener('click', onCancel);
    confirmationOk.addEventListener('click', onOk);
  });
}

// Funzione opzionale per chiudere la modale quando si clicca sulla X
function hideConfirmationModal() {
  const confirmationModal = document.getElementById('confirmationModal');
  confirmationModal.classList.add('hidden');
}

// Alert sostituito con un popup personalizzato
function showNotificationPopup(message) {
  return new Promise((resolve) => {
    const confirmationModal = document.getElementById('confirmationModal');
    const confirmationMessage = document.getElementById('confirmationMessage');
    const confirmationCancel = document.getElementById('confirmationCancel');
    const confirmationOk = document.getElementById('confirmationOk');

    if (!confirmationModal || !confirmationMessage || !confirmationOk) {
      console.error('Uno o più elementi del modale non trovati');
      resolve(); // Risolvi comunque per evitare blocchi
      return;
    }

    // Imposta il messaggio e nasconde il tasto "Annulla"
    confirmationMessage.textContent = message;
    confirmationCancel.classList.add('hidden');
    confirmationOk.textContent = "OK";
    confirmationModal.classList.remove('hidden');

    function closeModal() {
      confirmationModal.classList.add('hidden');
      confirmationCancel.classList.remove('hidden'); // Ripristina il pulsante Annulla
      confirmationOk.removeEventListener('click', onOk);
      resolve();
    }

    function onOk() {
      closeModal();
    }

    confirmationOk.addEventListener('click', onOk, { once: true }); // Esegui una sola volta
  });
}

// Funzione separata per inizializzare il toggle (rimane invariata)
function setupUserBookingsToggle() {
  const toggleButton = document.getElementById('toggle-user-bookings');
  const userBookingsContent = document.getElementById('user-bookings-content');

  if (!toggleButton || !userBookingsContent) {
    console.error("Elementi DOM non trovati:", { toggleButton, userBookingsContent });
    return;
  }

  console.log("Toggle configurato per Prenotazioni di Altri Utenti");

  // Rimuovi eventuali listener precedenti per evitare duplicati
  toggleButton.removeEventListener('click', toggleHandler);
  toggleButton.addEventListener('click', toggleHandler);

  function toggleHandler() {
    console.log("Toggle cliccato!");
    if (userBookingsContent.classList.contains('hidden')) {
      userBookingsContent.classList.remove('hidden');
      toggleButton.innerHTML = '<i class="fas fa-chevron-down mr-2"></i> Prenotazioni di Altri Utenti';
      currentPage = 1;
      applyUserBookingsFilters();
    } else {
      userBookingsContent.classList.add('hidden');
      toggleButton.innerHTML = '<i class="fas fa-chevron-right mr-2"></i> Prenotazioni di Altri Utenti';
    }
  }
}
// Funzione per applicare i filtri nel Riepilogo prenotazioni Altri di Altri Utenti

function applyUserBookingsFilters() {
  const userFilter = document.getElementById('filter-user').value.toLowerCase();
  const dateFilter = document.getElementById('filter-date').value;
  const roomFilter = document.getElementById('filter-room').value;

  // Resetta la paginazione a 1 quando cambiano i filtri
  currentPage = 1;

  // Aggiorna filteredUserBookings con TUTTE le righe (non solo quelle visibili)
  filteredUserBookings = Array.from(document.querySelectorAll('#user-bookings-body tr'));

  // Applica i filtri
  filteredUserBookings.forEach(row => {
    const userName = row.children[1].textContent.toLowerCase();
    const bookingDate = row.children[2].textContent;
    const roomName = row.children[3].textContent.toLowerCase();

    // Normalizza le date
    const normalizedBookingDate = new Date(bookingDate).toISOString().split('T')[0];
    const normalizedDateFilter = dateFilter ? new Date(dateFilter).toISOString().split('T')[0] : null;

    // Logica di filtraggio
    const matchUser = !userFilter || userName.includes(userFilter);
    const matchDate = !dateFilter || normalizedBookingDate === normalizedDateFilter;
    const matchRoom = !roomFilter || roomName.includes(roomFilter.toLowerCase());

    // Aggiungi/rimuovi la classe hidden in base ai filtri
    if (matchUser && matchDate && matchRoom) {
      row.classList.remove('hidden');
    } else {
      row.classList.add('hidden');
    }
  });

  updatePagination();
  renderCurrentPage();

}

// Funzione per gestire la logica della selezione
function handleBookingSelection(bookingId, isSelected) {
  if (isSelected) {
    selectedBookings.add(bookingId);
  } else {
    selectedBookings.delete(bookingId);
  }
  updateBulkActionButtons();
}

// funzione per attivare/disattivare i pulsanti

function updateBulkActionButtons() {
  const deleteBtn = document.getElementById('delete-selected-bookings');
  const editBtn = document.getElementById('edit-selected-bookings');
  // Seleziona solo le checkbox all'interno della tabella admin
  const checkboxes = document.querySelectorAll('#user-bookings-body .booking-checkbox');
  
  const selectedCount = selectedBookings.size;
  
  // Aggiorna il riepilogo selezioni
  document.getElementById('selected-count').textContent = selectedCount;
  
  if (selectedCount >= 2) {
    deleteBtn.classList.remove('hidden');
    editBtn.classList.remove('hidden');
    deleteBtn.disabled = false;
    editBtn.disabled = false;
  } else {
    deleteBtn.classList.add('hidden');
    editBtn.classList.add('hidden');
    deleteBtn.disabled = true;
    editBtn.disabled = true;
  }
  
  // Disabilita (anziché nascondere) i pulsanti Edit/Delete delle righe
  checkboxes.forEach(checkbox => {
    const row = checkbox.closest('tr');
    const rowEditBtn = row.querySelector('.edit-btn');
    const rowDeleteBtn = row.querySelector('.delete-btn');
    
    if (selectedCount >= 2) {
      if (rowEditBtn) {
        rowEditBtn.disabled = true;
        rowEditBtn.classList.add('opacity-50', 'cursor-not-allowed');
      }
      if (rowDeleteBtn) {
        rowDeleteBtn.disabled = true;
        rowDeleteBtn.classList.add('opacity-50', 'cursor-not-allowed');
      }
    } else {
      if (rowEditBtn) {
        rowEditBtn.disabled = false;
        rowEditBtn.classList.remove('opacity-50', 'cursor-not-allowed');
      }
      if (rowDeleteBtn) {
        rowDeleteBtn.disabled = false;
        rowDeleteBtn.classList.remove('opacity-50', 'cursor-not-allowed');
      }
    }
  });
}


// Funzione per modificare più prenotazioni

function editSelectedBookings() {
  
    if (selectedBookings.size < 2) return;
  showModal('editBulkModal');
  if (!newSlot) return;

  selectedBookings.forEach(async bookingId => {
    await supabase
      .from('bookings')
      .update({ booking_slot: newSlot })
      .eq('id', bookingId);
  });

  showNotificationPopup("Prenotazioni modificate con successo.");
  selectedBookings.clear();
  loadBookings();
}

function renderCurrentPage() {
  // Ottieni SOLO le righe visibili (non filtrate)
  const visibleRows = Array.from(document.querySelectorAll('#user-bookings-body tr:not(.hidden)'));

  // Calcola gli indici per la pagina corrente
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;

  // Nascondi TUTTE le righe
  filteredUserBookings.forEach(row => row.style.display = 'none');

  // Mostra solo le righe della pagina corrente
  visibleRows.slice(startIndex, endIndex).forEach(row => {
    row.style.display = 'table-row';
  });

  // Aggiorna i controlli di paginazione
  updatePagination();
}

function updatePagination() {
  // Conta SOLO le righe visibili
  const visibleRows = Array.from(document.querySelectorAll('#user-bookings-body tr:not(.hidden)'));
  const totalItems = visibleRows.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;

  // Correzione automatica della pagina corrente
  if (currentPage > totalPages) {
    currentPage = totalPages;
    renderCurrentPage();
    return;
  }

  // Aggiorna l'UI
  document.getElementById('total-pages').textContent = totalPages;
  document.getElementById('current-page').textContent = currentPage;

  // Abilita/disabilita i pulsanti
  document.getElementById('prev-page').disabled = currentPage === 1;
  document.getElementById('next-page').disabled = currentPage === totalPages;

  console.log(`Pagina ${currentPage} di ${totalPages} - ${totalItems} elementi`);
}

function resetTable() {
  // Mostra tutte le righe
  filteredUserBookings.forEach(row => {
    row.classList.remove('hidden');
    row.style.display = 'none'; // Nascondi tutte le righe inizialmente
  });
  
  // Resetta i filtri
  document.getElementById('filter-user').value = '';
  document.getElementById('filter-date').value = '';
  document.getElementById('filter-room').value = '';

  // Resetta la paginazione
  currentPage = 1;
  renderCurrentPage();
}

function renderCurrentAdminPage() {
  // Calcola gli indici per la pagina corrente
  const startIndex = (adminCurrentPage - 1) * adminPageSize;
  const endIndex = startIndex + adminPageSize;

  // Nascondi tutte le righe
  filteredAdminBookings.forEach(row => row.style.display = 'none');

  // Mostra solo le righe della pagina corrente
  filteredAdminBookings.slice(startIndex, endIndex).forEach(row => {
    row.style.display = 'table-row';
  });
}

function updateAdminPagination() {
  const totalItems = filteredAdminBookings.length;
  const totalPages = Math.ceil(totalItems / adminPageSize) || 1;

  // Se la pagina corrente è oltre il numero totale di pagine, correggila
  if (adminCurrentPage > totalPages) {
    adminCurrentPage = totalPages;
    renderCurrentAdminPage();
  }

  // Aggiorna i numeri di pagina nell'interfaccia
  document.getElementById('admin-current-page').textContent = adminCurrentPage;
  document.getElementById('admin-total-pages').textContent = totalPages;

  // Abilita o disabilita i pulsanti
  document.getElementById('admin-prev-page').disabled = adminCurrentPage === 1;
  document.getElementById('admin-next-page').disabled = adminCurrentPage === totalPages;
}


// Assegna il ruolo ADMIN
adminRoleForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const userId = adminUserEmailSelect.value;
  let { error } = await supabase
    .from('profiles')
    .update({ role: 'ADMIN' })
    .eq('id', userId);
  if (error) {
    const confirmed = await confirmPopup("Errore nell'assegnazione del ruolo admin: " + error.message);
    return;
  }
  await showNotificationPopup("Ruolo admin assegnato.");
  loadAdminUserList();
  loadAdminSummary();
});

// Rimuove il ruolo ADMIN
removeAdminBtn.addEventListener('click', async (e) => {
  e.preventDefault();
  const userId = adminUserEmailSelect.value;
  let { error } = await supabase
    .from('profiles')
    .update({ role: 'BASE' })
    .eq('id', userId);
  if (error) {
    const confirmed = await confirmPopup("Errore nella rimozione del ruolo admin: " + error.message);
    return;
  }
  await showNotificationPopup("Ruolo admin rimosso.");
  loadAdminUserList();
  loadAdminSummary();
});

// Aggiorna automaticamente il riepilogo quando si cambia utente
adminRoomUserEmailSelect.addEventListener('change', () => loadRoomAssignmentSummary());

// Assegna le stanze ad un utente
adminRoomForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const userId = adminRoomUserEmailSelect.value;
  const selectedRooms = Array.from(adminRoomSelect.selectedOptions).map(opt => parseInt(opt.value));

  // Creiamo i nuovi record da inserire
  const assignments = selectedRooms.map(rid => ({ user_id: userId, room_id: rid }));

  let { error: insertError } = await supabase
    .from('user_rooms')
    .insert(assignments, { upsert: false }); // Assicura che non sovrascriva dati esistenti

  if (insertError) {
    const confirmed = await confirmPopup("Errore nell'assegnazione delle stanze: " + insertError.message);
    return;
  }

  await showNotificationPopup("Stanze assegnate all'utente.");
  loadAdminRoomOptions();
  loadRoomAssignmentSummary();
});


// Rimuove una singola assegnazione stanza per un utente
removeRoomBtn.addEventListener('click', async (e) => {
  e.preventDefault();
  
  const userId = adminRoomUserEmailSelect.value;
  const selectedRoomId = parseInt(adminRoomSelect.value); // Prende la stanza selezionata

  if (!selectedRoomId) {
    await showNotificationPopup("Seleziona una stanza da rimuovere.");
    return;
  }

  let { error } = await supabase
    .from('user_rooms')
    .delete()
    .eq('user_id', userId)
    .eq('room_id', selectedRoomId); // Cancella solo la stanza specifica

  if (error) {
    const confirmed = await confirmPopup("Errore nella rimozione dell'assegnazione: " + error.message);
    return;
  }

  await showNotificationPopup("Assegnazione stanza rimossa.");
  loadRoomAssignmentSummary();
});



// Aggiorna la griglia delle scrivanie al cambio della stanza
roomSelect.addEventListener('change', renderDeskGrid);

// Al caricamento della pagina, se esiste una sessione attiva, carica l'applicazione
window.addEventListener('load', async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session && session.user) {
    currentUser = session.user;
    await postAuth(); // Carica i dati e popola il DOM
    if (currentProfile.role === 'ADMIN') {
      setupUserBookingsToggle(); // Configura il toggle dopo che il DOM è pronto
    }
  }
});

// Aggiungi gli event listener per i pulsanti di paginazione
document.getElementById('prev-page').addEventListener('click', () => {
  if (currentPage > 1) {
    currentPage--;
    renderCurrentPage();
  }
});

document.getElementById('next-page').addEventListener('click', () => {
  const totalPages = parseInt(document.getElementById('total-pages').textContent);
  if (currentPage < totalPages) {
    currentPage++;
    renderCurrentPage();
  }
});


// Event listener per il form della modale Cancella Utente
document.getElementById('delete-user-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const deleteUserSelect = document.getElementById('delete-user-select');
  const userIdToDelete = deleteUserSelect.value;
  if (!userIdToDelete) {
    const confirmed = await confirmPopup("Seleziona un utente da cancellare.");
    return;
  }
  if (!confirm("Confermi di voler cancellare logicamente questo utente?")) {
    return;
  }
  let { error } = await supabase
    .from('profiles')
    .update({ deleted: true })
    .eq('id', userIdToDelete);
  if (error) {
    console.error("Errore nella cancellazione dell'utente:", error);
    const confirmed = await confirmPopup("Errore nella cancellazione dell'utente.");
    return;
  }
  await showNotificationPopup("Utente cancellato logicamente.");
  hideModal('deleteUserModal');
  loadUserListForDeletion();
});

document.getElementById('all-bookings-list').addEventListener('change', (e) => {
  if (e.target.classList.contains('booking-checkbox')) {
    const bookingId = e.target.dataset.bookingId;
    if (e.target.checked) {
      selectedBookings.add(bookingId);
    } else {
      selectedBookings.delete(bookingId);
    }
    updateDeleteButtonState();
  }
});

document.getElementById('edit-bulk-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const newSlot = document.getElementById('edit-bulk-slot-select').value;
  for (let bookingId of selectedBookings) {
    await supabase
      .from('bookings')
      .update({ booking_slot: newSlot })
      .eq('id', bookingId);
  }
  await showNotificationPopup("Prenotazioni modificate con successo.");
  hideModal('editBulkModal');
  selectedBookings.clear();
  loadBookings();
});

// Event listener per aprire la modale Cancella Utente
document.getElementById('open-delete-user-modal')?.addEventListener('click', (e) => {
  e.preventDefault();
  showModal('deleteUserModal');
  loadUserListForDeletion();
});

// Event listener per aprire la modale Cancella Prenotazioni
openDeleteBookingModal?.addEventListener('click', (e) => {
  e.preventDefault();
  showModal('deleteBookingModal');
  loadAllBookings();
});

document.getElementById('open-role-modal').addEventListener('click', async (e) => {
  e.preventDefault(); // Previeni il comportamento predefinito del link/pulsante
  showModal('adminRoleModal'); // Mostra la modale
  await loadAdminSummary(); // Carica l'elenco degli admin
});


// Aggiungi queste righe nella sezione degli event listener
document.getElementById('edit-detail-btn').addEventListener('click', async () => {
  hideModal('bookingDetailsModal');
  
  // Recupera i dati completi della prenotazione
  const { data: booking, error } = await supabase
    .from('bookings')
    .select('*, profiles(first_name, last_name)')
    .eq('id', currentEditingBookingId)
    .single();

  if (!error) {
    openEditBooking({
      id: booking.id,
      booking_slot: booking.booking_slot,
      profiles: booking.profiles,
      booking_name: booking.booking_name
    });
  } else {
    await showNotificationPopup("Errore nel recupero della prenotazione");
  }
});

document.getElementById('delete-detail-btn').addEventListener('click', async () => {
  const confirmed = await confirmPopup("Sei sicuro di voler cancellare questa prenotazione?");
  if (!confirmed) return;
  
  const { error } = await supabase
    .from('bookings')
    .delete()
    .eq('id', currentEditingBookingId);

  if (error) {
    await showNotificationPopup("Errore nella cancellazione: " + error.message);
    return;
  }

  await showNotificationPopup("Prenotazione cancellata con successo");
  hideModal('bookingDetailsModal');
  
  // Aggiorna tutti i componenti interessati
  renderDeskGrid();
  loadBookings();
  loadAllBookings(); // Per la modale admin se aperta
});

// Event listener per i filtri della modale Cancella Prenotazioni
/* ========================
   EVENTI DEBOUNCED PER IL FILTRO "UTENTE"
   ======================== */
// Utilizza debounce per il campo "booking-filter-user" con delay di 300ms
const debouncedLoadAllBookings = debounce((value) => loadAllBookings(value), 500);
document.getElementById('booking-filter-user')?.addEventListener('input', (e) => {
  debouncedLoadAllBookings(e.target.value);
});

// Altri filtri della modale Cancella Prenotazioni
document.getElementById('booking-filter-room').addEventListener('change', () => loadAllBookings());
document.getElementById('booking-filter-date').addEventListener('change', () => loadAllBookings());

document.getElementById('delete-selected-bookings').addEventListener('click', deleteSelectedBookings);
document.getElementById('edit-selected-bookings').addEventListener('click', editSelectedBookings);

document.getElementById('admin-prev-page').addEventListener('click', () => {
  if (adminCurrentPage > 1) {
    adminCurrentPage--;
    renderCurrentAdminPage();
    updateAdminPagination();
  }
});

document.getElementById('admin-next-page').addEventListener('click', () => {
  const totalPages = Math.ceil(filteredAdminBookings.length / adminPageSize) || 1;
  if (adminCurrentPage < totalPages) {
    adminCurrentPage++;
    renderCurrentAdminPage();
    updateAdminPagination();
  }
});

document.getElementById('edit-profile-btn').addEventListener('click', async () => {
  if (!currentUser) return;

  // Recupera i dettagli dell'utente autenticato
  const { data: userData, error: authError } = await supabase.auth.getUser();
  if (authError) {
    console.error('Errore nel recupero dei dati utente:', authError);
    return;
  }

  // Recupera il profilo dell'utente dalla tabella "profiles"
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', currentUser.id)
    .single();

  if (profileError) {
    console.error('Errore nel caricamento del profilo:', profileError);
    return;
  }

  // Popola la modale con i dati dell'utente
  document.getElementById('profile-firstname').value = profile.first_name || '';
  document.getElementById('profile-lastname').value = profile.last_name || '';
  document.getElementById('profile-email').value = userData.user.email || ''; // Preso direttamente da Authentication

 const profilePicturePreview = document.getElementById('profile-picture-preview');
 const removePictureBtn = document.getElementById('remove-profile-picture');

 const profileCompanySelect = document.getElementById('profile-company');
    const companyValue = currentProfile.company;
    
    if (companyValue && profileCompanySelect.querySelector(`option[value="${companyValue}"]`)) {
        profileCompanySelect.value = companyValue; // Imposta il valore corretto
    } else {
        profileCompanySelect.value = ''; // Imposta sul placeholder se il valore non è valido
        console.warn(`Valore company "${companyValue}" non trovato nelle opzioni.`);
    }

  
  if (profile.profile_picture) {
    profilePicturePreview.src = profile.profile_picture;
    profilePicturePreview.style.display = 'block';
    removePictureBtn.classList.remove('hidden');
  } else {
    profilePicturePreview.style.display = 'none';
    removePictureBtn.classList.add('hidden');
  }

  showModal('userProfileModal');
});

document.getElementById('user-profile-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const updatedFirstName = document.getElementById('profile-firstname').value;
  const updatedLastName = document.getElementById('profile-lastname').value;
  const company = document.getElementById('profile-company').value;
  const newPassword = document.getElementById('profile-password').value;
  const profilePictureInput = document.getElementById('profile-picture');
  const file = profilePictureInput.files[0];
  

  const { data: userData, error: authError } = await supabase.auth.getUser();
  if (authError) {
    await showNotificationPopup("Errore nel recupero dei dati utente.");
    return;
  }

  let profilePictureUrl = currentProfile.profile_picture;

  // Carica la nuova immagine, se presente
  if (file) {
    const fileName = `${currentUser.id}-${Date.now()}.${file.name.split('.').pop()}`;
    console.log("Caricamento immagine:", fileName);

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('profile-pictures')
      .upload(fileName, file, { upsert: true });

    if (uploadError) {
      console.error('Errore nel caricamento della foto:', uploadError);
      await showNotificationPopup("Errore durante il caricamento della foto: " + uploadError.message);
      return;
    }

    // Costruisci manualmente l'URL pubblico
    const publicUrl = `${supabaseUrl}/storage/v1/object/public/profile-pictures/${fileName}`;
    profilePictureUrl = publicUrl;
    console.log("URL pubblico generato manualmente:", profilePictureUrl);

    // Verifica che l'URL sia valido
    try {
      const response = await fetch(profilePictureUrl);
      if (!response.ok) {
        console.error("L'URL generato non è accessibile:", response.status);
        await showNotificationPopup("Errore: l'immagine caricata non è accessibile.");
        return;
      }
    } catch (err) {
      console.error("Errore nella verifica dell'URL:", err);
      await showNotificationPopup("Errore: impossibile verificare l'immagine caricata.");
      return;
    }
  }

  if (newPassword) {
    const { data: session, error: sessionError } = await supabase.auth.signInWithPassword({
      email: userData.user.email,
      password: newPassword
    });

    if (!sessionError) {
      await showNotificationPopup("La nuova password è uguale a quella attuale. Inserisci una password diversa.");
      return;
    }

    const { error: passwordError } = await supabase.auth.updateUser({ password: newPassword });
    if (passwordError) {
      console.error('Errore aggiornamento password:', passwordError);
      await showNotificationPopup("Errore durante l'aggiornamento della password.");
      return;
    }
  }

  console.log("Aggiornamento profilo con:", {
    first_name: updatedFirstName,
    last_name: updatedLastName,
    profile_picture: profilePictureUrl
  });

  const { data: updateData, error: updateError } = await supabase
    .from('profiles')
    .update({
      first_name: updatedFirstName,
      last_name: updatedLastName,
      profile_picture: profilePictureUrl,
      company: company
    })
    .eq('id', userData.user.id)
    .select(); // Restituisci i dati aggiornati per verifica

  if (updateError) {
    console.error('Errore aggiornamento profilo:', updateError);
    await showNotificationPopup("Errore durante l'aggiornamento del profilo: " + updateError.message);
    return;
  }

  console.log("Profilo aggiornato con successo:", updateData);

  // Aggiorna il profilo corrente PRIMA di aggiornare la griglia
  currentProfile = await getProfile(currentUser.id);
  updateProfileButton();
  await renderDeskGrid(); // Chiamata per aggiornare la griglia

  await showNotificationPopup("Profilo aggiornato con successo!");
  hideModal('userProfileModal');
});

// Gestione del pulsante "Rimuovi foto"
document.getElementById('remove-profile-picture').addEventListener('click', async () => {
  const confirmed = await confirmPopup("Sei sicuro di voler rimuovere la foto profilo?");
  if (!confirmed) return;

  // Estrai il nome del file dall'URL esistente
  const currentUrl = currentProfile.profile_picture;
  if (!currentUrl) {
    await showNotificationPopup("Nessuna foto da rimuovere.");
    return;
  }

  const fileName = currentUrl.split('/').pop();
  console.log("Rimozione file dal bucket:", fileName);

  // Rimuovi il file da Supabase Storage
  const { error: deleteError } = await supabase.storage
    .from('profile-pictures')
    .remove([fileName]);

  if (deleteError) {
    console.error('Errore nella rimozione della foto:', deleteError);
    await showNotificationPopup("Errore durante la rimozione della foto: " + deleteError.message);
    return;
  }

  // Imposta profile_picture a NULL nel database
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ profile_picture: null })
    .eq('id', currentUser.id);

  if (updateError) {
    console.error('Errore aggiornamento profilo:', updateError);
    await showNotificationPopup("Errore durante l'aggiornamento del profilo: " + updateError.message);
    return;
  }

  // Aggiorna il profilo corrente e l'interfaccia
  currentProfile.profile_picture = null;
  const profilePicturePreview = document.getElementById('profile-picture-preview');
  const removePictureBtn = document.getElementById('remove-profile-picture');
  profilePicturePreview.style.display = 'none';
  removePictureBtn.classList.add('hidden');
  updateProfileButton();
  await renderDeskGrid();

  await showNotificationPopup("Foto profilo rimossa con successo!");
});
// Seleziona gli elementi della sidebar 
const sidebar = document.getElementById('sidebar');
const closeSidebarBtn = document.getElementById('close-sidebar');

// Funzione per aprire la sidebar
profileBtn.addEventListener('click', () => {
  const isSidebarOpen = !sidebar.classList.contains('translate-x-full');
  
  if (isSidebarOpen) {
    // Chiudi la sidebar
    sidebar.classList.add('translate-x-full');
    sidebarOverlay.classList.add('hidden');
  } else {
    // Apri la sidebar
    sidebar.classList.remove('translate-x-full');
    sidebarOverlay.classList.remove('hidden');
  }
});

// Chiusura: aggiunge la classe per spostare la sidebar fuori dalla viewport (a destra)
closeSidebarBtn.addEventListener('click', () => {
  sidebar.classList.add('translate-x-full');
});

function closeSidebar() {
  sidebar.classList.add('translate-x-full');
  sidebarOverlay.classList.add('hidden');
}

// Funzione per cambiare tema
async function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme') || currentProfile?.theme || 'dark';
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';
  
  // Aggiorna l'attributo data-theme
  document.documentElement.setAttribute('data-theme', newTheme);
  
  // Aggiorna l'icona e il testo del bottone
  const themeButton = document.getElementById('theme-toggle-btn');
  if (themeButton) {
    if (newTheme === 'light') {
      themeButton.innerHTML = '<i class="fas fa-moon mr-2"></i> Tema Scuro';
    } else {
      themeButton.innerHTML = '<i class="fas fa-sun mr-2"></i> Tema Chiaro';
    }
  }
  

  // Forza un aggiornamento visivo
  document.body.classList.toggle('theme-light', newTheme === 'light');
  document.body.classList.toggle('theme-dark', newTheme === 'dark');

  // Aggiorna il tasto cerchio in base al tema
  profileBtn.style.backgroundColor = `var(--btn-primary)`;
  profileBtn.style.color = `var(--text-on-dark)`;
  
  // Salva il tema nel database
  if (currentUser) {
    const success = await updateUserTheme(currentUser.id, newTheme);
    if (success) {
      currentProfile.theme = newTheme; // Aggiorna il profilo locale
    }
  }
}

// funzione per aggiornare il tasto cerchio
function updateProfileButton() {
  if (currentProfile.profile_picture) {
    userProfilePic.src = currentProfile.profile_picture;
    userProfilePic.classList.remove('hidden');
    userInitials.classList.add('hidden');
  } else {
    const initials = `${currentProfile.first_name[0]}${currentProfile.last_name[0]}`.toUpperCase();
    userInitials.textContent = initials;
    userInitials.classList.remove('hidden');
    userProfilePic.classList.add('hidden');
  }
}



// Funzione per caricare il tema salvato
function applyUserTheme() {
  const theme = currentProfile?.theme || 'dark'; // Usa il tema del profilo o 'dark' come fallback
  document.documentElement.setAttribute('data-theme', theme);
  
  // Aggiorna il bottone in base al tema
  const themeButton = document.getElementById('theme-toggle-btn');
  if (themeButton) { // Verifica che il bottone esista
    if (theme === 'light') {
      themeButton.innerHTML = '<i class="fas fa-moon mr-2"></i> Tema Scuro';
    } else {
      themeButton.innerHTML = '<i class="fas fa-sun mr-2"></i> Tema Chiaro';
    }
  }

  // Forza un aggiornamento visivo
  document.body.classList.toggle('theme-light', theme === 'light');
  document.body.classList.toggle('theme-dark', theme === 'dark');
}

closeSidebarBtn.addEventListener('click', closeSidebar);

// Chiudi la sidebar anche quando si clicca sull'overlay
sidebarOverlay.addEventListener('click', closeSidebar);

// Esempio: al clic sul bottone Logout chiudi la sidebar e chiama la funzionalità di logout
document.getElementById('btn-logout').addEventListener('click', () => {
    closeSidebar();
  sidebar.classList.add('translate-x-full');
  document.getElementById('logout-btn').click();
});

// Analogamente, per Modifica Profilo:
document.getElementById('btn-edit-profile').addEventListener('click', () => {
  sidebar.classList.add('translate-x-full');
  closeSidebar();
  // Simula il click sul bottone "edit-profile-btn" già presente nel markup
  document.getElementById('edit-profile-btn').click();
});

// Menu Admin: gestisci il toggle del sottomenu nella sidebar
document.getElementById('btn-admin-menu').addEventListener('click', () => {
  const submenu = document.getElementById('admin-submenu-sidebar');
  submenu.classList.toggle('hidden');
  
});

// Associa i singoli sottomenu ai bottoni originali già presenti
document.getElementById('sidebar-open-role-modal').addEventListener('click', () => {
  sidebar.classList.add('translate-x-full');
  closeSidebar();
  document.getElementById('open-role-modal').click();
  
});

document.getElementById('sidebar-open-room-modal').addEventListener('click', () => {
  sidebar.classList.add('translate-x-full');
  closeSidebar();
  document.getElementById('open-room-modal').click();
});

document.getElementById('sidebar-open-delete-user-modal').addEventListener('click', () => {
  sidebar.classList.add('translate-x-full');
  closeSidebar();
  document.getElementById('open-delete-user-modal').click();
});
// Event listener per il login
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  const errorElement = document.getElementById('login-error');

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;

    // Login riuscito
    currentUser = data.user;
    // Carica il profilo (se necessario)
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', currentUser.id)
      .single();

    if (profileError) throw profileError;

    currentProfile = profileData;

    // Nascondi la sezione di autenticazione e mostra il gestionale
    document.getElementById('auth-section').style.display = 'none';
    document.getElementById('app-section').style.display = 'block';

    // Aggiorna la UI (es. mostra il pulsante di logout)
    document.getElementById('logout-btn').classList.remove('hidden');

    // Carica i dati del gestionale (es. prenotazioni, scrivanie, ecc.)
    //await loadAppData(); // Assicurati che questa funzione esista e carichi i dati
  } catch (error) {
    errorElement.textContent = error.message;
    errorElement.classList.remove('hidden');
  }
});

// Evento per aprire la modale "Prenotazioni di Altri Utenti" dalla sidebar
document.getElementById('sidebar-open-admin-bookings').addEventListener('click', async (e) => {
    e.preventDefault();
    closeSidebar();
    showModal('adminBookingsModal'); // Apre la modale
    await loadAllBookings();         // Carica le prenotazioni
  applyUserBookingsFilters();
  setupAdminModalTabs(); // Chiama qui per garantire che i listener siano impostati
});


// Evento per chiudere la modale "Prenotazioni di Altri Utenti"
document.getElementById('close-adminBookingsModal').addEventListener('click', () => {
  hideModal('adminBookingsModal');
});
function showModal(modalId) {
  document.getElementById(modalId).classList.remove('hidden');
}

function hideModal(modalId) {
  document.getElementById(modalId).classList.add('hidden');
}

// Funzione per recuperare tutte le prenotazioni filtrate
async function getAllFilteredBookings() {
    try {
        // Recupera i valori dei filtri attuali
        const userFilter = document.getElementById('booking-filter-user').value;
        const roomFilter = document.getElementById('booking-filter-room').value;
        const dateFilter = document.getElementById('booking-filter-date').value;
        
        // Costruisci la query per ottenere tutte le prenotazioni filtrate
        let query = supabase
            .from('bookings')
            .select('*, rooms(name, floor), profiles(first_name, last_name)');
        
        // Applica gli stessi filtri utilizzati nella visualizzazione
        if (userFilter) {
            query = query.ilike('profiles.first_name', `%${userFilter}%`);
        }
        
        if (roomFilter && roomFilter !== 'all') {
            query = query.eq('room_id', roomFilter);
        }
        
        if (dateFilter) {
            query = query.eq('booking_date', dateFilter);
        }
        
        // Ordina per data di prenotazione
        query = query.order('booking_date', { ascending: false });
        
        // Esegui la query
        let { data: bookings, error } = await query;
        
        if (error) throw error;
        
        return bookings;
    } catch (error) {
        console.error("Errore durante il recupero delle prenotazioni:", error);
        await showNotificationPopup("Errore durante il recupero delle prenotazioni: " + error.message);
        return [];
    }
}

// Funzione per esportare in CSV (modifica della funzione esistente)
async function exportAllBookingsCSV() {
    try {
        await showNotificationPopup("Preparazione download CSV in corso...");
        
        const bookings = await getAllFilteredBookings();
        if (bookings.length === 0) {
            await showNotificationPopup("Nessuna prenotazione trovata da esportare");
            return;
        }
        
        // Converti i dati in formato CSV
        const csvContent = convertToCSV(bookings);
        
        // Crea e scarica il file
        downloadCSV(csvContent, 'prenotazioni.csv');
        
        await showNotificationPopup("Download CSV completato!");
    } catch (error) {
        console.error("Errore durante l'esportazione CSV:", error);
        await showNotificationPopup("Errore durante l'esportazione: " + error.message);
    }
}

// Funzione per esportare in Excel
async function exportAllBookingsExcel() {
    try {
        await showNotificationPopup("Preparazione download Excel in corso...");
        
        const bookings = await getAllFilteredBookings();
        if (bookings.length === 0) {
            await showNotificationPopup("Nessuna prenotazione trovata da esportare");
            return;
        }
        
        // Prepara i dati per Excel
        const excelData = bookings.map(booking => ({
            'Nome Utente': booking.profiles.first_name,
            'Cognome Utente': booking.profiles.last_name,
            'Data Prenotazione': booking.booking_date,
            'Stanza': booking.rooms.name,
            'Piano': booking.rooms.floor,
            'Numero Scrivania': booking.desk_number,
            'Slot Prenotazione': booking.booking_slot || ''
        }));
        
        // Crea il workbook
        const worksheet = XLSX.utils.json_to_sheet(excelData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Prenotazioni");
        
        // Formatta le colonne
        const maxWidth = excelData.reduce((w, r) => Math.max(w, r['Nome Utente'].length, r['Cognome Utente'].length), 10);
        const colWidths = [
            { wch: maxWidth }, // Nome
            { wch: maxWidth }, // Cognome
            { wch: 15 },       // Data
            { wch: 15 },       // Stanza
            { wch: 10 },       // Piano
            { wch: 12 },       // Scrivania
            { wch: 15 }        // Slot
        ];
        worksheet['!cols'] = colWidths;
        
        // Genera il file
        const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        
        // Crea e scarica il file
        downloadExcel(excelBuffer, 'prenotazioni.xlsx');
        
        await showNotificationPopup("Download Excel completato!");
    } catch (error) {
        console.error("Errore durante l'esportazione Excel:", error);
        await showNotificationPopup("Errore durante l'esportazione: " + error.message);
    }
}

// Funzione per scaricare il file Excel
function downloadExcel(buffer, filename) {
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}


// Aggiorna la funzione showModal per il adminBookingsModal
const originalShowModal = showModal;
showModal = function(modalId) {
    originalShowModal(modalId);
    
    // Se si tratta della modale admin, assicurati che il tab Prenotazioni sia attivo
    if (modalId === 'adminBookingsModal') {
        const tabBookings = document.getElementById('tab-bookings');
        const contentBookings = document.getElementById('content-bookings');
        
        // Disattiva tutti i tab
        document.getElementById('tab-statistics').classList.remove('border-blue-600', 'dark:border-blue-500', 'text-blue-600', 'dark:text-blue-500');
        document.getElementById('tab-statistics').classList.add('border-transparent', 'hover:text-gray-600', 'hover:border-gray-300', 'dark:hover:text-gray-300');
        
        // Attiva il tab Prenotazioni
        tabBookings.classList.remove('border-transparent', 'hover:text-gray-600', 'hover:border-gray-300', 'dark:hover:text-gray-300');
        tabBookings.classList.add('border-blue-600', 'dark:border-blue-500', 'text-blue-600', 'dark:text-blue-500');
        
        // Nascondi il contenuto Statistiche
        document.getElementById('content-statistics').classList.add('hidden');
        
        // Mostra il contenuto Prenotazioni
        contentBookings.classList.remove('hidden');
    }
};
// Funzione per caricare le statistiche
// Funzione per caricare le statistiche
async function loadStatistics() {
    try {
        console.log("loadStatistics() chiamata");
        
        // Ottieni i valori dei filtri
        const dateFromEl = document.getElementById('stats-filter-date-from');
        const dateToEl = document.getElementById('stats-filter-date-to');
        const roomFilterEl = document.getElementById('stats-filter-room');
        const userFilterEl = document.getElementById('stats-filter-user');
        
        if (!dateFromEl || !dateToEl || !roomFilterEl) {
            console.error("Elementi dei filtri non trovati");
            return;
        }
        
        const dateFrom = dateFromEl.value;
        const dateTo = dateToEl.value;
        const roomFilter = roomFilterEl.value;
        const userFilter = userFilterEl ? userFilterEl.value : '';
        
        console.log("Filtri applicati:", { dateFrom, dateTo, roomFilter, userFilter });
        
        // Mostra loader
        const statisticsContainer = document.getElementById('statistics-container');
        statisticsContainer.innerHTML = '<div class="col-span-2 text-center py-10"><i class="fas fa-spinner fa-spin fa-2x"></i><p class="mt-2 text-gray-600 dark:text-gray-400">Caricamento statistiche...</p></div>';
        
        // Costruisci query base
        let query = supabase
            .from('bookings')
            .select(`
                id,
                booking_date,
                desk_number,
                booking_slot,
                room_id,
                user_id,
                rooms(id, name, floor),
                profiles:user_id(id, first_name, last_name)
            `);
        
        // Applica filtri
        if (dateFrom) {
            console.log("Applicazione filtro data inizio:", dateFrom);
            query = query.gte('booking_date', dateFrom);
        }
        
        if (dateTo) {
            console.log("Applicazione filtro data fine:", dateTo);
            query = query.lte('booking_date', dateTo);
        }
        
        if (roomFilter && roomFilter !== "all") {
            console.log("Applicazione filtro stanza:", roomFilter);
            query = query.eq('room_id', roomFilter);
        }
        
        // Filtro per utente - CORREZIONE: gestione più semplice e diretta
        if (userFilter && userFilter !== '') {
            console.log("Applicazione filtro utente ID:", userFilter);
            // Ora che abbiamo un menu a tendina, userFilter contiene direttamente l'ID
            query = query.eq('user_id', userFilter);
        }
        
        // Esegui query
        console.log("Esecuzione query Supabase...");
        let { data: bookings, error } = await query;
        
        if (error) {
            console.error("Errore nel caricamento delle statistiche:", error);
            statisticsContainer.innerHTML = `
                <div class="col-span-2 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 p-4 rounded-lg">
                    <p>Errore durante il caricamento delle statistiche: ${error.message}</p>
                </div>`;
            return;
        }
        
        console.log(`Recuperate ${bookings?.length || 0} prenotazioni`);
        
        // Gestisci caso nessuna prenotazione
        if (!bookings || bookings.length === 0) {
            statisticsContainer.innerHTML = `
                <div class="col-span-2 text-center py-10">
                    <p class="text-gray-600 dark:text-gray-400">Nessuna prenotazione trovata per i filtri selezionati.</p>
                </div>`;
            return;
        }
        
        // Se è stato specificato un filtro utente, mostra un messaggio che indica per quale utente sono visualizzate le statistiche
        let userFilterMessage = '';
        if (userFilter && userFilter !== '' && bookings.length > 0) {
            // Trova il nome dell'utente dalle prenotazioni recuperate
            const firstBooking = bookings[0];
            if (firstBooking.profiles) {
                const userName = `${firstBooking.profiles.first_name} ${firstBooking.profiles.last_name}`;
                userFilterMessage = `<div class="col-span-2 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 p-4 rounded-lg mb-4">
                    <p>Statistiche filtrate per l'utente: <strong>${userName}</strong></p>
                </div>`;
            }
        }
        
        // Calcola statistiche
        const stats = calculateStatistics(bookings);
        console.log("Statistiche calcolate:", stats);
        
        // Renderizza statistiche con eventuale messaggio di filtro utente
        statisticsContainer.innerHTML = userFilterMessage;
        renderStatistics(stats, bookings, userFilter);
        
        // Salva dati per esportazione
        window.statsData = {
            stats: stats,
            bookings: bookings,
            filters: { dateFrom, dateTo, roomFilter, userFilter }
        };
        
        console.log("Statistiche caricate con successo");
    } catch (error) {
        console.error("Errore durante il caricamento delle statistiche:", error);
        const container = document.getElementById('statistics-container');
        if (container) {
            container.innerHTML = `
                <div class="col-span-2 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 p-4 rounded-lg">
                    <p>Errore durante il caricamento delle statistiche: ${error.message || error}</p>
                </div>`;
        }
    }
}
// Funzione per calcolare le statistiche
// Funzione per calcolare le statistiche
function calculateStatistics(bookings) {
    // Oggetto per memorizzare le statistiche
    const stats = {
        totalBookings: bookings.length,
        bookingsByRoom: {},
        bookingsByDate: {},
        bookingsByUser: {},
        bookingsByFloor: {},
        bookingsByDayOfWeek: {
            'Lunedì': 0,
            'Martedì': 0,
            'Mercoledì': 0,
            'Giovedì': 0,
            'Venerdì': 0,
            'Sabato': 0,
            'Domenica': 0
        },
        bookingsByMonth: {
            'Gennaio': 0, 'Febbraio': 0, 'Marzo': 0, 'Aprile': 0,
            'Maggio': 0, 'Giugno': 0, 'Luglio': 0, 'Agosto': 0,
            'Settembre': 0, 'Ottobre': 0, 'Novembre': 0, 'Dicembre': 0
        }
    };
    
    // Mapping italiano per i giorni della settimana
    const dayMapping = {
        0: 'Domenica',
        1: 'Lunedì',
        2: 'Martedì',
        3: 'Mercoledì',
        4: 'Giovedì',
        5: 'Venerdì',
        6: 'Sabato'
    };
    
    // Mapping italiano per i mesi
    const monthMapping = {
        0: 'Gennaio',
        1: 'Febbraio',
        2: 'Marzo',
        3: 'Aprile',
        4: 'Maggio',
        5: 'Giugno',
        6: 'Luglio',
        7: 'Agosto',
        8: 'Settembre',
        9: 'Ottobre',
        10: 'Novembre',
        11: 'Dicembre'
    };
    
    // Calcola le statistiche per stanza, data, utente e piano
    bookings.forEach(booking => {
        // Statistiche per stanza
        const roomName = booking.rooms?.name || 'N/A';
        stats.bookingsByRoom[roomName] = (stats.bookingsByRoom[roomName] || 0) + 1;
        
        // Statistiche per piano
        const floor = booking.rooms?.floor || 'N/A';
        const floorName = `Piano ${floor}`;
        stats.bookingsByFloor[floorName] = (stats.bookingsByFloor[floorName] || 0) + 1;
        
        // Statistiche per data
        const bookingDate = booking.booking_date;
        stats.bookingsByDate[bookingDate] = (stats.bookingsByDate[bookingDate] || 0) + 1;
        
        // Statistiche per utente
        const userName = booking.profiles ? 
            `${booking.profiles.first_name} ${booking.profiles.last_name}` : 'Utente sconosciuto';
        stats.bookingsByUser[userName] = (stats.bookingsByUser[userName] || 0) + 1;
        
        // Statistiche per giorno della settimana
        const date = new Date(bookingDate);
        const dayOfWeek = dayMapping[date.getDay()];
        stats.bookingsByDayOfWeek[dayOfWeek]++;
        
        // Statistiche per mese
        const month = monthMapping[date.getMonth()];
        stats.bookingsByMonth[month]++;
    });
    
    return stats;
}

// Funzione per renderizzare le statistiche
function renderStatistics(stats, bookings, userFilter) {
    try {
        console.log("Rendering statistiche...");
        const container = document.getElementById('statistics-container');
        if (!container) {
            console.error("Container statistiche non trovato");
            return;
        }
        
        // Modifica la classe del container per layout responsive
        container.className = 'grid grid-cols-1 md:grid-cols-2 gap-4 p-4';
        
        // Svuota il container prima di aggiungere nuove card
        container.innerHTML = '';
        
        // Aggiungi carte con statistiche generali
        addStatCard(container, 'Totale Prenotazioni', stats.totalBookings);
        
        // Verifica se ci sono dati per le prenotazioni per stanza
        if (Object.keys(stats.bookingsByRoom).length > 0) {
            addChartCard(container, 'Prenotazioni per Stanza', 'pie', 
                Object.keys(stats.bookingsByRoom), 
                Object.values(stats.bookingsByRoom),
                stats.bookingsByRoom
            );
        } else {
            addEmptyCard(container, 'Prenotazioni per Stanza');
        }
        
        // Verifica se ci sono dati per le prenotazioni per piano
        if (Object.keys(stats.bookingsByFloor).length > 0) {
            addChartCard(container, 'Prenotazioni per Piano', 'pie', 
                Object.keys(stats.bookingsByFloor), 
                Object.values(stats.bookingsByFloor),
                stats.bookingsByFloor
            );
        } else {
            addEmptyCard(container, 'Prenotazioni per Piano');
        }
        
        // Verifica se ci sono dati per le prenotazioni per giorno della settimana
        if (Object.keys(stats.bookingsByDayOfWeek).length > 0) {
            addChartCard(container, 'Prenotazioni per Giorno', 'bar', 
                Object.keys(stats.bookingsByDayOfWeek), 
                Object.values(stats.bookingsByDayOfWeek),
                stats.bookingsByDayOfWeek
            );
        } else {
            addEmptyCard(container, 'Prenotazioni per Giorno');
        }
        
        // Verifica se ci sono dati per le prenotazioni per mese
        if (Object.keys(stats.bookingsByMonth).length > 0) {
            addChartCard(container, 'Prenotazioni per Mese', 'bar', 
                Object.keys(stats.bookingsByMonth), 
                Object.values(stats.bookingsByMonth),
                stats.bookingsByMonth
            );
        } else {
            addEmptyCard(container, 'Prenotazioni per Mese');
        }
        
        // Se non è stato applicato un filtro utente, mostra le statistiche per utente
        if (!userFilter && Object.keys(stats.bookingsByUser).length > 0) {
            // Limita a 10 utenti per leggibilità
            const topUsers = Object.entries(stats.bookingsByUser)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10)
                .reduce((obj, [key, value]) => {
                    obj[key] = value;
                    return obj;
                }, {});
                
            addChartCard(container, 'Top 10 Utenti', 'bar', 
                Object.keys(topUsers), 
                Object.values(topUsers),
                topUsers
            );
        }
        
        console.log("Rendering statistiche completato");
    } catch (error) {
        console.error("Errore durante il rendering delle statistiche:", error);
        const container = document.getElementById('statistics-container');
        if (container) {
            container.innerHTML = `
                <div class="col-span-1 md:col-span-2 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 p-4 rounded-lg">
                    <p>Errore durante il rendering delle statistiche: ${error.message || error}</p>
                </div>`;
        }
    }
}

// Funzione per generare la tabella delle ultime prenotazioni dell'utente
function generateUserBookingsTable(bookings) {
    // Ordina le prenotazioni per data (più recenti prima)
    const sortedBookings = [...bookings].sort((a, b) => 
        new Date(b.booking_date) - new Date(a.booking_date)
    );
    
    // Prendi solo le ultime 10
    const recentBookings = sortedBookings.slice(0, 10);
    
    if (recentBookings.length === 0) {
        return '<tr><td colspan="4" class="px-4 py-2 text-center">Nessuna prenotazione trovata</td></tr>';
    }
    
    // Genera le righe della tabella
    return recentBookings.map(booking => `
        <tr class="border-b dark:border-gray-700">
            <td class="px-4 py-2">${formatDate(booking.booking_date)}</td>
            <td class="px-4 py-2">${booking.rooms?.name || 'N/A'}</td>
            <td class="px-4 py-2">${booking.desk_number || 'N/A'}</td>
            <td class="px-4 py-2">${getSlotLabel(booking.booking_slot) || 'N/A'}</td>
        </tr>
    `).join('');
}

// Funzione per formattare la data
function formatDate(dateString) {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('it-IT', options);
}

// Funzione per ottenere l'etichetta dello slot
function getSlotLabel(slot) {
    const slotLabels = {
        'morning': 'Mattina',
        'afternoon': 'Pomeriggio',
        'all_day': 'Tutto il giorno'
    };
    return slotLabels[slot] || slot;
}

// Funzione per creare i grafici specifici per l'utente
function createUserCharts(stats, bookings) {
    // Funzione per generare colori casuali
    function generateColors(count) {
        const colors = [];
        for (let i = 0; i < count; i++) {
            const hue = (i * 137.5) % 360; // Distribuzione uniforme dei colori
            colors.push(`hsla(${hue}, 70%, 60%, 0.7)`);
        }
        return colors;
    }
    
    // 1. Grafico per stanza
    const roomLabels = Object.keys(stats.bookingsByRoom);
    const roomData = Object.values(stats.bookingsByRoom);
    const roomColors = generateColors(roomLabels.length);
    
    new Chart(document.getElementById('userRoomChart').getContext('2d'), {
        type: 'pie',
        data: {
            labels: roomLabels,
            datasets: [{
                data: roomData,
                backgroundColor: roomColors
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });
    
    // 2. Grafico per giorno della settimana
    const dayLabels = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];
    const dayData = dayLabels.map(day => stats.bookingsByDayOfWeek[day] || 0);
    const dayColors = generateColors(dayLabels.length);
    
    new Chart(document.getElementById('userDayChart').getContext('2d'), {
        type: 'bar',
        data: {
            labels: dayLabels,
            datasets: [{
                label: 'Prenotazioni',
                data: dayData,
                backgroundColor: dayColors
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        precision: 0
                    }
                }
            }
        }
    });
    
    // 3. Grafico per slot orario
    // Prima calcola le statistiche per slot
    const slotStats = {};
    bookings.forEach(booking => {
        const slot = booking.booking_slot || 'unknown';
        slotStats[slot] = (slotStats[slot] || 0) + 1;
    });
    
    const slotMapping = {
        'morning': 'Mattina',
        'afternoon': 'Pomeriggio',
        'all_day': 'Tutto il giorno'
    };
    
    const slotLabels = Object.keys(slotStats).map(slot => slotMapping[slot] || slot);
    const slotData = Object.values(slotStats);
    const slotColors = generateColors(slotLabels.length);
    
    new Chart(document.getElementById('userSlotChart').getContext('2d'), {
        type: 'doughnut',
        data: {
            labels: slotLabels,
            datasets: [{
                data: slotData,
                backgroundColor: slotColors
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });
}

// Funzione per creare i grafici generali
function createGeneralCharts(stats) {
    // Funzione per generare colori casuali
    function generateColors(count) {
        const colors = [];
        for (let i = 0; i < count; i++) {
            const hue = (i * 137.5) % 360;
            colors.push(`hsla(${hue}, 70%, 60%, 0.7)`);
        }
        return colors;
    }
    
    // 1. Grafico per stanza
    const roomLabels = Object.keys(stats.bookingsByRoom);
    const roomData = Object.values(stats.bookingsByRoom);
    const roomColors = generateColors(roomLabels.length);
    
    new Chart(document.getElementById('roomChart').getContext('2d'), {
        type: 'bar',
        data: {
            labels: roomLabels,
            datasets: [{
                label: 'Prenotazioni',
                data: roomData,
                backgroundColor: roomColors
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        precision: 0
                    }
                }
            }
        }
    });
    
    // 2. Grafico per piano
    const floorLabels = Object.keys(stats.bookingsByFloor);
    const floorData = Object.values(stats.bookingsByFloor);
    const floorColors = generateColors(floorLabels.length);
    
    new Chart(document.getElementById('floorChart').getContext('2d'), {
        type: 'pie',
        data: {
            labels: floorLabels,
            datasets: [{
                data: floorData,
                backgroundColor: floorColors
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });
    
    // 3. Grafico per giorno della settimana
    const dayLabels = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];
    const dayData = dayLabels.map(day => stats.bookingsByDayOfWeek[day] || 0);
    const dayColors = generateColors(dayLabels.length);
    
    new Chart(document.getElementById('dayChart').getContext('2d'), {
        type: 'bar',
        data: {
            labels: dayLabels,
            datasets: [{
                label: 'Prenotazioni',
                data: dayData,
                backgroundColor: dayColors
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        precision: 0
                    }
                }
            }
        }
    });
    
    // 4. Grafico per mese
    const monthLabels = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 
                        'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
    const monthData = monthLabels.map(month => stats.bookingsByMonth[month] || 0);
    const monthColors = generateColors(monthLabels.length);
    
    new Chart(document.getElementById('monthChart').getContext('2d'), {
        type: 'bar',
        data: {
            labels: monthLabels,
            datasets: [{
                label: 'Prenotazioni',
                data: monthData,
                backgroundColor: monthColors
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        precision: 0
                    }
                }
            }
        }
    });
    
    // 5. Grafico per top 10 utenti
    const userLabels = Object.keys(stats.bookingsByUser)
        .sort((a, b) => stats.bookingsByUser[b] - stats.bookingsByUser[a])
        .slice(0, 10);
    const userData = userLabels.map(user => stats.bookingsByUser[user]);
    const userColors = generateColors(userLabels.length);
    
    new Chart(document.getElementById('userChart').getContext('2d'), {
        type: 'bar',
        data: {
            labels: userLabels,
            datasets: [{
                label: 'Prenotazioni',
                data: userData,
                backgroundColor: userColors
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        precision: 0
                    }
                }
            }
        }
    });
}

// Funzione per aggiungere una card con statistica numerica
function addStatCard(container, title, value) {
    const card = document.createElement('div');
    card.className = 'bg-white dark:bg-gray-800 p-4 md:p-6 rounded-lg shadow-md';
    card.innerHTML = `
        <h3 class="text-lg font-semibold text-gray-800 dark:text-white mb-2">${title}</h3>
        <p class="text-4xl font-bold text-blue-600 dark:text-blue-400">${value}</p>
    `;
    container.appendChild(card);
}

// Funzione per aggiungere una card con grafico
function addChartCard(container, title, chartType, labels, data, rawData) {
    try {
        // Crea un ID univoco per il canvas
        const cardId = `chart-${title.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;
        
        // Crea la card
        const card = document.createElement('div');
        card.className = 'bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md';
        
        // Quando non ci sono dati, mostra un messaggio invece del grafico
        if (!labels || !data || labels.length === 0 || data.length === 0) {
            card.innerHTML = `
                <h3 class="text-lg font-semibold text-gray-800 dark:text-white mb-4">${title}</h3>
                <div class="h-64 flex items-center justify-center">
                    <p class="text-gray-500 dark:text-gray-400">Nessun dato disponibile</p>
                </div>
            `;
            container.appendChild(card);
            return;
        }
        
        // Altrimenti, crea la card con il canvas per il grafico
        card.innerHTML = `
            <h3 class="text-lg font-semibold text-gray-800 dark:text-white mb-4">${title}</h3>
            <div class="h-64">
                <canvas id="${cardId}"></canvas>
            </div>
            <div class="mt-4 text-sm text-gray-600 dark:text-gray-400">
                <div class="stat-details overflow-y-auto max-h-24">
                    ${Object.entries(rawData).map(([key, value]) => 
                        `<div class="flex justify-between items-center">
                            <span>${key}</span>
                            <span class="font-semibold">${value}</span>
                        </div>`
                    ).join('')}
                </div>
            </div>
        `;
        
        container.appendChild(card);
        
        // Attendi che il DOM sia aggiornato prima di creare il grafico
        setTimeout(() => {
            const canvas = document.getElementById(cardId);
            if (!canvas) {
                console.error(`Canvas con ID ${cardId} non trovato nel DOM`);
                return;
            }
            
            // Crea il contesto del canvas
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                console.error(`Impossibile ottenere il contesto 2D per il canvas ${cardId}`);
                return;
            }
            
            // Configurazione del grafico in base al tipo
            let chartConfig = {};
            
            if (chartType === 'pie' || chartType === 'doughnut') {
                chartConfig = {
                    type: chartType,
                    data: {
                        labels: labels,
                        datasets: [{
                            data: data,
                            backgroundColor: generateColors(data.length),
                            borderWidth: 1
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                position: 'top',
                                labels: {
                                    color: document.documentElement.classList.contains('dark') ? '#fff' : '#333'
                                }
                            }
                        }
                    }
                };
            } else if (chartType === 'bar') {
                chartConfig = {
                    type: chartType,
                    data: {
                        labels: labels,
                        datasets: [{
                            label: 'Prenotazioni',
                            data: data,
                            backgroundColor: generateColors(data.length),
                            borderWidth: 1
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {
                            y: {
                                beginAtZero: true,
                                ticks: {
                                    color: document.documentElement.classList.contains('dark') ? '#fff' : '#333'
                                },
                                grid: {
                                    color: document.documentElement.classList.contains('dark') ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                                }
                            },
                            x: {
                                ticks: {
                                    color: document.documentElement.classList.contains('dark') ? '#fff' : '#333'
                                },
                                grid: {
                                    color: document.documentElement.classList.contains('dark') ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                                }
                            }
                        },
                        plugins: {
                            legend: {
                                display: false
                            }
                        }
                    }
                };
            }
            
            // Crea il grafico
            new Chart(ctx, chartConfig);
            
        }, 50); // Un breve ritardo per assicurarsi che il DOM sia aggiornato
    } catch (error) {
        console.error("Errore nella creazione della card del grafico:", error);
        // In caso di errore, aggiungi una card con un messaggio di errore
        const errorCard = document.createElement('div');
        errorCard.className = 'bg-red-100 dark:bg-red-900 p-4 rounded-lg shadow-md text-red-700 dark:text-red-200';
        errorCard.innerHTML = `
            <h3 class="text-lg font-semibold mb-2">${title} - Errore</h3>
            <p>Si è verificato un errore durante la creazione del grafico: ${error.message}</p>
        `;
        container.appendChild(errorCard);
    }
}

//Funzione per esportare le statistiche in formato XLSX
function exportStatisticsToXlsx() {
    if (!window.statsData) {
        alert("Nessun dato disponibile per l'esportazione");
        return;
    }
    
    const { stats, bookings, filters } = window.statsData;
    const { dateFrom, dateTo, roomFilter, userFilter } = filters;
    
    // Crea un nuovo workbook
    const wb = XLSX.utils.book_new();
    
    // Aggiungi foglio con informazioni sui filtri
    const filtersData = [
        ['Filtri applicati'],
        ['Data inizio', dateFrom || 'Nessuna'],
        ['Data fine', dateTo || 'Nessuna'],
        ['Stanza', roomFilter === 'all' ? 'Tutte' : roomFilter || 'Tutte'],
        ['Utente', userFilter || 'Tutti']
    ];
    
    const filtersSheet = XLSX.utils.aoa_to_sheet(filtersData);
    XLSX.utils.book_append_sheet(wb, filtersSheet, "Filtri");
    
    // Aggiungi foglio con le statistiche
    const statsSheet = createStatsWorksheet(stats, userFilter);
    XLSX.utils.book_append_sheet(wb, statsSheet, "Statistiche");
    
    // Aggiungi foglio con i dati grezzi
    const rawDataSheet = createRawDataWorksheet(bookings);
    XLSX.utils.book_append_sheet(wb, rawDataSheet, "Dati Prenotazioni");
    
    // Nome del file con la data corrente
    const today = new Date().toISOString().slice(0, 10);
    const fileName = userFilter 
        ? `statistiche_utente_${userFilter.replace(/\s+/g, '_')}_${today}.xlsx` 
        : `statistiche_prenotazioni_${today}.xlsx`;
    
    // Scarica il file
    XLSX.writeFile(wb, fileName);
}

// Funzione per creare il foglio delle statistiche
function createStatsWorksheet(stats) {
    const wsData = [];
    
    // Intestazione con informazioni sui filtri
    wsData.push(['Statistiche Prenotazioni']);
    wsData.push(['Totale prenotazioni', stats.totalBookings]);
    wsData.push(['', '']);
    
    // Aggiungi le statistiche per stanza
    wsData.push(['Prenotazioni per Stanza', '']);
    Object.entries(stats.bookingsByRoom)
        .sort((a, b) => b[1] - a[1]) // Ordina per numero di prenotazioni (decrescente)
        .forEach(([room, count]) => {
            wsData.push([room, count]);
        });
    
    wsData.push(['', '']);
    wsData.push(['Prenotazioni per Piano', '']);
    Object.entries(stats.bookingsByFloor)
        .sort((a, b) => b[1] - a[1])
        .forEach(([floor, count]) => {
            wsData.push([floor, count]);
        });
    
    wsData.push(['', '']);
    wsData.push(['Prenotazioni per Giorno della Settimana', '']);
    
    // Aggiungi le statistiche per giorno della settimana nell'ordine corretto
    const daysOrder = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];
    daysOrder.forEach(day => {
        wsData.push([day, stats.bookingsByDayOfWeek[day] || 0]);
    });
    
    wsData.push(['', '']);
    wsData.push(['Prenotazioni per Mese', '']);
    
    // Aggiungi le statistiche per mese nell'ordine corretto
    const monthsOrder = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 
                         'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
    monthsOrder.forEach(month => {
        wsData.push([month, stats.bookingsByMonth[month] || 0]);
    });
    
    wsData.push(['', '']);
    wsData.push(['Prenotazioni per Utente', '']);
    
    // Aggiungi le statistiche per utente (ordinate per numero di prenotazioni)
    Object.entries(stats.bookingsByUser)
        .sort((a, b) => b[1] - a[1])
        .forEach(([user, count]) => {
            wsData.push([user, count]);
        });
    
    return XLSX.utils.aoa_to_sheet(wsData);
}

// Funzione per creare il foglio dei dati grezzi
function createRawDataWorksheet(bookings) {
    // Intestazioni delle colonne
    const headers = ['Data', 'Stanza', 'Piano', 'Scrivania', 'Slot', 'Utente'];
    
    // Dati delle prenotazioni
    const data = bookings.map(booking => [
        booking.booking_date,
        booking.rooms?.name || 'N/A',
        booking.rooms?.floor || 'N/A',
        booking.desk_number || 'N/A',
        booking.booking_slot || 'N/A',
        booking.profiles ? `${booking.profiles.first_name} ${booking.profiles.last_name}` : 'N/A'
    ]);
    
    // Combina intestazioni e dati
    const wsData = [headers, ...data];
    
    return XLSX.utils.aoa_to_sheet(wsData);
}

// Funzione per generare un foglio Excel con le statistiche
function generateStatsWorksheet(stats, title) {
    // Crea gli array di dati per il foglio Excel
    const wsData = [
        [title, ''],
        ['', ''],
        ['Totale Prenotazioni', stats.totalBookings],
        ['', ''],
        ['Prenotazioni per Stanza', ''],
    ];
    
    // Aggiungi le statistiche per stanza
    Object.entries(stats.bookingsByRoom).forEach(([room, count]) => {
        wsData.push([room, count]);
    });
    
    wsData.push(['', '']);
    wsData.push(['Prenotazioni per Piano', '']);
    
    // Aggiungi le statistiche per piano
    Object.entries(stats.bookingsByFloor).forEach(([floor, count]) => {
        wsData.push([floor, count]);
    });
    
    wsData.push(['', '']);
    wsData.push(['Prenotazioni per Giorno della Settimana', '']);
    
    // Aggiungi le statistiche per giorno della settimana
    const daysOrder = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];
    daysOrder.forEach(day => {
        wsData.push([day, stats.bookingsByDayOfWeek[day] || 0]);
    });
    
    wsData.push(['', '']);
    wsData.push(['Prenotazioni per Mese', '']);
    
    // Aggiungi le statistiche per mese
    const monthsOrder = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 
                         'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
    monthsOrder.forEach(month => {
        wsData.push([month, stats.bookingsByMonth[month] || 0]);
    });
    
    wsData.push(['', '']);
    wsData.push(['Prenotazioni per Utente', '']);
    
    // Aggiungi le statistiche per utente (ordinate per numero di prenotazioni)
    Object.entries(stats.bookingsByUser)
        .sort((a, b) => b[1] - a[1])
        .forEach(([user, count]) => {
            wsData.push([user, count]);
        });
    
    return XLSX.utils.aoa_to_sheet(wsData);
}

// Funzione di utilità per ottenere il nome della stanza dal suo ID
function getRoomNameById(roomId) {
    // Assumo che esista una variabile globale o una funzione per recuperare le stanze
    // Questa è solo una funzione di esempio, adattala al tuo caso specifico
    const room = rooms.find(r => r.id.toString() === roomId.toString());
    return room ? room.name : roomId;
}
// Funzione per caricare le stanze nel filtro delle statistiche
async function loadRoomsIntoStatisticsFilter() {
  try {
    const selectElem = document.getElementById('stats-filter-room');
    
    if (!selectElem) {
      console.error("Elemento select 'stats-filter-room' non trovato");
      return;
    }
    
    // Ottieni tutte le stanze dal database
    let { data, error } = await supabase
      .from('rooms')
      .select('*')
      .order('name', { ascending: true });
      
    if (error) {
      console.error("Errore nel caricamento delle stanze:", error);
      return;
    }
    
    // Mantieni l'opzione "Tutte le stanze"
    selectElem.innerHTML = `<option value="all">Tutte le stanze</option>`;
    
    // Aggiungi un'opzione per ogni stanza
    if (data && data.length > 0) {
      data.forEach(room => {
        const option = document.createElement('option');
        option.value = room.id;
        option.textContent = `${room.name} (Piano ${room.floor})`;
        selectElem.appendChild(option);
      });
      
      console.log(`Caricate ${data.length} stanze nel menu a tendina`);
    } else {
      console.log("Nessuna stanza trovata");
    }
  } catch (err) {
    console.error("Errore durante il caricamento delle stanze:", err);
  }
}

// Funzione di debug per verificare gli elementi e gli event listener
function checkStatisticsElements() {
    console.log("Verifica elementi statistiche:");
    
    const elements = [
        'tab-statistics',
        'apply-stats-filters',
        'stats-filter-date-from',
        'stats-filter-date-to',
        'stats-filter-room',
        'stats-filter-user', // Aggiunto il nuovo filtro
        'export-stats-xlsx',
        'statistics-container'
    ];
    
    elements.forEach(id => {
        const element = document.getElementById(id);
        console.log(`Elemento '${id}': ${element ? 'Trovato' : 'NON trovato'}`);
    });
    
    // Verifica event listener
    const applyBtn = document.getElementById('apply-stats-filters');
    if (applyBtn) {
        console.log("Aggiunta listener di diagnosi al pulsante Applica Filtri");
        applyBtn.onclick = function() {
            console.log("DEBUG: Pulsante Applica Filtri cliccato via onclick");
            
            // Stampa valori dei filtri
            const dateFrom = document.getElementById('stats-filter-date-from')?.value;
            const dateTo = document.getElementById('stats-filter-date-to')?.value;
            const room = document.getElementById('stats-filter-room')?.value;
            const user = document.getElementById('stats-filter-user')?.value; // Nuovo filtro utente
            
            console.log("Valori filtri:", {
                dateFrom: dateFrom || 'non impostato',
                dateTo: dateTo || 'non impostato',
                room: room || 'non impostato',
                user: user || 'non impostato' // Nuovo filtro utente
            });
            
            loadStatistics();
        };
    }
    
    // Verifica event listener per esportazione
    const exportBtn = document.getElementById('export-stats-xlsx');
    if (exportBtn) {
        console.log("Aggiunta listener di diagnosi al pulsante Esporta Excel");
        exportBtn.onclick = function() {
            console.log("DEBUG: Pulsante Esporta Excel cliccato via onclick");
            
            if (window.statsData) {
                console.log("Dati statistiche disponibili:", {
                    bookings: window.statsData.bookings?.length || 0,
                    filtri: window.statsData.filters
                });
            } else {
                console.log("ATTENZIONE: window.statsData non trovato o vuoto");
            }
            
            exportStatisticsToXlsx();
        };
    }
    
    // Verifica inizializzazione DatePicker
    const dateFromEl = document.getElementById('stats-filter-date-from');
    const dateToEl = document.getElementById('stats-filter-date-to');
    
    if (dateFromEl && dateToEl) {
        // Imposta date predefinite (mese corrente)
        const today = new Date();
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        
        const formatDate = (date) => {
            return date.toISOString().split('T')[0];
        };
        
        if (!dateFromEl.value) {
            dateFromEl.value = formatDate(firstDay);
            console.log("Impostata data inizio predefinita:", dateFromEl.value);
        }
        
        if (!dateToEl.value) {
            dateToEl.value = formatDate(lastDay);
            console.log("Impostata data fine predefinita:", dateToEl.value);
        }
    }
    
    // Verifica il filtro utente (nuovo)
    const userFilterEl = document.getElementById('stats-filter-user');
    if (userFilterEl) {
        console.log("Filtro utente configurato correttamente");
        
        // Aggiungi event listener per ricerca immediata all'input
        userFilterEl.addEventListener('input', function() {
            console.log("Input filtro utente modificato:", this.value);
        });
    }
    
    console.log("Verifica elementi statistiche completata");
    return true;
}
// Carica la lista degli utenti per il filtro statistiche
async function loadUsersIntoStatisticsFilter() {
  try {
    const selectElem = document.getElementById('stats-filter-user');
    
    if (!selectElem) {
      console.error("Elemento select 'stats-filter-user' non trovato");
      return;
    }
    
    console.log("Caricamento lista utenti per filtro statistiche...");
    
    // Ottieni tutti gli utenti non cancellati dal database
    let { data, error } = await supabase
      .from('profiles')
      .select('id, first_name, last_name')
      .eq('deleted', false)
      .order('last_name', { ascending: true });
      
    if (error) {
      console.error("Errore nel caricamento della lista utenti:", error);
      return;
    }
    
    // Mantieni l'opzione "Tutti gli utenti"
    selectElem.innerHTML = `<option value="">Tutti gli utenti</option>`;
    
    // Aggiungi un'opzione per ogni utente
    if (data && data.length > 0) {
      data.forEach(user => {
        const option = document.createElement('option');
        option.value = user.id;
        option.textContent = `${user.first_name} ${user.last_name}`;
        selectElem.appendChild(option);
      });
      
      console.log(`Caricati ${data.length} utenti nel menu a tendina`);
    } else {
      console.log("Nessun utente trovato");
    }
  } catch (err) {
    console.error("Errore durante il caricamento degli utenti:", err);
  }
}
// Funzione per inizializzare i filtri statistiche
function initializeStatisticsFilters() {
  try {
    console.log("Inizializzazione filtri statistiche");
    
    // Imposta date predefinite (mese corrente)
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    
    const formatDate = (date) => {
      return date.toISOString().split('T')[0];
    };
    
    const dateFromEl = document.getElementById('stats-filter-date-from');
    const dateToEl = document.getElementById('stats-filter-date-to');
    
    if (dateFromEl) {
      dateFromEl.value = formatDate(firstDay);
    }
    
    if (dateToEl) {
      dateToEl.value = formatDate(lastDay);
    }
    
    // Carica le stanze nel filtro
    loadRoomsIntoStatisticsFilter();
    
    // Carica gli utenti nel filtro
    loadUsersIntoStatisticsFilter();
    
    // Collega l'evento al pulsante "Applica Filtri"
    const applyBtn = document.getElementById('apply-stats-filters');
    if (applyBtn) {
      applyBtn.addEventListener('click', function() {
        console.log("Pulsante Applica Filtri cliccato");
        loadStatistics();
      });
    }
    
    // Collega l'evento al pulsante "Esporta in Excel"
    const exportBtn = document.getElementById('export-stats-xlsx');
    if (exportBtn) {
      exportBtn.addEventListener('click', function() {
        console.log("Pulsante Esporta Excel cliccato");
        exportStatisticsToXlsx();
      });
    }
    
    console.log("Filtri statistiche inizializzati");
  } catch (err) {
    console.error("Errore durante l'inizializzazione dei filtri statistiche:", err);
  }
}

// Funzione per aggiungere una card vuota quando non ci sono dati
function addEmptyCard(container, title) {
    const card = document.createElement('div');
    card.className = 'bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md';
    card.innerHTML = `
        <h3 class="text-lg font-semibold text-gray-800 dark:text-white mb-4">${title}</h3>
        <div class="h-64 flex items-center justify-center">
            <p class="text-gray-500 dark:text-gray-400">Nessun dato disponibile</p>
        </div>
    `;
    container.appendChild(card);
}
// Funzione per generare colori casuali per i grafici
function generateColors(count) {
    const colors = [
        '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
        '#FF9F40', '#8AC249', '#EA5545', '#F46A9B', '#EF9B20',
        '#EDBF33', '#87BC45', '#27AEEF', '#B33DC6'
    ];
    
    // Se abbiamo abbastanza colori predefiniti, usiamo quelli
    if (count <= colors.length) {
        return colors.slice(0, count);
    }
    
    // Altrimenti generiamo colori casuali
    const result = [...colors];
    for (let i = colors.length; i < count; i++) {
        const r = Math.floor(Math.random() * 200);
        const g = Math.floor(Math.random() * 200);
        const b = Math.floor(Math.random() * 200);
        result.push(`rgb(${r}, ${g}, ${b})`);
    }
    
    return result;
}
// Event listener per aprire la modale
document.getElementById('sidebar-open-holidays-manager').addEventListener('click', async (e) => {
    e.preventDefault();
    closeSidebar();
    showModal('holidaysManagerModal');
    await loadHolidaysData();
    calculateHolidaysAndPermits();
    updateFieldsState(new Date(document.getElementById('hire-date').value || 'Invalid Date')); // Inizializza lo stato
});

// Event listener per aprire la modale
document.getElementById('sidebar-open-holidays-manager').addEventListener('click', async (e) => {
    e.preventDefault();
    closeSidebar();
    showModal('holidaysManagerModal');
    await loadHolidaysData();
    calculateHolidaysAndPermits();
});

// Event listener per chiudere la modale
document.getElementById('close-holidays-manager-modal').addEventListener('click', () => {
    hideModal('holidaysManagerModal');
});

// Carica dati da Supabase
async function loadHolidaysData() {
    try {
        // Recupera l'utente corrente
        const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser();
        if (userError || !currentUser) {
            console.error('Errore durante il recupero dell\'utente:', userError);
            return;
        }

        const { data, error } = await supabase
            .from('holidays_data')
            .select('*')
            .eq('user_id', currentUser.id)  // Usa `currentUser.id`
            .single();

        if (error) {
            console.error('Errore durante il caricamento dei dati:', error);
            return;
        }

        if (data) {
            document.getElementById('hire-date').value = data.hire_date || '';
            document.getElementById('residual-vacation').value = data.residual_vacation || 0;
            document.getElementById('residual-permits').value = data.residual_permits || 0;
            document.getElementById('residual-rol').value = data.residual_rol || 0;
            document.getElementById('vacation-used').value = data.vacation_used || 0;
            document.getElementById('permits-used').value = data.permits_used || 0;
            document.getElementById('rol-used').value = data.rol_used || 0;

            calculateHolidaysAndPermits();
        }
    } catch (error) {
        console.error('Errore generale:', error);
    }
}

// Calcolo ferie, permessi e ROL
function calculateHolidaysAndPermits(data = {}) {
    const hireDateInput = document.getElementById('hire-date').value;
    const hireDate = hireDateInput ? new Date(hireDateInput) : null;
    const today = new Date();
    const residualVacation = parseFloat(document.getElementById('residual-vacation').value) || 0;
    const residualPermits = parseFloat(document.getElementById('residual-permits').value) || 0;
    const residualRol = parseFloat(document.getElementById('residual-rol').value) || 0;
    const vacationUsedInput = parseFloat(document.getElementById('vacation-used').value) || 0;
    const permitsUsed = parseFloat(document.getElementById('permits-used').value) || 0;
    const rolUsed = parseFloat(document.getElementById('rol-used').value) || 0;
    const vacationUsed = vacationUsedInput;

    updateFieldsState(hireDate);

    const seniorityYears = hireDate && !isNaN(hireDate.getTime()) 
        ? (today - hireDate) / (1000 * 60 * 60 * 24 * 365.25) 
        : 0;
    document.getElementById('seniority-info').textContent = hireDate 
        ? `Anzianità lavorativa: ${seniorityYears.toFixed(1)} anni` 
        : 'Inserire data di assunzione per calcolare anzianità';

    let vacationDaysAnnual = 26;
    let permitsHoursAnnual = 32;
    let rolHoursAnnual = seniorityYears >= 4 ? 72 : seniorityYears >= 2 ? 36 : 0;

    if (data.vacation) {
        vacationDaysAnnual = data.vacation.accrued * 12;
        permitsHoursAnnual = data.permits ? data.permits.accrued * 12 : permitsHoursAnnual;
        rolHoursAnnual = data.rol ? data.rol.accrued * 12 : rolHoursAnnual;
    }

    const vacationMonthly = data.vacation ? data.vacation.accrued : vacationDaysAnnual / 12;
    const permitsMonthly = data.permits ? data.permits.accrued : permitsHoursAnnual / 12;
    const rolMonthly = data.rol ? data.rol.accrued : rolHoursAnnual / 12;

    const currentMonth = today.getMonth();
    const currentDay = today.getDate();
    let monthsMatured;
    const company = currentProfile.company;
    if (company === 'progesi') {
        monthsMatured = currentDay >= 5 ? currentMonth : currentMonth - 1;
    } else if (company === 'bvtech' || company === 'tbridge') {
        monthsMatured = currentDay >= 27 ? currentMonth + 1 : currentMonth;
    } else {
        monthsMatured = currentDay >= 5 ? currentMonth : currentMonth - 1;
    }
    if (monthsMatured < 0) monthsMatured = 0;

    document.getElementById('matured-months-counter').textContent = monthsMatured;

    const vacationMatured = vacationMonthly * monthsMatured;
    const permitsMatured = permitsMonthly * monthsMatured;
    const rolMatured = seniorityYears >= 2 ? rolMonthly * monthsMatured : 0;

    // Maturati Anno Corrente
    document.getElementById('vacation-previous-month').textContent = vacationMatured.toFixed(5);
    document.getElementById('permits-previous-month').textContent = formatHoursWithDays(permitsMatured);
    document.getElementById('rol-previous-month').textContent = seniorityYears >= 2 ? formatHoursWithDays(rolMatured) : '0.00000';

    const vacationAvailable = vacationDaysAnnual - vacationMatured;
    const permitsAvailable = permitsHoursAnnual - permitsMatured;
    const rolAvailable = seniorityYears >= 2 ? (rolHoursAnnual - rolMatured) : 0;

    // Disponibili Anno Corrente
    document.getElementById('vacation-available').textContent = vacationAvailable.toFixed(5);
    document.getElementById('permits-available').textContent = formatHoursWithDays(permitsAvailable);
    document.getElementById('rol-available').textContent = formatHoursWithDays(rolAvailable);

    const vacationRemaining = residualVacation + vacationMatured - vacationUsed;
    const permitsRemaining = residualPermits + permitsMatured - permitsUsed;
    const rolRemaining = residualRol + (seniorityYears >= 2 ? rolMatured : 0) - rolUsed;

    // Rimanenti Totali
    document.getElementById('vacation-remaining').textContent = vacationRemaining.toFixed(5);
    document.getElementById('permits-remaining').textContent = formatHoursWithDays(permitsRemaining);
    document.getElementById('rol-remaining').textContent = formatHoursWithDays(rolRemaining);

    // Aggiungi aggiornamento dei giorni per gli input usati
    updateUsedDaysDisplay();
}

// Salva dati su Supabase
document.getElementById('save-holidays-data').addEventListener('click', async () => {
    const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser();
    if (userError || !currentUser) {
        console.error('Errore durante il recupero dell\'utente:', userError);
        await showNotificationPopup('Errore: Utente non autenticato. Effettua il login.');
        return;
    }

    const hireDate = document.getElementById('hire-date').value;
    const residualVacation = parseFloat(document.getElementById('residual-vacation').value) || 0;
    const residualPermits = parseFloat(document.getElementById('residual-permits').value) || 0;
    const residualRol = parseFloat(document.getElementById('residual-rol').value) || 0;
    const vacationUsed = parseFloat(document.getElementById('vacation-used').value) || 0;
    const permitsUsed = parseFloat(document.getElementById('permits-used').value) || 0;
    const rolUsed = parseFloat(document.getElementById('rol-used').value) || 0;

    if (isNaN(residualVacation) || isNaN(residualPermits) || isNaN(residualRol) ||
        isNaN(vacationUsed) || isNaN(permitsUsed) || isNaN(rolUsed)) {
        console.error('Uno o più valori numerici non sono validi:', {
            residualVacation, residualPermits, residualRol, vacationUsed, permitsUsed, rolUsed
        });
        await showNotificationPopup('Errore: Inserisci valori numerici validi.');
        return;
    }

    const holidaysData = {
        user_id: currentUser.id,
        hire_date: hireDate ? new Date(hireDate).toISOString() : null,
        residual_vacation: residualVacation,
        residual_permits: residualPermits,
        residual_rol: residualRol,
        vacation_used: vacationUsed,
        permits_used: permitsUsed,
        rol_used: rolUsed
    };

    console.log('Dati da salvare:', holidaysData);

    try {
        const { error } = await supabase
            .from('holidays_data')
            .upsert(holidaysData, { onConflict: ['user_id'] });

        if (error) {
            console.error('Errore durante il salvataggio dei dati:', {
                message: error.message,
                code: error.code,
                details: error.details,
                hint: error.hint
            });
            await showNotificationPopup('Errore durante il salvataggio dei dati.');
            return;
        }

        await showNotificationPopup('Dati salvati con successo!');
        console.log('Tentativo di chiusura della modale');
        try {
            $('#holidaysManagerModal').modal('hide');
            console.log('Modale chiusa con successo');
        } catch (modalError) {
            console.error('Errore nella chiusura della modale:', modalError);
        }
    } catch (error) {
        console.error('Errore generale:', error);
        await showNotificationPopup('Errore durante il salvataggio.');
    }
});

// Aggiorna i calcoli quando cambiano gli input
['hire-date', 'residual-vacation', 'residual-permits', 'residual-rol', 'vacation-used', 'permits-used', 'rol-used'].forEach(id => {
    document.getElementById(id).addEventListener('change', () => {
        calculateHolidaysAndPermits();
        updateUsedDaysDisplay();
    });
});
async function saveMonthlyAccrued(vacationAccrued, permitsAccrued, rolAccrued, updateDate) {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user.id;

    const { error } = await supabase
        .from('holidays_data')
        .upsert({
            user_id: userId,
            monthly_vacation_accrued: vacationAccrued,
            monthly_permits_accrued: permitsAccrued,
            monthly_rol_accrued: rolAccrued,
            last_update_month: updateDate.toISOString().split('T')[0]
        }, { onConflict: 'user_id' });

    if (error) {
        console.error('Errore salvataggio maturati mensili:', error);
        await showNotificationPopup('Errore durante il salvataggio dei maturati mensili.');
    }
}


// Listener per il caricamento del PDF
document.getElementById('pdf-upload').addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Leggi il file come ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();

    try {
        // Carica il PDF con pdf.js
        const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
        let textContent = '';

        // Estrai il testo da tutte le pagine
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const text = await page.getTextContent();
            const pageText = text.items.map(item => item.str).join(' ') + '\n';
            console.log(`Testo estratto dalla pagina ${pageNum}:`, pageText); // Log del testo estratto
            textContent += pageText;
        }

        // Analizza il testo per estrarre i dati
        const data = parsePDFText(textContent);

        // Popola la tabella con i dati estratti
        populateTableFromPDF(data);

        // Ricalcola i valori della tabella (es. rimanenti totali)
        calculateHolidaysAndPermits(data);
    } catch (error) {
        console.error('Errore durante la lettura del PDF:', error);
        await showNotificationPopup('Errore durante la lettura del PDF.');
    }
});

// Funzione per analizzare il testo del PDF
function parsePDFText(text) {
    const data = {
        vacation: { residualAP: 0, accrued: 0, used: 0, remaining: 0 },
        permits: { residualAP: 0, accrued: 0, used: 0, remaining: 0 }, // Perm.Ex-Fs nel PDF
        rol: { residualAP: 0, accrued: 0, used: 0, remaining: 0 }      // Permessi nel PDF
    };

    // Converti il testo in righe e rimuovi spazi multipli
    const lines = text.split('\n').map(line => line.trim().replace(/\s+/g, ' ')).filter(line => line);

    console.log('Righe estratte dal PDF:', lines); // Log delle righe per debug

    // Cerca le righe rilevanti e estrai i valori
    for (const line of lines) {
        // Sostituisci le virgole con punti per gestire i numeri decimali (es. 43,73333 -> 43.73333)
        const cleanedLine = line.replace(/,/g, '.');

        if (cleanedLine.includes('Ferie')) {
            const values = cleanedLine.match(/[\d\.]+/g); // Trova tutti i numeri nella riga
            if (values && values.length >= 4) {
                data.vacation.residualAP = parseFloat(values[0]) || 0;
                data.vacation.accrued = parseFloat(values[1]) || 0;
                data.vacation.used = parseFloat(values[2]) || 0;
                data.vacation.remaining = parseFloat(values[3]) || 0;
            }
        } else if (cleanedLine.includes('Perm.Ex-Fs')) {
            const values = cleanedLine.match(/[\d\.]+/g);
            if (values && values.length >= 4) {
                data.permits.residualAP = parseFloat(values[0]) || 0; // Perm.Ex-Fs -> Permessi
                data.permits.accrued = parseFloat(values[1]) || 0;
                data.permits.used = parseFloat(values[2]) || 0;
                data.permits.remaining = parseFloat(values[3]) || 0;
            }
        } else if (cleanedLine.includes('Permessi')) {
            const values = cleanedLine.match(/[\d\.]+/g);
            if (values && values.length >= 4) {
                data.rol.residualAP = parseFloat(values[0]) || 0; // Permessi -> ROL
                data.rol.accrued = parseFloat(values[1]) || 0;
                data.rol.used = parseFloat(values[2]) || 0;
                data.rol.remaining = parseFloat(values[3]) || 0;
            }
        }
    }

    console.log('Dati estratti:', data); // Log dei dati estratti per debug
    return data;
}

// Funzione per popolare la tabella con i dati estratti dal PDF
function populateTableFromPDF(data) {
    // Residui anni precedenti (Residuo AP)
    document.getElementById('residual-vacation').value = data.vacation.residualAP.toFixed(5);
    document.getElementById('residual-permits').value = data.permits.residualAP.toFixed(5); // Perm.Ex-Fs
    document.getElementById('residual-rol').value = data.rol.residualAP.toFixed(5);        // Permessi

    // Maturati mese precedente (Accrued)
    document.getElementById('vacation-previous-month').textContent = data.vacation.accrued.toFixed(5);
    document.getElementById('permits-previous-month').textContent = data.permits.accrued.toFixed(5); // Perm.Ex-Fs
    document.getElementById('rol-previous-month').textContent = data.rol.accrued.toFixed(5);         // Permessi

    // Usati anno corrente (Goduto)
    document.getElementById('vacation-used').value = data.vacation.used.toFixed(5);
    document.getElementById('permits-used').value = data.permits.used.toFixed(5); // Perm.Ex-Fs
    document.getElementById('rol-used').value = data.rol.used.toFixed(5);        // Permessi

    // Rimanenti totali (Saldo) - Lasciamo che calculateHolidaysAndPermits() lo calcoli
    // document.getElementById('vacation-remaining').textContent = data.vacation.remaining.toFixed(6);
    // document.getElementById('permits-remaining').textContent = data.permits.remaining.toFixed(6);
    // document.getElementById('rol-remaining').textContent = data.rol.remaining.toFixed(6);
}

// Funzione per aggiornare lo stato dei campi in base alla data di assunzione e ai diritti ROL
function updateFieldsState(hireDate) {
    // Recupero degli elementi del DOM
    const residualVacationInput = document.getElementById('residual-vacation'); // Residui Ferie
    const residualPermitsInput = document.getElementById('residual-permits');  // Residui Perm.Ex. Fest.
    const residualRolInput = document.getElementById('residual-rol');          // Residui ROL
    const vacationUsedInput = document.getElementById('vacation-used');       // Usati Ferie
    const permitsUsedInput = document.getElementById('permits-used');         // Usati Perm.Ex. Fest.
    const rolUsedInput = document.getElementById('rol-used');                 // Usati ROL

    // Controllo se la data di assunzione è valida
    const isHireDateValid = hireDate && !isNaN(hireDate.getTime());

    // Campi da disabilitare/abilitare per Ferie e Permessi (Residui e Usati)
    const fieldsToManage = [
        residualVacationInput,  // Residui Ferie
        residualPermitsInput,   // Residui Perm.Ex. Fest.
        vacationUsedInput,      // Usati Ferie
        permitsUsedInput        // Usati Perm.Ex. Fest.
    ];

    // Abilita o disabilita i campi Ferie e Permessi in base alla data di assunzione
    fieldsToManage.forEach(field => {
        field.disabled = !isHireDateValid;
    });

    // Logica specifica per i ROL (dipende anche dall'anzianità)
    if (isHireDateValid) {
        const today = new Date();
        const seniorityYears = (today - hireDate) / (1000 * 60 * 60 * 24 * 365.25);
        const hasRolRights = seniorityYears >= 2;

        // Gestione ROL: abilitati solo se anzianità >= 2 anni
        residualRolInput.disabled = !hasRolRights;
        rolUsedInput.disabled = !hasRolRights;

        // Se non si ha diritto ai ROL, imposta i valori a 0
        if (!hasRolRights) {
            residualRolInput.value = 0;
            rolUsedInput.value = 0;
        }
    } else {
        // Se la data non è valida, disabilita i campi ROL e imposta a 0
        residualRolInput.disabled = true;
        rolUsedInput.disabled = true;
        residualRolInput.value = 0;
        rolUsedInput.value = 0;
    }
}

// Funzione per convertire ore in giorni e formattare il risultato
function formatHoursWithDays(hours) {
    const days = Math.floor(hours / 8);
    const remainingHours = hours % 8;
    return `${hours.toFixed(2)} ORE${days > 0 ? ` (${days} GG${remainingHours > 0 ? ` + ${remainingHours.toFixed(2)} ORE` : ''})` : ''}`;
}

// Funzione per aggiornare la visualizzazione dei giorni per gli input usati
function updateUsedDaysDisplay() {
    const permitsUsed = parseFloat(document.getElementById('permits-used').value) || 0;
    const rolUsed = parseFloat(document.getElementById('rol-used').value) || 0;

    const permitsDays = (permitsUsed / 8).toFixed(2);
    const rolDays = (rolUsed / 8).toFixed(2);

    document.getElementById('permits-used-days').textContent = `(${permitsDays} giorni)`;
    document.getElementById('rol-used-days').textContent = `(${rolDays} giorni)`;
}