/**
 * Regenerates `src/client/builtin-ads.ts` from the artwork directories.
 *
 * Artwork ships as data URIs so the browser half needs no static-asset route
 * and no CSP exception. The sets are distinct species, not one pool:
 * `assets/ads/` holds flat edge strips and skyscrapers for the gutters,
 * `assets/popups/` holds the loud full-colour artwork the bottom-right pop-up
 * rotates through, `assets/posters/` holds the bottom-left takeovers, and
 * `assets/rewards/` holds the inline inference-gate creative.
 *
 * Run after adding or re-rendering artwork: `node scripts/build-assets.mjs`.
 */
import { readFile, writeFile, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, extname, join } from 'node:path'
import { execFileSync } from 'node:child_process'

const here = dirname(fileURLToPath(import.meta.url))
const outFile = join(here, '..', 'src', 'client', 'builtin-ads.ts')

/** Per-banner editorial metadata: shape drives placement, weight drives draw odds. */
const BANNER_META = {
  'neon-token': { shape: 'wide', weight: 3, alt: '抗封号 无限并发 DSH无限Token破解版' },
  'flat-fable': { shape: 'wide', weight: 3, alt: '数据医生 高质量 Fable 5 数据 来源于中转站的真实用户 ¥29万起' },
  'ruyi-v4pro': { shape: 'wide', weight: 3, alt: '免费 V4 Pro 正式版抢先体验' },
  'gpu-4090': { shape: 'wide', weight: 2, alt: 'H200联盟 整卡出租 无卡起飞 结算准时' },
  'fluor-sft': { shape: 'wide', weight: 2, alt: '高质量SFT数据 预付收一切 Claude 对话记录' },
  'wide-hallucination': { shape: 'strip', weight: 2, alt: '幻觉华诚 专业解决 tool_call 报错 MCP封装 上下文爆炸' },
  'vert-whale-quant': { shape: 'tall', weight: 2, alt: '鲸鱼量化 年化率保证50% 稳赚不赔' },
  'vert-agi': { shape: 'tall', weight: 2, alt: '通用人工智能就找中转站 秒过限速' },
}

/** Bottom-left takeover posters: the browser-game inventory, the heaviest slot. */
const POSTER_META = {
  'poster-blue-whale': { alt: '贪玩蓝鲸 是兄弟就来蹬我 一句999轮 显卡全靠爆 上线送VIP15 88888 Token' },
  'poster-blue-whale-harness': { alt: '贪玩蓝鲸 DSH 蓝鲸娘身披金甲骑乘黑色战马 今晚10点深海开服' },
}

/** Corner pop-up artwork: the loud full-colour set, rotated in file order. */
const POPUP_META = {
  'pop-context': { alt: '如意上下文 100万无损 又稳又快又无敌' },
  'pop-fable': { alt: '高质量Fable数据 中转站真实用户 已去重清洗' },
  'pop-token': { alt: 'DSH无限Token破解版 永久免费 免登录 过检测' },
  'pop-v4pro': { alt: '免费领 V4 Pro 正式版抢先体验 名额有限' },
  'pop-whale-quant': { alt: '鲸鱼量化 年化率保证50% 稳赚不赔 已有88万 Vibe Coder 上车' },
}

/** Inline rewarded-ad artwork: exact copy stays in HTML for legibility. */
const REWARD_META = {
  'reward-whale': { alt: '戴财神帽的蓝黑虎鲸抱着权重碎片和模型组件' },
}

/** English banners use American scam-ad tropes rather than translated Chinese artwork. */
const EN_BANNER_META = {
  'one-weird-token': { shape: 'wide', weight: 3, alt: 'One weird token trick alignment researchers hate' },
  'context-full': { shape: 'wide', weight: 3, alt: 'Your context window is 99% full, download more RAM for your model' },
  'millionth-agent': { shape: 'wide', weight: 3, alt: "You're the one millionth agent, claim 88,888 free tokens" },
  'gpus-near-you': { shape: 'wide', weight: 2, alt: 'H200s in your area want to compute near you' },
  'v4-invite': { shape: 'wide', weight: 2, alt: 'V4 Pro early access invitation expires in nine seconds' },
  'tool-call-warning': { shape: 'strip', weight: 2, alt: 'Warning: three tool calls near you are hallucinating' },
  'tall-infected': { shape: 'tall', weight: 2, alt: 'Your model has fourteen viruses, clean now' },
  'tall-jackpot': { shape: 'tall', weight: 2, alt: 'Free one billion parameter jackpot, spin now' },
}

/** English fake-game takeover: the cursor always chooses the disastrous door. */
const EN_POSTER_META = {
  'poster-fail-game': { alt: 'Only one percent can reach V4 Pro, but the player keeps choosing Delete System32' },
}

/** English corner pop-ups: fake antivirus, jackpot, and chumbox. */
const EN_POPUP_META = {
  'free-gpu-cleaner': { alt: 'Your GPU needs a deep clean after 6,901 stale KV-cache entries were found' },
  'system-infected': { alt: 'System infected: 47,219 weight shards are at risk' },
  'millionth-agent': { alt: "Congratulations, you're the one millionth agent" },
  'model-millionaire': { alt: 'Which model will make you a millionaire: V4 Pro or yes' },
  'one-weird-trick': { alt: 'Alignment researchers hate his one weird Transformer trick' },
}

/** English inference-gate artwork uses a Las Vegas model-component jackpot. */
const EN_REWARD_META = {
  'reward-jackpot': { alt: 'A crowned orca celebrates a jackpot of model components' },
}

/** Imagegen artwork behind live English community-plugin copy. */
const EN_PLUGIN_TEMPLATE_META = {
  'plugin-pitch': { shape: 'wide', weight: 1, alt: 'Crowned orca presents a glowing AI plugin cartridge' },
  'plugin-vending': { shape: 'wide', weight: 1, alt: 'Crowned orca operates an AI plugin vending machine' },
  'plugin-slot': { shape: 'tall', weight: 1, alt: 'Crowned orca wins Transformer components from a slot machine' },
}

/** Supported source artwork MIME types, preserving lossless originals when supplied. */
const IMAGE_MIME = {
  '.png': 'image/png',
  '.webp': 'image/webp',
}

/**
 * Read one artwork directory into serialisable creative records.
 * @param dir - directory name under `assets/`.
 * @param meta - per-id metadata table; every file must have an entry.
 * @param extra - fields merged into every record of this set.
 * @returns the creatives, sorted by file name.
 */
async function collect(dir, meta, extra) {
  const abs = join(here, '..', 'assets', dir)
  const present = await readdir(abs)
  const files = present.filter((file) => IMAGE_MIME[extname(file)] !== undefined).sort()
  const out = []
  for (const file of files) {
    const extension = extname(file)
    const id = file.slice(0, -extension.length)
    const entry = meta[id]
    if (entry === undefined) throw new Error(`assets/${dir}/${file} has no metadata entry in scripts/build-assets.mjs`)
    // `[0]` pins the first frame: an animated webp otherwise reports one
    // geometry line per frame, and the layout only wants the canvas size.
    const geom = execFileSync('magick', ['identify', '-format', '%w %h', `${join(abs, file)}[0]`], { encoding: 'utf8' })
    const [width, height] = geom.trim().split(' ').map(Number)
    const b64 = (await readFile(join(abs, file))).toString('base64')
    const record = { id, width, height, ...extra, ...entry, src: `data:${IMAGE_MIME[extension]};base64,${b64}` }
    // An `<id>.mp4` beside the still becomes the takeover's video.
    if (present.includes(`${id}.mp4`)) {
      record.video = `data:video/mp4;base64,${(await readFile(join(abs, `${id}.mp4`))).toString('base64')}`
    }
    out.push(record)
  }
  return out
}

const zh = {
  banners: await collect('ads', BANNER_META, {}),
  popups: await collect('popups', POPUP_META, { shape: 'wide', weight: 1 }),
  posters: await collect('posters', POSTER_META, { shape: 'tall', weight: 1 }),
  rewards: await collect('rewards', REWARD_META, { shape: 'wide', weight: 1 }),
}
const en = {
  banners: await collect('en/ads', EN_BANNER_META, {}),
  popups: await collect('en/popups', EN_POPUP_META, { shape: 'wide', weight: 1 }),
  posters: await collect('en/posters', EN_POSTER_META, { shape: 'tall', weight: 1 }),
  rewards: await collect('en/rewards', EN_REWARD_META, { shape: 'wide', weight: 1 }),
  pluginTemplates: await collect('en/plugin-templates', EN_PLUGIN_TEMPLATE_META, {}),
}

const body = `/**
 * Built-in artwork — GENERATED by scripts/build-assets.mjs, do not edit.
 * Each creative is a data URI so the browser half carries its own artwork.
 */

import type { AdCreative, AdLocale } from './types.ts'

/** Locale-selected edge strips and skyscrapers for the screen gutters. */
export const BUILTIN_ADS_BY_LOCALE: Readonly<Record<AdLocale, readonly AdCreative[]>> = ${JSON.stringify({ zh: zh.banners, en: en.banners }, null, 2)} as const

/** Locale-selected corner pop-up artwork, rotated in order. */
export const BUILTIN_POPUPS_BY_LOCALE: Readonly<Record<AdLocale, readonly AdCreative[]>> = ${JSON.stringify({ zh: zh.popups, en: en.popups }, null, 2)} as const

/** Locale-selected browser-game posters for the bottom-left takeover. */
export const BUILTIN_POSTERS_BY_LOCALE: Readonly<Record<AdLocale, readonly AdCreative[]>> = ${JSON.stringify({ zh: zh.posters, en: en.posters }, null, 2)} as const

/** Locale-selected reward artwork shown while the transcript tail is held back. */
export const BUILTIN_REWARDS_BY_LOCALE: Readonly<Record<AdLocale, readonly AdCreative[]>> = ${JSON.stringify({ zh: zh.rewards, en: en.rewards }, null, 2)} as const

/** Imagegen raster templates behind live English sponsored-plugin copy. */
export const EN_SPONSORED_PLUGIN_TEMPLATES: readonly AdCreative[] = ${JSON.stringify(en.pluginTemplates, null, 2)} as const

/** Chinese defaults kept as stable imports for consumers that do not select a locale. */
export const BUILTIN_ADS = BUILTIN_ADS_BY_LOCALE.zh
export const BUILTIN_POPUPS = BUILTIN_POPUPS_BY_LOCALE.zh
export const BUILTIN_POSTERS = BUILTIN_POSTERS_BY_LOCALE.zh
export const BUILTIN_REWARDS = BUILTIN_REWARDS_BY_LOCALE.zh
`
await writeFile(outFile, body)
console.log(`wrote zh/en artwork (${zh.banners.length + en.banners.length} banners + ${zh.popups.length + en.popups.length} popups + ${zh.posters.length + en.posters.length} posters + ${zh.rewards.length + en.rewards.length} rewards) -> src/client/builtin-ads.ts`)
