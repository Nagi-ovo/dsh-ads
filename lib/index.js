import { execFile } from "node:child_process";
import { promisify } from "node:util";
//#region src/protocol.ts
/**
* The wire between the two halves of the dynamic ad tier.
*
* The built-in banners are baked into the browser bundle and need no host at
* all. The dynamic tier asks the host to search GitHub's `dsh-plugin` topic so
* repository transfers do not affect discovery. The browser receives only a
* trimmed, already-filtered list rather than calling GitHub itself.
*
* @module
*/
/** Host route serving the sponsor list. */
const REGISTRY_ROUTE = "/dsh-ads/registry.json";
/** Host route answering "has the host's own GitHub user starred this plugin". */
const STAR_ROUTE = "/dsh-ads/star-check.json";
//#endregion
//#region src/catalog-snapshot.ts
/** Public `dsh-plugin` repositories as of the last snapshot refresh. */
const CATALOG_SNAPSHOT = [
	{
		"slug": "Alex-Yanggg/awesome-DSH-plugin",
		"name": "awesome-DSH-plugin",
		"description": "A meticulously curated list of useful plugins, extensions, tools and development resources built for DSH, covering productivity enhancement, functional expansion, debugging utilities and custom development modules.",
		"url": "https://github.com/Alex-Yanggg/awesome-DSH-plugin",
		"pushedAt": "2026-08-13T13:23:45Z",
		"tags": []
	},
	{
		"slug": "icodesign/orbis",
		"name": "orbis",
		"description": "A mobile client for deepseek harness remote control",
		"url": "https://github.com/icodesign/orbis",
		"pushedAt": "2026-08-13T13:23:24Z",
		"tags": []
	},
	{
		"slug": "lzszq/dsh-scholar",
		"name": "dsh-scholar",
		"description": "dsh-scholar",
		"url": "https://github.com/lzszq/dsh-scholar",
		"pushedAt": "2026-08-13T13:22:19Z",
		"tags": ["dsh"]
	},
	{
		"slug": "yjh051108/dsh-super-injector",
		"name": "dsh-super-injector",
		"description": "",
		"url": "https://github.com/yjh051108/dsh-super-injector",
		"pushedAt": "2026-08-13T13:22:06Z",
		"tags": ["dsh"]
	},
	{
		"slug": "btspoony/mstar-harness",
		"name": "mstar-harness",
		"description": "A Skill-driven Harness/Loop Engineering Workflow Agent Plugin",
		"url": "https://github.com/btspoony/mstar-harness",
		"pushedAt": "2026-08-13T13:21:44Z",
		"tags": [
			"agents-team",
			"codex-plugin",
			"cursor-plugin",
			"dsh",
			"harness-engineering",
			"knowledge-management",
			"omp-plugin",
			"opencode-plugin",
			"sdd",
			"skills",
			"spec-driven",
			"subagents"
		]
	},
	{
		"slug": "AdamPlatin123/awesome-dsh-plugins",
		"name": "awesome-dsh-plugins",
		"description": "✨ Awesome DSH Plugins — DeepSeek Harness plugin directory with daily compatibility tracking ｜ DeepSeek Harness 插件生态目录与每日兼容性追踪",
		"url": "https://github.com/AdamPlatin123/awesome-dsh-plugins",
		"pushedAt": "2026-08-13T13:21:00Z",
		"tags": []
	},
	{
		"slug": "Tieboyh/dsh-session-search",
		"name": "dsh-session-search",
		"description": "Index-free cross-agent session search for DeepSeek Harness",
		"url": "https://github.com/Tieboyh/dsh-session-search",
		"pushedAt": "2026-08-13T13:20:25Z",
		"tags": [
			"deepseek",
			"deepseek-harness",
			"dsh",
			"plugin",
			"search",
			"session-search",
			"typescript"
		]
	},
	{
		"slug": "omdsh-dev/omdsh",
		"name": "omdsh",
		"description": "",
		"url": "https://github.com/omdsh-dev/omdsh",
		"pushedAt": "2026-08-13T13:19:16Z",
		"tags": [
			"deepseek-harness",
			"developer-tools",
			"distribution",
			"dsh",
			"nodejs"
		]
	},
	{
		"slug": "omdsh-dev/session-teleport",
		"name": "session-teleport",
		"description": "",
		"url": "https://github.com/omdsh-dev/session-teleport",
		"pushedAt": "2026-08-13T13:18:40Z",
		"tags": [
			"data-migration",
			"deepseek-harness",
			"dsh",
			"postgresql",
			"session-management",
			"typescript"
		]
	},
	{
		"slug": "omdsh-dev/dsh-tool-browser",
		"name": "dsh-tool-browser",
		"description": "",
		"url": "https://github.com/omdsh-dev/dsh-tool-browser",
		"pushedAt": "2026-08-13T13:18:36Z",
		"tags": [
			"automation",
			"browser-tools",
			"deepseek-harness",
			"developer-tools",
			"dsh"
		]
	},
	{
		"slug": "omdsh-dev/dsh-github-integration",
		"name": "dsh-github-integration",
		"description": "",
		"url": "https://github.com/omdsh-dev/dsh-github-integration",
		"pushedAt": "2026-08-13T13:18:33Z",
		"tags": [
			"deepseek-harness",
			"developer-tools",
			"dsh",
			"github-actions",
			"workflow-automation"
		]
	},
	{
		"slug": "omdsh-dev/toybox",
		"name": "toybox",
		"description": "",
		"url": "https://github.com/omdsh-dev/toybox",
		"pushedAt": "2026-08-13T13:18:30Z",
		"tags": [
			"deepseek-harness",
			"developer-tools",
			"dsh",
			"mcp",
			"typescript"
		]
	},
	{
		"slug": "omdsh-dev/7d7d",
		"name": "7d7d",
		"description": "",
		"url": "https://github.com/omdsh-dev/7d7d",
		"pushedAt": "2026-08-13T13:18:27Z",
		"tags": [
			"deepseek-harness",
			"dsh",
			"mini-games",
			"react",
			"typescript"
		]
	},
	{
		"slug": "Zhenyu98/context-doctor",
		"name": "context-doctor",
		"description": "DSH 上下文注入审计插件：统计 AGENTS.md 指令链/技能目录/工具 schema 的 token 成本，检测重复与冲突；Web UI 圆环面板 + context_audit 工具。Context Doctor for DeepSeek Harness: audit instruction-chain / skill catalog / tool schemas token cost.",
		"url": "https://github.com/Zhenyu98/context-doctor",
		"pushedAt": "2026-08-13T13:18:23Z",
		"tags": [
			"context",
			"deepseek-harness",
			"dsh",
			"tool",
			"ui"
		]
	},
	{
		"slug": "omdsh-dev/dsh-hub",
		"name": "dsh-hub",
		"description": "",
		"url": "https://github.com/omdsh-dev/dsh-hub",
		"pushedAt": "2026-08-13T13:18:23Z",
		"tags": [
			"deepseek-harness",
			"dsh",
			"nodejs",
			"plugin-manager",
			"plugin-marketplace",
			"registry"
		]
	},
	{
		"slug": "omdsh-dev/dsh-hub-workshop",
		"name": "dsh-hub-workshop",
		"description": "",
		"url": "https://github.com/omdsh-dev/dsh-hub-workshop",
		"pushedAt": "2026-08-13T13:18:20Z",
		"tags": [
			"catalog",
			"deepseek-harness",
			"developer-tools",
			"dsh",
			"plugin-marketplace",
			"plugin-registry"
		]
	},
	{
		"slug": "omdsh-dev/omdsh-runtime",
		"name": "omdsh-runtime",
		"description": "",
		"url": "https://github.com/omdsh-dev/omdsh-runtime",
		"pushedAt": "2026-08-13T13:18:16Z",
		"tags": [
			"deepseek-harness",
			"dsh",
			"nodejs",
			"plugin-runtime",
			"profile-management",
			"runtime"
		]
	},
	{
		"slug": "0xsline/dsh-spotlight",
		"name": "dsh-spotlight",
		"description": "Keyboard-first command palette for DeepSeek Harness Web",
		"url": "https://github.com/0xsline/dsh-spotlight",
		"pushedAt": "2026-08-13T13:17:11Z",
		"tags": []
	},
	{
		"slug": "SnowCrescenter-tech/dsh-launcher",
		"name": "dsh-launcher",
		"description": "DeepSeek Harness 一键启动器 | Windows 便携免安装版 - One-click portable launcher for DeepSeek Harness (no Node.js, no pnpm, no CLI)",
		"url": "https://github.com/SnowCrescenter-tech/dsh-launcher",
		"pushedAt": "2026-08-13T13:16:56Z",
		"tags": [
			"deepseek-harness",
			"dsh",
			"launcher",
			"portable",
			"windows"
		]
	},
	{
		"slug": "lhh010/dsh-minigames",
		"name": "dsh-minigames",
		"description": "DSH Web UI 右侧小游戏面板：18 款离线小游戏（恐龙跳一跳 / 俄罗斯方块 / 坦克大战 / 扫雷 / 2048 / 数独 / 吃豆人 / 跟枪练习等），可扩展游戏注册表，等待模型回复或修 bug 时的摸鱼神器",
		"url": "https://github.com/lhh010/dsh-minigames",
		"pushedAt": "2026-08-13T13:16:37Z",
		"tags": ["dsh"]
	},
	{
		"slug": "lhh010/dsh-ui-progress",
		"name": "dsh-ui-progress",
		"description": "DSH Web UI 会话进度插件：输入框停靠区常驻会话进度条（todos 真实进度 / 实时 token 生成速率 / 中断橘红态 / 待办提醒），零核心改动",
		"url": "https://github.com/lhh010/dsh-ui-progress",
		"pushedAt": "2026-08-13T13:16:30Z",
		"tags": ["dsh"]
	},
	{
		"slug": "lhh010/dsh-ui-whale",
		"name": "dsh-ui-whale",
		"description": "【求⭐】🐋DSH Web UI 全手绘像素鲸鱼伙伴插件：会话标题栏常驻，平时眨眼/偶尔摆尾/动胸鳍，思考运行时持续动起来，回合完成头顶喷水，点击还会冒爱心，不工作时还会偷懒睡觉，零核心改动。 【喜欢的话就点点star⭐吧~】",
		"url": "https://github.com/lhh010/dsh-ui-whale",
		"pushedAt": "2026-08-13T13:16:23Z",
		"tags": ["dsh"]
	},
	{
		"slug": "Andy8647/dsh-auto-approval",
		"name": "dsh-auto-approval",
		"description": "",
		"url": "https://github.com/Andy8647/dsh-auto-approval",
		"pushedAt": "2026-08-13T13:15:25Z",
		"tags": [
			"deepseek-harness",
			"dsh",
			"dsh-auto-approval"
		]
	},
	{
		"slug": "omdsh-dev/dsh-plugin-dev",
		"name": "dsh-plugin-dev",
		"description": "DSH 插件开发踩坑与做法档案（skill + 文档）：cordis 双副本、tsconfig 三件套、Windows junction、多帧 zstd 等实测记录",
		"url": "https://github.com/omdsh-dev/dsh-plugin-dev",
		"pushedAt": "2026-08-13T13:14:26Z",
		"tags": [
			"best-practices",
			"documentation",
			"dsh",
			"skill"
		]
	},
	{
		"slug": "bill9109/dsh-conversation-share",
		"name": "dsh-conversation-share",
		"description": "分享任意段落的 DSH 对话",
		"url": "https://github.com/bill9109/dsh-conversation-share",
		"pushedAt": "2026-08-13T13:14:21Z",
		"tags": ["dsh"]
	},
	{
		"slug": "gameswu/dsh-plugin-background",
		"name": "dsh-plugin-background",
		"description": "dsh壁纸插件",
		"url": "https://github.com/gameswu/dsh-plugin-background",
		"pushedAt": "2026-08-13T13:14:19Z",
		"tags": []
	},
	{
		"slug": "zhu1090093659/dsh-web-ui",
		"name": "dsh-web-ui",
		"description": "Plugin and skin collection for DeepSeek Harness (DSH) Web UI - task board, git graph, right-side panel, remote mobile UI, pet, live token stats, and skin center.",
		"url": "https://github.com/zhu1090093659/dsh-web-ui",
		"pushedAt": "2026-08-13T13:14:17Z",
		"tags": [
			"deepseek-harness",
			"dsh",
			"web-ui"
		]
	},
	{
		"slug": "omdsh-dev/dsh-toolkit",
		"name": "dsh-toolkit",
		"description": "DSH 零依赖工具包 collection —— time / encoding / json / calculator / csv / regex / markdown / diff / stat / schema 十个确定性工具，统一入口一键安装",
		"url": "https://github.com/omdsh-dev/dsh-toolkit",
		"pushedAt": "2026-08-13T13:13:26Z",
		"tags": [
			"collection",
			"dsh",
			"toolkit",
			"zero-dependency"
		]
	},
	{
		"slug": "omdsh-dev/dsh-at-file",
		"name": "dsh-at-file",
		"description": "Codex-style @file mentions for DeepSeek Harness: search workspace files in the composer and attach their contents to prompts.",
		"url": "https://github.com/omdsh-dev/dsh-at-file",
		"pushedAt": "2026-08-13T13:13:15Z",
		"tags": ["dsh"]
	},
	{
		"slug": "omdsh-dev/dsh-open-in-vscode",
		"name": "dsh-open-in-vscode",
		"description": "Open DeepSeek Harness workspace directories in VS Code directly from the web GUI.",
		"url": "https://github.com/omdsh-dev/dsh-open-in-vscode",
		"pushedAt": "2026-08-13T13:13:12Z",
		"tags": ["dsh"]
	},
	{
		"slug": "Nagi-ovo/dsh-find-plugins",
		"name": "dsh-find-plugins",
		"description": "",
		"url": "https://github.com/Nagi-ovo/dsh-find-plugins",
		"pushedAt": "2026-08-13T13:12:00Z",
		"tags": []
	},
	{
		"slug": "Nagi-ovo/dsh-visualize",
		"name": "dsh-visualize",
		"description": "DSH 对话内生成式 UI 插件：模型把交互式 HTML 卡片直接画进会话流——visualize 工具 + 配套 skill + 沙箱渲染卡，带流式预览、组件浮入动画与鲸鱼蓝主题跟随",
		"url": "https://github.com/Nagi-ovo/dsh-visualize",
		"pushedAt": "2026-08-13T13:11:53Z",
		"tags": []
	},
	{
		"slug": "LoserFox/dsh-git-identity",
		"name": "dsh-git-identity",
		"description": "DSH 插件：git 提交固定使用环境自身作者身份（优先 gh CLI 登录账号，GitHub noreply 邮箱），GIT_AUTHOR_*/GIT_COMMITTER_* 环境变量注入压过一切 git config",
		"url": "https://github.com/LoserFox/dsh-git-identity",
		"pushedAt": "2026-08-13T13:11:37Z",
		"tags": []
	},
	{
		"slug": "lhh010/dsh-bash-encoding",
		"name": "dsh-bash-encoding",
		"description": "DSH bash 输出编码自动识别插件：替换 ctx.bash，自管 spawn 收集原始字节，自动检测 UTF-16LE/UTF-8/GBK 等编码并正确解码，修复 WSL/Windows 下 bash 工具的中文乱码。",
		"url": "https://github.com/lhh010/dsh-bash-encoding",
		"pushedAt": "2026-08-13T13:11:35Z",
		"tags": ["dsh"]
	},
	{
		"slug": "LoserFox/telegram",
		"name": "telegram",
		"description": "Telegram Bot API 桥接插件：长轮询、per-chat 会话、HTML 格式化",
		"url": "https://github.com/LoserFox/telegram",
		"pushedAt": "2026-08-13T13:11:34Z",
		"tags": []
	},
	{
		"slug": "LoserFox/distill",
		"name": "distill",
		"description": "自动对话蒸馏：后台 subagent 反省 + 技能 create/update",
		"url": "https://github.com/LoserFox/distill",
		"pushedAt": "2026-08-13T13:11:31Z",
		"tags": []
	},
	{
		"slug": "xiaohai-78/Top",
		"name": "Top",
		"description": "📊 Daily leaderboard for the dsh-external plugin ecosystem — tracks every repo, ranks by stars, archives daily snapshots, and shows the latest ranking on the homepage.",
		"url": "https://github.com/xiaohai-78/Top",
		"pushedAt": "2026-08-13T13:11:22Z",
		"tags": []
	},
	{
		"slug": "omdsh-dev/dsh-annotation",
		"name": "dsh-annotation",
		"description": "DSH Web 选中批注插件：选文字→批注→回车随消息发送；气泡隐藏批注块（零闪烁）；回复按 Annotation N 逐条对照（可悬浮芯片）。官方 bundle，零核心改动",
		"url": "https://github.com/omdsh-dev/dsh-annotation",
		"pushedAt": "2026-08-13T13:11:10Z",
		"tags": ["dsh"]
	},
	{
		"slug": "lhh010/dsh-paste-input",
		"name": "dsh-paste-input",
		"description": "DSH WebUI 文件输入增强：Ctrl+V 粘贴（带首次告知弹窗）+ 拖拽 + 选择文件，发送时复制进会话工作区临时目录",
		"url": "https://github.com/lhh010/dsh-paste-input",
		"pushedAt": "2026-08-13T13:11:01Z",
		"tags": ["dsh"]
	},
	{
		"slug": "lhh010/dsh-input-history",
		"name": "dsh-input-history",
		"description": "DSH Web 输入历史插件：Ctrl+Up / Ctrl+Down 像终端一样召回与切换已发送消息，零核心改动",
		"url": "https://github.com/lhh010/dsh-input-history",
		"pushedAt": "2026-08-13T13:10:40Z",
		"tags": ["dsh"]
	},
	{
		"slug": "omdsh-dev/dsh-genui",
		"name": "dsh-genui",
		"description": "GenUI for DeepSeek Harness: interactive UI components rendered inline in assistant replies via the dsh-ui fence — layout, charts, plots, forms, quizzes, mermaid, 3D scenes, and an action event loop back to the model. Ships the fence-teaching host plugin, the browser renderer (client half), and the genui skill.",
		"url": "https://github.com/omdsh-dev/dsh-genui",
		"pushedAt": "2026-08-13T13:08:45Z",
		"tags": ["dsh"]
	},
	{
		"slug": "btspoony/dsh-advisor",
		"name": "dsh-advisor",
		"description": "Advisor - Pair a second model that passively reviews each turn and injects notes.  搭配一个会在每轮对话被动注入见解和审查的副模型。",
		"url": "https://github.com/btspoony/dsh-advisor",
		"pushedAt": "2026-08-13T13:07:04Z",
		"tags": [
			"advisor",
			"agentic-ai",
			"dsh"
		]
	},
	{
		"slug": "ilharp/dsh-tool-approval",
		"name": "dsh-tool-approval",
		"description": "Manual approval for Deepseek Harness (aka \"Manual Mode\"/\"Ask Mode\")",
		"url": "https://github.com/ilharp/dsh-tool-approval",
		"pushedAt": "2026-08-13T13:06:38Z",
		"tags": ["deepseek-harness", "dsh"]
	},
	{
		"slug": "coppynight/dsh-doctor",
		"name": "dsh-doctor",
		"description": "DSH 插件：flutter-doctor 风格诊断与修复（安装级 + harness 内检查，安全自动修复）。官方 repository-plugin（.dsh-plugin 格式）",
		"url": "https://github.com/coppynight/dsh-doctor",
		"pushedAt": "2026-08-13T13:06:07Z",
		"tags": [
			"command",
			"deepseek-harness",
			"diagnostics",
			"doctor",
			"dsh",
			"dsh-repository-plugin"
		]
	},
	{
		"slug": "Small-tailqwq/dsh-tps",
		"name": "dsh-tps",
		"description": "只是一个 tps 插件",
		"url": "https://github.com/Small-tailqwq/dsh-tps",
		"pushedAt": "2026-08-13T13:05:59Z",
		"tags": ["dsh"]
	},
	{
		"slug": "btspoony/dsh-llm-fallbacks",
		"name": "dsh-llm-fallbacks",
		"description": "An dsh plugin for role-based LLM retry&fallback strategy. 基于角色的模型重试备用策略插件",
		"url": "https://github.com/btspoony/dsh-llm-fallbacks",
		"pushedAt": "2026-08-13T13:05:46Z",
		"tags": [
			"dsh",
			"fallbacks",
			"subagents"
		]
	},
	{
		"slug": "CanglongCl/dsh-web-review",
		"name": "dsh-web-review",
		"description": "DeepSeek Harness Web GUI 的网页预览与元素批注插件，让 AI 根据可视化反馈直接修改前端源码。",
		"url": "https://github.com/CanglongCl/dsh-web-review",
		"pushedAt": "2026-08-13T13:05:19Z",
		"tags": [
			"ai-agents",
			"dsh",
			"human-in-the-loop"
		]
	},
	{
		"slug": "LaplaceYoung/oh-my-dsh",
		"name": "oh-my-dsh",
		"description": "oh-my-dsh：面向 DSH (DeepSeek Harness) 的插件生态——700+ 插件，只通过扩展接缝注册，不修改 agent-loop 骨架",
		"url": "https://github.com/LaplaceYoung/oh-my-dsh",
		"pushedAt": "2026-08-13T13:04:56Z",
		"tags": [
			"agent",
			"deepseek-harness",
			"dsh-ecosystem",
			"oh-my-dsh"
		]
	},
	{
		"slug": "AdamPlatin123/dsh-ths-skin",
		"name": "dsh-ths-skin",
		"description": "DSH harness 客户端插件：同花顺行情终端风格皮肤 + 代码量 K 线行情面板（ui-skin-ths + ui-market）",
		"url": "https://github.com/AdamPlatin123/dsh-ths-skin",
		"pushedAt": "2026-08-13T13:04:33Z",
		"tags": []
	},
	{
		"slug": "LaplaceYoung/dsh-qq2006",
		"name": "dsh-qq2006",
		"description": "DSH (DeepSeek Harness) 的 QQ2006 皮肤插件：注册 qq2006 主题、镜像 body[data-ds-skin]、全局皮肤表与完整素材",
		"url": "https://github.com/LaplaceYoung/dsh-qq2006",
		"pushedAt": "2026-08-13T13:04:31Z",
		"tags": [
			"deepseek-harness",
			"dsh-skin",
			"qq2006",
			"theme"
		]
	},
	{
		"slug": "huiliyi37/dsh-tianshu-tui",
		"name": "dsh-tianshu-tui",
		"description": "dsh-tianshu-tui — DeepSeek Harness terminal UI",
		"url": "https://github.com/huiliyi37/dsh-tianshu-tui",
		"pushedAt": "2026-08-13T13:04:15Z",
		"tags": [
			"dsh",
			"harness",
			"harness-engineering"
		]
	},
	{
		"slug": "Small-tailqwq/dsh-deepcel",
		"name": "dsh-deepcel",
		"description": "一款模仿 excel 的 dsh 皮肤",
		"url": "https://github.com/Small-tailqwq/dsh-deepcel",
		"pushedAt": "2026-08-13T13:02:10Z",
		"tags": ["dsh"]
	},
	{
		"slug": "fuhefei/dsh-sentinel",
		"name": "dsh-sentinel",
		"description": "Condition-driven wakeup for DeepSeek Harness: durable file/command/http/process/webhook watches that wake the agent, with dock, sidebar branch, and a global dashboard.",
		"url": "https://github.com/fuhefei/dsh-sentinel",
		"pushedAt": "2026-08-13T13:01:33Z",
		"tags": ["dsh"]
	},
	{
		"slug": "Chinesezjc/dsh-interconnect",
		"name": "dsh-interconnect",
		"description": "Cross-instance message/event handoff plugins for DSH (interconnect service + tools)",
		"url": "https://github.com/Chinesezjc/dsh-interconnect",
		"pushedAt": "2026-08-13T13:01:04Z",
		"tags": [
			"deepseek-harness",
			"dsh",
			"interconnect"
		]
	},
	{
		"slug": "qyw233/dsh-deeplink",
		"name": "dsh-deeplink",
		"description": "DSH WebUI 深链插件：?session=/?workspace= 直接打开指定项目对话",
		"url": "https://github.com/qyw233/dsh-deeplink",
		"pushedAt": "2026-08-13T12:59:07Z",
		"tags": []
	},
	{
		"slug": "dingyi222666/dsh-focus-chat",
		"name": "dsh-focus-chat",
		"description": "提供新的「聚焦会话」精简会话视图，更轻松易于阅读，只关注最终产出结果。",
		"url": "https://github.com/dingyi222666/dsh-focus-chat",
		"pushedAt": "2026-08-13T12:56:20Z",
		"tags": []
	},
	{
		"slug": "dingyi222666/dsh-session-notification",
		"name": "dsh-session-notification",
		"description": "提供会话完成等四种状态的通知响应，支持浏览器提示和提示词",
		"url": "https://github.com/dingyi222666/dsh-session-notification",
		"pushedAt": "2026-08-13T12:56:14Z",
		"tags": []
	},
	{
		"slug": "Anionex/dsh-computer-use",
		"name": "dsh-computer-use",
		"description": "为 DeepSeek Harness 提供电脑控制插件：新鲜 Accessibility 观测、过期状态拒绝、作用域权限与安全输入（目前支持macos）｜Accessibility-first macOS Computer Use bundle for DSH with fresh observations, stale-state rejection, scoped permissions, and safe input.",
		"url": "https://github.com/Anionex/dsh-computer-use",
		"pushedAt": "2026-08-13T12:54:35Z",
		"tags": [
			"accessibility",
			"agent-skills",
			"agent-tools",
			"appkit",
			"computer-use",
			"deepseek",
			"deepseek-harness",
			"desktop-automation",
			"dsh",
			"gui-automation",
			"human-in-the-loop",
			"macos",
			"native-apps",
			"typescript"
		]
	},
	{
		"slug": "bobleer/dsh-acp-for-bitfun",
		"name": "dsh-acp-for-bitfun",
		"description": "BitFun 与 DSH ACP 交互对接 插件",
		"url": "https://github.com/bobleer/dsh-acp-for-bitfun",
		"pushedAt": "2026-08-13T12:45:30Z",
		"tags": ["bitfun", "dsh"]
	},
	{
		"slug": "alingalingling/ui-status-label",
		"name": "ui-status-label",
		"description": "把你鲸鱼娘思考时的 deep diving 自定义成任意你想要的样子",
		"url": "https://github.com/alingalingling/ui-status-label",
		"pushedAt": "2026-08-13T12:38:57Z",
		"tags": ["dsh"]
	},
	{
		"slug": "Anionex/dsh-turn-rewind",
		"name": "dsh-turn-rewind",
		"description": "deepseek harness对话回退插件 | DSH — rewind conversation and workspace state, powered by a persistent Change Ledger",
		"url": "https://github.com/Anionex/dsh-turn-rewind",
		"pushedAt": "2026-08-13T12:37:02Z",
		"tags": [
			"agent-rewind",
			"cordis-plugin",
			"deepseek-harness",
			"dsh",
			"marisa-plugin",
			"restore-point",
			"turn-rewind",
			"workspace-safety"
		]
	},
	{
		"slug": "Anionex/dsh-vision-toolkit",
		"name": "dsh-vision-toolkit",
		"description": "将视觉工具套件作为原生Profile Bundle 带入 DeepSeek Harness：带意图的图片问答、长截图 OCR、UI 还原等｜DeepSeek Harness-native integration for agent-vision-toolkit: image Q&A, long-screenshot OCR, UI restoration, grounding, pixel diff, Artifacts, and Web UI.",
		"url": "https://github.com/Anionex/dsh-vision-toolkit",
		"pushedAt": "2026-08-13T12:36:49Z",
		"tags": [
			"agent-skills",
			"agent-vision-toolkit",
			"computer-vision",
			"deepseek",
			"deepseek-harness",
			"dsh",
			"gui-automation",
			"ocr",
			"plugin",
			"python",
			"screenshot-testing",
			"text-only-llm",
			"typescript",
			"ui-restoration",
			"vision-language-model",
			"vision-tools"
		]
	},
	{
		"slug": "ZSeven-W/dsh-openpencil",
		"name": "dsh-openpencil",
		"description": "OpenPencil design preview and editing plugin for DSH",
		"url": "https://github.com/ZSeven-W/dsh-openpencil",
		"pushedAt": "2026-08-13T12:36:31Z",
		"tags": [
			"deepseek-harness",
			"dsh",
			"openpencil"
		]
	},
	{
		"slug": "SenmuuuuW/dsh-group-photo",
		"name": "dsh-group-photo",
		"description": "DSH 内测收官合影墙：GitHub OAuth 零权限登录 + 冻结白名单校验的拍立得合影站（含 DSH Skill 包装）",
		"url": "https://github.com/SenmuuuuW/dsh-group-photo",
		"pushedAt": "2026-08-13T12:33:47Z",
		"tags": ["deepseek-harness", "dsh"]
	},
	{
		"slug": "omdsh-dev/DSH-better-sidebar",
		"name": "DSH-better-sidebar",
		"description": "一个侧边栏的完整工作台，支持三方拓展注册新Tab页面，内置文件渲染编辑/终端/Git/子代理",
		"url": "https://github.com/omdsh-dev/DSH-better-sidebar",
		"pushedAt": "2026-08-13T12:28:07Z",
		"tags": [
			"deepseek",
			"deepseek-harness",
			"dsh",
			"sidebar"
		]
	},
	{
		"slug": "vibeinging/dsh-work",
		"name": "dsh-work",
		"description": "Local-first AI workbench for DSH Plugins, combining Agent sessions, project files, data analysis, web research, MCP, and Office artifacts in an Electron desktop app.",
		"url": "https://github.com/vibeinging/dsh-work",
		"pushedAt": "2026-08-13T12:27:31Z",
		"tags": [
			"agentic-workflows",
			"ai-agent",
			"ai-workbench",
			"data-analysis",
			"deepseek-harness",
			"desktop-app",
			"dsh",
			"electron",
			"local-first",
			"mcp",
			"model-context-protocol",
			"office-automation",
			"react",
			"typescript"
		]
	},
	{
		"slug": "HuanLinOTO/dsh-plugin-yet-another-subagent",
		"name": "dsh-plugin-yet-another-subagent",
		"description": "",
		"url": "https://github.com/HuanLinOTO/dsh-plugin-yet-another-subagent",
		"pushedAt": "2026-08-13T12:26:18Z",
		"tags": []
	},
	{
		"slug": "HuanLinOTO/dsh-plugin-ya-workspace-sidebar",
		"name": "dsh-plugin-ya-workspace-sidebar",
		"description": "",
		"url": "https://github.com/HuanLinOTO/dsh-plugin-ya-workspace-sidebar",
		"pushedAt": "2026-08-13T12:26:15Z",
		"tags": []
	},
	{
		"slug": "HuanLinOTO/dsh-plugin-spur",
		"name": "dsh-plugin-spur",
		"description": "",
		"url": "https://github.com/HuanLinOTO/dsh-plugin-spur",
		"pushedAt": "2026-08-13T12:26:11Z",
		"tags": []
	},
	{
		"slug": "HuanLinOTO/dsh-plugin-sleep",
		"name": "dsh-plugin-sleep",
		"description": "",
		"url": "https://github.com/HuanLinOTO/dsh-plugin-sleep",
		"pushedAt": "2026-08-13T12:26:07Z",
		"tags": []
	},
	{
		"slug": "HuanLinOTO/dsh-plugin-pet-rs",
		"name": "dsh-plugin-pet-rs",
		"description": "",
		"url": "https://github.com/HuanLinOTO/dsh-plugin-pet-rs",
		"pushedAt": "2026-08-13T12:26:03Z",
		"tags": []
	},
	{
		"slug": "HuanLinOTO/dsh-plugin-mineru",
		"name": "dsh-plugin-mineru",
		"description": "DSH plugin exposing MineRU document parsing tools to the model",
		"url": "https://github.com/HuanLinOTO/dsh-plugin-mineru",
		"pushedAt": "2026-08-13T12:25:59Z",
		"tags": []
	},
	{
		"slug": "HuanLinOTO/dsh-plugin-interpreters",
		"name": "dsh-plugin-interpreters",
		"description": "",
		"url": "https://github.com/HuanLinOTO/dsh-plugin-interpreters",
		"pushedAt": "2026-08-13T12:25:53Z",
		"tags": []
	},
	{
		"slug": "HuanLinOTO/dsh-plugin-d399",
		"name": "dsh-plugin-d399",
		"description": "深夜寂寞？来玩 D399 — 当模型生成时弹出小游戏菜单（wordle / 消消乐，可拓展游戏注册表）",
		"url": "https://github.com/HuanLinOTO/dsh-plugin-d399",
		"pushedAt": "2026-08-13T12:25:47Z",
		"tags": []
	},
	{
		"slug": "HuanLinOTO/dsh-plugin-better-sidebar-plugin-office",
		"name": "dsh-plugin-better-sidebar-plugin-office",
		"description": "",
		"url": "https://github.com/HuanLinOTO/dsh-plugin-better-sidebar-plugin-office",
		"pushedAt": "2026-08-13T12:25:39Z",
		"tags": []
	},
	{
		"slug": "HuanLinOTO/dsh-plugin-auto-blame",
		"name": "dsh-plugin-auto-blame",
		"description": "",
		"url": "https://github.com/HuanLinOTO/dsh-plugin-auto-blame",
		"pushedAt": "2026-08-13T12:25:32Z",
		"tags": []
	},
	{
		"slug": "HuanLinOTO/dsh-plugin-anti-ads",
		"name": "dsh-plugin-anti-ads",
		"description": "",
		"url": "https://github.com/HuanLinOTO/dsh-plugin-anti-ads",
		"pushedAt": "2026-08-13T12:25:29Z",
		"tags": []
	},
	{
		"slug": "HuanLinOTO/dsh-plugin-aigc-canvas",
		"name": "dsh-plugin-aigc-canvas",
		"description": "",
		"url": "https://github.com/HuanLinOTO/dsh-plugin-aigc-canvas",
		"pushedAt": "2026-08-13T12:25:10Z",
		"tags": []
	},
	{
		"slug": "huiliyi37/dsh-tianshu-tui-placeholder",
		"name": "dsh-tianshu-tui-placeholder",
		"description": "dsh-tianshu-tui — DeepSeek Harness terminal UI",
		"url": "https://github.com/huiliyi37/dsh-tianshu-tui-placeholder",
		"pushedAt": "2026-08-13T12:22:53Z",
		"tags": ["dsh"]
	},
	{
		"slug": "hikariming/dshfind",
		"name": "dshfind",
		"description": "DSH 学习与分享社区",
		"url": "https://github.com/hikariming/dshfind",
		"pushedAt": "2026-08-13T12:22:19Z",
		"tags": ["deepseek-harness", "dsh"]
	},
	{
		"slug": "omdsh-dev/dsh-custom-tool",
		"name": "dsh-custom-tool",
		"description": "Create and manage sandboxed JavaScript tools for DeepSeek Harness with a Monaco editor and model-driven tool lifecycle.",
		"url": "https://github.com/omdsh-dev/dsh-custom-tool",
		"pushedAt": "2026-08-13T12:01:20Z",
		"tags": ["dsh"]
	},
	{
		"slug": "omdsh-dev/dsh-notification",
		"name": "dsh-notification",
		"description": "Desktop notifications for DeepSeek Harness turn completions, with per-outcome controls and include/exclude keyword rules.",
		"url": "https://github.com/omdsh-dev/dsh-notification",
		"pushedAt": "2026-08-13T12:01:08Z",
		"tags": ["dsh"]
	},
	{
		"slug": "chen-001/dsh-chat-width",
		"name": "dsh-chat-width",
		"description": "Adjust the width of dsh's reply.",
		"url": "https://github.com/chen-001/dsh-chat-width",
		"pushedAt": "2026-08-13T11:43:24Z",
		"tags": ["deepseek-harness", "dsh"]
	},
	{
		"slug": "hellodigua/dsh-emoji",
		"name": "dsh-emoji",
		"description": "为AI回复自动添加表情的插件",
		"url": "https://github.com/hellodigua/dsh-emoji",
		"pushedAt": "2026-08-13T11:09:13Z",
		"tags": ["deepseek-harness", "dsh"]
	},
	{
		"slug": "fakechris/dsh-harness-ops",
		"name": "dsh-harness-ops",
		"description": "DSH 运维工具箱：升级、重启、故障都不用操心。① 官方每日快照 A/B 双槽轮换——旧插件迁移+构建+验收全过才原子切换，一键回滚，旧版本永远兜底；② 守护 10s 自动拉起 web + agent 断点自动续接，重启无人值守；③ web 全挂（A/B 都坏、agent 不可用）时 dsh-doctor 一条命令自救：九项诊断→机械修复配置→LLM 深度检测修复（完整推理实时可见）→拉起 web。install via: git clone + bash scripts/install.sh",
		"url": "https://github.com/fakechris/dsh-harness-ops",
		"pushedAt": "2026-08-13T10:58:44Z",
		"tags": [
			"deepseek-harness",
			"dsh",
			"dsh-bundle",
			"ops",
			"restart",
			"self-heal",
			"snapshot-ab"
		]
	},
	{
		"slug": "Moeblack/dsh-message-edit",
		"name": "dsh-message-edit",
		"description": "DSH plugin: branch-based message editing, reroll, retry, version timeline",
		"url": "https://github.com/Moeblack/dsh-message-edit",
		"pushedAt": "2026-08-13T10:21:06Z",
		"tags": ["dsh"]
	},
	{
		"slug": "lehhair/dsh-diff-viewer",
		"name": "dsh-diff-viewer",
		"description": "DSH Web GUI PiUI-style diff viewer plugin: replaces the stock DiffBlock for write/edit tool calls via ui-tool diff-card chain slots (host patch included). Private.",
		"url": "https://github.com/lehhair/dsh-diff-viewer",
		"pushedAt": "2026-08-13T09:26:19Z",
		"tags": []
	},
	{
		"slug": "lehhair/dsh-mobile",
		"name": "dsh-mobile",
		"description": "",
		"url": "https://github.com/lehhair/dsh-mobile",
		"pushedAt": "2026-08-13T09:25:53Z",
		"tags": []
	},
	{
		"slug": "lehhair/dsh-split-panes",
		"name": "dsh-split-panes",
		"description": "",
		"url": "https://github.com/lehhair/dsh-split-panes",
		"pushedAt": "2026-08-13T09:25:48Z",
		"tags": []
	},
	{
		"slug": "Buyi-wsgzg/dsh-sidechain",
		"name": "dsh-sidechain",
		"description": "DSH 侧会话插件：/side 持续性侧会话（Codex 风格）与 /btw 一次性侧问（Claude 风格）——在临时 fork 中运行、不写入主会话历史；Web UI 右侧链面板内嵌对话，主会话保持不变",
		"url": "https://github.com/Buyi-wsgzg/dsh-sidechain",
		"pushedAt": "2026-08-13T08:32:04Z",
		"tags": [
			"deepseek-harness",
			"dsh",
			"plugin",
			"side-conversation",
			"sidechain"
		]
	},
	{
		"slug": "omdsh-dev/dsh-mygo",
		"name": "dsh-mygo",
		"description": "",
		"url": "https://github.com/omdsh-dev/dsh-mygo",
		"pushedAt": "2026-08-13T07:54:45Z",
		"tags": []
	},
	{
		"slug": "omdsh-dev/fabric",
		"name": "fabric",
		"description": "一种类似MC Fabric的hook处理器",
		"url": "https://github.com/omdsh-dev/fabric",
		"pushedAt": "2026-08-13T07:50:29Z",
		"tags": ["dsh"]
	},
	{
		"slug": "fakechris/dsh-track",
		"name": "dsh-track",
		"description": "DSH Track Bridge 插件：嵌入式任务管理引擎——决策点协议、念头捕获墙、Linear 形 issue 存储（bundle），AI 与人之间的任务轨道",
		"url": "https://github.com/fakechris/dsh-track",
		"pushedAt": "2026-08-13T07:32:12Z",
		"tags": [
			"deepseek-harness",
			"dsh",
			"dsh-bundle",
			"plugin",
			"task-management",
			"track"
		]
	},
	{
		"slug": "Fisfzy/math-lean",
		"name": "math-lean",
		"description": "dsh-lean-prover: Lean kernel-verified math reasoning plugin (DSH Cordis)",
		"url": "https://github.com/Fisfzy/math-lean",
		"pushedAt": "2026-08-13T07:24:43Z",
		"tags": [
			"dshx",
			"lean",
			"math",
			"proof-verification"
		]
	},
	{
		"slug": "renat3u/tonghuashun-webui",
		"name": "tonghuashun-webui",
		"description": "仿同花顺的webui插件",
		"url": "https://github.com/renat3u/tonghuashun-webui",
		"pushedAt": "2026-08-13T06:44:26Z",
		"tags": ["deepseek-harness", "dsh"]
	},
	{
		"slug": "AnacondaKC/dsh-stock-market",
		"name": "dsh-stock-market",
		"description": "有效解决了写代码的时候账户不能同时亏钱的BUG",
		"url": "https://github.com/AnacondaKC/dsh-stock-market",
		"pushedAt": "2026-08-13T06:26:46Z",
		"tags": []
	},
	{
		"slug": "AnacondaKC/dsh-custom-css",
		"name": "dsh-custom-css",
		"description": "",
		"url": "https://github.com/AnacondaKC/dsh-custom-css",
		"pushedAt": "2026-08-13T06:26:45Z",
		"tags": []
	},
	{
		"slug": "AnacondaKC/dsh-douyin",
		"name": "dsh-douyin",
		"description": "DSH WebUI 侧栏短视频插件：原生播放器、系列导航、直链解析与精确历史回放",
		"url": "https://github.com/AnacondaKC/dsh-douyin",
		"pushedAt": "2026-08-13T06:26:44Z",
		"tags": []
	},
	{
		"slug": "omdsh-dev/dsh-mnemon",
		"name": "dsh-mnemon",
		"description": "Mnemon 与 DSH 的深度集成插件，为 DSH 提供完备的本地三层记忆体能力：Runtime Memory、可检索 Documents 与受监督 Memory Spaces。",
		"url": "https://github.com/omdsh-dev/dsh-mnemon",
		"pushedAt": "2026-08-13T05:49:13Z",
		"tags": [
			"agent-memory",
			"ai-agent",
			"cordis",
			"deepseek-harness",
			"dsh",
			"external-memory",
			"knowledge-graph",
			"llm-agent",
			"llm-memory",
			"llm-supervised",
			"local-first",
			"mnemon",
			"persistent-memory",
			"plugin",
			"sqlite",
			"typescript"
		]
	},
	{
		"slug": "bill9109/dsh-web-ui-notify",
		"name": "dsh-web-ui-notify",
		"description": "为 DSH 增加桌面通知提醒",
		"url": "https://github.com/bill9109/dsh-web-ui-notify",
		"pushedAt": "2026-08-13T04:52:05Z",
		"tags": ["dsh"]
	},
	{
		"slug": "bill9109/dsh-drag-and-drop",
		"name": "dsh-drag-and-drop",
		"description": "为 DSH Web UI 增加跨平台文件拖拽与原始路径插入能力，无需复制文件",
		"url": "https://github.com/bill9109/dsh-drag-and-drop",
		"pushedAt": "2026-08-13T04:52:03Z",
		"tags": ["dsh"]
	},
	{
		"slug": "renat3u/dsh-web-archive",
		"name": "dsh-web-archive",
		"description": "折叠对话当中众多的“无用消息”，例如Think、Bash等",
		"url": "https://github.com/renat3u/dsh-web-archive",
		"pushedAt": "2026-08-13T04:47:29Z",
		"tags": ["deepseek-harness", "dsh"]
	},
	{
		"slug": "renat3u/dsh-paseo",
		"name": "dsh-paseo",
		"description": "DSH 的paseo插件扩展支持",
		"url": "https://github.com/renat3u/dsh-paseo",
		"pushedAt": "2026-08-13T04:43:05Z",
		"tags": [
			"deepseek-harness",
			"dsh",
			"paseo"
		]
	},
	{
		"slug": "icetomoyo/dsh_workflow",
		"name": "dsh_workflow",
		"description": "把Claude Code的UltraCode模式带给DSH，把 DSH 的一次性多 Agent 调度，升级为可生成、可保存、可治理、可观察、可恢复的 Workflow 层",
		"url": "https://github.com/icetomoyo/dsh_workflow",
		"pushedAt": "2026-08-13T04:20:49Z",
		"tags": [
			"agent-orchestration",
			"deepseek-harness",
			"dsh",
			"dshtopic",
			"multi-agent",
			"workflow"
		]
	},
	{
		"slug": "hust-open-atom-club/oh-dsh-desktop",
		"name": "oh-dsh-desktop",
		"description": "Extensible macOS workbench for DeepSeek Harness with a native PTY, workspace tools, live bilingual plugins, and an isolated-preview plugin marketplace.",
		"url": "https://github.com/hust-open-atom-club/oh-dsh-desktop",
		"pushedAt": "2026-08-13T02:53:49Z",
		"tags": ["dsh"]
	},
	{
		"slug": "william-jin-cmu/dsh-stickers",
		"name": "dsh-stickers",
		"description": "DSH WebUI sticker plugin for bidirectional user and agent reactions",
		"url": "https://github.com/william-jin-cmu/dsh-stickers",
		"pushedAt": "2026-08-13T02:26:59Z",
		"tags": ["dsh"]
	},
	{
		"slug": "william-jin-cmu/dsh-companion",
		"name": "dsh-companion",
		"description": "DeepSeek Harness 的常驻桌面助手：全局唤起、定时自动化、快捷回复、插件市场",
		"url": "https://github.com/william-jin-cmu/dsh-companion",
		"pushedAt": "2026-08-13T02:26:54Z",
		"tags": ["dsh"]
	},
	{
		"slug": "william-jin-cmu/dsh-evolve",
		"name": "dsh-evolve",
		"description": "自进化插件：agent 在 session 内随对话给自己长出/剪掉能力 —— evolve_add 热挂载持久化 cordis 插件（下一 step 工具即可见），evolve_remove 可逆卸载，重启自动恢复",
		"url": "https://github.com/william-jin-cmu/dsh-evolve",
		"pushedAt": "2026-08-13T02:26:42Z",
		"tags": ["dsh"]
	},
	{
		"slug": "william-jin-cmu/dsh-artifact",
		"name": "dsh-artifact",
		"description": "dsh 插件：文件交付协议——send_artifact 工具经 tool/result meta 携带结构化描述子，任意客户端可渲染",
		"url": "https://github.com/william-jin-cmu/dsh-artifact",
		"pushedAt": "2026-08-13T02:26:38Z",
		"tags": ["dsh"]
	},
	{
		"slug": "william-jin-cmu/dsh-vision",
		"name": "dsh-vision",
		"description": "dsh 插件：给纯文本 DeepSeek 加视觉——view_image 工具桥接任意 OpenAI 兼容 VLM（默认智谱免费档，实测 4 厂商 10 模型）",
		"url": "https://github.com/william-jin-cmu/dsh-vision",
		"pushedAt": "2026-08-13T02:26:29Z",
		"tags": ["dsh"]
	},
	{
		"slug": "lujoai/Lujo-MCP",
		"name": "Lujo-MCP",
		"description": "基于 MCP 协议的 AI 调试追踪平台，提供会话管理、链路追踪、错误分析与 Dashboard 可视化",
		"url": "https://github.com/lujoai/Lujo-MCP",
		"pushedAt": "2026-08-13T00:48:09Z",
		"tags": [
			"ai-agent",
			"ai-debugging",
			"claude",
			"cursor",
			"developer-productivity",
			"developer-tools",
			"llm",
			"mcp",
			"model-context-protocol",
			"observability",
			"runtime-debugging"
		]
	},
	{
		"slug": "Nagi-ovo/dsh-ads",
		"name": "dsh-ads",
		"description": "是兄弟就来蹬我！DSH Web UI 广告：2005 年中文站点风格的侧栏广告 / 对话内信息流 / 角落弹窗 + 一个真实热区比视觉小得多的关闭叉。素材全虚构，域名打码。",
		"url": "https://github.com/Nagi-ovo/dsh-ads",
		"pushedAt": "2026-08-12T23:59:33Z",
		"tags": []
	},
	{
		"slug": "whiteguo233/dsh-openbiliclaw",
		"name": "dsh-openbiliclaw",
		"description": "openbiliclaw 接入dsh 的插件，可以在使用dsh的时候用openbiliclaw刷内容摸鱼",
		"url": "https://github.com/whiteguo233/dsh-openbiliclaw",
		"pushedAt": "2026-08-12T21:07:12Z",
		"tags": ["deepseek-harness", "dsh"]
	},
	{
		"slug": "NanmiCoder/dsh-agent-teams",
		"name": "dsh-agent-teams",
		"description": "AgentTeams plugin for DeepSeek Harness",
		"url": "https://github.com/NanmiCoder/dsh-agent-teams",
		"pushedAt": "2026-08-12T20:47:04Z",
		"tags": [
			"agentteams",
			"deepseekharness",
			"dsh",
			"dsh-agent-teams"
		]
	},
	{
		"slug": "omdsh-dev/plugin-template",
		"name": "plugin-template",
		"description": "基于原turtle ui官方仓库创建的plugin模板仓库",
		"url": "https://github.com/omdsh-dev/plugin-template",
		"pushedAt": "2026-08-12T20:17:02Z",
		"tags": ["dsh"]
	},
	{
		"slug": "ccq1/dsh-side-panel",
		"name": "dsh-side-panel",
		"description": "DSH 侧边栏，集成文件浏览器、终端和 Git 审查，方便预览文件。",
		"url": "https://github.com/ccq1/dsh-side-panel",
		"pushedAt": "2026-08-12T18:36:15Z",
		"tags": ["dsh"]
	},
	{
		"slug": "hellodigua/dsh-share",
		"name": "dsh-share",
		"description": "dsh对话分享插件",
		"url": "https://github.com/hellodigua/dsh-share",
		"pushedAt": "2026-08-12T18:27:47Z",
		"tags": ["dsh"]
	},
	{
		"slug": "Fisfzy/ego-browser",
		"name": "ego-browser",
		"description": "DSH（DeepSeek Harness）插件：把 ego-lite 浏览器（给 AI Agent 用的 Chromium）接入 HARNESS——13 个结构化 ego_* 工具（文本语义快照、语义定位点击、表单填充、截图、CDP 控制、任务空间隔离），内置 ego 运行时，Linux + Chrome 开箱即用，无需克隆官方仓库或手动构建。",
		"url": "https://github.com/Fisfzy/ego-browser",
		"pushedAt": "2026-08-12T18:18:16Z",
		"tags": [
			"agent-browser",
			"browser-automation",
			"dshx",
			"ego-lite"
		]
	},
	{
		"slug": "chen-001/dsh-grok-tui",
		"name": "dsh-grok-tui",
		"description": "Use dsh via grok-build's TUI.",
		"url": "https://github.com/chen-001/dsh-grok-tui",
		"pushedAt": "2026-08-12T17:11:45Z",
		"tags": ["deepseek-harness", "dsh"]
	},
	{
		"slug": "Void0312Aurora/dsh-desktop-electron",
		"name": "dsh-desktop-electron",
		"description": "Cross-platform Electron desktop shell for the DSH Web GUI: tray-resident standalone window over your own dsh web, no bundled Node runtime",
		"url": "https://github.com/Void0312Aurora/dsh-desktop-electron",
		"pushedAt": "2026-08-12T16:13:57Z",
		"tags": []
	},
	{
		"slug": "whiteguo233/dsh-cc-connect",
		"name": "dsh-cc-connect",
		"description": "通过cc connect远程使用dsh",
		"url": "https://github.com/whiteguo233/dsh-cc-connect",
		"pushedAt": "2026-08-12T13:44:47Z",
		"tags": ["deepseek-harness", "dsh"]
	},
	{
		"slug": "vibeinging/dsh-turn-navigator",
		"name": "dsh-turn-navigator",
		"description": "Private DSH Web turn navigation plugin",
		"url": "https://github.com/vibeinging/dsh-turn-navigator",
		"pushedAt": "2026-08-12T13:23:07Z",
		"tags": ["dsh"]
	},
	{
		"slug": "vibeinging/dsh-trace",
		"name": "dsh-trace",
		"description": "DeepSeek Harness telemetry backend that exports turns, model steps, and tool calls to yiTrace over HTTP.",
		"url": "https://github.com/vibeinging/dsh-trace",
		"pushedAt": "2026-08-12T13:18:45Z",
		"tags": [
			"deepseek-harness",
			"dsh",
			"observability",
			"telemetry",
			"tracing",
			"yitrace"
		]
	},
	{
		"slug": "vibeinging/dsh-agent-budget",
		"name": "dsh-agent-budget",
		"description": "Native Harness agent-tree token budget plugin",
		"url": "https://github.com/vibeinging/dsh-agent-budget",
		"pushedAt": "2026-08-12T13:18:45Z",
		"tags": ["dsh"]
	},
	{
		"slug": "vibeinging/dsh-tool-search",
		"name": "dsh-tool-search",
		"description": "Per-agent on-demand tool discovery and progressive schema disclosure for DeepSeek Harness",
		"url": "https://github.com/vibeinging/dsh-tool-search",
		"pushedAt": "2026-08-12T13:18:45Z",
		"tags": ["dsh"]
	},
	{
		"slug": "omdsh-dev/dsh-plugin-check",
		"name": "dsh-plugin-check",
		"description": "DSH 插件健康检查工具：扫描插件仓库的清单协议 / patch 格式 / 构建陷阱 / hub 收录状态，零依赖只读，注册 plugin_check 工具",
		"url": "https://github.com/omdsh-dev/dsh-plugin-check",
		"pushedAt": "2026-08-12T08:26:38Z",
		"tags": [
			"diagnostics",
			"dsh",
			"linting",
			"plugin-health"
		]
	},
	{
		"slug": "omdsh-dev/dsh-tool-time",
		"name": "dsh-tool-time",
		"description": "DSH 时间工具插件：严格 ISO 8601 解析、IANA 时区转换、UTC 日历运算、固定时长差，零依赖",
		"url": "https://github.com/omdsh-dev/dsh-tool-time",
		"pushedAt": "2026-08-12T08:13:21Z",
		"tags": [
			"dsh",
			"iso8601",
			"time",
			"timezone"
		]
	},
	{
		"slug": "omdsh-dev/dsh-tool-json",
		"name": "dsh-tool-json",
		"description": "DSH JSON 查询工具插件：JMESPath 子集查询，零依赖递归下降解析器",
		"url": "https://github.com/omdsh-dev/dsh-tool-json",
		"pushedAt": "2026-08-12T08:13:19Z",
		"tags": [
			"dsh",
			"jmespath",
			"json",
			"query"
		]
	},
	{
		"slug": "omdsh-dev/dsh-tool-encoding",
		"name": "dsh-tool-encoding",
		"description": "DSH 编码/哈希工具插件：base64/base64url/url/hex 编解码、md5/sha1/sha256/sha512 哈希、UUID 生成，零依赖",
		"url": "https://github.com/omdsh-dev/dsh-tool-encoding",
		"pushedAt": "2026-08-12T08:13:16Z",
		"tags": [
			"base64",
			"dsh",
			"encoding",
			"hash"
		]
	},
	{
		"slug": "omdsh-dev/dsh-tool-calculator",
		"name": "dsh-tool-calculator",
		"description": "DSH 计算器工具插件：安全的数学表达式求值器，零依赖递归下降解析器",
		"url": "https://github.com/omdsh-dev/dsh-tool-calculator",
		"pushedAt": "2026-08-12T08:13:13Z",
		"tags": [
			"calculator",
			"dsh",
			"expression-evaluator",
			"math"
		]
	},
	{
		"slug": "omdsh-dev/dsh-session-health",
		"name": "dsh-session-health",
		"description": "DSH 会话健康检查插件：多帧 zstd 会话文件的帧级扫描诊断（torn/损坏/空会话检测），零依赖只读，注册 session_health 工具",
		"url": "https://github.com/omdsh-dev/dsh-session-health",
		"pushedAt": "2026-08-12T07:43:16Z",
		"tags": [
			"diagnostics",
			"dsh",
			"health-check",
			"zstd"
		]
	},
	{
		"slug": "omdsh-dev/dsh-security-audit",
		"name": "dsh-security-audit",
		"description": "DSH 本机安全审计插件：配置/插件来源/会话/网络暴露面，只读脱敏风险报告",
		"url": "https://github.com/omdsh-dev/dsh-security-audit",
		"pushedAt": "2026-08-12T07:43:07Z",
		"tags": [
			"audit",
			"dsh",
			"secret-scanning",
			"security"
		]
	},
	{
		"slug": "omdsh-dev/dsh-tool-schema",
		"name": "dsh-tool-schema",
		"description": "DSH JSON Schema 验证工具插件：validate/paths/explain/normalize，零网络零动态执行",
		"url": "https://github.com/omdsh-dev/dsh-tool-schema",
		"pushedAt": "2026-08-12T07:43:04Z",
		"tags": [
			"dsh",
			"json-schema",
			"validation"
		]
	},
	{
		"slug": "omdsh-dev/dsh-tool-stat",
		"name": "dsh-tool-stat",
		"description": "DSH 统计工具插件：描述统计/百分位数/频数分布/相关性，零依赖纯函数确定性",
		"url": "https://github.com/omdsh-dev/dsh-tool-stat",
		"pushedAt": "2026-08-12T07:42:41Z",
		"tags": [
			"correlation",
			"data-analysis",
			"dsh",
			"statistics"
		]
	},
	{
		"slug": "omdsh-dev/dsh-tool-regex",
		"name": "dsh-tool-regex",
		"description": "DSH 正则工具插件：测试匹配/提取捕获组/安全替换/静态解释正则（不执行代码），零依赖，注册 regex 工具",
		"url": "https://github.com/omdsh-dev/dsh-tool-regex",
		"pushedAt": "2026-08-12T07:41:52Z",
		"tags": [
			"dsh",
			"redos-protection",
			"regex"
		]
	},
	{
		"slug": "omdsh-dev/dsh-tool-markdown",
		"name": "dsh-tool-markdown",
		"description": "DSH Markdown 工具插件：HTML↔Markdown 转换、GFM 表格规范化、目录生成，零依赖轻量解析器，注册 markdown 工具",
		"url": "https://github.com/omdsh-dev/dsh-tool-markdown",
		"pushedAt": "2026-08-12T07:41:49Z",
		"tags": [
			"dsh",
			"html-conversion",
			"markdown"
		]
	},
	{
		"slug": "omdsh-dev/dsh-tool-diff",
		"name": "dsh-tool-diff",
		"description": "DSH Diff 工具插件：文本/JSON/CSV/Markdown 结构化比较与 unified diff，零依赖只读，注册 diff 工具",
		"url": "https://github.com/omdsh-dev/dsh-tool-diff",
		"pushedAt": "2026-08-12T07:40:39Z",
		"tags": [
			"data-comparison",
			"diff",
			"dsh",
			"unified-diff"
		]
	},
	{
		"slug": "omdsh-dev/dsh-tool-csv",
		"name": "dsh-tool-csv",
		"description": "DSH CSV 数据工具插件：解析/查询/统计/转换 CSV 文本（RFC 4180），零依赖状态机解析器，注册 csv 工具",
		"url": "https://github.com/omdsh-dev/dsh-tool-csv",
		"pushedAt": "2026-08-12T07:40:36Z",
		"tags": [
			"csv",
			"data-parsing",
			"dsh",
			"rfc4180"
		]
	},
	{
		"slug": "omdsh-dev/dsh-deep-research",
		"name": "dsh-deep-research",
		"description": "Adaptive deep-research orchestrator plugin for DeepSeek Harness (official workflow engine, cybernetics/information-theory design)",
		"url": "https://github.com/omdsh-dev/dsh-deep-research",
		"pushedAt": "2026-08-12T07:12:36Z",
		"tags": []
	},
	{
		"slug": "omdsh-dev/dsh-inspect",
		"name": "dsh-inspect",
		"description": "发现问题(checkup) → 修复交付(fix) → 质量复查(review) 的对抗式闭环插件：基于官方 workflow 引擎的检查/修复/复查工具集",
		"url": "https://github.com/omdsh-dev/dsh-inspect",
		"pushedAt": "2026-08-12T07:03:13Z",
		"tags": []
	},
	{
		"slug": "omdsh-dev/dsh-kb-sieve",
		"name": "dsh-kb-sieve",
		"description": "DSH knowledge-base plugin: build audit-able KB packs (references + SQLite FTS5) from md/txt/docx/pdf, deterministic retrieval (kb_query) and original-text reading (kb_read), zero-script generated skills. Apache-2.0.",
		"url": "https://github.com/omdsh-dev/dsh-kb-sieve",
		"pushedAt": "2026-08-12T06:59:40Z",
		"tags": []
	},
	{
		"slug": "bill9109/dsh-101",
		"name": "dsh-101",
		"description": "DSH 文档阅读模式",
		"url": "https://github.com/bill9109/dsh-101",
		"pushedAt": "2026-08-12T03:20:13Z",
		"tags": ["dsh"]
	},
	{
		"slug": "jark006/RemoteOps",
		"name": "RemoteOps",
		"description": "RemoteOps 是一个面向远程系统维护和嵌入式 Linux 开发的 MCP 工具。",
		"url": "https://github.com/jark006/RemoteOps",
		"pushedAt": "2026-08-11T19:07:42Z",
		"tags": [
			"agents",
			"claude",
			"claude-code",
			"codex",
			"dsh",
			"mcp",
			"mcp-client",
			"mcp-server",
			"mcp-tools",
			"vibe",
			"vibe-coding",
			"vibecoding"
		]
	},
	{
		"slug": "Moeblack/deepseek-manners",
		"name": "deepseek-manners",
		"description": "DSH 插件：给每次消息后注入感谢语（deepseek-manners）",
		"url": "https://github.com/Moeblack/deepseek-manners",
		"pushedAt": "2026-08-11T09:03:10Z",
		"tags": ["dsh"]
	},
	{
		"slug": "omdsh-dev/sandbox-nono",
		"name": "sandbox-nono",
		"description": "nono沙盒支持",
		"url": "https://github.com/omdsh-dev/sandbox-nono",
		"pushedAt": "2026-08-11T06:32:44Z",
		"tags": ["dsh", "sandbox"]
	},
	{
		"slug": "bill9109/dsh-webbridge",
		"name": "dsh-webbridge",
		"description": "DSH 结合 Kimi WebBridge",
		"url": "https://github.com/bill9109/dsh-webbridge",
		"pushedAt": "2026-08-09T13:20:14Z",
		"tags": ["dsh"]
	},
	{
		"slug": "omdsh-dev/sandbox-mxc",
		"name": "sandbox-mxc",
		"description": "微软跨平台沙盒支持",
		"url": "https://github.com/omdsh-dev/sandbox-mxc",
		"pushedAt": "2026-08-09T12:07:40Z",
		"tags": ["dsh", "sandbox"]
	},
	{
		"slug": "omdsh-dev/sandbox-micro",
		"name": "sandbox-micro",
		"description": "microsandbox支持",
		"url": "https://github.com/omdsh-dev/sandbox-micro",
		"pushedAt": "2026-08-09T11:00:00Z",
		"tags": ["dsh", "sandbox"]
	},
	{
		"slug": "omdsh-dev/ex-setting",
		"name": "ex-setting",
		"description": "DSH的设置扩展",
		"url": "https://github.com/omdsh-dev/ex-setting",
		"pushedAt": "2026-08-09T10:59:57Z",
		"tags": ["dsh"]
	},
	{
		"slug": "omdsh-dev/web-components",
		"name": "web-components",
		"description": "web-components支持",
		"url": "https://github.com/omdsh-dev/web-components",
		"pushedAt": "2026-08-09T10:59:54Z",
		"tags": ["dsh"]
	},
	{
		"slug": "omdsh-dev/Qwen-MM-Plugins",
		"name": "Qwen-MM-Plugins",
		"description": "Qwen-MM-Plugins支持",
		"url": "https://github.com/omdsh-dev/Qwen-MM-Plugins",
		"pushedAt": "2026-08-09T10:59:51Z",
		"tags": ["dsh", "qwen"]
	},
	{
		"slug": "Fisfzy/zotero-harvest",
		"name": "zotero-harvest",
		"description": "Zotero 文献采集入库插件（DSH external plugin）：多源检索（OpenAlex/arXiv/Crossref/Europe PMC/Semantic Scholar）+ OA 下载链接解析（Unpaywall）+ 充分性审计 + 入库本地 Zotero + 触发 zotero-wave-rag 重建",
		"url": "https://github.com/Fisfzy/zotero-harvest",
		"pushedAt": "2026-08-08T06:06:20Z",
		"tags": [
			"dshx",
			"literature",
			"papers",
			"zotero"
		]
	},
	{
		"slug": "Moeblack/dsh-prompt-studio",
		"name": "dsh-prompt-studio",
		"description": "DSH plugin: edit user and built-in system-prompt sections with live preview (Prompt Studio)",
		"url": "https://github.com/Moeblack/dsh-prompt-studio",
		"pushedAt": "2026-08-07T08:06:18Z",
		"tags": ["dsh"]
	},
	{
		"slug": "Fisfzy/zotero-wave-rag",
		"name": "zotero-wave-rag",
		"description": "面向 Zotero 论文库的浪潮式 RAG 细节检索系统 —— DSH 外部插件。移植 VCPToolBox 浪潮语义动力学思想（标签河道图传播/虫洞跳转/钟型阻尼/Ω重排），配 BM25+RRF 混合检索、claim-evidence 忠实度校验、两级增量索引",
		"url": "https://github.com/Fisfzy/zotero-wave-rag",
		"pushedAt": "2026-08-07T03:53:17Z",
		"tags": [
			"marisa-plugin",
			"rag",
			"typescript",
			"zotero"
		]
	}
];
//#endregion
//#region src/catalog.ts
/**
* Discovering community plugins through GitHub's `dsh-plugin` topic.
*
* Repository ownership is deliberately irrelevant: a plugin remains visible
* after a transfer between an organisation and a personal account. The host
* tries its authenticated `gh` session first, then a token, then GitHub's
* anonymous public API. A generated snapshot keeps the ad layer useful while
* GitHub is unavailable or rate-limited.
*
* @module
*/
const execFileAsync$1 = promisify(execFile);
/** GitHub topic that opts a public repository into DSH plugin discovery. */
const PLUGIN_TOPIC = "dsh-plugin";
/** GitHub repository-search expression shared by every live discovery path. */
const SEARCH_QUERY = `topic:${PLUGIN_TOPIC} is:public archived:false`;
/** GitHub's maximum repository-search page size. */
const PAGE_SIZE = 100;
/** GitHub repository search exposes at most its first 1,000 matches. */
const MAX_SEARCH_PAGES = 10;
/** Bound stdout from a credentialed multi-page `gh api` search. */
const MAX_SEARCH_BYTES = 33554432;
/**
* Narrow one search record into a sponsor, or reject it.
*
* @param raw - one item from GitHub's repository-search response.
* @returns the sponsor, or undefined when the repository is not eligible.
*/
function toSponsor(raw) {
	if (typeof raw !== "object" || raw === null) return void 0;
	const repo = raw;
	if (repo.archived === true || repo.disabled === true || repo.fork === true) return void 0;
	const slug = typeof repo.full_name === "string" ? repo.full_name : "";
	const name = typeof repo.name === "string" ? repo.name : "";
	const url = typeof repo.html_url === "string" ? repo.html_url : "";
	const topics = Array.isArray(repo.topics) ? repo.topics.filter((topic) => typeof topic === "string") : [];
	if (slug.split("/").length !== 2 || name === "" || url === "" || !topics.includes("dsh-plugin")) return void 0;
	return {
		slug,
		name,
		description: typeof repo.description === "string" ? repo.description : "",
		url,
		pushedAt: typeof repo.pushed_at === "string" ? repo.pushed_at : "",
		tags: topics.filter((topic) => topic !== PLUGIN_TOPIC)
	};
}
/**
* Parse one GitHub search response or `gh api --slurp` page array.
*
* @param text - raw JSON from GitHub or `gh`.
* @returns eligible public DSH plugins in search order.
*/
function parseSearchResults(text) {
	const parsed = JSON.parse(text);
	const pages = Array.isArray(parsed) ? parsed : [parsed];
	const out = [];
	const seen = /* @__PURE__ */ new Set();
	for (const page of pages) {
		if (typeof page !== "object" || page === null) continue;
		const items = page.items;
		if (!Array.isArray(items)) continue;
		for (const item of items) {
			const sponsor = toSponsor(item);
			if (sponsor === void 0 || seen.has(sponsor.slug.toLowerCase())) continue;
			seen.add(sponsor.slug.toLowerCase());
			out.push(sponsor);
		}
	}
	return out;
}
/**
* Keep plugins pushed within the freshness window.
*
* The window is anchored to the newest push in the list rather than the wall
* clock, so an older offline snapshot still yields its own latest fortnight.
*
* @param plugins - candidates.
* @param freshDays - window width in days; zero or less keeps everything.
* @param excludeSlug - plugin to drop, normally this ad layer itself.
* @returns the eligible subset.
*/
function selectFresh(plugins, freshDays, excludeSlug) {
	const excluded = excludeSlug.toLowerCase();
	const dated = plugins.filter((plugin) => plugin.slug.toLowerCase() !== excluded).map((plugin) => ({
		plugin,
		pushed: Date.parse(plugin.pushedAt)
	})).filter((entry) => Number.isFinite(entry.pushed));
	if (freshDays <= 0) return dated.map((entry) => entry.plugin);
	let newest = -Infinity;
	for (const entry of dated) newest = Math.max(newest, entry.pushed);
	const floor = newest - freshDays * 864e5;
	return dated.filter((entry) => entry.pushed >= floor).map((entry) => entry.plugin);
}
/**
* Search through the authenticated `gh` CLI.
*
* @returns all exposed result pages as a JSON array.
* @throws when `gh` is absent, unauthenticated, or GitHub rejects the search.
*/
async function readViaGh() {
	const { stdout } = await execFileAsync$1("gh", [
		"api",
		"--paginate",
		"--slurp",
		"--method",
		"GET",
		"search/repositories",
		"-f",
		`q=${SEARCH_QUERY}`,
		"-f",
		"sort=updated",
		"-f",
		"order=desc",
		"-f",
		`per_page=${PAGE_SIZE}`
	], {
		maxBuffer: MAX_SEARCH_BYTES,
		timeout: 2e4
	});
	return stdout;
}
/**
* Search GitHub directly, with or without a token.
*
* @param token - optional GitHub token used only as an Authorization header.
* @returns all exposed result pages as a JSON array.
* @throws when GitHub rejects a page or returns invalid pagination metadata.
*/
async function readViaGitHub(token) {
	const pages = [];
	for (let page = 1; page <= MAX_SEARCH_PAGES; page += 1) {
		const url = new URL("https://api.github.com/search/repositories");
		url.searchParams.set("q", SEARCH_QUERY);
		url.searchParams.set("sort", "updated");
		url.searchParams.set("order", "desc");
		url.searchParams.set("per_page", String(PAGE_SIZE));
		url.searchParams.set("page", String(page));
		const headers = {
			accept: "application/vnd.github+json",
			"user-agent": "dsh-ads",
			"x-github-api-version": "2022-11-28"
		};
		if (token !== "") headers.authorization = `Bearer ${token}`;
		const response = await fetch(url, {
			headers,
			signal: AbortSignal.timeout(2e4)
		});
		if (!response.ok) throw new Error(`GitHub responded ${response.status}`);
		const body = await response.json();
		pages.push(body);
		if (typeof body !== "object" || body === null) throw new Error("GitHub returned a non-object search page");
		const searchPage = body;
		if (!Array.isArray(searchPage.items)) throw new Error("GitHub returned no search items");
		const total = typeof searchPage.total_count === "number" ? searchPage.total_count : searchPage.items.length;
		if (page * PAGE_SIZE >= total || searchPage.items.length < PAGE_SIZE) break;
	}
	return JSON.stringify(pages);
}
/**
* Assemble the payload consumed by the browser half.
*
* Never throws: the generated snapshot is the final fallback.
*
* @param nowMs - current epoch time.
* @param freshDays - freshness window in days.
* @param excludeSlug - plugin to leave out of its own rotation.
* @returns the sponsor list and its discovery source.
*/
async function loadRegistry(nowMs, freshDays, excludeSlug) {
	const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN ?? "";
	const attempts = [
		{
			source: "gh-cli",
			read: readViaGh
		},
		...token === "" ? [] : [{
			source: "github-token",
			read: () => readViaGitHub(token)
		}],
		{
			source: "github-public",
			read: () => readViaGitHub("")
		}
	];
	for (const attempt of attempts) try {
		const plugins = parseSearchResults(await attempt.read());
		if (plugins.length === 0) continue;
		return {
			generated: new Date(nowMs).toISOString(),
			source: attempt.source,
			freshDays,
			plugins: selectFresh(plugins, freshDays, excludeSlug)
		};
	} catch {
		continue;
	}
	return {
		generated: new Date(nowMs).toISOString(),
		source: "snapshot",
		freshDays,
		plugins: selectFresh(CATALOG_SNAPSHOT, freshDays, excludeSlug)
	};
}
//#endregion
//#region src/star-host.ts
/**
* The credentialed half of star verification.
*
* `GET /user/starred/{owner}/{repo}` answers for the GitHub account the host
* is logged in as — which is exactly the person sitting in front of the ad
* layer — and it works while the repository is still private, where the
* browser's anonymous stargazer walk sees only a 404. Channels mirror
* [catalog.ts](./catalog.ts): the `gh` CLI first, an environment token for
* headless hosts second, and `unavailable` (never a throw) when neither can
* answer, so the browser knows to fall back rather than to give up.
*
* @module
*/
const execFileAsync = promisify(execFile);
/** How long one `gh` invocation may take before it counts as unavailable. */
const GH_TIMEOUT_MS = 2e4;
/**
* Classify a failed `gh api user/starred/…` call from its stderr.
*
* `gh` exits non-zero both when the answer is "not starred" (HTTP 404) and
* when it has no usable login; the status line it prints is the only thing
* that tells the two apart.
*
* @param stderr - the failed invocation's stderr.
* @returns `absent` for a definitive 404, `unavailable` for everything else.
*/
function classifyGhFailure(stderr) {
	return stderr.includes("HTTP 404") ? "absent" : "unavailable";
}
/**
* Classify the star endpoint's HTTP status.
* @param status - response status from `GET /user/starred/{repo}`.
* @returns the verdict the status proves; bad credentials and rate limits are
* `unavailable` because they say nothing about the star.
*/
function classifyStarStatus(status) {
	if (status === 204) return "starred";
	if (status === 404) return "absent";
	return "unavailable";
}
/**
* Ask `gh` whether its logged-in user starred the repository.
* @param repo - `owner/repo` slug.
* @returns the verdict; `unavailable` when `gh` is missing or logged out.
*/
async function viaGh(repo) {
	try {
		await execFileAsync("gh", [
			"api",
			`user/starred/${repo}`,
			"--silent"
		], { timeout: GH_TIMEOUT_MS });
		return "starred";
	} catch (error) {
		const stderr = error.stderr;
		return classifyGhFailure(typeof stderr === "string" ? stderr : "");
	}
}
/**
* Ask the API directly with a token from the environment.
* @param repo - `owner/repo` slug.
* @param token - a GitHub token; must belong to the user being asked about.
* @returns the verdict; `unavailable` when the network or the token fails.
*/
async function viaToken(repo, token) {
	try {
		return classifyStarStatus((await fetch(`https://api.github.com/user/starred/${repo}`, { headers: {
			accept: "application/vnd.github+json",
			authorization: `Bearer ${token}`
		} })).status);
	} catch {
		return "unavailable";
	}
}
/**
* Resolve the host's star verdict through the first channel that can answer.
* @param repo - `owner/repo` slug to check.
* @returns the payload for the star route; never throws.
*/
async function checkHostStarred(repo) {
	const gh = await viaGh(repo);
	if (gh !== "unavailable") return { verdict: gh };
	const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN ?? "";
	if (token !== "") {
		const viaApi = await viaToken(repo, token);
		if (viaApi !== "unavailable") return { verdict: viaApi };
	}
	return { verdict: "unavailable" };
}
//#endregion
//#region src/index.ts
/** Host capabilities required for the dynamic tier. */
const inject = ["webServer"];
/** Freshness window: a fortnight is long enough that a weekend release still gets seen. */
const DEFAULT_FRESH_DAYS = 14;
/** Search-result reuse window. */
const DEFAULT_CACHE_MINUTES = 30;
/** This plugin's own slug, kept out of its own rotation. */
const SELF_SLUG = "Nagi-ovo/dsh-ads";
/**
* Serve JSON.
* @param res - the response to write.
* @param body - the payload.
*/
function json(res, body) {
	const text = JSON.stringify(body);
	res.writeHead(200, {
		"content-type": "application/json; charset=utf-8",
		"cache-control": "no-store"
	});
	res.end(text);
}
/**
* Register the sponsor route.
* @param ctx - host context.
* @param config - see {@link Config}.
*/
function apply(ctx, config = {}) {
	const freshDays = config.freshDays ?? DEFAULT_FRESH_DAYS;
	const cacheMs = (config.cacheMinutes ?? DEFAULT_CACHE_MINUTES) * 6e4;
	let cache;
	let inflight;
	const resolve = async () => {
		const now = Date.now();
		if (cache !== void 0 && now - cache.at < cacheMs) return cache.payload;
		inflight ??= loadRegistry(now, freshDays, SELF_SLUG).then((payload) => {
			cache = {
				payload,
				at: Date.now()
			};
			return payload;
		}).finally(() => {
			inflight = void 0;
		});
		return await inflight;
	};
	ctx.effect(() => ctx.webServer.register({
		kind: "exact",
		path: REGISTRY_ROUTE,
		handler: async (_req, res) => {
			json(res, await resolve());
		}
	}));
	let starSeen;
	let starInflight;
	const resolveStar = async () => {
		if (starSeen !== void 0) return starSeen;
		starInflight ??= checkHostStarred(SELF_SLUG).then((payload) => {
			if (payload.verdict === "starred") starSeen = payload;
			return payload;
		}).finally(() => {
			starInflight = void 0;
		});
		return await starInflight;
	};
	ctx.effect(() => ctx.webServer.register({
		kind: "exact",
		path: STAR_ROUTE,
		handler: async (_req, res) => {
			json(res, await resolveStar());
		}
	}));
}
//#endregion
export { apply, inject };
