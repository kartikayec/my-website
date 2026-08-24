// Tasmota MQTT WebSocket Controller & Discovery Module
import { state } from './state.js';

export function initMQTT() {
    let client = null;
    let discoveryActive = false;
    let discoveredTopics = [];

    const grid = document.getElementById('iot-grid');
    const deviceList = document.getElementById('device-list');
    const discoveryToggleBtn = document.getElementById('discovery-toggle-btn');

    function getSwitchTopics(sw) {
        const cmdTopic = sw.cmdTopic || sw.topic || `cmnd/${sw.id}/POWER`;
        const statTopic = sw.statTopic || sw.topic || `stat/${sw.id}/POWER`;
        return { cmdTopic, statTopic };
    }

    function renderPlaceholder() {
        if (!grid) return;
        grid.innerHTML = `
            <div class="placeholder-card">
                <i class="fa-solid fa-circle-info"></i>
                <p>Smart controls are not configured. Click the gear icon in the header to set up your MQTT broker connection.</p>
            </div>
        `;
    }

    function renderIoTGrid() {
        if (!grid) return;
        grid.innerHTML = '';

        const switches = state.devices.switches || [];
        const sensors = state.devices.sensors || [];

        if (switches.length === 0 && sensors.length === 0) {
            grid.innerHTML = '<div class="placeholder-card"><i class="fa-solid fa-microchip"></i><p>No smart devices configured yet. Use Settings -> Devices to add custom switches or sensors.</p></div>';
            return;
        }

        sensors.forEach(sen => {
            const card = document.createElement('div');
            card.className = 'sensor-card';
            card.innerHTML = `
                <div class="sensor-icon"><i class="fa-solid ${sen.icon || 'fa-microchip'}"></i></div>
                <div class="sensor-details">
                    <div class="sensor-value" id="val-${sen.id}">${sen.value || '--'}${sen.unit || ''}</div>
                    <div class="sensor-label">${escapeHTML(sen.name)}</div>
                </div>
            `;
            grid.appendChild(card);
        });

        switches.forEach(sw => {
            const card = document.createElement('div');
            card.className = 'switch-card';
            card.innerHTML = `
                <div class="switch-info">
                    <h4>${escapeHTML(sw.name)}</h4>
                    <p class="switch-status-label" id="status-label-${sw.id}">${sw.state || 'OFF'}</p>
                </div>
                <label class="switch-toggle">
                    <input type="checkbox" id="toggle-${sw.id}" ${sw.state === 'ON' ? 'checked' : ''}>
                    <span class="slider"></span>
                </label>
            `;
            grid.appendChild(card);

            const toggleInput = card.querySelector(`#toggle-${sw.id}`);
            if (toggleInput) {
                toggleInput.addEventListener('change', () => toggleSwitch(sw.id, toggleInput.checked));
            }
        });
    }

    function toggleSwitch(id, isChecked) {
        const sw = (state.devices.switches || []).find(s => s.id === id);
        if (sw && client && client.connected) {
            const newState = isChecked ? 'ON' : 'OFF';
            const { cmdTopic } = getSwitchTopics(sw);
            client.publish(cmdTopic, newState, { retain: false });
            sw.state = newState;
            const statusLabel = document.getElementById(`status-label-${id}`);
            if (statusLabel) statusLabel.textContent = newState;
        }
    }

    function connect() {
        if (client) {
            client.end();
            client = null;
        }

        if (!state.settings.mqttHost || !state.isAuth()) {
            renderPlaceholder();
            return;
        }

        renderIoTGrid();

        const options = {
            reconnectPeriod: 5000,
            connectTimeout: 30000
        };
        if (state.settings.mqttUser) options.username = state.settings.mqttUser;
        if (state.settings.mqttPass) options.password = state.settings.mqttPass;

        try {
            if (window.mqtt) {
                client = window.mqtt.connect(state.settings.mqttHost, options);

                client.on('connect', () => {
                    (state.devices.switches || []).forEach(sw => {
                        const { statTopic, cmdTopic } = getSwitchTopics(sw);
                        if (statTopic) client.subscribe(statTopic);
                        if (cmdTopic && cmdTopic !== statTopic) client.subscribe(cmdTopic);
                    });
                    (state.devices.sensors || []).forEach(sen => {
                        if (sen.topic) client.subscribe(sen.topic);
                    });
                });

                client.on('message', (topic, message) => {
                    const payload = message.toString();

                    const sw = (state.devices.switches || []).find(s => {
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

                    const sen = (state.devices.sensors || []).find(s => s.topic === topic);
                    if (sen) {
                        sen.value = payload;
                        const valElem = document.getElementById(`val-${sen.id}`);
                        if (valElem) valElem.textContent = `${payload}${sen.unit || ''}`;
                    }
                });
            }
        } catch (e) {
            // Silently handle connection error
        }
    }

    function disconnect() {
        if (client) {
            client.end();
            client = null;
        }
    }

    function escapeHTML(str) {
        if (typeof str !== 'string') return '';
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // Subscribe to state updates
    state.on('devices', renderIoTGrid);

    connect();

    return { init: connect, disconnect, renderIoTGrid };
}
