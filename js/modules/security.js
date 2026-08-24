// Master Passcode Security Enforcement Module
import { state } from './state.js';

export function initSecurity() {
    const banner = document.getElementById('security-enforcement-banner');
    const badge = document.getElementById('pass-status-badge');
    const fieldsWrapper = document.getElementById('security-fields-wrapper');
    const statusMsgBox = document.getElementById('security-status-msg');
    const securityForm = document.getElementById('security-settings-form');
    const togglePassBtn = document.getElementById('toggle-change-pass-btn');

    function isWeakPasscode() {
        return (state.settings.portalPasscode === '1234' || state.settings.portalPasscode.length < 10);
    }

    function checkSecurityPolicy() {
        const weak = isWeakPasscode();
        if (banner) {
            if (weak && state.isAuth()) {
                banner.classList.remove('hidden');
            } else {
                banner.classList.add('hidden');
            }
        }
    }

    function updateSecurityTabUI() {
        const weak = isWeakPasscode();
        if (badge) {
            if (weak) {
                badge.textContent = "Action Required (Default PIN 1234)";
                badge.className = "status-badge status-offline";
            } else {
                badge.textContent = "Protected (10+ chars)";
                badge.className = "status-badge status-online";
            }
        }

        if (fieldsWrapper) {
            if (weak) {
                fieldsWrapper.classList.remove('hidden');
            } else {
                fieldsWrapper.classList.add('hidden');
            }
        }
    }

    function showSecurityStatus(msg, isSuccess) {
        if (!statusMsgBox) return;
        statusMsgBox.textContent = msg;
        statusMsgBox.className = `feedback-msg ${isSuccess ? 'feedback-success' : 'feedback-error'}`;
        statusMsgBox.classList.remove('hidden');
    }

    function clearSecurityStatus() {
        if (statusMsgBox) {
            statusMsgBox.classList.add('hidden');
            statusMsgBox.textContent = '';
        }
    }

    if (togglePassBtn) {
        togglePassBtn.addEventListener('click', () => {
            if (fieldsWrapper) {
                fieldsWrapper.classList.toggle('hidden');
                if (!fieldsWrapper.classList.contains('hidden')) {
                    const passInput = document.getElementById('portal-passcode-setting');
                    if (passInput) passInput.focus();
                }
            }
        });
    }

    if (securityForm) {
        securityForm.addEventListener('submit', (e) => {
            e.preventDefault();
            clearSecurityStatus();

            const passcodeSetting = document.getElementById('portal-passcode-setting');
            const passcodeConfirm = document.getElementById('portal-passcode-confirm');

            const newPass = passcodeSetting ? passcodeSetting.value.trim() : '';
            const confirmPass = passcodeConfirm ? passcodeConfirm.value.trim() : '';

            if (!newPass) {
                showSecurityStatus('❌ Please enter a new master passcode.', false);
                return;
            }
            if (newPass.length < 10) {
                showSecurityStatus('❌ Passcode must be at least 10 characters long.', false);
                return;
            }
            if (['1234', '0000000000', '1111111111', '1234567890'].includes(newPass)) {
                showSecurityStatus('❌ Forbidden: Default or simple passcode patterns are not allowed.', false);
                return;
            }
            if (!confirmPass) {
                showSecurityStatus('❌ Please re-enter your passcode in the confirm box.', false);
                return;
            }
            if (newPass !== confirmPass) {
                showSecurityStatus('❌ Passcodes do not match. Please re-check both entries.', false);
                return;
            }

            // Save Passcode
            state.saveSettings({ portalPasscode: newPass });

            if (passcodeSetting) passcodeSetting.value = '';
            if (passcodeConfirm) passcodeConfirm.value = '';

            checkSecurityPolicy();
            updateSecurityTabUI();
            showSecurityStatus('✅ Master Passcode updated successfully!', true);
        });
    }

    return {
        checkSecurityPolicy,
        updateSecurityTabUI,
        clearSecurityStatus,
        isWeakPasscode
    };
}
