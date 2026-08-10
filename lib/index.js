import { execFile } from "node:child_process";
import { promisify } from "node:util";
//#region src/protocol.ts
/**
* The wire between the two halves of the dynamic ad tier.
*
* The built-in banners are baked into the browser bundle and need no host at
* all. The dynamic tier does: the plugin hub is a private repository, so the
* catalog can only be read through the user's own GitHub credentials, which
* live on the host side. The browser half therefore asks the host for a
* trimmed, already-filtered list rather than talking to GitHub itself.
*
* @module
*/
/** Host route serving the sponsor list. */
const REGISTRY_ROUTE = "/dsh-ads/registry.json";
//#endregion
//#region src/catalog-snapshot.ts
/** Hub contents as of the last release, newest push first. */
const CATALOG_SNAPSHOT = [
	{
		"slug": "dsh-external/dsh-ads",
		"name": "dsh-ads",
		"description": "DSH Web UI 广告层：2005 中文站风格侧栏广告/信息流/角落弹窗 + 关闭叉热区远小于视觉（素材全虚构整活插件）",
		"url": "https://github.com/dsh-external/dsh-ads",
		"pushedAt": "2026-08-09T22:14:35Z",
		"tags": ["web-ui", "fun"]
	},
	{
		"slug": "dsh-external/dsh-mygo",
		"name": "dsh-mygo",
		"description": "managed-plugin bridge 源仓库：Cordis-free 插件契约 + 挂载/校验/排序/分发/持久化/恢复（packages/ 多包）",
		"url": "https://github.com/dsh-external/dsh-mygo",
		"pushedAt": "2026-08-09T22:11:33Z",
		"tags": ["manager", "plugin"]
	},
	{
		"slug": "dsh-external/dsh-cc-tui",
		"name": "dsh-cc-tui",
		"description": "Claude Code 风格全屏交互终端插件（像素鲸鱼顶栏、流光大字、思考流式展开、Esc 回滚、TPS 仪表）",
		"url": "https://github.com/dsh-external/dsh-cc-tui",
		"pushedAt": "2026-08-09T21:12:57Z",
		"tags": ["tui", "web-ui"]
	},
	{
		"slug": "dsh-external/dsh-llm-fallbacks",
		"name": "dsh-llm-fallbacks",
		"description": "基于角色的 LLM 重试与备用策略插件（role-based retry & fallback）",
		"url": "https://github.com/dsh-external/dsh-llm-fallbacks",
		"pushedAt": "2026-08-09T21:01:40Z",
		"tags": ["llm", "tool"]
	},
	{
		"slug": "dsh-external/dsh-external-research",
		"name": "dsh-external-research",
		"description": "生态情报与 mainline 兼容性监控：每 8 小时对比全部仓库接口差异，产出兼容矩阵与插件适配建议（补丁基线/seam/peerDeps）+ 每日报告",
		"url": "https://github.com/dsh-external/dsh-external-research",
		"pushedAt": "2026-08-09T20:49:05Z",
		"tags": [
			"compat",
			"monitoring",
			"mainline"
		]
	},
	{
		"slug": "dsh-external/dsh-involute",
		"name": "dsh-involute",
		"description": "Involute Bridge：嵌入式任务管理引擎（decision-point 协议、capture wall、Linear 形 issue 存储，bundle）",
		"url": "https://github.com/dsh-external/dsh-involute",
		"pushedAt": "2026-08-09T19:58:35Z",
		"tags": ["task", "workflow"]
	},
	{
		"slug": "dsh-external/dsh-skill-session-recovery",
		"name": "dsh-skill-session-recovery",
		"description": "会话丢失事故的定位/无损修复/安全重启 skill：诊断 corrupt session log、修复帧结构、重启前 handoff 纪律",
		"url": "https://github.com/dsh-external/dsh-skill-session-recovery",
		"pushedAt": "2026-08-09T19:28:42Z",
		"tags": [
			"skill",
			"session",
			"recovery"
		]
	},
	{
		"slug": "dsh-external/dsh-engram-relay",
		"name": "dsh-engram-relay",
		"description": "外置 engram 转接模型：内置 <1B 模型（transformers.js/ONNX），超长记忆（100k 上下文等效延展 ≥10 倍）+ 超稀疏因果图主动唤醒",
		"url": "https://github.com/dsh-external/dsh-engram-relay",
		"pushedAt": "2026-08-09T18:46:32Z",
		"tags": [
			"memory",
			"llm",
			"marisa-plugin"
		]
	},
	{
		"slug": "dsh-external/dsh-my-rsi",
		"name": "dsh-my-rsi",
		"description": "本地插件集：tool-failure-guard / commit-gate / compact-continuity",
		"url": "https://github.com/dsh-external/dsh-my-rsi",
		"pushedAt": "2026-08-09T18:06:08Z",
		"tags": ["tool", "guard"]
	},
	{
		"slug": "dsh-external/dsh-club",
		"name": "dsh-club",
		"description": "DSH 俱乐部：内测用户排行榜（每日自动采集）",
		"url": "https://github.com/dsh-external/dsh-club",
		"pushedAt": "2026-08-09T18:01:17Z",
		"tags": ["community", "ranking"]
	},
	{
		"slug": "dsh-external/dsh-voice-chat",
		"name": "dsh-voice-chat",
		"description": "实时语音对话：WebUI 内语音输入/输出，边说话边编程（vibe coding，0 打字）",
		"url": "https://github.com/dsh-external/dsh-voice-chat",
		"pushedAt": "2026-08-09T17:36:36Z",
		"tags": [
			"web-ui",
			"voice",
			"marisa-plugin"
		]
	},
	{
		"slug": "dsh-external/dsh-wecom-bot",
		"name": "dsh-wecom-bot",
		"description": "企业微信 remote channel",
		"url": "https://github.com/dsh-external/dsh-wecom-bot",
		"pushedAt": "2026-08-09T17:32:42Z",
		"tags": ["wecom"]
	},
	{
		"slug": "dsh-external/dsh-weixin-bot",
		"name": "dsh-weixin-bot",
		"description": "微信 remote channel",
		"url": "https://github.com/dsh-external/dsh-weixin-bot",
		"pushedAt": "2026-08-09T17:32:37Z",
		"tags": ["weixin"]
	},
	{
		"slug": "dsh-external/qqbot",
		"name": "qqbot",
		"description": "QQ remote channel",
		"url": "https://github.com/dsh-external/qqbot",
		"pushedAt": "2026-08-09T17:32:33Z",
		"tags": ["qq"]
	},
	{
		"slug": "dsh-external/dsh-feishu-bot",
		"name": "dsh-feishu-bot",
		"description": "飞书 remote channel",
		"url": "https://github.com/dsh-external/dsh-feishu-bot",
		"pushedAt": "2026-08-09T17:32:28Z",
		"tags": ["feishu"]
	},
	{
		"slug": "dsh-external/mstar-workflow",
		"name": "mstar-workflow",
		"description": "Skill-driven Harness/Loop Engineering Workflow Agent Plugin",
		"url": "https://github.com/dsh-external/mstar-workflow",
		"pushedAt": "2026-08-09T17:28:39Z",
		"tags": ["workflow", "skill"]
	},
	{
		"slug": "dsh-external/yet-another-subagent",
		"name": "yet-another-subagent",
		"description": "可配置 subagent profiles：Web UI 设置 + 实时 toolcall/token 显示 + 点击跳转子会话（bundle）",
		"url": "https://github.com/dsh-external/yet-another-subagent",
		"pushedAt": "2026-08-09T17:20:16Z",
		"tags": ["subagent", "web-ui"]
	},
	{
		"slug": "dsh-external/dsh-rewind",
		"name": "dsh-rewind",
		"description": "把自上次 checkpoint 以来的内容折叠为自动生成的报告并替换出上下文（保留完整日志）",
		"url": "https://github.com/dsh-external/dsh-rewind",
		"pushedAt": "2026-08-09T17:14:21Z",
		"tags": ["session", "tool"]
	},
	{
		"slug": "dsh-external/dsh-checkpoint",
		"name": "dsh-checkpoint",
		"description": "在会话中标记探索起点（与 rewind 配对，折叠探索内容出上下文）",
		"url": "https://github.com/dsh-external/dsh-checkpoint",
		"pushedAt": "2026-08-09T17:14:19Z",
		"tags": ["session", "tool"]
	},
	{
		"slug": "dsh-external/dsh-browser-panel",
		"name": "dsh-browser-panel",
		"description": "WebUI 内嵌完整有头浏览器视图：模型实时操控真实浏览器，用户可见每一步（Codex 式体验，0 视觉依赖）",
		"url": "https://github.com/dsh-external/dsh-browser-panel",
		"pushedAt": "2026-08-09T17:13:34Z",
		"tags": [
			"web-ui",
			"browser",
			"marisa-plugin"
		]
	},
	{
		"slug": "dsh-external/dsh-a2a",
		"name": "dsh-a2a",
		"description": "A2A 协议跨 session / 跨 Harness 交互（WIP 占位）",
		"url": "https://github.com/dsh-external/dsh-a2a",
		"pushedAt": "2026-08-09T17:12:24Z",
		"tags": ["a2a", "protocol"]
	},
	{
		"slug": "dsh-external/dsh-selection-chat",
		"name": "dsh-selection-chat",
		"description": "选中对话文本 → 加入 composer（不自动发送）/ 侧栏查看（bundle）",
		"url": "https://github.com/dsh-external/dsh-selection-chat",
		"pushedAt": "2026-08-09T17:00:38Z",
		"tags": ["web-ui", "selection"]
	},
	{
		"slug": "dsh-external/dsh-hub",
		"name": "dsh-hub",
		"description": "OMDSH 社区扩展 Hub：基于官方 DeepSeek Harness 契约构建",
		"url": "https://github.com/dsh-external/dsh-hub",
		"pushedAt": "2026-08-09T16:56:46Z",
		"tags": ["hub", "community"]
	},
	{
		"slug": "dsh-external/dsh-spur",
		"name": "dsh-spur",
		"description": "聊天流里的辫子挂件：抓取鞭梢甩动给 agent 发「go work!」（bundle）",
		"url": "https://github.com/dsh-external/dsh-spur",
		"pushedAt": "2026-08-09T16:33:45Z",
		"tags": ["web-ui", "fun"]
	},
	{
		"slug": "dsh-external/DSH-better-sidebar",
		"name": "DSH-better-sidebar",
		"description": "右侧侧边栏增强：文件预览/终端/Git，可拖拽自定义位置",
		"url": "https://github.com/dsh-external/DSH-better-sidebar",
		"pushedAt": "2026-08-09T15:53:55Z",
		"tags": ["web-ui", "sidebar"]
	},
	{
		"slug": "dsh-external/dsh-skill-stats",
		"name": "dsh-skill-stats",
		"description": "技能调用统计：历史回放 + 实时订阅，调用次数/会话分布/时间线，会话 Tab + 设置面板双视图，辅助技能清理决策",
		"url": "https://github.com/dsh-external/dsh-skill-stats",
		"pushedAt": "2026-08-09T15:24:47Z",
		"tags": [
			"skill",
			"stats",
			"web-ui"
		]
	},
	{
		"slug": "dsh-external/dsh-agent-budget",
		"name": "dsh-agent-budget",
		"description": "Native Harness agent-tree token budget 插件",
		"url": "https://github.com/dsh-external/dsh-agent-budget",
		"pushedAt": "2026-08-09T15:06:21Z",
		"tags": ["token", "budget"]
	},
	{
		"slug": "dsh-external/dsh-humanize",
		"name": "dsh-humanize",
		"description": "humanize 技能（SKILL.md；描述待仓库填充后复核）",
		"url": "https://github.com/dsh-external/dsh-humanize",
		"pushedAt": "2026-08-09T14:59:11Z",
		"tags": ["skill", "humanize"]
	},
	{
		"slug": "dsh-external/ds_web_craw",
		"name": "ds_web_craw",
		"description": "DS web 爬虫工具（Rust）",
		"url": "https://github.com/dsh-external/ds_web_craw",
		"pushedAt": "2026-08-09T14:39:31Z",
		"tags": ["rust", "crawler"]
	},
	{
		"slug": "dsh-external/dsh-genui",
		"name": "dsh-genui",
		"description": "GenUI：```dsh-ui fence 内联交互式 UI（布局/图表/表单/测验/mermaid/3D）+ 事件循环回模型；含 host 插件 + 浏览器渲染器 + genui skill（bundle）",
		"url": "https://github.com/dsh-external/dsh-genui",
		"pushedAt": "2026-08-09T14:27:19Z",
		"tags": [
			"web-ui",
			"genui",
			"generative-ui",
			"marisa-plugin"
		]
	},
	{
		"slug": "dsh-external/tonghuashun-harness",
		"name": "tonghuashun-harness",
		"description": "同花顺风格终端式 DSH 前端占位仓库：K 线图以股票行情隐喻展示代码量（placeholder，分类推断）",
		"url": "https://github.com/dsh-external/tonghuashun-harness",
		"pushedAt": "2026-08-09T14:17:02Z",
		"tags": ["frontend", "ui"]
	},
	{
		"slug": "dsh-external/dsh-memory-evolve",
		"name": "dsh-memory-evolve",
		"description": "分层记忆（用户/项目/每日）+ 自我进化（经验沉淀 + 技能自动创建）",
		"url": "https://github.com/dsh-external/dsh-memory-evolve",
		"pushedAt": "2026-08-09T14:01:24Z",
		"tags": ["memory", "skill"]
	},
	{
		"slug": "dsh-external/dsh-custom-css",
		"name": "dsh-custom-css",
		"description": "WebUI 自定义 CSS 插件（bundle）：粘贴 CSS 即时改变观感，持久化到 settings.yaml，多浏览器共享同步",
		"url": "https://github.com/dsh-external/dsh-custom-css",
		"pushedAt": "2026-08-09T13:30:23Z",
		"tags": ["web-ui", "css"]
	},
	{
		"slug": "dsh-external/dsh-mineru",
		"name": "dsh-mineru",
		"description": "MineRU 文档解析工具插件：把 MineRU 文档解析能力暴露给模型（bundle）",
		"url": "https://github.com/dsh-external/dsh-mineru",
		"pushedAt": "2026-08-09T13:29:22Z",
		"tags": [
			"tool",
			"mineru",
			"docs"
		]
	},
	{
		"slug": "dsh-external/dsh-mobileweb-adapter",
		"name": "dsh-mobileweb-adapter",
		"description": "手机 Web 适配器：Web GUI 在手机浏览器/PWA 自动变移动版式 + 开放适配协议 + 修复局域网 IP WebSocket 连接",
		"url": "https://github.com/dsh-external/dsh-mobileweb-adapter",
		"pushedAt": "2026-08-09T13:24:18Z",
		"tags": [
			"web-ui",
			"mobile",
			"pwa"
		]
	},
	{
		"slug": "dsh-external/dsh-webbridge",
		"name": "dsh-webbridge",
		"description": "DSH 结合 Kimi WebBridge",
		"url": "https://github.com/dsh-external/dsh-webbridge",
		"pushedAt": "2026-08-09T13:20:14Z",
		"tags": ["kimi", "bridge"]
	},
	{
		"slug": "dsh-external/dsh-web-ui",
		"name": "dsh-web-ui",
		"description": "DSH Web UI 皮肤集合（skins/qq98、ths，热插拔客户端插件包）",
		"url": "https://github.com/dsh-external/dsh-web-ui",
		"pushedAt": "2026-08-09T13:19:55Z",
		"tags": ["web-ui", "theme"]
	},
	{
		"slug": "dsh-external/dsh-turn-rewind",
		"name": "dsh-turn-rewind",
		"description": "Turn Rewind：回退对话与工作区状态，由持久 Change Ledger 驱动（由 dsh-change-ledger 改名）",
		"url": "https://github.com/dsh-external/dsh-turn-rewind",
		"pushedAt": "2026-08-09T12:42:24Z",
		"tags": [
			"session",
			"workspace",
			"tool",
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
		"slug": "dsh-external/dsh-drag-and-drop",
		"name": "dsh-drag-and-drop",
		"description": "拖放文件路径到输入框（macOS）",
		"url": "https://github.com/dsh-external/dsh-drag-and-drop",
		"pushedAt": "2026-08-09T12:26:07Z",
		"tags": ["web-ui", "macos"]
	},
	{
		"slug": "dsh-external/dsh-tui-front-door",
		"name": "dsh-tui-front-door",
		"description": "独立 dsh TUI 前门：ink REPL + 按键绑定引擎 + 会话缝（bundle）",
		"url": "https://github.com/dsh-external/dsh-tui-front-door",
		"pushedAt": "2026-08-09T12:18:31Z",
		"tags": ["tui"]
	},
	{
		"slug": "dsh-external/dsh-101",
		"name": "dsh-101",
		"description": "DSH 文档阅读模式（空仓库占位，分类推断，待填充后复核）",
		"url": "https://github.com/dsh-external/dsh-101",
		"pushedAt": "2026-08-09T12:10:13Z",
		"tags": ["web-ui", "docs"]
	},
	{
		"slug": "dsh-external/sandbox-mxc",
		"name": "sandbox-mxc",
		"description": "微软跨平台沙盒支持",
		"url": "https://github.com/dsh-external/sandbox-mxc",
		"pushedAt": "2026-08-09T12:07:40Z",
		"tags": ["sandbox", "windows"]
	},
	{
		"slug": "dsh-external/dsh-pet",
		"name": "dsh-pet",
		"description": "DSH 桌宠：悬浮桌面小鲸鱼，不打开 DSH 也实时感知会话状态（确认/工作/完成/空闲/离线），音效提醒 + 零代码定制素材",
		"url": "https://github.com/dsh-external/dsh-pet",
		"pushedAt": "2026-08-09T11:56:17Z",
		"tags": ["desktop", "fun"]
	},
	{
		"slug": "dsh-external/dsh-vscode",
		"name": "dsh-vscode",
		"description": "原生 VS Code 聊天集成（Native VS Code chat integration for DeepSeek Harness）",
		"url": "https://github.com/dsh-external/dsh-vscode",
		"pushedAt": "2026-08-09T11:07:25Z",
		"tags": ["vscode", "editor"]
	},
	{
		"slug": "dsh-external/sandbox-micro",
		"name": "sandbox-micro",
		"description": "microsandbox 支持（空仓库，待填充后复核）",
		"url": "https://github.com/dsh-external/sandbox-micro",
		"pushedAt": "2026-08-09T11:00:00Z",
		"tags": ["sandbox"]
	},
	{
		"slug": "dsh-external/ex-setting",
		"name": "ex-setting",
		"description": "DSH 设置扩展",
		"url": "https://github.com/dsh-external/ex-setting",
		"pushedAt": "2026-08-09T10:59:57Z",
		"tags": ["settings"]
	},
	{
		"slug": "dsh-external/web-components",
		"name": "web-components",
		"description": "web-components 支持",
		"url": "https://github.com/dsh-external/web-components",
		"pushedAt": "2026-08-09T10:59:54Z",
		"tags": ["web-ui", "components"]
	},
	{
		"slug": "dsh-external/Qwen-MM-Plugins",
		"name": "Qwen-MM-Plugins",
		"description": "Qwen-MM 多模态 Cordis 插件独立发布目录（packages/qwen/qwen-mm）",
		"url": "https://github.com/dsh-external/Qwen-MM-Plugins",
		"pushedAt": "2026-08-09T10:59:51Z",
		"tags": ["qwen", "mm"]
	},
	{
		"slug": "dsh-external/fabric",
		"name": "fabric",
		"description": "类似 MC Fabric 的 hook 处理器（WIP 占位）",
		"url": "https://github.com/dsh-external/fabric",
		"pushedAt": "2026-08-09T10:59:49Z",
		"tags": ["hooks", "framework"]
	},
	{
		"slug": "dsh-external/dsh-remote-web-ui",
		"name": "dsh-remote-web-ui",
		"description": "手机遥控 dsh web GUI：扫码配对 QR + 一次性配对 token + 实时设备状态 + 可撤销移动会话（bundle）",
		"url": "https://github.com/dsh-external/dsh-remote-web-ui",
		"pushedAt": "2026-08-09T10:43:39Z",
		"tags": [
			"web-ui",
			"mobile",
			"remote"
		]
	},
	{
		"slug": "dsh-external/dsh-paseo",
		"name": "dsh-paseo",
		"description": "DSH 的 paseo 插件扩展支持（空仓库占位，分类推断，待填充后复核）",
		"url": "https://github.com/dsh-external/dsh-paseo",
		"pushedAt": "2026-08-09T10:22:29Z",
		"tags": ["paseo"]
	},
	{
		"slug": "dsh-external/dsh-tps",
		"name": "dsh-tps",
		"description": "Running-turn TPS 徽章：Deep diving 状态行内的实时 tokens-per-second",
		"url": "https://github.com/dsh-external/dsh-tps",
		"pushedAt": "2026-08-09T08:33:48Z",
		"tags": ["web-ui", "metrics"]
	},
	{
		"slug": "dsh-external/dsh-serenity-plugin",
		"name": "dsh-serenity-plugin",
		"description": "宁静号 ACC（Abstract Cognitive Container）DSH 运行时：8 个 acc-* 技能束 + 安装器 CLI（acc-serenity/fs/git/msm/session/eap/neat/kit）",
		"url": "https://github.com/dsh-external/dsh-serenity-plugin",
		"pushedAt": "2026-08-09T08:25:19Z",
		"tags": ["skills", "acc"]
	},
	{
		"slug": "dsh-external/dsh-git-graph",
		"name": "dsh-git-graph",
		"description": "Git graph + branch/workspace context chips（空仓库占位）",
		"url": "https://github.com/dsh-external/dsh-git-graph",
		"pushedAt": "2026-08-09T08:14:49Z",
		"tags": ["web-ui", "git"]
	},
	{
		"slug": "dsh-external/dsh-ui-progress",
		"name": "dsh-ui-progress",
		"description": "任务进度插件：report_progress 动画卡片 + 输入框停靠区常驻进度条",
		"url": "https://github.com/dsh-external/dsh-ui-progress",
		"pushedAt": "2026-08-09T08:05:48Z",
		"tags": ["web-ui", "progress"]
	},
	{
		"slug": "dsh-external/dsh-activity-plugin",
		"name": "dsh-activity-plugin",
		"description": "Activity dashboard：会话视图 Tab 显示跨会话代码与使用统计（自包含 dshClient UI 插件）",
		"url": "https://github.com/dsh-external/dsh-activity-plugin",
		"pushedAt": "2026-08-09T07:43:41Z",
		"tags": ["web-ui", "stats"]
	},
	{
		"slug": "dsh-external/dsh-plugin-check",
		"name": "dsh-plugin-check",
		"description": "插件健康检查：扫描插件仓库的清单协议 / patch 格式 / 构建陷阱 / hub 收录状态，零依赖只读，注册 plugin_check 工具",
		"url": "https://github.com/dsh-external/dsh-plugin-check",
		"pushedAt": "2026-08-09T06:48:02Z",
		"tags": ["tool", "check"]
	},
	{
		"slug": "dsh-external/dsh-toolkit",
		"name": "dsh-toolkit",
		"description": "零依赖工具包 collection：time / encoding / json / calculator / csv / regex 六工具统一入口一键安装",
		"url": "https://github.com/dsh-external/dsh-toolkit",
		"pushedAt": "2026-08-09T06:45:07Z",
		"tags": ["tool"]
	},
	{
		"slug": "dsh-external/dsh-plugin-dev",
		"name": "dsh-plugin-dev",
		"description": "插件开发踩坑与做法档案（skill + 文档）：cordis 双副本、tsconfig 三件套、Windows junction、多帧 zstd 等实测记录",
		"url": "https://github.com/dsh-external/dsh-plugin-dev",
		"pushedAt": "2026-08-09T06:42:19Z",
		"tags": ["skill", "dev"]
	},
	{
		"slug": "dsh-external/dsh-desktop-electron",
		"name": "dsh-desktop-electron",
		"description": "跨平台 Electron 桌面壳：托盘常驻独立窗口运行自己的 dsh web，不捆绑 Node 运行时",
		"url": "https://github.com/dsh-external/dsh-desktop-electron",
		"pushedAt": "2026-08-09T06:40:44Z",
		"tags": ["desktop", "electron"]
	},
	{
		"slug": "dsh-external/dsh-tool-diff",
		"name": "dsh-tool-diff",
		"description": "Diff 工具：文本/JSON/CSV/Markdown 结构化比较与 unified diff，零依赖只读，注册 diff 工具（bundle）",
		"url": "https://github.com/dsh-external/dsh-tool-diff",
		"pushedAt": "2026-08-09T06:38:42Z",
		"tags": ["tool", "diff"]
	},
	{
		"slug": "dsh-external/dsh-session-health",
		"name": "dsh-session-health",
		"description": "会话健康检查：多帧 zstd 会话文件的帧级扫描诊断（torn/损坏/空会话检测），零依赖只读，注册 session_health 工具",
		"url": "https://github.com/dsh-external/dsh-session-health",
		"pushedAt": "2026-08-09T06:38:29Z",
		"tags": ["session", "tool"]
	},
	{
		"slug": "dsh-external/dsh-tool-markdown",
		"name": "dsh-tool-markdown",
		"description": "Markdown 工具：HTML↔Markdown 转换、GFM 表格规范化、目录生成，零依赖轻量解析器，注册 markdown 工具",
		"url": "https://github.com/dsh-external/dsh-tool-markdown",
		"pushedAt": "2026-08-09T06:38:27Z",
		"tags": ["tool", "markdown"]
	},
	{
		"slug": "dsh-external/dsh-tool-regex",
		"name": "dsh-tool-regex",
		"description": "正则工具插件：测试匹配/提取捕获组/安全替换/静态解释（不执行代码），注册 regex 工具",
		"url": "https://github.com/dsh-external/dsh-tool-regex",
		"pushedAt": "2026-08-09T06:38:24Z",
		"tags": ["tool", "regex"]
	},
	{
		"slug": "dsh-external/dsh-tool-csv",
		"name": "dsh-tool-csv",
		"description": "CSV 数据工具插件：解析/查询/统计/转换（RFC 4180 零依赖状态机解析器），注册 csv 工具",
		"url": "https://github.com/dsh-external/dsh-tool-csv",
		"pushedAt": "2026-08-09T06:38:19Z",
		"tags": ["tool", "csv"]
	},
	{
		"slug": "dsh-external/dsh-tool-calculator",
		"name": "dsh-tool-calculator",
		"description": "安全数学表达式求值工具，零依赖递归下降解析器",
		"url": "https://github.com/dsh-external/dsh-tool-calculator",
		"pushedAt": "2026-08-09T06:38:15Z",
		"tags": ["tool"]
	},
	{
		"slug": "dsh-external/dsh-tool-json",
		"name": "dsh-tool-json",
		"description": "JSON 查询工具：JMESPath 子集，零依赖递归下降解析器",
		"url": "https://github.com/dsh-external/dsh-tool-json",
		"pushedAt": "2026-08-09T06:38:11Z",
		"tags": ["tool", "json"]
	},
	{
		"slug": "dsh-external/dsh-tool-encoding",
		"name": "dsh-tool-encoding",
		"description": "编码/转码工具",
		"url": "https://github.com/dsh-external/dsh-tool-encoding",
		"pushedAt": "2026-08-09T06:38:07Z",
		"tags": ["tool"]
	},
	{
		"slug": "dsh-external/dsh-tool-time",
		"name": "dsh-tool-time",
		"description": "时间工具",
		"url": "https://github.com/dsh-external/dsh-tool-time",
		"pushedAt": "2026-08-09T06:38:03Z",
		"tags": ["tool"]
	},
	{
		"slug": "dsh-external/dsh-split-panes",
		"name": "dsh-split-panes",
		"description": "PiUI 风格多面板会话界面：分屏/堆叠面板、每面板独立会话、侧栏会话拖拽",
		"url": "https://github.com/dsh-external/dsh-split-panes",
		"pushedAt": "2026-08-09T04:33:27Z",
		"tags": ["web-ui", "panes"]
	},
	{
		"slug": "dsh-external/dsh-task-board",
		"name": "dsh-task-board",
		"description": "任务看板：侧栏入口 + 多列 kanban，本地持久化，经 dsh session（session.prompt）真实执行",
		"url": "https://github.com/dsh-external/dsh-task-board",
		"pushedAt": "2026-08-09T03:50:32Z",
		"tags": [
			"web-ui",
			"kanban",
			"task"
		]
	},
	{
		"slug": "dsh-external/dsh-paste-input",
		"name": "dsh-paste-input",
		"description": "WebUI 文件输入增强：Ctrl+V 粘贴（首次告知弹窗）+ 拖拽 + 选择文件，发送时复制进工作区临时目录",
		"url": "https://github.com/dsh-external/dsh-paste-input",
		"pushedAt": "2026-08-09T03:01:27Z",
		"tags": ["web-ui", "input"]
	},
	{
		"slug": "dsh-external/dsh-ui-whale",
		"name": "dsh-ui-whale",
		"description": "像素鲸鱼伙伴：标题栏常驻，眨眼/摆尾/动胸鳍，思考时持续动起来，回合完成喷水",
		"url": "https://github.com/dsh-external/dsh-ui-whale",
		"pushedAt": "2026-08-09T03:01:18Z",
		"tags": ["web-ui", "fun"]
	},
	{
		"slug": "dsh-external/dsh-bash-encoding",
		"name": "dsh-bash-encoding",
		"description": "bash 输出编码自动识别：替换 ctx.bash 自管 spawn 收集原始字节，自动检测 UTF-16LE/UTF-8/GBK，修复 WSL/Windows 中文乱码",
		"url": "https://github.com/dsh-external/dsh-bash-encoding",
		"pushedAt": "2026-08-09T03:01:10Z",
		"tags": [
			"bash",
			"tool",
			"encoding"
		]
	},
	{
		"slug": "dsh-external/dsh-input-history",
		"name": "dsh-input-history",
		"description": "Web 输入历史：Ctrl+Up / Ctrl+Down 像终端一样召回与切换已发送消息，零核心改动",
		"url": "https://github.com/dsh-external/dsh-input-history",
		"pushedAt": "2026-08-09T03:01:01Z",
		"tags": [
			"web-ui",
			"input",
			"history"
		]
	},
	{
		"slug": "dsh-external/oh-my-dsh",
		"name": "oh-my-dsh",
		"description": "24 个 feature-gap 插件集合（24/24 gaps closed，plugins/ + swarm/ 多插件工作区）",
		"url": "https://github.com/dsh-external/oh-my-dsh",
		"pushedAt": "2026-08-09T02:59:28Z",
		"tags": ["plugins", "swarm"]
	},
	{
		"slug": "dsh-external/cross-harness-cite",
		"name": "cross-harness-cite",
		"description": "跨 Harness 引用 codex / claude code 的历史对话",
		"url": "https://github.com/dsh-external/cross-harness-cite",
		"pushedAt": "2026-08-09T01:32:09Z",
		"tags": ["cite", "session"]
	},
	{
		"slug": "dsh-external/dsh-auto-approval",
		"name": "dsh-auto-approval",
		"description": "工具调用自动批准插件：approval policy 的 auto 层级，按 allow / deny / ask 分类后分发",
		"url": "https://github.com/dsh-external/dsh-auto-approval",
		"pushedAt": "2026-08-09T01:00:50Z",
		"tags": [
			"approval",
			"tool",
			"safety"
		]
	},
	{
		"slug": "dsh-external/dsh-visualize",
		"name": "dsh-visualize",
		"description": "对话内生成式 UI：模型把交互式 HTML 卡片直接画进会话流（visualize 工具 + 配套 skill + 沙箱渲染卡）",
		"url": "https://github.com/dsh-external/dsh-visualize",
		"pushedAt": "2026-08-08T20:36:44Z",
		"tags": [
			"web-ui",
			"visualize",
			"cordis",
			"deepseek-harness",
			"dsh",
			"dsh-plugin",
			"generative-ui",
			"plugin",
			"visualization"
		]
	},
	{
		"slug": "dsh-external/dsh-win-port",
		"name": "dsh-win-port",
		"description": "Windows 移植",
		"url": "https://github.com/dsh-external/dsh-win-port",
		"pushedAt": "2026-08-08T18:53:25Z",
		"tags": ["windows"]
	},
	{
		"slug": "dsh-external/chat-width",
		"name": "chat-width",
		"description": "自由调节正文与输入框的展示宽度",
		"url": "https://github.com/dsh-external/chat-width",
		"pushedAt": "2026-08-08T18:07:20Z",
		"tags": ["web-ui"]
	},
	{
		"slug": "dsh-external/dsh-gomoku",
		"name": "dsh-gomoku",
		"description": "在 DSH 中与 AI 下五子棋，也可让 AI 对局",
		"url": "https://github.com/dsh-external/dsh-gomoku",
		"pushedAt": "2026-08-08T17:41:40Z",
		"tags": ["game", "fun"]
	},
	{
		"slug": "dsh-external/plugin-registry",
		"name": "plugin-registry",
		"description": "本地插件系统（dsh.plugin.json 协议 + Web 管理面板），内含 4 个可安装示例插件（greeter / loop / navbar 对话节点导航条 / task-status 后台任务状态条）",
		"url": "https://github.com/dsh-external/plugin-registry",
		"pushedAt": "2026-08-08T16:31:08Z",
		"tags": [
			"manager",
			"protocol",
			"examples"
		]
	},
	{
		"slug": "dsh-external/DSH-UI4A",
		"name": "DSH-UI4A",
		"description": "UI4A（UI for Agent）的 DSH 实现（macaron-ui4a-interactive-ai）",
		"url": "https://github.com/dsh-external/DSH-UI4A",
		"pushedAt": "2026-08-08T15:00:50Z",
		"tags": ["web-ui", "ui"]
	},
	{
		"slug": "dsh-external/dsh-session-cluster",
		"name": "dsh-session-cluster",
		"description": "同机跨会话消息（ListAgents/SendMessage 的 DSH 版）",
		"url": "https://github.com/dsh-external/dsh-session-cluster",
		"pushedAt": "2026-08-08T14:32:07Z",
		"tags": ["session", "messaging"]
	},
	{
		"slug": "dsh-external/dsh-stickers",
		"name": "dsh-stickers",
		"description": "WebUI sticker 插件：用户与 agent 双向反应",
		"url": "https://github.com/dsh-external/dsh-stickers",
		"pushedAt": "2026-08-08T14:16:38Z",
		"tags": ["web-ui", "fun"]
	},
	{
		"slug": "dsh-external/dsh-plus",
		"name": "dsh-plus",
		"description": "DeepSeek Harness Plus：精选插件清单与安装器（curated plugin manifest and installer）",
		"url": "https://github.com/dsh-external/dsh-plus",
		"pushedAt": "2026-08-08T14:14:17Z",
		"tags": ["manifest", "installer"]
	},
	{
		"slug": "dsh-external/dsh-reuse-first",
		"name": "dsh-reuse-first",
		"description": "reuse-first 技能（复用优先；skills/ 目录）",
		"url": "https://github.com/dsh-external/dsh-reuse-first",
		"pushedAt": "2026-08-08T14:04:29Z",
		"tags": ["skill", "reuse"]
	},
	{
		"slug": "dsh-external/dsh-desktop-tools",
		"name": "dsh-desktop-tools",
		"description": "DSH 桌面工具集：一键启动、自动升级、开机自启、PWA 可安装补丁（内测私有）",
		"url": "https://github.com/dsh-external/dsh-desktop-tools",
		"pushedAt": "2026-08-08T13:43:53Z",
		"tags": ["desktop", "tools"]
	},
	{
		"slug": "dsh-external/deep-standard-skill",
		"name": "deep-standard-skill",
		"description": "可执行工程标准体系技能（skill 目录结构）",
		"url": "https://github.com/dsh-external/deep-standard-skill",
		"pushedAt": "2026-08-08T13:11:25Z",
		"tags": [
			"skill",
			"engineering",
			"standard"
		]
	},
	{
		"slug": "dsh-external/dsh-client-ui-plan-execute",
		"name": "dsh-client-ui-plan-execute",
		"description": "Web 设置页「规划/执行模型」设置行插件：编辑 dsh-plan-execute 双模型路由（官方 dsh-client-* bundle）",
		"url": "https://github.com/dsh-external/dsh-client-ui-plan-execute",
		"pushedAt": "2026-08-08T11:58:21Z",
		"tags": [
			"web-ui",
			"settings",
			"llm"
		]
	},
	{
		"slug": "dsh-external/dsh-crew",
		"name": "dsh-crew",
		"description": "YAML 驱动的多 agent 编排工具（Your AI crew, one YAML away；bin/dsh-crew.mjs + code-review 模板）",
		"url": "https://github.com/dsh-external/dsh-crew",
		"pushedAt": "2026-08-08T11:20:59Z",
		"tags": [
			"crew",
			"orchestration",
			"workflow"
		]
	},
	{
		"slug": "dsh-external/dsh-plan-execute",
		"name": "dsh-plan-execute",
		"description": "plan/execute 双模型路由：plan 模式用规划模型（推理型），批准后自动切执行模型（快速型），settings.yaml 与 Web 设置页可配置",
		"url": "https://github.com/dsh-external/dsh-plan-execute",
		"pushedAt": "2026-08-08T10:32:47Z",
		"tags": ["llm", "workflow"]
	},
	{
		"slug": "dsh-external/session-chatlog",
		"name": "session-chatlog",
		"description": "会话聊天记录读取（session_list / session_read_chat）",
		"url": "https://github.com/dsh-external/session-chatlog",
		"pushedAt": "2026-08-08T09:23:26Z",
		"tags": ["marisa-plugin", "session"]
	},
	{
		"slug": "dsh-external/dsh-lazyfish",
		"name": "dsh-lazyfish",
		"description": "右侧摸鱼面板：多源信息流 + B站播放器 + 任务联动（Lazy Fish = 摸鱼）",
		"url": "https://github.com/dsh-external/dsh-lazyfish",
		"pushedAt": "2026-08-08T09:21:44Z",
		"tags": ["web-ui", "fun"]
	},
	{
		"slug": "dsh-external/dsh-git-identity",
		"name": "dsh-git-identity",
		"description": "git 提交固定使用环境自身作者身份（优先 gh CLI 账号 + noreply 邮箱），GIT_AUTHOR_*/GIT_COMMITTER_* 注入压过 git config",
		"url": "https://github.com/dsh-external/dsh-git-identity",
		"pushedAt": "2026-08-08T09:15:53Z",
		"tags": ["git", "tool"]
	},
	{
		"slug": "dsh-external/dsh-android",
		"name": "dsh-android",
		"description": "在 Android 设备上运行 dsh",
		"url": "https://github.com/dsh-external/dsh-android",
		"pushedAt": "2026-08-08T09:01:56Z",
		"tags": ["android", "mobile"]
	},
	{
		"slug": "dsh-external/dsh-web-archive",
		"name": "dsh-web-archive",
		"description": "折叠对话中的无用消息（Think / Bash 等）",
		"url": "https://github.com/dsh-external/dsh-web-archive",
		"pushedAt": "2026-08-08T07:08:51Z",
		"tags": ["web-ui", "archive"]
	},
	{
		"slug": "dsh-external/zotero-harvest",
		"name": "zotero-harvest",
		"description": "Zotero 文献采集入库插件：多源检索（OpenAlex/arXiv/Crossref/Europe PMC/Semantic Scholar）+ OA 下载解析（Unpaywall）+ 充分性审计 + 入库本地 Zotero + 触发 zotero-wave-rag 重建",
		"url": "https://github.com/dsh-external/zotero-harvest",
		"pushedAt": "2026-08-08T06:06:20Z",
		"tags": [
			"zotero",
			"rag",
			"research"
		]
	},
	{
		"slug": "dsh-external/dsh-grok-tui",
		"name": "dsh-grok-tui",
		"description": "通过 grok-build 的 TUI 使用 dsh（WIP 占位）",
		"url": "https://github.com/dsh-external/dsh-grok-tui",
		"pushedAt": "2026-08-08T03:49:51Z",
		"tags": ["tui"]
	},
	{
		"slug": "dsh-external/dsh-feishu-notify",
		"name": "dsh-feishu-notify",
		"description": "飞书通知：会话结束 / 需要等待输入",
		"url": "https://github.com/dsh-external/dsh-feishu-notify",
		"pushedAt": "2026-08-08T02:40:49Z",
		"tags": ["notify", "feishu"]
	},
	{
		"slug": "dsh-external/dsh-sfw",
		"name": "dsh-sfw",
		"description": "防社死 WIP：遮挡内测界面内容",
		"url": "https://github.com/dsh-external/dsh-sfw",
		"pushedAt": "2026-08-08T02:11:01Z",
		"tags": ["fun"]
	},
	{
		"slug": "dsh-external/dsh-skins",
		"name": "dsh-skins",
		"description": "Web 换肤插件仓库：ThemeService 第三方皮肤",
		"url": "https://github.com/dsh-external/dsh-skins",
		"pushedAt": "2026-08-08T01:57:05Z",
		"tags": ["web-ui", "theme"]
	},
	{
		"slug": "dsh-external/dsh-side-panel",
		"name": "dsh-side-panel",
		"description": "DSH 侧边栏：集成文件浏览器、终端和 Git 审查（与 DSH-better-sidebar 功能重叠）",
		"url": "https://github.com/dsh-external/dsh-side-panel",
		"pushedAt": "2026-08-07T21:47:02Z",
		"tags": ["web-ui", "sidebar"]
	},
	{
		"slug": "dsh-external/official-plugins-port",
		"name": "official-plugins-port",
		"description": "官方 Claude Code / Codex 插件移植到 DSH 插件协议（23 个插件）",
		"url": "https://github.com/dsh-external/official-plugins-port",
		"pushedAt": "2026-08-07T19:03:59Z",
		"tags": [
			"port",
			"claude-code",
			"codex"
		]
	},
	{
		"slug": "dsh-external/dsh-web-workflow-visualizer",
		"name": "dsh-web-workflow-visualizer",
		"description": "Web GUI 的 Workflow 可视化 + 图工程插件：多 agent 动态工作流白板化编辑与脚本生成",
		"url": "https://github.com/dsh-external/dsh-web-workflow-visualizer",
		"pushedAt": "2026-08-07T17:20:42Z",
		"tags": ["web-ui", "workflow"]
	},
	{
		"slug": "dsh-external/dsh-ica",
		"name": "dsh-ica",
		"description": "dsh 接 icalingua（QQ 客户端）前端（推断：IM 渠道，待作者确认）",
		"url": "https://github.com/dsh-external/dsh-ica",
		"pushedAt": "2026-08-07T17:13:42Z",
		"tags": ["qq", "im"]
	},
	{
		"slug": "dsh-external/dsh-advisor",
		"name": "dsh-advisor",
		"description": "副模型被动审查每一轮对话并注入见解（Advisor）",
		"url": "https://github.com/dsh-external/dsh-advisor",
		"pushedAt": "2026-08-07T16:48:50Z",
		"tags": ["llm", "review"]
	},
	{
		"slug": "dsh-external/marisa",
		"name": "marisa",
		"description": "外部插件管理器（dshx）：topic 自动发现 + 安装/启停/面板",
		"url": "https://github.com/dsh-external/marisa",
		"pushedAt": "2026-08-07T16:29:27Z",
		"tags": [
			"manager",
			"cli",
			"web-ui"
		]
	},
	{
		"slug": "dsh-external/dsh-session-repair-skill",
		"name": "dsh-session-repair-skill",
		"description": "检测并修复损坏的 dsh session 历史日志（多客户端并发写 seq 损坏：stale-tail / stale-counter）",
		"url": "https://github.com/dsh-external/dsh-session-repair-skill",
		"pushedAt": "2026-08-07T16:01:51Z",
		"tags": [
			"skill",
			"session",
			"repair"
		]
	},
	{
		"slug": "dsh-external/dsh-issue-like-skill",
		"name": "dsh-issue-like-skill",
		"description": "dsh-issue-like skill：对 dsh-external/issues 的 issue 点 👍（org 内，仅 like）",
		"url": "https://github.com/dsh-external/dsh-issue-like-skill",
		"pushedAt": "2026-08-07T15:21:25Z",
		"tags": ["skill", "github"]
	},
	{
		"slug": "dsh-external/issues",
		"name": "issues",
		"description": "官方 issue 反馈专用仓库（内测问题追踪）",
		"url": "https://github.com/dsh-external/issues",
		"pushedAt": "2026-08-07T14:17:23Z",
		"tags": ["issues"]
	},
	{
		"slug": "dsh-external/dsh-remote",
		"name": "dsh-remote",
		"description": "类似 Codex APP 的通过 SSH 控制远端机器能力",
		"url": "https://github.com/dsh-external/dsh-remote",
		"pushedAt": "2026-08-07T13:54:48Z",
		"tags": ["remote", "ssh"]
	},
	{
		"slug": "dsh-external/dsh-live-stats",
		"name": "dsh-live-stats",
		"description": "Live I/O token 估算与生成 TPS",
		"url": "https://github.com/dsh-external/dsh-live-stats",
		"pushedAt": "2026-08-07T13:36:42Z",
		"tags": ["web-ui", "metrics"]
	},
	{
		"slug": "dsh-external/dsh-session-search",
		"name": "dsh-session-search",
		"description": "跨工具会话全文搜索（dsh/codex/claude/pi/opencode）",
		"url": "https://github.com/dsh-external/dsh-session-search",
		"pushedAt": "2026-08-07T13:25:56Z",
		"tags": [
			"session",
			"search",
			"marisa-plugin"
		]
	},
	{
		"slug": "dsh-external/dsh-sidechain",
		"name": "dsh-sidechain",
		"description": "侧会话插件：/side 与 /btw 在当前会话的临时 fork 里开侧会话（对齐 Codex /side & /btw）",
		"url": "https://github.com/dsh-external/dsh-sidechain",
		"pushedAt": "2026-08-07T13:21:06Z",
		"tags": [
			"side-session",
			"chat",
			"codex",
			"cordis",
			"deepseek-harness",
			"dsh",
			"dsh-plugin",
			"plugin",
			"side-conversation",
			"sidechain"
		]
	},
	{
		"slug": "dsh-external/deepseek-harness-distro",
		"name": "deepseek-harness-distro",
		"description": "自定义发行版",
		"url": "https://github.com/dsh-external/deepseek-harness-distro",
		"pushedAt": "2026-08-07T10:18:39Z",
		"tags": ["distro"]
	},
	{
		"slug": "dsh-external/dsh-nowledge-mem",
		"name": "dsh-nowledge-mem",
		"description": "Nowledge Mem™ 接入插件（DSH plugin for Nowledge Mem）",
		"url": "https://github.com/dsh-external/dsh-nowledge-mem",
		"pushedAt": "2026-08-07T09:29:01Z",
		"tags": ["memory"]
	},
	{
		"slug": "dsh-external/ego-browser",
		"name": "ego-browser",
		"description": "ego-lite 浏览器接入 HARNESS：13 个结构化 ego_* 工具（语义快照/定位点击/表单/截图/CDP/任务空间隔离），内置 ego 运行时",
		"url": "https://github.com/dsh-external/ego-browser",
		"pushedAt": "2026-08-07T08:27:17Z",
		"tags": [
			"browser",
			"automation",
			"agent-browser",
			"browser-automation",
			"dsh-plugin",
			"dshx",
			"ego-lite"
		]
	},
	{
		"slug": "dsh-external/dsh-prompt-studio",
		"name": "dsh-prompt-studio",
		"description": "提示词编辑器（Prompt Studio）：编辑用户与内置 system-prompt 段落，实时预览",
		"url": "https://github.com/dsh-external/dsh-prompt-studio",
		"pushedAt": "2026-08-07T08:06:18Z",
		"tags": ["prompt", "web-ui"]
	},
	{
		"slug": "dsh-external/dsh-web-panel",
		"name": "dsh-web-panel",
		"description": "Web UI 内嵌交互式终端（xterm.js + node-pty，issues#111；由 dsh-web-terminal 改名）：底部终端 + 侧边栏代码审查",
		"url": "https://github.com/dsh-external/dsh-web-panel",
		"pushedAt": "2026-08-07T07:56:03Z",
		"tags": ["web-ui", "terminal"]
	},
	{
		"slug": "dsh-external/onboarding",
		"name": "onboarding",
		"description": "内测入门引导（Private onboarding hub for beta testers）",
		"url": "https://github.com/dsh-external/onboarding",
		"pushedAt": "2026-08-07T07:42:21Z",
		"tags": ["onboarding"]
	},
	{
		"slug": "dsh-external/deepseek-harness-desktop",
		"name": "deepseek-harness-desktop",
		"description": "桌面端（TypeScript / SEA）",
		"url": "https://github.com/dsh-external/deepseek-harness-desktop",
		"pushedAt": "2026-08-07T06:21:41Z",
		"tags": [
			"desktop",
			"typescript",
			"deekseek-harness",
			"desktop-app",
			"linux",
			"macos"
		]
	},
	{
		"slug": "dsh-external/dsh-inspect",
		"name": "dsh-inspect",
		"description": "对抗式闭环插件：检查(checkup) → 修复(fix) → 复查(review)，基于官方 workflow 引擎",
		"url": "https://github.com/dsh-external/dsh-inspect",
		"pushedAt": "2026-08-07T04:22:23Z",
		"tags": ["tool", "workflow"]
	},
	{
		"slug": "dsh-external/dsh-deep-research",
		"name": "dsh-deep-research",
		"description": "自适应深度研究编排插件（官方工作流引擎，控制论/信息论设计）",
		"url": "https://github.com/dsh-external/dsh-deep-research",
		"pushedAt": "2026-08-07T04:22:08Z",
		"tags": ["research", "tool"]
	},
	{
		"slug": "dsh-external/zotero-wave-rag",
		"name": "zotero-wave-rag",
		"description": "面向 Zotero 论文库的浪潮式 RAG 细节检索系统（浪潮语义动力学 + BM25+RRF 混合检索 + claim-evidence 校验 + 两级增量索引）",
		"url": "https://github.com/dsh-external/zotero-wave-rag",
		"pushedAt": "2026-08-07T03:53:17Z",
		"tags": [
			"rag",
			"zotero",
			"dsh-plugin",
			"marisa-plugin",
			"typescript"
		]
	},
	{
		"slug": "dsh-external/dsh-multimedia-webui-input",
		"name": "dsh-multimedia-webui-input",
		"description": "WebUI 多媒体文件/文件夹输入（发送时复制进工作区）",
		"url": "https://github.com/dsh-external/dsh-multimedia-webui-input",
		"pushedAt": "2026-08-07T02:28:35Z",
		"tags": ["web-ui", "multimedia"]
	},
	{
		"slug": "dsh-external/dsh-pi-adapter",
		"name": "dsh-pi-adapter",
		"description": "把 pi coding-agent 扩展（ExtensionAPI）桥接进 DSH 的 cordis 插件",
		"url": "https://github.com/dsh-external/dsh-pi-adapter",
		"pushedAt": "2026-08-07T01:29:55Z",
		"tags": [
			"pi",
			"bridge",
			"dsh-plugin",
			"marisa-plugin"
		]
	},
	{
		"slug": "dsh-external/dsh-alphasolve",
		"name": "dsh-alphasolve",
		"description": "Session 级 AlphaSolve 工作流（DeepSeek Harness）",
		"url": "https://github.com/dsh-external/dsh-alphasolve",
		"pushedAt": "2026-08-06T23:50:05Z",
		"tags": ["workflow", "tool"]
	},
	{
		"slug": "dsh-external/dsh-message-edit",
		"name": "dsh-message-edit",
		"description": "分支式消息编辑：reroll / retry / 版本时间线",
		"url": "https://github.com/dsh-external/dsh-message-edit",
		"pushedAt": "2026-08-06T17:25:41Z",
		"tags": ["web-ui", "edit"]
	},
	{
		"slug": "dsh-external/dsh-web-ui-notify",
		"name": "dsh-web-ui-notify",
		"description": "为 DSH 增加桌面通知提醒",
		"url": "https://github.com/dsh-external/dsh-web-ui-notify",
		"pushedAt": "2026-08-06T17:07:02Z",
		"tags": ["web-ui", "notify"]
	},
	{
		"slug": "dsh-external/turtle-ui",
		"name": "turtle-ui",
		"description": "dsh 最早的 TUI 实现独立仓库（原 packages/ui/tui，经 pnpm link 接入源码安装的 dsh）",
		"url": "https://github.com/dsh-external/turtle-ui",
		"pushedAt": "2026-08-06T16:43:54Z",
		"tags": ["tui", "ui"]
	},
	{
		"slug": "dsh-external/telegram",
		"name": "telegram",
		"description": "Telegram Bot API 桥接（长轮询、per-chat 会话）",
		"url": "https://github.com/dsh-external/telegram",
		"pushedAt": "2026-08-06T16:21:50Z",
		"tags": ["marisa-plugin", "channel"]
	},
	{
		"slug": "dsh-external/distill",
		"name": "distill",
		"description": "自动对话蒸馏：后台 subagent 反省 + 技能 create/update",
		"url": "https://github.com/dsh-external/distill",
		"pushedAt": "2026-08-06T16:21:45Z",
		"tags": ["marisa-plugin", "skill"]
	},
	{
		"slug": "dsh-external/dsh-pty-windows",
		"name": "dsh-pty-windows",
		"description": "Windows PTY 进程检查器（PowerShell CIM + kill 探针）",
		"url": "https://github.com/dsh-external/dsh-pty-windows",
		"pushedAt": "2026-08-06T16:21:40Z",
		"tags": [
			"marisa-plugin",
			"windows",
			"pty"
		]
	},
	{
		"slug": "dsh-external/dsh-browser",
		"name": "dsh-browser",
		"description": "Chrome 侧边栏拓展：直接操作浏览器",
		"url": "https://github.com/dsh-external/dsh-browser",
		"pushedAt": "2026-08-06T15:58:31Z",
		"tags": ["browser", "chrome"]
	},
	{
		"slug": "dsh-external/dsh-shell-windows",
		"name": "dsh-shell-windows",
		"description": "Windows PowerShell 外壳适配器（ctx.shell, win32）",
		"url": "https://github.com/dsh-external/dsh-shell-windows",
		"pushedAt": "2026-08-06T15:42:19Z",
		"tags": [
			"marisa-plugin",
			"windows",
			"shell"
		]
	},
	{
		"slug": "dsh-external/dsh-skills-manager",
		"name": "dsh-skills-manager",
		"description": "WebUI 中列出 / 禁用启用 / 编辑 skills",
		"url": "https://github.com/dsh-external/dsh-skills-manager",
		"pushedAt": "2026-08-06T14:00:52Z",
		"tags": ["web-ui", "skills"]
	},
	{
		"slug": "dsh-external/dsh-evolve",
		"name": "dsh-evolve",
		"description": "自进化插件：agent 在 session 内随对话给自己长出/剪掉能力（evolve_add 热挂载 / evolve_remove 可逆卸载，重启自动恢复）",
		"url": "https://github.com/dsh-external/dsh-evolve",
		"pushedAt": "2026-08-06T11:41:01Z",
		"tags": [
			"evolve",
			"tool",
			"dsh",
			"marisa-plugin"
		]
	},
	{
		"slug": "dsh-external/dsh-public-repo-monitor",
		"name": "dsh-public-repo-monitor",
		"description": "组织公开仓库监控（Rust）",
		"url": "https://github.com/dsh-external/dsh-public-repo-monitor",
		"pushedAt": "2026-08-06T10:30:31Z",
		"tags": [
			"rust",
			"automation",
			"org"
		]
	},
	{
		"slug": "dsh-external/dsh-desktop-mac",
		"name": "dsh-desktop-mac",
		"description": "macOS 桌面端（Swift）",
		"url": "https://github.com/dsh-external/dsh-desktop-mac",
		"pushedAt": "2026-08-06T10:24:07Z",
		"tags": ["desktop", "macos"]
	},
	{
		"slug": "dsh-external/repo-visibility-guard",
		"name": "repo-visibility-guard",
		"description": "自动修复组织内公开仓库（visibility guard）",
		"url": "https://github.com/dsh-external/repo-visibility-guard",
		"pushedAt": "2026-08-06T07:22:41Z",
		"tags": ["automation", "org"]
	},
	{
		"slug": "dsh-external/dsh-island",
		"name": "dsh-island",
		"description": "macOS Dynamic Island 刘海面板（codeisland 复刻），DSH 桌面辅助",
		"url": "https://github.com/dsh-external/dsh-island",
		"pushedAt": "2026-08-06T03:41:44Z",
		"tags": ["macos", "desktop"]
	},
	{
		"slug": "dsh-external/dsh-working-activity",
		"name": "dsh-working-activity",
		"description": "实时模型工作状态行（俏皮文案/工具/回合总结）",
		"url": "https://github.com/dsh-external/dsh-working-activity",
		"pushedAt": "2026-08-05T14:02:48Z",
		"tags": ["web-ui", "tui"]
	},
	{
		"slug": "dsh-external/dsh-companion",
		"name": "dsh-companion",
		"description": "常驻桌面助手：全局唤起 / 定时自动化 / 快捷回复 / 插件市场",
		"url": "https://github.com/dsh-external/dsh-companion",
		"pushedAt": "2026-08-05T11:09:55Z",
		"tags": [
			"desktop",
			"tauri",
			"dsh"
		]
	},
	{
		"slug": "dsh-external/dsh-subagent-tree",
		"name": "dsh-subagent-tree",
		"description": "工作区侧栏树：子代理分支（会话行扩展 hole）",
		"url": "https://github.com/dsh-external/dsh-subagent-tree",
		"pushedAt": "2026-08-05T07:39:19Z",
		"tags": ["web-ui"]
	},
	{
		"slug": "dsh-external/dsh-artifact",
		"name": "dsh-artifact",
		"description": "文件交付协议：send_artifact 工具经 tool/result meta 携带结构化描述子",
		"url": "https://github.com/dsh-external/dsh-artifact",
		"pushedAt": "2026-08-05T07:38:03Z",
		"tags": [
			"artifact",
			"tool",
			"dsh",
			"marisa-plugin"
		]
	},
	{
		"slug": "dsh-external/dsh-vision",
		"name": "dsh-vision",
		"description": "view_image 工具桥接任意 OpenAI 兼容 VLM",
		"url": "https://github.com/dsh-external/dsh-vision",
		"pushedAt": "2026-08-05T07:37:31Z",
		"tags": [
			"marisa-plugin",
			"vision",
			"tool",
			"dsh"
		]
	},
	{
		"slug": "dsh-external/dsh-opencode-server",
		"name": "dsh-opencode-server",
		"description": "opencode 桥接插件：为 dsh web 实现 opencode API 最小子集，opencode attach 即得丝滑 TUI",
		"url": "https://github.com/dsh-external/dsh-opencode-server",
		"pushedAt": "2026-08-05T04:11:42Z",
		"tags": ["opencode", "tui"]
	},
	{
		"slug": "dsh-external/dsh-agent-session-sources",
		"name": "dsh-agent-session-sources",
		"description": "agent-session dock + Claude/Codex 浏览器源码贡献",
		"url": "https://github.com/dsh-external/dsh-agent-session-sources",
		"pushedAt": "2026-08-05T04:04:31Z",
		"tags": ["session", "sources"]
	},
	{
		"slug": "dsh-external/dsh-gh-bridge",
		"name": "dsh-gh-bridge",
		"description": "macOS Keychain GitHub token 桥接进 gh hosts.yml",
		"url": "https://github.com/dsh-external/dsh-gh-bridge",
		"pushedAt": "2026-08-05T03:31:21Z",
		"tags": ["github", "tool"]
	},
	{
		"slug": "dsh-external/dsh-issue-filer",
		"name": "dsh-issue-filer",
		"description": "提 issue 技能：查重 + 格式化 + 本地台账",
		"url": "https://github.com/dsh-external/dsh-issue-filer",
		"pushedAt": "2026-08-05T03:29:21Z",
		"tags": ["skill", "github"]
	},
	{
		"slug": "dsh-external/dsh-acp",
		"name": "dsh-acp",
		"description": "Client-neutral ACP adapter",
		"url": "https://github.com/dsh-external/dsh-acp",
		"pushedAt": "2026-08-05T02:47:34Z",
		"tags": ["acp", "protocol"]
	},
	{
		"slug": "dsh-external/dshx-update-check",
		"name": "dshx-update-check",
		"description": "commit SHA 对比检测插件更新（只检测不自动更新）",
		"url": "https://github.com/dsh-external/dshx-update-check",
		"pushedAt": "2026-08-05T01:50:27Z",
		"tags": ["marisa-plugin", "update"]
	},
	{
		"slug": "dsh-external/dsh-desktop",
		"name": "dsh-desktop",
		"description": "桌面端（Go + 系统托盘）",
		"url": "https://github.com/dsh-external/dsh-desktop",
		"pushedAt": "2026-08-04T23:13:12Z",
		"tags": ["desktop", "go"]
	},
	{
		"slug": "dsh-external/dsh-github-integration",
		"name": "dsh-github-integration",
		"description": "GitHub 修复战役工作流 skill + packages/github 工具源码",
		"url": "https://github.com/dsh-external/dsh-github-integration",
		"pushedAt": "2026-08-04T23:05:28Z",
		"tags": [
			"github",
			"skill",
			"tool"
		]
	},
	{
		"slug": "dsh-external/dsh-tool-browser",
		"name": "dsh-tool-browser",
		"description": "SDK 私有快照 + browser-control 插件",
		"url": "https://github.com/dsh-external/dsh-tool-browser",
		"pushedAt": "2026-08-04T23:04:57Z",
		"tags": ["tool", "browser"]
	},
	{
		"slug": "dsh-external/review-panel",
		"name": "review-panel",
		"description": "内测审查面板",
		"url": "https://github.com/dsh-external/review-panel",
		"pushedAt": "2026-08-04T19:05:56Z",
		"tags": ["review"]
	},
	{
		"slug": "dsh-external/toybox",
		"name": "toybox",
		"description": "插件玩具箱：8 个 MCP/skill（代码考古学家等）",
		"url": "https://github.com/dsh-external/toybox",
		"pushedAt": "2026-08-04T17:09:25Z",
		"tags": [
			"fun",
			"mcp",
			"skill"
		]
	},
	{
		"slug": "dsh-external/tg-bot",
		"name": "tg-bot",
		"description": "Telegram remote channel",
		"url": "https://github.com/dsh-external/tg-bot",
		"pushedAt": "2026-08-04T16:21:52Z",
		"tags": [
			"telegram",
			"ai-agent",
			"coding-agent",
			"cordis",
			"deepseek",
			"telegram-bot"
		]
	},
	{
		"slug": "dsh-external/Recall",
		"name": "Recall",
		"description": "独立 Rust 工具：切换 agent 保留记忆，本地优先搜索 AI 编码会话",
		"url": "https://github.com/dsh-external/Recall",
		"pushedAt": "2026-08-03T02:14:52Z",
		"tags": [
			"rust",
			"search",
			"memory",
			"local-first"
		]
	}
];
//#endregion
//#region src/catalog.ts
/**
* Reading the plugin hub.
*
* `dsh-external/hub` is a private repository, so there is no anonymous URL to
* fetch: every path here spends someone's GitHub credentials. Three are tried
* in order of how likely they are to be both present and current — the `gh`
* CLI, which every hub member already has authenticated; a token from the
* environment, for headless hosts; and finally the snapshot baked in at build
* time, which is stale but always works and keeps the ad layer from depending
* on the network to have anything to show.
*
* @module
*/
const execFileAsync = promisify(execFile);
/** Owner/repo of the hub catalog. */
const HUB_REPO = "dsh-external/hub";
/** Path of the catalog within the hub. */
const HUB_PATH = "catalog.json";
/** Cap on the fetched catalog, in bytes; the real one is ~140 KB. */
const MAX_CATALOG_BYTES = 8388608;
/**
* Narrow one hub record into a sponsor, or reject it.
*
* Hidden and empty repositories are dropped because the hub already marks them
* as not worth showing; anything missing a name or URL is dropped because an
* advertisement nobody can act on is just noise.
*
* @param raw - one entry of the catalog's `repos` array.
* @param owner - hub owner, used to build the `<owner>/<repo>` slug.
* @returns the sponsor, or undefined when the entry is not advertisable.
*/
function toSponsor(raw, owner) {
	if (typeof raw !== "object" || raw === null) return void 0;
	const repo = raw;
	if (repo.hide === true || repo.empty === true) return void 0;
	const name = typeof repo.name === "string" ? repo.name : "";
	const url = typeof repo.url === "string" ? repo.url : "";
	if (name === "" || url === "") return void 0;
	const note = typeof repo.note === "string" ? repo.note : "";
	const description = typeof repo.description === "string" ? repo.description : "";
	return {
		slug: `${owner}/${name}`,
		name,
		description: note !== "" ? note : description,
		url,
		pushedAt: typeof repo.pushedAt === "string" ? repo.pushedAt : "",
		tags: Array.isArray(repo.tags) ? repo.tags.filter((tag) => typeof tag === "string") : []
	};
}
/**
* Parse a catalog document into sponsors.
* @param text - the raw `catalog.json` body.
* @param owner - hub owner, for slugs.
* @returns every advertisable plugin, in hub order.
*/
function parseCatalog(text, owner) {
	const repos = JSON.parse(text)?.repos;
	if (!Array.isArray(repos)) return [];
	const out = [];
	for (const raw of repos) {
		const sponsor = toSponsor(raw, owner);
		if (sponsor !== void 0) out.push(sponsor);
	}
	return out;
}
/**
* Keep the plugins pushed within the freshness window.
*
* The window is a window rather than a top-N because exposure must not depend
* on who happened to have a session open when someone pushed: everyone who
* shipped this fortnight is eligible, and which of them a given user sees is
* the browser's fairness ledger to decide.
*
* It is anchored to the newest push *in the list*, not to the wall clock. A
* live catalog makes the two identical, and a baked snapshot months old still
* yields its own last fortnight instead of yielding nothing at all — which is
* the only way the offline fallback is worth having.
*
* @param plugins - candidates.
* @param freshDays - window width in days; zero or less keeps everything.
* @param excludeSlug - a plugin to drop, normally this one — an ad layer that
* advertises itself takes a slot away from someone who did not write it.
* @returns the eligible subset.
*/
function selectFresh(plugins, freshDays, excludeSlug) {
	const dated = plugins.filter((plugin) => plugin.slug !== excludeSlug).map((plugin) => ({
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
* Read the catalog through the `gh` CLI.
* @returns the raw document body.
* @throws when `gh` is absent, unauthenticated, or denied access to the hub.
*/
async function readViaGh() {
	const { stdout } = await execFileAsync("gh", [
		"api",
		`repos/${HUB_REPO}/contents/${HUB_PATH}`,
		"-H",
		"Accept: application/vnd.github.raw"
	], {
		maxBuffer: MAX_CATALOG_BYTES,
		timeout: 2e4
	});
	return stdout;
}
/**
* Read the catalog with a token from the environment.
* @param token - a GitHub token with read access to the hub.
* @returns the raw document body.
* @throws when GitHub refuses the request.
*/
async function readViaToken(token) {
	const response = await fetch(`https://api.github.com/repos/${HUB_REPO}/contents/${HUB_PATH}`, { headers: {
		accept: "application/vnd.github.raw",
		authorization: `Bearer ${token}`
	} });
	if (!response.ok) throw new Error(`GitHub responded ${response.status}`);
	return await response.text();
}
/**
* Assemble the payload the browser half consumes.
*
* Never throws: the last resort is the baked snapshot, and a plugin whose only
* job is to put jokes on screen must not be able to fail a page.
*
* @param nowMs - current epoch time.
* @param freshDays - freshness window in days.
* @param excludeSlug - plugin to leave out of its own rotation.
* @returns the sponsor list, tagged with where it came from.
*/
async function loadRegistry(nowMs, freshDays, excludeSlug) {
	const owner = HUB_REPO.split("/")[0] ?? "dsh-external";
	const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN ?? "";
	const attempts = [{
		source: "gh-cli",
		read: readViaGh
	}, ...token === "" ? [] : [{
		source: "github-token",
		read: () => readViaToken(token)
	}]];
	for (const attempt of attempts) try {
		const plugins = parseCatalog(await attempt.read(), owner);
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
//#region src/index.ts
/** Host capabilities required for the dynamic tier. */
const inject = ["httpServer"];
/** Freshness window: a fortnight is long enough that a weekend release still gets seen. */
const DEFAULT_FRESH_DAYS = 14;
/** Catalog reuse window; the hub regenerates far more slowly than this. */
const DEFAULT_CACHE_MINUTES = 30;
/** This plugin's own slug, kept out of its own rotation. */
const SELF_SLUG = "dsh-external/dsh-ads";
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
	ctx.effect(() => ctx.httpServer.register({
		kind: "exact",
		path: REGISTRY_ROUTE,
		handler: async (_req, res) => {
			json(res, await resolve());
		}
	}));
}
//#endregion
export { apply, inject };
