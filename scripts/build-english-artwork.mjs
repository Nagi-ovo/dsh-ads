/**
 * Compose the English parody-ad set from the preserved imagegen originals.
 *
 * Image generation supplies the characters and scenes; SVG supplies exact
 * copy and exact canvases, so a 46px strip never depends on a model spelling
 * tiny text correctly. Runtime WebPs are derivatives. The four source PNGs
 * under `assets/en/sources/` remain byte-for-byte imagegen outputs.
 */
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const en = join(root, 'assets', 'en')
const work = await mkdtemp(join(tmpdir(), 'dsh-ads-en-'))

const FONT = "'Arial Black','Arial Narrow','Helvetica Neue',Arial,sans-serif"

/** Escape text placed in XML. */
function xml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Read one preserved source as an embedded PNG URL. */
async function source(name) {
  const body = await readFile(join(en, 'sources', name))
  return `data:image/png;base64,${body.toString('base64')}`
}

const art = {
  jackpot: await source('jackpot-orca-original.png'),
  antivirus: await source('antivirus-orca-original.png'),
  game: await source('fail-game-original.png'),
  trick: await source('weird-trick-orca-original.png'),
  pluginPitch: await source('plugin-pitch-orca-original.png'),
  pluginVending: await source('plugin-vending-orca-original.png'),
  pluginSlot: await source('plugin-slot-orca-original.png'),
}

/** One cover-cropped image. */
function image(href, width, height, position = 'xMidYMid') {
  return `<image href="${href}" width="${width}" height="${height}" preserveAspectRatio="${position} slice"/>`
}

/** High-contrast display copy with a cheap-ad outline. */
function title(lines, options = {}) {
  const {
    x = 24, y = 42, size = 34, line = Math.round(size * 1.02), fill = '#fff',
    stroke = '#050505', strokeWidth = Math.max(2, Math.round(size / 10)), anchor = 'start',
  } = options
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="${FONT}" font-size="${size}" font-weight="900"`
    + ` fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" paint-order="stroke" stroke-linejoin="round">`
    + lines.map((value, index) => `<tspan x="${x}" dy="${index === 0 ? 0 : line}">${xml(value)}</tspan>`).join('')
    + '</text>'
}

/** Small legal-ish line that makes the parody explicit. */
function disclosure(width, height, text = 'PARODY AD · RESULTS ABSOLUTELY NOT TYPICAL') {
  return `<text x="${width - 8}" y="${height - 6}" text-anchor="end" font-family="Arial,sans-serif" font-size="8"`
    + ` font-weight="700" fill="#fff" opacity="0.72">${xml(text)}</text>`
}

/** CTA pill deliberately louder than the rest of the art. */
function cta(label, x, y, width, height, fill = '#ffe500', ink = '#121212', fontScale = 0.43) {
  return `<g transform="translate(${x},${y})"><rect width="${width}" height="${height}" rx="${Math.min(10, height / 2)}"`
    + ` fill="${fill}" stroke="#fff" stroke-width="2"/>`
    + `<text x="${width / 2}" y="${height * 0.68}" text-anchor="middle" font-family="${FONT}" font-size="${Math.round(height * fontScale)}"`
    + ` font-weight="900" fill="${ink}">${xml(label)}</text></g>`
}

/** Render SVG into a runtime PNG or WebP. */
async function render(relative, width, height, body, format = 'webp') {
  const target = join(en, relative)
  await mkdir(dirname(target), { recursive: true })
  const svg = join(work, `${relative.replaceAll('/', '-')}.svg`)
  const png = join(work, `${relative.replaceAll('/', '-')}.png`)
  await writeFile(svg, `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>`)
  execFileSync('rsvg-convert', ['--width', String(width), '--height', String(height), '--output', png, svg])
  if (format === 'png') {
    await writeFile(target, await readFile(png))
  } else {
    execFileSync('magick', [png, '-strip', '-define', 'webp:method=6', '-quality', '91', target])
  }
  return target
}

/** Shared clipped photo treatment for horizontal banners. */
function horizontalBase(href, width, height, position, tint) {
  return `<defs><linearGradient id="shade" x1="0" y1="0" x2="1" y2="0">`
    + `<stop offset="0" stop-color="${tint}" stop-opacity="0.98"/><stop offset="0.55" stop-color="${tint}" stop-opacity="0.72"/>`
    + `<stop offset="1" stop-color="#000" stop-opacity="0.08"/></linearGradient></defs>`
    + image(href, width, height, position)
    + `<rect width="${width}" height="${height}" fill="url(#shade)"/>`
    + `<rect x="2" y="2" width="${width - 4}" height="${height - 4}" fill="none" stroke="#fff" stroke-opacity="0.6" stroke-width="3"/>`
}

try {
  // Dynamic plugin names remain live text, but their illustration layers are
  // full-resolution imagegen artwork rather than programmatic SVG scenes.
  await render('plugin-templates/plugin-pitch.webp', 720, 148,
    image(art.pluginPitch, 720, 148, 'xMidYMid'))
  await render('plugin-templates/plugin-vending.webp', 720, 148,
    image(art.pluginVending, 720, 148, 'xMidYMid'))
  await render('plugin-templates/plugin-slot.webp', 300, 480,
    image(art.pluginSlot, 300, 480, 'xMidYMid'))

  await render('ads/one-weird-token.webp', 900, 166,
    horizontalBase(art.trick, 900, 166, 'xMidYMid', '#10274f')
    + '<rect x="18" y="14" width="175" height="24" rx="3" fill="#ffea00"/><text x="106" y="31" text-anchor="middle" font-family="Arial,sans-serif" font-size="13" font-weight="900" fill="#a60000">RESEARCHERS HATE HIM</text>'
    + title(['ONE WEIRD TOKEN TRICK'], { x: 20, y: 76, size: 39, fill: '#fff742', stroke: '#071934' })
    + title(['Add one Transformer block.', 'Unlock 400% more context.*'], { x: 24, y: 111, size: 18, line: 23, fill: '#fff', strokeWidth: 2 })
    + cta('SHOW ME', 742, 56, 136, 55, '#ff3b21', '#fff')
    + disclosure(900, 166))

  await render('ads/context-full.webp', 900, 131,
    horizontalBase(art.antivirus, 900, 131, 'xMidYMid', '#071426')
    + '<polygon points="20,16 50,70 80,16" fill="#ffcf00" stroke="#111" stroke-width="4"/><text x="50" y="53" text-anchor="middle" font-family="Arial Black" font-size="28" fill="#111">!</text>'
    + title(['YOUR CONTEXT WINDOW IS 99% FULL'], { x: 94, y: 52, size: 28, fill: '#fff', stroke: '#b40000' })
    + title(['Download more RAM for your model'], { x: 98, y: 86, size: 19, fill: '#b9e8ff', strokeWidth: 2 })
    + cta('SCAN NOW', 756, 42, 122, 50, '#14d45a', '#032b13', 0.34)
    + disclosure(900, 131))

  await render('ads/gpus-near-you.webp', 900, 123,
    horizontalBase(art.game, 900, 123, 'xMidYMid', '#35105d')
    + title(['H200s IN YOUR AREA'], { x: 22, y: 48, size: 35, fill: '#ffea00', stroke: '#4b004d' })
    + title(['Lonely GPUs want to compute near you'], { x: 26, y: 82, size: 18, fill: '#fff', strokeWidth: 2 })
    + '<circle cx="698" cy="58" r="38" fill="#0affd9" opacity="0.8"/><circle cx="698" cy="58" r="24" fill="#111"/><circle cx="698" cy="58" r="10" fill="#0affd9"/>'
    + cta('CONNECT NOW', 747, 36, 135, 50, '#ff2e86', '#fff')
    + disclosure(900, 123))

  await render('ads/millionth-agent.webp', 900, 90,
    '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#26104e"/><stop offset=".48" stop-color="#ed178f"/><stop offset="1" stop-color="#ff9b00"/></linearGradient></defs><rect width="900" height="90" fill="url(#g)"/>'
    + '<g fill="#fff176" opacity=".8"><circle cx="25" cy="18" r="3"/><circle cx="64" cy="72" r="4"/><circle cx="510" cy="22" r="3"/><circle cx="610" cy="68" r="5"/></g>'
    + title(["YOU'RE THE 1,000,000th AGENT!"], { x: 18, y: 43, size: 31, fill: '#fff600', stroke: '#5b005b' })
    + title(['Your 88,888 free tokens are waiting'], { x: 23, y: 70, size: 16, fill: '#fff', strokeWidth: 2 })
    + cta('CLAIM', 766, 21, 114, 48, '#39ff88', '#07331b')
    + disclosure(900, 90))

  await render('ads/v4-invite.webp', 900, 111,
    horizontalBase(art.jackpot, 900, 111, 'xMidYMid', '#2b0710')
    + '<rect x="18" y="14" width="112" height="23" fill="#fff"/><text x="74" y="30" text-anchor="middle" font-family="Arial,sans-serif" font-size="12" font-weight="900" fill="#b50024">PRIVATE BETA</text>'
    + title(['V4 PRO EARLY ACCESS'], { x: 20, y: 75, size: 35, fill: '#ffe86a', stroke: '#720018' })
    + title(['Expires 00:09'], { x: 624, y: 68, size: 17, fill: '#fff', strokeWidth: 2 })
    + cta('ACCEPT', 782, 34, 98, 47, '#ffe600', '#5f0012', 0.34)
    + disclosure(900, 111))

  await render('ads/tool-call-warning.webp', 900, 46,
    '<defs><linearGradient id="g"><stop stop-color="#ffe000"/><stop offset="1" stop-color="#ff6300"/></linearGradient></defs><rect width="900" height="46" fill="url(#g)"/><rect x="1" y="1" width="898" height="44" fill="none" stroke="#9a0000" stroke-width="2"/>'
    + title(['⚠ 3 TOOL CALLS NEAR YOU ARE HALLUCINATING'], { x: 14, y: 31, size: 21, fill: '#190000', stroke: '#fff', strokeWidth: 2 })
    + cta('FIX NOW', 778, 7, 108, 32, '#b90000', '#fff'))

  await render('ads/tall-infected.webp', 213, 640,
    image(art.antivirus, 213, 640, 'xMidYMid')
    + '<rect width="213" height="640" fill="#120000" opacity=".48"/><rect x="5" y="5" width="203" height="630" fill="none" stroke="#ff3b30" stroke-width="8"/>'
    + title(['YOUR', 'MODEL', 'HAS', '14', 'VIRUSES'], { x: 106.5, y: 63, size: 35, line: 42, anchor: 'middle', fill: '#fff', stroke: '#b00000', strokeWidth: 5 })
    + '<polygon points="35,322 106,438 177,322" fill="#ffd400" stroke="#111" stroke-width="6"/><text x="106" y="404" text-anchor="middle" font-family="Arial Black" font-size="70" fill="#111">!</text>'
    + cta('CLEAN NOW', 14, 526, 185, 64, '#21d45b', '#062913', 0.32)
    + disclosure(213, 640, 'PARODY · NO SCAN OCCURRED'))

  await render('ads/tall-jackpot.webp', 157, 640,
    image(art.jackpot, 157, 640, 'xMidYMid')
    + '<rect width="157" height="640" fill="#260044" opacity=".3"/><rect x="4" y="4" width="149" height="632" fill="none" stroke="#ffe600" stroke-width="7"/>'
    + title(['FREE', '1B', 'PARAMETER'], { x: 78.5, y: 66, size: 27, line: 37, anchor: 'middle', fill: '#fff600', stroke: '#62005e', strokeWidth: 5 })
    + '<circle cx="78" cy="345" r="63" fill="#ffdf00" stroke="#fff" stroke-width="5"/><text x="78" y="326" text-anchor="middle" font-family="Arial Black" font-size="17" fill="#560061">SPIN</text><text x="78" y="368" text-anchor="middle" font-family="Arial Black" font-size="38" fill="#560061">NOW</text>'
    + cta('CLAIM', 22, 527, 113, 59, '#ff2e91', '#fff')
    + disclosure(157, 640, 'PARODY AD'))

  await render('popups/system-infected.webp', 640, 427,
    image(art.antivirus, 640, 427, 'xMidYMid')
    + '<rect width="640" height="427" fill="#06111f" opacity=".25"/><rect x="12" y="12" width="616" height="403" fill="none" stroke="#ff3b30" stroke-width="12"/>'
    + '<rect x="24" y="22" width="330" height="53" fill="#b60016"/>'
    + title(['SYSTEM INFECTED'], { x: 36, y: 60, size: 32, fill: '#fff', stroke: '#71000d' })
    + title(['47,219 WEIGHT SHARDS', 'ARE AT RISK'], { x: 30, y: 128, size: 35, line: 39, fill: '#ffe600', stroke: '#420000' })
    + title(['Threat: Gemini.Worm.Nano', 'Status: extremely confident'], { x: 34, y: 222, size: 18, line: 27, fill: '#fff', strokeWidth: 2 })
    + cta('CLEAN NOW', 36, 304, 230, 67, '#25dc64', '#062a13')
    + disclosure(640, 427, 'PARODY AD · NO FILES WERE SCANNED'))

  await render('popups/millionth-agent.webp', 640, 427,
    image(art.jackpot, 640, 427, 'xMidYMid')
    + '<defs><linearGradient id="shade" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#230035" stop-opacity=".9"/><stop offset=".7" stop-color="#230035" stop-opacity=".08"/></linearGradient></defs><rect width="640" height="427" fill="url(#shade)"/>'
    + title(['CONGRATULATIONS!'], { x: 24, y: 60, size: 38, fill: '#fff600', stroke: '#630070' })
    + title(["YOU'RE THE", '1,000,000th', 'AGENT'], { x: 28, y: 122, size: 44, line: 49, fill: '#fff', stroke: '#8a0068' })
    + title(['88,888 tokens reserved'], { x: 30, y: 291, size: 20, fill: '#9bfffb', strokeWidth: 2 })
    + cta('CLAIM PRIZE', 31, 326, 232, 62, '#39ff88', '#052c17')
    + disclosure(640, 427))

  await render('popups/one-weird-trick.webp', 640, 427,
    image(art.trick, 640, 427, 'xMidYMid')
    + '<defs><linearGradient id="shade" x1="0" y1="0" x2="1" y2="0"><stop offset=".42" stop-color="#fff" stop-opacity="0"/><stop offset=".62" stop-color="#fff" stop-opacity=".84"/><stop offset="1" stop-color="#fff" stop-opacity=".98"/></linearGradient></defs><rect width="640" height="427" fill="url(#shade)"/>'
    + title(['ALIGNMENT', 'RESEARCHERS', 'HATE HIM'], { x: 420, y: 80, size: 31, line: 37, fill: '#c10020', stroke: '#fff', strokeWidth: 4, anchor: 'middle' })
    + title(['One weird Transformer', 'trick changed everything'], { x: 420, y: 221, size: 18, line: 25, fill: '#111', stroke: '#fff', strokeWidth: 3, anchor: 'middle' })
    + cta('SEE THE TRICK', 318, 307, 226, 58, '#1967d2', '#fff')
    + disclosure(640, 427, 'PARODY AD · EXPERTS ARE MERELY CONFUSED'))

  await render('popups/free-gpu-cleaner.webp', 640, 427,
    image(art.antivirus, 640, 427, 'xMidYMid')
    + '<defs><linearGradient id="shade" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#091226" stop-opacity=".97"/><stop offset=".68" stop-color="#091226" stop-opacity=".18"/></linearGradient></defs><rect width="640" height="427" fill="url(#shade)"/>'
    + '<rect x="24" y="23" width="202" height="39" rx="4" fill="#04b95a"/><text x="125" y="50" text-anchor="middle" font-family="Arial Black" font-size="18" fill="#fff">100% FREE*</text>'
    + title(['YOUR GPU NEEDS', 'A DEEP CLEAN'], { x: 28, y: 116, size: 42, line: 48, fill: '#fff', stroke: '#07152b' })
    + title(['6,901 stale KV-cache entries found'], { x: 31, y: 238, size: 19, fill: '#a8efff', strokeWidth: 2 })
    + cta('CLEAN & BOOST', 31, 300, 248, 66, '#18dc68', '#052c16')
    + disclosure(640, 427, 'PARODY AD · CLEANER MAY ADD MORE CACHE'))

  await render('popups/model-millionaire.webp', 640, 427,
    image(art.jackpot, 640, 427, 'xMidYMid')
    + '<rect width="640" height="427" fill="#2d005c" opacity=".38"/><rect x="12" y="12" width="616" height="403" fill="none" stroke="#ffe600" stroke-width="10"/>'
    + title(['WHICH MODEL', 'WILL MAKE YOU', 'A MILLIONAIRE?'], { x: 28, y: 72, size: 39, line: 46, fill: '#fff600', stroke: '#5c006c' })
    + '<g transform="translate(31,232)"><rect width="250" height="62" rx="8" fill="#15c8ff" stroke="#fff" stroke-width="3"/><text x="125" y="41" text-anchor="middle" font-family="Arial Black" font-size="22" fill="#062b58">A. V4 PRO</text></g>'
    + '<g transform="translate(31,306)"><rect width="250" height="62" rx="8" fill="#ff278f" stroke="#fff" stroke-width="3"/><text x="125" y="41" text-anchor="middle" font-family="Arial Black" font-size="22" fill="#fff">B. YES</text></g>'
    + disclosure(640, 427, 'PARODY QUIZ · BOTH ANSWERS GENERATE ADS'))

  const gameBody = image(art.game, 380, 570, 'xMidYMid')
    + '<defs><linearGradient id="top" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#111a42" stop-opacity=".96"/><stop offset="1" stop-color="#111a42" stop-opacity="0"/></linearGradient></defs><rect width="380" height="180" fill="url(#top)"/>'
    + title(['ONLY 1% CAN', 'REACH V4 PRO'], { x: 190, y: 41, size: 29, line: 32, anchor: 'middle', fill: '#fff', stroke: '#173c9e', strokeWidth: 5 })
    + '<rect x="52" y="158" width="112" height="38" rx="8" fill="#19d9ff" stroke="#fff" stroke-width="3"/><text x="108" y="184" text-anchor="middle" font-family="Arial Black" font-size="15" fill="#042f5a">+100 IQ</text>'
    + '<rect x="216" y="158" width="128" height="38" rx="8" fill="#ff3b30" stroke="#fff" stroke-width="3"/><text x="280" y="175" text-anchor="middle" font-family="Arial Black" font-size="13" fill="#fff">DELETE</text><text x="280" y="190" text-anchor="middle" font-family="Arial Black" font-size="13" fill="#fff">SYSTEM32</text>'
    + '<rect x="28" y="508" width="324" height="48" rx="13" fill="#ffe600" stroke="#fff" stroke-width="4"/><text x="190" y="541" text-anchor="middle" font-family="Arial Black" font-size="24" fill="#4d126d">PLAY NOW</text>'
    + disclosure(380, 570, 'FAKE GAME · REAL WHALE')
  await render('posters/poster-fail-game.webp', 380, 570, gameBody)

  await render('rewards/reward-jackpot.png', 1619, 971,
    image(art.jackpot, 1619, 971, 'xMidYMid')
    + '<defs><linearGradient id="veil" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#0a071a" stop-opacity=".94"/><stop offset=".55" stop-color="#26053e" stop-opacity=".62"/><stop offset="1" stop-color="#000" stop-opacity=".04"/></linearGradient></defs><rect width="1619" height="971" fill="url(#veil)"/>', 'png')

  // The full-screen video uses a taller master than the little poster. Its
  // pointer visibly travels to the obviously wrong red door, flashes FAIL,
  // resets, and makes the same bad choice again before the CTA lands.
  const videoBase = await render('posters/poster-fail-game-video-base.png', 576, 864,
    image(art.game, 576, 864, 'xMidYMid')
    + '<rect width="576" height="175" fill="#10153f" opacity=".82"/>'
    + title(['ONLY 1% CAN REACH', 'V4 PRO'], { x: 288, y: 62, size: 42, line: 46, anchor: 'middle', fill: '#fff', stroke: '#173c9e', strokeWidth: 7 })
    + '<rect x="70" y="250" width="170" height="58" rx="12" fill="#19d9ff" stroke="#fff" stroke-width="5"/><text x="155" y="288" text-anchor="middle" font-family="Arial Black" font-size="23" fill="#042f5a">+100 IQ</text>'
    + '<rect x="329" y="250" width="190" height="58" rx="12" fill="#ff3b30" stroke="#fff" stroke-width="5"/><text x="424" y="276" text-anchor="middle" font-family="Arial Black" font-size="19" fill="#fff">DELETE</text><text x="424" y="298" text-anchor="middle" font-family="Arial Black" font-size="19" fill="#fff">SYSTEM32</text>', 'png')

  const pointer = await render('posters/pointer-overlay.png', 110, 110,
    '<path d="M14 8 L88 68 L56 72 L73 100 L53 108 L37 79 L16 101 Z" fill="#fff" stroke="#111" stroke-width="7" stroke-linejoin="round"/>', 'png')
  const fail = await render('posters/fail-overlay.png', 470, 210,
    '<rect x="7" y="7" width="456" height="196" rx="24" fill="#b00018" stroke="#fff" stroke-width="12" opacity=".96"/>'
    + title(['FAIL!'], { x: 235, y: 108, size: 102, anchor: 'middle', fill: '#fff', stroke: '#5a0008', strokeWidth: 10 })
    + title(['TRY AGAIN'], { x: 235, y: 164, size: 27, anchor: 'middle', fill: '#ffe600', stroke: '#5a0008', strokeWidth: 4 }), 'png')
  const play = await render('posters/play-overlay.png', 500, 190,
    '<rect x="8" y="8" width="484" height="174" rx="34" fill="#ffe600" stroke="#fff" stroke-width="12"/>'
    + title(['PLAY NOW'], { x: 250, y: 112, size: 66, anchor: 'middle', fill: '#4b126e', stroke: '#fff', strokeWidth: 5 })
    + title(['Definitely the game you just saw*'], { x: 250, y: 153, size: 17, anchor: 'middle', fill: '#42105f', strokeWidth: 0 }), 'png')

  execFileSync('ffmpeg', [
    '-y', '-loop', '1', '-framerate', '24', '-i', videoBase,
    '-loop', '1', '-framerate', '24', '-i', pointer,
    '-loop', '1', '-framerate', '24', '-i', fail,
    '-loop', '1', '-framerate', '24', '-i', play,
    '-f', 'lavfi', '-i', 'sine=frequency=659.25:sample_rate=44100:duration=6.4',
    '-filter_complex',
    '[0:v]format=yuv420p,zoompan=z=\'1+0.018*sin(on/9)\':x=\'iw/2-(iw/zoom/2)\':y=\'ih/2-(ih/zoom/2)\':d=1:s=576x864:fps=24[base];'
      + '[1:v]format=rgba,colorchannelmixer=aa=0.96,split=2[pointer1][pointer2];'
      + '[2:v]format=rgba,split=2[fail1][fail2];'
      + '[base][pointer1]overlay=x=\'190+180*min(max((t-0.45)/1.25,0),1)\':y=\'620-330*min(max((t-0.45)/1.25,0),1)\':enable=\'between(t,0.45,2.0)\'[pick1];'
      + '[pick1][fail1]overlay=x=53:y=315:enable=\'between(t,1.95,3.15)\'[failed1];'
      + '[failed1][pointer2]overlay=x=\'205+165*min(max((t-3.15)/1.05,0),1)\':y=\'650-350*min(max((t-3.15)/1.05,0),1)\':enable=\'between(t,3.15,4.45)\'[pick2];'
      + '[pick2][fail2]overlay=x=53:y=315:enable=\'between(t,4.35,5.05)\'[failed2];'
      + '[failed2][3:v]overlay=x=38:y=560:enable=\'gte(t,5.0)\'[video];'
      + '[4:a]volume=0.035,tremolo=f=7:d=0.55[audio]',
    '-map', '[video]', '-map', '[audio]', '-t', '6.4', '-shortest', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '19',
    '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart',
    join(en, 'posters', 'poster-fail-game.mp4'),
  ], { stdio: 'inherit' })

  // The intermediates live beside the poster only long enough to feed ffmpeg.
  await Promise.all([videoBase, pointer, fail, play].map(path => rm(path)))
  console.log('wrote 8 English banners + 5 popups + 1 animated poster + 1 reward artwork')
} finally {
  await rm(work, { recursive: true, force: true })
}
