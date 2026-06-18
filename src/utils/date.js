// ─── Date utilities ────────────────────────────────────────────

const DAYS_ES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

export function parseNaturalDate(text) {
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

export function formatDateShort(date) {
    return date.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
}
