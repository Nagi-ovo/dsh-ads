# dsh-ads

![dsh-ads](assets/social-preview.jpg)

<p align="center">
  <strong>简体中文</strong> | <a href="README.en.md">English</a>
</p>

<p align="center">
  <a href="https://dshfind.com/zh/plugins/Nagi-ovo/dsh-ads?ref=badge"><img src="https://dshfind.com/api/card/Nagi-ovo/dsh-ads?lang=zh" alt="dsh-ads 在 dshfind 插件目录上的展示卡" width="440"></a>
</p>

<p align="center">
  <strong>把 DeepSeek Harness 变成 2005 年门户网站。连 inference 都逃不过广告。</strong><br>
  广告是假的，插件是真的，抽到 V4 Pro 的希望也是真的渺茫。
</p>

![中文模式实机：两侧广告栏、对话内插件推荐、贪玩蓝鲸和 DSH 消息中心](assets/screenshot.webp)

`dsh-ads` 会在侧栏、对话、推理中途和右下角塞入一整套虚构广告。它看起来会暂停 inference，实际上模型一直在后台工作，只是后续回答和工具调用要等广告结束才显示。

插件不会只拿自己开涮。GitHub 上带 [`dsh-plugin`](https://github.com/topics/dsh-plugin) topic、且最近两周更新过的公开插件会进入推荐位，点击广告就能打开真实仓库。仓库换到个人账号或其他组织后仍能被发现。

## 两套互联网垃圾美学

切换 DSH 的「设置 → 语言」，当前页面会立即更换整套素材、文案和交互，不用刷新。中文模式主打页游、财神和「这次一定」，两张贪玩蓝鲸海报每 20 秒自动切换；English mode 则是 fake antivirus、weird tricks 和 actual gameplay*。

![流式回答中插入的 V4 Pro 正式版抽奖广告：财神鲸、每轮一抽的转盘与四道解锁进度条](assets/reward-gate.png)

![English 模式实机：Imagegen 虎鲸插件广告、假杀毒广告、假游戏和消息中心](assets/english-mode.png)

<table>
  <tr>
    <th>中文：贪玩蓝鲸</th>
    <th>English: actual gameplay*</th>
  </tr>
  <tr>
    <td><img src="assets/poster-blue-whale-small.gif" alt="贪玩蓝鲸假游戏动画"></td>
    <td><img src="assets/en/posters/poster-fail-game.webp" alt="English mode fake gameplay ad"></td>
  </tr>
</table>

<p align="center">
  <img src="assets/startup-score.png" width="346" alt="DSH 跑分中心显示 0.29 秒启动耗时和全国排名"><br>
  <sub>启动耗时是真测的，全国排名是编的。</sub>
</p>

## 安装

推荐直接从 GitHub 安装到 DSH 的 `web` profile：

```sh
dsh plugin --profile web add github:Nagi-ovo/dsh-ads
# 如果 dsh web 正在运行，重启后刷新页面
```

可以运行 `dsh --profile web --dump-config` 确认插件已经进入最终配置。需要修改源码时，克隆仓库并在仓库目录运行 `dsh plugin --profile web add .`；构建产物已经提交，不需要额外构建。使用社区 [plugin-registry](https://github.com/dsh-external/plugin-registry) 的用户也可以从「设置 → 插件」安装。

每个广告位都能在「设置 → 广告（非官方）」里单独关闭，选择会保留到下次启动。

![DSH 设置面板里的广告开关](assets/settings.webp)

## 免费广告位

带 `dsh-plugin` topic 的公开插件会自动参与轮播。想指定自己的文案或图片，可以查看[投稿说明](contrib/README.md)并发 PR。曝光记录只保存在本机浏览器里。

同一个作者的 [dsh-visualize](https://github.com/Nagi-ovo/dsh-visualize) 可以让模型直接在对话里画出交互界面。这条是整个 README 唯一正经的广告。

<div align="center">

[![dsh-visualize 对话内生成交互式可视化演示](assets/visualize-demo.webp)](assets/visualize-demo.mp4)

</div>

## 免责声明

本插件纯属娱乐，与 DeepSeek 以及任何真实公司、产品或服务均无关联。广告里的品牌、人物、域名、价格、病毒和承诺均为虚构。插件不会扫描、读取或修改机器上的文件。

「验证修复」只会在用户主动点击后查询一次 GitHub Star 状态，优先使用本机 `gh` 或 token，否则调用匿名公开 API。结果只保存在本机浏览器中。
