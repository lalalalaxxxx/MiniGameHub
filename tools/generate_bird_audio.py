"""Original, short power-bird effects. No samples or external dependencies."""
from pathlib import Path
import math
import random
import struct
import wave

ROOT = Path(__file__).resolve().parents[1] / 'assets/audio/birdblast'
RATE = 22050

def render(name, duration):
    rng = random.Random(240)
    frames = []
    phase = 0.0
    smooth_noise = 0.0
    for n in range(int(duration * RATE)):
        t = n / RATE
        u = t / duration
        smooth_noise = .75 * smooth_noise + .25 * rng.uniform(-1, 1)
        if name == 'glow':
            hz = 1050 * (1 - u) + 250
            value = math.sin(phase) * .6 + math.sin(phase * 1.5) * .2
        elif name == 'fire':
            hz = 130 - 70 * u
            value = smooth_noise * 2 + math.sin(phase) * .25
            value *= .65 + .35 * math.sin(t * 45) ** 2
        elif name == 'lightning':
            hz = 760 + 150 * math.sin(t * 72)
            value = math.sin(phase) * .35 + smooth_noise * 1.4
            value *= .35 + .65 * math.sin(t * 58) ** 2
        else:
            hz = 400 * (1 - u) ** 2 + 80
            value = math.sin(phase) * .45 + math.sin(phase * .501) * .25 + smooth_noise * .4
        phase += math.tau * hz / RATE
        envelope = min(1, t / .012) * (1 - u) ** 1.3
        frames.append(struct.pack('<h', int(max(-1, min(1, value * envelope * .28)) * 32767)))
    ROOT.mkdir(parents=True, exist_ok=True)
    with wave.open(str(ROOT / (name + '.wav')), 'wb') as out:
        out.setparams((1, 2, RATE, 0, 'NONE', 'not compressed'))
        out.writeframes(b''.join(frames))

if __name__ == '__main__':
    for name, duration in [('glow', .24), ('fire', .65), ('lightning', .32), ('whirlwind', .85)]:
        render(name, duration)
