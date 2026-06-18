// ─── Offline detection & pending queue ─────────────────────────

const QUEUE_KEY = 'todo-offline-queue';

export function isOnline() { return navigator.onLine; }

export function onOnline(fn) { window.addEventListener('online', fn); }
export function onOffline(fn) { window.addEventListener('offline', fn); }

export function getQueue() {
    try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); }
    catch { return []; }
}

export function addToQueue(action, payload) {
    const q = getQueue();
    q.push({ action, payload, ts: Date.now() });
    localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
}

export function clearQueue() {
    localStorage.removeItem(QUEUE_KEY);
}

export async function processQueue(processFn) {
    const q = getQueue();
    if (!q.length) return;
    const remaining = [];
    for (const item of q) {
        try {
            await processFn(item);
        } catch {
            remaining.push(item);
        }
    }
    if (remaining.length) {
        localStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
    } else {
        clearQueue();
    }
}
