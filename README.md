# dsh-ads

给 DSH Web UI 糊上一层 2005 年的中文站点广告：正文两侧的广告栏、对话里的信息流、右下角"叮"一声弹出的消息窗、左下角的《贪玩蓝鲸》。

每个 ✕ 都是画出来 16–20px，真正能点中的只有里面偏了位的 4–7px。点歪了，广告整屏放大给你看。

![正文两侧的广告栏、对话内的信息流广告、左下角《贪玩蓝鲸》海报、右下角「DSH 消息中心」弹窗](assets/screenshot.webp)

输入框、会话列表、顶部标签栏都不挡。「关闭所有广告」是这里唯一说真话的按钮，点一次到刷新为止。

## 安装

构建产物随仓库分发（`lib/` 已提交），无 install、无 build、无运行时依赖：

```sh
git clone https://github.com/dsh-external/dsh-ads.git
dsh plugin --profile web add link:/path/to/dsh-ads
# 重启 dsh web，刷新页面
```

配置行由 bundle patch 自动插入，无需手动编辑 cordis.patch.yml。

装了社区 [plugin-registry](https://github.com/dsh-external/plugin-registry) 的用户也可以走它的通道（与上面的官方通道二选一）：设置页「插件」面板安装，或 `dsh registry install /path/to/dsh-ads`。

换素材：图放进 `assets/ads`（侧栏）、`assets/popups`（右下角）或 `assets/posters`（左下角），在 `scripts/build-assets.mjs` 里补一行文案，跑 `pnpm run assets` 重新内联。改源码后跑 `pnpm run check`。

图里的品牌、域名、人物都是编的，域名打了码。提示音是 Web Audio 现合成的，没打包任何第三方音频。
