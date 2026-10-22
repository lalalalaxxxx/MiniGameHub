"""Build the static entry pages and covers for the ten learning games."""
import json
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
GAMES = [
    ('pipes', '小小水管工', '转动水管，把清水送到小花园', '益智', '#49785d', '#e8f1df', '水'),
    ('tangram', '图形拼拼乐', '转一转七巧板，拼出自己的小作品', '益智', '#9b7256', '#f3e7d5', '△'),
    ('market', '小小超市', '按清单购物，学会数数、付款和找零', '生活', '#8b6d91', '#f0e4ef', '购'),
    ('robot', '小动物编程', '排好前进和转弯指令，带小兔回家', '益智', '#557d94', '#e0edf1', '↗'),
    ('bento', '便当小厨房', '照着要求搭配一份丰富的小便当', '生活', '#a87755', '#f3e8d8', '食'),
    ('shadow', '影子侦探', '从影子、局部和线索里发现答案', '观察', '#6b729b', '#e8e9f3', '？'),
    ('patterns', '规律小火车', '找出颜色、图形与数字的重复规律', '益智', '#5b827d', '#e0eeea', '○'),
    ('memory', '记忆翻翻牌', '翻开卡片，找到有联系的好朋友', '观察', '#987482', '#f1e5ea', '双'),
    ('bridge', '桥梁小工程师', '铺好桥面、加上桥墩，让小车过河', '益智', '#8b7955', '#eee9d8', '桥'),
    ('rhythm', '节奏小乐队', '听一听、敲一敲，还能录下自己的音乐', '音乐', '#9a725d', '#f4e6dc', '♫'),
]
def main():
    manifest_path = ROOT / 'games/manifest.json'
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    for game_id, title, intro, category, accent, pale, symbol in GAMES:
        folder = ROOT / 'games' / game_id
        folder.mkdir(exist_ok=True)
        html = f'''<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><meta name="theme-color" content="#f6f4e9"><meta name="apple-mobile-web-app-capable" content="yes"><title>{title} · 软软游戏屋</title><link rel="icon" href="../../assets/img/favicon.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="../../assets/img/apple-touch-icon.png"><link rel="manifest" href="../../manifest.webmanifest"><link rel="stylesheet" href="../../assets/css/learning.css"><link rel="stylesheet" href="../../assets/css/screen-fit.css"></head>
<body style="--accent:{accent};--pale:{pale}">
<header><a href="../../index.html">‹ 回大厅</a><div><span class="eyebrow">PLAY · DISCOVER · GROW</span><h1>{title}</h1></div><button id="sound">开启声音</button></header>
<div class="top-controls"><nav class="levels" aria-label="难度"><button data-level="0">轻松入门</button><button data-level="1">动脑练习</button><button data-level="2">进阶挑战</button></nav><div class="tools"><button id="undo">撤销</button><button id="help">怎么玩</button><button id="restart">换一关</button></div></div>
<main><span id="level-label" hidden></span><div id="activity"></div><section id="success" hidden role="status"><div><h2>完成啦！</h2><p>认真观察、动手尝试，你做到了。</p></div><button id="next" class="primary">试试下一档</button></section></main>
<footer><p id="feedback" role="status">{intro}</p><span id="save-status">进度会自动保存</span></footer>
<dialog id="dialog"><h2 id="dialog-title"></h2><p id="dialog-text"></p><div><button id="cancel">继续玩</button><button id="confirm" class="primary">确定</button></div></dialog>
<script src="../quietbook/art.js"></script><script src="../../assets/js/learning-core.js"></script><script src="../../assets/js/audio.js"></script><script src="../../assets/js/learning-ui.js"></script><script src="game.js"></script><script src="../../assets/js/offline.js"></script>
<script src="../../assets/js/screen-fit.js"></script></body></html>'''
        (folder/'index.html').write_text(html, encoding='utf-8', newline='\n')
        cover=f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450"><rect width="800" height="450" fill="{pale}"/><circle cx="100" cy="450" r="210" fill="{accent}" opacity=".12"/><circle cx="730" cy="30" r="170" fill="{accent}" opacity=".10"/><rect x="250" y="65" width="300" height="300" rx="65" fill="#fffdf7" stroke="{accent}" stroke-width="5"/><text x="400" y="270" text-anchor="middle" font-family="sans-serif" font-size="140" font-weight="bold" fill="{accent}">{symbol}</text><circle cx="180" cy="120" r="22" fill="{accent}" opacity=".4"/><path d="m640 260 15 30 34 4-25 24 6 33-30-16-30 16 6-33-25-24 34-4z" fill="#d7b665"/></svg>'''
        (folder/'cover.svg').write_text(cover, encoding='utf-8', newline='\n')
        if not any(g['id']==game_id for g in manifest):
            manifest.append(dict(id=game_id,title=title,blurb=intro,category=category,tags=['单人','触摸'],cover=f'games/{game_id}/cover.svg',entry=f'games/{game_id}/index.html'))
    manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
if __name__ == '__main__':
    main()
