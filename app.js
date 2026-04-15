const API_URL = 'https://todo-api-backend-t5pj.onrender.com';

document.addEventListener('DOMContentLoaded', () => {
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

    let allTasks     = [];
    let activeFilter = 'all';
    let searchQuery  = '';
    let confirmTimer = null;
    let completedStreak = 0; // Para el mensaje "fire"

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
        const icon = icons[type] || icons.info;

        toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
        toastContainer.appendChild(toast);

        // Animar entrada suavemente
        requestAnimationFrame(() => toast.classList.add('show'));

        // Remover después de 3s
        setTimeout(() => {
            toast.classList.remove('show');
            toast.classList.add('hide');
            toast.addEventListener('transitionend', () => toast.remove());
        }, 3000);
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
        // Quitar todos los temas del body
        themes.forEach(t => document.body.classList.remove(`theme-${t}`));
        // Aplicar el seleccionado (cosmos no necesita clase extra, es el default)
        if (theme !== 'cosmos') document.body.classList.add(`theme-${theme}`);
        // Actualizar botón activo
        Object.values(themeBtns).forEach(btn => btn.classList.remove('active'));
        themeBtns[theme].classList.add('active');
        // Persistir en localStorage
        localStorage.setItem('todo-theme', theme);
    }

    // Cargar tema guardado (o cosmos por defecto)
    const savedTheme = localStorage.getItem('todo-theme') || 'cosmos';
    applyTheme(savedTheme);

    // Eventos de los botones de tema
    Object.entries(themeBtns).forEach(([theme, btn]) => {
        btn.addEventListener('click', () => applyTheme(theme));
    });


    // ─────────────────────────────────────────────
    // BOTÓN LIMPIAR COMPLETADAS (2 clics para confirmar)
    // ─────────────────────────────────────────────
    clearBtn.addEventListener('click', async () => {
        if (!clearBtn.classList.contains('confirming')) {
            // Primer clic: entra en modo confirmación
            clearBtn.classList.add('confirming');
            clearBtn.textContent = '⚠️ ¿Confirmar? (clic de nuevo)';
            // Si en 3 segundos no confirma, cancela solo
            confirmTimer = setTimeout(() => {
                clearBtn.classList.remove('confirming');
                clearBtn.textContent = '🗑️ Limpiar completadas';
            }, 3000);
        } else {
            // Segundo clic: ejecutar eliminación
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
            completed.map(t =>
                fetch(`${API_URL}/tasks/${t.id}`, { method: 'DELETE' })
            )
        );
        await loadTasks();
        showToast(`¡Limpieza completa! ${count} tareas borradas 🧹`, 'magic');
    }

    // ─────────────────────────────────────────────
    // BOTÓN MARCAR / DESMARCAR TODAS
    // ─────────────────────────────────────────────
    toggleAllBtn.addEventListener('click', async () => {
        if (allTasks.length === 0) return;
        
        // Si hay alguna pendiente, marcamos todas como completadas
        // Si todas están completadas, las desmarcamos todas
        const allCompleted = allTasks.every(t => t.completed);
        const newState = !allCompleted;
        
        const tasksToUpdate = allTasks.filter(t => t.completed !== newState);
        const count = tasksToUpdate.length;
        
        if (count === 0) return;

        // Optimistic update
        tasksToUpdate.forEach(t => t.completed = newState);
        applyFilter();
        
        toggleAllBtn.disabled = true;
        
        try {
            await Promise.all(
                tasksToUpdate.map(t =>
                    fetch(`${API_URL}/tasks/${t.id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ completed: newState })
                    })
                )
            );
            showToast(newState ? '¡Todas completadas! 🎉' : 'Todas pendientes de nuevo', 'magic');
        } catch (err) {
            console.error('Error al hacer toggle all:', err);
            showToast('Error de conexión', 'error');
            await loadTasks(); // Revert
        } finally {
            toggleAllBtn.disabled = false;
        }
    });

    // ─────────────────────────────────────────────
    // ATAJOS DE TECLADO
    // ─────────────────────────────────────────────
    document.addEventListener('keydown', (e) => {
        // Esc: limpiar inputs y perder foco
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
        // '/': Enfocar búsqueda rápidamente
        if (e.key === '/' && document.activeElement !== input && document.activeElement !== searchInput) {
            e.preventDefault();
            searchInput.focus();
        }
        // 'n': Enfocar nueva tarea
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
            activeFilter = btn.id.replace('filter-', ''); // 'all', 'pending', 'done'
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
    }

    // ─────────────────────────────────────────────
    // INICIALIZACIÓN: Carga tareas desde la API
    // ─────────────────────────────────────────────
    loadTasks();

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = input.value.trim();
        if (text !== '') {
            await addTodo(text);
            input.value = '';
        }
    });

    // ─────────────────────────────────────────────
    // FUNCIONES DE LA API (fetch)
    // ─────────────────────────────────────────────

    async function loadTasks() {
        try {
            showLoading();
            const res = await fetch(`${API_URL}/tasks`);
            if (!res.ok) throw new Error('Error al cargar tareas');
            allTasks = await res.json();
            applyFilter();
        } catch (err) {
            console.error('Error cargando tareas:', err);
            showToast('No se pudo conectar al servidor. ¿Está corriendo la API?', 'error');
            todoList.innerHTML = `<li class="empty-msg" style="color:var(--danger)">🚨 Error de conexión</li>`;
        }
    }

    async function addTodo(text) {
        try {
            const res = await fetch(`${API_URL}/tasks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text })
            });
            if (!res.ok) throw new Error('Error al crear tarea');
            // Recargamos la lista completa desde la BD para estar sincronizados
            await loadTasks();
            showToast(`Tarea añadida: "${text}"`, 'success');
        } catch (err) {
            console.error('Error creando tarea:', err);
            showToast('No se pudo guardar la tarea', 'error');
        }
    }

    async function toggleTodo(id, element) {
        // Bloquear si ya hay una llamada en vuelo para esta tarea
        if (element.dataset.saving === 'true') return;
        element.dataset.saving = 'true';
        element.style.opacity = '0.6';
        element.style.pointerEvents = 'none';

        // Estado DESEADO antes de enviar (opuesto al actual)
        const isNowCompleted = !element.classList.contains('completed');

        // Actualizar en memoria y UI inmediatamente (optimistic)
        const taskIndex = allTasks.findIndex(t => t.id === id);
        if (taskIndex !== -1) allTasks[taskIndex].completed = isNowCompleted;
        element.classList.toggle('completed');
        updateCount();

        try {
            const res = await fetch(`${API_URL}/tasks/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ completed: isNowCompleted })
            });
            if (!res.ok) throw new Error('Error al actualizar tarea');

            // Custom toasts interactivas
            if (isNowCompleted) {
                completedStreak++;
                if (completedStreak === 3) {
                    showToast('¡Estás on fire! 3 seguidas 🔥', 'fire');
                    completedStreak = 0; // reset racha
                } else if (allTasks.every(t => t.completed) && allTasks.length > 0) {
                    showToast('¡Día libre! Todas completadas 🎉', 'magic');
                } else {
                    showToast('¡Una menos!', 'success');
                }
            } else {
                completedStreak = 0; // rompe la racha
            }

        } catch (err) {
            // Revertir si la API falla
            if (taskIndex !== -1) allTasks[taskIndex].completed = !isNowCompleted;
            element.classList.toggle('completed');
            updateCount();
            console.error('Error actualizando tarea:', err);
            showToast('Error de conexión', 'error');
        } finally {
            // Siempre desbloquear al terminar
            element.dataset.saving = 'false';
            element.style.opacity = '';
            element.style.pointerEvents = '';
        }
    }

    async function deleteTodo(id, element) {
        // Animación de salida
        element.style.animation = 'fadeOut 0.3s ease forwards';

        try {
            const res = await fetch(`${API_URL}/tasks/${id}`, {
                method: 'DELETE'
            });
            if (!res.ok) throw new Error('Error al eliminar tarea');
            // Esperamos la animación y luego recargamos
            setTimeout(() => {
                loadTasks();
                showToast('Tarea eliminada', 'warning');
            }, 300);
        } catch (err) {
            // Si falla, revertimos la animación
            element.style.animation = '';
            console.error('Error eliminando tarea:', err);
            showToast('No se pudo eliminar', 'error');
        }
    }

    async function updateTaskText(id, newText, element) {
        try {
            const res = await fetch(`${API_URL}/tasks/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: newText })
            });
            if (!res.ok) throw new Error('Error al actualizar tarea');
            const updated = await res.json();
            // Actualiza solo el span sin recargar toda la lista
            element.querySelector('.todo-text').textContent = updated.text;
        } catch (err) {
            console.error('Error actualizando texto:', err);
            await loadTasks(); // fallback: recarga completa
        }
    }

    // ─────────────────────────────────────────────
    // FUNCIONES DE RENDERIZADO
    // ─────────────────────────────────────────────

    function renderTodos(tasks) {
        todoList.innerHTML = '';
        tasks.forEach(todo => renderTodoItem(todo));
        updateCount(tasks);
    }

    function renderTodoItem(todo) {
        const li = document.createElement('li');
        li.className = `todo-item ${todo.completed ? 'completed' : ''}`;
        li.dataset.id = todo.id;

        li.innerHTML = `
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
        const textSpan = li.querySelector('.todo-text');

        checkbox.addEventListener('click', () => toggleTodo(todo.id, li));
        deleteBtn.addEventListener('click', () => deleteTodo(todo.id, li));

        // Doble clic: convierte el span en un input editable
        textSpan.addEventListener('dblclick', () => {
            if (li.classList.contains('completed')) return; // no editar si está completada

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
                // Restauramos el span siempre
                editInput.replaceWith(textSpan);
                if (newText && newText !== originalText) {
                    textSpan.textContent = newText; // optimistic update
                    await updateTaskText(todo.id, newText, li);
                } else {
                    textSpan.textContent = originalText; // revertir si está vacío
                }
            };

            editInput.addEventListener('blur', saveEdit);
            editInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') editInput.blur();
                if (e.key === 'Escape') {
                    editInput.value = originalText; // cancelar cambios
                    editInput.blur();
                }
            });
        });

        todoList.appendChild(li);
    }

    function updateCount() {
        const total   = allTasks.length;
        const done    = allTasks.filter(t => t.completed).length;
        const pending = total - done;
        const pct     = total > 0 ? Math.round((done / total) * 100) : 0;

        // Badge pendientes original (arriba)
        taskCount.textContent = pending;

        // Actualización de los badges de filtro con animación visual
        animateBadgeUpdate(badgeAll, total);
        animateBadgeUpdate(badgePending, pending);
        animateBadgeUpdate(badgeDone, done);

        // Si hay más de 5 pendientes, el badge "se calienta" (ámbar a naranja)
        if (pending > 5) {
            badgePending.classList.add('urgent');
        } else {
            badgePending.classList.remove('urgent');
        }

        // Título dinámico en la pestaña del navegador (Bonus)
        document.title = pending > 0 ? `(${pending}) Infinity To-Do` : 'Infinity To-Do';

        // Barra de progreso
        progressBar.style.width   = `${pct}%`;
        progressLabel.textContent = `${done} de ${total} completadas`;
        progressPct.textContent   = `${pct}%`;

        // Color del porcentaje según avance
        if (pct === 100)     progressPct.style.color = 'var(--success)';
        else if (pct >= 50)  progressPct.style.color = 'var(--accent)';
        else                 progressPct.style.color = 'var(--text-muted)';

        // Mostrar controles solo si hay tareas
        listControls.style.display = total > 0 ? 'flex' : 'none';
        
        // Estado del botón "Toggle All"
        if (total > 0 && done === total) {
            toggleAllBtn.innerHTML = '🟩 Desmarcar todas';
        } else {
            toggleAllBtn.innerHTML = '☑️ Marcar todas';
        }
    }

    function animateBadgeUpdate(element, newValue) {
        if (!element) return;
        
        const currentValue = parseInt(element.textContent) || 0;
        element.textContent = newValue;

        // Si es 0 se pone tenue, si no, opacidad normal
        if (newValue === 0) element.classList.add('zero');
        else element.classList.remove('zero');

        // Solo animar 'pop' si el número realmente cambió
        if (currentValue !== newValue) {
            element.classList.remove('pop');
            void element.offsetWidth; // Force reflow para reiniciar la animación
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

    function showError(msg) {
        todoList.innerHTML = `
            <li style="text-align:center; color: var(--danger); padding: 2rem; font-size: 0.9rem;">
                ⚠️ ${msg}
            </li>
        `;
    }

    // Prevención de XSS
    function escapeHTML(str) {
        return str.replace(/[&<>'"]/g,
            tag => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                "'": '&#39;',
                '"': '&quot;'
            }[tag] || tag)
        );
    }
});
