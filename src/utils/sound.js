// ─── Sound effects via Web Audio API ───────────────────────────

let audioCtx = null;

function getAudioCtx() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return audioCtx;
}

export function playSound(type) {
    try {
        const ctx = getAudioCtx();
        const g = ctx.createGain();
        g.connect(ctx.destination);
        const sounds = {
            add:      [{ f: 520, t: 0,    dur: 0.08 }, { f: 660, t: 0.08, dur: 0.1 }],
            complete: [{ f: 440, t: 0,    dur: 0.08 }, { f: 550, t: 0.08, dur: 0.08 }, { f: 660, t: 0.16, dur: 0.12 }],
            delete:   [{ f: 330, t: 0,    dur: 0.06 }, { f: 260, t: 0.07, dur: 0.1 }],
            phase:    [{ f: 528, t: 0,    dur: 0.1  }, { f: 528, t: 0.12, dur: 0.1  }, { f: 660, t: 0.25, dur: 0.2 }],
        };
        (sounds[type] || sounds.add).forEach(({ f, t, dur }) => {
            const osc = ctx.createOscillator();
            const og  = ctx.createGain();
            osc.connect(og); og.connect(g);
            osc.type = 'sine';
            osc.frequency.value = f;
            og.gain.setValueAtTime(0.18, ctx.currentTime + t);
            og.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + dur);
            osc.start(ctx.currentTime + t);
            osc.stop(ctx.currentTime + t + dur + 0.02);
        });
    } catch { /* AudioContext no disponible */ }
}
