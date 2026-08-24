// Hikvision Security Monitor ISAPI Snapshot Refresher
import { state } from './state.js';

export function initCCTV() {
    let intervals = [];

    const grid = document.getElementById('cctv-grid');

    function stopIntervals() {
        intervals.forEach(clearInterval);
        intervals = [];
    }

    function getCctvImageUrl(channel) {
        if (!state.settings.nvrHost) return '';
        let hostClean = state.settings.nvrHost.replace(/\/+$/, '');
        let urlBase = hostClean.replace(/^https?:\/\//, '');
        let protocol = hostClean.startsWith('https') ? 'https://' : 'http://';
        
        let credentials = '';
        if (state.settings.nvrUser && state.settings.nvrPass) {
            credentials = `${encodeURIComponent(state.settings.nvrUser)}:${encodeURIComponent(state.settings.nvrPass)}@`;
        }
        return `${protocol}${credentials}${urlBase}/ISAPI/Streaming/channels/${encodeURIComponent(channel)}/picture`;
    }

    function renderPlaceholder() {
        if (!grid) return;
        grid.innerHTML = `
            <div class="placeholder-card">
                <i class="fa-solid fa-video-slash"></i>
                <p>Security monitoring is disabled. Enable CCTV in Settings to view live camera feeds.</p>
            </div>
        `;
    }

    function init() {
        stopIntervals();

        if (!grid) return;
        grid.innerHTML = '';

        if (!state.settings.cctvEnabled || !state.settings.nvrHost || !state.isAuth()) {
            renderPlaceholder();
            return;
        }

        const channels = (state.settings.nvrChannels || "101,201").split(',').map(c => c.trim()).filter(c => c.length > 0);

        channels.forEach(channel => {
            const card = document.createElement('div');
            card.className = 'cctv-card';
            
            card.innerHTML = `
                <div class="cctv-feed-container" style="cursor: pointer;" data-channel="${channel}">
                    <img class="cctv-feed-img" id="cam-${channel}" alt="Camera ${channel}">
                    <div class="cctv-feed-placeholder" id="cam-place-${channel}">
                        <i class="fa-solid fa-circle-notch fa-spin"></i><span>Loading Feed...</span>
                    </div>
                    <div class="cctv-feed-overlay">
                        <span class="cctv-status-dot"></span><span>CAM ${escapeHTML(channel)}</span>
                    </div>
                </div>
                <div class="cctv-meta">
                    <span class="cctv-name">Channel ${escapeHTML(channel)}</span>
                    <button type="button" class="cctv-refresh-btn" data-channel="${channel}" aria-label="Refresh Camera">
                        <i class="fa-solid fa-arrows-rotate"></i>
                    </button>
                </div>
            `;

            grid.appendChild(card);

            const img = card.querySelector(`#cam-${channel}`);
            const placeholder = card.querySelector(`#cam-place-${channel}`);
            const feedContainer = card.querySelector(`.cctv-feed-container`);
            const refreshBtn = card.querySelector(`.cctv-refresh-btn`);

            if (img && placeholder) {
                img.onload = () => placeholder.classList.add('hidden');
                img.onerror = () => {
                    placeholder.classList.remove('hidden');
                    placeholder.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="color: #f87171;"></i><span style="color: #f87171;">Offline</span>`;
                };
            }

            if (feedContainer) {
                feedContainer.addEventListener('click', () => {
                    const url = getCctvImageUrl(channel);
                    if (url) window.open(url, '_blank');
                });
            }

            if (refreshBtn) {
                refreshBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (img) {
                        if (placeholder) placeholder.classList.remove('hidden');
                        img.src = `${getCctvImageUrl(channel)}?t=${Date.now()}`;
                    }
                });
            }

            const updateImage = () => {
                if (state.settings.cctvEnabled && state.isAuth() && img) {
                    img.src = `${getCctvImageUrl(channel)}?t=${Date.now()}`;
                }
            };

            updateImage();
            const interval = setInterval(updateImage, 1500);
            intervals.push(interval);
        });
    }

    function escapeHTML(str) {
        if (typeof str !== 'string') return '';
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    init();

    return { init, stopIntervals };
}
