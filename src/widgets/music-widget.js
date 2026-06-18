import { showToast } from '../components/toast.js';

const STORAGE_KEY = 'todo-music-state';
let player = null;
let container = null;
let currentVideoId = '';
let isPlaying = false;
let _ytPromise = null;
let _loading = false;

function getState() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
    catch { return {}; }
}

function saveState(s) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

function loadYouTubeAPI() {
    if (window.YT) return Promise.resolve();
    if (_ytPromise) return _ytPromise;
    _ytPromise = new Promise((resolve, reject) => {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        tag.async = true;
        const first = document.getElementsByTagName('script')[0];
        first.parentNode.insertBefore(tag, first);
        const timeout = setTimeout(() => {
            _ytPromise = null;
            reject(new Error('Timeout'));
        }, 10000);
        window.onYouTubeIframeAPIReady = () => {
            clearTimeout(timeout);
            resolve();
        };
    });
    return _ytPromise;
}

function playPauseHTML(playing) {
    if (playing) {
        return '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><rect x="3" y="2" width="4" height="12" rx="1"/><rect x="9" y="2" width="4" height="12" rx="1"/></svg>';
    }
    return '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><polygon points="3,1 14,8 3,15"/></svg>';
}

function render(playerEl) {
    container = playerEl;
    const state = getState();
    currentVideoId = state.videoId || '';

    container.innerHTML = `
        <div class="music-widget">
            <div class="music-header">
                <span class="music-title">🎵 Música</span>
                <div class="music-search-row">
                    <input type="text" class="music-search" placeholder="Buscar en YouTube..." value="${state.lastSearch || ''}">
                    <button class="music-search-btn" title="Buscar">🔍</button>
                </div>
                <div class="music-search-hint">Pega URL/ID de YouTube o busca por nombre</div>
            </div>
            <div class="music-player-area">
                <div id="music-youtube-player" class="music-youtube-player"></div>
                <div class="music-controls">
                    <button class="music-btn music-prev" title="Anterior">⏮</button>
                    <button class="music-btn music-play-pause" title="Play/Pause">${playPauseHTML(isPlaying)}</button>
                    <button class="music-btn music-next" title="Siguiente">⏭</button>
                    <input type="range" class="music-volume" min="0" max="100" value="${state.volume ?? 50}">
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
    const playBtn = container.querySelector('.music-play-pause');
    const prevBtn = container.querySelector('.music-prev');
    const nextBtn = container.querySelector('.music-next');
    const volumeSlider = container.querySelector('.music-volume');
    const addPlaylistBtn = container.querySelector('.music-add-playlist');

    searchBtn.addEventListener('click', () => handleSearch(searchInput.value));
    searchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleSearch(searchInput.value); });
    searchInput.addEventListener('paste', () => {
        if (_loading) return;
        setTimeout(() => {
            const val = searchInput.value.trim();
            const vid = extractVideoId(val);
            if (vid) playVideo(vid);
        }, 50);
    });

    playBtn.addEventListener('click', togglePlay);
    prevBtn.addEventListener('click', () => { });
    nextBtn.addEventListener('click', () => { });

    volumeSlider.addEventListener('input', () => {
        const v = parseInt(volumeSlider.value);
        if (player) player.setVolume(v);
        saveState({ ...getState(), volume: v });
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

    if (currentVideoId) {
        initPlayer(currentVideoId);
    }

    renderPlaylists();
}

const ERROR_MSG = {
    2: 'ID de video no válido',
    5: 'Error de reproducción (HTML5 player)',
    100: 'Video no encontrado o eliminado',
    101: 'El video no permite reproducción embebida',
    150: 'El video no permite reproducción embebida',
};

function initPlayer(videoId) {
    if (_loading) return;
    if (player) {
        player.loadVideoById(videoId);
        return;
    }
    _loading = true;
    loadYouTubeAPI().then(() => {
        try {
            player = new YT.Player('music-youtube-player', {
                videoId,
                height: 180,
                width: '100%',
                playerVars: {
                    autoplay: 1,
                    controls: 0,
                    modestbranding: 1,
                    rel: 0,
                },
                events: {
                    onReady: () => {
                        _loading = false;
                        const vol = getState().volume ?? 50;
                        player.setVolume(vol);
                    },
                    onStateChange: (e) => {
                        isPlaying = e.data === YT.PlayerState.PLAYING;
                        const btn = container?.querySelector('.music-play-pause');
                        if (btn) btn.innerHTML = playPauseHTML(isPlaying);
                    },
                    onError: (e) => {
                        _loading = false;
                        const msg = ERROR_MSG[e.data] || 'Error desconocido al reproducir';
                        showToast(msg, 'error');
                    },
                },
            });
        } catch (err) {
            _loading = false;
            player = null;
            showToast('Error al crear el reproductor', 'error');
        }
    }).catch(() => {
        _loading = false;
        _ytPromise = null;
        showToast('La API de YouTube no está disponible', 'error');
    });
}

function handleSearch(query) {
    if (!query) return;
    const vid = extractVideoId(query);
    if (vid) {
        playVideo(vid);
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

function togglePlay() {
    if (player) {
        if (isPlaying) player.pauseVideo();
        else player.playVideo();
    }
}

function playVideo(videoId) {
    currentVideoId = videoId;
    saveState({ ...getState(), videoId });
    initPlayer(videoId);
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
