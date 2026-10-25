"""Original gentle, finite puzzle feedback. Standard library synthesis; no samples.

Regenerate: python tools/generate_riddle_audio.py
Check committed PCM: python tools/generate_riddle_audio.py --check
No background loops. Each family has its own timbre, tuning and short motif.
"""
from generate_casual_audio import Sound, ROOT, RATE, REPORT
import hashlib
import math
import struct
import sys
import wave

PROFILES = {
    'mirrorlight': ('glass', 698.46, (1, 1.5, 2)),
    'firefly': ('bell', 783.99, (1, 1.25, 1.5)),
    'boxtrail': ('wood', 392.00, (1, 1.3333, 1.5)),
    'colorsort': ('glass', 523.25, (1, 1.25, 1.6667)),
    'starpath': ('bell', 659.25, (1, 1.5, 1.875)),
}
EVENTS = ('move', 'rotate', 'drop', 'collect', 'clear', 'hit', 'finish', 'over')


def generate():
    for index, (game, (material, hz, motif)) in enumerate(PROFILES.items()):
        for event_index, name in enumerate(EVENTS):
            seed = 481 + index * 101 + event_index * 13
            if name == 'move':
                sound = Sound(.12, .24, seed).pluck(.002, hz * .75, .5, .10, material)
                sound.noise(.002, .04, .045, low=180, high=1100)
            elif name == 'rotate':
                sound = Sound(.23, .27, seed).pluck(0, hz, .5, .16, material)
                sound.pluck(.065, hz * 1.25, .30, .15, material)
            elif name == 'drop' and game == 'colorsort':
                sound = Sound(.39, .29, seed)
                for at, ratio in ((0, 1.5), (.085, 1.25), (.17, 1)):
                    sound.tone(at, .17, hz * ratio, .45, end=hz * ratio * .55, decay=4.4)
                sound.noise(.015, .3, .07, low=250, high=1500, decay=3)
            elif name == 'drop':
                sound = Sound(.19, .28, seed).pluck(0, hz * .8, .6, .15, material)
                sound.tone(.005, .11, 150 + index * 20, .14, end=95 + index * 12)
            elif name == 'collect':
                sound = Sound(.36, .31, seed).notes(0, hz, motif[:2], spacing=.075,
                    amp=.35, length=.24, material=material)
            elif name == 'clear':
                sound = Sound(.46, .32, seed).notes(0, hz, motif, spacing=.075,
                    amp=.32, length=.25, material=material)
                sound.pluck(.025, hz * .5, .12, .2, 'wood')
            elif name == 'hit':
                # Invalid actions get a small, warm tap, never a punitive buzzer.
                sound = Sound(.15, .22, seed).pluck(0, hz * .48, .45, .12, 'wood')
                sound.pluck(.035, hz * .4, .12, .10, material)
            elif name == 'finish':
                sound = Sound(.73, .36, seed).notes(0, hz, (*motif, 2), spacing=.1,
                    amp=.31, length=.32, material=material)
                sound.pluck(.32, hz * .5, .11, .35, 'wood')
            else:
                sound = Sound(.37, .24, seed).notes(0, hz * .75, (1, .84), spacing=.12,
                    amp=.33, length=.23, material='wood')
            sound.write(game, name)


def check():
    hashes = set()
    for game in PROFILES:
        for event in EVENTS:
            file = ROOT / game / (event + '.wav')
            with wave.open(str(file), 'rb') as audio:
                assert audio.getnchannels() == 1 and audio.getsampwidth() == 2
                assert audio.getframerate() == RATE and audio.getcomptype() == 'NONE'
                data = audio.readframes(audio.getnframes())
                samples = struct.unpack('<' + 'h' * (len(data) // 2), data)
                duration = len(samples) / RATE
            assert .09 <= duration <= .8, (file, 'duration')
            assert samples[0] == samples[-1] == 0, (file, 'click boundary')
            peak = max(abs(v) for v in samples) / 32767
            rms = math.sqrt(sum((v / 32767) ** 2 for v in samples) / len(samples))
            assert .15 < peak <= .361 and .005 < rms < .13, (file, peak, rms)
            digest = hashlib.sha256(data).hexdigest()
            assert digest not in hashes, (file, 'duplicate sound')
            hashes.add(digest)
    print(f'PASS {len(hashes)} distinct original effects: mono 24 kHz PCM, 0.12–0.73 s, '
          'peak ≤ 0.36, silent boundaries, no clipping or looping BGM.')


if __name__ == '__main__':
    if '--check' not in sys.argv:
        generate()
        for game, name, duration, peak, rms in REPORT:
            print(f'{game:12} {name:7} {duration:.2f}s peak {peak:.2f} RMS {20 * math.log10(rms):.1f} dBFS')
    check()
