"""Original short pops, a rounded impact and rising sparkles. No music layer."""
import math
import random
import struct
import wave
from pathlib import Path

root = Path(__file__).resolve().parents[1] / 'assets/audio'
rate = 24000
for game, base in [('toyblast', 610), ('fruitgarden', 740)]:
    rng = random.Random(17)
    samples = []
    for i in range(int(rate * .46)):
        t = i / rate
        # Integrated downward pitch sweep gives the first pop a round attack.
        sample = .32 * math.sin(2 * math.pi * (140*t + 18*(1-math.exp(-t*25)))) * math.exp(-t*24)
        for n, ratio in enumerate([1, 1.25, 1.5, 2]):
            u = t - .038*n
            if u >= 0:
                envelope = min(1, u/.004) * math.exp(-u*29)
                sample += .2 * envelope * math.sin(2*math.pi*base*ratio*u)
        sample += (rng.random()*2-1) * .07 * math.exp(-t*65)
        sample *= min(1, t/.002) * min(1, (.46-t)/.02)
        samples.append(sample)
    peak = max(abs(x) for x in samples)
    target = root / game
    target.mkdir(parents=True, exist_ok=True)
    with wave.open(str(target / 'clear.wav'), 'wb') as out:
        out.setparams((1, 2, rate, 0, 'NONE', 'not compressed'))
        out.writeframes(b''.join(struct.pack('<h', round(x/peak*.76*32767)) for x in samples))
