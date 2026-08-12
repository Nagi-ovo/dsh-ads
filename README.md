# dsh-ads

给 DSH Web UI 糊上一层 2005 年的中文站点广告：正文两侧的广告栏、对话里的信息流、右下角"叮"一声弹出的消息窗、左下角的《贪玩蓝鲸》。

每个 ✕ 都是画出来 16–20px，真正能点中的只有里面偏了位的 4–7px。点歪了整屏放大给你看——左下角那张会直接开始播视频。

![正文两侧的广告栏、对话内的信息流广告、左下角《贪玩蓝鲸》海报、右下角「DSH 消息中心」弹窗](assets/screenshot.webp)

输入框、会话列表、顶部标签栏都不挡，官方弹窗一打开整层自动让位。「关闭所有广告」是这里唯一说真话的按钮，点一次到刷新为止。

除了侧栏，还有：进页面就弹的**跑分中心**（启动耗时是真测的，全国排名是编的）、跟着弹的**假杀毒告警**（点「暂不处理」它会变本加厉；给本仓库点过 Star 就能「验证修复」，从此改弹替你拦截的防护通报）、右下角图片弹窗，和左下角《贪玩蓝鲸》。

## 设置

设置 → **广告（非官方）**，六个广告位一位一个开关，关掉的下次启动还是关的。只想留跑分和蓝鲸，勾一次就行。

![DSH 设置面板里的「广告（非官方）」一页：两侧广告栏、对话里的推荐、右下角弹窗、跑分中心、安全中心、贪玩蓝鲸，各自一个开关](assets/settings.webp)

## 本站广告位火爆招商

不用联系，你的插件已经在轮播了。`dsh-external` 里**最近两周更新过的**都在池子里，名字和一句话简介被自动排版成一张 2005 年味儿的横幅。这些是全场唯一能点进去的广告，点开跳你的仓库。

对话里的信息流是主战场：隔一条一个真插件，挑的规则是**没露过的排前面**，所以池子里一百多个插件都会轮到，露完一遍才有人露第二遍。侧栏不中途换图（那会让下面的广告全往上跳），每开一个新对话换一批。

不看 star，也不看谁 push 得勤。曝光账本只记在你自己浏览器里，不上报，没法刷。

### 想自己定制这张广告：发个 PR

自动生成的横幅只有名字 + 一句话简介。想换成自己的文案，在 `contrib/` 下加一个 `<插件名>.json`：

```json
{
  "repo": "dsh-external/dsh-visualize",
  "headline": "模型直接给你画界面",
  "sub": "对话里长出可交互卡片，不是贴一段代码",
  "badge": "本站强推",
  "button": "立即安装",
  "palette": 2
}
```

除 `repo` 外全部可省。想自己出图（webp / png / gif 都行，动图会动）就再放一张同名图片，json 里加 `"image": "<文件名>"`。跑一次 `pnpm run assets` 把生成文件一起提交，PR 过来即可。

图里不要出现真实人物和真实品牌，域名请打码 —— 只审这一条，文案多离谱都行。细则见 [contrib/README.md](contrib/README.md)。

## 安装

构建产物随仓库分发（`lib/` 已提交），无 install、无 build、无运行时依赖：

```sh
git clone https://github.com/dsh-external/dsh-ads.git
cd /path/to/deepseek-harness
pnpm dsh plugin --profile web add link:/path/to/dsh-ads
# 重启 dsh web，刷新页面
```

配置行由 bundle patch 自动插入，无需手动编辑 cordis.patch.yml。

装了社区 [plugin-registry](https://github.com/dsh-external/plugin-registry) 的用户也可以在设置页「插件」面板安装；最新 DSH 已移除旧的 `dsh registry` 命令。

换素材：图放进 `assets/ads`（侧栏）、`assets/popups`（右下角）或 `assets/posters`（左下角），在 `scripts/build-assets.mjs` 里补一行文案，跑 `pnpm run assets` 重新内联。webp 动图直接能用。在 `assets/posters` 里放一个同名 `.mp4`，点开广告时就播它。改源码后跑 `pnpm run check`。

## 顺便打个广告（这次是真的）

同一个作者的 [dsh-visualize](https://github.com/dsh-external/dsh-visualize)：对话内的生成式 UI，模型把界面直接画进会话流，带流式预览和鲸鱼蓝主题跟随。这条是全 README 唯一没编的。

<div align="center">

https://github.com/user-attachments/assets/93ff08ef-cf32-4a87-bf63-274c1a0a71e2

</div>

## 免责

纯属娱乐。图里的品牌、域名、人物、价格、承诺全是编的，域名打了码；与 DeepSeek 以及任何真实存在的公司、产品、服务均无关联，如有雷同纯属巧合。提示音是 Web Audio 现合成的，没打包任何第三方音频。

那个"安全中心"弹窗是在拿 2000 年代的假杀毒弹窗开玩笑：里面提到的病毒、症状、感染范围全是编的，提到的模型名字只是玩梗，不针对也不影射任何公司的任何产品。它不会扫描、读取或修改你机器上的任何东西。「验证修复」只在你主动点击时问一次 GitHub 你是否 star 过（本机 gh / token，否则匿名公开 API），结果只存你自己的浏览器。
