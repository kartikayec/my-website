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

// Device Inventory Defaults
const defaultDevices = {
    switches: [
        { id: "living-light", name: "Living Room Light", topic: "smartniwas/switch/livingroom_light", state: "OFF" },
        { id: "gate-lock", name: "Main Gate Lock", topic: "smartniwas/switch/gate_lock", state: "OFF" }
    ],
    sensors: [
        { id: "home-temp", name: "Temperature", topic: "smartniwas/sensor/temperature", value: "--", unit: "°C", icon: "fa-thermometer-half" },
        { id: "home-hum", name: "Humidity", topic: "smartniwas/sensor/humidity", value: "--", unit: "%", icon: "fa-droplet" }
    ]
};

let iotDevices = JSON.parse(localStorage.getItem('smartniwasDevices')) || defaultDevices;

// Topic discovery state
let discoveryActive = false;
let discoveredTopics = [];

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

function saveDevices() {
    localStorage.setItem('smartniwasDevices', JSON.stringify(iotDevices));
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

            // If discovery is active, subscribe to discovery wildcard
            if (discoveryActive) {
                const wildcard = document.getElementById('discovery-wildcard').value.trim() || '#';
                mqttClient.subscribe(wildcard);
                updateDiscoveryBanner("Scanning...", "status-scanning");
            }
        });

        mqttClient.on('message', (topic, message) => {
            const payload = message.toString();

            // 1. Discovery Mode handler
            if (discoveryActive) {
                const isConfigured = iotDevices.switches.some(s => s.topic === topic) || 
                                     iotDevices.sensors.some(s => s.topic === topic);
                if (!isConfigured && !discoveredTopics.includes(topic)) {
                    discoveredTopics.push(topic);
                    renderDiscoveryResults();
                }
            }

            // 2. Device Update Handlers
            const sw = iotDevices.switches.find(s => s.topic === topic);
            if (sw) {
                sw.state = payload;
                const toggleInput = document.getElementById(`toggle-${sw.id}`);
                const statusLabel = document.getElementById(`status-label-${sw.id}`);
                if (toggleInput) toggleInput.checked = (payload === 'ON');
                if (statusLabel) statusLabel.innerText = payload;
            }

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

    if (iotDevices.sensors.length === 0 && iotDevices.switches.length === 0) {
        grid.innerHTML = '<div style="font-size: 0.9rem; color: var(--text-secondary); text-align: center; width: 100%; padding: 2rem;">No devices configured. Click the gear icon in the header to add devices.</div>';
        return;
    }

    // Render Sensors
    iotDevices.sensors.forEach(sen => {
        const card = document.createElement('div');
        card.className = 'sensor-card';
        card.innerHTML = `
            <div class="sensor-icon"><i class="fa-solid ${sen.icon || 'fa-microchip'}"></i></div>
            <div class="sensor-details">
                <div class="sensor-value" id="val-${sen.id}">${sen.value}${sen.unit || ''}</div>
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
        
        img.onload = () => {
            if (placeholder) placeholder.classList.add('hidden');
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

// 5. Device Manager Inventory CRUD
function renderDeviceList() {
    const list = document.getElementById('device-list');
    list.innerHTML = '';

    if (iotDevices.switches.length === 0 && iotDevices.sensors.length === 0) {
        list.innerHTML = '<div class="discovery-empty-state" style="padding: 1rem;">No custom devices configured yet. Use the form below or the Discovery tool to add devices.</div>';
        return;
    }

    iotDevices.sensors.forEach(sen => {
        const item = document.createElement('div');
        item.className = 'device-item';
        item.innerHTML = `
            <div class="device-item-info">
                <span class="device-item-name">${sen.name} <span style="font-size:0.75rem; font-weight:normal; opacity:0.75;">(Sensor)</span></span>
                <div class="device-item-meta">Topic: ${sen.topic}</div>
            </div>
            <button type="button" class="device-delete-btn" onclick="deleteDevice('sensor', '${sen.id}')" aria-label="Delete sensor">
                <i class="fa-solid fa-trash-can"></i>
            </button>
        `;
        list.appendChild(item);
    });

    iotDevices.switches.forEach(sw => {
        const item = document.createElement('div');
        item.className = 'device-item';
        item.innerHTML = `
            <div class="device-item-info">
                <span class="device-item-name">${sw.name} <span style="font-size:0.75rem; font-weight:normal; opacity:0.75;">(Switch)</span></span>
                <div class="device-item-meta">Topic: ${sw.topic}</div>
            </div>
            <button type="button" class="device-delete-btn" onclick="deleteDevice('switch', '${sw.id}')" aria-label="Delete switch">
                <i class="fa-solid fa-trash-can"></i>
            </button>
        `;
        list.appendChild(item);
    });
}

window.deleteDevice = function(type, id) {
    if (type === 'switch') {
        iotDevices.switches = iotDevices.switches.filter(d => d.id !== id);
    } else {
        iotDevices.sensors = iotDevices.sensors.filter(d => d.id !== id);
    }
    saveDevices();
    renderDeviceList();
    initializeModules();
}

// 6. Topic Discovery Renderer
function updateDiscoveryBanner(text, className) {
    const banner = document.getElementById('discovery-status-banner');
    if (banner) {
        banner.innerText = text;
        banner.className = `discovery-banner ${className}`;
    }
}

function renderDiscoveryResults() {
    const results = document.getElementById('discovery-results');
    results.innerHTML = '';

    if (discoveredTopics.length === 0) {
        results.innerHTML = '<div class="discovery-empty-state">No paths scanned yet. Start scanning to capture traffic.</div>';
        return;
    }

    discoveredTopics.forEach(topic => {
        const item = document.createElement('div');
        item.className = 'discovery-item';
        item.innerHTML = `
            <div class="discovery-item-path">${topic}</div>
            <div class="discovery-item-actions">
                <button type="button" class="btn btn-primary btn-xs" onclick="quickAddDevice('switch', '${topic}')">
                    + Switch
                </button>
                <button type="button" class="btn btn-primary btn-xs" onclick="quickAddDevice('sensor', '${topic}')">
                    + Sensor
                </button>
            </div>
        `;
        results.appendChild(item);
    });
}

window.quickAddDevice = function(type, topic) {
    document.getElementById('new-dev-name').value = topic.split('/').pop().replace(/_/g, ' ');
    document.getElementById('new-dev-type').value = type;
    document.getElementById('new-dev-topic').value = topic;
    
    const sensorFieldsPanel = document.getElementById('sensor-fields');
    if (type === 'sensor') {
        sensorFieldsPanel.classList.remove('hidden');
        document.getElementById('new-dev-unit').value = '';
        document.getElementById('new-dev-icon').value = 'fa-microchip';
    } else {
        sensorFieldsPanel.classList.add('hidden');
    }

    document.querySelector('.settings-tab-btn[data-tab="devices"]').click();
    document.getElementById('new-dev-name').focus();
}

// 7. Time Clock
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

    initializeModules();

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

        // Reset to first tab "Connection"
        document.querySelector('.settings-tab-btn[data-tab="connection"]').click();

        settingsModal.classList.add('active');
        settingsModal.setAttribute('aria-hidden', 'false');
    };

    const hideSettings = () => {
        settingsModal.classList.remove('active');
        settingsModal.setAttribute('aria-hidden', 'true');
        if (discoveryActive) {
            stopDiscovery();
        }
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

    // Auto-prompt settings if MQTT is not configured
    if (!settings.mqttHost) {
        setTimeout(showSettings, 600);
    }

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

    // Settings Tab Switchers
    const tabButtons = document.querySelectorAll('.settings-tab-btn');
    const tabPanels = document.querySelectorAll('.tab-panel');
    const footerActions = document.getElementById('settings-form-actions');

    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-tab');

            tabButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            tabPanels.forEach(p => p.classList.add('hidden'));
            document.getElementById(`tab-${targetTab}`).classList.remove('hidden');

            if (targetTab === 'connection') {
                footerActions.classList.remove('hidden');
            } else {
                footerActions.classList.add('hidden');
            }

            if (targetTab === 'devices') {
                renderDeviceList();
            }
        });
    });

    // Add Device select dropdown type trigger
    const newDevTypeSelect = document.getElementById('new-dev-type');
    const sensorFieldsPanel = document.getElementById('sensor-fields');
    newDevTypeSelect.addEventListener('change', () => {
        if (newDevTypeSelect.value === 'sensor') {
            sensorFieldsPanel.classList.remove('hidden');
        } else {
            sensorFieldsPanel.classList.add('hidden');
        }
    });

    // Add Device Action
    const addDeviceBtnAction = document.getElementById('add-device-btn-action');
    addDeviceBtnAction.addEventListener('click', () => {
        const name = document.getElementById('new-dev-name').value.trim();
        const type = newDevTypeSelect.value;
        const topic = document.getElementById('new-dev-topic').value.trim();

        if (!name || !topic) {
            alert('Please enter a display name and MQTT topic.');
            return;
        }

        const id = 'dev-' + Date.now();

        if (type === 'switch') {
            iotDevices.switches.push({ id, name, topic, state: 'OFF' });
        } else {
            const unit = document.getElementById('new-dev-unit').value.trim();
            const icon = document.getElementById('new-dev-icon').value.trim() || 'fa-microchip';
            iotDevices.sensors.push({ id, name, topic, value: '--', unit, icon });
        }

        saveDevices();
        renderDeviceList();
        initializeModules();

        // Reset Add Device form
        document.getElementById('new-dev-name').value = '';
        document.getElementById('new-dev-topic').value = '';
        document.getElementById('new-dev-unit').value = '';
        document.getElementById('new-dev-icon').value = '';
    });

    // Discovery Controls Setup
    const discoveryToggleBtn = document.getElementById('discovery-toggle-btn');
    
    function startDiscovery() {
        if (!mqttClient || !mqttClient.connected) {
            alert("No active broker connection. Please save a valid Broker URL first and verify connection.");
            return;
        }
        discoveryActive = true;
        discoveredTopics = [];
        renderDiscoveryResults();
        
        const wildcard = document.getElementById('discovery-wildcard').value.trim() || '#';
        console.log("Discovery scanner started on wildcard:", wildcard);
        mqttClient.subscribe(wildcard);

        discoveryToggleBtn.innerHTML = '<i class="fa-solid fa-square"></i> Stop Scanning';
        discoveryToggleBtn.style.background = '#ef4444';
        updateDiscoveryBanner(`SCANNING... Listening to topic wildcard: "${wildcard}"`, "status-scanning");
    }

    function stopDiscovery() {
        discoveryActive = false;
        
        if (mqttClient && mqttClient.connected) {
            const wildcard = document.getElementById('discovery-wildcard').value.trim() || '#';
            mqttClient.unsubscribe(wildcard);
        }

        console.log("Discovery scanner stopped.");
        discoveryToggleBtn.innerHTML = '<i class="fa-solid fa-satellite-dish"></i> Start Scanning';
        discoveryToggleBtn.style.background = '';
        updateDiscoveryBanner("Scanner is currently IDLE.", "status-idle");
    }

    discoveryToggleBtn.addEventListener('click', () => {
        if (!discoveryActive) {
            startDiscovery();
        } else {
            stopDiscovery();
        }
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