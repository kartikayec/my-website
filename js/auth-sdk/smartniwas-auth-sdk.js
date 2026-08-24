// SmartNiwas Universal Client Auth SDK
(function(window) {
    'use strict';

    // Relative path for native deployment on smartniwas.com and www.smartniwas.com
    const API_BASE = '/api/auth';

    const SmartNiwasAuth = {
        currentUser: null,
        options: {},

        init: async function(options = {}) {
            this.options = options;
            return await this.checkSession();
        },

        checkSession: async function() {
            try {
                const res = await fetch(`${API_BASE}/me`, { credentials: 'include' });
                const data = await res.json();
                if (data.authenticated && data.user) {
                    this.currentUser = data.user;
                    if (this.options.onAuthSuccess) this.options.onAuthSuccess(data.user);
                    return data.user;
                } else {
                    this.currentUser = null;
                    if (this.options.onAuthRequired) this.options.onAuthRequired();
                    return null;
                }
            } catch (err) {
                this.currentUser = null;
                if (this.options.onAuthRequired) this.options.onAuthRequired();
                return null;
            }
        },

        login: async function(email, password) {
            const res = await fetch(`${API_BASE}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ email, password })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Login failed.');
            
            this.currentUser = data.user;
            if (this.options.onAuthSuccess) this.options.onAuthSuccess(data.user);
            return data;
        },

        logout: async function() {
            try {
                await fetch(`${API_BASE}/logout`, { method: 'POST', credentials: 'include' });
            } catch (e) {}
            this.currentUser = null;
            if (this.options.onAuthRequired) this.options.onAuthRequired();
        },

        inviteUser: async function(email, role = 'regular') {
            const res = await fetch(`${API_BASE}/invite`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ email, role })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'User invite failed.');
            return data;
        },

        requestPasswordReset: async function(email, turnstileToken = '') {
            const res = await fetch(`${API_BASE}/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ email, turnstileToken })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Password reset request failed.');
            return data;
        },

        resetPassword: async function(resetToken, newPassword, confirmPassword) {
            const res = await fetch(`${API_BASE}/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ resetToken, newPassword, confirmPassword })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Password reset failed.');
            return data;
        },

        changePassword: async function(currentPassword, newPassword, confirmPassword) {
            const res = await fetch(`${API_BASE}/change-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ currentPassword, newPassword, confirmPassword })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Password change failed.');
            return data;
        }
    };

    window.SmartNiwasAuth = SmartNiwasAuth;
})(window);
