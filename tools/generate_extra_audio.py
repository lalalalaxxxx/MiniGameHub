"""Reproducible, original tactile sounds for the ten extra games. No samples."""
from generate_casual_audio import Sound, retry, REPORT
import math

PROFILES = {
    'zumapath': ('glass', 740, ('shoot', 'hit', 'clear', 'merge', 'rotate')),
    'slingblocks': ('wood', 330, ('shoot', 'hit', 'clear', 'drop')),
    'tripletown': ('wood', 620, ('drop', 'merge', 'clear', 'rotate')),
    'tankguard': ('metal', 240, ('shoot', 'hit', 'clear', 'collect', 'merge')),
    'bombergarden': ('bell', 490, ('drop', 'clear', 'hit', 'collect')),
    'waterworks': ('glass', 980, ('drop', 'collect', 'move')),
    'trafficpark': ('wood', 420, ('move', 'drop')),
    'fireice': ('bell', 830, ('drop', 'collect', 'rotate', 'merge', 'clear')),
    'buildracer': ('metal', 290, ('drop', 'rotate', 'shoot', 'hit', 'collect')),
    'mushroomwar': ('wood', 550, ('move', 'hit', 'collect', 'clear', 'merge')),
}

def generate():
    for game, (material, hz, effects) in PROFILES.items():
        for name in effects:
            if name == 'shoot':
                s = Sound(.21, .42).tone(0, .16, hz * .35, .5, end=hz * 1.1, decay=4)
                s.noise(.01, .14, .19, low=300, high=2200).pluck(.025, hz, .23, .13, material)
            elif name == 'hit':
                s = Sound(.13, .37).pluck(0, hz, .7, .12, material)
                s.tone(0, .085, 130, .3, end=65).noise(0, .055, .16, low=250, high=2100)
            elif name == 'clear':
                s = Sound(.44, .46).tone(0, .2, 160, .4, end=52)
                s.noise(.005, .22, .3, low=200, high=2700)
                for i, ratio in enumerate((1, 1.5, 2, 1.25)):
                    s.pluck(i * .048, hz * ratio, .45 - i * .07, .19, material)
            elif name in ('collect', 'merge'):
                s = Sound(.46, .43).notes(0, hz, (1, 1.25, 1.5) if name == 'merge' else (1, 1.5), spacing=.065, length=.28, material=material)
                if name == 'merge':
                    s.pop(.015, hz * 1.5, .3)
            elif name == 'drop' and game in ('waterworks', 'bombergarden', 'fireice'):
                s = Sound(.16, .35).pop(0, hz * 1.15, length=.12)
                s.pluck(.04, hz * 1.5, .15, .1, material)
            elif name == 'move':
                s = Sound(.13, .3).noise(0, .12, .15, low=200, high=1200)
                s.pluck(.01, hz, .45, .11, material)
            else:
                s = Sound(.18, .35).pluck(0, hz, .65, .12, material)
                s.pluck(.055, hz * .75, .24, .11, material)
            s.write(game, name)
        Sound(.87, .46).notes(0, hz, (1, 1.25, 1.5, 2), spacing=.11, length=.38, material=material) \
            .pluck(.46, hz * .5, .22, .36, 'wood').write(game, 'finish')
        retry(game, hz)

if __name__ == '__main__':
    generate()
    for game, name, duration, peak, rms in REPORT:
        print(f'{game:13} {name:8} {duration:.3f}s peak {peak:.2f} RMS {20 * math.log10(rms):.1f} dBFS')
    print(f'{len(REPORT)} original effects. Mono 24 kHz PCM; zero boundaries, no clipping.')
