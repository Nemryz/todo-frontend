// ─── Toast notification system ─────────────────────────────────

import { icon } from '../icons.js';

const CONTAINER_CLASS = 'toast-container';
let container = document.querySelector('.' + CONTAINER_CLASS);
if (!container) {
    container = document.createElement('div');
    container.className = CONTAINER_CLASS;
    document.body.appendChild(container);
}

const ICONS = { success: icon('check-circle'), error: icon('alert-circle'), info: icon('lightbulb'), warning: icon('alert-triangle'), magic: icon('sparkles'), fire: icon('flame') };

function dismiss(toast) {
    toast.classList.remove('show');
    toast.classList.add('hide');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
}

export function showToast(message, type = 'info', actionLabel = null, actionFn = null) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    let html = `<span>${ICONS[type] || ICONS.info}</span><span>${message}</span>`;
    if (actionLabel && actionFn) html += `<button class="toast-action">${actionLabel}</button>`;
    toast.innerHTML = html;

    if (actionLabel && actionFn) {
        toast.querySelector('.toast-action').addEventListener('click', () => {
            actionFn();
            dismiss(toast);
        });
    }
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    const t = setTimeout(() => dismiss(toast), 4000);
    toast.addEventListener('click', (e) => {
        if (!e.target.classList.contains('toast-action')) { clearTimeout(t); dismiss(toast); }
    });
}
