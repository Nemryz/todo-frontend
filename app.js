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

    // ─── Estado ─────────────────────────────────────────────
    let allTasks        = [];
    let activeFilter    = 'all';
    let searchQuery     = '';
    let confirmTimer    = null;
    let completedStreak = 0;
    let currentSession  = null;

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
        loadTasks();
    }

    btnLogin.addEventListener('click', async () => {
        const email    = authEmail.value.trim();
        const password = authPassword.value;
        if (!email || !password) return;
        authError.textContent = '';
        btnLogin.disabled = true;
        const { error } = await sb.auth.signInWithPassword({ email, password });
        btnLogin.disabled = false;
        if (error) authError.textContent = error.message;
    });

    btnRegister.addEventListener('click', async () => {
        const email    = authEmail.value.trim();
        const password = authPassword.value;
        if (!email || !password) return;
        authError.textContent = '';
        btnRegister.disabled = true;
        const { error } = await sb.auth.signUp({ email, password });
        btnRegister.disabled = false;
        if (error) authError.textContent = error.message;
        else authError.style.color = 'var(--success)', authError.textContent = '¡Revisa tu correo para confirmar!';
    });

    btnLogout.addEventListener('click', async () => {
        await sb.auth.signOut();
        showToast('Sesión cerrada', 'info');
    });

    // ─────────────────────────────────────────────
    // authFetch — reemplaza fetch() en todos los endpoints
    // Añade automáticamente el token JWT en cada request
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
    const themes = ['cosmos', 'hacker', 'office'];
    const themeBtns = {
        cosmos: document.getElementById('theme-cosmos'),
        hacker: document.getElementById('theme-hacker'),
        office: document.getElementById('theme-office'),
    };

    function applyTheme(theme) {
        themes.forEach(t => document.body.classList.remove(`theme-${t}`));
        if (theme !== 'cosmos') document.body.classList.add(`theme-${theme}`);
        Object.values(themeBtns).forEach(btn => btn.classList.remove('active'));
        themeBtns[theme].classList.add('active');
        localStorage.setItem('todo-theme', theme);
    }

    const savedTheme = localStorage.getItem('todo-theme') || 'cosmos';
    applyTheme(savedTheme);

    Object.entries(themeBtns).forEach(([theme, btn]) => {
        btn.addEventListener('click', () => applyTheme(theme));
    });

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
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (document.activeElement === input || document.activeElement === searchInput) {
                document.activeElement.blur();
            }
            if (searchInput.value !== '') {
                searchInput.value = '';
                searchQuery = '';
                applyFilter();
            }
        }
        if (e.key === '/' && document.activeElement !== input && document.activeElement !== searchInput) {
            e.preventDefault();
            searchInput.focus();
        }
        if (e.key === 'n' && document.activeElement !== input && document.activeElement !== searchInput && document.activeElement.tagName !== 'INPUT') {
            e.preventDefault();
            input.focus();
        }
    });

    // ─────────────────────────────────────────────
    // FILTROS
    // ─────────────────────────────────────────────
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeFilter = btn.id.replace('filter-', '');
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
            filtered.forEach(todo => renderTodoItem(todo));
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
        try {
            const res = await authFetch(`${API_URL}/tasks`, {
                method: 'POST',
                body: JSON.stringify({ text })
            });
            if (!res.ok) throw new Error('Error al crear tarea');
            const newTask = await res.json();
            allTasks.unshift(newTask);
            applyFilter();
            showToast(`Tarea añadida: "${text}"`, 'success');
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
                completedStreak++;
                if (completedStreak === 3) {
                    showToast('¡Estás on fire! 3 seguidas 🔥', 'fire');
                    completedStreak = 0;
                } else if (allTasks.every(t => t.completed) && allTasks.length > 0) {
                    showToast('¡Día libre! Todas completadas 🎉', 'magic');
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
        element.style.animation = 'fadeOut 0.3s ease forwards';
        try {
            const res = await authFetch(`${API_URL}/tasks/${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Error al eliminar tarea');
            setTimeout(() => {
                allTasks = allTasks.filter(t => t.id !== id);
                applyFilter();
                showToast('Tarea eliminada', 'warning');
            }, 300);
        } catch (err) {
            element.style.animation = '';
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

        todoList.appendChild(li);
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
            <li style="text-align:center; color: var(--text-muted); padding: 2rem;">
                Cargando tareas...
            </li>
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
