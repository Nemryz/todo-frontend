// ─── localStorage persistence layer ────────────────────────────

function store(key, defaultVal = null) {
    return {
        get: () => {
            try { return JSON.parse(localStorage.getItem(key) || 'null') ?? defaultVal; }
            catch { return defaultVal; }
        },
        set: (val) => localStorage.setItem(key, JSON.stringify(val)),
        remove: () => localStorage.removeItem(key),
    };
}

// ─── Priority ──────────────────────────────────────────────────
export const PRIORITIES = ['none', 'high', 'medium', 'low'];
export const PRIORITY_META = {
    none:   { label: '',      color: 'transparent', icon: '○' },
    high:   { label: 'Alta',  color: '#ef4444',     icon: '●' },
    medium: { label: 'Media', color: '#f59e0b',     icon: '●' },
    low:    { label: 'Baja',  color: '#10b981',     icon: '●' },
};

const priorityStore = store('todo-priority', {});
export function getPriority(taskId) { return priorityStore.get()[taskId] || 'none'; }
export function setPriority(taskId, level) {
    const data = priorityStore.get();
    if (level === 'none') delete data[taskId]; else data[taskId] = level;
    priorityStore.set(data);
}

// ─── Recurrence ────────────────────────────────────────────────
export const RECURRENCE_OPTS = ['none', 'daily', 'weekly', 'monthly'];
export const RECURRENCE_LABELS = { none: 'Sin recurrencia', daily: 'Diaria', weekly: 'Semanal', monthly: 'Mensual' };

const recurrenceStore = store('todo-recurrence', {});
export function getRecurrence(taskId) { return recurrenceStore.get()[taskId] || 'none'; }
export function setRecurrence(taskId, value) {
    const data = recurrenceStore.get();
    if (value === 'none') delete data[taskId]; else data[taskId] = value;
    recurrenceStore.set(data);
}

// ─── Notes ─────────────────────────────────────────────────────
const notesStore = store('todo-notes', {});
export function getNote(taskId) { return notesStore.get()[taskId] || ''; }
export function saveNote(taskId, text) {
    const notes = notesStore.get();
    if (text.trim()) notes[taskId] = text; else delete notes[taskId];
    notesStore.set(notes);
}

// ─── Dates (fallback localStorage only — primary is via backend due_date) ──
const datesStore = store('todo-dates', {});
export function getTaskDates() { return datesStore.get(); }
export function saveTaskDateLocal(taskId, date) {
    const dates = datesStore.get();
    if (date) dates[taskId] = date.toISOString(); else delete dates[taskId];
    datesStore.set(dates);
}

// ─── Gamification ──────────────────────────────────────────────
export const LEVELS = [
    { name: 'Bronce',   min: 0 },
    { name: 'Plata',    min: 100 },
    { name: 'Oro',      min: 500 },
    { name: 'Diamante', min: 2000 },
];
export const ACHIEVEMENTS = [
    { id: 'first',  label: 'Primera tarea',    check: (p, c) => c >= 1 },
    { id: 'ten',    label: '10 tareas totales', check: (p, c) => c >= 10 },
    { id: 'fifty',  label: '50 tareas totales', check: (p, c) => c >= 50 },
    { id: 'silver', label: 'Nivel Plata',       check: (p) => p >= 100 },
    { id: 'gold',   label: 'Nivel Oro',         check: (p) => p >= 500 },
    { id: 'diamond',label: 'Nivel Diamante',    check: (p) => p >= 2000 },
];

const gamiStore = store('todo-gamification', { points: 0, totalCompleted: 0, achievements: [] });
export function getGamification() { return gamiStore.get(); }
export function saveGamification(data) { gamiStore.set(data); }

// ─── History ───────────────────────────────────────────────────
const historyStore = store('todo-history', []);
export function logActivity(action, taskText) {
    const h = historyStore.get();
    h.unshift({ action, taskText, ts: Date.now() });
    if (h.length > 50) h.pop();
    historyStore.set(h);
}

// ─── Pomodoro total count ──────────────────────────────────────
const pomoTotalStore = store('todo-pomodoro-total', 0);
export function getPomodoroTotal() { return pomoTotalStore.get(); }
export function incPomodoroTotal() { pomoTotalStore.set(pomoTotalStore.get() + 1); }
