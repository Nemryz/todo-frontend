import { showToast } from '../components/toast.js';
import { icon } from '../icons.js';

const STORAGE_KEY = 'todo-music-state';
let CONTAINER = null;
let YT_API_KEY = '';
let CURRENT_VIDEO = null;
let PLAYING = false;
let SEARCH_ABORT = null;

function getState() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
    catch { return {}; }
}

function saveState(s) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

function renderWidget() {
    const state = getState();
    const hasVideo = !!state.videoId;

    CONTAINER.innerHTML = `
        <div class="music-widget">
            <div class="music-header">
                <div class="music-title">${icon('music', 18)} Música</div>
                <div class="music-search-row">
                    <input type="text" class="music-search" placeholder="Buscar o pegar URL de YouTube..." value="${escapeHTML(state.lastSearch || '')}" autocomplete="off">
                    <button class="music-search-btn" title="Buscar">${icon('search', 18)}</button>
                </div>
            </div>

            <div class="music-player-area">
                <div class="music-no-video" style="${hasVideo ? 'display:none;' : ''}">
                    <span class="music-no-video-text">Busca un video o pega un enlace de YouTube</span>
                </div>

                <div class="music-player-thumbnail" style="${hasVideo ? '' : 'display:none;'}">
                    <div class="music-thumb-wrapper">
                        <img class="music-thumb-img" src="https://img.youtube.com/vi/${state.videoId}/maxresdefault.jpg" alt="">
                        <button class="music-play-overlay" title="Reproducir">
                            <svg viewBox="0 0 24 24" width="48" height="48"><polygon points="8,5 20,12 8,19" fill="white"/></svg>
                        </button>
                    </div>
                    <div class="music-video-info">
                        <div class="music-video-title">${escapeHTML(state.videoTitle || state.videoId || '')}</div>
                        <div class="music-video-channel">${escapeHTML(state.videoChannel || '')}</div>
                    </div>
                    <div class="music-video-actions">
                        <button class="music-btn-playlist-add" title="Agregar a playlist">${icon('plus', 18)}</button>
                        <button class="music-open-yt">Abrir en YouTube ↗</button>
                        <button class="music-clear-btn">${icon('x', 12)} Cerrar</button>
                    </div>
                </div>

                <div class="music-youtube-player" style="display:none;">
                    <div class="music-player-header">
                        <span class="music-player-title">${escapeHTML(state.videoTitle || '')}</span>
                        <div class="music-player-header-actions">
                            <button class="music-open-yt-small" title="Abrir en YouTube">↗</button>
                            <button class="music-close-player" title="Cerrar">${icon('x', 14)}</button>
                        </div>
                    </div>
                    <div class="music-player-iframe-wrap">
                        <iframe width="100%" height="100%" src="" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>
                    </div>
                </div>
            </div>

            <div class="music-search-results" style="display:none;"></div>

            <div class="music-playlists">
                <div class="music-playlist-header">
                    <span>Playlists</span>
                    <button class="music-add-playlist" title="Nueva playlist">+</button>
                </div>
                <div class="music-playlist-list"></div>
            </div>
        </div>
    `;

    const img = CONTAINER.querySelector('.music-thumb-img');
    if (img) {
        img.onerror = function () {
            if (!this.dataset.fallback) {
                this.dataset.fallback = '1';
                this.src = `https://img.youtube.com/vi/${state.videoId}/hqdefault.jpg`;
            }
        };
    }

    bindEvents();

    if (state.videoId) {
        CURRENT_VIDEO = { id: state.videoId, title: state.videoTitle || state.videoId, channel: state.videoChannel || '' };
    }

    renderPlaylists();
}

function bindEvents() {
    const searchInput = CONTAINER.querySelector('.music-search');
    const searchBtn = CONTAINER.querySelector('.music-search-btn');
    const playOverlay = CONTAINER.querySelector('.music-play-overlay');
    const openYt = CONTAINER.querySelector('.music-open-yt');
    const clearBtn = CONTAINER.querySelector('.music-clear-btn');
    const closePlayer = CONTAINER.querySelector('.music-close-player');
    const addPlaylist = CONTAINER.querySelector('.music-add-playlist');
    const playlistAddBtn = CONTAINER.querySelector('.music-btn-playlist-add');
    const openYtSmall = CONTAINER.querySelector('.music-open-yt-small');

    searchBtn.addEventListener('click', () => handleSearch(searchInput.value));
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleSearch(searchInput.value);
    });
    searchInput.addEventListener('paste', () => {
        setTimeout(() => {
            const val = searchInput.value.trim();
            if (extractVideoId(val)) {
                handlePaste(val);
                const results = CONTAINER.querySelector('.music-search-results');
                if (results) results.style.display = 'none';
            }
        }, 50);
    });

    if (playOverlay) playOverlay.addEventListener('click', playCurrentVideo);
    if (openYt) openYt.addEventListener('click', openInYT);
    if (clearBtn) clearBtn.addEventListener('click', clearVideo);
    if (closePlayer) closePlayer.addEventListener('click', stopVideo);
    if (openYtSmall) openYtSmall.addEventListener('click', openInYT);

    if (playlistAddBtn) {
        playlistAddBtn.addEventListener('click', () => {
            if (!CURRENT_VIDEO) return;
            const state = getState();
            const playlists = state.playlists || [];
            if (!playlists.length) {
                const name = prompt('Nombre de la nueva playlist:');
                if (!name) return;
                playlists.push({ name, videos: [] });
            }
            let target = playlists[playlists.length - 1];
            if (playlists.length > 1) {
                const names = playlists.map((p, i) => `${i + 1}. ${p.name}`).join('\n');
                const choice = prompt(`Elige playlist (número) o escribe un nombre nuevo:\n${names}\n\nNueva: escribe cualquier otro nombre`);
                if (!choice) return;
                const num = parseInt(choice);
                if (num > 0 && num <= playlists.length) {
                    target = playlists[num - 1];
                } else {
                    playlists.push({ name: choice, videos: [] });
                    target = playlists[playlists.length - 1];
                }
            }
            const exists = target.videos.some(v => v.id === CURRENT_VIDEO.id);
            if (exists) { showToast('El video ya está en la playlist', 'info'); return; }
            target.videos.push({
                id: CURRENT_VIDEO.id,
                title: CURRENT_VIDEO.title,
                channel: CURRENT_VIDEO.channel,
            });
            saveState({ ...getState(), playlists });
            renderPlaylists();
            showToast('Video agregado a playlist', 'success');
        });
    }

    if (addPlaylist) {
        addPlaylist.addEventListener('click', () => {
            const name = prompt('Nombre de la playlist:');
            if (name) {
                const state = getState();
                const playlists = state.playlists || [];
                playlists.push({ name, videos: [] });
                saveState({ ...state, playlists });
                renderPlaylists();
            }
        });
    }
}

function openInYT() {
    if (CURRENT_VIDEO) window.open(`https://youtu.be/${CURRENT_VIDEO.id}`, '_blank');
}

async function handlePaste(value) {
    const vid = extractVideoId(value);
    if (!vid) return;

    embedVideo(vid);
    saveState({ ...getState(), lastSearch: value });

    const info = await fetchVideoInfo(vid);
    if (info) {
        CURRENT_VIDEO = { id: vid, title: info.title, channel: info.channel };
        const state = getState();
        saveState({ ...state, videoId: vid, videoTitle: info.title, videoChannel: info.channel });
        updateVideoMeta(info.title, info.channel);
    }
}

function handleSearch(query) {
    if (!query.trim()) return;

    const vid = extractVideoId(query);
    if (vid) {
        handlePaste(query);
        return;
    }

    saveState({ ...getState(), lastSearch: query });

    if (!YT_API_KEY) {
        window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`, '_blank');
        return;
    }

    searchYouTubeAPI(query);
}

async function searchYouTubeAPI(query) {
    const resultsEl = CONTAINER.querySelector('.music-search-results');
    if (!resultsEl) return;

    if (SEARCH_ABORT) SEARCH_ABORT.abort();
    SEARCH_ABORT = new AbortController();

    resultsEl.innerHTML = '<div class="music-search-loading">Buscando...</div>';
    resultsEl.style.display = 'block';

    try {
        const res = await fetch(
            `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&key=${YT_API_KEY}&maxResults=10&type=video`,
            { signal: SEARCH_ABORT.signal }
        );
        if (!res.ok) throw new Error('API error');
        const data = await res.json();

        if (!data.items?.length) {
            resultsEl.innerHTML = '<div class="music-search-empty">Sin resultados</div>';
            return;
        }

        renderSearchResults(data.items, resultsEl);
    } catch (err) {
        if (err.name === 'AbortError') return;
        resultsEl.innerHTML = '<div class="music-search-empty">Error al buscar. Intenta de nuevo.</div>';
    }
}

function renderSearchResults(items, container) {
    container.innerHTML = items.map(item => {
        const id = item.id.videoId;
        const t = item.snippet;
        const thumb = t.thumbnails.default?.url || '';
        const title = t.title || '';
        const channel = t.channelTitle || '';
        return `
            <div class="music-search-result" data-video-id="${escapeHTML(id)}" data-title="${escapeHTML(title)}" data-channel="${escapeHTML(channel)}">
                <img class="music-result-img" src="${escapeHTML(thumb)}" alt="" loading="lazy">
                <div class="music-result-info">
                    <div class="music-result-title">${escapeHTML(title)}</div>
                    <div class="music-result-channel">${escapeHTML(channel)}</div>
                </div>
                <button class="music-result-play">▶</button>
            </div>
        `;
    }).join('');

    container.querySelectorAll('.music-search-result').forEach(el => {
        el.addEventListener('click', () => {
            const id = el.dataset.videoId;
            const title = el.dataset.title;
            const channel = el.dataset.channel;
            embedVideo(id, title, channel);
            const state = getState();
            saveState({ ...state, videoId: id, videoTitle: title, videoChannel: channel });
            container.style.display = 'none';
            const searchInput = CONTAINER.querySelector('.music-search');
            if (searchInput) searchInput.value = title;
        });
    });
}

function embedVideo(videoId, title, channel) {
    const noVideo = CONTAINER.querySelector('.music-no-video');
    const thumbnail = CONTAINER.querySelector('.music-player-thumbnail');
    const player = CONTAINER.querySelector('.music-youtube-player');

    if (noVideo) noVideo.style.display = 'none';

    CURRENT_VIDEO = { id: videoId, title: title || videoId, channel: channel || '' };
    PLAYING = false;

    if (thumbnail) {
        thumbnail.style.display = '';
        const img = thumbnail.querySelector('.music-thumb-img');
        if (img) {
            img.dataset.fallback = '';
            img.src = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
            img.onerror = function () {
                if (!this.dataset.fallback) {
                    this.dataset.fallback = '1';
                    this.src = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
                }
            };
        }
        const titleEl = thumbnail.querySelector('.music-video-title');
        const channelEl = thumbnail.querySelector('.music-video-channel');
        if (titleEl) titleEl.textContent = title || videoId;
        if (channelEl) channelEl.textContent = channel || '';
    }

    if (player) {
        const iframe = player.querySelector('iframe');
        if (iframe) iframe.src = '';
        player.style.display = 'none';
    }
}

function updateVideoMeta(title, channel) {
    const titleEl = CONTAINER.querySelector('.music-video-title');
    const channelEl = CONTAINER.querySelector('.music-video-channel');
    const playerTitle = CONTAINER.querySelector('.music-player-title');
    if (titleEl) titleEl.textContent = title;
    if (channelEl) channelEl.textContent = channel;
    if (playerTitle) playerTitle.textContent = title;
}

function playCurrentVideo() {
    if (!CURRENT_VIDEO) return;
    const thumbnail = CONTAINER.querySelector('.music-player-thumbnail');
    const player = CONTAINER.querySelector('.music-youtube-player');
    const iframe = player?.querySelector('iframe');
    if (!player || !iframe) return;

    thumbnail.style.display = 'none';
    player.style.display = 'flex';
    iframe.src = `https://www.youtube.com/embed/${CURRENT_VIDEO.id}?autoplay=1&rel=0`;
    PLAYING = true;
}

function stopVideo() {
    const thumbnail = CONTAINER.querySelector('.music-player-thumbnail');
    const player = CONTAINER.querySelector('.music-youtube-player');
    const iframe = player?.querySelector('iframe');
    if (!player || !thumbnail) return;

    if (iframe) iframe.src = '';
    player.style.display = 'none';
    thumbnail.style.display = '';
    PLAYING = false;
}

function clearVideo() {
    stopVideo();
    CURRENT_VIDEO = null;
    PLAYING = false;

    const noVideo = CONTAINER.querySelector('.music-no-video');
    const thumbnail = CONTAINER.querySelector('.music-player-thumbnail');
    if (noVideo) noVideo.style.display = '';
    if (thumbnail) thumbnail.style.display = 'none';

    saveState({ ...getState(), videoId: null, videoTitle: null, videoChannel: null });
}

function extractVideoId(input) {
    if (!input) return null;
    const trimmed = input.trim();
    if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
    const match = trimmed.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})(?:[?&#/]|$)/);
    return match ? match[1] : null;
}

async function fetchVideoInfo(videoId) {
    if (!YT_API_KEY) return null;
    try {
        const res = await fetch(
            `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${YT_API_KEY}`
        );
        if (!res.ok) return null;
        const data = await res.json();
        if (!data.items?.length) return null;
        return {
            title: data.items[0].snippet.title,
            channel: data.items[0].snippet.channelTitle,
        };
    } catch {
        return null;
    }
}

function renderPlaylists() {
    const list = CONTAINER?.querySelector('.music-playlist-list');
    if (!list) return;
    const state = getState();
    const playlists = state.playlists || [];
    list.innerHTML = playlists.map((pl, i) => `
        <div class="music-playlist-item" data-index="${i}">
            <span class="music-playlist-name">${escapeHTML(pl.name)}</span>
            <span class="music-playlist-count">${pl.videos.length}</span>
        </div>
        <div class="music-playlist-videos" data-playlist="${i}" style="display:none;"></div>
    `).join('');

    list.querySelectorAll('.music-playlist-item').forEach(item => {
        item.addEventListener('click', () => {
            const idx = parseInt(item.dataset.index);
            const vidsEl = list.querySelector(`.music-playlist-videos[data-playlist="${idx}"]`);
            if (!vidsEl) return;
            const shown = vidsEl.style.display === 'block';
            if (shown) { vidsEl.style.display = 'none'; return; }

            const pl = (getState().playlists || [])[idx];
            if (!pl?.videos?.length) {
                vidsEl.style.display = 'none';
                showToast('Playlist vacía', 'info');
                return;
            }

            vidsEl.innerHTML = pl.videos.map((v, vi) => `
                <div class="music-playlist-video" data-playlist="${idx}" data-video-idx="${vi}">
                    <span class="music-pl-video-title">${escapeHTML(v.title || v.id)}</span>
                    <button class="music-pl-video-del" title="Quitar de playlist">${icon('x', 12)}</button>
                </div>
            `).join('');

            vidsEl.querySelectorAll('.music-playlist-video').forEach(vEl => {
                vEl.addEventListener('click', (e) => {
                    if (e.target.closest('.music-pl-video-del')) return;
                    const videoList = (getState().playlists || [])[parseInt(vEl.dataset.playlist)]?.videos || [];
                    const video = videoList[parseInt(vEl.dataset.videoIdx)];
                    if (video) {
                        embedVideo(video.id, video.title, video.channel);
                        saveState({ ...getState(), videoId: video.id, videoTitle: video.title, videoChannel: video.channel });
                    }
                });
                const del = vEl.querySelector('.music-pl-video-del');
                if (del) {
                    del.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const pIdx = parseInt(vEl.dataset.playlist);
                        const vIdx = parseInt(vEl.dataset.videoIdx);
                        const state = getState();
                        const pl = (state.playlists || [])[pIdx];
                        if (pl) {
                            pl.videos.splice(vIdx, 1);
                            saveState(state);
                            renderPlaylists();
                        }
                    });
                }
            });

            vidsEl.style.display = 'block';
        });
    });
}

function escapeHTML(str) {
    return String(str).replace(/[&<>'"]/g, tag =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
}

export const widget = {
    name: 'Música',
    icon: icon('music'),
    side: 'left',
    defaultEnabled: false,
    render: (el, options = {}) => {
        CONTAINER = el;
        YT_API_KEY = options.youtubeApiKey || '';
        renderWidget();
    },
};
