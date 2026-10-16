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
