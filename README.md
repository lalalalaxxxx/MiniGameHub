# MiniGameHub

一个面向 iPad 和儿童触摸操作的纯静态小游戏集合。

## 本地运行

```bash
python -m http.server 8934
```

打开 `http://127.0.0.1:8934/`。

## 添加游戏

1. 在 `games/` 下创建独立目录，并提供 `index.html`。
2. 为游戏添加 `cover.svg`。
3. 在 `games/manifest.json` 中登记游戏信息。

当前包含贪吃蛇、2048、俄罗斯方块、打地鼠、星星大战、彩虹赛车和水果合成。

## 游戏声音

七款游戏各有一段原创合成循环配乐，共用十二种操作音效，素材位于 `assets/audio/`，总计约 1.5 MB。音乐与音效由 `assets/js/audio.js` 统一管理，不依赖外部音频服务。

首次触摸或按键后才播放，符合 Safari 的自动播放限制。游戏中的声音按钮同时控制音乐和音效，并记住静音设置；暂停、进入后台或离开页面时停音，游戏结束时停止配乐并播放结束音效。

音频由项目内的旋律和合成器生成，未使用第三方歌曲或录音。重新生成素材：

```bash
python -m pip install numpy imageio-ffmpeg
python tools/generate_audio.py
```
