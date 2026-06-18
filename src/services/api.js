// ─── Raw API client — thin HTTP layer ─────────────────────────

let _apiUrl = null;
let _authFetch = null;

export function initApi(apiUrl, authFetchFn) {
    _apiUrl = apiUrl;
    _authFetch = authFetchFn;
}

function check() {
    if (!_apiUrl || !_authFetch) throw new Error('API no inicializada');
}

export async function getTasks(archived = false) {
    check();
    const url = archived ? `${_apiUrl}/tasks?archived=true` : `${_apiUrl}/tasks`;
    const res = await _authFetch(url);
    if (!res.ok) throw new Error();
    return res.json();
}

export async function createTask(text) {
    check();
    const res = await _authFetch(`${_apiUrl}/tasks`, {
        method: 'POST',
        body: JSON.stringify({ text }),
    });
    if (!res.ok) throw new Error();
    return res.json();
}

export async function toggleTask(id, completed) {
    check();
    const res = await _authFetch(`${_apiUrl}/tasks/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ completed }),
    });
    if (!res.ok) throw new Error();
    return res.json();
}

export async function updateTask(id, text) {
    check();
    const res = await _authFetch(`${_apiUrl}/tasks/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ text }),
    });
    if (!res.ok) throw new Error();
    return res.json();
}

export async function deleteTask(id) {
    check();
    const res = await _authFetch(`${_apiUrl}/tasks/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error();
}

export async function reorderTasks(tasks) {
    check();
    const res = await _authFetch(`${_apiUrl}/tasks/reorder`, {
        method: 'PUT',
        body: JSON.stringify({ tasks }),
    });
    if (!res.ok) throw new Error();
}

export async function archiveTask(id) {
    check();
    const res = await _authFetch(`${_apiUrl}/tasks/${id}/archive`, { method: 'PUT' });
    if (!res.ok) throw new Error();
    return res.json();
}

export async function restoreTask(id) {
    check();
    const res = await _authFetch(`${_apiUrl}/tasks/${id}/restore`, { method: 'PUT' });
    if (!res.ok) throw new Error();
    return res.json();
}

export async function setTaskDate(id, dueDate) {
    check();
    const res = await _authFetch(`${_apiUrl}/tasks/${id}/date`, {
        method: 'PATCH',
        body: JSON.stringify({ due_date: dueDate }),
    });
    if (!res.ok) throw new Error();
    return res.json();
}

export async function createSubtask(taskId, text) {
    check();
    const res = await _authFetch(`${_apiUrl}/tasks/${taskId}/subtasks`, {
        method: 'POST',
        body: JSON.stringify({ text }),
    });
    if (!res.ok) throw new Error();
    return res.json();
}

export async function toggleSubtask(taskId, subtaskId, done) {
    check();
    const res = await _authFetch(`${_apiUrl}/tasks/${taskId}/subtasks/${subtaskId}`, {
        method: 'PATCH',
        body: JSON.stringify({ done }),
    });
    if (!res.ok) throw new Error();
    return res.json();
}

export async function deleteSubtask(taskId, subtaskId) {
    check();
    const res = await _authFetch(`${_apiUrl}/tasks/${taskId}/subtasks/${subtaskId}`, {
        method: 'DELETE',
    });
    if (!res.ok) throw new Error();
}

export async function reorderSubtasks(taskId, subtasks) {
    check();
    const res = await _authFetch(`${_apiUrl}/tasks/${taskId}/subtasks/reorder`, {
        method: 'PUT',
        body: JSON.stringify({ subtasks }),
    });
    if (!res.ok) throw new Error();
}
