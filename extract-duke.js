#!/usr/bin/env node
/**
 * extract-duke.js — Duke Nukem 3D GRP Asset Extractor for Brew Lab
 *
 * Reads a DUKE3D.GRP file and extracts:
 *   • All VOC sound files → 16-bit WAV, semantically mapped
 *   • All ART sprite tiles → transparent PNG with palette
 *   • A browseable HTML index of everything extracted
 *   • A Brew Lab SoundEngine integration snippet
 *
 * Usage:
 *   node extract-duke.js                      # looks for DUKE3D.GRP in cwd
 *   node extract-duke.js /path/to/DUKE3D.GRP  # explicit path
 *
 * Supports: Duke Nukem 3D registered v1.3d, Atomic Edition v1.5,
 *           Plutonium Pak, and most Build-engine GRP variants.
 *
 * LEGAL: Duke Nukem 3D assets © 3D Realms / Gearbox Software.
 *        This tool is for personal use only with files you legally own.
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ── DEPENDENCY CHECK ────────────────────────────────────────
let sharp;
try {
  sharp = require('sharp');
} catch (e) {
  console.error('\n❌  "sharp" not installed. Run:  npm install\n');
  process.exit(1);
}

// ── PATHS ───────────────────────────────────────────────────
const GRP_PATH = process.argv[2] || findGRP();
const OUT_DIR  = path.join(process.cwd(), 'assets', 'duke3d');

function findGRP() {
  const candidates = ['DUKE3D.GRP', 'duke3d.grp', 'DUKE.GRP', 'DUKEDC.GRP'];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  // Search one level up
  for (const c of candidates) {
    const up = path.join('..', c);
    if (fs.existsSync(up)) return up;
  }
  return 'DUKE3D.GRP'; // will fail with a clear message later
}

// ══════════════════════════════════════════════════════════════
// DUKE3D KNOWN ASSET MAP
// Based on Duke Nukem 3D registered v1.3d and Atomic Edition v1.5
// Sources: BUILD engine source, RRLOG.TXT, Duke modding community
// ══════════════════════════════════════════════════════════════

/**
 * VOC filename → semantic Brew Lab sound category.
 * Priority-ordered: first match wins.
 *
 * Sound numbering in Duke3D CON files maps to VOC files in GRP.
 * Registered v1.3d stores them as named files; Atomic Edition v1.5
 * also has DUKE.RFF with additional voice clips.
 *
 * Known mappings:
 *   SELECTWPN  = sound 79  = weapon selection click
 *   COCK_SHOT  = sound 6   = gun cock
 *   PIPEBMBSM  = sound 13  = pipebomb tick
 *   PIPED      = sound 14  = pipebomb detonate
 *   SHRINKER   = sound 86  = shrinker ray
 *   SHRINKEXP  = sound 87  = shrinker explosion
 *   RPGSHOOT   = sound 56  = RPG fire
 *   DUKE_INTRO = voice     = intro one-liner
 *   DUKE_HT    = voice     = "Hail to the king, baby"
 *   DRON*      = ambient   = electrical drones
 */
const SOUND_MAP = [
  // ── UI / MENU (maps to SoundEngine.tap()) ─────────────────
  { out: 'ui-click',          re: /^(SELECTWPN|COCK|GETWEAPON|SWCHBEST|MENU)/i },
  { out: 'ui-click',          re: /^(TICK|CLICK|SELECT|BEEP\d)/i },
  { out: 'ui-move',           re: /^(MOVE|SCROLL|SLIDE)/i },

  // ── ENGAGE — weapon / power-up (SoundEngine.engage()) ─────
  { out: 'engage-shrinker',   re: /SHRINK/i },
  { out: 'engage-pipebomb',   re: /PIPE|PIPEBMB/i },
  { out: 'engage-rpg',        re: /RPG|ROCKET/i },
  { out: 'engage-chaingun',   re: /CHAIN|CANON|CANNON/i },
  { out: 'engage-freeze',     re: /FREEZE|CRYST/i },
  { out: 'engage-charge',     re: /SHOOT|BLAST|CHARGE|FIRE/i },

  // ── TARGET ACQUIRED (SoundEngine.targetAcquired()) ─────────
  { out: 'target-lock',       re: /LOCK|BEEP|BLIP|SONAR/i },
  { out: 'target-pickup',     re: /PICKUP|ITEM|BONUS|AMMO/i },
  { out: 'target-score',      re: /SCORE|DING|COIN|GRAB/i },

  // ── DUKE VOICE (SoundEngine.dukeHail()) ────────────────────
  // Atomic Edition / Plutonium Pak voice lines
  { out: 'duke-hail',         re: /DUKE_HT\b|HAIL|KING\b/i },
  { out: 'duke-attitude',     re: /GROOV|COWBOY|PIECE|DAMN|HARD|BALLS/i },
  { out: 'duke-taunt',        re: /^DUKE_(?!RECOG|ACTOR)/i },
  { out: 'duke-voice',        re: /^DUKE/i },

  // ── EXPLOSIONS ─────────────────────────────────────────────
  { out: 'explosion-large',   re: /EXPLO|DETONA|BOOM/i },
  { out: 'explosion-small',   re: /BOMB|BURST/i },

  // ── AMBIENT / FX ───────────────────────────────────────────
  { out: 'player-pain',       re: /HURT|PAIN|WOUND|GROAN/i },
  { out: 'ambient-drone',     re: /DRON|HISS|HUM/i },
  { out: 'ricochet',          re: /RICO|SPARK|ZING/i },
];

/**
 * Target tile numbers for sprite extraction.
 *
 * Duke3D tile layout (registered v1.3d / Atomic Edition v1.5):
 *   TILES000.ART  tiles   0– 255  (world textures: brick, concrete, etc.)
 *   TILES001.ART  tiles 256– 511  (more textures + some UI)
 *   TILES002.ART  tiles 512– 767  (items, ammo, pickups)
 *   TILES003.ART  tiles 768–1023  (enemies)
 *   TILES004.ART  tiles 1024–1279 (Duke player sprite frames + HUD)
 *   TILES005.ART  tiles 1280–1535 (effects, explosions, HUD elements)
 *   TILES006.ART  tiles 1536–1791 (weapons, vehicles)
 *   TILES007.ART  tiles 1792–2047 (more effects)
 *   TILES008.ART  tiles 2048–2303 (title screen, logos, fonts)
 *
 * Duke's HUD status bar face sprites are in TILES004 / TILES005.
 * The exact tile numbers below are for registered v1.3d:
 *   - STATUS BAR face tiles start at approx tile 1191
 *   - Duke 3D logo pieces start at approx tile 2220
 *
 * The script will also search ±20 tiles around each target and
 * match by expected dimensions as a fallback.
 */
const TILE_TARGETS = {
  'duke-hud-neutral': {
    tile: 1191,
    expectedSize: { minW: 24, maxW: 48, minH: 24, maxH: 48 },
    desc: 'Duke HUD face — neutral / healthy',
  },
  'duke-hud-smile': {
    tile: 1193,
    expectedSize: { minW: 24, maxW: 48, minH: 24, maxH: 48 },
    desc: 'Duke HUD face — smiling / OK',
  },
  'duke-hud-hurt': {
    tile: 1195,
    expectedSize: { minW: 24, maxW: 48, minH: 24, maxH: 48 },
    desc: 'Duke HUD face — hurt / damaged',
  },
  'duke-hud-critical': {
    tile: 1197,
    expectedSize: { minW: 24, maxW: 48, minH: 24, maxH: 48 },
    desc: 'Duke HUD face — critical / near death',
  },
  'duke-logo-top': {
    tile: 2220,
    expectedSize: { minW: 80, maxW: 320, minH: 20, maxH: 100 },
    desc: 'Duke Nukem 3D title logo (upper portion)',
  },
  'duke-logo-bottom': {
    tile: 2221,
    expectedSize: { minW: 80, maxW: 320, minH: 20, maxH: 100 },
    desc: 'Duke Nukem 3D title logo (lower portion)',
  },
};

// ══════════════════════════════════════════════════════════════
// GRP PARSER
// Signature: "KenSilverman" (12 bytes) | count (uint32 LE)
// Directory: count × { name[12], size uint32 LE }
// Data: concatenated, in directory order
// ══════════════════════════════════════════════════════════════
function parseGRP(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`\n❌  GRP not found: ${filePath}`);
    console.error('    Usage: node extract-duke.js /path/to/DUKE3D.GRP\n');
    process.exit(1);
  }

  const buf = fs.readFileSync(filePath);
  const sig = buf.subarray(0, 12).toString('ascii').replace(/\0/g, '');

  if (!sig.startsWith('KenSilverman') && !sig.startsWith('KenBuild')) {
    console.warn(`⚠   Unexpected GRP signature "${sig}" — attempting parse anyway`);
  }

  const count = buf.readUInt32LE(12);
  const dirBytes = count * 16;

  if (16 + dirBytes > buf.length) {
    console.error('❌  GRP directory exceeds file size — file may be corrupt');
    process.exit(1);
  }

  console.log(`\n📦  ${path.basename(filePath)}  (${(buf.length / 1024 / 1024).toFixed(1)} MB, ${count} lumps)`);

  const entries = [];
  let dataOffset = 16 + dirBytes;

  for (let i = 0; i < count; i++) {
    const base    = 16 + i * 16;
    const nameRaw = buf.subarray(base, base + 12);
    const nameEnd = nameRaw.indexOf(0);
    const name    = nameRaw.subarray(0, nameEnd < 0 ? 12 : nameEnd).toString('ascii').trim();
    const size    = buf.readUInt32LE(base + 12);

    if (size === 0) { dataOffset += size; continue; }
    if (dataOffset + size > buf.length) {
      console.warn(`⚠   Lump "${name}" extends past EOF — skipping`);
      dataOffset += size;
      continue;
    }

    entries.push({
      name,
      nameU: name.toUpperCase(),
      ext:   path.extname(name).toUpperCase().replace('.', ''),
      size,
      data:  buf.subarray(dataOffset, dataOffset + size),
    });
    dataOffset += size;
  }

  return entries;
}

// ══════════════════════════════════════════════════════════════
// PALETTE LOADER  (PALETTE.DAT inside GRP)
// 256 × 3 bytes: VGA 6-bit values (0–63), multiply × 4 → 8-bit.
// Palette index 255 is transparent (Build engine convention).
// ══════════════════════════════════════════════════════════════
function loadPalette(entries) {
  const pal = entries.find(e => e.nameU === 'PALETTE.DAT');
  if (!pal || pal.data.length < 768) {
    console.warn('⚠   PALETTE.DAT missing or short — using greyscale fallback');
    const p = new Uint8Array(256 * 4);
    for (let i = 0; i < 256; i++) { p[i*4] = p[i*4+1] = p[i*4+2] = i; p[i*4+3] = 255; }
    return p;
  }

  const palette = new Uint8Array(256 * 4);
  for (let i = 0; i < 256; i++) {
    palette[i*4]   = Math.min(255, pal.data[i*3]   * 4);  // R (VGA 6-bit → 8-bit)
    palette[i*4+1] = Math.min(255, pal.data[i*3+1] * 4);  // G
    palette[i*4+2] = Math.min(255, pal.data[i*3+2] * 4);  // B
    palette[i*4+3] = i === 255 ? 0 : 255;                  // A (index 255 = transparent)
  }
  return palette;
}

// ══════════════════════════════════════════════════════════════
// VOC → WAV CONVERTER
// Creative Voice File format spec:
//   Bytes 0–18: "Creative Voice File\x1a"
//   Bytes 20–21: header size (uint16 LE, typically 0x001a = 26)
//   Bytes 22–23: version (uint16 LE)
//   Bytes 24–25: ~version XOR 0x1234 (validity check)
//   Then: blocks (type byte + 3-byte LE size + data)
//
// Block types handled:
//   0 = terminator
//   1 = 8-bit PCM mono  (time-constant byte, codec byte, samples)
//   2 = continuation    (raw samples, same format as previous block 1)
//   8 = extended info   (precedes block 1 for stereo / rate adjustment)
//   9 = new sound data  (v1.20+: explicit sample rate, bits, channels)
// ══════════════════════════════════════════════════════════════
function vocToWav(data) {
  // Garbage filter: check Creative Voice File signature
  if (data.length < 26) return null;
  const sig = data.subarray(0, 19).toString('ascii');
  if (!sig.startsWith('Creative Voice File')) return null;

  const hdrSize = data.readUInt16LE(20);
  let pos = hdrSize;

  let sampleRate = 11025;  // conservative default for Duke3D sounds
  let bits       = 8;
  let channels   = 1;
  const chunks   = [];     // collect Buffer chunks of 8-bit unsigned PCM

  while (pos < data.length) {
    if (pos >= data.length) break;
    const type = data[pos++];
    if (type === 0) break;  // terminator

    if (pos + 3 > data.length) break;
    const size = data[pos] | (data[pos+1] << 8) | (data[pos+2] << 16);
    pos += 3;
    if (pos + size > data.length) break;

    const block = data.subarray(pos, pos + size);

    switch (type) {
      case 1: {
        // 8-bit PCM — 1-byte time constant + 1-byte codec + samples
        const tc   = block[0];
        const codec = block[1];
        if (codec === 0) {
          // Uncompressed 8-bit unsigned PCM, mono
          sampleRate = Math.round(1000000 / (256 - tc));
          chunks.push(block.subarray(2));
        }
        // codec 1 = 4-bit ADPCM, etc. — skip (rare in Duke3D)
        break;
      }
      case 2: {
        // Sound continuation — same settings, raw samples only
        chunks.push(block);
        break;
      }
      case 8: {
        // Extended info block — always precedes a type-1 block
        const extTC = block.readUInt16LE(0);
        bits        = block[2] === 0 ? 8 : block[2];
        channels    = block[3] + 1;
        sampleRate  = Math.round(256000000 / (channels * (65536 - extTC)));
        break;
      }
      case 9: {
        // New sound data (VOC v1.20+)
        if (block.length < 12) break;
        sampleRate  = block.readUInt32LE(0);
        bits        = block[4];
        channels    = block[5];
        const codec = block.readUInt16LE(6);
        if (codec === 0 && bits === 8) {
          chunks.push(block.subarray(12));
        }
        break;
      }
      // type 3 = silence, 4 = marker, 5 = text, 6/7 = repeat — skip all
    }
    pos += size;
  }

  if (chunks.length === 0) return null;

  // Merge all PCM chunks
  const totalSamples = chunks.reduce((n, c) => n + c.length, 0);
  if (totalSamples === 0) return null;

  // Convert 8-bit unsigned → 16-bit signed (centre at 0, full scale)
  const pcm16 = Buffer.alloc(totalSamples * 2);
  let out = 0;
  for (const chunk of chunks) {
    for (let i = 0; i < chunk.length; i++) {
      // Shift: 128 unsigned → 0 signed; multiply × 256 for full 16-bit range
      const s = Math.max(-32768, Math.min(32767, (chunk[i] - 128) * 256));
      pcm16.writeInt16LE(s, out); out += 2;
    }
  }

  // Build canonical WAV (RIFF/PCM)
  const numChan    = Math.max(1, channels);
  const byteRate   = sampleRate * numChan * 2;  // 16-bit
  const blockAlign = numChan * 2;
  const dataSize   = pcm16.length;
  const wavBuf     = Buffer.alloc(44 + dataSize);
  let p = 0;

  const w4  = (s)  => { wavBuf.write(s, p, 'ascii');        p += 4; };
  const u32 = (v)  => { wavBuf.writeUInt32LE(v, p);          p += 4; };
  const u16 = (v)  => { wavBuf.writeUInt16LE(v, p);          p += 2; };

  w4('RIFF'); u32(36 + dataSize); w4('WAVE');  // RIFF header
  w4('fmt '); u32(16);                          // fmt chunk
  u16(1);       // PCM
  u16(numChan);
  u32(sampleRate);
  u32(byteRate);
  u16(blockAlign);
  u16(16);      // bits per sample
  w4('data'); u32(dataSize);
  pcm16.copy(wavBuf, p);

  const duration = totalSamples / sampleRate;
  return { wav: wavBuf, sampleRate, samples: totalSamples, duration };
}

// ══════════════════════════════════════════════════════════════
// ART FILE PARSER  (BUILD engine tile art format)
//
// Format:
//   Offset  0: int32 version (must be 1)
//   Offset  4: int32 numtilesinfil
//   Offset  8: int32 localtilestart
//   Offset 12: int32 localtileend
//   Offset 16: int16 tilesizx[numtilesinfil]
//          +2n: int16 tilesizy[numtilesinfil]
//          +4n: int32 picanm[numtilesinfil]   (animation data, ignored here)
//   Followed by pixel data: each tile is W×H bytes, column-major
//   (tile[x][y] = data[x * H + y], x = 0..W-1, y = 0..H-1)
// ══════════════════════════════════════════════════════════════
function parseART(artData) {
  if (artData.length < 16) return [];

  const version  = artData.readInt32LE(0);
  if (version !== 1) return [];  // not a valid ART file

  const numTiles = artData.readInt32LE(4);
  const tileStart = artData.readInt32LE(8);
  const tileEnd   = artData.readInt32LE(12);

  if (numTiles <= 0 || numTiles > 8192) return [];
  if (tileEnd < tileStart || (tileEnd - tileStart + 1) !== numTiles) return [];

  const headerBytes = 16 + numTiles * 2 + numTiles * 2 + numTiles * 4;
  if (headerBytes > artData.length) return [];

  // Read size arrays
  const sizX = [], sizY = [];
  let p = 16;
  for (let i = 0; i < numTiles; i++) { sizX.push(artData.readUInt16LE(p)); p += 2; }
  for (let i = 0; i < numTiles; i++) { sizY.push(artData.readUInt16LE(p)); p += 2; }
  p += numTiles * 4; // skip picanm

  const tiles = [];
  for (let i = 0; i < numTiles; i++) {
    const w = sizX[i], h = sizY[i];
    const tileNum = tileStart + i;

    if (w === 0 || h === 0) { tiles.push(null); continue; }
    if (p + w * h > artData.length) { tiles.push(null); break; }

    tiles.push({ tileNum, w, h, pixels: Buffer.from(artData.subarray(p, p + w * h)) });
    p += w * h;
  }

  return tiles;
}

// BUILD engine column-major layout → RGBA row-major (for normal image libs)
function tileToRGBA(tile, palette) {
  const rgba = new Uint8Array(tile.w * tile.h * 4);
  for (let x = 0; x < tile.w; x++) {
    for (let y = 0; y < tile.h; y++) {
      const src = x * tile.h + y;       // column-major source
      const dst = (y * tile.w + x) * 4; // row-major destination
      const pi  = tile.pixels[src] * 4;
      rgba[dst]   = palette[pi];
      rgba[dst+1] = palette[pi+1];
      rgba[dst+2] = palette[pi+2];
      rgba[dst+3] = palette[pi+3];      // 0 if palette index 255 (transparent)
    }
  }
  return Buffer.from(rgba.buffer);
}

// Check if a tile's dimensions match the expected range
function matchesExpectedSize(tile, expectedSize) {
  if (!expectedSize) return true;
  const { minW, maxW, minH, maxH } = expectedSize;
  return tile.w >= minW && tile.w <= maxW && tile.h >= minH && tile.h <= maxH;
}

// ══════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════
async function main() {
  // ── Directory setup ──────────────────────────────────────
  const audioDir    = path.join(OUT_DIR, 'audio');
  const spritesDir  = path.join(OUT_DIR, 'sprites');
  const allTilesDir = path.join(OUT_DIR, 'sprites', 'all-tiles');
  const rawDir      = path.join(OUT_DIR, 'raw');

  for (const d of [audioDir, spritesDir, allTilesDir, rawDir]) {
    fs.mkdirSync(d, { recursive: true });
  }

  // ── Parse GRP ────────────────────────────────────────────
  const entries = parseGRP(GRP_PATH);
  fs.writeFileSync(
    path.join(OUT_DIR, 'manifest.txt'),
    entries.map(e => `${e.name.padEnd(16)} ${String(e.size).padStart(9)} bytes  (.${e.ext})`).join('\n')
  );
  console.log(`    Written manifest.txt (${entries.length} entries)`);

  // ── Load palette ─────────────────────────────────────────
  const palette = loadPalette(entries);

  const report = { audio: {}, sprites: {}, warnings: [] };

  // ════════════════════════════════════════════════════════
  // SOUND EXTRACTION — VOC → 16-bit WAV
  // ════════════════════════════════════════════════════════
  const vocFiles = entries.filter(e => e.ext === 'VOC');
  console.log(`\n🔊  Sounds: ${vocFiles.length} VOC files found`);

  const semCounts = {}; // semantic name → count (for numbered filenames)

  for (const entry of vocFiles) {
    // Save raw VOC (useful for debugging / other tools)
    fs.writeFileSync(path.join(rawDir, entry.name), entry.data);

    const result = vocToWav(entry.data);

    // Garbage filters
    if (!result) {
      report.warnings.push(`VOC parse failed: ${entry.name}`);
      continue;
    }
    if (result.duration < 0.015 || result.duration > 45) {
      report.warnings.push(`Suspicious duration (${result.duration.toFixed(2)}s): ${entry.name}`);
      continue;
    }

    // Always save by original name
    const baseName = entry.name.replace(/\.VOC$/i, '.wav');
    fs.writeFileSync(path.join(audioDir, baseName), result.wav);

    // Semantic mapping
    let semantic = null;
    for (const { out, re } of SOUND_MAP) {
      if (re.test(entry.name)) { semantic = out; break; }
    }
    if (semantic) {
      semCounts[semantic] = (semCounts[semantic] || 0) + 1;
      const n   = semCounts[semantic];
      const tag = `${semantic}-${String(n).padStart(2, '0')}.wav`;
      fs.writeFileSync(path.join(audioDir, tag), result.wav);
      report.audio[entry.name] = {
        semantic: tag,
        duration: result.duration.toFixed(2) + 's',
        rate: result.sampleRate + ' Hz',
      };
    }

    process.stdout.write('.');
  }
  console.log(' done');

  // ════════════════════════════════════════════════════════
  // SPRITE EXTRACTION — ART → PNG
  // ════════════════════════════════════════════════════════
  const artFiles = entries.filter(e => e.ext === 'ART').sort((a, b) => a.name.localeCompare(b.name));
  console.log(`\n🎨  Sprites: ${artFiles.length} ART files found`);

  // Build global tile map
  const tileMap = new Map();
  for (const art of artFiles) {
    for (const tile of parseART(art.data)) {
      if (tile) tileMap.set(tile.tileNum, tile);
    }
  }
  console.log(`    Parsed ${tileMap.size} total tiles`);

  // ── Extract target sprites ──────────────────────────────
  let targetHits = 0;
  for (const [name, spec] of Object.entries(TILE_TARGETS)) {
    const { tile: tgt, expectedSize, desc } = spec;

    // Search: exact, then ±20 range filtered by expected dimensions
    let found = null;
    for (let delta = 0; delta <= 20 && !found; delta++) {
      for (const candidate of [tileMap.get(tgt + delta), tileMap.get(tgt - delta)]) {
        if (candidate && matchesExpectedSize(candidate, expectedSize)) {
          found = candidate; break;
        }
      }
    }

    if (!found) {
      // Fallback: scan entire tile map for tiles matching expected size
      if (expectedSize) {
        for (const [, tile] of tileMap) {
          if (matchesExpectedSize(tile, expectedSize)) { found = tile; break; }
        }
      }
      if (!found) {
        report.warnings.push(`Tile not found: ${name} (target=${tgt}) — ${desc}`);
        continue;
      }
    }

    const rgba = tileToRGBA(found, palette);
    const outPath = path.join(spritesDir, `${name}.png`);
    await sharp(rgba, { raw: { width: found.w, height: found.h, channels: 4 } })
      .png()
      .toFile(outPath);

    report.sprites[name] = { tile: found.tileNum, w: found.w, h: found.h, desc };
    targetHits++;
    process.stdout.write('.');
  }
  console.log(` done (${targetHits}/${Object.keys(TILE_TARGETS).length} targets hit)`);

  // ── Export all HUD-scale tiles for visual discovery ─────
  // (4–256px in each dimension — avoids wall textures and tiny noise)
  console.log('    Exporting all HUD-scale tiles for discovery...');
  let discovered = 0;
  for (const [, tile] of tileMap) {
    if (tile.w < 4 || tile.h < 4 || tile.w > 256 || tile.h > 256) continue;
    const rgba    = tileToRGBA(tile, palette);
    const outPath = path.join(allTilesDir, `tile-${String(tile.tileNum).padStart(5, '0')}.png`);
    try {
      await sharp(rgba, { raw: { width: tile.w, height: tile.h, channels: 4 } })
        .png()
        .toFile(outPath);
      discovered++;
    } catch { /* skip malformed tile */ }
  }
  console.log(`    ${discovered} tiles saved to sprites/all-tiles/`);

  // ════════════════════════════════════════════════════════
  // HTML DISCOVERY INDEX
  // ════════════════════════════════════════════════════════
  const audioPngs = fs.readdirSync(allTilesDir).filter(f => f.endsWith('.png')).sort();

  const html = /* html */`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Duke3D Asset Index — Brew Lab</title>
<style>
  body { background:#050811; color:#00d4ff; font-family:'Courier New',monospace; padding:20px; }
  h1   { color:#ff3da8; letter-spacing:.1em; }
  h2   { color:#ffcc00; border-bottom:1px solid #2a3a4e; padding-bottom:6px; margin-top:32px; }
  .tiles { display:flex; flex-wrap:wrap; gap:6px; }
  .tile  { text-align:center; background:#0a1320; padding:4px; border:1px solid #2a3a4e; }
  .tile img { image-rendering:pixelated; display:block; max-width:128px; max-height:128px; }
  .tile span { font-size:9px; color:#5a7090; }
  table { border-collapse:collapse; width:100%; }
  th,td { text-align:left; padding:4px 10px; border-bottom:1px solid #2a3a4e; font-size:12px; }
  th { color:#ff3da8; }
  .sem { color:#ffcc00; }
  .warn { color:#ff2244; }
</style>
</head>
<body>
<h1>◆ DUKE3D ASSET INDEX — BREW LAB</h1>
<p style="color:#5a7090">Extracted from: ${path.basename(GRP_PATH)} &nbsp;|&nbsp; ${entries.length} lumps</p>

<h2>◆ TARGET SPRITES</h2>
<div class="tiles">
${Object.entries(report.sprites).map(([name, info]) => `
  <div class="tile">
    <img src="sprites/${name}.png" title="${name} — tile ${info.tile}">
    <span>TILE ${info.tile}<br>${name}<br>${info.w}×${info.h}</span>
  </div>`).join('')}
</div>

<h2>◆ ALL HUD-SCALE TILES (4–256px) — identify and add to TILE_TARGETS</h2>
<div class="tiles">
${audioPngs.map(f => {
    const n = parseInt(f.replace('tile-', '').replace('.png', ''));
    return `<div class="tile"><img src="sprites/all-tiles/${f}" title="tile ${n}"><span>${n}</span></div>`;
  }).join('')}
</div>

<h2>◆ SEMANTICALLY MAPPED AUDIO</h2>
<table>
<tr><th>Source VOC</th><th>Semantic filename</th><th>Duration</th><th>Sample rate</th></tr>
${Object.entries(report.audio).map(([src, v]) =>
    `<tr><td>${src}</td><td class="sem">${v.semantic}</td><td>${v.duration}</td><td>${v.rate}</td></tr>`
  ).join('')}
</table>

<h2>◆ WARNINGS (${report.warnings.length})</h2>
${report.warnings.map(w => `<div class="warn">⚠ ${w}</div>`).join('')}

</body></html>`;

  fs.writeFileSync(path.join(OUT_DIR, 'index.html'), html);

  // ════════════════════════════════════════════════════════
  // BREW LAB INTEGRATION SNIPPET
  // Drop into the SoundEngine section to use real Duke3D audio
  // ════════════════════════════════════════════════════════
  const integration = `// ═══════════════════════════════════════════════════════════
// Brew Lab — Duke3D real-audio integration
// Generated by extract-duke.js
// Drop the _dukeAudio block into your SoundEngine IIFE,
// then swap the synth calls for _playDuke() calls.
// ═══════════════════════════════════════════════════════════

// ── Asset loader (add inside SoundEngine IIFE, after _init) ──
const _dukeCache = {};

async function _loadDuke(filename) {
  if (_dukeCache[filename]) return _dukeCache[filename];
  const resp = await fetch(\`assets/duke3d/audio/\${filename}\`);
  if (!resp.ok) throw new Error(\`duke audio 404: \${filename}\`);
  const arr = await resp.arrayBuffer();
  return (_dukeCache[filename] = await ctx.decodeAudioData(arr));
}

function _playDuke(filename, gainVal = 0.5) {
  if (!_enabled || !ctx) return;
  _loadDuke(filename).then(buf => {
    const src = ctx.createBufferSource(), g = ctx.createGain();
    src.buffer = buf; g.gain.value = gainVal;
    src.connect(g); g.connect(master); src.start();
    src.onended = () => { try { src.disconnect(); g.disconnect(); } catch(e){} };
  }).catch(e => console.warn('Duke audio failed:', filename, e));
}

// ── SEMANTIC MAPPINGS ─────────────────────────────────────────
// Replace synthesised SoundEngine methods with real Duke3D audio.
// Filenames match the semantic names extracted to assets/duke3d/audio/
// Update these after running the extractor and reviewing index.html.

// SoundEngine.tap()   → _playDuke('ui-click-01.wav',   0.4)
// SoundEngine.engage()→ _playDuke('engage-shrinker-01.wav', 0.6)
//                      + _playDuke('engage-rpg-01.wav',      0.4)  // layer both
// SoundEngine.targetAcquired() → _playDuke('target-lock-01.wav', 0.5)
// SoundEngine.denied()         → _playDuke('explosion-small-01.wav', 0.5)
// SoundEngine.dukeHail()       → _playDuke('duke-hail-01.wav', 0.7)
//                                + synthetic sub thump (keep _sub call for bass)

// ── Hybrid example (real voice + synth bass on dukeHail) ──────
/*
dukeHail() {
  if (!_enabled || !ctx) return;
  _sub({ freq: 60, dur: 0.5, gain: 0.4, now: ctx.currentTime });  // keep synth sub
  _at(80, () => _playDuke('duke-hail-01.wav', 0.7));              // real voice
},
*/

// ── Sprite paths (use in renderDuke() CSS or <img> tags) ──────
// 'assets/duke3d/sprites/duke-hud-neutral.png'
// 'assets/duke3d/sprites/duke-hud-smile.png'
// 'assets/duke3d/sprites/duke-hud-hurt.png'
// 'assets/duke3d/sprites/duke-hud-critical.png'
// 'assets/duke3d/sprites/duke-logo-top.png'
// 'assets/duke3d/sprites/duke-logo-bottom.png'
`;

  fs.writeFileSync(path.join(OUT_DIR, 'brew-lab-integration.js'), integration);

  // ════════════════════════════════════════════════════════
  // SUMMARY
  // ════════════════════════════════════════════════════════
  const totalAudio = Object.keys(report.audio).length;
  console.log(`
${'═'.repeat(55)}
✅  EXTRACTION COMPLETE
${'═'.repeat(55)}
📁  Output:   ${OUT_DIR}

🔊  Audio
    ${vocFiles.length} VOC files converted to 16-bit WAV
    ${totalAudio} files semantically mapped to:
${Object.entries(semCounts).map(([k, n]) => `      ${n}×  ${k}`).join('\n')}

🎨  Sprites
    ${tileMap.size} total tiles parsed from ${artFiles.length} ART files
    ${targetHits}/${Object.keys(TILE_TARGETS).length} named targets extracted
    ${discovered} HUD-scale tiles in sprites/all-tiles/ for discovery

⚠   Warnings: ${report.warnings.length}
${report.warnings.map(w => `    • ${w}`).join('\n')}

📋  Open index.html in a browser to browse all assets visually
🔌  See brew-lab-integration.js to wire real audio into SoundEngine
${'═'.repeat(55)}`);
}

main().catch(err => {
  console.error('\n❌  Fatal error:', err.message);
  if (process.env.DEBUG) console.error(err.stack);
  process.exit(1);
});
