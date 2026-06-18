// ─── Pure DOM utilities ────────────────────────────────────────

export function escapeHTML(str) {
    return String(str).replace(/[&<>'"]/g, tag =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
}
