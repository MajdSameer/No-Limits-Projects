"use client";

import { getAudioContext } from "./celebrate";

/**
 * The "Booked!" announcement sound — deliberately NOT the gong. A punchy
 * two-blast air-horn stab on a bright major chord ("da-DAAAA") over a deep
 * thump, then a sparkling rising chime. Pure Web Audio synth (no asset, works
 * offline), through the same unlocked AudioContext as every other wall sound.
 */
export function playAnnounceSound(volume = 0.6): void {
  const c = getAudioContext();
  if (!c) return;
  // resume() is async: if the context was suspended a beat ago, retry once it runs.
  if (c.state !== "running") {
    void c.resume().then(() => {
      if (c.state === "running") playAnnounceSound(volume);
    });
    return;
  }
  const now = c.currentTime;

  const master = c.createGain();
  master.gain.value = volume;
  master.connect(c.destination);

  // Horn bus: low-passed so the saws are bright but not harsh.
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 2600;
  lp.Q.value = 1.2;
  lp.connect(master);

  // Deep thump under the first blast.
  const sub = c.createOscillator();
  sub.type = "sine";
  sub.frequency.setValueAtTime(110, now);
  sub.frequency.exponentialRampToValueAtTime(42, now + 0.22);
  const sg = c.createGain();
  sg.gain.setValueAtTime(0.0001, now);
  sg.gain.exponentialRampToValueAtTime(1.1, now + 0.01);
  sg.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);
  sub.connect(sg);
  sg.connect(master);
  sub.start(now);
  sub.stop(now + 0.35);

  // One horn blast: a G major chord of detuned saws with a quick pitch scoop-up.
  const blast = (at: number, dur: number, level: number) => {
    const chord = [392, 494, 587, 784]; // G4 B4 D5 G5
    for (const f of chord) {
      for (const detune of [-9, 9]) {
        const o = c.createOscillator();
        o.type = "sawtooth";
        o.detune.value = detune;
        o.frequency.setValueAtTime(f * 0.88, at);
        o.frequency.exponentialRampToValueAtTime(f, at + 0.06); // the "scoop"
        const g = c.createGain();
        g.gain.setValueAtTime(0.0001, at);
        g.gain.exponentialRampToValueAtTime(0.11 * level, at + 0.025);
        g.gain.setValueAtTime(0.11 * level, at + dur - 0.07);
        g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
        o.connect(g);
        g.connect(lp);
        o.start(at);
        o.stop(at + dur + 0.05);
      }
    }
  };
  blast(now, 0.28, 0.8); // da
  blast(now + 0.34, 0.95, 1); // DAAAA

  // Sparkling chime run up the chord, landing as the horn tails off.
  const chime = (at: number, freq: number, vol: number) => {
    for (const p of [
      { r: 1, g: 1, d: 0.9 },
      { r: 2.01, g: 0.4, d: 0.7 },
      { r: 3.0, g: 0.18, d: 0.5 },
    ]) {
      const o = c.createOscillator();
      o.type = "sine";
      o.frequency.value = freq * p.r;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(p.g * vol, at + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, at + p.d);
      o.connect(g);
      g.connect(master);
      o.start(at);
      o.stop(at + p.d + 0.05);
    }
  };
  [1568, 1976, 2349, 2637, 3136].forEach((f, i) => chime(now + 0.95 + i * 0.075, f, 0.5));
}
