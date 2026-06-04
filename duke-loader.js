/**
 * duke-loader.js — Brew Lab Duke3D Asset Loader
 *
 * Preloads extracted Duke Nukem 3D audio and sprites into the browser,
 * then exposes buffers/images to SoundEngine for real-audio playback.
 *
 * Designed to be 100% transparent — any failed asset silently falls
 * back to SoundEngine's synthesised sounds. Works offline (graceful miss).
 *
 * Interface:
 *   DukeLoader.preload(ctx)         — call once after first user gesture
 *   DukeLoader.isReady()            — true when preload settled
 *   DukeLoader.hasAudio(name)       — true if buffer loaded for that sound
 *   DukeLoader.getBuffer(name)      — AudioBuffer | null
 *   DukeLoader.getSprite(key)       — HTMLImageElement | null
 *   DukeLoader.getStatus()          — { loaded, total, sprites, spritesTotal }
 *
 * Sound names match SoundEngine public API:
 *   tap | engage | targetAcquired | denied | boot | toggle | select | dukeHail
 *
 * Asset paths:
 *   assets/duke3d/audio/<filename>.wav    (from extract-duke.js)
 *   assets/duke3d/sprites/<name>.png      (from extract-duke.js)
 */

/* global DukeLoader */
'use strict';

const DukeLoader = (() => {

  // ── Asset manifest ────────────────────────────────────────
  // Each sound tries candidates in order; first successful load wins.
  // Filenames match what extract-duke.js writes to assets/duke3d/audio/.
  const AUDIO_BASE   = 'assets/duke3d/audio/';
  const SPRITES_BASE = 'assets/duke3d/sprites/';

  const AUDIO_MAP = {
    tap:            ['ricochet-01.wav'],                                                          // no ui-click file exists; ricochet is closest short SFX
    engage:         ['engage-shrinker-01.wav', 'engage-rpg-01.wav', 'engage-charge-01.wav'],
    targetAcquired: ['target-score-01.wav', 'target-pickup-01.wav'],
    denied:         ['explosion-small-01.wav', 'player-pain-01.wav'],
    toggle:         ['ricochet-01.wav'],
    select:         ['ricochet-01.wav'],
    dukeHail:       ['duke-hail-01.wav', 'duke-attitude-01.wav'],
    // boot intentionally omitted — synthesised CRT power-on has no good Duke equivalent

    // Named aliases used by the SoundEngine defensive wrappers
    'engage-shrinker': ['engage-shrinker-01.wav'],
    'engage-charge':   ['engage-charge-01.wav'],
    'target-score':    ['target-score-01.wav', 'target-score-02.wav'],
    'duke-hail':       ['duke-hail-01.wav', 'duke-attitude-01.wav'],
  };

  const SPRITE_MAP = {
    'hud-neutral':  'duke-hud-neutral.png',
    'hud-smile':    'duke-hud-smile.png',
    'hud-hurt':     'duke-hud-hurt.png',
    'hud-critical': 'duke-hud-critical.png',
    'logo-top':     'duke-logo-top.png',
    'logo-bottom':  'duke-logo-bottom.png',
  };

  // ── State ─────────────────────────────────────────────────
  let _ctx     = null;   // AudioContext (set by preload())
  let _ready   = false;  // true once preload() has settled
  let _loading = false;  // prevents duplicate preload calls

  const _buffers = {};   // name → AudioBuffer
  const _sprites = {};   // key  → HTMLImageElement

  // ── Helpers ───────────────────────────────────────────────

  // Fetch + decode one audio file. Returns AudioBuffer or throws.
  async function _fetchAudio(filename) {
    const url  = AUDIO_BASE + filename;
    const resp = await fetch(url, { cache: 'force-cache' });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const arr  = await resp.arrayBuffer();
    return _ctx.decodeAudioData(arr);
  }

  // Try candidate filenames in order; store first success.
  async function _loadSound(name, candidates) {
    for (const file of candidates) {
      try {
        _buffers[name] = await _fetchAudio(file);
        console.debug(`[DukeLoader] ✓ ${name} ← ${file}`);
        return;
      } catch (e) {
        // silent miss — try next candidate
      }
    }
    // All candidates failed — will fall back to synth
    console.debug(`[DukeLoader] ✗ ${name} (all ${candidates.length} candidates missing)`);
  }

  // Preload one sprite; store on success.
  function _loadSprite(key, filename) {
    return new Promise(resolve => {
      const img    = new Image();
      img.onload   = () => { _sprites[key] = img; resolve(); };
      img.onerror  = () => { resolve(); /* silent miss */ };
      img.src      = SPRITES_BASE + filename;
    });
  }

  // ── Public API ────────────────────────────────────────────
  return {

    /**
     * Preload all assets. Call once after first user gesture
     * (AudioContext requires a prior interaction on iOS Safari).
     * Idempotent — safe to call multiple times.
     *
     * @param {AudioContext} [ctx] — pass on first call; reused on subsequent calls
     * @returns {Promise<void>}
     */
    async preload(ctx) {
      if (_ready || _loading) return;
      if (ctx) _ctx = ctx;
      if (!_ctx) return;

      _loading = true;
      console.log('[DukeLoader] Starting asset preload…');

      const audioJobs  = Object.entries(AUDIO_MAP).map(([name, files]) => _loadSound(name, files));
      const spriteJobs = Object.entries(SPRITE_MAP).map(([key, file]) => _loadSprite(key, file));

      await Promise.allSettled([...audioJobs, ...spriteJobs]);

      _ready   = true;
      _loading = false;

      const loaded  = Object.keys(_buffers).length;
      const sprites = Object.keys(_sprites).length;
      console.log(`[DukeLoader] Ready — ${loaded}/${Object.keys(AUDIO_MAP).length} sounds, ${sprites}/${Object.keys(SPRITE_MAP).length} sprites`);
    },

    /** True once preload() has settled (success or failure). */
    isReady() { return _ready; },

    /** True if an AudioBuffer was successfully loaded for this sound name. */
    hasAudio(name) { return !!_buffers[name]; },

    /**
     * Get a decoded AudioBuffer for a sound name.
     * Returns null if not loaded (caller must use synthesised fallback).
     * @param {string} name
     * @returns {AudioBuffer|null}
     */
    getBuffer(name) { return _buffers[name] || null; },

    /**
     * Get a loaded sprite image.
     * @param {string} key  e.g. 'hud-neutral', 'logo-top'
     * @returns {HTMLImageElement|null}
     */
    getSprite(key) { return _sprites[key] || null; },

    /**
     * Play a preloaded sound by AUDIO_MAP key name.
     * Connects directly to _ctx.destination — call only from within SoundEngine
     * after verifying _enabled and ctx, so master gain is already applied.
     * Returns true if the buffer was found and playback started, false otherwise.
     * @param {string} name   — AUDIO_MAP key (e.g. 'duke-hail', 'engage-charge')
     * @param {number} [gainVal=0.5]
     * @returns {boolean}
     */
    playSound(name, gainVal) {
      const buf = _buffers[name];
      if (!_ctx || !buf) return false;
      try {
        const src = _ctx.createBufferSource();
        const g   = _ctx.createGain();
        g.gain.value = gainVal != null ? gainVal : 0.5;
        src.buffer = buf;
        src.connect(g);
        g.connect(_ctx.destination);
        src.start();
        src.onended = () => { try { src.disconnect(); g.disconnect(); } catch(e){} };
        return true;
      } catch(e) {
        return false;
      }
    },

    /** Load counts for settings status display. */
    getStatus() {
      return {
        loaded:        Object.keys(_buffers).length,
        total:         Object.keys(AUDIO_MAP).length,
        sprites:       Object.keys(_sprites).length,
        spritesTotal:  Object.keys(SPRITE_MAP).length,
        ready:         _ready,
      };
    },

  };

})();
