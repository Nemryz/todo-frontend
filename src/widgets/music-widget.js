import { showToast } from '../components/toast.js';

const STORAGE_KEY = 'todo-music-state';
let container = null;

function getState() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
    catch { return {}; }
}

function saveState(s) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

function render(playerEl) {
    container = playerEl;
    const state = getState();

    container.innerHTML = `
        <div class="music-widget">
            <div class="music-header">
                <span class="music-title">🎵 Música</span>
                <div class="music-search-row">
                    <input type="text" class="music-search" placeholder="Buscar en YouTube..." value="${state.lastSearch || ''}">
                    <button class="music-search-btn" title="Buscar">🔍</button>
                </div>
                <div class="music-search-hint">Pega URL/ID de YouTube para reproducir o busca por nombre</div>
            </div>
            <div class="music-player-area">
                <div id="music-youtube-player" class="music-youtube-player">
                    ${state.videoId ? `<iframe width="100%" height="100%" src="https://www.youtube.com/embed/${state.videoId}?autoplay=1&rel=0" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>` : ''}
                </div>
            </div>
            <div class="music-playlists">
                <div class="music-playlist-header">
                    <span>Playlists</span>
                    <button class="music-add-playlist" title="Nueva playlist">+</button>
                </div>
                <div class="music-playlist-list" id="music-playlist-list"></div>
            </div>
        </div>
    `;

    const searchInput = container.querySelector('.music-search');
    const searchBtn = container.querySelector('.music-search-btn');
    const addPlaylistBtn = container.querySelector('.music-add-playlist');

    searchBtn.addEventListener('click', () => handleSearch(searchInput.value));
    searchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleSearch(searchInput.value); });
    searchInput.addEventListener('paste', () => {
        setTimeout(() => {
            const val = searchInput.value.trim();
            const vid = extractVideoId(val);
            if (vid) embedVideo(vid);
        }, 50);
    });

    addPlaylistBtn.addEventListener('click', () => {
        const name = prompt('Nombre de la playlist:');
        if (name) {
            const playlists = getState().playlists || [];
            playlists.push({ name, videos: [] });
            saveState({ ...getState(), playlists });
            renderPlaylists();
        }
    });

    renderPlaylists();
}

function embedVideo(videoId) {
    const el = document.getElementById('music-youtube-player');
    if (!el) return;
    currentVideoId = videoId;
    saveState({ ...getState(), videoId });
    el.innerHTML = `<iframe width="100%" height="100%" src="https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>`;
}

let currentVideoId = '';

function handleSearch(query) {
    if (!query) return;
    const vid = extractVideoId(query);
    if (vid) {
        embedVideo(vid);
        return;
    }
    searchYouTube(query);
}

function extractVideoId(input) {
    if (!input) return null;
    const trimmed = input.trim();
    if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
    const match = trimmed.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})(?:[?&#/]|$)/);
    return match ? match[1] : null;
}

function searchYouTube(query) {
    if (!query) return;
    saveState({ ...getState(), lastSearch: query });
    window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`, '_blank');
}

function renderPlaylists() {
    const list = container?.querySelector('#music-playlist-list');
    if (!list) return;
    const state = getState();
    const playlists = state.playlists || [];
    list.innerHTML = playlists.map((pl) => `
        <div class="music-playlist-item">
            <span>${escapeHTML(pl.name)}</span>
            <span class="music-playlist-count">${pl.videos.length}</span>
        </div>
    `).join('');
}

function escapeHTML(str) {
    return String(str).replace(/[&<>'"]/g, tag =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
}

export const widget = {
    name: 'Música',
    icon: '🎵',
    side: 'left',
    defaultEnabled: false,
    render,
};
