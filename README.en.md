# dsh-ads

<p align="center">
  <a href="README.md">简体中文</a> | <strong>English</strong>
</p>

<p align="center">
  <strong>Turn DeepSeek Harness into a 2005 web portal. Not even inference escapes the ads.</strong><br>
  Gutters, conversations, inference, and pop-ups. Every empty pixel is inventory.
</p>

![English mode with Imagegen whale plugin ads, fake antivirus warnings, a fake game, and the DSH message center](assets/english-mode.png)

## How bad does it get?

- **Every empty pixel is monetized.** Gutter banners, sponsored posts, a benchmark window, fake antivirus alerts, and a fake game all appear without blocking the composer or official dialogs.
- **Inference gets an ad break.** It looks paused, but the model keeps working. The rest of the answer appears when the ad ends.
- **V4 Pro is one spin away. Probably.** An orca in a God of Wealth hat runs a prize wheel stocked with Attention Heads, KV Cache, MoE experts, and an unlimited supply of “Thanks for playing.”
- **The ads are fake. The plugins are real.** Community plugins from `dsh-external` rotate through sponsored slots that open their actual repositories.

<p align="center">
  <img src="assets/startup-score.png" width="346" alt="DSH benchmark center showing a 0.29 second startup time and nationwide rank"><br>
  <sub>The startup time is measured. The nationwide rank is made up.</sub>
</p>

## Chinese and English, two distinct flavors of internet trash

Change Settings → Language and the current page hot-swaps the artwork, copy, and interactions as a complete campaign without a reload. This is not the Chinese campaign with translated labels pasted over it.

### Chinese mode: spin for V4 Pro

![The Chinese V4 Pro prize wheel with the God of Wealth whale and four unlock progress bars](assets/reward-gate.png)

![Chinese mode with gutter ads, a sponsored plugin, the fake game, and DSH message center](assets/screenshot.webp)

<table>
  <tr>
    <th>Chinese: Blue Whale fake game (GIF)</th>
    <th>English: actual gameplay*</th>
  </tr>
  <tr>
    <td><img src="assets/poster-blue-whale-small.gif" alt="Animated Blue Whale fake game ad"></td>
    <td><img src="assets/en/posters/poster-fail-game.webp" alt="English mode fake gameplay ad"></td>
  </tr>
</table>

## Install

If you use the community [plugin-registry](https://github.com/dsh-external/plugin-registry), install `dsh-ads` from Settings → Plugins.

You can also link a local checkout. Build output is committed, so no extra dependencies are required:

```sh
git clone https://github.com/dsh-external/dsh-ads.git
cd /path/to/deepseek-harness
pnpm dsh plugin --profile web add link:/path/to/dsh-ads
# Restart dsh web, then refresh the page.
```

Every placement has its own switch under Settings → Ads (Unofficial). Choices persist across restarts.

![Per-placement ad controls in DSH Settings](assets/settings.webp)

## Free ad inventory. Seriously.

Plugins in `dsh-external` updated within the last two weeks automatically enter the rotation. The message feed prioritizes plugins that have not appeared yet, and impression history stays in the local browser.

Want your own copy or artwork? Read the [contribution guide](contrib/README.md) and send a PR.

## One real ad

From the same author: [dsh-visualize](https://github.com/dsh-external/dsh-visualize) lets the model draw interactive UI directly inside the conversation. This is the only claim in this README that is not a parody.

<div align="center">

https://github.com/user-attachments/assets/93ff08ef-cf32-4a87-bf63-274c1a0a71e2

</div>

## Disclaimer

This plugin is entertainment and is not affiliated with DeepSeek or any real company, product, or service. Every brand, person, domain, price, virus, and promise shown in its ads is fictional. The plugin does not scan, read, or modify files on the computer.

“Verify fix” checks GitHub Star status only after the user clicks it. It prefers the local `gh` session or token and otherwise uses the anonymous public API. The result stays in the local browser.
