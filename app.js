// 1. Initial Member Data (Hardened Production Directory)
const members = [
    { name: "Kartikay", email: "kartikay@smartniwas.com", desc: "System Administrator" }
];

// Helper: HTML Escaper for XSS Prevention
function escapeHTML(str) {
    if (typeof str !== 'string') return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Render Member Directory Safely
function renderDirectory() {
    const grid = document.getElementById('member-grid');
    if (!grid) return;
    grid.innerHTML = '';
    
    members.forEach((m) => {
        const card = document.createElement('div');
        card.className = 'member-card';
        
        const info = document.createElement('div');
        info.className = 'member-info';
        
        const h3 = document.createElement('h3');
        h3.textContent = m.name;
        
        const p = document.createElement('p');
        p.textContent = m.desc;
        
        const a = document.createElement('a');
        a.href = `mailto:${encodeURIComponent(m.email)}`;
        a.className = 'email-btn';
        a.innerHTML = `<i class="fa-regular fa-envelope"></i> ${escapeHTML(m.email)}`;
        
        info.appendChild(h3);
        info.appendChild(p);
        info.appendChild(a);
        
        const statusDiv = document.createElement('div');
        statusDiv.className = 'member-status';
        statusDiv.innerHTML = `<span class="status-badge status-online">MEMBER</span>`;
        
        card.appendChild(info);
        card.appendChild(statusDiv);
        grid.appendChild(card);
    });
}

// 2. Shared Notice Board (LocalStorage with XSS Prevention)
let notes = JSON.parse(localStorage.getItem('familyNotes')) || [];

function saveNotes() {
    localStorage.setItem('familyNotes', JSON.stringify(notes));
}

function renderNotes() {
    const notesGrid = document.getElementById('notes-grid');
    if (!notesGrid) return;
    notesGrid.innerHTML = '';
    
    if (notes.length === 0) {
        notesGrid.innerHTML = '<div style="font-size: 0.85rem; color: var(--text-secondary); text-align: center; padding: 1.5rem; width: 100%;">No active notices. Click "+ Add Note" to post on the board.</div>';
        return;
    }

    notes.forEach(note => {
        const div = document.createElement('div');
        div.className = 'note';
        div.setAttribute('data-id', note.id);
        
        const btn = document.createElement('button');
        btn.className = 'note-close';
        btn.setAttribute('aria-label', 'Delete note');
        btn.innerHTML = '&times;';
        btn.onclick = () => deleteNote(note.id);
        
        const p = document.createElement('p');
        p.textContent = note.text;
        
        div.appendChild(btn);
        div.appendChild(p);
        notesGrid.appendChild(div);
    });
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
};

// 3. Settings & Storage State
let settings = JSON.parse(localStorage.getItem('smartniwasSettings')) || {
    portalPasscode: "1234",
    mqttHost: "",
    mqttUser: "",
    mqttPass: "",
    cctvEnabled: false,
    nvrHost: "",
    nvrUser: "",
    nvrPass: "",
    nvrChannels: "101,201"
};

// Ensure fallback passcode exists
if (!settings.portalPasscode) {
    settings.portalPasscode = "1234";
}

let mqttClient = null;
let cctvIntervals = [];

// Device Inventory Defaults (Clean & Hardened)
const defaultDevices = {
    switches: [],
    sensors: []
};

let iotDevices = JSON.parse(localStorage.getItem('smartniwasDevices')) || defaultDevices;

function saveDevices() {
    localStorage.setItem('smartniwasDevices', JSON.stringify(iotDevices));
}

// Helper function to resolve switch command & state topics with Tasmota defaults
function getSwitchTopics(sw) {
    const cmdTopic = sw.cmdTopic || sw.topic || `cmnd/${sw.id}/POWER`;
    const statTopic = sw.statTopic || sw.topic || `stat/${sw.id}/POWER`;
    return { cmdTopic, statTopic };
}

// Topic discovery state
let discoveryActive = false;
let discoveredTopics = [];

// 4. Independent Authentication Module Gateway
function checkPortalAuth() {
    const isAuth = sessionStorage.getItem('smartniwasPortalAuth') === 'true';
    const authModal = document.getElementById('auth-modal');
    
    if (!isAuth) {
        document.body.classList.add('portal-locked');
        if (authModal) {
            authModal.classList.add('active');
            authModal.setAttribute('aria-hidden', 'false');
            const passInput = document.getElementById('portal-passcode-input');
            if (passInput) setTimeout(() => passInput.focus(), 150);
        }
        // Stop active background streams while locked
        if (mqttClient) {
            mqttClient.end();
            mqttClient = null;
        }
        cctvIntervals.forEach(clearInterval);
        cctvIntervals = [];
    } else {
        document.body.classList.remove('portal-locked');
        if (authModal) {
            authModal.classList.remove('active');
            authModal.setAttribute('aria-hidden', 'true');
        }
        // Initialize active modules upon successful authentication
        initializeModules();
    }
}

window.lockPortal = function() {
    sessionStorage.removeItem('smartniwasPortalAuth');
    checkPortalAuth();
};

// 5. Modules Setup and Connection Logic
function initializeModules() {
    // Prevent module setup if portal is locked
    if (sessionStorage.getItem('smartniwasPortalAuth') !== 'true') {
        return;
    }

    // 1. MQTT Section Setup
    if (settings.mqttHost) {
        setupMQTT();
    } else {
        if (mqttClient) {
            mqttClient.end();
            mqttClient = null;
        }
        renderIoTPlaceholder();
    }

    // 2. CCTV Section Setup
    if (settings.cctvEnabled && settings.nvrHost) {
        setupCCTV();
    } else {
        cctvIntervals.forEach(clearInterval);
        cctvIntervals = [];
        renderCCTVPlaceholder();
    }
}

function renderIoTPlaceholder() {
    const grid = document.getElementById('iot-grid');
    if (!grid) return;
    grid.innerHTML = `
        <div class="iot-placeholder-card">
            <i class="fa-solid fa-circle-info"></i>
            <p>Smart controls are not configured. Click the gear icon in the header to set up your MQTT broker connection.</p>
        </div>
    `;
}

function renderCCTVPlaceholder() {
    const grid = document.getElementById('cctv-grid');
    if (!grid) return;
    grid.innerHTML = `
        <div class="cctv-placeholder-card">
            <i class="fa-solid fa-video-slash"></i>
            <p>Security monitoring is disabled. Enable CCTV in settings and input your NVR credentials to view camera feeds.</p>
        </div>
    `;
}

function setupMQTT() {
    if (mqttClient) {
        mqttClient.end();
    }

    renderIoTGrid();

    const options = {
        reconnectPeriod: 5000,
        connectTimeout: 30 * 1000
    };
    if (settings.mqttUser) options.username = settings.mqttUser;
    if (settings.mqttPass) options.password = settings.mqttPass;

    try {
        mqttClient = mqtt.connect(settings.mqttHost, options);

        mqttClient.on('connect', () => {
            iotDevices.switches.forEach(sw => {
                const { statTopic, cmdTopic } = getSwitchTopics(sw);
                if (statTopic) mqttClient.subscribe(statTopic);
                if (cmdTopic && cmdTopic !== statTopic) mqttClient.subscribe(cmdTopic);
            });
            iotDevices.sensors.forEach(sen => {
                if (sen.topic) mqttClient.subscribe(sen.topic);
            });

            if (discoveryActive) {
                const wildcardInput = document.getElementById('discovery-wildcard');
                const wildcard = wildcardInput ? wildcardInput.value.trim() || '#' : '#';
                mqttClient.subscribe(wildcard);
                updateDiscoveryBanner("Scanning...", "status-scanning");
            }
        });

        mqttClient.on('message', (topic, message) => {
            const payload = message.toString();

            if (discoveryActive) {
                const isConfigured = iotDevices.switches.some(s => {
                    const { cmdTopic, statTopic } = getSwitchTopics(s);
                    return statTopic === topic || cmdTopic === topic || s.topic === topic;
                }) || iotDevices.sensors.some(s => s.topic === topic);
                if (!isConfigured && !discoveredTopics.includes(topic)) {
                    discoveredTopics.push(topic);
                    renderDiscoveryResults();
                }
            }

            const sw = iotDevices.switches.find(s => {
                const { cmdTopic, statTopic } = getSwitchTopics(s);
                return statTopic === topic || cmdTopic === topic || s.topic === topic;
            });
            if (sw) {
                let cleanPayload = payload.trim().toUpperCase();
                if (payload.startsWith('{')) {
                    try {
                        const parsed = JSON.parse(payload);
                        if (parsed.POWER) cleanPayload = parsed.POWER.toUpperCase();
                    } catch (e) {}
                }
                sw.state = cleanPayload;
                const toggleInput = document.getElementById(`toggle-${sw.id}`);
                const statusLabel = document.getElementById(`status-label-${sw.id}`);
                if (toggleInput) toggleInput.checked = (cleanPayload === 'ON');
                if (statusLabel) statusLabel.textContent = cleanPayload;
            }

            const sen = iotDevices.sensors.find(s => s.topic === topic);
            if (sen) {
                sen.value = payload;
                const valElem = document.getElementById(`val-${sen.id}`);
                if (valElem) valElem.textContent = `${payload}${sen.unit || ''}`;
            }
        });

        mqttClient.on('error', () => {
            // Silently handle MQTT error without leaking details to browser log
        });

    } catch (e) {
        // Initialization failure fallback
    }
}

function renderIoTGrid() {
    const grid = document.getElementById('iot-grid');
    if (!grid) return;
    grid.innerHTML = '';

    if (iotDevices.sensors.length === 0 && iotDevices.switches.length === 0) {
        grid.innerHTML = '<div style="font-size: 0.9rem; color: var(--text-secondary); text-align: center; width: 100%; padding: 2rem;">No smart devices configured. Use Portal Settings to add custom switches or sensors.</div>';
        return;
    }

    // Render Sensors safely
    iotDevices.sensors.forEach(sen => {
        const card = document.createElement('div');
        card.className = 'sensor-card';
        
        const iconDiv = document.createElement('div');
        iconDiv.className = 'sensor-icon';
        const safeIcon = (sen.icon && /^fa-[a-z0-9-]+$/.test(sen.icon)) ? sen.icon : 'fa-microchip';
        iconDiv.innerHTML = `<i class="fa-solid ${escapeHTML(safeIcon)}"></i>`;
        
        const detailsDiv = document.createElement('div');
        detailsDiv.className = 'sensor-details';
        
        const valDiv = document.createElement('div');
        valDiv.className = 'sensor-value';
        valDiv.id = `val-${sen.id}`;
        valDiv.textContent = `${sen.value}${sen.unit || ''}`;
        
        const labelDiv = document.createElement('div');
        labelDiv.className = 'sensor-label';
        labelDiv.textContent = sen.name;
        
        detailsDiv.appendChild(valDiv);
        detailsDiv.appendChild(labelDiv);
        
        card.appendChild(iconDiv);
        card.appendChild(detailsDiv);
        grid.appendChild(card);
    });

    // Render Switches safely
    iotDevices.switches.forEach(sw => {
        const card = document.createElement('div');
        card.className = 'switch-card';
        
        const infoDiv = document.createElement('div');
        infoDiv.className = 'switch-info';
        
        const h4 = document.createElement('h4');
        h4.textContent = sw.name;
        
        const p = document.createElement('p');
        p.className = 'switch-status-label';
        p.id = `status-label-${sw.id}`;
        p.textContent = sw.state || 'OFF';
        
        infoDiv.appendChild(h4);
        infoDiv.appendChild(p);
        
        const label = document.createElement('label');
        label.className = 'switch-toggle';
        
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.id = `toggle-${sw.id}`;
        input.checked = (sw.state === 'ON');
        input.onchange = () => toggleSwitch(sw.id);
        
        const span = document.createElement('span');
        span.className = 'slider';
        
        label.appendChild(input);
        label.appendChild(span);
        
        card.appendChild(infoDiv);
        card.appendChild(label);
        grid.appendChild(card);
    });
}

window.toggleSwitch = function(id) {
    const sw = iotDevices.switches.find(s => s.id === id);
    if (sw && mqttClient && mqttClient.connected) {
        const toggleInput = document.getElementById(`toggle-${id}`);
        const newState = toggleInput ? (toggleInput.checked ? 'ON' : 'OFF') : 'OFF';
        const { cmdTopic } = getSwitchTopics(sw);
        
        mqttClient.publish(cmdTopic, newState, { retain: false });
        
        const statusLabel = document.getElementById(`status-label-${id}`);
        if (statusLabel) statusLabel.textContent = newState;
    }
};

// CCTV NVR Safe Helper
function getCctvImageUrl(channel) {
    if (!settings.nvrHost) return '';
    let hostClean = settings.nvrHost.replace(/\/+$/, '');
    let urlBase = hostClean.replace(/^https?:\/\//, '');
    let protocol = hostClean.startsWith('https') ? 'https://' : 'http://';
    
    let credentials = '';
    if (settings.nvrUser && settings.nvrPass) {
        credentials = `${encodeURIComponent(settings.nvrUser)}:${encodeURIComponent(settings.nvrPass)}@`;
    }
    return `${protocol}${credentials}${urlBase}/ISAPI/Streaming/channels/${encodeURIComponent(channel)}/picture`;
}

function setupCCTV() {
    cctvIntervals.forEach(clearInterval);
    cctvIntervals = [];

    const grid = document.getElementById('cctv-grid');
    if (!grid) return;
    grid.innerHTML = '';

    if (!settings.cctvEnabled || !settings.nvrHost) {
        renderCCTVPlaceholder();
        return;
    }

    const channels = settings.nvrChannels.split(',').map(c => c.trim()).filter(c => c.length > 0);

    channels.forEach(channel => {
        const card = document.createElement('div');
        card.className = 'cctv-card';
        
        const container = document.createElement('div');
        container.className = 'cctv-feed-container';
        container.style.cursor = 'pointer';
        container.onclick = () => openCameraStream(channel);
        
        const img = document.createElement('img');
        img.className = 'cctv-feed-img';
        img.id = `cam-${channel}`;
        img.alt = `Camera ${channel}`;
        img.onerror = () => handleCamError(channel);
        
        const placeholder = document.createElement('div');
        placeholder.className = 'cctv-feed-placeholder';
        placeholder.id = `cam-place-${channel}`;
        placeholder.innerHTML = `<i class="fa-solid fa-circle-notch"></i><span>Loading Camera Feed...</span>`;
        
        const overlay = document.createElement('div');
        overlay.className = 'cctv-feed-overlay';
        overlay.innerHTML = `<span class="cctv-status-dot"></span><span>CAM ${escapeHTML(channel)}</span>`;
        
        container.appendChild(img);
        container.appendChild(placeholder);
        container.appendChild(overlay);
        
        const meta = document.createElement('div');
        meta.className = 'cctv-meta';
        
        const nameSpan = document.createElement('span');
        nameSpan.className = 'cctv-name';
        nameSpan.textContent = `Channel ${channel}`;
        
        const refreshBtn = document.createElement('button');
        refreshBtn.className = 'cctv-refresh-btn';
        refreshBtn.setAttribute('aria-label', 'Refresh Camera');
        refreshBtn.innerHTML = `<i class="fa-solid fa-arrows-rotate"></i>`;
        refreshBtn.onclick = (e) => {
            e.stopPropagation();
            refreshCamera(channel);
        };
        
        meta.appendChild(nameSpan);
        meta.appendChild(refreshBtn);
        
        card.appendChild(container);
        card.appendChild(meta);
        grid.appendChild(card);

        img.onload = () => {
            if (placeholder) placeholder.classList.add('hidden');
        };

        const updateImage = () => {
            if (settings.cctvEnabled && sessionStorage.getItem('smartniwasPortalAuth') === 'true') {
                const baseUrl = getCctvImageUrl(channel);
                img.src = `${baseUrl}?t=${Date.now()}`;
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
};

window.refreshCamera = function(channel) {
    const img = document.getElementById(`cam-${channel}`);
    const placeholder = document.getElementById(`cam-place-${channel}`);
    if (img) {
        if (placeholder) placeholder.classList.remove('hidden');
        const baseUrl = getCctvImageUrl(channel);
        img.src = `${baseUrl}?t=${Date.now()}`;
    }
};

window.openCameraStream = function(channel) {
    const baseUrl = getCctvImageUrl(channel);
    if (baseUrl) {
        window.open(baseUrl, '_blank');
    }
};

// 6. Device Manager Inventory CRUD
function renderDeviceList() {
    const list = document.getElementById('device-list');
    if (!list) return;
    list.innerHTML = '';

    if (iotDevices.switches.length === 0 && iotDevices.sensors.length === 0) {
        list.innerHTML = '<div class="discovery-empty-state" style="padding: 1rem;">No custom devices configured yet. Use the form below or the Discovery tool to add devices.</div>';
        return;
    }

    iotDevices.sensors.forEach(sen => {
        const item = document.createElement('div');
        item.className = 'device-item';
        
        const info = document.createElement('div');
        info.className = 'device-item-info';
        
        const nameSpan = document.createElement('span');
        nameSpan.className = 'device-item-name';
        nameSpan.textContent = sen.name + ' ';
        const typeSpan = document.createElement('span');
        typeSpan.style.fontSize = '0.75rem';
        typeSpan.style.fontWeight = 'normal';
        typeSpan.style.opacity = '0.75';
        typeSpan.textContent = '(Sensor)';
        nameSpan.appendChild(typeSpan);
        
        const metaDiv = document.createElement('div');
        metaDiv.className = 'device-item-meta';
        metaDiv.textContent = `Topic: ${sen.topic}`;
        
        info.appendChild(nameSpan);
        info.appendChild(metaDiv);
        
        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'device-delete-btn';
        delBtn.setAttribute('aria-label', 'Delete sensor');
        delBtn.innerHTML = `<i class="fa-solid fa-trash-can"></i>`;
        delBtn.onclick = () => deleteDevice('sensor', sen.id);
        
        item.appendChild(info);
        item.appendChild(delBtn);
        list.appendChild(item);
    });

    iotDevices.switches.forEach(sw => {
        const { cmdTopic, statTopic } = getSwitchTopics(sw);
        const item = document.createElement('div');
        item.className = 'device-item';
        
        const info = document.createElement('div');
        info.className = 'device-item-info';
        
        const nameSpan = document.createElement('span');
        nameSpan.className = 'device-item-name';
        nameSpan.textContent = sw.name + ' ';
        const typeSpan = document.createElement('span');
        typeSpan.style.fontSize = '0.75rem';
        typeSpan.style.fontWeight = 'normal';
        typeSpan.style.opacity = '0.75';
        typeSpan.textContent = '(Switch)';
        nameSpan.appendChild(typeSpan);
        
        const metaDiv = document.createElement('div');
        metaDiv.className = 'device-item-meta';
        metaDiv.textContent = `Cmd: ${cmdTopic} | Stat: ${statTopic}`;
        
        info.appendChild(nameSpan);
        info.appendChild(metaDiv);
        
        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'device-delete-btn';
        delBtn.setAttribute('aria-label', 'Delete switch');
        delBtn.innerHTML = `<i class="fa-solid fa-trash-can"></i>`;
        delBtn.onclick = () => deleteDevice('switch', sw.id);
        
        item.appendChild(info);
        item.appendChild(delBtn);
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
};

// 7. Topic Discovery Renderer
function updateDiscoveryBanner(text, className) {
    const banner = document.getElementById('discovery-status-banner');
    if (banner) {
        banner.textContent = text;
        banner.className = `discovery-banner ${className}`;
    }
}

function renderDiscoveryResults() {
    const results = document.getElementById('discovery-results');
    if (!results) return;
    results.innerHTML = '';

    if (discoveredTopics.length === 0) {
        results.innerHTML = '<div class="discovery-empty-state">No paths scanned yet. Start scanning to capture traffic.</div>';
        return;
    }

    discoveredTopics.forEach(topic => {
        const item = document.createElement('div');
        item.className = 'discovery-item';
        
        const pathDiv = document.createElement('div');
        pathDiv.className = 'discovery-item-path';
        pathDiv.textContent = topic;
        
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'discovery-item-actions';
        
        const switchBtn = document.createElement('button');
        switchBtn.type = 'button';
        switchBtn.className = 'btn btn-primary btn-xs';
        switchBtn.textContent = '+ Switch';
        switchBtn.onclick = () => quickAddDevice('switch', topic);
        
        const sensorBtn = document.createElement('button');
        sensorBtn.type = 'button';
        sensorBtn.className = 'btn btn-primary btn-xs';
        sensorBtn.textContent = '+ Sensor';
        sensorBtn.onclick = () => quickAddDevice('sensor', topic);
        
        actionsDiv.appendChild(switchBtn);
        actionsDiv.appendChild(sensorBtn);
        
        item.appendChild(pathDiv);
        item.appendChild(actionsDiv);
        results.appendChild(item);
    });
}

window.quickAddDevice = function(type, topic) {
    const nameInput = document.getElementById('new-dev-name');
    const typeSelect = document.getElementById('new-dev-type');
    if (nameInput) nameInput.value = topic.split('/').pop().replace(/_/g, ' ');
    if (typeSelect) typeSelect.value = type;
    
    const switchFieldsPanel = document.getElementById('switch-fields');
    const sensorFieldsPanel = document.getElementById('sensor-fields');
    
    if (type === 'switch') {
        if (switchFieldsPanel) switchFieldsPanel.classList.remove('hidden');
        if (sensorFieldsPanel) sensorFieldsPanel.classList.add('hidden');
        let cmd = topic;
        let stat = topic;
        if (topic.startsWith('stat/')) {
            cmd = topic.replace('stat/', 'cmnd/');
            stat = topic;
        } else if (topic.startsWith('cmnd/')) {
            cmd = topic;
            stat = topic.replace('cmnd/', 'stat/');
        }
        const cmdInput = document.getElementById('new-dev-cmd-topic');
        const statInput = document.getElementById('new-dev-stat-topic');
        if (cmdInput) cmdInput.value = cmd;
        if (statInput) statInput.value = stat;
    } else {
        if (switchFieldsPanel) switchFieldsPanel.classList.add('hidden');
        if (sensorFieldsPanel) sensorFieldsPanel.classList.remove('hidden');
        const topicInput = document.getElementById('new-dev-topic');
        const unitInput = document.getElementById('new-dev-unit');
        const iconInput = document.getElementById('new-dev-icon');
        if (topicInput) topicInput.value = topic;
        if (unitInput) unitInput.value = '';
        if (iconInput) iconInput.value = 'fa-microchip';
    }

    const tabBtn = document.querySelector('.settings-tab-btn[data-tab="devices"]');
    if (tabBtn) tabBtn.click();
    if (nameInput) nameInput.focus();
};

// 8. Time Clock
function updateClock() {
    const clockElem = document.getElementById('live-clock');
    if (clockElem) {
        const now = new Date();
        clockElem.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
}

// Initialize Everything & Bind Verification Gateway
document.addEventListener('DOMContentLoaded', () => {
    renderDirectory();
    renderNotes();
    updateClock();
    setInterval(updateClock, 1000);

    // Run Security Authentication Gateway Check
    checkPortalAuth();

    // Authentication Form Binding
    const authForm = document.getElementById('auth-form');
    const authErrorBanner = document.getElementById('auth-error-banner');
    const portalPassInput = document.getElementById('portal-passcode-input');
    const lockBtn = document.getElementById('lock-portal-btn');

    if (authForm) {
        authForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const inputVal = portalPassInput ? portalPassInput.value.trim() : '';
            const currentPass = settings.portalPasscode || "1234";
            
            if (inputVal === currentPass) {
                sessionStorage.setItem('smartniwasPortalAuth', 'true');
                if (authErrorBanner) authErrorBanner.classList.add('hidden');
                if (portalPassInput) portalPassInput.value = '';
                checkPortalAuth();
            } else {
                if (authErrorBanner) authErrorBanner.classList.remove('hidden');
                if (portalPassInput) {
                    portalPassInput.value = '';
                    portalPassInput.focus();
                }
            }
        });
    }

    if (lockBtn) {
        lockBtn.addEventListener('click', () => lockPortal());
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

    if (cctvEnabledCheckbox && cctvSettingsFields) {
        cctvEnabledCheckbox.addEventListener('change', () => {
            if (cctvEnabledCheckbox.checked) {
                cctvSettingsFields.classList.remove('hidden');
            } else {
                cctvSettingsFields.classList.add('hidden');
            }
        });
    }

    const showSettings = () => {
        if (!settingsModal) return;
        const passcodeSetting = document.getElementById('portal-passcode-setting');
        const mqttHostInput = document.getElementById('mqtt-host');
        const mqttUserInput = document.getElementById('mqtt-user');
        const mqttPassInput = document.getElementById('mqtt-pass');
        
        if (passcodeSetting) passcodeSetting.value = settings.portalPasscode || "1234";
        if (mqttHostInput) mqttHostInput.value = settings.mqttHost;
        if (mqttUserInput) mqttUserInput.value = settings.mqttUser;
        if (mqttPassInput) mqttPassInput.value = settings.mqttPass;
        
        if (cctvEnabledCheckbox) {
            cctvEnabledCheckbox.checked = settings.cctvEnabled;
            if (cctvSettingsFields) {
                if (settings.cctvEnabled) {
                    cctvSettingsFields.classList.remove('hidden');
                } else {
                    cctvSettingsFields.classList.add('hidden');
                }
            }
        }
        
        const nvrHostInput = document.getElementById('nvr-host');
        const nvrUserInput = document.getElementById('nvr-user');
        const nvrPassInput = document.getElementById('nvr-pass');
        const nvrChannelsInput = document.getElementById('nvr-channels');
        
        if (nvrHostInput) nvrHostInput.value = settings.nvrHost;
        if (nvrUserInput) nvrUserInput.value = settings.nvrUser;
        if (nvrPassInput) nvrPassInput.value = settings.nvrPass;
        if (nvrChannelsInput) nvrChannelsInput.value = settings.nvrChannels;

        const firstTab = document.querySelector('.settings-tab-btn[data-tab="connection"]');
        if (firstTab) firstTab.click();

        settingsModal.classList.add('active');
        settingsModal.setAttribute('aria-hidden', 'false');
    };

    const hideSettings = () => {
        if (!settingsModal) return;
        settingsModal.classList.remove('active');
        settingsModal.setAttribute('aria-hidden', 'true');
        if (discoveryActive) {
            stopDiscovery();
        }
    };

    const showNoteModal = () => {
        if (!noteModal) return;
        noteModal.classList.add('active');
        noteModal.setAttribute('aria-hidden', 'false');
        if (noteText) noteText.focus();
    };

    const hideNoteModal = () => {
        if (!noteModal) return;
        noteModal.classList.remove('active');
        noteModal.setAttribute('aria-hidden', 'true');
        if (noteForm) noteForm.reset();
    };

    if (!settings.mqttHost && sessionStorage.getItem('smartniwasPortalAuth') === 'true') {
        setTimeout(showSettings, 600);
    }

    if (addNoteBtn) addNoteBtn.addEventListener('click', showNoteModal);
    if (cancelNoteBtn) cancelNoteBtn.addEventListener('click', hideNoteModal);
    if (closeNoteBtn) closeNoteBtn.addEventListener('click', hideNoteModal);
    
    if (noteForm) {
        noteForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const text = noteText ? noteText.value.trim() : '';
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
    }

    if (openSettingsBtn) openSettingsBtn.addEventListener('click', showSettings);
    if (closeSettingsBtn) closeSettingsBtn.addEventListener('click', hideSettings);
    if (cancelSettingsBtn) cancelSettingsBtn.addEventListener('click', hideSettings);

    if (settingsForm) {
        settingsForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const passcodeSetting = document.getElementById('portal-passcode-setting');
            const mqttHostInput = document.getElementById('mqtt-host');
            const mqttUserInput = document.getElementById('mqtt-user');
            const mqttPassInput = document.getElementById('mqtt-pass');
            const nvrHostInput = document.getElementById('nvr-host');
            const nvrUserInput = document.getElementById('nvr-user');
            const nvrPassInput = document.getElementById('nvr-pass');
            const nvrChannelsInput = document.getElementById('nvr-channels');

            if (passcodeSetting && passcodeSetting.value.trim()) {
                settings.portalPasscode = passcodeSetting.value.trim();
            }
            settings.mqttHost = mqttHostInput ? mqttHostInput.value.trim() : '';
            settings.mqttUser = mqttUserInput ? mqttUserInput.value.trim() : '';
            settings.mqttPass = mqttPassInput ? mqttPassInput.value.trim() : '';
            
            settings.cctvEnabled = cctvEnabledCheckbox ? cctvEnabledCheckbox.checked : false;
            settings.nvrHost = nvrHostInput ? nvrHostInput.value.trim() : '';
            settings.nvrUser = nvrUserInput ? nvrUserInput.value.trim() : '';
            settings.nvrPass = nvrPassInput ? nvrPassInput.value.trim() : '';
            settings.nvrChannels = nvrChannelsInput ? nvrChannelsInput.value.trim() : '101,201';
            
            localStorage.setItem('smartniwasSettings', JSON.stringify(settings));
            
            initializeModules();
            hideSettings();
        });
    }

    const tabButtons = document.querySelectorAll('.settings-tab-btn');
    const tabPanels = document.querySelectorAll('.tab-panel');
    const footerActions = document.getElementById('settings-form-actions');

    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-tab');

            tabButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            tabPanels.forEach(p => p.classList.add('hidden'));
            const targetPanel = document.getElementById(`tab-${targetTab}`);
            if (targetPanel) targetPanel.classList.remove('hidden');

            if (footerActions) {
                if (targetTab === 'connection') {
                    footerActions.classList.remove('hidden');
                } else {
                    footerActions.classList.add('hidden');
                }
            }

            if (targetTab === 'devices') {
                renderDeviceList();
            }
        });
    });

    const newDevTypeSelect = document.getElementById('new-dev-type');
    const switchFieldsPanel = document.getElementById('switch-fields');
    const sensorFieldsPanel = document.getElementById('sensor-fields');
    if (newDevTypeSelect) {
        newDevTypeSelect.addEventListener('change', () => {
            if (newDevTypeSelect.value === 'sensor') {
                if (switchFieldsPanel) switchFieldsPanel.classList.add('hidden');
                if (sensorFieldsPanel) sensorFieldsPanel.classList.remove('hidden');
            } else {
                if (switchFieldsPanel) switchFieldsPanel.classList.remove('hidden');
                if (sensorFieldsPanel) sensorFieldsPanel.classList.add('hidden');
            }
        });
    }

    const addDeviceBtnAction = document.getElementById('add-device-btn-action');
    if (addDeviceBtnAction) {
        addDeviceBtnAction.addEventListener('click', () => {
            const nameInput = document.getElementById('new-dev-name');
            const name = nameInput ? nameInput.value.trim() : '';
            const type = newDevTypeSelect ? newDevTypeSelect.value : 'switch';
            const id = 'dev-' + Date.now();

            if (type === 'switch') {
                const cmdInput = document.getElementById('new-dev-cmd-topic');
                const statInput = document.getElementById('new-dev-stat-topic');
                const cmdTopic = cmdInput ? cmdInput.value.trim() : '';
                const statTopic = statInput ? statInput.value.trim() : '';
                if (!name || (!cmdTopic && !statTopic)) {
                    alert('Please enter a display name and at least one MQTT topic (Command or State).');
                    return;
                }
                iotDevices.switches.push({
                    id,
                    name,
                    cmdTopic: cmdTopic || statTopic,
                    statTopic: statTopic || cmdTopic,
                    state: 'OFF'
                });
            } else {
                const topicInput = document.getElementById('new-dev-topic');
                const topic = topicInput ? topicInput.value.trim() : '';
                if (!name || !topic) {
                    alert('Please enter a display name and sensor MQTT topic.');
                    return;
                }
                const unitInput = document.getElementById('new-dev-unit');
                const iconInput = document.getElementById('new-dev-icon');
                const unit = unitInput ? unitInput.value.trim() : '';
                const icon = (iconInput && iconInput.value.trim()) ? iconInput.value.trim() : 'fa-microchip';
                iotDevices.sensors.push({ id, name, topic, value: '--', unit, icon });
            }

            saveDevices();
            renderDeviceList();
            initializeModules();

            if (nameInput) nameInput.value = '';
            const cmdIn = document.getElementById('new-dev-cmd-topic');
            const statIn = document.getElementById('new-dev-stat-topic');
            const topIn = document.getElementById('new-dev-topic');
            const unitIn = document.getElementById('new-dev-unit');
            const iconIn = document.getElementById('new-dev-icon');
            if (cmdIn) cmdIn.value = '';
            if (statIn) statIn.value = '';
            if (topIn) topIn.value = '';
            if (unitIn) unitIn.value = '';
            if (iconIn) iconIn.value = '';
        });
    }

    const discoveryToggleBtn = document.getElementById('discovery-toggle-btn');
    
    function startDiscovery() {
        if (!mqttClient || !mqttClient.connected) {
            alert("No active broker connection. Please save a valid Broker URL first and verify connection.");
            return;
        }
        discoveryActive = true;
        discoveredTopics = [];
        renderDiscoveryResults();
        
        const wildcardInput = document.getElementById('discovery-wildcard');
        const wildcard = wildcardInput ? wildcardInput.value.trim() || '#' : '#';
        mqttClient.subscribe(wildcard);

        if (discoveryToggleBtn) {
            discoveryToggleBtn.innerHTML = '<i class="fa-solid fa-square"></i> Stop Scanning';
            discoveryToggleBtn.style.background = '#ef4444';
        }
        updateDiscoveryBanner(`SCANNING... Listening to topic wildcard: "${wildcard}"`, "status-scanning");
    }

    function stopDiscovery() {
        discoveryActive = false;
        
        if (mqttClient && mqttClient.connected) {
            const wildcardInput = document.getElementById('discovery-wildcard');
            const wildcard = wildcardInput ? wildcardInput.value.trim() || '#' : '#';
            mqttClient.unsubscribe(wildcard);
        }

        if (discoveryToggleBtn) {
            discoveryToggleBtn.innerHTML = '<i class="fa-solid fa-satellite-dish"></i> Start Scanning';
            discoveryToggleBtn.style.background = '';
        }
        updateDiscoveryBanner("Scanner is currently IDLE.", "status-idle");
    }

    if (discoveryToggleBtn) {
        discoveryToggleBtn.addEventListener('click', () => {
            if (!discoveryActive) {
                startDiscovery();
            } else {
                stopDiscovery();
            }
        });
    }

    window.addEventListener('click', (e) => {
        if (e.target === noteModal) hideNoteModal();
        if (e.target === settingsModal) hideSettings();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (noteModal && noteModal.classList.contains('active')) hideNoteModal();
            if (settingsModal && settingsModal.classList.contains('active')) hideSettings();
        }
    });
});