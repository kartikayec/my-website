// 1. Initial Member Data
const members = [
    { name: "Kartikay", email: "kartikay@smartniwas.com", status: "online", desc: "SysAdmin" },
    { name: "Aditi", email: "aditi@smartniwas.com", status: "busy", desc: "UX Design" },
    { name: "Rahul", email: "rahul@smartniwas.com", status: "away", desc: "Software Dev" },
    { name: "Priya", email: "priya@smartniwas.com", status: "online", desc: "Operations" },
];

// Render Directory
function renderDirectory() {
    const grid = document.getElementById('member-grid');
    grid.innerHTML = '';
    
    members.forEach((m, index) => {
        const card = document.createElement('div');
        card.className = 'member-card';
        card.innerHTML = `
            <div class="member-info">
                <h3>${m.name}</h3>
                <p>${m.desc}</p>
                <a href="mailto:${m.email}" class="email-btn"><i class="fa-regular fa-envelope"></i> ${m.email}</a>
            </div>
            <div class="member-status">
                <span class="status-badge status-${m.status}" onclick="toggleStatus(${index})">
                    ${m.status.toUpperCase()}
                </span>
            </div>
        `;
        grid.appendChild(card);
    });
}

// Toggle Status (Interactive demonstration)
function toggleStatus(index) {
    const statuses = ['online', 'away', 'busy'];
    const current = statuses.indexOf(members[index].status);
    members[index].status = statuses[(current + 1) % statuses.length];
    renderDirectory();
}

// 2. Local Storage Notice Board
let notes = JSON.parse(localStorage.getItem('familyNotes')) || [
    { id: 1, text: "Welcome to the new SmartNiwas portal! Feel free to leave a note." }
];

function renderNotes() {
    const notesGrid = document.getElementById('notes-grid');
    notesGrid.innerHTML = '';
    
    notes.forEach(note => {
        const div = document.createElement('div');
        div.className = 'note';
        div.setAttribute('data-id', note.id);
        div.innerHTML = `
            <button class="note-close" onclick="deleteNote(${note.id})" aria-label="Delete note">&times;</button>
            <p>${note.text}</p>
        `;
        notesGrid.appendChild(div);
    });
}

// Modal Elements
const modal = document.getElementById('note-modal');
const noteForm = document.getElementById('note-form');
const noteText = document.getElementById('note-text');
const cancelBtn = document.getElementById('cancel-note-btn');
const closeBtn = document.getElementById('close-modal-btn');
const addBtn = document.getElementById('add-note-btn');

function showModal() {
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    noteText.focus();
}

function hideModal() {
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
    noteForm.reset();
}

window.deleteNote = function(id) {
    const element = document.querySelector(`[data-id="${id}"]`);
    if (element) {
        element.classList.remove('note-added');
        element.classList.add('note-removing');
        element.addEventListener('animationend', () => {
            notes = notes.filter(n => n.id !== id);
            saveNotes();
            renderNotes();
        });
    } else {
        notes = notes.filter(n => n.id !== id);
        saveNotes();
        renderNotes();
    }
}

function saveNotes() {
    localStorage.setItem('familyNotes', JSON.stringify(notes));
}

// Attach toggleStatus to window explicitly for clarity
window.toggleStatus = function(index) {
    const statuses = ['online', 'away', 'busy'];
    const current = statuses.indexOf(members[index].status);
    members[index].status = statuses[(current + 1) % statuses.length];
    renderDirectory();
}

// 3. Time Clock
function updateClock() {
    const now = new Date();
    document.getElementById('live-clock').innerText = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// Initialize Everything
document.addEventListener('DOMContentLoaded', () => {
    renderDirectory();
    renderNotes();
    updateClock();
    setInterval(updateClock, 1000);

    // Modal Event Listeners
    addBtn.addEventListener('click', showModal);
    cancelBtn.addEventListener('click', hideModal);
    closeBtn.addEventListener('click', hideModal);
    
    // Close modal on background click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            hideModal();
        }
    });

    // Close modal on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('active')) {
            hideModal();
        }
    });

    // Handle Note Form Submit
    noteForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = noteText.value.trim();
        if (text) {
            const newId = Date.now();
            notes.push({ id: newId, text: text });
            saveNotes();
            renderNotes();
            
            // Add entry animation to the new note card
            const element = document.querySelector(`[data-id="${newId}"]`);
            if (element) {
                element.classList.add('note-added');
            }
            hideModal();
        }
    });
});