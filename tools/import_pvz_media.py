"""Fetch pinned reference media; no upstream application code is imported."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
import time
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
SOURCE = json.loads((ROOT / 'tools/pvz-media-sources.json').read_text())
DEST = ROOT / 'games/pvz/media'


def fetch(path):
    relative = path.removeprefix('public/assets/')
    is_atlas_input = relative == 'original/animations.json' or relative.startswith('original/actors-')
    target = (ROOT / 'tools/.cache/pvz' if is_atlas_input else DEST) / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    url = SOURCE['repository'].replace('github.com', 'raw.githubusercontent.com') + '/' + SOURCE['revision'] + '/' + path
    for attempt in range(3):
        try:
            data = urllib.request.urlopen(url, timeout=45).read()
            target.write_bytes(data)
            return {'path': relative, 'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data), 'buildInputOnly': is_atlas_input}
        except Exception:
            if attempt == 2:
                raise
            time.sleep(1)


if __name__ == '__main__':
    with ThreadPoolExecutor(max_workers=6) as pool:
        files = list(pool.map(fetch, SOURCE['files']))
    (DEST / 'sources.json').write_text(json.dumps({
        'repository': SOURCE['repository'], 'revision': SOURCE['revision'],
        'notice': 'Plants vs. Zombies artwork and audio: PopCap Games / Electronic Arts. Reference atlas export: xyxiao001/pvz-web. Unofficial browser recreation; not an official mobile release.',
        'files': files
    }, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'Imported {len(files)} media files, {sum(f["bytes"] for f in files) / 1000000:.1f} MB')
    from build_pvz_atlases import build
    build()
