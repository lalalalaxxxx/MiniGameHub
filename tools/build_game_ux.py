"""Install the shared interaction layer in every game and its page builders."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent.parent
STYLE = '<link rel="stylesheet" href="../../assets/css/game-ux.css">'
SCRIPT = '<script src="../../assets/js/game-ux.js"></script>'


def enhance(text):
    if 'assets/css/game-ux.css' not in text:
        text = text.replace('</head>', STYLE + '</head>')
    if 'assets/js/game-ux.js' not in text:
        text = re.sub(r'<script(?=[ >])', SCRIPT + '<script', text, count=1)
    return text


def build():
    for page in (ROOT / 'games').glob('*/index.html'):
        before = page.read_text(encoding='utf-8')
        after = enhance(before)
        # Safari also needs the native gesture guard; viewport alone is insufficient.
        after = re.sub(r'(<meta name="viewport" content=")[^"]*',
                       r'\1width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover', after)
        if after != before:
            page.write_text(after, encoding='utf-8', newline='\n')


if __name__ == '__main__':
    build()
