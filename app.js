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
        div.innerHTML = `
            <button class="note-close" onclick="deleteNote(${note.id})">&times;</button>
            <p>${note.text}</p>
        `;
        notesGrid.appendChild(div);
    });
}

document.getElementById('add-note-btn').addEventListener('click', () => {
    const text = prompt("Enter your note:");
    if (text) {
        notes.push({ id: Date.now(), text: text });
        saveNotes();
        renderNotes();
    }
});

window.deleteNote = function(id) {
    notes = notes.filter(n => n.id !== id);
    saveNotes();
    renderNotes();
}

function saveNotes() {
    localStorage.setItem('familyNotes', JSON.stringify(notes));
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
});
