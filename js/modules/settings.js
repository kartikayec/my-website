// Tabbed Settings UI Controller
import { state } from './state.js';

export function initSettings(securityModule, mqttModule, cctvModule) {
    const settingsModal = document.getElementById('settings-modal');
    const openSettingsBtn = document.getElementById('open-settings-btn');
    const closeSettingsBtn = document.getElementById('close-settings-btn');
    const tabButtons = document.querySelectorAll('.settings-tab-btn');
    const tabPanels = document.querySelectorAll('.tab-panel');
    const connectionForm = document.getElementById('connection-settings-form');

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

    function switchTab(targetTab) {
        tabButtons.forEach(b => b.classList.remove('active'));
        tabPanels.forEach(p => p.classList.add('hidden'));

        const activeBtn = document.querySelector(`.settings-tab-btn[data-tab="${targetTab}"]`);
        const activePanel = document.getElementById(`tab-${targetTab}`);

        if (activeBtn) activeBtn.classList.add('active');
        if (activePanel) activePanel.classList.remove('hidden');

        if (targetTab === 'security' && securityModule && securityModule.updateSecurityTabUI) {
            securityModule.updateSecurityTabUI();
        }
    }

    // Event delegation for tab buttons
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-tab');
            switchTab(targetTab);
        });
    });

    function showSettings(preferredTab = 'connection') {
        if (!settingsModal) return;

        if (securityModule) securityModule.clearSecurityStatus();

        const mqttHostInput = document.getElementById('mqtt-host');
        const mqttUserInput = document.getElementById('mqtt-user');
        const mqttPassInput = document.getElementById('mqtt-pass');
        const nvrHostInput = document.getElementById('nvr-host');
        const nvrUserInput = document.getElementById('nvr-user');
        const nvrPassInput = document.getElementById('nvr-pass');
        const nvrChannelsInput = document.getElementById('nvr-channels');

        if (mqttHostInput) mqttHostInput.value = state.settings.mqttHost || "wss://mqtt.smartniwas.com";
        if (mqttUserInput) mqttUserInput.value = state.settings.mqttUser || "";
        if (mqttPassInput) mqttPassInput.value = state.settings.mqttPass || "";

        if (cctvEnabledCheckbox) {
            cctvEnabledCheckbox.checked = state.settings.cctvEnabled;
            if (cctvSettingsFields) {
                if (state.settings.cctvEnabled) {
                    cctvSettingsFields.classList.remove('hidden');
                } else {
                    cctvSettingsFields.classList.add('hidden');
                }
            }
        }

        if (nvrHostInput) nvrHostInput.value = state.settings.nvrHost || "https://cctv.smartniwas.com";
        if (nvrUserInput) nvrUserInput.value = state.settings.nvrUser || "";
        if (nvrPassInput) nvrPassInput.value = state.settings.nvrPass || "";
        if (nvrChannelsInput) nvrChannelsInput.value = state.settings.nvrChannels || "101,201";

        switchTab(preferredTab);

        settingsModal.classList.add('active');
        settingsModal.setAttribute('aria-hidden', 'false');
    }

    function hideSettings() {
        if (!settingsModal) return;
        if (securityModule) securityModule.clearSecurityStatus();
        settingsModal.classList.remove('active');
        settingsModal.setAttribute('aria-hidden', 'true');
    }

    if (openSettingsBtn) openSettingsBtn.addEventListener('click', () => showSettings('connection'));
    if (closeSettingsBtn) closeSettingsBtn.addEventListener('click', hideSettings);

    if (connectionForm) {
        connectionForm.addEventListener('submit', (e) => {
            e.preventDefault();

            const mqttHostInput = document.getElementById('mqtt-host');
            const mqttUserInput = document.getElementById('mqtt-user');
            const mqttPassInput = document.getElementById('mqtt-pass');
            const nvrHostInput = document.getElementById('nvr-host');
            const nvrUserInput = document.getElementById('nvr-user');
            const nvrPassInput = document.getElementById('nvr-pass');
            const nvrChannelsInput = document.getElementById('nvr-channels');

            const newSettings = {
                mqttHost: (mqttHostInput && mqttHostInput.value.trim()) ? mqttHostInput.value.trim() : "wss://mqtt.smartniwas.com",
                mqttUser: mqttUserInput ? mqttUserInput.value.trim() : "",
                mqttPass: mqttPassInput ? mqttPassInput.value.trim() : "",
                cctvEnabled: cctvEnabledCheckbox ? cctvEnabledCheckbox.checked : false,
                nvrHost: (nvrHostInput && nvrHostInput.value.trim()) ? nvrHostInput.value.trim() : "https://cctv.smartniwas.com",
                nvrUser: nvrUserInput ? nvrUserInput.value.trim() : "",
                nvrPass: nvrPassInput ? nvrPassInput.value.trim() : "",
                nvrChannels: (nvrChannelsInput && nvrChannelsInput.value.trim()) ? nvrChannelsInput.value.trim() : "101,201"
            };

            state.saveSettings(newSettings);

            if (mqttModule && mqttModule.init) mqttModule.init();
            if (cctvModule && cctvModule.init) cctvModule.init();

            hideSettings();
        });
    }

    return { showSettings, hideSettings, switchTab };
}
