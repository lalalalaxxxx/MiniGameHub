"""Original layered pops and sparkles for puzzle games (deterministic PCM)."""
import math
import random
import struct
import wave
from pathlib import Path

root = Path(__file__).resolve().parents[1] / 'assets/audio'
rate = 24000
for game, base in [('birdblast', 600), ('candyland', 700), ('gemquest', 830), ('petlink', 540)]:
    target = root / game
    target.mkdir(parents=True, exist_ok=True)
    for name, duration in [('clear', .34), ('merge', .58), ('collect', .38), ('finish', .85), ('drop', .13)]:
        rng = random.Random(91)
        samples = []
        for i in range(round(rate * duration)):
            t = i / rate
            sample = 0
            if name in ('clear', 'merge'):
                sample += .36 * math.sin(2*math.pi*(105*t+12*(1-math.exp(-t*30)))) * math.exp(-t*22)
                sample += (rng.random()*2-1) * .09 * math.exp(-t*50)
            notes = [1, 1.25, 1.5, 2] if name == 'finish' else [1, 1.5, 2] if name in ('merge', 'collect') else [1, 1.25] if name == 'clear' else [.75]
            spacing = .14 if name == 'finish' else .06 if name == 'merge' else .035
            for n, ratio in enumerate(notes):
                u = t - n*spacing
                if u >= 0:
                    decay = 13 if name == 'finish' else 24
                    attack = min(1, u/.004)
                    sample += .21 * attack * math.exp(-u*decay) * (math.sin(2*math.pi*base*ratio*u)+.15*math.sin(4*math.pi*base*ratio*u))
            sample *= min(1, t/.002) * min(1, (duration-t)/.02)
            samples.append(sample)
        peak = max(abs(v) for v in samples)
        amplitude = .7 if name == 'merge' else .55 if name != 'drop' else .32
        with wave.open(str(target / (name+'.wav')), 'wb') as out:
            out.setparams((1, 2, rate, 0, 'NONE', 'not compressed'))
            out.writeframes(b''.join(struct.pack('<h', round(v/peak*amplitude*32767)) for v in samples))
