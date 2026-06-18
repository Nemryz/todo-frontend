// Las credenciales se cargan desde /api/config (Vercel serverless)
// — nunca aparecen hardcodeadas en este archivo
let sb, API_URL;

async function loadConfig() {
    const res = await fetch('/api/config');
    if (!res.ok) throw new Error('No se pudo cargar la configuración del servidor');
    const { supabaseUrl, supabaseAnonKey, apiUrl } = await res.json();
    API_URL = apiUrl;
    sb = supabase.createClient(supabaseUrl, supabaseAnonKey);
}

document.addEventListener('DOMContentLoaded', async () => {
    try {
        await loadConfig();
    } catch (err) {
        document.body.innerHTML = `<div style="color:#ef4444;text-align:center;padding:2rem">
            Error al iniciar la aplicación. Recarga la página.<br><small>${err.message}</small>
        </div>`;
        return;
    }



    // ─── DOM refs ───────────────────────────────────────────
    const form          = document.getElementById('todo-form');
    const input         = document.getElementById('todo-input');
    const todoList      = document.getElementById('todo-list');
    const taskCount     = document.getElementById('task-count');
    const filterBtns    = document.querySelectorAll('.filter-btn');
    const progressBar   = document.getElementById('progress-bar');
    const progressLabel = document.getElementById('progress-label');
    const progressPct   = document.getElementById('progress-pct');
    const listControls  = document.getElementById('list-controls');
    const toggleAllBtn  = document.getElementById('toggle-all-btn');
    const clearBtn      = document.getElementById('clear-btn');
    const searchInput   = document.getElementById('search-input');
    const badgeAll      = document.getElementById('badge-all');
    const badgePending  = document.getElementById('badge-pending');
    const badgeDone     = document.getElementById('badge-done');
    const charCounter   = document.getElementById('char-counter');
    const datePreview   = document.getElementById('date-preview');
    const sortSelect    = document.getElementById('sort-select');
    const viewToggle    = document.getElementById('view-toggle');
    const statsPanel    = document.getElementById('stats-panel');
    const btnStats      = document.getElementById('btn-stats');
    const btnTypography = document.getElementById('btn-typography');
    const btnPomodoro   = document.getElementById('btn-pomodoro');
    const btnCompact    = document.getElementById('btn-compact');

    // Auth
    const authModal     = document.getElementById('auth-modal');
    const authEmail     = document.getElementById('auth-email');
    const authPassword  = document.getElementById('auth-password');
    const authError     = document.getElementById('auth-error');
    const btnLogin      = document.getElementById('btn-login');
    const btnRegister   = document.getElementById('btn-register');
    const btnMagic      = document.getElementById('btn-magic');
    const btnForgot     = document.getElementById('btn-forgot');
    const btnLogout     = document.getElementById('btn-logout');
    const appDiv        = document.getElementById('app');

    // Reset password modal
    const resetModal      = document.getElementById('reset-modal');
    const resetPasswordIn = document.getElementById('reset-password');
    const resetConfirmIn  = document.getElementById('reset-confirm');
    const btnResetSubmit  = document.getElementById('btn-reset-submit');
    const resetError      = document.getElementById('reset-error');

    // Import
    const importJsonBtn = document.getElementById('import-json-btn');
    const importFile    = document.getElementById('import-file');

    // Modales
    const shortcutsModal  = document.getElementById('shortcuts-modal');
    const closeShortcuts  = document.getElementById('close-shortcuts');
    const btnShortcuts    = document.getElementById('btn-shortcuts');
    const exportModal     = document.getElementById('export-modal');
    const closeExport     = document.getElementById('close-export');
    const btnExport       = document.getElementById('btn-export');
    const exportJson      = document.getElementById('export-json');
    const exportCsv       = document.getElementById('export-csv');
    const exportMd        = document.getElementById('export-md');
    const typographyModal = document.getElementById('typography-modal');
    const closeTypography = document.getElementById('close-typography');

    // Command palette
    const commandPalette = document.getElementById('command-palette');
    const commandInput   = document.getElementById('command-input');
    const commandResults = document.getElementById('command-results');

    // Pomodoro
    const pomodoroBar        = document.getElementById('pomodoro-bar');
    const pomodoroTimeEl     = document.getElementById('pomodoro-time');
    const pomodoroPhaseIcon  = document.getElementById('pomodoro-phase-icon');
    const pomodoroPhaseLabel = document.getElementById('pomodoro-phase-label');
    const pomodoroStop       = document.getElementById('pomodoro-stop');

    // ─── Estado ─────────────────────────────────────────────
    let allTasks        = [];
    let activeFilter    = 'all';
    let showArchived    = false;
    let searchQuery     = '';
    let sortOrder       = 'default';
    let confirmTimer    = null;
    let completedStreak = 0;
    let currentSession  = null;
    let focusMode       = false;
    let undoStack       = [];
    let viewMode        = localStorage.getItem('todo-view') || 'list';
    let statsVisible    = false;
    let activeTag       = null;
    let compactMode     = localStorage.getItem('todo-compact') === 'true';
    let audioCtx        = null;

    // Pomodoro state
    let pomodoroInterval  = null;
    let pomodoroRemaining = 25 * 60;
    let pomodoroPhase     = 'work'; // 'work' | 'break' | 'focus'
    let pomodoroCompleted = 0;
    const PHASES = {
        work:  { secs: 25 * 60, label: 'Trabajo', icon: '🍅', next: 'break' },
        break: { secs:  5 * 60, label: 'Descanso', icon: '☕', next: 'focus' },
        focus: { secs:  5 * 60, label: 'Repaso',  icon: '🔍', next: 'work' },
    };

    // ─────────────────────────────────────────────
    // TOAST
    // ─────────────────────────────────────────────
    const toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container';
    document.body.appendChild(toastContainer);

    function showToast(message, type = 'info', actionLabel = null, actionFn = null) {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        const icons = { success: '✅', error: '🚨', info: '💡', warning: '⚠️', magic: '✨', fire: '🔥' };
        let html = `<span>${icons[type] || icons.info}</span><span>${message}</span>`;
        if (actionLabel && actionFn) html += `<button class="toast-action">${actionLabel}</button>`;
        toast.innerHTML = html;

        if (actionLabel && actionFn) {
            toast.querySelector('.toast-action').addEventListener('click', () => {
                actionFn();
                dismiss(toast);
            });
        }
        toastContainer.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add('show'));
        const t = setTimeout(() => dismiss(toast), 4000);
        toast.addEventListener('click', (e) => {
            if (!e.target.classList.contains('toast-action')) { clearTimeout(t); dismiss(toast); }
        });
    }

    function dismiss(toast) {
        toast.classList.remove('show');
        toast.classList.add('hide');
        toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    }

    // ─────────────────────────────────────────────
    // SONIDOS (Web Audio API)
    // ─────────────────────────────────────────────
    function getAudioCtx() {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        return audioCtx;
    }

    function playSound(type) {
        try {
            const ctx = getAudioCtx();
            const g = ctx.createGain();
            g.connect(ctx.destination);
            const sounds = {
                add:      [{ f: 520, t: 0,    dur: 0.08 }, { f: 660, t: 0.08, dur: 0.1 }],
                complete: [{ f: 440, t: 0,    dur: 0.08 }, { f: 550, t: 0.08, dur: 0.08 }, { f: 660, t: 0.16, dur: 0.12 }],
                delete:   [{ f: 330, t: 0,    dur: 0.06 }, { f: 260, t: 0.07, dur: 0.1 }],
                phase:    [{ f: 528, t: 0,    dur: 0.1  }, { f: 528, t: 0.12, dur: 0.1  }, { f: 660, t: 0.25, dur: 0.2 }],
            };
            (sounds[type] || sounds.add).forEach(({ f, t, dur }) => {
                const osc = ctx.createOscillator();
                const og  = ctx.createGain();
                osc.connect(og); og.connect(g);
                osc.type = 'sine';
                osc.frequency.value = f;
                og.gain.setValueAtTime(0.18, ctx.currentTime + t);
                og.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + dur);
                osc.start(ctx.currentTime + t);
                osc.stop(ctx.currentTime + t + dur + 0.02);
            });
        } catch { /* AudioContext no disponible */ }
    }

    // ─────────────────────────────────────────────
    // AUTH ERRORS
    // ─────────────────────────────────────────────
    function translateAuthError(error) {
        const msg = (error.message || '').toLowerCase();
        if (msg.includes('invalid login credentials') || msg.includes('user not found') || msg.includes('no user found'))
            return { bold: 'El correo ingresado no está registrado.', italic: 'Verifica que sea correcto o crea una cuenta nueva.' };
        if (msg.includes('invalid password') || msg.includes('wrong password'))
            return { bold: 'La contraseña no es correcta.', italic: 'Intenta nuevamente o restablece tu contraseña.' };
        if (msg.includes('invalid email') || msg.includes('unable to validate email'))
            return { bold: 'El correo no tiene un formato válido.', italic: 'Revisa que incluya @ y un dominio.' };
        if (msg.includes('already registered') || msg.includes('already exists') || msg.includes('user already registered'))
            return { bold: 'Este correo ya tiene una cuenta.', italic: 'Intenta iniciar sesión o usa otro correo.' };
        if (msg.includes('password should be') || msg.includes('password must'))
            return { bold: 'La contraseña es demasiado corta.', italic: 'Debe tener al menos 6 caracteres.' };
        if (msg.includes('rate limit') || msg.includes('too many'))
            return { bold: 'Demasiados intentos.', italic: 'Espera unos minutos antes de intentarlo de nuevo.' };
        return { bold: 'Error al autenticar.', italic: 'Intenta de nuevo en unos momentos.' };
    }

    function showAuthError({ bold, italic }) {
        authError.style.color = 'var(--danger)';
        authError.innerHTML = `<strong>${bold}</strong> <em>${italic}</em>`;
    }
    function clearAuthError() { authError.innerHTML = ''; }

    // ─────────────────────────────────────────────
    // AUTH
    // ─────────────────────────────────────────────
    async function initAuth() {
        const { data: { session } } = await sb.auth.getSession();
        if (session) { currentSession = session; showApp(); } else showAuthModal();
        sb.auth.onAuthStateChange((_e, session) => {
            if (_e === 'PASSWORD_RECOVERY') { openResetModal(); return; }
            currentSession = session;
            if (session) showApp(); else showAuthModal();
        });
    }

    // ─── Aviso de novedades (una vez por usuario) ───
    const whatsNewModal   = document.getElementById('whats-new-modal');
    const closeWhatsNew   = document.getElementById('close-whats-new');
    const btnWhatsNewOk   = document.getElementById('btn-whats-new-ok');
    const WHATS_NEW_KEY   = 'todo-whats-new-v1';

    function maybeShowWhatsNew(userId) {
        const seen = localStorage.getItem(`${WHATS_NEW_KEY}-${userId}`);
        if (seen) return;
        whatsNewModal.style.display = 'flex';
    }
    function dismissWhatsNew() {
        whatsNewModal.style.display = 'none';
        if (currentSession?.user?.id)
            localStorage.setItem(`${WHATS_NEW_KEY}-${currentSession.user.id}`, '1');
    }
    if (closeWhatsNew) closeWhatsNew.addEventListener('click', dismissWhatsNew);
    if (btnWhatsNewOk) btnWhatsNewOk.addEventListener('click', dismissWhatsNew);
    whatsNewModal.addEventListener('click', (e) => { if (e.target === whatsNewModal) dismissWhatsNew(); });

    function showAuthModal() { authModal.style.display = 'flex'; appDiv.style.display = 'none'; allTasks = []; }
    function showApp() {
        authModal.style.display = 'none';
        appDiv.style.display = 'flex';
        checkBackendStatus();
        loadTasks();
        if (currentSession?.user?.id) maybeShowWhatsNew(currentSession.user.id);
    }

    async function checkBackendStatus() {
        const dot = document.getElementById('backend-status');
        try {
            const res = await fetch(`/api/health`, { signal: AbortSignal.timeout(6000) });
            dot.className = 'backend-status ' + (res.ok ? 'online' : 'offline');
            dot.title = res.ok ? 'Servidor en línea' : 'Servidor con problemas';
        } catch {
            dot.className = 'backend-status offline';
            dot.title = 'Servidor no disponible — puede estar iniciando (~30s)';
        }
    }

    btnLogin.addEventListener('click', async () => {
        const email = authEmail.value.trim(), password = authPassword.value;
        if (!email || !password) return;
        clearAuthError(); btnLogin.disabled = true;
        const { error } = await sb.auth.signInWithPassword({ email, password });
        btnLogin.disabled = false;
        if (error) showAuthError(translateAuthError(error));
    });

    btnRegister.addEventListener('click', async () => {
        const email = authEmail.value.trim(), password = authPassword.value;
        if (!email || !password) return;
        clearAuthError(); btnRegister.disabled = true;
        const { error } = await sb.auth.signUp({ email, password });
        btnRegister.disabled = false;
        if (error) showAuthError(translateAuthError(error));
        else { authError.style.color = 'var(--success)'; authError.innerHTML = '<strong>Cuenta creada.</strong> <em>Revisa tu correo para confirmar tu dirección.</em>'; }
    });

    btnMagic.addEventListener('click', async () => {
        const email = authEmail.value.trim();
        if (!email) { showAuthError('Escribe tu correo electrónico primero.'); return; }
        clearAuthError(); btnMagic.disabled = true;
        const { error } = await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
        btnMagic.disabled = false;
        if (error) { showAuthError(translateAuthError(error)); return; }
        authError.style.color = 'var(--success)';
        authError.textContent = 'Enlace enviado. Revisa tu correo para acceder.';
    });

    if (btnForgot) btnForgot.addEventListener('click', async () => {
        const email = authEmail.value.trim();
        if (!email) { showAuthError({ bold: 'Escribe tu correo primero.', italic: 'Se enviará un enlace de recuperación.' }); return; }
        clearAuthError(); btnForgot.disabled = true;
        const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
        btnForgot.disabled = false;
        if (error) { showAuthError(translateAuthError(error)); return; }
        authError.style.color = 'var(--success)';
        authError.textContent = 'Enlace enviado. Revisa tu correo para restablecer la contraseña.';
    });

    function openResetModal() {
        authModal.style.display = 'none';
        resetModal.style.display = 'flex';
        resetPasswordIn.value = '';
        resetConfirmIn.value = '';
        resetError.textContent = '';
    }

    if (btnResetSubmit) btnResetSubmit.addEventListener('click', async () => {
        const pass = resetPasswordIn.value;
        const confirm = resetConfirmIn.value;
        if (!pass) { resetError.textContent = 'Escribe una contraseña nueva.'; return; }
        if (pass.length < 6) { resetError.textContent = 'La contraseña debe tener al menos 6 caracteres.'; return; }
        if (pass !== confirm) { resetError.textContent = 'Las contraseñas no coinciden.'; return; }
        resetError.textContent = ''; btnResetSubmit.disabled = true;
        const { error } = await sb.auth.updateUser({ password: pass });
        btnResetSubmit.disabled = false;
        if (error) { resetError.style.color = 'var(--danger)'; resetError.textContent = 'No se pudo actualizar la contraseña. Intenta de nuevo.'; return; }
        resetModal.style.display = 'none';
        showToast('Contraseña actualizada correctamente', 'success');
    });

    btnLogout.addEventListener('click', async () => { await sb.auth.signOut(); showToast('Sesión cerrada', 'info'); });

    async function authFetch(url, options = {}) {
        if (!currentSession) throw new Error('No autenticado');
        const headers = { 'Authorization': `Bearer ${currentSession.access_token}` };
        if (options.body) headers['Content-Type'] = 'application/json';
        return fetch(url, { ...options, headers: { ...headers, ...(options.headers || {}) } });
    }

    // ─────────────────────────────────────────────
    // 1. DETECCIÓN DE TEMA DEL SISTEMA
    // ─────────────────────────────────────────────
    function getDefaultTheme() {
        return 'hacker';
    }

    const themes = ['cosmos','hacker','office','minimal','nord','sakura','sunset','contrast'];
    const themeBtns = {};
    themes.forEach(t => { const el = document.getElementById(`theme-${t}`); if (el) themeBtns[t] = el; });

    function applyTheme(theme) {
        themes.forEach(t => document.body.classList.remove(`theme-${t}`));
        if (theme !== 'cosmos') document.body.classList.add(`theme-${theme}`);
        Object.values(themeBtns).forEach(b => b.classList.remove('active'));
        if (themeBtns[theme]) themeBtns[theme].classList.add('active');
        localStorage.setItem('todo-theme', theme);
    }

    function cycleTheme() {
        const current = localStorage.getItem('todo-theme') || getDefaultTheme();
        const next = themes[(themes.indexOf(current) + 1) % themes.length];
        applyTheme(next);
        showToast(`Tema: ${next.charAt(0).toUpperCase() + next.slice(1)}`, 'info');
    }

    const savedTheme = localStorage.getItem('todo-theme') || getDefaultTheme();
    applyTheme(savedTheme);

    window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', (e) => {
        if (!localStorage.getItem('todo-theme')) applyTheme(e.matches ? 'office' : 'cosmos');
    });

    Object.entries(themeBtns).forEach(([theme, btn]) => btn.addEventListener('click', () => applyTheme(theme)));

    // ─────────────────────────────────────────────
    // 33. TIPOGRAFÍA CONFIGURABLE
    // ─────────────────────────────────────────────
    const savedTypo = JSON.parse(localStorage.getItem('todo-typography') || 'null') || { family: "'Outfit', sans-serif", size: 15 };
    let currentFont = savedTypo.family;
    let currentSize = savedTypo.size;

    function applyTypography(family, size) {
        document.documentElement.style.setProperty('--font-family', family);
        document.documentElement.style.setProperty('--font-size-base', size + 'px');
        currentFont = family;
        currentSize = size;
        localStorage.setItem('todo-typography', JSON.stringify({ family, size }));
        updateTypographyUI();
    }

    function updateTypographyUI() {
        document.querySelectorAll('#font-options .typo-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.font === currentFont);
        });
        document.querySelectorAll('#size-options .typo-btn').forEach(btn => {
            btn.classList.toggle('active', parseInt(btn.dataset.size) === currentSize);
        });
    }

    applyTypography(currentFont, currentSize);

    if (btnTypography) btnTypography.addEventListener('click', () => {
        typographyModal.style.display = 'flex';
        updateTypographyUI();
    });
    if (closeTypography) closeTypography.addEventListener('click', () => typographyModal.style.display = 'none');
    typographyModal.addEventListener('click', (e) => { if (e.target === typographyModal) typographyModal.style.display = 'none'; });

    document.querySelectorAll('#font-options .typo-btn').forEach(btn => {
        btn.addEventListener('click', () => applyTypography(btn.dataset.font, currentSize));
    });
    document.querySelectorAll('#size-options .typo-btn').forEach(btn => {
        btn.addEventListener('click', () => applyTypography(currentFont, parseInt(btn.dataset.size)));
    });

    // ─────────────────────────────────────────────
    // 32. VISTA GRID
    // ─────────────────────────────────────────────
    function applyViewMode(mode) {
        viewMode = mode;
        document.body.classList.toggle('view-grid', mode === 'grid');
        if (viewToggle) {
            viewToggle.textContent = mode === 'grid' ? '☰' : '⊞';
            viewToggle.title = mode === 'grid' ? 'Vista lista (G)' : 'Vista tarjetas (G)';
        }
        localStorage.setItem('todo-view', mode);
    }

    applyViewMode(viewMode);
    if (viewToggle) viewToggle.addEventListener('click', () => applyViewMode(viewMode === 'list' ? 'grid' : 'list'));
    if (btnCompact) btnCompact.addEventListener('click', toggleCompactMode);

    // ─────────────────────────────────────────────
    // MODO ENFOQUE
    // ─────────────────────────────────────────────
    function toggleFocusMode() {
        focusMode = !focusMode;
        document.body.classList.toggle('focus-mode', focusMode);
        localStorage.setItem('todo-focus', focusMode);
        showToast(focusMode ? 'Modo enfoque activado' : 'Modo enfoque desactivado', 'info');
    }

    // ─────────────────────────────────────────────
    // MODALES
    // ─────────────────────────────────────────────
    function openShortcuts() { shortcutsModal.style.display = 'flex'; }
    function closeShortcutsModal() { shortcutsModal.style.display = 'none'; }
    function openExportModal() { exportModal.style.display = 'flex'; }
    function closeExportModal() { exportModal.style.display = 'none'; }

    if (btnShortcuts) btnShortcuts.addEventListener('click', openShortcuts);
    if (closeShortcuts) closeShortcuts.addEventListener('click', closeShortcutsModal);
    if (btnExport) btnExport.addEventListener('click', openExportModal);
    if (closeExport) closeExport.addEventListener('click', closeExportModal);
    shortcutsModal.addEventListener('click', (e) => { if (e.target === shortcutsModal) closeShortcutsModal(); });
    exportModal.addEventListener('click', (e) => { if (e.target === exportModal) closeExportModal(); });

    // ─────────────────────────────────────────────
    // EXPORTAR
    // ─────────────────────────────────────────────
    function downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href = url; a.download = filename; a.click();
        URL.revokeObjectURL(url);
    }

    function exportTasks(format) {
        if (allTasks.length === 0) { showToast('No hay tareas para exportar', 'warning'); return; }
        const now = new Date().toISOString().slice(0, 10);
        if (format === 'json') {
            downloadFile(JSON.stringify(allTasks.map(({ id, text, completed, order_index }) => ({ id, text, completed, order_index })), null, 2), `tareas-${now}.json`, 'application/json');
        }
        if (format === 'csv') {
            const header = 'id,texto,completada,orden';
            const rows = allTasks.map(t => `${t.id},"${(t.text||'').replace(/"/g,'""')}",${t.completed},${t.order_index}`);
            downloadFile([header, ...rows].join('\n'), `tareas-${now}.csv`, 'text/csv;charset=utf-8;');
        }
        if (format === 'markdown') {
            downloadFile(allTasks.map(t => `- [${t.completed ? 'x' : ' '}] ${t.text}`).join('\n'), `tareas-${now}.md`, 'text/markdown');
        }
        closeExportModal();
        showToast(`Exportado como ${format.toUpperCase()}`, 'success');
    }

    if (exportJson) exportJson.addEventListener('click', () => exportTasks('json'));
    if (exportCsv)  exportCsv.addEventListener('click',  () => exportTasks('csv'));
    if (exportMd)   exportMd.addEventListener('click',   () => exportTasks('markdown'));

    if (importJsonBtn) importJsonBtn.addEventListener('click', () => importFile && importFile.click());
    if (importFile) importFile.addEventListener('change', () => {
        if (importFile.files[0]) { importTasksFromJSON(importFile.files[0]); importFile.value = ''; }
    });

    async function importTasksFromJSON(file) {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (!Array.isArray(data)) throw new Error('formato');
                const texts = data.map(t => t.text).filter(Boolean);
                if (!texts.length) { showToast('No hay tareas válidas en el archivo', 'warning'); return; }
                let created = 0;
                for (const text of texts) {
                    try {
                        const res = await authFetch(`${API_URL}/tasks`, { method: 'POST', body: JSON.stringify({ text }) });
                        if (res.ok) { const t = await res.json(); allTasks.unshift(t); created++; }
                    } catch { /* continuar con las demás */ }
                }
                applyFilter();
                closeExportModal();
                showToast(`${created} tarea(s) importadas`, 'success');
            } catch { showToast('Archivo JSON inválido o sin tareas', 'error'); }
        };
        reader.readAsText(file);
    }

    // ─────────────────────────────────────────────
    // GAMIFICACIÓN
    // ─────────────────────────────────────────────
    const LEVELS = [{ name:'Bronce',min:0 },{ name:'Plata',min:100 },{ name:'Oro',min:500 },{ name:'Diamante',min:2000 }];
    const ACHIEVEMENTS = [
        { id:'first',   label:'Primera tarea',    check: (p,c) => c >= 1 },
        { id:'ten',     label:'10 tareas totales', check: (p,c) => c >= 10 },
        { id:'fifty',   label:'50 tareas totales', check: (p,c) => c >= 50 },
        { id:'silver',  label:'Nivel Plata',       check: (p)   => p >= 100 },
        { id:'gold',    label:'Nivel Oro',         check: (p)   => p >= 500 },
        { id:'diamond', label:'Nivel Diamante',    check: (p)   => p >= 2000 },
    ];

    function getGamification() {
        return JSON.parse(localStorage.getItem('todo-gamification') || '{"points":0,"totalCompleted":0,"achievements":[]}');
    }
    function saveGamification(data) { localStorage.setItem('todo-gamification', JSON.stringify(data)); }

    function awardPoints(points, totalCompleted) {
        const data = getGamification();
        data.points += points; data.totalCompleted += totalCompleted;
        const prev = LEVELS.filter(l => l.min <= (data.points - points)).pop();
        const next = LEVELS.filter(l => l.min <= data.points).pop();
        if (next.name !== prev.name) showToast(`Nivel alcanzado: ${next.name}`, 'magic');
        ACHIEVEMENTS.forEach(ach => {
            if (!data.achievements.includes(ach.id) && ach.check(data.points, data.totalCompleted)) {
                data.achievements.push(ach.id);
                setTimeout(() => showToast(`Logro desbloqueado: ${ach.label}`, 'magic'), 500);
            }
        });
        saveGamification(data);
    }

    // ─────────────────────────────────────────────
    // HISTORIAL
    // ─────────────────────────────────────────────
    function logActivity(action, taskText) {
        const h = JSON.parse(localStorage.getItem('todo-history') || '[]');
        h.unshift({ action, taskText, ts: Date.now() });
        if (h.length > 50) h.pop();
        localStorage.setItem('todo-history', JSON.stringify(h));
    }

    // ─────────────────────────────────────────────
    // CONTADOR DE CARACTERES
    // ─────────────────────────────────────────────
    input.addEventListener('input', () => {
        const len = input.value.length;
        charCounter.textContent = `${len}/500`;
        charCounter.className = 'char-counter' + (len >= 450 ? ' warn' : '') + (len >= 490 ? ' danger' : '');
        updateDatePreview(input.value);
    });

    // ─────────────────────────────────────────────
    // FECHA EN LENGUAJE NATURAL
    // ─────────────────────────────────────────────
    const DAYS_ES = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];

    function parseNaturalDate(text) {
        const lower = text.toLowerCase();
        const now = new Date();
        if (lower.includes('hoy')) return new Date();
        if (lower.includes('pasado mañana') || lower.includes('pasado manana')) {
            const d = new Date(); d.setDate(d.getDate() + 2); return d;
        }
        if (lower.includes('mañana') || lower.includes('manana')) {
            const d = new Date(); d.setDate(d.getDate() + 1); return d;
        }
        for (let i = 0; i < DAYS_ES.length; i++) {
            if (lower.includes(DAYS_ES[i])) {
                const d = new Date();
                const diff = (i - d.getDay() + 7) % 7 || 7;
                d.setDate(d.getDate() + diff); return d;
            }
        }
        const m1 = lower.match(/en (\d+) d[íi]as?/);
        if (m1) { const d = new Date(); d.setDate(d.getDate() + parseInt(m1[1])); return d; }
        const m2 = lower.match(/en (\d+) semanas?/);
        if (m2) { const d = new Date(); d.setDate(d.getDate() + parseInt(m2[1]) * 7); return d; }
        return null;
    }

    function formatDateShort(date) {
        return date.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
    }

    function updateDatePreview(text) {
        const date = parseNaturalDate(text);
        if (date) {
            datePreview.textContent = `📅 ${formatDateShort(date)}`;
            datePreview.style.display = 'inline';
        } else {
            datePreview.textContent = '';
            datePreview.style.display = 'none';
        }
    }

    function getTaskDates() { return JSON.parse(localStorage.getItem('todo-dates') || '{}'); }
    function saveTaskDate(taskId, date) {
        const dates = getTaskDates();
        if (date) dates[taskId] = date.toISOString(); else delete dates[taskId];
        localStorage.setItem('todo-dates', JSON.stringify(dates));
        if (currentSession) apiSetTaskDate(taskId, date ? date.toISOString().slice(0, 10) : null);
    }
    function getTaskDate(taskId) {
        const task = allTasks.find(t => t.id === taskId);
        if (task?.due_date) return new Date(task.due_date);
        const dates = getTaskDates();
        return dates[taskId] ? new Date(dates[taskId]) : null;
    }

    // ─────────────────────────────────────────────
    // NOTAS POR TAREA
    // ─────────────────────────────────────────────
    function getNote(taskId) { return (JSON.parse(localStorage.getItem('todo-notes') || '{}'))[taskId] || ''; }
    function saveNote(taskId, text) {
        const notes = JSON.parse(localStorage.getItem('todo-notes') || '{}');
        if (text.trim()) notes[taskId] = text; else delete notes[taskId];
        localStorage.setItem('todo-notes', JSON.stringify(notes));
    }

    // ─────────────────────────────────────────────
    // SUBTAREAS (persistidas en backend)
    // ─────────────────────────────────────────────
    function getSubtasks(taskId) {
        const task = allTasks.find(t => t.id === taskId);
        return task?.subtasks || [];
    }
    function setSubtasks(taskId, subtasks) {
        const task = allTasks.find(t => t.id === taskId);
        if (task) task.subtasks = subtasks;
    }

    async function apiCreateSubtask(taskId, text) {
        const res = await authFetch(`${API_URL}/tasks/${taskId}/subtasks`, {
            method: 'POST',
            body: JSON.stringify({ text })
        });
        if (!res.ok) throw new Error('Error al crear subtarea');
        return res.json();
    }

    async function apiToggleSubtask(taskId, subtaskId, done) {
        const res = await authFetch(`${API_URL}/tasks/${taskId}/subtasks/${subtaskId}`, {
            method: 'PATCH',
            body: JSON.stringify({ done })
        });
        if (!res.ok) throw new Error('Error al actualizar subtarea');
        return res.json();
    }

    async function apiDeleteSubtask(taskId, subtaskId) {
        const res = await authFetch(`${API_URL}/tasks/${taskId}/subtasks/${subtaskId}`, {
            method: 'DELETE'
        });
        if (!res.ok) throw new Error('Error al eliminar subtarea');
    }

    function buildSubtaskPanel(taskId) {
        const panel = document.createElement('div');
        panel.className = 'subtask-panel';

        function refresh() {
            panel.innerHTML = '';
            const subtasks = getSubtasks(taskId);
            subtasks.forEach((st) => {
                const row = document.createElement('div');
                row.className = 'subtask-row';
                row.innerHTML = `
                    <button class="subtask-check${st.done ? ' done' : ''}" title="${st.done ? 'Marcar pendiente' : 'Completar'}"></button>
                    <span class="subtask-text${st.done ? ' done' : ''}">${escapeHTML(st.text)}</span>
                    <button class="subtask-del" title="Eliminar">✕</button>
                `;
                row.querySelector('.subtask-check').addEventListener('click', async () => {
                    try {
                        const updated = await apiToggleSubtask(taskId, st.id, !st.done);
                        st.done = updated.done;
                        refresh();
                    } catch { showToast('Error al actualizar subtarea', 'error'); }
                });
                row.querySelector('.subtask-del').addEventListener('click', async () => {
                    try {
                        await apiDeleteSubtask(taskId, st.id);
                        const list = getSubtasks(taskId);
                        const idx = list.findIndex(s => s.id === st.id);
                        if (idx !== -1) list.splice(idx, 1);
                        setSubtasks(taskId, list);
                        refresh();
                    } catch { showToast('Error al eliminar subtarea', 'error'); }
                });
                panel.appendChild(row);
            });
            const addRow = document.createElement('div');
            addRow.className = 'subtask-add-row';
            addRow.innerHTML = `<input class="subtask-input" type="text" placeholder="Nueva subtarea..." maxlength="200">`;
            const inp = addRow.querySelector('.subtask-input');
            inp.addEventListener('keydown', async (e) => {
                if (e.key !== 'Enter') return;
                const text = inp.value.trim();
                if (!text) return;
                try {
                    const created = await apiCreateSubtask(taskId, text);
                    const list = getSubtasks(taskId);
                    list.push(created);
                    setSubtasks(taskId, list);
                    refresh();
                } catch { showToast('Error al crear subtarea', 'error'); }
            });
            panel.appendChild(addRow);
        }

        refresh();
        return panel;
    }

    // ─────────────────────────────────────────────
    // TAREAS RECURRENTES
    // ─────────────────────────────────────────────
    const RECURRENCE_OPTS = ['none', 'daily', 'weekly', 'monthly'];
    const RECURRENCE_LABELS = { none: 'Sin recurrencia', daily: 'Diaria', weekly: 'Semanal', monthly: 'Mensual' };

    function getRecurrences() { return JSON.parse(localStorage.getItem('todo-recurrence') || '{}'); }
    function getRecurrence(taskId) { return getRecurrences()[taskId] || 'none'; }
    function setRecurrence(taskId, value) {
        const data = getRecurrences();
        if (value === 'none') delete data[taskId]; else data[taskId] = value;
        localStorage.setItem('todo-recurrence', JSON.stringify(data));
    }

    // ─────────────────────────────────────────────
    // PRIORIDAD DE TAREAS
    // ─────────────────────────────────────────────
    const PRIORITIES = ['none', 'high', 'medium', 'low'];
    const PRIORITY_META = {
        none:   { label: '',      color: 'transparent', icon: '○' },
        high:   { label: 'Alta',  color: '#ef4444',     icon: '●' },
        medium: { label: 'Media', color: '#f59e0b',     icon: '●' },
        low:    { label: 'Baja',  color: '#10b981',     icon: '●' },
    };

    function getPriorities() { return JSON.parse(localStorage.getItem('todo-priority') || '{}'); }
    function getPriority(taskId) { return getPriorities()[taskId] || 'none'; }
    function setPriority(taskId, level) {
        const data = getPriorities();
        if (level === 'none') delete data[taskId]; else data[taskId] = level;
        localStorage.setItem('todo-priority', JSON.stringify(data));
    }
    function cyclePriority(taskId, dotEl) {
        const cur = getPriority(taskId);
        const next = PRIORITIES[(PRIORITIES.indexOf(cur) + 1) % PRIORITIES.length];
        setPriority(taskId, next);
        const meta = PRIORITY_META[next];
        dotEl.style.color = meta.color;
        dotEl.title = next === 'none' ? 'Sin prioridad — clic para cambiar' : `Prioridad ${meta.label}`;
        dotEl.dataset.priority = next;
    }

    // ─────────────────────────────────────────────
    // TAGS / ETIQUETAS
    // ─────────────────────────────────────────────
    function parseTags(text) {
        const matches = text.match(/#[\wÀ-ɏḀ-ỿ]+/g);
        return matches ? [...new Set(matches.map(t => t.toLowerCase()))] : [];
    }

    function setActiveTag(tag) {
        activeTag = tag;
        const indicator = document.getElementById('active-tag-indicator');
        if (indicator) indicator.remove();
        if (tag) {
            const chip = document.createElement('div');
            chip.id = 'active-tag-indicator';
            chip.className = 'active-tag-indicator';
            chip.innerHTML = `Filtrando: <strong>${tag}</strong> <span class="active-tag-clear" title="Quitar filtro">✕</span>`;
            chip.querySelector('.active-tag-clear').addEventListener('click', () => setActiveTag(null));
            document.querySelector('.filter-bar').after(chip);
        }
        applyFilter();
    }

    // ─────────────────────────────────────────────
    // MODO COMPACTO
    // ─────────────────────────────────────────────
    function applyCompactMode(on) {
        compactMode = on;
        document.body.classList.toggle('compact-mode', on);
        if (btnCompact) {
            btnCompact.classList.toggle('active', on);
            btnCompact.title = on ? 'Vista normal (C)' : 'Modo compacto (C)';
        }
        localStorage.setItem('todo-compact', on);
    }
    function toggleCompactMode() { applyCompactMode(!compactMode); }
    applyCompactMode(compactMode);

    // ─────────────────────────────────────────────
    // UNDO STACK
    // ─────────────────────────────────────────────
    function pushUndo(action) { undoStack.push(action); if (undoStack.length > 20) undoStack.shift(); }

    async function undoLastAction() {
        const action = undoStack.pop();
        if (!action) { showToast('Nada que deshacer', 'info'); return; }
        if (action.type === 'delete') {
            try {
                const res = await authFetch(`${API_URL}/tasks`, { method: 'POST', body: JSON.stringify({ text: action.task.text }) });
                if (!res.ok) throw new Error();
                const restored = await res.json();
                allTasks.unshift(restored);
                applyFilter();
                showToast(`Restaurada: "${action.task.text.slice(0, 30)}"`, 'success');
            } catch { showToast('No se pudo restaurar', 'error'); }
        }
    }

    // ─────────────────────────────────────────────
    // ORDENAR TAREAS
    // ─────────────────────────────────────────────
    sortSelect.addEventListener('change', () => { sortOrder = sortSelect.value; applyFilter(); });

    function sortTasks(tasks) {
        if (sortOrder === 'az')      return [...tasks].sort((a, b) => a.text.localeCompare(b.text, 'es'));
        if (sortOrder === 'za')      return [...tasks].sort((a, b) => b.text.localeCompare(a.text, 'es'));
        if (sortOrder === 'pending') return [...tasks].sort((a, b) => Number(a.completed) - Number(b.completed));
        if (sortOrder === 'done')    return [...tasks].sort((a, b) => Number(b.completed) - Number(a.completed));
        return [...tasks];
    }

    // ─────────────────────────────────────────────
    // 30. POMODORO TIMER — MODO POR FASES
    // ─────────────────────────────────────────────
    function getPomodoroTotal() {
        return JSON.parse(localStorage.getItem('todo-pomodoro-total') || '0');
    }
    function incPomodoroTotal() {
        localStorage.setItem('todo-pomodoro-total', getPomodoroTotal() + 1);
    }

    function startPomodoro() {
        if (pomodoroInterval) { stopPomodoro(true); return; }
        if (Notification.permission === 'default') Notification.requestPermission();
        pomodoroPhase = 'work';
        pomodoroCompleted = 0;
        beginPhase();
        showToast('Pomodoro iniciado — 25 min de trabajo 🍅', 'info');
    }

    function beginPhase() {
        const ph = PHASES[pomodoroPhase];
        pomodoroRemaining = ph.secs;
        pomodoroBar.style.display = 'flex';
        pomodoroBar.dataset.phase = pomodoroPhase;
        pomodoroPhaseIcon.textContent = ph.icon;
        pomodoroPhaseLabel.textContent = ph.label;
        if (btnPomodoro) { btnPomodoro.classList.add('active'); btnPomodoro.title = 'Detener Pomodoro'; }
        updatePomodoroDisplay();
        if (pomodoroInterval) clearInterval(pomodoroInterval);
        pomodoroInterval = setInterval(() => {
            pomodoroRemaining--;
            updatePomodoroDisplay();
            if (pomodoroRemaining <= 0) advancePhase();
        }, 1000);
    }

    function advancePhase() {
        clearInterval(pomodoroInterval);
        pomodoroInterval = null;
        const ph = PHASES[pomodoroPhase];
        playSound('phase');

        if (pomodoroPhase === 'work') {
            pomodoroCompleted++;
            incPomodoroTotal();
            if (Notification.permission === 'granted')
                new Notification(`☕ Descanso — ${pomodoroCompleted} pomodoro(s) completado(s)`, { body: 'Descansa 5 minutos.' });
            showToast(`🍅 ¡Trabajo completado! — Descanso de 5 min`, 'magic');
        } else if (pomodoroPhase === 'break') {
            if (Notification.permission === 'granted')
                new Notification('🔍 Momento de repasar', { body: '5 minutos para revisar lo que hiciste.' });
            showToast('☕ Descanso terminado — Repasa lo visto 🔍', 'info');
        } else {
            if (Notification.permission === 'granted')
                new Notification('🍅 Nuevo ciclo Pomodoro', { body: '¡Vuelve al trabajo!' });
            showToast('🔍 Repaso terminado — ¡Nuevo ciclo! 🍅', 'magic');
        }

        pomodoroPhase = ph.next;
        setTimeout(() => beginPhase(), 1500);
    }

    function stopPomodoro(silent = false) {
        clearInterval(pomodoroInterval);
        pomodoroInterval = null;
        pomodoroBar.style.display = 'none';
        pomodoroBar.dataset.phase = '';
        if (btnPomodoro) { btnPomodoro.classList.remove('active'); btnPomodoro.title = 'Modo Pomodoro (P)'; }
        updateCount();
        if (!silent) showToast('Pomodoro cancelado', 'info');
    }

    function updatePomodoroDisplay() {
        const min = Math.floor(pomodoroRemaining / 60).toString().padStart(2, '0');
        const sec = (pomodoroRemaining % 60).toString().padStart(2, '0');
        pomodoroTimeEl.textContent = `${min}:${sec}`;
        const ph = PHASES[pomodoroPhase];
        document.title = `${ph.icon} ${min}:${sec} — Infinity To-Do`;
    }

    if (btnPomodoro) btnPomodoro.addEventListener('click', () => {
        if (pomodoroInterval) stopPomodoro(); else startPomodoro();
    });
    pomodoroStop.addEventListener('click', () => stopPomodoro());

    // ─────────────────────────────────────────────
    // 38. PANEL DE ESTADÍSTICAS
    // ─────────────────────────────────────────────
    if (btnStats) btnStats.addEventListener('click', () => {
        statsVisible = !statsVisible;
        statsPanel.style.display = statsVisible ? 'block' : 'none';
        btnStats.classList.toggle('active', statsVisible);
        if (statsVisible) renderStats();
    });

    function renderStats() {
        const history = JSON.parse(localStorage.getItem('todo-history') || '[]');
        const gamification = getGamification();
        const today = new Date().toDateString();

        const completedToday = history.filter(h => h.action === 'completar' && new Date(h.ts).toDateString() === today).length;

        const completionDays = new Set(
            history.filter(h => h.action === 'completar').map(h => new Date(h.ts).toDateString())
        );
        let streak = 0;
        const d = new Date();
        while (completionDays.has(d.toDateString())) { streak++; d.setDate(d.getDate() - 1); }

        const hourCounts = {};
        history.filter(h => h.action === 'completar').forEach(h => {
            const hr = new Date(h.ts).getHours();
            hourCounts[hr] = (hourCounts[hr] || 0) + 1;
        });
        const peak = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0];
        const peakLabel = peak ? `${peak[0]}:00 h` : '—';

        const total = allTasks.length;
        const done  = allTasks.filter(t => t.completed).length;
        const rate  = total > 0 ? Math.round((done / total) * 100) : 0;

        document.getElementById('stat-today').textContent     = completedToday;
        document.getElementById('stat-streak').textContent    = streak > 0 ? `${streak}d` : '—';
        document.getElementById('stat-rate').textContent      = `${rate}%`;
        document.getElementById('stat-points').textContent    = gamification.points;
        document.getElementById('stat-hour').textContent      = peakLabel;
        document.getElementById('stat-pomodoros').textContent = getPomodoroTotal() + pomodoroCompleted;
    }

    // ─────────────────────────────────────────────
    // 39. CALENDARIO
    // ─────────────────────────────────────────────
    const calendarPanel = document.getElementById('calendar-panel');
    const btnCalendar   = document.getElementById('btn-calendar');
    const calGrid       = document.getElementById('cal-grid');
    const calTitle      = document.getElementById('cal-title');
    const calPrev       = document.getElementById('cal-prev');
    const calNext       = document.getElementById('cal-next');
    const calToday      = document.getElementById('cal-today');
    const calClose      = document.getElementById('cal-close');
    const calTasks      = document.getElementById('cal-tasks');
    const calTasksDate  = document.getElementById('cal-tasks-date');
    const calTasksCount = document.getElementById('cal-tasks-count');
    const calTasksList  = document.getElementById('cal-tasks-list');

    let calYear  = new Date().getFullYear();
    let calMonth = new Date().getMonth();
    let calSelected = null;
    let calendarVisible = false;

    const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

    function getTasksByDate() {
        const map = {};
        for (const t of allTasks) {
            const d = getTaskDate(t.id);
            if (d) {
                const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                if (!map[key]) map[key] = [];
                map[key].push(t);
            }
        }
        return map;
    }

    function renderCalendar(year, month) {
        calGrid.innerHTML = '';
        calTitle.textContent = `${MONTHS_ES[month]} ${year}`;
        const firstDay = new Date(year, month, 1);
        const lastDay  = new Date(year, month + 1, 0);
        const startDow = (firstDay.getDay() + 6) % 7;
        const tasksByDate = getTasksByDate();
        const today = new Date();

        for (let i = 0; i < startDow; i++) {
            const el = document.createElement('div');
            el.className = 'cal-day cal-day-empty';
            calGrid.appendChild(el);
        }

        for (let d = 1; d <= lastDay.getDate(); d++) {
            const dateObj = new Date(year, month, d);
            const key = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
            const hasTasks = key in tasksByDate;
            const isToday = year === today.getFullYear() && month === today.getMonth() && d === today.getDate();
            const isSelected = calSelected === key;

            const el = document.createElement('div');
            el.className = `cal-day${isToday ? ' cal-day-today' : ''}${isSelected ? ' cal-day-selected' : ''}${hasTasks ? ' cal-day-has-tasks' : ''}`;
            el.textContent = d;
            if (hasTasks) {
                const dot = document.createElement('span');
                dot.className = 'cal-day-dot';
                el.appendChild(dot);
            }
            el.addEventListener('click', () => showDayTasks(key, tasksByDate));
            calGrid.appendChild(el);
        }
    }

    function showDayTasks(key, tasksByDate) {
        if (calSelected === key && calTasks.style.display === 'block') {
            calSelected = null;
            calTasks.style.display = 'none';
            renderCalendar(calYear, calMonth);
            return;
        }
        calSelected = key;
        renderCalendar(calYear, calMonth);
        const tasks = tasksByDate[key] || [];
        if (!tasks.length) {
            calTasks.style.display = 'none';
            return;
        }
        calTasks.style.display = 'block';
        const [y, m, d] = key.split('-').map(Number);
        const dateObj = new Date(y, m - 1, d);
        calTasksDate.textContent = dateObj.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        calTasksCount.textContent = `${tasks.length} tarea(s)`;
        calTasksList.innerHTML = '';
        tasks.forEach(t => {
            const li = document.createElement('li');
            li.className = `cal-task-item${t.completed ? ' done' : ''}`;
            li.innerHTML = `
                <span class="cal-task-check">${t.completed ? '✅' : '⬜'}</span>
                <span class="cal-task-text">${escapeHTML(t.text)}</span>
            `;
            li.addEventListener('click', () => {
                closeCalendar();
                searchInput.value = t.text.slice(0, 20);
                searchQuery = t.text.slice(0, 20).toLowerCase();
                applyFilter();
            });
            calTasksList.appendChild(li);
        });
    }

    function openCalendar() {
        calendarVisible = true;
        calendarPanel.style.display = 'block';
        btnCalendar.classList.add('active');
        renderCalendar(calYear, calMonth);
    }

    function closeCalendar() {
        calendarVisible = false;
        calendarPanel.style.display = 'none';
        btnCalendar.classList.remove('active');
        calTasks.style.display = 'none';
        calSelected = null;
        if (activeFilter !== 'all') {
            const filterAll = document.getElementById('filter-all');
            if (filterAll) filterAll.click();
        }
    }

    if (btnCalendar) btnCalendar.addEventListener('click', () => {
        calendarVisible ? closeCalendar() : openCalendar();
    });
    if (calClose) calClose.addEventListener('click', closeCalendar);
    const calShowAll = document.getElementById('cal-show-all');
    if (calShowAll) calShowAll.addEventListener('click', () => {
        closeCalendar();
        const filterAll = document.getElementById('filter-all');
        if (filterAll) filterAll.click();
    });
    if (calPrev) calPrev.addEventListener('click', () => {
        calMonth--;
        if (calMonth < 0) { calMonth = 11; calYear--; }
        calSelected = null;
        calTasks.style.display = 'none';
        renderCalendar(calYear, calMonth);
    });
    if (calNext) calNext.addEventListener('click', () => {
        calMonth++;
        if (calMonth > 11) { calMonth = 0; calYear++; }
        calSelected = null;
        calTasks.style.display = 'none';
        renderCalendar(calYear, calMonth);
    });
    if (calToday) calToday.addEventListener('click', () => {
        const now = new Date();
        calYear = now.getFullYear();
        calMonth = now.getMonth();
        calSelected = null;
        calTasks.style.display = 'none';
        renderCalendar(calYear, calMonth);
    });

    // ─────────────────────────────────────────────
    // PALETA DE COMANDOS (Ctrl+K)
    // ─────────────────────────────────────────────
    const COMMANDS = [
        { label:'Nueva tarea',            icon:'✏️',  action: () => { closeCommandPalette(); input.focus(); } },
        { label:'Buscar tareas',           icon:'🔍', action: () => { closeCommandPalette(); searchInput.focus(); } },
        { label:'Vista grid / lista',      icon:'⊞',  action: () => { closeCommandPalette(); applyViewMode(viewMode === 'list' ? 'grid' : 'list'); } },
        { label:'Modo compacto',           icon:'⊟',  action: () => { closeCommandPalette(); toggleCompactMode(); } },
        { label:'Iniciar / detener Pomodoro', icon:'⏱', action: () => { closeCommandPalette(); if (pomodoroInterval) stopPomodoro(); else startPomodoro(); } },
        { label:'Tipografía',              icon:'Aa', action: () => { closeCommandPalette(); btnTypography.click(); } },
        { label:'Estadísticas',            icon:'📊', action: () => { closeCommandPalette(); btnStats.click(); } },
        { label:'Exportar tareas',         icon:'↓',  action: () => { closeCommandPalette(); openExportModal(); } },
        { label:'Modo enfoque',            icon:'👁', action: () => { closeCommandPalette(); toggleFocusMode(); } },
        { label:'Atajos de teclado',       icon:'⌨️', action: () => { closeCommandPalette(); openShortcuts(); } },
        { label:'Tema: Cosmos',            icon:'🌌', action: () => { closeCommandPalette(); applyTheme('cosmos'); } },
        { label:'Tema: Hacker',            icon:'💻', action: () => { closeCommandPalette(); applyTheme('hacker'); } },
        { label:'Tema: Office',            icon:'📋', action: () => { closeCommandPalette(); applyTheme('office'); } },
        { label:'Tema: Dark Minimal',      icon:'◼',  action: () => { closeCommandPalette(); applyTheme('minimal'); } },
        { label:'Tema: Nord',              icon:'❄',  action: () => { closeCommandPalette(); applyTheme('nord'); } },
        { label:'Tema: Sakura',            icon:'🌸', action: () => { closeCommandPalette(); applyTheme('sakura'); } },
        { label:'Tema: Sunset',            icon:'🌅', action: () => { closeCommandPalette(); applyTheme('sunset'); } },
        { label:'Tema: Alto Contraste',    icon:'◑',  action: () => { closeCommandPalette(); applyTheme('contrast'); } },
        { label:'Filtro: Todas',           icon:'📋', action: () => { closeCommandPalette(); document.getElementById('filter-all').click(); } },
        { label:'Filtro: Pendientes',      icon:'⏳', action: () => { closeCommandPalette(); document.getElementById('filter-pending').click(); } },
        { label:'Filtro: Completadas',     icon:'✅', action: () => { closeCommandPalette(); document.getElementById('filter-done').click(); } },
        { label:'Deshacer última acción',  icon:'↩️', action: () => { closeCommandPalette(); undoLastAction(); } },
        { label:'Cerrar sesión',           icon:'🚪', action: () => { closeCommandPalette(); btnLogout.click(); } },
    ];

    let cmdSelectedIndex = -1;

    function openCommandPalette() {
        commandPalette.style.display = 'flex';
        commandInput.value = '';
        cmdSelectedIndex = -1;
        renderCommandResults('');
        requestAnimationFrame(() => commandInput.focus());
    }
    function closeCommandPalette() { commandPalette.style.display = 'none'; }

    function renderCommandResults(query) {
        const q = query.toLowerCase().trim();
        const matchedCmds  = COMMANDS.filter(c => !q || c.label.toLowerCase().includes(q));
        const matchedTasks = q ? allTasks.filter(t => t.text.toLowerCase().includes(q)).slice(0, 5) : [];
        commandResults.innerHTML = '';
        cmdSelectedIndex = -1;

        if (!matchedCmds.length && !matchedTasks.length) {
            commandResults.innerHTML = '<div class="command-empty">Sin resultados</div>'; return;
        }
        if (matchedCmds.length) {
            const s = document.createElement('div'); s.className = 'command-section-label'; s.textContent = 'Comandos';
            commandResults.appendChild(s);
            matchedCmds.forEach(cmd => {
                const item = document.createElement('div'); item.className = 'command-item';
                item.innerHTML = `<span class="command-icon">${cmd.icon}</span><span>${cmd.label}</span>`;
                item.addEventListener('click', cmd.action);
                commandResults.appendChild(item);
            });
        }
        if (matchedTasks.length) {
            const s = document.createElement('div'); s.className = 'command-section-label'; s.textContent = 'Tareas';
            commandResults.appendChild(s);
            matchedTasks.forEach(task => {
                const item = document.createElement('div'); item.className = 'command-item';
                item.innerHTML = `<span class="command-icon">${task.completed ? '✅' : '⬜'}</span><span class="command-task-text">${escapeHTML(task.text)}</span>`;
                item.addEventListener('click', () => {
                    closeCommandPalette();
                    searchInput.value = task.text.slice(0, 20);
                    searchQuery = task.text.slice(0, 20).toLowerCase();
                    applyFilter();
                });
                commandResults.appendChild(item);
            });
        }
    }

    commandInput.addEventListener('input', () => renderCommandResults(commandInput.value));
    commandInput.addEventListener('keydown', (e) => {
        const items = commandResults.querySelectorAll('.command-item');
        if (e.key === 'ArrowDown') { e.preventDefault(); cmdSelectedIndex = Math.min(cmdSelectedIndex + 1, items.length - 1); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); cmdSelectedIndex = Math.max(cmdSelectedIndex - 1, 0); }
        else if (e.key === 'Enter' && cmdSelectedIndex >= 0) { e.preventDefault(); items[cmdSelectedIndex]?.click(); return; }
        else if (e.key === 'Escape') { closeCommandPalette(); return; }
        items.forEach((item, i) => item.classList.toggle('selected', i === cmdSelectedIndex));
        items[cmdSelectedIndex]?.scrollIntoView({ block: 'nearest' });
    });
    commandPalette.addEventListener('click', (e) => { if (e.target === commandPalette) closeCommandPalette(); });

    // ─────────────────────────────────────────────
    // GESTIONAR COMPLETADAS (archivar / eliminar)
    // ─────────────────────────────────────────────
    function closeManageDropdown(e) {
        const dd = document.getElementById('manage-dropdown');
        if (dd && !dd.closest('.manage-wrapper')?.contains(e.target)) {
            dd.classList.remove('show');
            document.removeEventListener('click', closeManageDropdown);
        }
    }

    clearBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const dd = document.getElementById('manage-dropdown');
        if (dd.classList.contains('show')) {
            dd.classList.remove('show');
            document.removeEventListener('click', closeManageDropdown);
            return;
        }
        dd.classList.add('show');
        setTimeout(() => document.addEventListener('click', closeManageDropdown), 10);
    });

    document.getElementById('manage-delete').addEventListener('click', async () => {
        document.getElementById('manage-dropdown').classList.remove('show');
        const completed = allTasks.filter(t => t.completed);
        if (!completed.length) { showToast('No hay tareas completadas', 'info'); return; }
        await Promise.all(completed.map(t => authFetch(`${API_URL}/tasks/${t.id}`, { method: 'DELETE' })));
        await loadTasks();
        showToast(`${completed.length} tareas eliminadas 🧹`, 'magic');
    });

    document.getElementById('manage-archive').addEventListener('click', async () => {
        document.getElementById('manage-dropdown').classList.remove('show');
        const completed = allTasks.filter(t => t.completed);
        if (!completed.length) { showToast('No hay tareas completadas', 'info'); return; }
        await Promise.all(completed.map(t => apiArchiveTask(t.id)));
        await loadTasks();
        showToast(`${completed.length} tareas archivadas 📦`, 'info');
    });

    // MARCAR TODAS
    toggleAllBtn.addEventListener('click', async () => {
        if (!allTasks.length) return;
        const newState = !allTasks.every(t => t.completed);
        const toUpdate = allTasks.filter(t => t.completed !== newState);
        if (!toUpdate.length) return;
        toUpdate.forEach(t => t.completed = newState);
        applyFilter(); toggleAllBtn.disabled = true;
        try {
            await Promise.all(toUpdate.map(t => authFetch(`${API_URL}/tasks/${t.id}`, { method: 'PUT', body: JSON.stringify({ completed: newState }) })));
            showToast(newState ? '¡Todas completadas! 🎉' : 'Todas pendientes de nuevo', 'magic');
        } catch { showToast('Error de conexión', 'error'); await loadTasks(); }
        finally { toggleAllBtn.disabled = false; }
    });

    // ─────────────────────────────────────────────
    // ATAJOS DE TECLADO
    // ─────────────────────────────────────────────
    function isTyping() {
        const tag = document.activeElement.tagName;
        return tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement.isContentEditable;
    }

    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            commandPalette.style.display !== 'none' ? closeCommandPalette() : openCommandPalette();
            return;
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !isTyping()) { e.preventDefault(); undoLastAction(); return; }

        if (e.key === 'Escape') {
            if (commandPalette.style.display !== 'none') { closeCommandPalette(); return; }
            if (typographyModal.style.display !== 'none') { typographyModal.style.display = 'none'; return; }
            if (shortcutsModal.style.display !== 'none') { closeShortcutsModal(); return; }
            if (exportModal.style.display !== 'none') { closeExportModal(); return; }
            if (pomodoroInterval) { stopPomodoro(); return; }
            if (document.activeElement === input || document.activeElement === searchInput) document.activeElement.blur();
            if (searchInput.value) { searchInput.value = ''; searchQuery = ''; applyFilter(); }
            return;
        }

        if (isTyping()) return;
        if (e.key === '/') { e.preventDefault(); searchInput.focus(); return; }
        if (e.key === 'n') { e.preventDefault(); input.focus(); return; }
        if (e.key === 'f' || e.key === 'F') { e.preventDefault(); toggleFocusMode(); return; }
        if (e.key === 't' || e.key === 'T') { e.preventDefault(); cycleTheme(); return; }
        if (e.key === 'g' || e.key === 'G') { e.preventDefault(); applyViewMode(viewMode === 'list' ? 'grid' : 'list'); return; }
        if (e.key === 'c' || e.key === 'C') { e.preventDefault(); toggleCompactMode(); return; }
        if (e.key === 'p' || e.key === 'P') { e.preventDefault(); if (pomodoroInterval) stopPomodoro(); else startPomodoro(); return; }
        if (e.key === 'e' || e.key === 'E') { e.preventDefault(); openExportModal(); return; }
        if (e.key === '?') { e.preventDefault(); openShortcuts(); return; }
        if (e.key === '1') { e.preventDefault(); document.getElementById('filter-all').click(); return; }
        if (e.key === '2') { e.preventDefault(); document.getElementById('filter-pending').click(); return; }
        if (e.key === '3') { e.preventDefault(); document.getElementById('filter-done').click(); return; }
    });

    // ─────────────────────────────────────────────
    // FILTROS
    // ─────────────────────────────────────────────
    const savedFilter = localStorage.getItem('todo-filter') || 'all';
    activeFilter = savedFilter;
    showArchived = savedFilter === 'archived';
    filterBtns.forEach(btn => {
        btn.classList.toggle('active', btn.id === `filter-${savedFilter}`);
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeFilter = btn.id.replace('filter-', '');
            showArchived = activeFilter === 'archived';
            localStorage.setItem('todo-filter', activeFilter);
            loadTasks();
        });
    });

    searchInput.addEventListener('input', (e) => { searchQuery = e.target.value.toLowerCase().trim(); applyFilter(); });

    function applyFilter() {
        let filtered = allTasks;
        if (activeFilter === 'pending') filtered = allTasks.filter(t => !t.completed);
        if (activeFilter === 'done')    filtered = allTasks.filter(t => t.completed);
        if (searchQuery) filtered = filtered.filter(t => t.text.toLowerCase().includes(searchQuery));
        if (activeTag)   filtered = filtered.filter(t => parseTags(t.text).includes(activeTag));
        filtered = sortTasks(filtered);

        todoList.innerHTML = '';
        if (!filtered.length) {
            const msg = showArchived ? '📦 No hay tareas archivadas' : '✨ No hay tareas aquí';
            todoList.innerHTML = `<li class="empty-msg">${msg}</li>`;
        } else {
            filtered.forEach((todo, i) => {
                const li = renderTodoItem(todo);
                li.style.animationDelay = `${Math.min(i * 35, 350)}ms`;
                todoList.appendChild(li);
            });
        }
        updateCount();
        if (window.todoSortable) {
            const canSort = activeFilter === 'all' && !searchQuery && sortOrder === 'default';
            window.todoSortable.option('disabled', !canSort);
        }
    }

    // ─────────────────────────────────────────────
    // DRAG & DROP
    // ─────────────────────────────────────────────
    window.todoSortable = new Sortable(todoList, {
        animation: 200,
        handle: '.drag-handle',
        ghostClass: 'sortable-ghost',
        dragClass: 'sortable-drag',
        onEnd: async (evt) => {
            if (evt.oldIndex === evt.newIndex) return;
            const moved = allTasks.splice(evt.oldIndex, 1)[0];
            allTasks.splice(evt.newIndex, 0, moved);
            try {
                const res = await authFetch(`${API_URL}/tasks/reorder`, {
                    method: 'PUT',
                    body: JSON.stringify({ tasks: allTasks.map((t, i) => ({ id: t.id, order_index: i })) })
                });
                if (!res.ok) throw new Error();
                showToast('¡Orden guardado! ↕️', 'success');
            } catch { showToast('Error al guardar el orden', 'error'); await loadTasks(); }
        }
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = input.value.trim();
        if (!text) return;
        const detectedDate = parseNaturalDate(text);
        const taskId = await addTodo(text);
        if (detectedDate && taskId) saveTaskDate(taskId, detectedDate);
        input.value = '';
        charCounter.textContent = '0/500';
        charCounter.className = 'char-counter';
        datePreview.textContent = '';
        datePreview.style.display = 'none';
    });

    // ─────────────────────────────────────────────
    // CONFETTI
    // ─────────────────────────────────────────────
    function launchConfetti() {
        if (typeof confetti === 'function') {
            confetti({ particleCount: 100, spread: 80, origin: { y: 0.6 }, colors: ['#9333ea','#6366f1','#f472b6','#10b981'] });
        }
    }

    // ─────────────────────────────────────────────
    // API
    // ─────────────────────────────────────────────
    async function loadTasks() {
        try {
            showLoading();
            const url = showArchived ? `${API_URL}/tasks?archived=true` : `${API_URL}/tasks`;
            const res = await authFetch(url);
            if (!res.ok) throw new Error();
            allTasks = await res.json();
            applyFilter();
            if (statsVisible) renderStats();
        } catch {
            showToast('No se pudo conectar al servidor', 'error');
            todoList.innerHTML = `<li class="empty-msg" style="color:var(--danger)">🚨 Error de conexión</li>`;
        }
    }

    async function addTodo(text) {
        playSound('add');
        showToast(`Tarea añadida`, 'success');
        logActivity('crear', text);
        awardPoints(1, 0);
        try {
            const res = await authFetch(`${API_URL}/tasks`, { method: 'POST', body: JSON.stringify({ text }) });
            if (!res.ok) throw new Error();
            const newTask = await res.json();
            allTasks.unshift(newTask);
            const isVisible = activeFilter !== 'done' && (!searchQuery || newTask.text.toLowerCase().includes(searchQuery));
            if (isVisible) {
                todoList.querySelector('.empty-msg')?.remove();
                const li = renderTodoItem(newTask);
                li.classList.add('todo-item--entering');
                todoList.prepend(li);
            }
            updateCount();
            return newTask.id;
        } catch { showToast('No se pudo guardar la tarea', 'error'); return null; }
    }

    async function toggleTodo(id, element) {
        if (element.dataset.saving === 'true') return;
        element.dataset.saving = 'true';
        element.style.opacity = '0.6';
        element.style.pointerEvents = 'none';

        const isNowCompleted = !element.classList.contains('completed');
        const idx = allTasks.findIndex(t => t.id === id);
        if (idx !== -1) allTasks[idx].completed = isNowCompleted;
        element.classList.toggle('completed');
        updateCount();

        try {
            const res = await authFetch(`${API_URL}/tasks/${id}`, { method: 'PUT', body: JSON.stringify({ completed: isNowCompleted }) });
            if (!res.ok) throw new Error();
            if (isNowCompleted) {
                playSound('complete');
                logActivity('completar', allTasks[idx]?.text || '');
                awardPoints(2, 1);
                completedStreak++;
                const pending = allTasks.filter(t => !t.completed).length;
                if (pending === 0 && allTasks.length > 0) { showToast('¡Todas completadas! 🎉', 'magic'); launchConfetti(); }
                else if (completedStreak === 3) { showToast('¡Estás on fire! 🔥', 'fire'); completedStreak = 0; }
                else showToast('¡Una menos!', 'success');
                if (statsVisible) renderStats();
                const rec = getRecurrence(id);
                if (rec !== 'none') {
                    const taskText = allTasks[idx]?.text || '';
                    setTimeout(async () => {
                        const newId = await addTodo(taskText);
                        if (newId) {
                            setRecurrence(newId, rec);
                            showToast(`Tarea recreada (${RECURRENCE_LABELS[rec]})`, 'info');
                        }
                    }, 1200);
                }
            } else { completedStreak = 0; }
        } catch {
            if (idx !== -1) allTasks[idx].completed = !isNowCompleted;
            element.classList.toggle('completed');
            updateCount();
            showToast('Error de conexión', 'error');
        } finally {
            element.dataset.saving = 'false';
            element.style.opacity = '';
            element.style.pointerEvents = '';
        }
    }

    async function archiveTodo(id, element) {
        playSound('delete');
        const task = allTasks.find(t => t.id === id);
        if (!task) return;
        element.style.animation = 'fadeOut 0.3s ease forwards';
        if (task) logActivity('archivar', task.text);
        setTimeout(() => applyFilter(), 300);
        try {
            await apiArchiveTask(id);
            showToast('Tarea archivada 📦', 'info', 'Deshacer', async () => {
                try { await apiRestoreTask(id); await loadTasks(); showToast('Tarea restaurada', 'success'); }
                catch { showToast('Error al restaurar', 'error'); }
            });
        } catch {
            showToast('Error al archivar', 'error');
        }
    }

    async function deleteTodoPermanent(id, element) {
        playSound('delete');
        allTasks = allTasks.filter(t => t.id !== id);
        element.style.animation = 'fadeOut 0.3s ease forwards';
        setTimeout(() => applyFilter(), 300);
        try {
            const res = await authFetch(`${API_URL}/tasks/${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error();
            showToast('Tarea eliminada permanentemente 🗑️', 'warning');
        } catch {
            showToast('No se pudo eliminar', 'error');
        }
    }

    async function duplicateTodo(id) {
        const original = allTasks.find(t => t.id === id);
        if (!original) return;
        await addTodo(original.text);
        showToast('Tarea duplicada', 'info');
    }

    async function updateTaskText(id, newText, element) {
        try {
            const res = await authFetch(`${API_URL}/tasks/${id}`, { method: 'PATCH', body: JSON.stringify({ text: newText }) });
            if (!res.ok) throw new Error();
            const updated = await res.json();
            element.querySelector('.todo-text').textContent = updated.text;
            const t = allTasks.find(t => t.id === id);
            if (t) t.text = updated.text;
        } catch { showToast('Error al guardar el texto', 'error'); }
    }

    // ─── Archive / Restore / Date ─────────────────
    async function apiArchiveTask(id) {
        const res = await authFetch(`${API_URL}/tasks/${id}/archive`, { method: 'PUT' });
        if (!res.ok) throw new Error();
        return res.json();
    }

    async function apiRestoreTask(id) {
        const res = await authFetch(`${API_URL}/tasks/${id}/restore`, { method: 'PUT' });
        if (!res.ok) throw new Error();
        return res.json();
    }

    async function apiSetTaskDate(id, dueDate) {
        const res = await authFetch(`${API_URL}/tasks/${id}/date`, { method: 'PATCH', body: JSON.stringify({ due_date: dueDate }) });
        if (!res.ok) throw new Error();
        return res.json();
    }

    // ─────────────────────────────────────────────
    // RENDERIZADO
    // ─────────────────────────────────────────────
    function renderDueBadge(taskId) {
        const date = getTaskDate(taskId);
        if (!date) return '';
        const diff = Math.floor((date - new Date()) / (1000 * 60 * 60 * 24));
        const cls   = diff < 0 ? 'overdue' : diff === 0 ? 'today' : 'upcoming';
        const label = diff < 0 ? 'Vencida' : diff === 0 ? 'Hoy' : formatDateShort(date);
        return `<span class="due-badge due-badge--${cls}">${label}</span>`;
    }

    function renderTodoItem(todo) {
        const isArchived = showArchived;
        const li = document.createElement('li');
        li.className = `todo-item ${todo.completed ? 'completed' : ''} ${isArchived ? 'archived' : ''}`;
        li.dataset.id = todo.id;

        const note        = getNote(todo.id);
        const dueBadge    = renderDueBadge(todo.id);
        const priority    = getPriority(todo.id);
        const priMeta     = PRIORITY_META[priority];
        const tags        = parseTags(todo.text);
        const tagChips    = tags.map(t =>
            `<span class="tag-chip${t === activeTag ? ' active' : ''}" data-tag="${t}">${t}</span>`
        ).join('');
        const recurrence  = getRecurrence(todo.id);
        const recBadge    = recurrence !== 'none'
            ? `<span class="recurrence-badge" title="Recurrencia: ${RECURRENCE_LABELS[recurrence]}">↻ ${RECURRENCE_LABELS[recurrence]}</span>` : '';

        li.innerHTML = `
            <div class="drag-handle" title="Arrastrar">⋮⋮</div>
            <div class="checkbox" role="button" aria-label="Marcar como completado" tabindex="0"></div>
            <div class="todo-main">
                <div class="todo-top-row">
                    <span class="priority-dot" data-priority="${priority}" style="color:${priMeta.color}"
                        title="${priority === 'none' ? 'Sin prioridad — clic para cambiar' : 'Prioridad ' + priMeta.label}">●</span>
                    <span class="todo-text">${escapeHTML(todo.text)}</span>
                    ${dueBadge}
                </div>
                ${tagChips ? `<div class="tag-row">${tagChips}</div>` : ''}
                <div class="todo-meta-row">
                    <div class="todo-note-area ${note ? 'has-note' : ''}">
                        <button class="note-toggle-btn" title="Notas" aria-label="Notas">
                            <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                            ${note ? '<span class="note-dot"></span>' : ''}
                        </button>
                    </div>
                    <button class="subtask-toggle-btn" title="Subtareas" aria-label="Subtareas">
                        <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
                        ${(todo.subtasks?.length > 0) ? `<span class="subtask-count-badge">${todo.subtasks.length}</span>` : ''}
                    </button>
                    <select class="recurrence-select" title="Recurrencia" aria-label="Recurrencia">
                        <option value="none"${recurrence === 'none' ? ' selected' : ''}>Sin recurrencia</option>
                        <option value="daily"${recurrence === 'daily' ? ' selected' : ''}>Diaria</option>
                        <option value="weekly"${recurrence === 'weekly' ? ' selected' : ''}>Semanal</option>
                        <option value="monthly"${recurrence === 'monthly' ? ' selected' : ''}>Mensual</option>
                    </select>
                    ${recBadge}
                </div>
                <div class="note-panel" style="display:none;">
                    <textarea class="note-textarea" placeholder="Escribe una nota..." rows="3">${escapeHTML(note)}</textarea>
                </div>
                <div class="subtask-container" style="display:none;"></div>
            </div>
            <div class="task-actions">
                ${isArchived ? `
                <button class="action-btn restore-btn" title="Restaurar" aria-label="Restaurar">
                    <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-9-9"/><polyline points="12 3 12 9 18 9"/></svg>
                </button>
                <button class="delete-btn delete-permanent-btn" title="Borrar permanentemente" aria-label="Borrar">
                    <svg viewBox="0 0 24 24" width="17" height="17" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
                ` : `
                <button class="action-btn duplicate-btn" title="Duplicar" aria-label="Duplicar">
                    <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                </button>
                <button class="delete-btn archive-action-btn" title="Archivar" aria-label="Archivar">
                    <svg viewBox="0 0 24 24" width="17" height="17" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
                </button>
                `}
            </div>
        `;

        const checkbox       = li.querySelector('.checkbox');
        const dupBtn         = li.querySelector('.duplicate-btn');
        const textSpan       = li.querySelector('.todo-text');
        const noteToggle     = li.querySelector('.note-toggle-btn');
        const notePanel      = li.querySelector('.note-panel');
        const noteTA         = li.querySelector('.note-textarea');
        const priorityDot    = li.querySelector('.priority-dot');
        const subtaskToggle  = li.querySelector('.subtask-toggle-btn');
        const subtaskCont    = li.querySelector('.subtask-container');
        const recurrenceSel  = li.querySelector('.recurrence-select');

        checkbox.addEventListener('click', () => toggleTodo(todo.id, li));

        if (isArchived) {
            const restoreBtn = li.querySelector('.restore-btn');
            const deletePermBtn = li.querySelector('.delete-permanent-btn');
            if (restoreBtn) restoreBtn.addEventListener('click', async () => {
                try { await apiRestoreTask(todo.id); await loadTasks(); showToast('Tarea restaurada', 'success'); }
                catch { showToast('Error al restaurar', 'error'); }
            });
            if (deletePermBtn) deletePermBtn.addEventListener('click', async () => {
                if (!confirm('¿Eliminar esta tarea permanentemente?')) return;
                await deleteTodoPermanent(todo.id, li);
                await loadTasks();
            });
        } else {
            const archiveBtn = li.querySelector('.archive-action-btn');
            if (dupBtn) dupBtn.addEventListener('click', () => duplicateTodo(todo.id));
            if (archiveBtn) archiveBtn.addEventListener('click', () => archiveTodo(todo.id, li));
        }

        priorityDot.addEventListener('click', () => cyclePriority(todo.id, priorityDot));

        recurrenceSel.addEventListener('change', () => {
            setRecurrence(todo.id, recurrenceSel.value);
            const badge = li.querySelector('.recurrence-badge');
            if (badge) badge.remove();
            if (recurrenceSel.value !== 'none') {
                const span = document.createElement('span');
                span.className = 'recurrence-badge';
                span.title = `Recurrencia: ${RECURRENCE_LABELS[recurrenceSel.value]}`;
                span.textContent = `↻ ${RECURRENCE_LABELS[recurrenceSel.value]}`;
                recurrenceSel.after(span);
            }
        });

        li.querySelectorAll('.tag-chip').forEach(chip => {
            chip.addEventListener('click', (e) => {
                e.stopPropagation();
                const tag = chip.dataset.tag;
                setActiveTag(activeTag === tag ? null : tag);
            });
        });

        noteToggle.addEventListener('click', () => {
            const open = notePanel.style.display !== 'none';
            notePanel.style.display = open ? 'none' : 'block';
            if (!open) { noteTA.focus(); noteTA.style.height = 'auto'; noteTA.style.height = noteTA.scrollHeight + 'px'; }
        });
        noteTA.addEventListener('input', () => { noteTA.style.height = 'auto'; noteTA.style.height = noteTA.scrollHeight + 'px'; });
        noteTA.addEventListener('blur', () => {
            saveNote(todo.id, noteTA.value);
            const hasNote = !!noteTA.value.trim();
            li.querySelector('.todo-note-area').classList.toggle('has-note', hasNote);
            const dot = noteToggle.querySelector('.note-dot');
            if (hasNote && !dot) { const d = document.createElement('span'); d.className = 'note-dot'; noteToggle.appendChild(d); }
            else if (!hasNote && dot) dot.remove();
        });

        subtaskToggle.addEventListener('click', () => {
            const open = subtaskCont.style.display !== 'none';
            if (open) { subtaskCont.style.display = 'none'; return; }
            subtaskCont.style.display = 'block';
            if (!subtaskCont.hasChildNodes()) subtaskCont.appendChild(buildSubtaskPanel(todo.id));
        });

        textSpan.addEventListener('dblclick', () => {
            if (li.classList.contains('completed')) return;
            const orig = textSpan.textContent;
            const inp = document.createElement('input');
            inp.type = 'text'; inp.value = orig; inp.className = 'edit-input';
            textSpan.replaceWith(inp); inp.focus(); inp.select();
            const save = async () => {
                const newText = inp.value.trim();
                inp.replaceWith(textSpan);
                if (newText && newText !== orig) { textSpan.textContent = newText; await updateTaskText(todo.id, newText, li); }
                else textSpan.textContent = orig;
            };
            inp.addEventListener('blur', save);
            inp.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') inp.blur();
                if (e.key === 'Escape') { inp.value = orig; inp.blur(); }
            });
        });

        return li;
    }

    function updateCount() {
        const total   = allTasks.length;
        const done    = allTasks.filter(t => t.completed).length;
        const pending = total - done;
        const pct     = total > 0 ? Math.round((done / total) * 100) : 0;

        taskCount.textContent = showArchived ? total : pending;
        animateBadgeUpdate(badgeAll, total);
        animateBadgeUpdate(badgePending, pending);
        animateBadgeUpdate(badgeDone, done);
        if (pending > 5) badgePending.classList.add('urgent'); else badgePending.classList.remove('urgent');

        if (!pomodoroInterval) {
            document.title = showArchived ? `(📦 ${total}) Infinity To-Do` : pending > 0 ? `(${pending}) Infinity To-Do` : 'Infinity To-Do';
        }

        if (showArchived) {
            progressBar.style.width = '0%';
            progressLabel.textContent = 'Vista de archivadas';
            progressPct.textContent = `📦 ${total}`;
            progressPct.style.color = 'var(--text-muted)';
        } else {
            progressBar.style.width   = `${pct}%`;
            progressLabel.textContent = `${done} de ${total} completadas`;
            progressPct.textContent   = `${pct}%`;
            progressPct.style.color   = pct === 100 ? 'var(--success)' : pct >= 50 ? 'var(--accent)' : 'var(--text-muted)';
        }

        listControls.style.display = !showArchived && total > 0 ? 'flex' : 'none';
        toggleAllBtn.innerHTML = (total > 0 && done === total) ? '🟩 Desmarcar todas' : '☑️ Marcar todas';
    }

    function animateBadgeUpdate(element, newValue) {
        if (!element) return;
        const prev = parseInt(element.textContent) || 0;
        element.textContent = newValue;
        element.classList.toggle('zero', newValue === 0);
        if (prev !== newValue) { element.classList.remove('pop'); void element.offsetWidth; element.classList.add('pop'); }
    }

    function showLoading() {
        todoList.innerHTML = `
            <li class="skeleton"></li>
            <li class="skeleton" style="width:85%;opacity:0.7;animation-delay:0.15s"></li>
            <li class="skeleton" style="width:70%;opacity:0.5;animation-delay:0.3s"></li>
        `;
    }

    function escapeHTML(str) {
        return String(str).replace(/[&<>'"]/g, tag => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[tag] || tag));
    }

    // ─── Arrancar ───────────────────────────────
    initAuth();

    // ─── Service Worker (PWA) ───────────────────
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
            .catch(() => { /* SW no crítico — la app funciona sin él */ });
    }
});
