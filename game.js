// ============================================================================
// RUTA CARACAS EXPRESS — Platanus Hack 26 Arcade Challenge
// Conduce por la autopista de Caracas esquivando obstáculos y recolectando arepas.
// - Menú de selección de camionetas: Encava, Iveco y Mercedes.
// - Cambio de estación cada 2 km siguiendo la Línea 1 del Metro de Caracas.
// - BGM Chiptune: "Atrapado en dos amores" en sintetizador 8-bit.
// ============================================================================

const GAME_WIDTH = 800;
const GAME_HEIGHT = 600;
const STORAGE_KEY = 'ccs_express_hi';

// Mapeo físico de controles de la cabina arcade con respaldos locales
const CABINET_KEYS = {
  P1_U: ['w', 'ArrowUp'],
  P1_D: ['s', 'ArrowDown'],
  P1_L: ['a', 'ArrowLeft'],
  P1_R: ['d', 'ArrowRight'],
  P1_1: ['u', ' ', 'z', 'Space'], // Salto / Confirmar
  P1_2: ['i', 'x', 'Shift'],       // Turbo / Aceleración
  P1_3: ['o'],                     // Claxon / Corneta
  P1_4: ['j'],
  P1_5: ['k'],
  P1_6: ['l'],
  P2_U: ['ArrowUp'],
  P2_D: ['ArrowDown'],
  P2_L: ['ArrowLeft'],
  P2_R: ['ArrowRight'],
  P2_1: ['r'],
  P2_2: ['t'],
  P2_3: ['y'],
  P2_4: ['f'],
  P2_5: ['g'],
  P2_6: ['h'],
  START1: ['Enter', '1'],
  START2: ['2'],
};

// Configuración de la vía (4 carriles)
const ROAD_CONFIG = {
  left: 170,
  right: 630,
  width: 460,
  lanes: [225, 340, 460, 575], // Posición X central de los 4 carriles
};

// Modelos de Camionetas Seleccionables
const VEHICLE_MODELS = [
  {
    id: 'encava',
    name: 'ENCAVA ENT-610',
    subtitle: 'La Encavita Salsera',
    texture: 'tex_van_encava',
    color: '#ffd166',
    desc: 'Equilibrada, fiel y resistente para toda la autopista.',
    stats: { vel: '★★★★☆', salto: '★★★★☆', turbo: '★★★★☆' },
    baseSpeed: 360,
    turboBoost: 1.65,
    maxLives: 3,
    invulnTime: 1500,
    jumpScale: 1.35,
  },
  {
    id: 'iveco',
    name: 'IVECO DAILY',
    subtitle: 'La Bala de Catia',
    texture: 'tex_van_iveco',
    color: '#00d2d3',
    desc: 'Chuto aerodinámico con máxima velocidad y nitro.',
    stats: { vel: '★★★★★', salto: '★★★☆☆', turbo: '★★★★★' },
    baseSpeed: 390,
    turboBoost: 1.85,
    maxLives: 3,
    invulnTime: 1400,
    jumpScale: 1.30,
  },
  {
    id: 'mercedes',
    name: 'MERCEDES 0371',
    subtitle: 'El Titán de Petare',
    texture: 'tex_van_mercedes',
    color: '#ff6b81',
    desc: 'Carrocería de acero reforzado: arranca con 4 vidas.',
    stats: { vel: '★★★☆☆', salto: '★★★★★', turbo: '★★★☆☆' },
    baseSpeed: 345,
    turboBoost: 1.50,
    maxLives: 4,
    invulnTime: 2000,
    jumpScale: 1.45,
  },
];

// Estaciones de la Línea 1 del Metro de Caracas (cada 2 km)
const METRO_LINEA_1 = [
  'PROPATRIA',
  'PÉREZ BONALDE',
  'PLAZA SUCRE',
  'GATO NEGRO',
  'AGUA SALUD',
  'CAÑO AMARILLO',
  'CAPITOLIO',
  'LA HOYADA',
  'PARQUE CARABOBO',
  'BELLAS ARTES',
  'COLEGIO DE INGENIEROS',
  'PLAZA VENEZUELA',
  'SABANA GRANDE',
  'CHACAÍTO',
  'CHACAO',
  'ALTAMIRA',
  'MIRANDA',
  'LOS DOS CAMINOS',
  'LOS CORTIJOS',
  'LA CALIFORNIA',
  'PETARE',
  'PALO VERDE',
];

function getMetroStationName(index) {
  if (index < METRO_LINEA_1.length) {
    return METRO_LINEA_1[index];
  }
  const loop = Math.floor(index / METRO_LINEA_1.length) + 1;
  const mod = index % METRO_LINEA_1.length;
  return `${METRO_LINEA_1[mod]} (VUELTA ${loop})`;
}

function normalizeIncomingKey(key) {
  if (typeof key !== 'string' || key.length === 0) return '';
  if (key === ' ') return ' ';
  return key.toLowerCase();
}

const KEYBOARD_TO_ARCADE = {};
for (const [arcadeCode, keys] of Object.entries(CABINET_KEYS)) {
  for (const key of keys) {
    const k = normalizeIncomingKey(key);
    if (!KEYBOARD_TO_ARCADE[k]) {
      KEYBOARD_TO_ARCADE[k] = [];
    }
    KEYBOARD_TO_ARCADE[k].push(arcadeCode);
  }
}

// ============================================================================
// CLASE SOUNDENGINE: SINTETIZADOR CHIPTUNE "ATRAPADO EN DOS AMORES" (8-BIT)
// ============================================================================
class SoundEngine {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    this.isPlayingBGM = false;
    this.noiseBuffer = null;
    this.step = 0;
    this.stepTime = 0.12; // ~125 BPM
    this.nextNoteTime = 0;
    this.timerId = null;

    this.masterGain = null;
    this.bgmGain = null;
    this.sfxGain = null;
    this.engineGain = null;
    this.engineOsc = null;

    // Melodía adaptada de "Atrapado en dos amores" (128 semicorcheas / 8 compases)
    this.leadMelody = [
      // Compás 1: "En dos a-mo-res voy per-di-do..." (Dm)
      { s: 0, f: 293.66, d: 0.10 },
      { s: 2, f: 349.23, d: 0.10 },
      { s: 4, f: 440.00, d: 0.10 },
      { s: 6, f: 440.00, d: 0.10 },
      { s: 8, f: 440.00, d: 0.10 },
      { s: 10, f: 392.00, d: 0.10 },
      { s: 12, f: 349.23, d: 0.10 },
      { s: 14, f: 440.00, d: 0.18 },

      // Compás 2: "Per-dó-na-me, pe-ro no sé qué ha-cer..." (Gm -> C)
      { s: 16, f: 466.16, d: 0.10 },
      { s: 18, f: 466.16, d: 0.10 },
      { s: 20, f: 466.16, d: 0.10 },
      { s: 22, f: 440.00, d: 0.10 },
      { s: 24, f: 392.00, d: 0.10 },
      { s: 26, f: 349.23, d: 0.10 },
      { s: 28, f: 392.00, d: 0.10 },
      { s: 30, f: 329.63, d: 0.18 },

      // Compás 3: "Si es-toy con e-lla, quie-ro es-tar con-ti-go..." (F -> Bb)
      { s: 32, f: 440.00, d: 0.10 },
      { s: 34, f: 440.00, d: 0.10 },
      { s: 36, f: 440.00, d: 0.10 },
      { s: 38, f: 523.25, d: 0.10 },
      { s: 40, f: 466.16, d: 0.10 },
      { s: 42, f: 440.00, d: 0.10 },
      { s: 44, f: 392.00, d: 0.10 },
      { s: 46, f: 440.00, d: 0.18 },

      // Compás 4: "Si es-toy con-ti-go, a e-lla la quie-ro ver..." (Gm -> A7)
      { s: 48, f: 392.00, d: 0.10 },
      { s: 50, f: 392.00, d: 0.10 },
      { s: 52, f: 392.00, d: 0.10 },
      { s: 54, f: 466.16, d: 0.10 },
      { s: 56, f: 440.00, d: 0.10 },
      { s: 58, f: 392.00, d: 0.10 },
      { s: 60, f: 349.23, d: 0.10 },
      { s: 62, f: 293.66, d: 0.20 },

      // Compás 5: "Vi-vo a-tra-pa-do en dos a-mo-res..." (Dm - Clímax)
      { s: 64, f: 587.33, d: 0.10 },
      { s: 66, f: 587.33, d: 0.10 },
      { s: 68, f: 587.33, d: 0.10 },
      { s: 70, f: 523.25, d: 0.10 },
      { s: 72, f: 466.16, d: 0.10 },
      { s: 74, f: 440.00, d: 0.10 },
      { s: 76, f: 466.16, d: 0.10 },
      { s: 78, f: 523.25, d: 0.18 },

      // Compás 6: "Con la in-quie-tud de no sa-ber de quién..." (Gm -> C)
      { s: 80, f: 466.16, d: 0.10 },
      { s: 82, f: 466.16, d: 0.10 },
      { s: 84, f: 466.16, d: 0.10 },
      { s: 86, f: 440.00, d: 0.10 },
      { s: 88, f: 392.00, d: 0.10 },
      { s: 90, f: 349.23, d: 0.10 },
      { s: 92, f: 392.00, d: 0.10 },
      { s: 94, f: 329.63, d: 0.18 },

      // Compás 7: "Que-rien-do a ve-ces que no me a-ban-do-nen..." (Bb -> C)
      { s: 96, f: 392.00, d: 0.10 },
      { s: 98, f: 392.00, d: 0.10 },
      { s: 100, f: 392.00, d: 0.10 },
      { s: 102, f: 466.16, d: 0.10 },
      { s: 104, f: 440.00, d: 0.10 },
      { s: 106, f: 392.00, d: 0.10 },
      { s: 108, f: 349.23, d: 0.10 },
      { s: 110, f: 440.00, d: 0.18 },

      // Compás 8: "Que-rien-do a ve-ces a las dos per-der!" (A7 -> Dm)
      { s: 112, f: 349.23, d: 0.10 },
      { s: 114, f: 349.23, d: 0.10 },
      { s: 116, f: 349.23, d: 0.10 },
      { s: 118, f: 329.63, d: 0.10 },
      { s: 120, f: 277.18, d: 0.10 },
      { s: 122, f: 293.66, d: 0.10 },
      { s: 124, f: 329.63, d: 0.10 },
      { s: 126, f: 293.66, d: 0.24 },
    ];

    // Tumbao de bajo tropical salsero (Triangle)
    this.bassTumbao = [
      { s: 0, f: 73.42, d: 0.14 },
      { s: 4, f: 110.00, d: 0.12 },
      { s: 7, f: 146.83, d: 0.18 },
      { s: 12, f: 87.31, d: 0.12 },
      { s: 14, f: 110.00, d: 0.18 },
      { s: 16, f: 98.00, d: 0.14 },
      { s: 20, f: 146.83, d: 0.12 },
      { s: 23, f: 98.00, d: 0.18 },
      { s: 28, f: 130.81, d: 0.12 },
      { s: 30, f: 130.81, d: 0.18 },
      { s: 32, f: 87.31, d: 0.14 },
      { s: 36, f: 130.81, d: 0.12 },
      { s: 39, f: 116.54, d: 0.18 },
      { s: 44, f: 130.81, d: 0.12 },
      { s: 46, f: 146.83, d: 0.18 },
      { s: 48, f: 98.00, d: 0.14 },
      { s: 52, f: 110.00, d: 0.12 },
      { s: 55, f: 110.00, d: 0.18 },
      { s: 60, f: 73.42, d: 0.12 },
      { s: 62, f: 73.42, d: 0.20 },
      { s: 64, f: 73.42, d: 0.14 },
      { s: 68, f: 110.00, d: 0.12 },
      { s: 71, f: 146.83, d: 0.18 },
      { s: 76, f: 87.31, d: 0.12 },
      { s: 78, f: 110.00, d: 0.18 },
      { s: 80, f: 98.00, d: 0.14 },
      { s: 84, f: 146.83, d: 0.12 },
      { s: 87, f: 98.00, d: 0.18 },
      { s: 92, f: 130.81, d: 0.12 },
      { s: 94, f: 130.81, d: 0.18 },
      { s: 96, f: 116.54, d: 0.14 },
      { s: 100, f: 87.31, d: 0.12 },
      { s: 103, f: 116.54, d: 0.18 },
      { s: 108, f: 130.81, d: 0.12 },
      { s: 110, f: 130.81, d: 0.18 },
      { s: 112, f: 110.00, d: 0.14 },
      { s: 116, f: 82.41, d: 0.12 },
      { s: 119, f: 110.00, d: 0.18 },
      { s: 124, f: 73.42, d: 0.12 },
      { s: 126, f: 73.42, d: 0.24 },
    ];

    this.cowbellSteps = [
      0, 4, 7, 10, 12, 14, 16, 20, 23, 26, 28, 30,
      32, 36, 39, 42, 44, 46, 48, 52, 55, 58, 60, 62,
      64, 68, 71, 74, 76, 78, 80, 84, 87, 90, 92, 94,
      96, 100, 103, 106, 108, 110, 112, 116, 119, 122, 124, 126,
    ];

    this.guiroSteps = [
      2, 6, 10, 14, 18, 22, 26, 30, 34, 38, 42, 46, 50, 54, 58, 62,
      66, 70, 74, 78, 82, 86, 90, 94, 98, 102, 106, 110, 114, 118, 122, 126,
    ];
    this.timbalSteps = [
      0, 8, 16, 24, 32, 40, 48, 56, 64, 72, 80, 88, 96, 104, 112, 120, 125, 127,
    ];
  }

  init() {
    if (this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.45, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      this.bgmGain = this.ctx.createGain();
      this.bgmGain.gain.setValueAtTime(0.38, this.ctx.currentTime);
      this.bgmGain.connect(this.masterGain);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.setValueAtTime(0.55, this.ctx.currentTime);
      this.sfxGain.connect(this.masterGain);

      const bufferSize = Math.floor(this.ctx.sampleRate * 0.12);
      this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i += 1) {
        output[i] = Math.random() * 2 - 1;
      }

      this.initEngineAudio();
    } catch (_) {}
  }

  initEngineAudio() {
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(62, this.ctx.currentTime);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(260, this.ctx.currentTime);

      gain.gain.setValueAtTime(0.015, this.ctx.currentTime);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain);
      osc.start();

      this.engineOsc = osc;
      this.engineGain = gain;
    } catch (_) {}
  }

  setEngineSpeed(isTurbo, speedRatio = 1) {
    if (!this.engineOsc || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const targetFreq = isTurbo ? 115 : 60 + speedRatio * 15;
      this.engineOsc.frequency.linearRampToValueAtTime(targetFreq, now + 0.08);
    } catch (_) {}
  }

  startBGM() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    if (this.isPlayingBGM) return;
    this.isPlayingBGM = true;
    this.step = 0;
    this.nextNoteTime = this.ctx.currentTime + 0.05;
    this.scheduleLoop();
  }

  stopBGM() {
    this.isPlayingBGM = false;
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  toggleMute() {
    this.init();
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.linearRampToValueAtTime(this.isMuted ? 0 : 0.45, now + 0.05);
    }
    return this.isMuted;
  }

  scheduleLoop() {
    if (!this.isPlayingBGM || !this.ctx) return;

    while (this.nextNoteTime < this.ctx.currentTime + 0.18) {
      this.playStep(this.step, this.nextNoteTime);
      this.step = (this.step + 1) % 128;
      this.nextNoteTime += this.stepTime;
    }

    this.timerId = setTimeout(() => this.scheduleLoop(), 50);
  }

  playStep(stepIndex, time) {
    for (const note of this.bassTumbao) {
      if (note.s === stepIndex) {
        this.playTone(note.f, 'triangle', note.d, 0.32, time, this.bgmGain);
        break;
      }
    }

    for (const note of this.leadMelody) {
      if (note.s === stepIndex) {
        this.playTone(note.f, 'square', note.d, 0.18, time, this.bgmGain, true);
        break;
      }
    }

    if (this.cowbellSteps.includes(stepIndex)) {
      this.playCowbell(time, stepIndex % 4 === 0 ? 0.17 : 0.11);
    }

    if (this.guiroSteps.includes(stepIndex)) {
      this.playNoise(time, 0.035, 2400, 0.08);
    }
    if (this.timbalSteps.includes(stepIndex)) {
      this.playNoise(time, 0.045, 3800, 0.14);
    }
  }

  playTone(freq, waveType, duration, vol, time, destGain, hasFilter = false) {
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = waveType;
      osc.frequency.setValueAtTime(freq, time);

      gain.gain.setValueAtTime(0.001, time);
      gain.gain.linearRampToValueAtTime(vol, time + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

      if (hasFilter) {
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2400, time);
        osc.connect(filter);
        filter.connect(gain);
      } else {
        osc.connect(gain);
      }

      gain.connect(destGain || this.masterGain);
      osc.start(time);
      osc.stop(time + duration + 0.01);
    } catch (_) {}
  }

  playCowbell(time, volume) {
    if (!this.ctx) return;
    try {
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc1.type = 'square';
      osc2.type = 'square';
      osc1.frequency.setValueAtTime(587.33, time);
      osc2.frequency.setValueAtTime(840.00, time);

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(780, time);
      filter.Q.setValueAtTime(2.5, time);

      gain.gain.setValueAtTime(volume, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.065);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(this.bgmGain);

      osc1.start(time);
      osc2.start(time);
      osc1.stop(time + 0.07);
      osc2.stop(time + 0.07);
    } catch (_) {}
  }

  playNoise(time, duration, filterFreq, volume) {
    if (!this.ctx || !this.noiseBuffer) return;
    try {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(filterFreq, time);
      filter.Q.setValueAtTime(1.8, time);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(volume, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.bgmGain);

      src.start(time);
      src.stop(time + duration);
    } catch (_) {}
  }

  // Claxon / Corneta de Encava
  playHorn() {
    this.init();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      [0, 0.12].forEach((offset) => {
        const t = now + offset;
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc1.type = 'sawtooth';
        osc2.type = 'sawtooth';
        osc1.frequency.setValueAtTime(349.23, t);
        osc2.frequency.setValueAtTime(440.00, t);

        gain.gain.setValueAtTime(0.24, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(this.sfxGain);

        osc1.start(t);
        osc2.start(t);
        osc1.stop(t + 0.1);
        osc2.stop(t + 0.1);
      });
    } catch (_) {}
  }

  // Campanilla del Metro de Caracas ("¡Ding-Dong!")
  playMetroChime() {
    this.init();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      [ [783.99, 0, 0.28], [523.25, 0.28, 0.45] ].forEach(([freq, offset, dur]) => {
        const t = now + offset;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);

        gain.gain.setValueAtTime(0.32, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(t);
        osc.stop(t + dur + 0.02);
      });
    } catch (_) {}
  }

  playJump() {
    this.init();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(240, now);
      osc.frequency.exponentialRampToValueAtTime(820, now + 0.22);

      gain.gain.setValueAtTime(0.28, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.25);
    } catch (_) {}
  }

  playArepa() {
    this.init();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      [659.25, 830.61, 987.77].forEach((freq, idx) => {
        const t = now + idx * 0.06;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t);

        gain.gain.setValueAtTime(0.22, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(t);
        osc.stop(t + 0.19);
      });
    } catch (_) {}
  }

  playDodge() {
    this.init();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(1320, now + 0.12);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.14);
    } catch (_) {}
  }

  playSelect() {
    this.init();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.06);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.08);
    } catch (_) {}
  }

  playCrash() {
    this.init();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(170, now);
      osc.frequency.exponentialRampToValueAtTime(32, now + 0.35);

      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.38);

      if (this.noiseBuffer) {
        const src = this.ctx.createBufferSource();
        src.buffer = this.noiseBuffer;
        const nGain = this.ctx.createGain();
        nGain.gain.setValueAtTime(0.3, now);
        nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
        src.connect(nGain);
        nGain.connect(this.sfxGain);
        src.start(now);
        src.stop(now + 0.28);
      }
    } catch (_) {}
  }

  playGameOver() {
    this.stopBGM();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      [392, 349.2, 329.6, 261.6].forEach((freq, idx) => {
        const t = now + idx * 0.14;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, t);

        gain.gain.setValueAtTime(0.24, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(t);
        osc.stop(t + 0.21);
      });
    } catch (_) {}
  }
}

// ============================================================================
// CONFIGURACIÓN DE PHASER 3
// ============================================================================
const config = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: 'game-root',
  backgroundColor: '#070a0e',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 },
      debug: false,
    },
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
  },
  scene: {
    preload,
    create,
    update,
  },
};

new Phaser.Game(config);

function preload() {}

function create() {
  const scene = this;

  scene.gameState = {
    phase: 'start', // 'start', 'playing', 'gameover'
    score: 0,
    highScore: 0,
    distance: 0,
    speed: 360,
    baseSpeed: 360,
    turboActive: false,
    turboAmount: 100,
    arepasCollected: 0,
    lives: 3,
    maxLives: 3,
    invulnerableUntil: 0,
    nextSpawnDistance: 120,
    selectedVehicleIndex: 0,
    currentStationIndex: 0,
    nextStationDistance: 2000, // Cada 2000m (2 km)
  };

  scene.soundEngine = new SoundEngine();

  generateGameTextures(scene);
  createEnvironment(scene);
  createPlayer(scene);
  createObstacleGroups(scene);
  createHud(scene);
  createStartScreen(scene);
  createGameOverScreen(scene);
  setupInput(scene);
  loadHighScore(scene);
}

// ============================================================================
// GENERACIÓN DE TEXTURAS PROCEDURALES
// ============================================================================
function generateGameTextures(scene) {
  // 1. Ávila y Cruz iluminada
  const gAvila = scene.make.graphics({ x: 0, y: 0, add: false });
  gAvila.fillGradientStyle(0x040814, 0x040814, 0x0f2027, 0x0f2027, 1);
  gAvila.fillRect(0, 0, GAME_WIDTH, 140);

  gAvila.fillStyle(0x0c1c24, 1);
  gAvila.beginPath();
  gAvila.moveTo(0, 140);
  gAvila.lineTo(0, 80);
  gAvila.lineTo(120, 55);
  gAvila.lineTo(260, 68);
  gAvila.lineTo(400, 35);
  gAvila.lineTo(470, 48);
  gAvila.lineTo(580, 52);
  gAvila.lineTo(700, 75);
  gAvila.lineTo(GAME_WIDTH, 90);
  gAvila.lineTo(GAME_WIDTH, 140);
  gAvila.closePath();
  gAvila.fillPath();

  gAvila.fillStyle(0x071117, 1);
  gAvila.beginPath();
  gAvila.moveTo(0, 140);
  gAvila.lineTo(0, 95);
  gAvila.lineTo(160, 82);
  gAvila.lineTo(320, 96);
  gAvila.lineTo(520, 72);
  gAvila.lineTo(680, 90);
  gAvila.lineTo(GAME_WIDTH, 105);
  gAvila.lineTo(GAME_WIDTH, 140);
  gAvila.closePath();
  gAvila.fillPath();

  // Cruz del Ávila
  gAvila.fillStyle(0xffffff, 1);
  gAvila.fillRect(578, 38, 4, 18);
  gAvila.fillRect(573, 43, 14, 4);
  gAvila.fillStyle(0xe1ff00, 0.4);
  gAvila.fillCircle(580, 47, 12);
  gAvila.generateTexture('tex_avila', GAME_WIDTH, 140);
  gAvila.destroy();

  // 2. Modelo A: Camioneta ENCAVA (Blanca con franjas azul y roja)
  const gEncava = scene.make.graphics({ x: 0, y: 0, add: false });
  gEncava.fillStyle(0xf0f3f5, 1);
  gEncava.fillRoundedRect(4, 4, 40, 80, 6);
  gEncava.fillStyle(0x0055a5, 1);
  gEncava.fillRect(4, 28, 40, 7);
  gEncava.fillRect(4, 44, 40, 6);
  gEncava.fillStyle(0xe63946, 1);
  gEncava.fillRect(4, 35, 40, 6);
  gEncava.fillStyle(0xd9e0e5, 1);
  gEncava.fillRect(10, 20, 28, 48);
  gEncava.lineStyle(2, 0x8a9ba8, 1);
  gEncava.strokeRect(11, 24, 26, 40);
  gEncava.fillStyle(0x1a2b3c, 1);
  gEncava.fillRoundedRect(8, 8, 32, 14, 3);
  gEncava.fillStyle(0x4a90e2, 0.5);
  gEncava.fillRect(12, 10, 10, 10);
  gEncava.fillStyle(0x1a2b3c, 1);
  gEncava.fillRoundedRect(8, 70, 32, 8, 2);
  gEncava.fillStyle(0xfff799, 1);
  gEncava.fillCircle(10, 6, 4);
  gEncava.fillCircle(38, 6, 4);
  gEncava.fillStyle(0xff2222, 1);
  gEncava.fillRect(6, 80, 6, 3);
  gEncava.fillRect(36, 80, 6, 3);
  gEncava.fillStyle(0x333333, 1);
  gEncava.fillRect(1, 12, 3, 7);
  gEncava.fillRect(44, 12, 3, 7);
  gEncava.generateTexture('tex_van_encava', 48, 88);
  gEncava.destroy();

  // 3. Modelo B: Camioneta IVECO (Chuto aerodinámico blanco con franjas verde/amarillo)
  const gIveco = scene.make.graphics({ x: 0, y: 0, add: false });
  gIveco.fillStyle(0xffffff, 1);
  gIveco.fillRoundedRect(5, 10, 38, 74, 4);
  // Trompita delantera
  gIveco.fillStyle(0xe0e6ed, 1);
  gIveco.fillRoundedRect(8, 4, 32, 12, 4);
  // Franjas deportivas de Catia
  gIveco.fillStyle(0x10ac84, 1);
  gIveco.fillRect(5, 30, 38, 8);
  gIveco.fillStyle(0xffd166, 1);
  gIveco.fillRect(5, 38, 38, 5);
  // Parabrisas amplio
  gIveco.fillStyle(0x15232d, 1);
  gIveco.fillRoundedRect(8, 14, 32, 16, 3);
  gIveco.fillStyle(0x00d2d3, 0.4);
  gIveco.fillRect(10, 16, 12, 12);
  // Techo aerodinámico con visera
  gIveco.fillStyle(0x10ac84, 1);
  gIveco.fillRect(7, 12, 34, 3);
  // Faros alargados
  gIveco.fillStyle(0xffffff, 1);
  gIveco.fillRect(8, 4, 6, 4);
  gIveco.fillRect(34, 4, 6, 4);
  // Luces traseras
  gIveco.fillStyle(0xff3838, 1);
  gIveco.fillRect(6, 78, 6, 4);
  gIveco.fillRect(36, 78, 6, 4);
  gIveco.generateTexture('tex_van_iveco', 48, 88);
  gIveco.destroy();

  // 4. Modelo C: Camioneta MERCEDES 0371 (Azul marino / plata titanio)
  const gMercedes = scene.make.graphics({ x: 0, y: 0, add: false });
  gMercedes.fillStyle(0x1e3799, 1); // Azul marino elegante
  gMercedes.fillRoundedRect(3, 4, 42, 80, 5);
  // Franja plateada
  gMercedes.fillStyle(0xdcdde1, 1);
  gMercedes.fillRect(3, 34, 42, 8);
  gMercedes.fillStyle(0x4a69bd, 1);
  gMercedes.fillRect(3, 42, 42, 5);
  // Parrilla frontal Mercedes con estrella
  gMercedes.fillStyle(0x2f3640, 1);
  gMercedes.fillRect(14, 5, 20, 6);
  gMercedes.lineStyle(1, 0xffffff, 1);
  gMercedes.strokeCircle(24, 8, 3);
  // Parabrisas panorámico
  gMercedes.fillStyle(0x0a192f, 1);
  gMercedes.fillRoundedRect(6, 12, 36, 18, 3);
  gMercedes.fillStyle(0x60a5fa, 0.4);
  gMercedes.fillRect(8, 14, 14, 14);
  // Parachoques reforzado
  gMercedes.fillStyle(0x718093, 1);
  gMercedes.fillRect(2, 2, 44, 4);
  // Faros dobles
  gMercedes.fillStyle(0xfff799, 1);
  gMercedes.fillCircle(8, 7, 3);
  gMercedes.fillCircle(40, 7, 3);
  // Luces de freno
  gMercedes.fillStyle(0xff2222, 1);
  gMercedes.fillRect(5, 78, 8, 4);
  gMercedes.fillRect(35, 78, 8, 4);
  gMercedes.generateTexture('tex_van_mercedes', 48, 88);
  gMercedes.destroy();

  // 5. Sombra de la camioneta
  const gShadow = scene.make.graphics({ x: 0, y: 0, add: false });
  gShadow.fillStyle(0x000000, 0.45);
  gShadow.fillEllipse(24, 44, 42, 78);
  gShadow.generateTexture('tex_van_shadow', 48, 88);
  gShadow.destroy();

  // 6. Bache (Alta visibilidad con reborde de advertencia reflectivo y grietas)
  const gHole = scene.make.graphics({ x: 0, y: 0, add: false });
  // Borde exterior reflectivo de advertencia (amarillo/naranja asfalto)
  gHole.lineStyle(3, 0xffa502, 1);
  gHole.strokeEllipse(24, 15, 44, 24);
  // Zona de asfalto erosionado
  gHole.fillStyle(0x1a2129, 1);
  gHole.fillEllipse(24, 15, 42, 22);
  // Interior profundo del hueco
  gHole.fillStyle(0x05070a, 1);
  gHole.fillEllipse(24, 15, 34, 16);
  // Grietas rojas y anaranjadas de peligro
  gHole.lineStyle(2, 0xff4757, 1);
  gHole.beginPath();
  gHole.moveTo(5, 15);
  gHole.lineTo(13, 12);
  gHole.lineTo(18, 7);
  gHole.moveTo(43, 15);
  gHole.lineTo(35, 17);
  gHole.lineTo(29, 23);
  gHole.moveTo(24, 5);
  gHole.lineTo(24, 11);
  gHole.strokePath();
  // Reflejo central brillante
  gHole.fillStyle(0x00d2d3, 0.45);
  gHole.fillEllipse(24, 16, 16, 8);
  gHole.generateTexture('tex_pothole', 48, 30);
  gHole.destroy();

  // 7. Moto
  const gMoto = scene.make.graphics({ x: 0, y: 0, add: false });
  gMoto.fillStyle(0x111111, 1);
  gMoto.fillRoundedRect(9, 2, 6, 12, 2);
  gMoto.fillRoundedRect(9, 42, 6, 12, 2);
  gMoto.fillStyle(0x222222, 1);
  gMoto.fillRect(7, 16, 10, 24);
  gMoto.fillStyle(0xff6b35, 1);
  gMoto.fillCircle(12, 26, 7);
  gMoto.fillStyle(0xffd166, 1);
  gMoto.fillCircle(12, 20, 6);
  gMoto.fillStyle(0xffffff, 1);
  gMoto.fillCircle(12, 6, 3);
  gMoto.generateTexture('tex_moto', 24, 56);
  gMoto.destroy();

  // 8. Taxi
  const gTaxi = scene.make.graphics({ x: 0, y: 0, add: false });
  gTaxi.fillStyle(0xf1c40f, 1);
  gTaxi.fillRoundedRect(2, 2, 36, 68, 5);
  gTaxi.fillStyle(0x1a2b3c, 1);
  gTaxi.fillRect(6, 16, 28, 12);
  gTaxi.fillRect(6, 48, 28, 8);
  gTaxi.fillStyle(0xffffff, 1);
  gTaxi.fillRect(12, 32, 16, 7);
  gTaxi.lineStyle(1, 0x000000, 1);
  gTaxi.strokeRect(12, 32, 16, 7);
  gTaxi.fillStyle(0x000000, 1);
  gTaxi.fillRect(2, 36, 6, 4);
  gTaxi.fillRect(32, 36, 6, 4);
  gTaxi.fillStyle(0xfff9a6, 1);
  gTaxi.fillCircle(8, 4, 3);
  gTaxi.fillCircle(32, 4, 3);
  gTaxi.fillStyle(0xff2222, 1);
  gTaxi.fillRect(4, 66, 6, 3);
  gTaxi.fillRect(30, 66, 6, 3);
  gTaxi.generateTexture('tex_taxi', 40, 72);
  gTaxi.destroy();

  // 9. Carro azul
  const gCar = scene.make.graphics({ x: 0, y: 0, add: false });
  gCar.fillStyle(0x2980b9, 1);
  gCar.fillRoundedRect(2, 2, 36, 68, 5);
  gCar.fillStyle(0x1a252f, 1);
  gCar.fillRect(6, 16, 28, 12);
  gCar.fillRect(6, 48, 28, 8);
  gCar.fillStyle(0xfff9a6, 1);
  gCar.fillCircle(8, 4, 3);
  gCar.fillCircle(32, 4, 3);
  gCar.fillStyle(0xff2222, 1);
  gCar.fillRect(4, 66, 6, 3);
  gCar.fillRect(30, 66, 6, 3);
  gCar.generateTexture('tex_car_blue', 40, 72);
  gCar.destroy();

  // 10. Arepa Caliente
  const gArepa = scene.make.graphics({ x: 0, y: 0, add: false });
  gArepa.fillStyle(0xffd700, 0.4);
  gArepa.fillCircle(16, 16, 15);
  gArepa.fillStyle(0xf9ca24, 1);
  gArepa.fillCircle(16, 16, 12);
  gArepa.fillStyle(0xf6e58d, 1);
  gArepa.fillCircle(16, 16, 9);
  gArepa.fillStyle(0x995d13, 0.85);
  gArepa.fillRect(10, 10, 12, 2);
  gArepa.fillRect(8, 15, 16, 2);
  gArepa.fillRect(11, 20, 10, 2);
  gArepa.generateTexture('tex_arepa', 32, 32);
  gArepa.destroy();

  // 11. Fuego Nitro
  const gFlame = scene.make.graphics({ x: 0, y: 0, add: false });
  gFlame.fillStyle(0x00d2d3, 1);
  gFlame.fillTriangle(6, 0, 0, 16, 12, 16);
  gFlame.fillStyle(0xffffff, 1);
  gFlame.fillTriangle(6, 4, 3, 14, 9, 14);
  gFlame.generateTexture('tex_flame', 12, 18);
  gFlame.destroy();
}

// ============================================================================
// ENTORNO Y VÍA
// ============================================================================
function createEnvironment(scene) {
  scene.add.image(GAME_WIDTH / 2, 70, 'tex_avila').setDepth(0);

  scene.add.rectangle(85, GAME_HEIGHT / 2, 170, GAME_HEIGHT, 0x1b382b).setDepth(1);
  scene.add.rectangle(715, GAME_HEIGHT / 2, 170, GAME_HEIGHT, 0x1b382b).setDepth(1);
  scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, ROAD_CONFIG.width, GAME_HEIGHT, 0x181a1e).setDepth(1);

  scene.curbs = [];
  const curbStep = 40;
  for (let y = -curbStep; y < GAME_HEIGHT + curbStep; y += curbStep) {
    const isRed = Math.floor(y / curbStep) % 2 === 0;
    const color = isRed ? 0xcc2222 : 0xeeeeee;
    const leftCurb = scene.add.rectangle(ROAD_CONFIG.left - 6, y, 10, curbStep, color).setDepth(2);
    const rightCurb = scene.add.rectangle(ROAD_CONFIG.right + 6, y, 10, curbStep, color).setDepth(2);
    scene.curbs.push({ left: leftCurb, right: rightCurb });
  }

  scene.laneDividers = [];
  const dividerStep = 50;
  const laneDividersX = [
    (ROAD_CONFIG.lanes[0] + ROAD_CONFIG.lanes[1]) / 2,
    (ROAD_CONFIG.lanes[1] + ROAD_CONFIG.lanes[2]) / 2,
    (ROAD_CONFIG.lanes[2] + ROAD_CONFIG.lanes[3]) / 2,
  ];

  for (let y = -dividerStep; y < GAME_HEIGHT + dividerStep; y += dividerStep) {
    laneDividersX.forEach((x, idx) => {
      const color = idx === 1 ? 0xffd166 : 0xdddddd;
      const stripe = scene.add.rectangle(x, y, 5, 26, color, 0.85).setDepth(2);
      scene.laneDividers.push({ stripe });
    });
  }

  scene.speedLines = [];
  for (let i = 0; i < 16; i += 1) {
    const sl = scene.add.rectangle(
      Phaser.Math.Between(ROAD_CONFIG.left + 20, ROAD_CONFIG.right - 20),
      Phaser.Math.Between(0, GAME_HEIGHT),
      2,
      Phaser.Math.Between(30, 80),
      0x54a0ff,
      0.5
    ).setDepth(4).setVisible(false);
    scene.speedLines.push(sl);
  }

  // Grupo para pasarelas/arcos de estaciones del Metro
  scene.metroBridges = scene.add.group();
}

// ============================================================================
// JUGADOR: LA CAMIONETA
// ============================================================================
function createPlayer(scene) {
  const model = VEHICLE_MODELS[scene.gameState.selectedVehicleIndex];
  const shadow = scene.add.image(ROAD_CONFIG.lanes[1], 490, 'tex_van_shadow').setDepth(5);

  const player = scene.physics.add.sprite(ROAD_CONFIG.lanes[1], 480, model.texture);
  player.setDepth(6);
  player.setCollideWorldBounds(true);
  player.body.setSize(38, 76);
  player.body.setOffset(5, 6);

  const flameL = scene.add.image(player.x - 12, player.y + 44, 'tex_flame').setDepth(5).setVisible(false);
  const flameR = scene.add.image(player.x + 12, player.y + 44, 'tex_flame').setDepth(5).setVisible(false);

  player.shadow = shadow;
  player.flameL = flameL;
  player.flameR = flameR;
  player.currentLane = 1;
  player.targetX = ROAD_CONFIG.lanes[1];
  player.isJumping = false;
  player.jumpCooldown = 0;
  player.steerCooldown = 0;

  scene.player = player;
}

// ============================================================================
// GRUPOS DE OBSTÁCULOS
// ============================================================================
function createObstacleGroups(scene) {
  scene.potholes = scene.physics.add.group();
  scene.traffic = scene.physics.add.group();
  scene.arepas = scene.physics.add.group();

  scene.physics.add.overlap(scene.player, scene.potholes, (player, pothole) => {
    handlePotholeCollision(scene, player, pothole);
  });

  scene.physics.add.overlap(scene.player, scene.traffic, (player, vehicle) => {
    handleTrafficCollision(scene, player, vehicle);
  });

  scene.physics.add.overlap(scene.player, scene.arepas, (player, arepa) => {
    handleArepaPickup(scene, player, arepa);
  });
}

// ============================================================================
// HUD ESTILO RETRO ARCADE
// ============================================================================
function createHud(scene) {
  scene.hud = {};

  scene.hud.container = scene.add.container(0, 0).setDepth(20).setVisible(false);

  const topBar = scene.add.rectangle(GAME_WIDTH / 2, 24, GAME_WIDTH, 48, 0x05090f, 0.88)
    .setStrokeStyle(2, 0x1f344d, 0.9);
  scene.hud.topBar = topBar;

  scene.hud.distanceText = scene.add.text(24, 14, '0 KM', {
    fontFamily: 'monospace',
    fontSize: '18px',
    color: '#00d2d3',
    fontStyle: 'bold',
  });

  scene.hud.scoreText = scene.add.text(GAME_WIDTH / 2, 14, 'SCORE 00000', {
    fontFamily: 'monospace',
    fontSize: '20px',
    color: '#ffd166',
    fontStyle: 'bold',
  }).setOrigin(0.5, 0);

  scene.hud.highScoreText = scene.add.text(GAME_WIDTH - 24, 14, 'HI 00000', {
    fontFamily: 'monospace',
    fontSize: '16px',
    color: '#8395a7',
    fontStyle: 'bold',
  }).setOrigin(1, 0);

  // Contador de Arepas
  scene.hud.arepasIcon = scene.add.image(36, 68, 'tex_arepa').setScale(0.85);
  scene.hud.arepasText = scene.add.text(56, 58, 'x0', {
    fontFamily: 'monospace',
    fontSize: '18px',
    color: '#fffa65',
    fontStyle: 'bold',
  });

  // Barra de Turbo
  scene.hud.turboLabel = scene.add.text(GAME_WIDTH - 180, 58, 'TURBO', {
    fontFamily: 'monospace',
    fontSize: '13px',
    color: '#54a0ff',
    fontStyle: 'bold',
  });

  scene.hud.turboBg = scene.add.rectangle(GAME_WIDTH - 80, 66, 120, 14, 0x1b2838, 0.9)
    .setStrokeStyle(1, 0x54a0ff, 0.8);

  scene.hud.turboBar = scene.add.rectangle(GAME_WIDTH - 139, 66, 116, 10, 0x00d2d3, 1)
    .setOrigin(0, 0.5);

  // Indicador de Vidas
  scene.hud.lifeIcons = [];
  for (let i = 0; i < 4; i += 1) {
    const icon = scene.add.image(GAME_WIDTH / 2 - 45 + i * 30, 66, 'tex_van_encava')
      .setScale(0.35);
    scene.hud.lifeIcons.push(icon);
  }

  // Indicador de Estación actual del Metro de Caracas
  scene.hud.stationBadge = scene.add.rectangle(GAME_WIDTH / 2, 94, 380, 24, 0x08121e, 0.9)
    .setStrokeStyle(1.5, 0xe67e22, 0.85);

  scene.hud.stationText = scene.add.text(GAME_WIDTH / 2, 94, '🚇 ESTACIÓN: PROPATRIA', {
    fontFamily: 'monospace',
    fontSize: '13px',
    color: '#f39c12',
    fontStyle: 'bold',
  }).setOrigin(0.5);

  scene.hud.audioStatus = scene.add.text(24, 94, '🔊 [M] MUTE', {
    fontFamily: 'monospace',
    fontSize: '12px',
    color: '#7bed9f',
  });

  scene.hud.container.add([
    topBar,
    scene.hud.distanceText,
    scene.hud.scoreText,
    scene.hud.highScoreText,
    scene.hud.arepasIcon,
    scene.hud.arepasText,
    scene.hud.turboLabel,
    scene.hud.turboBg,
    scene.hud.turboBar,
    ...scene.hud.lifeIcons,
    scene.hud.stationBadge,
    scene.hud.stationText,
    scene.hud.audioStatus,
  ]);

  // Toast flotante
  scene.hud.toast = scene.add.text(GAME_WIDTH / 2, 220, '', {
    fontFamily: 'monospace',
    fontSize: '22px',
    color: '#00ff88',
    fontStyle: 'bold',
    stroke: '#003311',
    strokeThickness: 4,
  }).setOrigin(0.5).setDepth(25).setAlpha(0);
}

function showToast(scene, text, color = '#00ff88', duration = 1100, hold = 400) {
  scene.hud.toast.setText(text);
  scene.hud.toast.setColor(color);
  scene.hud.toast.setAlpha(1);
  scene.hud.toast.setScale(1.25);
  scene.hud.toast.setY(215);

  scene.tweens.killTweensOf(scene.hud.toast);
  scene.tweens.add({
    targets: scene.hud.toast,
    y: 175,
    alpha: 0,
    scale: 0.95,
    hold: hold,
    duration: duration,
    ease: 'Cubic.easeOut',
  });
}

// Banner especial para cuando llegas a una nueva estación del Metro
function showMetroStationBanner(scene, stationName, recoveredLife = false) {
  scene.soundEngine.playMetroChime();

  const bannerContainer = scene.add.container(GAME_WIDTH / 2, -60).setDepth(28);
  const bg = scene.add.rectangle(0, 0, 560, 74, 0x060e17, 0.95)
    .setStrokeStyle(3, 0xf39c12, 1);
  const title = scene.add.text(0, -18, '🚇 METRO DE CARACAS • LÍNEA 1', {
    fontFamily: 'monospace',
    fontSize: '13px',
    color: '#e67e22',
    fontStyle: 'bold',
  }).setOrigin(0.5);

  const name = scene.add.text(0, 4, `ESTACIÓN: ${stationName}`, {
    fontFamily: 'monospace',
    fontSize: '19px',
    color: '#ffffff',
    fontStyle: 'bold',
    stroke: '#b33939',
    strokeThickness: 3,
  }).setOrigin(0.5);

  const bonusText = scene.add.text(0, 24, recoveredLife ? '❤️ ¡+1 VIDA RECUPERADA! (+250 PTS)' : '¡ESTACIÓN ALCANZADA! (+250 PTS)', {
    fontFamily: 'monospace',
    fontSize: '12px',
    color: recoveredLife ? '#2ed573' : '#ffd166',
    fontStyle: 'bold',
  }).setOrigin(0.5);

  bannerContainer.add([bg, title, name, bonusText]);

  scene.tweens.add({
    targets: bannerContainer,
    y: 140,
    duration: 500,
    ease: 'Back.easeOut',
    hold: 2400,
    yoyo: true,
    onComplete: () => bannerContainer.destroy(),
  });

  if (recoveredLife) {
    showToast(scene, '❤️ ¡+1 VIDA RECUPERADA!', '#2ed573');
  }

  // Crear puente/pasarela sobre la autopista que cruza la camioneta
  spawnOverheadMetroBridge(scene, stationName);
}

function spawnOverheadMetroBridge(scene, stationName) {
  const bridgeContainer = scene.add.container(GAME_WIDTH / 2, -120).setDepth(15);
  const bridgeBg = scene.add.rectangle(0, 0, ROAD_CONFIG.width + 40, 56, 0x1e272e, 0.98)
    .setStrokeStyle(3, 0xf39c12, 1);
  const bridgeStripe = scene.add.rectangle(0, 22, ROAD_CONFIG.width + 40, 6, 0xe67e22, 1);
  const bridgeText = scene.add.text(0, 0, `[ 🚇 ESTACIÓN ${stationName} ]`, {
    fontFamily: 'monospace',
    fontSize: '16px',
    color: '#ffffff',
    fontStyle: 'bold',
  }).setOrigin(0.5);

  bridgeContainer.add([bridgeBg, bridgeStripe, bridgeText]);
  scene.metroBridges.add(bridgeContainer);
}

// ============================================================================
// PANTALLAS: SELECCIÓN DE CAMIONETA / INICIO Y GAME OVER
// ============================================================================
function createStartScreen(scene) {
  scene.startScreen = scene.add.container(0, 0).setDepth(100);

  const backdrop = scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x070b12, 0.96);
  scene.startScreen.add(backdrop);

  const subtitle = scene.add.text(GAME_WIDTH / 2, 45, 'PLATANUS HACK 26 — ARCADE', {
    fontFamily: 'monospace',
    fontSize: '14px',
    color: '#00d2d3',
    fontStyle: 'bold',
  }).setOrigin(0.5);

  const title = scene.add.text(GAME_WIDTH / 2, 80, 'RUTA CARACAS EXPRESS', {
    fontFamily: 'monospace',
    fontSize: '34px',
    color: '#ffd166',
    fontStyle: 'bold',
    stroke: '#b33939',
    strokeThickness: 5,
  }).setOrigin(0.5);

  // Panel de Selección de Camionetas
  const selHeader = scene.add.text(GAME_WIDTH / 2, 122, '◄ SELECCIONA TU CAMIONETA (A / D / JOYSTICK) ►', {
    fontFamily: 'monospace',
    fontSize: '14px',
    color: '#00ff88',
    fontStyle: 'bold',
  }).setOrigin(0.5);

  const cardBox = scene.add.rectangle(GAME_WIDTH / 2, 245, 560, 195, 0x101a26, 0.98)
    .setStrokeStyle(2, 0x00d2d3, 0.9)
    .setInteractive({ useHandCursor: true });

  const leftArrow = scene.add.text(GAME_WIDTH / 2 - 250, 245, '◄', {
    fontFamily: 'monospace',
    fontSize: '40px',
    color: '#00ff88',
    fontStyle: 'bold',
  }).setOrigin(0.5).setInteractive({ useHandCursor: true });

  const rightArrow = scene.add.text(GAME_WIDTH / 2 + 250, 245, '►', {
    fontFamily: 'monospace',
    fontSize: '40px',
    color: '#00ff88',
    fontStyle: 'bold',
  }).setOrigin(0.5).setInteractive({ useHandCursor: true });

  const selectPrev = () => {
    scene.gameState.selectedVehicleIndex = (scene.gameState.selectedVehicleIndex - 1 + VEHICLE_MODELS.length) % VEHICLE_MODELS.length;
    scene.soundEngine.playSelect();
    updateVehicleSelectionCard(scene);
  };

  const selectNext = () => {
    scene.gameState.selectedVehicleIndex = (scene.gameState.selectedVehicleIndex + 1) % VEHICLE_MODELS.length;
    scene.soundEngine.playSelect();
    updateVehicleSelectionCard(scene);
  };

  leftArrow.on('pointerdown', selectPrev);
  rightArrow.on('pointerdown', selectNext);
  cardBox.on('pointerdown', (pointer) => {
    if (pointer.x < GAME_WIDTH / 2) {
      selectPrev();
    } else {
      selectNext();
    }
  });

  // Sprite preview de la camioneta seleccionada
  scene.startScreen.vanPreview = scene.add.image(GAME_WIDTH / 2 - 160, 245, 'tex_van_encava')
    .setScale(1.35);

  scene.tweens.add({
    targets: scene.startScreen.vanPreview,
    y: 240,
    duration: 600,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });

  scene.startScreen.vanName = scene.add.text(GAME_WIDTH / 2 - 70, 175, '', {
    fontFamily: 'monospace',
    fontSize: '22px',
    color: '#ffd166',
    fontStyle: 'bold',
  });

  scene.startScreen.vanSubtitle = scene.add.text(GAME_WIDTH / 2 - 70, 204, '', {
    fontFamily: 'monospace',
    fontSize: '13px',
    color: '#e0fbfc',
    fontStyle: 'italic',
  });

  scene.startScreen.vanDesc = scene.add.text(GAME_WIDTH / 2 - 70, 226, '', {
    fontFamily: 'monospace',
    fontSize: '12px',
    color: '#8395a7',
    wordWrap: { width: 320 },
  });

  scene.startScreen.vanStats = scene.add.text(GAME_WIDTH / 2 - 70, 272, '', {
    fontFamily: 'monospace',
    fontSize: '13px',
    color: '#2ed573',
    lineSpacing: 4,
  });

  // Selector visual de puntos (1, 2, 3)
  scene.startScreen.dots = [];
  for (let i = 0; i < 3; i += 1) {
    const dot = scene.add.circle(GAME_WIDTH / 2 - 24 + i * 24, 355, 6, i === 0 ? 0x00ff88 : 0x485460);
    scene.startScreen.dots.push(dot);
  }

  // Panel inferior de controles
  const bottomPanel = scene.add.rectangle(GAME_WIDTH / 2, 435, 560, 95, 0x0c1520, 0.92)
    .setStrokeStyle(1.5, 0x3d5a80, 0.8);

  const controlsText = scene.add.text(GAME_WIDTH / 2, 435, [
    '🔘 [A / D / Flechas o Clic ◄ ►] : Elegir camioneta y carril',
    '🔘 BOTÓN 2 (Shift / X) : Turbo (sube KM rápido y +50 PTS al esquivar)',
    '🔘 BOTÓN 1 : Salto (+50 bache) | Come arepas (+100 PTS y nitro)',
    '🚇 Cada 2 KM recuperas 1 vida en estaciones del Metro de Caracas',
  ].join('\n'), {
    fontFamily: 'monospace',
    fontSize: '12px',
    color: '#dff9fb',
    align: 'center',
    lineSpacing: 3,
  }).setOrigin(0.5);

  const prompt = scene.add.text(GAME_WIDTH / 2, 515, '>>> PULSA START O HAZ CLIC PARA JUGAR <<<', {
    fontFamily: 'monospace',
    fontSize: '20px',
    color: '#00ff88',
    fontStyle: 'bold',
  }).setOrigin(0.5).setInteractive({ useHandCursor: true });

  prompt.on('pointerdown', () => {
    startGameplay(scene);
  });

  scene.tweens.add({
    targets: prompt,
    alpha: 0.25,
    duration: 500,
    yoyo: true,
    repeat: -1,
  });

  scene.startScreen.hiText = scene.add.text(GAME_WIDTH / 2, 565, 'RÉCORD ACTUAL: 0 PTS', {
    fontFamily: 'monospace',
    fontSize: '14px',
    color: '#8395a7',
  }).setOrigin(0.5);

  scene.startScreen.add([
    subtitle, title, selHeader, cardBox, leftArrow, rightArrow,
    scene.startScreen.vanPreview,
    scene.startScreen.vanName,
    scene.startScreen.vanSubtitle,
    scene.startScreen.vanDesc,
    scene.startScreen.vanStats,
    ...scene.startScreen.dots,
    bottomPanel, controlsText, prompt, scene.startScreen.hiText,
  ]);

  updateVehicleSelectionCard(scene);
}

function updateVehicleSelectionCard(scene) {
  const model = VEHICLE_MODELS[scene.gameState.selectedVehicleIndex];
  if (!scene.startScreen?.vanPreview) return;

  scene.startScreen.vanPreview.setTexture(model.texture);
  scene.startScreen.vanName.setText(model.name);
  scene.startScreen.vanName.setColor(model.color);
  scene.startScreen.vanSubtitle.setText(model.subtitle);
  scene.startScreen.vanDesc.setText(model.desc);
  scene.startScreen.vanStats.setText([
    `VELOCIDAD : ${model.stats.vel}`,
    `SALTO     : ${model.stats.salto}`,
    `TURBO     : ${model.stats.turbo}`,
  ].join('\n'));

  scene.startScreen.dots.forEach((dot, idx) => {
    dot.setFillStyle(idx === scene.gameState.selectedVehicleIndex ? 0x00ff88 : 0x485460);
  });
}

function createGameOverScreen(scene) {
  scene.gameOverScreen = scene.add.container(0, 0).setDepth(110).setVisible(false);

  const backdrop = scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x05070a, 0.95);

  const title = scene.add.text(GAME_WIDTH / 2, 100, '¡TE QUEDASTE EN LA COLA!', {
    fontFamily: 'monospace',
    fontSize: '34px',
    color: '#ff4757',
    fontStyle: 'bold',
    stroke: '#000000',
    strokeThickness: 5,
  }).setOrigin(0.5);

  const statsPanel = scene.add.rectangle(GAME_WIDTH / 2, 280, 520, 230, 0x121924, 0.95)
    .setStrokeStyle(2, 0xff4757, 0.8);

  scene.gameOverScreen.finalScore = scene.add.text(GAME_WIDTH / 2, 205, 'PUNTOS: 0', {
    fontFamily: 'monospace',
    fontSize: '26px',
    color: '#ffd166',
    fontStyle: 'bold',
  }).setOrigin(0.5);

  scene.gameOverScreen.finalDistance = scene.add.text(GAME_WIDTH / 2, 245, 'DISTANCIA: 0 KM', {
    fontFamily: 'monospace',
    fontSize: '18px',
    color: '#00d2d3',
  }).setOrigin(0.5);

  scene.gameOverScreen.finalStation = scene.add.text(GAME_WIDTH / 2, 280, 'ÚLTIMA ESTACIÓN: PROPATRIA', {
    fontFamily: 'monospace',
    fontSize: '17px',
    color: '#f39c12',
    fontStyle: 'bold',
  }).setOrigin(0.5);

  scene.gameOverScreen.finalArepas = scene.add.text(GAME_WIDTH / 2, 315, 'AREPAS RECOGIDAS: 0', {
    fontFamily: 'monospace',
    fontSize: '17px',
    color: '#fffa65',
  }).setOrigin(0.5);

  scene.gameOverScreen.recordMsg = scene.add.text(GAME_WIDTH / 2, 360, '', {
    fontFamily: 'monospace',
    fontSize: '18px',
    color: '#2ed573',
    fontStyle: 'bold',
  }).setOrigin(0.5);

  const restartPrompt = scene.add.text(GAME_WIDTH / 2, 450, '>>> [BOTÓN 1 / START] : REINTENTAR CARRERA <<<', {
    fontFamily: 'monospace',
    fontSize: '17px',
    color: '#00ff88',
    fontStyle: 'bold',
  }).setOrigin(0.5).setInteractive({ useHandCursor: true });

  const menuPrompt = scene.add.text(GAME_WIDTH / 2, 492, '🚐 [BOTÓN 2 / TURBO / CLIC AQUÍ] : CAMBIAR CAMIONETA (MENÚ)', {
    fontFamily: 'monospace',
    fontSize: '14px',
    color: '#00d2d3',
    fontStyle: 'bold',
  }).setOrigin(0.5).setInteractive({ useHandCursor: true });

  restartPrompt.on('pointerdown', () => {
    if (scene.time.now > (scene.gameState.canRestartAfter || 0)) {
      resetGame(scene);
      startGameplay(scene);
    }
  });

  menuPrompt.on('pointerdown', () => {
    if (scene.time.now > (scene.gameState.canRestartAfter || 0)) {
      returnToVehicleSelect(scene);
    }
  });

  scene.tweens.add({
    targets: restartPrompt,
    alpha: 0.35,
    duration: 500,
    yoyo: true,
    repeat: -1,
  });

  scene.gameOverScreen.add([
    backdrop,
    title,
    statsPanel,
    scene.gameOverScreen.finalScore,
    scene.gameOverScreen.finalDistance,
    scene.gameOverScreen.finalStation,
    scene.gameOverScreen.finalArepas,
    scene.gameOverScreen.recordMsg,
    restartPrompt,
    menuPrompt,
  ]);
}

// ============================================================================
// CONFIGURACIÓN DE CONTROLES
// ============================================================================
function setupInput(scene) {
  scene.controls = {
    held: Object.create(null),
    pressed: Object.create(null),
  };

  const onKeyDown = (event) => {
    const rawKey = event.key ? event.key.toLowerCase() : '';

    if (rawKey === 'm') {
      const isMuted = scene.soundEngine.toggleMute();
      if (scene.hud?.audioStatus) {
        scene.hud.audioStatus.setText(isMuted ? '🔇 [M] MUTED' : '🔊 [M] MUTE');
        scene.hud.audioStatus.setColor(isMuted ? '#ff4757' : '#7bed9f');
      }
      showToast(scene, isMuted ? 'AUDIO MUTEADO' : 'AUDIO ACTIVADO', isMuted ? '#ff4757' : '#7bed9f');
      return;
    }

    if (rawKey === 'h') {
      scene.soundEngine.playHorn();
      showToast(scene, '¡CORNETAZO! 🎺', '#ffd166');
    }

    const key = normalizeIncomingKey(event.key);
    if (!key) return;

    const arcadeCodes = KEYBOARD_TO_ARCADE[key];
    if (!arcadeCodes) return;

    for (let i = 0; i < arcadeCodes.length; i += 1) {
      const arcadeCode = arcadeCodes[i];
      if (!scene.controls.held[arcadeCode]) {
        scene.controls.pressed[arcadeCode] = true;
      }
      scene.controls.held[arcadeCode] = true;
    }
  };

  const onKeyUp = (event) => {
    const key = normalizeIncomingKey(event.key);
    if (!key) return;

    const arcadeCodes = KEYBOARD_TO_ARCADE[key];
    if (!arcadeCodes) return;

    for (let i = 0; i < arcadeCodes.length; i += 1) {
      const arcadeCode = arcadeCodes[i];
      scene.controls.held[arcadeCode] = false;
    }
  };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  scene.events.once('shutdown', () => {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    if (scene.soundEngine) {
      scene.soundEngine.stopBGM();
    }
  });
}

function isControlHeld(scene, code) {
  return scene.controls.held[code] === true;
}

function consumeControlPress(scene, code) {
  if (scene.controls.pressed[code]) {
    scene.controls.pressed[code] = false;
    return true;
  }
  return false;
}

// ============================================================================
// PERSISTENCIA DE RÉCORDS (STORAGE API DEL ARCADE)
// ============================================================================
async function loadHighScore(scene) {
  try {
    if (window.platanusArcadeStorage && typeof window.platanusArcadeStorage.get === 'function') {
      const res = await window.platanusArcadeStorage.get(STORAGE_KEY);
      if (res && res.found && res.value && typeof res.value.score === 'number') {
        scene.gameState.highScore = res.value.score;
      }
    } else {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed.score === 'number') {
          scene.gameState.highScore = parsed.score;
        }
      }
    }
  } catch (_) {}

  if (scene.hud?.highScoreText) {
    scene.hud.highScoreText.setText(`HI ${String(scene.gameState.highScore).padStart(5, '0')}`);
  }
  if (scene.startScreen && scene.startScreen.hiText) {
    scene.startScreen.hiText.setText(`RÉCORD ACTUAL: ${scene.gameState.highScore} PTS`);
  }
}

async function saveHighScore(scene, score) {
  if (score <= scene.gameState.highScore) return false;

  scene.gameState.highScore = score;
  if (scene.hud?.highScoreText) {
    scene.hud.highScoreText.setText(`HI ${String(score).padStart(5, '0')}`);
  }

  try {
    if (window.platanusArcadeStorage && typeof window.platanusArcadeStorage.set === 'function') {
      await window.platanusArcadeStorage.set(STORAGE_KEY, { score });
    } else {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ score }));
    }
    return true;
  } catch (_) {
    return false;
  }
}

// ============================================================================
// BUCLE PRINCIPAL DE JUEGO (UPDATE)
// ============================================================================
function update(time, delta) {
  const scene = this;
  const state = scene.gameState;

  // Menú de Selección en Pantalla de Inicio
  if (state.phase === 'start') {
    if (consumeControlPress(scene, 'P1_L')) {
      state.selectedVehicleIndex = (state.selectedVehicleIndex - 1 + VEHICLE_MODELS.length) % VEHICLE_MODELS.length;
      scene.soundEngine.playSelect();
      updateVehicleSelectionCard(scene);
    } else if (consumeControlPress(scene, 'P1_R')) {
      state.selectedVehicleIndex = (state.selectedVehicleIndex + 1) % VEHICLE_MODELS.length;
      scene.soundEngine.playSelect();
      updateVehicleSelectionCard(scene);
    }

    if (consumeControlPress(scene, 'START1') || consumeControlPress(scene, 'P1_1')) {
      startGameplay(scene);
    }
    return;
  }

  // Pantalla de Game Over
  if (state.phase === 'gameover') {
    if (time > (state.canRestartAfter || 0)) {
      if (consumeControlPress(scene, 'START1') || consumeControlPress(scene, 'P1_1')) {
        resetGame(scene);
        startGameplay(scene);
      } else if (consumeControlPress(scene, 'P1_2') || consumeControlPress(scene, 'P1_3') || consumeControlPress(scene, 'P1_L') || consumeControlPress(scene, 'P1_R')) {
        returnToVehicleSelect(scene);
      }
    }
    return;
  }

  if (consumeControlPress(scene, 'P1_3')) {
    scene.soundEngine.playHorn();
    showToast(scene, '¡CORNETAZO! 🎺', '#ffd166');
  }

  handlePlayerControls(scene, time, delta);
  updateRoadMovement(scene, delta);
  updateObstacles(scene, time, delta);
  updateMetroProgression(scene);
  updateHud(scene);
}

function returnToVehicleSelect(scene) {
  resetGame(scene);
  scene.gameState.phase = 'start';
  scene.soundEngine.stopBGM();
  scene.gameOverScreen.setVisible(false);
  if (scene.hud?.container) {
    scene.hud.container.setVisible(false);
  }
  scene.startScreen.setVisible(true);
  updateVehicleSelectionCard(scene);
}

function startGameplay(scene) {
  const model = VEHICLE_MODELS[scene.gameState.selectedVehicleIndex];
  scene.gameState.phase = 'playing';
  scene.gameState.baseSpeed = model.baseSpeed;
  scene.gameState.speed = model.baseSpeed;
  scene.gameState.lives = model.maxLives;
  scene.gameState.maxLives = model.maxLives;

  // Actualizar textura del jugador
  scene.player.setTexture(model.texture);

  scene.startScreen.setVisible(false);
  scene.gameOverScreen.setVisible(false);
  if (scene.hud?.container) {
    scene.hud.container.setVisible(true);
  }

  // Iniciar BGM chiptune
  scene.soundEngine.startBGM();

  // Resetear íconos de vidas según modelo
  scene.hud.lifeIcons.forEach((icon, idx) => {
    icon.setTexture(model.texture);
    icon.setVisible(idx < model.maxLives);
    icon.setAlpha(1);
  });
}

function resetGame(scene) {
  const state = scene.gameState;
  const model = VEHICLE_MODELS[state.selectedVehicleIndex];
  state.score = 0;
  state.distance = 0;
  state.baseSpeed = model.baseSpeed;
  state.speed = model.baseSpeed;
  state.turboActive = false;
  state.turboAmount = 100;
  state.arepasCollected = 0;
  state.lives = model.maxLives;
  state.invulnerableUntil = 0;
  state.nextSpawnDistance = 120;
  state.currentStationIndex = 0;
  state.nextStationDistance = 2000;

  scene.potholes.clear(true, true);
  scene.traffic.clear(true, true);
  scene.arepas.clear(true, true);
  scene.metroBridges.clear(true, true);

  scene.player.currentLane = 1;
  scene.player.targetX = ROAD_CONFIG.lanes[1];
  scene.player.setPosition(ROAD_CONFIG.lanes[1], 480);
  scene.player.setScale(1);
  scene.player.setAlpha(1);
  scene.player.isJumping = false;

  scene.hud.lifeIcons.forEach((icon, idx) => {
    icon.setVisible(idx < model.maxLives);
    icon.setAlpha(1);
  });
}

// ============================================================================
// SISTEMA DE ESTACIONES DEL METRO DE CARACAS (CADA 2 KM)
// ============================================================================
function updateMetroProgression(scene) {
  const state = scene.gameState;

  if (state.distance >= state.nextStationDistance) {
    state.currentStationIndex += 1;
    state.nextStationDistance += 2000; // Siguiente estación cada 2 km
    state.score += 250; // Bonificación por estación alcanzada

    let recoveredLife = false;
    if (state.lives < state.maxLives) {
      state.lives += 1;
      recoveredLife = true;
      if (scene.hud?.lifeIcons && scene.hud.lifeIcons[state.lives - 1]) {
        scene.hud.lifeIcons[state.lives - 1].setAlpha(1);
        scene.tweens.add({
          targets: scene.hud.lifeIcons[state.lives - 1],
          scale: 0.55,
          duration: 180,
          yoyo: true,
          repeat: 2,
        });
      }
    } else {
      state.turboAmount = 100;
    }

    const currentStation = getMetroStationName(state.currentStationIndex);
    showMetroStationBanner(scene, currentStation, recoveredLife);
  }
}

// ============================================================================
// CONTROL DEL JUGADOR
// ============================================================================
function handlePlayerControls(scene, time, delta) {
  const player = scene.player;
  const state = scene.gameState;
  const model = VEHICLE_MODELS[state.selectedVehicleIndex];

  if (time > player.steerCooldown) {
    if (isControlHeld(scene, 'P1_L') && player.currentLane > 0) {
      player.currentLane -= 1;
      player.targetX = ROAD_CONFIG.lanes[player.currentLane];
      player.steerCooldown = time + 180;
    } else if (isControlHeld(scene, 'P1_R') && player.currentLane < ROAD_CONFIG.lanes.length - 1) {
      player.currentLane += 1;
      player.targetX = ROAD_CONFIG.lanes[player.currentLane];
      player.steerCooldown = time + 180;
    }
  }

  player.x = Phaser.Math.Linear(player.x, player.targetX, 0.24);

  if (isControlHeld(scene, 'P1_U') && player.y > 380) {
    player.y -= 3.5;
  } else if (isControlHeld(scene, 'P1_D') && player.y < 530) {
    player.y += 3.5;
  }

  // Salto
  if ((consumeControlPress(scene, 'P1_1')) && !player.isJumping && time > player.jumpCooldown) {
    performJump(scene, player, time, model);
  }

  // Turbo
  const wantsTurbo = isControlHeld(scene, 'P1_2') && state.turboAmount > 0;
  if (wantsTurbo) {
    state.turboActive = true;
    state.turboAmount = Math.max(0, state.turboAmount - delta * 0.038);
    state.speed = state.baseSpeed * model.turboBoost;

    player.flameL.setVisible(true);
    player.flameR.setVisible(true);
    player.flameL.setPosition(player.x - 12, player.y + 44);
    player.flameR.setPosition(player.x + 12, player.y + 44);

    scene.speedLines.forEach((line) => {
      line.setVisible(true);
      line.y += delta * 1.8;
      if (line.y > GAME_HEIGHT) {
        line.y = -60;
        line.x = Phaser.Math.Between(ROAD_CONFIG.left + 20, ROAD_CONFIG.right - 20);
      }
    });

    scene.soundEngine.setEngineSpeed(true);
  } else {
    state.turboActive = false;
    state.speed = state.baseSpeed;
    player.flameL.setVisible(false);
    player.flameR.setVisible(false);
    scene.speedLines.forEach((line) => line.setVisible(false));

    state.turboAmount = Math.min(100, state.turboAmount + delta * 0.008);
    scene.soundEngine.setEngineSpeed(false, (state.speed - 340) / 320);
  }

  if (!player.isJumping) {
    player.shadow.setPosition(player.x + 3, player.y + 6);
    player.shadow.setScale(1);
    player.shadow.setAlpha(0.45);
  }

  if (time < state.invulnerableUntil) {
    player.setAlpha(Math.floor(time / 80) % 2 === 0 ? 0.3 : 1);
  } else {
    player.setAlpha(1);
  }
}

function performJump(scene, player, time, model) {
  player.isJumping = true;
  player.jumpCooldown = time + 750;
  scene.soundEngine.playJump();

  scene.tweens.add({
    targets: player,
    scale: model.jumpScale,
    duration: 270,
    yoyo: true,
    ease: 'Cubic.easeOut',
    onComplete: () => {
      player.isJumping = false;
      player.setScale(1);
    },
  });

  scene.tweens.add({
    targets: player.shadow,
    scale: 0.72,
    alpha: 0.18,
    y: player.y + 20,
    duration: 270,
    yoyo: true,
    ease: 'Cubic.easeOut',
  });
}

// ============================================================================
// MOVIMIENTO DE LA VÍA
// ============================================================================
function updateRoadMovement(scene, delta) {
  const state = scene.gameState;
  const pixelsMoved = (state.speed * delta) / 1000;

  // Con turbo los kilómetros suben más rápido
  const turboDistMult = state.turboActive ? 2.5 : 1.0;
  state.distance += pixelsMoved * 0.16 * turboDistMult;

  // Puntaje pasivo eliminado: el puntaje solo sube esquivando con turbo, saltando baches o comiendo arepas
  const model = VEHICLE_MODELS[state.selectedVehicleIndex];
  state.baseSpeed = Math.min(700, model.baseSpeed + Math.floor(state.distance / 500) * 22);

  scene.curbs.forEach((curb) => {
    curb.left.y += pixelsMoved;
    curb.right.y += pixelsMoved;
    if (curb.left.y > GAME_HEIGHT + 40) {
      curb.left.y -= (GAME_HEIGHT + 80);
      curb.right.y -= (GAME_HEIGHT + 80);
    }
  });

  scene.laneDividers.forEach((item) => {
    item.stripe.y += pixelsMoved;
    if (item.stripe.y > GAME_HEIGHT + 30) {
      item.stripe.y -= (GAME_HEIGHT + 60);
    }
  });

  // Mover pasarelas/puentes del Metro
  scene.metroBridges.children.each((bridge) => {
    bridge.y += pixelsMoved;
    if (bridge.y > GAME_HEIGHT + 100) {
      bridge.destroy();
    }
  });
}

// ============================================================================
// GESTIÓN DE OBSTÁCULOS
// ============================================================================
function updateObstacles(scene, time, delta) {
  const state = scene.gameState;
  const pixelsMoved = (state.speed * delta) / 1000;

  if (state.distance >= state.nextSpawnDistance) {
    spawnRandomPattern(scene);
    const interval = Math.max(90, 190 - Math.floor(state.distance / 600) * 15);
    state.nextSpawnDistance = state.distance + interval;
  }

  scene.potholes.children.each((pothole) => {
    pothole.y += pixelsMoved;
    // Esquivar bache con turbo cuando pasa al jugador sin dañarlo
    if (!pothole.cleared && !pothole.dodged && pothole.y > scene.player.y + 40) {
      pothole.dodged = true;
      if (state.turboActive) {
        state.score += 50;
        scene.soundEngine.playDodge();
        showToast(scene, '¡BACHE ESQUIVADO (TURBO)! +50', '#00d2d3');
      }
    }
    if (pothole.y > GAME_HEIGHT + 60) {
      pothole.destroy();
    }
  });

  scene.traffic.children.each((vehicle) => {
    const speedRatio = vehicle.vehicleType === 'moto' ? 0.8 : 0.55;
    vehicle.y += pixelsMoved * speedRatio;

    if (vehicle.vehicleType === 'moto' && vehicle.zigzagDir) {
      vehicle.x += vehicle.zigzagDir * (delta * 0.04);
      if (vehicle.x < ROAD_CONFIG.left + 30) vehicle.zigzagDir = 1;
      if (vehicle.x > ROAD_CONFIG.right - 30) vehicle.zigzagDir = -1;
    }

    // Esquivar moto o carro con turbo cuando pasa al jugador sin chocar
    if (!vehicle.dodged && vehicle.y > scene.player.y + 40) {
      vehicle.dodged = true;
      if (state.turboActive) {
        state.score += 50;
        scene.soundEngine.playDodge();
        const tag = vehicle.vehicleType === 'moto' ? '¡MOTO ESQUIVADA (TURBO)! +50' : '¡CARRO ESQUIVADO (TURBO)! +50';
        showToast(scene, tag, '#00d2d3');
      }
    }

    if (vehicle.y > GAME_HEIGHT + 80) {
      vehicle.destroy();
    }
  });

  scene.arepas.children.each((arepa) => {
    arepa.y += pixelsMoved;
    arepa.angle += delta * 0.12;
    if (arepa.y > GAME_HEIGHT + 50) {
      arepa.destroy();
    }
  });
}

function spawnRandomPattern(scene) {
  const rand = Phaser.Math.Between(1, 10);
  const lanes = [0, 1, 2, 3];
  Phaser.Utils.Array.Shuffle(lanes);

  if (rand <= 4) {
    spawnPothole(scene, lanes[0]);
    if (Phaser.Math.Between(1, 100) > 65) {
      spawnPothole(scene, lanes[1]);
    }
    if (Phaser.Math.Between(1, 100) > 40) {
      spawnArepa(scene, lanes[2]);
    }
  } else if (rand <= 8) {
    const isMoto = Phaser.Math.Between(1, 100) > 55;
    spawnTrafficVehicle(scene, lanes[0], isMoto ? 'moto' : 'car');

    if (Phaser.Math.Between(1, 100) > 50) {
      spawnArepa(scene, lanes[1]);
    } else {
      spawnPothole(scene, lanes[2]);
    }
  } else {
    const arepaLane = lanes[0];
    for (let i = 0; i < 3; i += 1) {
      scene.time.delayedCall(i * 120, () => {
        if (scene.gameState.phase === 'playing') {
          spawnArepa(scene, arepaLane, -40 - i * 50);
        }
      });
    }
  }
}

function spawnPothole(scene, laneIndex) {
  const x = ROAD_CONFIG.lanes[laneIndex];
  const pothole = scene.potholes.create(x, -30, 'tex_pothole');
  pothole.setDepth(3);
  pothole.body.setSize(44, 24);
  pothole.cleared = false;
  pothole.dodged = false;
}

function spawnTrafficVehicle(scene, laneIndex, type) {
  const x = ROAD_CONFIG.lanes[laneIndex];
  let tex = 'tex_car_blue';
  if (type === 'moto') {
    tex = 'tex_moto';
  } else {
    tex = Phaser.Math.Between(0, 1) === 0 ? 'tex_taxi' : 'tex_car_blue';
  }

  const vehicle = scene.traffic.create(x, -60, tex);
  vehicle.setDepth(5);
  vehicle.vehicleType = type;
  vehicle.dodged = false;

  if (type === 'moto') {
    vehicle.body.setSize(18, 44);
    vehicle.zigzagDir = Phaser.Math.Between(0, 1) === 0 ? 1 : -1;
  } else {
    vehicle.body.setSize(34, 62);
  }
}

function spawnArepa(scene, laneIndex, yOffset = -30) {
  const x = ROAD_CONFIG.lanes[laneIndex];
  const arepa = scene.arepas.create(x, yOffset, 'tex_arepa');
  arepa.setDepth(4);
  arepa.body.setCircle(14, 2, 2);
}

// ============================================================================
// COLISIONES
// ============================================================================
function handlePotholeCollision(scene, player, pothole) {
  if (scene.gameState.phase !== 'playing') return;
  if (pothole.cleared) return;

  if (player.isJumping) {
    pothole.cleared = true;
    pothole.dodged = true;
    scene.gameState.score += 50;
    scene.soundEngine.playDodge();
    showToast(scene, '¡BACHE SALTADO! +50', '#00ff88');
    return;
  }

  pothole.cleared = true;
  pothole.dodged = true;
  takeDamage(scene, '¡COÑO, CAÍ EN UN HUECO!');
}

function handleTrafficCollision(scene, player, vehicle) {
  if (scene.gameState.phase !== 'playing') return;
  vehicle.dodged = true;
  takeDamage(scene, vehicle.vehicleType === 'moto' ? '¡QUÍTATE MMGVO!' : '¡SIEMPRE ES UN PAJUO!');
  vehicle.destroy();
}

function takeDamage(scene, reason) {
  const state = scene.gameState;
  if (state.phase !== 'playing') return;
  const now = scene.time.now;
  const model = VEHICLE_MODELS[state.selectedVehicleIndex];
  if (now < state.invulnerableUntil) return;

  state.lives -= 1;
  state.invulnerableUntil = now + model.invulnTime;
  scene.soundEngine.playCrash();

  scene.cameras.main.shake(250, 0.02);
  showToast(scene, reason, '#ff4757', 1400, 900);

  if (scene.hud.lifeIcons[state.lives]) {
    scene.hud.lifeIcons[state.lives].setAlpha(0.2);
  }

  if (state.lives <= 0) {
    triggerGameOver(scene);
  }
}

function handleArepaPickup(scene, player, arepa) {
  if (scene.gameState.phase !== 'playing') return;
  arepa.destroy();
  const state = scene.gameState;
  state.arepasCollected += 1;
  state.score += 100;
  state.turboAmount = Math.min(100, state.turboAmount + 25);

  scene.soundEngine.playArepa();
  showToast(scene, '¡AREPA CALIENTE! +100', '#ffd166');

  for (let i = 0; i < 6; i += 1) {
    const spark = scene.add.rectangle(arepa.x, arepa.y, 4, 4, 0xffd166, 1).setDepth(10);
    const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
    const dist = Phaser.Math.Between(20, 50);

    scene.tweens.add({
      targets: spark,
      x: arepa.x + Math.cos(angle) * dist,
      y: arepa.y + Math.sin(angle) * dist,
      alpha: 0,
      scale: 0.2,
      duration: 350,
      onComplete: () => spark.destroy(),
    });
  }
}

// ============================================================================
// FIN DE PARTIDA
// ============================================================================
function triggerGameOver(scene) {
  const state = scene.gameState;
  if (state.phase === 'gameover') return;
  state.phase = 'gameover';

  scene.soundEngine.playGameOver();

  // Capturar valores finales de forma inmediata y síncrona para evitar que
  // cualquier reinicio o llamada asíncrona los sobreescriba en 0
  const finalScore = state.score;
  const finalDistanceKm = (state.distance / 1000).toFixed(2);
  const finalStationName = getMetroStationName(state.currentStationIndex);
  const finalArepasCount = state.arepasCollected;

  scene.gameOverScreen.finalScore.setText(`PUNTOS TOTALES: ${finalScore}`);
  scene.gameOverScreen.finalDistance.setText(`DISTANCIA: ${finalDistanceKm} KM`);
  scene.gameOverScreen.finalStation.setText(`ÚLTIMA ESTACIÓN: ${finalStationName}`);
  scene.gameOverScreen.finalArepas.setText(`AREPAS RECOGIDAS: ${finalArepasCount}`);

  // Cooldown de 600 ms para evitar que el botón de salto presionado al chocar
  // reinicie la partida involuntariamente en el mismo instante
  state.canRestartAfter = scene.time.now + 600;

  if (scene.hud?.container) {
    scene.hud.container.setVisible(false);
  }
  scene.gameOverScreen.setVisible(true);

  // Guardar récord de forma desacoplada y asíncrona
  saveHighScore(scene, finalScore).then((isNewRecord) => {
    if (scene.gameOverScreen?.recordMsg) {
      if (isNewRecord) {
        scene.gameOverScreen.recordMsg.setText('¡NUEVO RÉCORD CARAQUEÑO!');
        scene.gameOverScreen.recordMsg.setColor('#00ff88');
      } else {
        scene.gameOverScreen.recordMsg.setText(`MEJOR RÉCORD: ${state.highScore} PTS`);
        scene.gameOverScreen.recordMsg.setColor('#8395a7');
      }
    }
  }).catch(() => {});
}

function updateHud(scene) {
  const state = scene.gameState;
  if (!scene.hud.scoreText) return;

  scene.hud.scoreText.setText(`SCORE ${String(state.score).padStart(5, '0')}`);
  scene.hud.distanceText.setText(`${(state.distance / 1000).toFixed(1)} KM`);
  scene.hud.arepasText.setText(`x${state.arepasCollected}`);

  const currentStation = getMetroStationName(state.currentStationIndex);
  const kmToNext = Math.max(0, (state.nextStationDistance - state.distance) / 1000).toFixed(1);
  scene.hud.stationText.setText(`🚇 ${currentStation} (${kmToNext} KM A LA PRÓXIMA)`);

  const barWidth = Math.max(0, (state.turboAmount / 100) * 116);
  scene.hud.turboBar.setSize(barWidth, 10);
  scene.hud.turboBar.setFillStyle(state.turboAmount > 20 ? 0x00d2d3 : 0xff4757);
}
