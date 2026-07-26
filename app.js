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


// 3. Settings & Modules State
let settings = JSON.parse(localStorage.getItem('smartniwasSettings')) || {
    mqttHost: "",
    mqttUser: "",
    mqttPass: "",
    cctvEnabled: false,
    nvrHost: "",
    nvrUser: "",
    nvrPass: "",
    nvrChannels: "101,201"
};

let mqttClient = null;
let cctvIntervals = [];

// MQTT UI State definition (Default configuration for topics)
const iotDevices = {
    switches: [
        { id: "living-light", name: "Living Room Light", topic: "smartniwas/switch/livingroom_light", state: "OFF" },
        { id: "gate-lock", name: "Main Gate Lock", topic: "smartniwas/switch/gate_lock", state: "ON" }
    ],
    sensors: [
        { id: "home-temp", name: "Temperature", topic: "smartniwas/sensor/temperature", value: "--", unit: "°C", icon: "fa-thermometer-half" },
        { id: "home-hum", name: "Humidity", topic: "smartniwas/sensor/humidity", value: "--", unit: "%", icon: "fa-droplet" }
    ]
};

// Render Notice Board Notes
function saveNotes() {
    localStorage.setItem('familyNotes', JSON.stringify(notes));
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

// Attach toggleStatus to window explicitly for clarity
window.toggleStatus = function(index) {
    const statuses = ['online', 'away', 'busy'];
    const current = statuses.indexOf(members[index].status);
    members[index].status = statuses[(current + 1) % statuses.length];
    renderDirectory();
}

// 4. Modules Setup and Connection Logic
function initializeModules() {
    // 1. MQTT Section Setup
    const iotSection = document.getElementById('iot-section');
    if (settings.mqttHost) {
        iotSection.classList.remove('hidden');
        setupMQTT();
    } else {
        iotSection.classList.add('hidden');
        if (mqttClient) {
            mqttClient.end();
            mqttClient = null;
        }
    }

    // 2. CCTV Section Setup
    const cctvSection = document.getElementById('cctv-section');
    if (settings.cctvEnabled && settings.nvrHost) {
        cctvSection.classList.remove('hidden');
        setupCCTV();
    } else {
        cctvSection.classList.add('hidden');
        cctvIntervals.forEach(clearInterval);
        cctvIntervals = [];
        document.getElementById('cctv-grid').innerHTML = '';
    }
}

function setupMQTT() {
    if (mqttClient) {
        mqttClient.end();
    }

    renderIoTGrid();

    console.log("Connecting to MQTT Broker:", settings.mqttHost);
    const options = {
        reconnectPeriod: 5000,
        connectTimeout: 30 * 1000
    };
    if (settings.mqttUser) options.username = settings.mqttUser;
    if (settings.mqttPass) options.password = settings.mqttPass;

    try {
        mqttClient = mqtt.connect(settings.mqttHost, options);

        mqttClient.on('connect', () => {
            console.log("Connected to MQTT Broker successfully!");
            // Subscribe to all switch state and sensor topics
            iotDevices.switches.forEach(sw => {
                mqttClient.subscribe(sw.topic);
            });
            iotDevices.sensors.forEach(sen => {
                mqttClient.subscribe(sen.topic);
            });
        });

        mqttClient.on('message', (topic, message) => {
            const payload = message.toString();
            console.log(`MQTT [${topic}] -> ${payload}`);

            // Handle Switch updates
            const sw = iotDevices.switches.find(s => s.topic === topic);
            if (sw) {
                sw.state = payload;
                const toggleInput = document.getElementById(`toggle-${sw.id}`);
                const statusLabel = document.getElementById(`status-label-${sw.id}`);
                if (toggleInput) toggleInput.checked = (payload === 'ON');
                if (statusLabel) statusLabel.innerText = payload;
            }

            // Handle Sensor updates
            const sen = iotDevices.sensors.find(s => s.topic === topic);
            if (sen) {
                sen.value = payload;
                const valElem = document.getElementById(`val-${sen.id}`);
                if (valElem) valElem.innerText = `${payload}${sen.unit}`;
            }
        });

        mqttClient.on('error', (err) => {
            console.error("MQTT Error:", err);
        });

    } catch (e) {
        console.error("Failed to initialize MQTT connection client:", e);
    }
}

function renderIoTGrid() {
    const grid = document.getElementById('iot-grid');
    grid.innerHTML = '';

    // Render Sensors
    iotDevices.sensors.forEach(sen => {
        const card = document.createElement('div');
        card.className = 'sensor-card';
        card.innerHTML = `
            <div class="sensor-icon"><i class="fa-solid ${sen.icon}"></i></div>
            <div class="sensor-details">
                <div class="sensor-value" id="val-${sen.id}">${sen.value}${sen.unit}</div>
                <div class="sensor-label">${sen.name}</div>
            </div>
        `;
        grid.appendChild(card);
    });

    // Render Switches
    iotDevices.switches.forEach(sw => {
        const card = document.createElement('div');
        card.className = 'switch-card';
        card.innerHTML = `
            <div class="switch-info">
                <h4>${sw.name}</h4>
                <p class="switch-status-label" id="status-label-${sw.id}">${sw.state}</p>
            </div>
            <label class="switch-toggle">
                <input type="checkbox" id="toggle-${sw.id}" ${sw.state === 'ON' ? 'checked' : ''} onchange="toggleSwitch('${sw.id}')">
                <span class="slider"></span>
            </label>
        `;
        grid.appendChild(card);
    });
}

window.toggleSwitch = function(id) {
    const sw = iotDevices.switches.find(s => s.id === id);
    if (sw && mqttClient && mqttClient.connected) {
        const toggleInput = document.getElementById(`toggle-${id}`);
        const newState = toggleInput.checked ? 'ON' : 'OFF';
        
        console.log(`Publishing command: [${sw.topic}] -> ${newState}`);
        mqttClient.publish(sw.topic, newState, { retain: true });
        
        document.getElementById(`status-label-${id}`).innerText = newState;
    }
}

function setupCCTV() {
    cctvIntervals.forEach(clearInterval);
    cctvIntervals = [];

    const grid = document.getElementById('cctv-grid');
    grid.innerHTML = '';

    const channels = settings.nvrChannels.split(',').map(c => c.trim()).filter(c => c.length > 0);

    channels.forEach(channel => {
        const card = document.createElement('div');
        card.className = 'cctv-card';
        
        // Clean URL structures
        let urlBase = settings.nvrHost.replace('https://', '').replace('http://', '');
        let credentials = '';
        if (settings.nvrUser && settings.nvrPass) {
            credentials = `${encodeURIComponent(settings.nvrUser)}:${encodeURIComponent(settings.nvrPass)}@`;
        }
        let protocol = settings.nvrHost.startsWith('https') ? 'https://' : 'http://';
        let imageUrl = `${protocol}${credentials}${urlBase}/ISAPI/Streaming/channels/${channel}/picture`;

        card.innerHTML = `
            <div class="cctv-feed-container">
                <img class="cctv-feed-img" id="cam-${channel}" src="" alt="Camera ${channel}" onerror="handleCamError('${channel}')">
                <div class="cctv-feed-placeholder" id="cam-place-${channel}">
                    <i class="fa-solid fa-circle-notch"></i>
                    <span>Loading Camera Feed...</span>
                </div>
                <div class="cctv-feed-overlay">
                    <span class="cctv-status-dot"></span>
                    <span>CAM ${channel}</span>
                </div>
            </div>
            <div class="cctv-meta">
                <span class="cctv-name">Channel ${channel}</span>
                <button class="cctv-refresh-btn" onclick="refreshCamera('${channel}')" aria-label="Refresh Camera">
                    <i class="fa-solid fa-arrows-rotate"></i>
                </button>
            </div>
        `;
        grid.appendChild(card);

        const img = card.querySelector(`#cam-${channel}`);
        const placeholder = card.querySelector(`#cam-place-${channel}`);
        
        // Handle image loaded event to hide loader spinner
        img.onload = () => {
            placeholder.classList.add('hidden');
        };

        const updateImage = () => {
            if (settings.cctvEnabled) {
                img.src = `${imageUrl}?t=${Date.now()}`;
            }
        };

        updateImage();
        const interval = setInterval(updateImage, 1500);
        cctvIntervals.push(interval);
    });
}

window.handleCamError = function(channel) {
    const placeholder = document.getElementById(`cam-place-${channel}`);
    if (placeholder) {
        placeholder.classList.remove('hidden');
        placeholder.innerHTML = `
            <i class="fa-solid fa-triangle-exclamation" style="color: #f87171;"></i>
            <span style="color: #f87171;">Feed Offline</span>
        `;
    }
}

window.refreshCamera = function(channel) {
    const img = document.getElementById(`cam-${channel}`);
    const placeholder = document.getElementById(`cam-place-${channel}`);
    if (img) {
        if (placeholder) placeholder.classList.remove('hidden');
        let urlBase = settings.nvrHost.replace('https://', '').replace('http://', '');
        let credentials = '';
        if (settings.nvrUser && settings.nvrPass) {
            credentials = `${encodeURIComponent(settings.nvrUser)}:${encodeURIComponent(settings.nvrPass)}@`;
        }
        let protocol = settings.nvrHost.startsWith('https') ? 'https://' : 'http://';
        let imageUrl = `${protocol}${credentials}${urlBase}/ISAPI/Streaming/channels/${channel}/picture`;
        img.src = `${imageUrl}?t=${Date.now()}`;
    }
}

// 5. Time Clock
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

    // Initial Modules Load
    initializeModules();

    // Auto-prompt settings if MQTT is not configured
    if (!settings.mqttHost) {
        setTimeout(showSettings, 600);
    }

    // Modal declarations
    const noteModal = document.getElementById('note-modal');
    const noteForm = document.getElementById('note-form');
    const noteText = document.getElementById('note-text');
    const addNoteBtn = document.getElementById('add-note-btn');
    const closeNoteBtn = document.getElementById('close-modal-btn');
    const cancelNoteBtn = document.getElementById('cancel-note-btn');

    const settingsModal = document.getElementById('settings-modal');
    const settingsForm = document.getElementById('settings-form');
    const openSettingsBtn = document.getElementById('open-settings-btn');
    const closeSettingsBtn = document.getElementById('close-settings-btn');
    const cancelSettingsBtn = document.getElementById('cancel-settings-btn');

    const cctvEnabledCheckbox = document.getElementById('cctv-enabled');
    const cctvSettingsFields = document.getElementById('cctv-settings-fields');

    // Toggle CCTV settings input panel
    cctvEnabledCheckbox.addEventListener('change', () => {
        if (cctvEnabledCheckbox.checked) {
            cctvSettingsFields.classList.remove('hidden');
        } else {
            cctvSettingsFields.classList.add('hidden');
        }
    });

    const showSettings = () => {
        document.getElementById('mqtt-host').value = settings.mqttHost;
        document.getElementById('mqtt-user').value = settings.mqttUser;
        document.getElementById('mqtt-pass').value = settings.mqttPass;
        
        cctvEnabledCheckbox.checked = settings.cctvEnabled;
        if (settings.cctvEnabled) {
            cctvSettingsFields.classList.remove('hidden');
        } else {
            cctvSettingsFields.classList.add('hidden');
        }
        
        document.getElementById('nvr-host').value = settings.nvrHost;
        document.getElementById('nvr-user').value = settings.nvrUser;
        document.getElementById('nvr-pass').value = settings.nvrPass;
        document.getElementById('nvr-channels').value = settings.nvrChannels;

        settingsModal.classList.add('active');
        settingsModal.setAttribute('aria-hidden', 'false');
    };

    const hideSettings = () => {
        settingsModal.classList.remove('active');
        settingsModal.setAttribute('aria-hidden', 'true');
    };

    const showNoteModal = () => {
        noteModal.classList.add('active');
        noteModal.setAttribute('aria-hidden', 'false');
        noteText.focus();
    };

    const hideNoteModal = () => {
        noteModal.classList.remove('active');
        noteModal.setAttribute('aria-hidden', 'true');
        noteForm.reset();
    };

    // Bind Notice Board Events
    addNoteBtn.addEventListener('click', showNoteModal);
    cancelNoteBtn.addEventListener('click', hideNoteModal);
    closeNoteBtn.addEventListener('click', hideNoteModal);
    
    noteForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = noteText.value.trim();
        if (text) {
            const newId = Date.now();
            notes.push({ id: newId, text: text });
            saveNotes();
            renderNotes();
            
            const element = document.querySelector(`[data-id="${newId}"]`);
            if (element) {
                element.classList.add('note-added');
            }
            hideNoteModal();
        }
    });

    // Bind Settings Events
    openSettingsBtn.addEventListener('click', showSettings);
    closeSettingsBtn.addEventListener('click', hideSettings);
    cancelSettingsBtn.addEventListener('click', hideSettings);

    settingsForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        settings.mqttHost = document.getElementById('mqtt-host').value.trim();
        settings.mqttUser = document.getElementById('mqtt-user').value.trim();
        settings.mqttPass = document.getElementById('mqtt-pass').value.trim();
        
        settings.cctvEnabled = cctvEnabledCheckbox.checked;
        settings.nvrHost = document.getElementById('nvr-host').value.trim();
        settings.nvrUser = document.getElementById('nvr-user').value.trim();
        settings.nvrPass = document.getElementById('nvr-pass').value.trim();
        settings.nvrChannels = document.getElementById('nvr-channels').value.trim();
        
        localStorage.setItem('smartniwasSettings', JSON.stringify(settings));
        
        initializeModules();
        hideSettings();
    });

    // Close on overlay clicks
    window.addEventListener('click', (e) => {
        if (e.target === noteModal) hideNoteModal();
        if (e.target === settingsModal) hideSettings();
    });

    // Close on Escape Key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (noteModal.classList.contains('active')) hideNoteModal();
            if (settingsModal.classList.contains('active')) hideSettings();
        }
    });
});