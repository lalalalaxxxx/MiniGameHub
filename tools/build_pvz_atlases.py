"""Repack reference frames by actor family, avoiding decoding unrelated actors."""
from pathlib import Path
from PIL import Image
import json
import hashlib

ROOT = Path(__file__).resolve().parents[1]
MEDIA = ROOT / 'games/pvz/media'
CACHE = ROOT / 'tools/.cache/pvz/original'
DEST = MEDIA / 'packed'


def save_page(page, page_id):
    bounds = page.getbbox() or (0, 0, 1, 1)
    page.crop((0, 0, bounds[2], bounds[3])).save(DEST / f'actors-{page_id}.png', optimize=True)


def build():
    CACHE.mkdir(parents=True, exist_ok=True)
    DEST.mkdir(parents=True, exist_ok=True)
    # Move only known importer outputs out of the public/offline payload.
    for source in [MEDIA / 'original/animations.json', *(MEDIA / 'original').glob('actors-*.png')]:
        if source.exists():
            source.replace(CACHE / source.name)
    catalog = json.loads((CACHE / 'animations.json').read_text())
    originals = {n: Image.open(CACHE / f'actors-{n}.png').convert('RGBA') for n in range(catalog['pages'])}
    groups = {}
    for name, clip in catalog['animations'].items():
        family = name.split('-')[0]
        groups.setdefault(family, []).append((name, clip))
    page_id = 0
    output = {}
    for family, clips in groups.items():
        locations = {}
        page = Image.new('RGBA', (1024, 1024))
        x = y = height = 0
        for name, clip in clips:
            frames = []
            for old, sx, sy, w, h, ox, oy in clip['frames']:
                key = (old, sx, sy, w, h)
                if key not in locations:
                    if x + w + 2 > 1024:
                        x = 0
                        y += height + 2
                        height = 0
                    if y + h + 2 > 1024:
                        save_page(page, page_id)
                        page_id += 1
                        page = Image.new('RGBA', (1024, 1024))
                        x = y = height = 0
                    page.paste(originals[old].crop((sx, sy, sx + w, sy + h)), (x, y))
                    locations[key] = [page_id, x, y, w, h]
                    x += w + 2
                    height = max(height, h)
                frames.append(locations[key] + [ox, oy])
            output[name] = {**clip, 'frames': frames}
        save_page(page, page_id)
        page_id += 1
    (DEST / 'animations.json').write_text(json.dumps({'pages': page_id, 'animations': output}, separators=(',', ':')), encoding='utf-8')
    for path in DEST.glob('actors-*.png'):
        if int(path.stem.split('-')[1]) >= page_id:
            path.unlink()
    provenance = MEDIA / 'sources.json'
    if provenance.exists():
        source = json.loads(provenance.read_text(encoding='utf-8'))
        for item in source['files']:
            item['buildInputOnly'] = item['path'] == 'original/animations.json' or item['path'].startswith('original/actors-')
        source['generated'] = [{'path': p.relative_to(MEDIA).as_posix(), 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted(DEST.iterdir()) if p.is_file()]
        provenance.write_text(json.dumps(source, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'Repacked {len(output)} animations into {page_id} actor-local 1024px pages.')


if __name__ == '__main__':
    build()
