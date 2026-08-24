// Verification Gateway Module
import { state } from './state.js';

export function initAuth(securityModule, mqttModule, cctvModule) {
    const authModal = document.getElementById('auth-modal');
    const authForm = document.getElementById('auth-form');
    const authErrorBanner = document.getElementById('auth-error-banner');
    const portalPassInput = document.getElementById('portal-passcode-input');
    const lockBtn = document.getElementById('lock-portal-btn');

    function checkPortalAuth() {
        const isAuth = state.isAuth();
        
        if (!isAuth) {
            document.body.classList.add('portal-locked');
            if (authModal) {
                authModal.classList.add('active');
                authModal.setAttribute('aria-hidden', 'false');
                if (portalPassInput) setTimeout(() => portalPassInput.focus(), 150);
            }
            if (mqttModule && mqttModule.disconnect) mqttModule.disconnect();
            if (cctvModule && cctvModule.stopIntervals) cctvModule.stopIntervals();
            securityModule.checkSecurityPolicy();
        } else {
            document.body.classList.remove('portal-locked');
            if (authModal) {
                authModal.classList.remove('active');
                authModal.setAttribute('aria-hidden', 'true');
            }
            if (mqttModule && mqttModule.init) mqttModule.init();
            if (cctvModule && cctvModule.init) cctvModule.init();
            securityModule.checkSecurityPolicy();
        }
    }

    if (authForm) {
        authForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const inputVal = portalPassInput ? portalPassInput.value.trim() : '';
            const currentPass = state.settings.portalPasscode || "1234";

            if (inputVal === currentPass) {
                state.setAuth(true);
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
        lockBtn.addEventListener('click', () => {
            state.setAuth(false);
            checkPortalAuth();
        });
    }

    // Initial check
    checkPortalAuth();

    return { checkPortalAuth };
}
