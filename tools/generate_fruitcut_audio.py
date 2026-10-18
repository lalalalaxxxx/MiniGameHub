"""Original short slice/juice sound; deterministic synthesis, no external samples."""
from pathlib import Path
import math
import random
import struct
import wave

rate = 24000
rng = random.Random(72)
samples = []
previous = 0.0
for i in range(int(rate * .22)):
    t = i / rate
    noise = rng.uniform(-1, 1)
    airy = (noise - previous) * .18 * math.sin(math.pi * min(1, t / .22)) ** 2
    previous = noise
    pop = math.sin(2 * math.pi * (900 * t - 1500 * t * t)) * math.exp(-t * 27) * .36
    envelope = min(1, t / .005) * min(1, (.22 - t) / .02)
    samples.append(struct.pack('<h', int(max(-1, min(1, (airy + pop) * envelope)) * 32767)))
target = Path(__file__).resolve().parents[1] / 'assets/audio/fruitcut/collect.wav'
target.parent.mkdir(parents=True, exist_ok=True)
with wave.open(str(target), 'wb') as output:
    output.setnchannels(1)
    output.setsampwidth(2)
    output.setframerate(rate)
    output.writeframes(b''.join(samples))
print('Generated original fruit slice sound.')
