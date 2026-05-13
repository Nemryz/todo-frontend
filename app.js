const API_URL           = 'https://todo-api-backend-t5pj.onrender.com';
const SUPABASE_URL      = 'https://khyoesumffyfkwsrxkzm.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_FzQ38GSuCVGWIc3K7eTHDA_aub4_Yqi';

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

document.addEventListener('DOMContentLoaded', () => {

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

    // Auth
    const authModal    = document.getElementById('auth-modal');
    const authEmail    = document.getElementById('auth-email');
    const authPassword = document.getElementById('auth-password');
    const authError    = document.getElementById('auth-error');
    const btnLogin     = document.getElementById('btn-login');
    const btnRegister  = document.getElementById('btn-register');
    const btnLogout    = document.getElementById('btn-logout');
    const appDiv       = document.getElementById('app');

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
    const pomodoroBar       = document.getElementById('pomodoro-bar');
    const pomodoroTimeEl    = document.getElementById('pomodoro-time');
    const pomodoroTaskLabel = document.getElementById('pomodoro-task-label');
    const pomodoroStop      = document.getElementById('pomodoro-stop');

    // ─── Estado ─────────────────────────────────────────────
    let allTasks        = [];
    let activeFilter    = 'all';
    let searchQuery     = '';
    let sortOrder       = 'default';
    let confirmTimer    = null;
    let completedStreak = 0;
    let currentSession  = null;
    let focusMode       = false;
    let undoStack       = [];
    let viewMode        = localStorage.getItem('todo-view') || 'list';
    let statsVisible    = false;

    // Pomodoro state
    let pomodoroTaskId   = null;
    let pomodoroInterval = null;
    let pomodoroRemaining = 25 * 60;
    const POMODORO_SECS  = 25 * 60;

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
            currentSession = session;
            if (session) showApp(); else showAuthModal();
        });
    }

    function showAuthModal() { authModal.style.display = 'flex'; appDiv.style.display = 'none'; allTasks = []; }
    function showApp() { authModal.style.display = 'none'; appDiv.style.display = 'flex'; checkBackendStatus(); loadTasks(); }

    async function checkBackendStatus() {
        const dot = document.getElementById('backend-status');
        try {
            const res = await fetch(`${API_URL}/`, { signal: AbortSignal.timeout(6000) });
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
        return (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) ? 'office' : 'cosmos';
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
    }
    function getTaskDate(taskId) {
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
    // 30. POMODORO TIMER
    // ─────────────────────────────────────────────
    function getPomodoroCount(taskId) {
        return (JSON.parse(localStorage.getItem('todo-pomodoro-stats') || '{}'))[taskId] || 0;
    }
    function getPomodoroTotal() {
        const s = JSON.parse(localStorage.getItem('todo-pomodoro-stats') || '{}');
        return Object.values(s).reduce((a, b) => a + b, 0);
    }

    function startPomodoro(taskId, taskText) {
        if (pomodoroInterval) clearInterval(pomodoroInterval);
        pomodoroTaskId = taskId;
        pomodoroRemaining = POMODORO_SECS;

        if (Notification.permission === 'default') Notification.requestPermission();

        pomodoroBar.style.display = 'flex';
        pomodoroTaskLabel.textContent = taskText.length > 28 ? taskText.slice(0, 28) + '…' : taskText;
        updatePomodoroDisplay();
        syncPomodoroButtons();

        pomodoroInterval = setInterval(() => {
            pomodoroRemaining--;
            updatePomodoroDisplay();
            if (pomodoroRemaining <= 0) {
                clearInterval(pomodoroInterval);
                onPomodoroComplete(taskId, taskText);
            }
        }, 1000);

        showToast(`Pomodoro iniciado — 25 min`, 'info');
    }

    function stopPomodoro(silent = false) {
        clearInterval(pomodoroInterval);
        pomodoroInterval = null;
        pomodoroTaskId = null;
        pomodoroBar.style.display = 'none';
        updateCount();
        syncPomodoroButtons();
        if (!silent) showToast('Pomodoro cancelado', 'info');
    }

    function updatePomodoroDisplay() {
        const min = Math.floor(pomodoroRemaining / 60).toString().padStart(2, '0');
        const sec = (pomodoroRemaining % 60).toString().padStart(2, '0');
        pomodoroTimeEl.textContent = `${min}:${sec}`;
        document.title = `🍅 ${min}:${sec} — Infinity To-Do`;
    }

    function onPomodoroComplete(taskId, taskText) {
        const stats = JSON.parse(localStorage.getItem('todo-pomodoro-stats') || '{}');
        stats[taskId] = (stats[taskId] || 0) + 1;
        localStorage.setItem('todo-pomodoro-stats', JSON.stringify(stats));

        pomodoroBar.style.display = 'none';
        pomodoroTaskId = null;
        pomodoroInterval = null;
        updateCount();
        syncPomodoroButtons();

        if (Notification.permission === 'granted') {
            new Notification('🍅 Pomodoro completado', { body: `"${taskText}" — Tómate un descanso de 5 minutos.` });
        }
        showToast('¡Pomodoro completado! Descansa 5 min 🍅', 'magic');
    }

    function syncPomodoroButtons() {
        document.querySelectorAll('.pomodoro-btn').forEach(btn => {
            const id = parseInt(btn.closest('.todo-item')?.dataset.id);
            const isRunning = pomodoroInterval && pomodoroTaskId === id;
            btn.classList.toggle('running', isRunning);
            btn.title = isRunning ? 'Detener Pomodoro' : 'Iniciar Pomodoro (25 min)';
            btn.querySelector('.pomodoro-btn-icon').textContent = isRunning ? '⏹' : '🍅';
        });
    }

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
        document.getElementById('stat-pomodoros').textContent = getPomodoroTotal();
    }

    // ─────────────────────────────────────────────
    // PALETA DE COMANDOS (Ctrl+K)
    // ─────────────────────────────────────────────
    const COMMANDS = [
        { label:'Nueva tarea',            icon:'✏️',  action: () => { closeCommandPalette(); input.focus(); } },
        { label:'Buscar tareas',           icon:'🔍', action: () => { closeCommandPalette(); searchInput.focus(); } },
        { label:'Vista grid / lista',      icon:'⊞',  action: () => { closeCommandPalette(); applyViewMode(viewMode === 'list' ? 'grid' : 'list'); } },
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
    // LIMPIAR COMPLETADAS
    // ─────────────────────────────────────────────
    clearBtn.addEventListener('click', async () => {
        if (!clearBtn.classList.contains('confirming')) {
            clearBtn.classList.add('confirming');
            clearBtn.textContent = '⚠️ ¿Confirmar? (clic de nuevo)';
            confirmTimer = setTimeout(() => { clearBtn.classList.remove('confirming'); clearBtn.textContent = '🗑️ Limpiar completadas'; }, 3000);
        } else {
            clearTimeout(confirmTimer);
            clearBtn.classList.remove('confirming');
            clearBtn.textContent = '🗑️ Limpiar completadas';
            const completed = allTasks.filter(t => t.completed);
            await Promise.all(completed.map(t => authFetch(`${API_URL}/tasks/${t.id}`, { method: 'DELETE' })));
            await loadTasks();
            showToast(`${completed.length} tareas eliminadas 🧹`, 'magic');
        }
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
    filterBtns.forEach(btn => {
        btn.classList.toggle('active', btn.id === `filter-${savedFilter}`);
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeFilter = btn.id.replace('filter-', '');
            localStorage.setItem('todo-filter', activeFilter);
            applyFilter();
        });
    });

    searchInput.addEventListener('input', (e) => { searchQuery = e.target.value.toLowerCase().trim(); applyFilter(); });

    function applyFilter() {
        let filtered = allTasks;
        if (activeFilter === 'pending') filtered = allTasks.filter(t => !t.completed);
        if (activeFilter === 'done')    filtered = allTasks.filter(t => t.completed);
        if (searchQuery) filtered = filtered.filter(t => t.text.toLowerCase().includes(searchQuery));
        filtered = sortTasks(filtered);

        todoList.innerHTML = '';
        if (!filtered.length) {
            todoList.innerHTML = `<li class="empty-msg">✨ No hay tareas aquí</li>`;
        } else {
            filtered.forEach(todo => todoList.appendChild(renderTodoItem(todo)));
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
            const res = await authFetch(`${API_URL}/tasks`);
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
                logActivity('completar', allTasks[idx]?.text || '');
                awardPoints(2, 1);
                completedStreak++;
                const pending = allTasks.filter(t => !t.completed).length;
                if (pending === 0 && allTasks.length > 0) { showToast('¡Todas completadas! 🎉', 'magic'); launchConfetti(); }
                else if (completedStreak === 3) { showToast('¡Estás on fire! 🔥', 'fire'); completedStreak = 0; }
                else showToast('¡Una menos!', 'success');
                if (statsVisible) renderStats();
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

    async function deleteTodo(id, element) {
        const backup = allTasks.find(t => t.id === id);
        allTasks = allTasks.filter(t => t.id !== id);
        element.style.animation = 'fadeOut 0.3s ease forwards';
        if (backup) logActivity('eliminar', backup.text);
        setTimeout(() => applyFilter(), 300);
        try {
            const res = await authFetch(`${API_URL}/tasks/${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error();
            if (backup) pushUndo({ type: 'delete', task: backup });
            showToast('Tarea eliminada', 'warning', 'Deshacer', () => undoLastAction());
        } catch {
            if (backup) { allTasks.push(backup); applyFilter(); }
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
        const li = document.createElement('li');
        li.className = `todo-item ${todo.completed ? 'completed' : ''}`;
        li.dataset.id = todo.id;

        const note     = getNote(todo.id);
        const pCount   = getPomodoroCount(todo.id);
        const dueBadge = renderDueBadge(todo.id);

        li.innerHTML = `
            <div class="drag-handle" title="Arrastrar">⋮⋮</div>
            <div class="checkbox" role="button" aria-label="Marcar como completado" tabindex="0"></div>
            <div class="todo-main">
                <div class="todo-top-row">
                    <span class="todo-text">${escapeHTML(todo.text)}</span>
                    ${dueBadge}
                </div>
                <div class="todo-note-area ${note ? 'has-note' : ''}">
                    <button class="note-toggle-btn" title="Notas" aria-label="Notas">
                        <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                        ${note ? '<span class="note-dot"></span>' : ''}
                    </button>
                    <div class="note-panel" style="display:none;">
                        <textarea class="note-textarea" placeholder="Escribe una nota..." rows="3">${escapeHTML(note)}</textarea>
                    </div>
                </div>
            </div>
            <div class="task-actions">
                <button class="action-btn pomodoro-btn ${pomodoroInterval && pomodoroTaskId === todo.id ? 'running' : ''}"
                    title="${pomodoroInterval && pomodoroTaskId === todo.id ? 'Detener Pomodoro' : 'Iniciar Pomodoro (25 min)'}"
                    aria-label="Pomodoro">
                    <span class="pomodoro-btn-icon">${pomodoroInterval && pomodoroTaskId === todo.id ? '⏹' : '🍅'}</span>
                    ${pCount > 0 ? `<span class="pomodoro-count">${pCount}</span>` : ''}
                </button>
                <button class="action-btn duplicate-btn" title="Duplicar" aria-label="Duplicar">
                    <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                </button>
                <button class="delete-btn" aria-label="Eliminar">
                    <svg viewBox="0 0 24 24" width="17" height="17" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
            </div>
        `;

        const checkbox    = li.querySelector('.checkbox');
        const deleteBtn   = li.querySelector('.delete-btn');
        const dupBtn      = li.querySelector('.duplicate-btn');
        const pomBtn      = li.querySelector('.pomodoro-btn');
        const textSpan    = li.querySelector('.todo-text');
        const noteToggle  = li.querySelector('.note-toggle-btn');
        const notePanel   = li.querySelector('.note-panel');
        const noteTA      = li.querySelector('.note-textarea');

        checkbox.addEventListener('click', () => toggleTodo(todo.id, li));
        deleteBtn.addEventListener('click', () => deleteTodo(todo.id, li));
        dupBtn.addEventListener('click', () => duplicateTodo(todo.id));

        pomBtn.addEventListener('click', () => {
            if (pomodoroInterval && pomodoroTaskId === todo.id) stopPomodoro();
            else startPomodoro(todo.id, todo.text);
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

        taskCount.textContent = pending;
        animateBadgeUpdate(badgeAll, total);
        animateBadgeUpdate(badgePending, pending);
        animateBadgeUpdate(badgeDone, done);
        if (pending > 5) badgePending.classList.add('urgent'); else badgePending.classList.remove('urgent');

        if (!pomodoroInterval) {
            document.title = pending > 0 ? `(${pending}) Infinity To-Do` : 'Infinity To-Do';
        }

        progressBar.style.width   = `${pct}%`;
        progressLabel.textContent = `${done} de ${total} completadas`;
        progressPct.textContent   = `${pct}%`;
        progressPct.style.color   = pct === 100 ? 'var(--success)' : pct >= 50 ? 'var(--accent)' : 'var(--text-muted)';

        listControls.style.display = total > 0 ? 'flex' : 'none';
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
});
