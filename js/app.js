// SmartNiwas Portal Main Entrypoint
import { state } from './modules/state.js';
import { initSecurity } from './modules/security.js';
import { initAuth } from './modules/auth.js';
import { initSettings } from './modules/settings.js';
import { initCashflow } from './modules/cashflow.js';
import { initMQTT } from './modules/mqtt.js';
import { initCCTV } from './modules/cctv.js';
import { initNotes } from './modules/notes.js';

// Hardened Directory Data
const members = [
    { name: "Kartikay", email: "kartikay@smartniwas.com", desc: "System Administrator" }
];

function renderDirectory() {
    const grid = document.getElementById('member-grid');
    if (!grid) return;
    grid.innerHTML = '';
    
    members.forEach((m) => {
        const card = document.createElement('div');
        card.className = 'member-card';
        card.innerHTML = `
            <div class="member-info">
                <h3>${escapeHTML(m.name)}</h3>
                <p>${escapeHTML(m.desc)}</p>
                <a href="mailto:${encodeURIComponent(m.email)}" class="email-btn">
                    <i class="fa-regular fa-envelope"></i> ${escapeHTML(m.email)}
                </a>
            </div>
            <div class="member-status">
                <span class="status-badge status-online">MEMBER</span>
            </div>
        `;
        grid.appendChild(card);
    });
}

function updateClock() {
    const clockElem = document.getElementById('live-clock');
    if (clockElem) {
        const now = new Date();
        clockElem.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
}

function escapeHTML(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

document.addEventListener('DOMContentLoaded', () => {
    renderDirectory();
    updateClock();
    setInterval(updateClock, 1000);

    // Initialize modules
    const security = initSecurity();
    const mqtt = initMQTT();
    const cctv = initCCTV();
    const settingsUI = initSettings(security, mqtt, cctv);
    const cashflow = initCashflow();
    const notes = initNotes();
    const auth = initAuth(security, mqtt, cctv);
});
