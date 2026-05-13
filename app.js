const API_URL        = 'https://todo-api-backend-t5pj.onrender.com';
const SUPABASE_URL   = 'https://khyoesumffyfkwsrxkzm.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_FzQ38GSuCVGWIc3K7eTHDA_aub4_Yqi'; // anon key (pública)

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

    // ─── Auth DOM refs ───────────────────────────────────────
    const authModal    = document.getElementById('auth-modal');
    const authEmail    = document.getElementById('auth-email');
    const authPassword = document.getElementById('auth-password');
    const authError    = document.getElementById('auth-error');
    const btnLogin     = document.getElementById('btn-login');
    const btnRegister  = document.getElementById('btn-register');
    const btnLogout    = document.getElementById('btn-logout');
    const appDiv       = document.getElementById('app');

    // ─── Modal DOM refs ──────────────────────────────────────
    const shortcutsModal  = document.getElementById('shortcuts-modal');
    const closeShortcuts  = document.getElementById('close-shortcuts');
    const btnShortcuts    = document.getElementById('btn-shortcuts');
    const exportModal     = document.getElementById('export-modal');
    const closeExport     = document.getElementById('close-export');
    const btnExport       = document.getElementById('btn-export');
    const exportJson      = document.getElementById('export-json');
    const exportCsv       = document.getElementById('export-csv');
    const exportMd        = document.getElementById('export-md');

    // ─── Estado ─────────────────────────────────────────────
    let allTasks        = [];
    let activeFilter    = 'all';
    let searchQuery     = '';
    let confirmTimer    = null;
    let completedStreak = 0;
    let currentSession  = null;
    let focusMode       = false;

    // ─────────────────────────────────────────────
    // TOAST NOTIFICATIONS
    // ─────────────────────────────────────────────
    const toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container';
    document.body.appendChild(toastContainer);

    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        const icons = {
            success: '✅',
            error: '🚨',
            info: '💡',
            warning: '⚠️',
            magic: '✨',
            fire: '🔥'
        };
        toast.innerHTML = `<span>${icons[type] || icons.info}</span> <span>${message}</span>`;
        toastContainer.appendChild(toast);

        requestAnimationFrame(() => toast.classList.add('show'));
        setTimeout(() => {
            toast.classList.remove('show');
            toast.classList.add('hide');
            toast.addEventListener('transitionend', () => toast.remove());
        }, 3000);
    }

    // ─────────────────────────────────────────────
    // TRADUCCIÓN DE ERRORES DE AUTENTICACIÓN
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

    function clearAuthError() {
        authError.innerHTML = '';
    }

    // ─────────────────────────────────────────────
    // AUTENTICACIÓN
    // ─────────────────────────────────────────────
    async function initAuth() {
        const { data: { session } } = await sb.auth.getSession();
        if (session) {
            currentSession = session;
            showApp();
        } else {
            showAuthModal();
        }

        sb.auth.onAuthStateChange((_event, session) => {
            currentSession = session;
            if (session) showApp();
            else showAuthModal();
        });
    }

    function showAuthModal() {
        authModal.style.display = 'flex';
        appDiv.style.display    = 'none';
        allTasks = [];
    }

    function showApp() {
        authModal.style.display = 'none';
        appDiv.style.display    = 'flex';
        checkBackendStatus();
        loadTasks();
    }

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
        const email    = authEmail.value.trim();
        const password = authPassword.value;
        if (!email || !password) return;
        clearAuthError();
        btnLogin.disabled = true;
        const { error } = await sb.auth.signInWithPassword({ email, password });
        btnLogin.disabled = false;
        if (error) showAuthError(translateAuthError(error));
    });

    btnRegister.addEventListener('click', async () => {
        const email    = authEmail.value.trim();
        const password = authPassword.value;
        if (!email || !password) return;
        clearAuthError();
        btnRegister.disabled = true;
        const { error } = await sb.auth.signUp({ email, password });
        btnRegister.disabled = false;
        if (error) {
            showAuthError(translateAuthError(error));
        } else {
            authError.style.color = 'var(--success)';
            authError.innerHTML = '<strong>Cuenta creada.</strong> <em>Revisa tu correo para confirmar tu dirección antes de iniciar sesión.</em>';
        }
    });

    btnLogout.addEventListener('click', async () => {
        await sb.auth.signOut();
        showToast('Sesión cerrada', 'info');
    });

    // ─────────────────────────────────────────────
    // authFetch — añade JWT en cada request
    // ─────────────────────────────────────────────
    async function authFetch(url, options = {}) {
        if (!currentSession) throw new Error('No autenticado');
        const headers = { 'Authorization': `Bearer ${currentSession.access_token}` };
        if (options.body) headers['Content-Type'] = 'application/json';
        return fetch(url, { ...options, headers: { ...headers, ...(options.headers || {}) } });
    }

    // ─────────────────────────────────────────────
    // SISTEMA DE TEMAS
    // ─────────────────────────────────────────────
    const themes = ['cosmos', 'hacker', 'office', 'minimal', 'nord', 'sakura', 'sunset', 'contrast'];
    const themeBtns = {};
    themes.forEach(t => {
        const el = document.getElementById(`theme-${t}`);
        if (el) themeBtns[t] = el;
    });

    function applyTheme(theme) {
        themes.forEach(t => document.body.classList.remove(`theme-${t}`));
        if (theme !== 'cosmos') document.body.classList.add(`theme-${theme}`);
        Object.values(themeBtns).forEach(btn => btn.classList.remove('active'));
        if (themeBtns[theme]) themeBtns[theme].classList.add('active');
        localStorage.setItem('todo-theme', theme);
    }

    function cycleTheme() {
        const current = localStorage.getItem('todo-theme') || 'cosmos';
        const idx = themes.indexOf(current);
        const next = themes[(idx + 1) % themes.length];
        applyTheme(next);
        showToast(`Tema: ${next.charAt(0).toUpperCase() + next.slice(1)}`, 'info');
    }

    const savedTheme = localStorage.getItem('todo-theme') || 'cosmos';
    applyTheme(savedTheme);

    Object.entries(themeBtns).forEach(([theme, btn]) => {
        btn.addEventListener('click', () => applyTheme(theme));
    });

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
    // MODALES DE ATAJOS Y EXPORTAR
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
    // EXPORTAR TAREAS
    // ─────────────────────────────────────────────
    function downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }

    function exportTasks(format) {
        if (allTasks.length === 0) { showToast('No hay tareas para exportar', 'warning'); return; }
        const now = new Date().toISOString().slice(0, 10);
        if (format === 'json') {
            const clean = allTasks.map(({ id, text, completed, order_index }) => ({ id, text, completed, order_index }));
            downloadFile(JSON.stringify(clean, null, 2), `tareas-${now}.json`, 'application/json');
        }
        if (format === 'csv') {
            const header = 'id,texto,completada,orden';
            const rows = allTasks.map(t =>
                `${t.id},"${(t.text || '').replace(/"/g, '""')}",${t.completed},${t.order_index}`
            );
            downloadFile([header, ...rows].join('\n'), `tareas-${now}.csv`, 'text/csv;charset=utf-8;');
        }
        if (format === 'markdown') {
            const lines = allTasks.map(t => `- [${t.completed ? 'x' : ' '}] ${t.text}`);
            downloadFile(lines.join('\n'), `tareas-${now}.md`, 'text/markdown');
        }
        closeExportModal();
        showToast(`Tareas exportadas como ${format.toUpperCase()}`, 'success');
    }

    if (exportJson) exportJson.addEventListener('click', () => exportTasks('json'));
    if (exportCsv)  exportCsv.addEventListener('click',  () => exportTasks('csv'));
    if (exportMd)   exportMd.addEventListener('click',   () => exportTasks('markdown'));

    // ─────────────────────────────────────────────
    // GAMIFICACIÓN (localStorage)
    // ─────────────────────────────────────────────
    const LEVELS = [
        { name: 'Bronce',   min: 0    },
        { name: 'Plata',    min: 100  },
        { name: 'Oro',      min: 500  },
        { name: 'Diamante', min: 2000 },
    ];

    const ACHIEVEMENTS = [
        { id: 'first',    label: 'Primera tarea',     check: (pts, count) => count >= 1 },
        { id: 'ten',      label: '10 tareas totales',  check: (pts, count) => count >= 10 },
        { id: 'fifty',    label: '50 tareas totales',  check: (pts, count) => count >= 50 },
        { id: 'silver',   label: 'Nivel Plata',        check: (pts)        => pts >= 100 },
        { id: 'gold',     label: 'Nivel Oro',          check: (pts)        => pts >= 500 },
        { id: 'diamond',  label: 'Nivel Diamante',     check: (pts)        => pts >= 2000 },
    ];

    function getGamification() {
        return JSON.parse(localStorage.getItem('todo-gamification') || '{"points":0,"totalCompleted":0,"achievements":[]}');
    }

    function saveGamification(data) {
        localStorage.setItem('todo-gamification', JSON.stringify(data));
    }

    function awardPoints(points, totalCompleted) {
        const data = getGamification();
        data.points         += points;
        data.totalCompleted += totalCompleted;

        const prevLevel = LEVELS.filter(l => l.min <= (data.points - points)).pop();
        const newLevel  = LEVELS.filter(l => l.min <= data.points).pop();
        if (newLevel.name !== prevLevel.name) {
            showToast(`Nivel alcanzado: ${newLevel.name}`, 'magic');
        }

        ACHIEVEMENTS.forEach(ach => {
            if (!data.achievements.includes(ach.id) && ach.check(data.points, data.totalCompleted)) {
                data.achievements.push(ach.id);
                setTimeout(() => showToast(`Logro desbloqueado: ${ach.label}`, 'magic'), 500);
            }
        });

        saveGamification(data);
    }

    // ─────────────────────────────────────────────
    // HISTORIAL DE ACTIVIDAD
    // ─────────────────────────────────────────────
    function logActivity(action, taskText) {
        const history = JSON.parse(localStorage.getItem('todo-history') || '[]');
        history.unshift({ action, taskText, ts: Date.now() });
        if (history.length > 50) history.pop();
        localStorage.setItem('todo-history', JSON.stringify(history));
    }

    // ─────────────────────────────────────────────
    // BOTÓN LIMPIAR COMPLETADAS (2 clics para confirmar)
    // ─────────────────────────────────────────────
    clearBtn.addEventListener('click', async () => {
        if (!clearBtn.classList.contains('confirming')) {
            clearBtn.classList.add('confirming');
            clearBtn.textContent = '⚠️ ¿Confirmar? (clic de nuevo)';
            confirmTimer = setTimeout(() => {
                clearBtn.classList.remove('confirming');
                clearBtn.textContent = '🗑️ Limpiar completadas';
            }, 3000);
        } else {
            clearTimeout(confirmTimer);
            clearBtn.classList.remove('confirming');
            clearBtn.textContent = '🗑️ Limpiar completadas';
            await clearCompleted();
        }
    });

    async function clearCompleted() {
        const completed = allTasks.filter(t => t.completed);
        const count = completed.length;
        await Promise.all(
            completed.map(t => authFetch(`${API_URL}/tasks/${t.id}`, { method: 'DELETE' }))
        );
        await loadTasks();
        showToast(`¡Limpieza completa! ${count} tareas borradas 🧹`, 'magic');
    }

    // ─────────────────────────────────────────────
    // BOTÓN MARCAR / DESMARCAR TODAS
    // ─────────────────────────────────────────────
    toggleAllBtn.addEventListener('click', async () => {
        if (allTasks.length === 0) return;

        const allCompleted  = allTasks.every(t => t.completed);
        const newState      = !allCompleted;
        const tasksToUpdate = allTasks.filter(t => t.completed !== newState);

        if (tasksToUpdate.length === 0) return;

        tasksToUpdate.forEach(t => t.completed = newState);
        applyFilter();
        toggleAllBtn.disabled = true;

        try {
            await Promise.all(
                tasksToUpdate.map(t =>
                    authFetch(`${API_URL}/tasks/${t.id}`, {
                        method: 'PUT',
                        body: JSON.stringify({ completed: newState })
                    })
                )
            );
            showToast(newState ? '¡Todas completadas! 🎉' : 'Todas pendientes de nuevo', 'magic');
        } catch (err) {
            console.error('Error al hacer toggle all:', err);
            showToast('Error de conexión', 'error');
            await loadTasks();
        } finally {
            toggleAllBtn.disabled = false;
        }
    });

    // ─────────────────────────────────────────────
    // ATAJOS DE TECLADO
    // ─────────────────────────────────────────────
    function isTyping() {
        const tag = document.activeElement.tagName;
        return tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement.isContentEditable;
    }

    document.addEventListener('keydown', (e) => {
        // Cerrar modales con Escape
        if (e.key === 'Escape') {
            if (shortcutsModal.style.display !== 'none') { closeShortcutsModal(); return; }
            if (exportModal.style.display !== 'none') { closeExportModal(); return; }
            if (document.activeElement === input || document.activeElement === searchInput) {
                document.activeElement.blur();
            }
            if (searchInput.value !== '') {
                searchInput.value = '';
                searchQuery = '';
                applyFilter();
            }
            return;
        }

        if (isTyping()) return;

        if (e.key === '/') { e.preventDefault(); searchInput.focus(); return; }
        if (e.key === 'n') { e.preventDefault(); input.focus(); return; }
        if (e.key === 'f' || e.key === 'F') { e.preventDefault(); toggleFocusMode(); return; }
        if (e.key === 't' || e.key === 'T') { e.preventDefault(); cycleTheme(); return; }
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

    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase().trim();
        applyFilter();
    });

    function applyFilter() {
        let filtered = allTasks;
        if (activeFilter === 'pending') filtered = allTasks.filter(t => !t.completed);
        if (activeFilter === 'done')    filtered = allTasks.filter(t => t.completed);

        if (searchQuery) {
            filtered = filtered.filter(t => t.text.toLowerCase().includes(searchQuery));
        }

        todoList.innerHTML = '';
        if (filtered.length === 0) {
            todoList.innerHTML = `<li class="empty-msg">✨ No hay tareas aquí</li>`;
        } else {
            filtered.forEach(todo => todoList.appendChild(renderTodoItem(todo)));
        }
        updateCount();

        if (window.todoSortable) {
            const canSort = activeFilter === 'all' && !searchQuery;
            window.todoSortable.option('disabled', !canSort);
        }
    }

    // ─────────────────────────────────────────────
    // DRAG AND DROP (SortableJS)
    // ─────────────────────────────────────────────
    window.todoSortable = new Sortable(todoList, {
        animation: 200,
        handle: '.drag-handle',
        ghostClass: 'sortable-ghost',
        dragClass: 'sortable-drag',
        onEnd: async function (evt) {
            if (evt.oldIndex === evt.newIndex) return;

            const movedItem = allTasks.splice(evt.oldIndex, 1)[0];
            allTasks.splice(evt.newIndex, 0, movedItem);

            showToast('Guardando nuevo orden...', 'info');

            const tasksToUpdate = allTasks.map((t, index) => ({ id: t.id, order_index: index }));

            try {
                const res = await authFetch(`${API_URL}/tasks/reorder`, {
                    method: 'PUT',
                    body: JSON.stringify({ tasks: tasksToUpdate })
                });
                if (!res.ok) throw new Error('Error al guardar el orden');
                showToast('¡Orden guardado en la nube! ↕️', 'success');
            } catch (err) {
                console.error('Error reordenando:', err);
                showToast('Error de conexión al guardar el orden', 'error');
                await loadTasks();
            }
        }
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = input.value.trim();
        if (text !== '') {
            await addTodo(text);
            input.value = '';
        }
    });

    // ─────────────────────────────────────────────
    // CONFETTI
    // ─────────────────────────────────────────────
    function launchConfetti() {
        if (typeof confetti === 'function') {
            confetti({ particleCount: 100, spread: 80, origin: { y: 0.6 }, colors: ['#9333ea', '#6366f1', '#f472b6', '#10b981'] });
        }
    }

    // ─────────────────────────────────────────────
    // FUNCIONES DE LA API
    // ─────────────────────────────────────────────

    async function loadTasks() {
        try {
            showLoading();
            const res = await authFetch(`${API_URL}/tasks`);
            if (!res.ok) throw new Error('Error al cargar tareas');
            allTasks = await res.json();
            applyFilter();
        } catch (err) {
            console.error('Error cargando tareas:', err);
            showToast('No se pudo conectar al servidor', 'error');
            todoList.innerHTML = `<li class="empty-msg" style="color:var(--danger)">🚨 Error de conexión</li>`;
        }
    }

    async function addTodo(text) {
        showToast(`Tarea añadida: "${text}"`, 'success');
        logActivity('crear', text);
        awardPoints(1, 0);
        try {
            const res = await authFetch(`${API_URL}/tasks`, {
                method: 'POST',
                body: JSON.stringify({ text })
            });
            if (!res.ok) throw new Error('Error al crear tarea');
            const newTask = await res.json();
            allTasks.unshift(newTask);

            const isVisible = activeFilter !== 'done' &&
                (!searchQuery || newTask.text.toLowerCase().includes(searchQuery));

            if (isVisible) {
                const emptyMsg = todoList.querySelector('.empty-msg');
                if (emptyMsg) emptyMsg.remove();
                const li = renderTodoItem(newTask);
                li.classList.add('todo-item--entering');
                todoList.prepend(li);
            }
            updateCount();
        } catch (err) {
            console.error('Error creando tarea:', err);
            showToast('No se pudo guardar la tarea', 'error');
        }
    }

    async function toggleTodo(id, element) {
        if (element.dataset.saving === 'true') return;
        element.dataset.saving = 'true';
        element.style.opacity = '0.6';
        element.style.pointerEvents = 'none';

        const isNowCompleted = !element.classList.contains('completed');
        const taskIndex = allTasks.findIndex(t => t.id === id);
        if (taskIndex !== -1) allTasks[taskIndex].completed = isNowCompleted;
        element.classList.toggle('completed');
        updateCount();

        try {
            const res = await authFetch(`${API_URL}/tasks/${id}`, {
                method: 'PUT',
                body: JSON.stringify({ completed: isNowCompleted })
            });
            if (!res.ok) throw new Error('Error al actualizar tarea');

            if (isNowCompleted) {
                const taskText = allTasks[taskIndex] ? allTasks[taskIndex].text : '';
                logActivity('completar', taskText);
                awardPoints(2, 1);
                completedStreak++;

                const pending = allTasks.filter(t => !t.completed).length;
                if (pending === 0 && allTasks.length > 0) {
                    showToast('¡Día libre! Todas completadas 🎉', 'magic');
                    launchConfetti();
                } else if (completedStreak === 3) {
                    showToast('¡Estás on fire! 3 seguidas 🔥', 'fire');
                    completedStreak = 0;
                } else {
                    showToast('¡Una menos!', 'success');
                }
            } else {
                completedStreak = 0;
            }
        } catch (err) {
            if (taskIndex !== -1) allTasks[taskIndex].completed = !isNowCompleted;
            element.classList.toggle('completed');
            updateCount();
            console.error('Error actualizando tarea:', err);
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
        showToast('Tarea eliminada', 'warning');
        setTimeout(() => applyFilter(), 300);
        try {
            const res = await authFetch(`${API_URL}/tasks/${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Error al eliminar tarea');
        } catch (err) {
            if (backup) { allTasks.push(backup); applyFilter(); }
            console.error('Error eliminando tarea:', err);
            showToast('No se pudo eliminar', 'error');
        }
    }

    async function updateTaskText(id, newText, element) {
        try {
            const res = await authFetch(`${API_URL}/tasks/${id}`, {
                method: 'PATCH',
                body: JSON.stringify({ text: newText })
            });
            if (!res.ok) throw new Error('Error al actualizar tarea');
            const updated = await res.json();
            element.querySelector('.todo-text').textContent = updated.text;
        } catch (err) {
            console.error('Error actualizando texto:', err);
            showToast('Error al guardar el texto', 'error');
        }
    }

    // ─────────────────────────────────────────────
    // RENDERIZADO
    // ─────────────────────────────────────────────

    function renderTodoItem(todo) {
        const li = document.createElement('li');
        li.className = `todo-item ${todo.completed ? 'completed' : ''}`;
        li.dataset.id = todo.id;

        li.innerHTML = `
            <div class="drag-handle" title="Arrastrar para mover">⋮⋮</div>
            <div class="checkbox" role="button" aria-label="Marcar como completado" tabindex="0"></div>
            <span class="todo-text">${escapeHTML(todo.text)}</span>
            <button class="delete-btn" aria-label="Eliminar tarea">
                <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
            </button>
        `;

        const checkbox = li.querySelector('.checkbox');
        const deleteBtn = li.querySelector('.delete-btn');
        const textSpan  = li.querySelector('.todo-text');

        checkbox.addEventListener('click', () => toggleTodo(todo.id, li));
        deleteBtn.addEventListener('click', () => deleteTodo(todo.id, li));

        textSpan.addEventListener('dblclick', () => {
            if (li.classList.contains('completed')) return;

            const originalText = textSpan.textContent;
            const editInput = document.createElement('input');
            editInput.type = 'text';
            editInput.value = originalText;
            editInput.className = 'edit-input';

            textSpan.replaceWith(editInput);
            editInput.focus();
            editInput.select();

            const saveEdit = async () => {
                const newText = editInput.value.trim();
                editInput.replaceWith(textSpan);
                if (newText && newText !== originalText) {
                    textSpan.textContent = newText;
                    await updateTaskText(todo.id, newText, li);
                } else {
                    textSpan.textContent = originalText;
                }
            };

            editInput.addEventListener('blur', saveEdit);
            editInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') editInput.blur();
                if (e.key === 'Escape') { editInput.value = originalText; editInput.blur(); }
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

        if (pending > 5) badgePending.classList.add('urgent');
        else badgePending.classList.remove('urgent');

        document.title = pending > 0 ? `(${pending}) Infinity To-Do` : 'Infinity To-Do';

        progressBar.style.width   = `${pct}%`;
        progressLabel.textContent = `${done} de ${total} completadas`;
        progressPct.textContent   = `${pct}%`;

        if (pct === 100)     progressPct.style.color = 'var(--success)';
        else if (pct >= 50)  progressPct.style.color = 'var(--accent)';
        else                 progressPct.style.color = 'var(--text-muted)';

        listControls.style.display = total > 0 ? 'flex' : 'none';
        toggleAllBtn.innerHTML = (total > 0 && done === total)
            ? '🟩 Desmarcar todas'
            : '☑️ Marcar todas';
    }

    function animateBadgeUpdate(element, newValue) {
        if (!element) return;
        const currentValue = parseInt(element.textContent) || 0;
        element.textContent = newValue;

        if (newValue === 0) element.classList.add('zero');
        else element.classList.remove('zero');

        if (currentValue !== newValue) {
            element.classList.remove('pop');
            void element.offsetWidth;
            element.classList.add('pop');
        }
    }

    function showLoading() {
        todoList.innerHTML = `
            <li class="skeleton"></li>
            <li class="skeleton" style="width:85%;opacity:0.7;animation-delay:0.15s"></li>
            <li class="skeleton" style="width:70%;opacity:0.5;animation-delay:0.3s"></li>
        `;
    }

    function escapeHTML(str) {
        return str.replace(/[&<>'"]/g, tag => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
        }[tag] || tag));
    }

    // ─── Arrancar ───────────────────────────────
    initAuth();
});
