"""Original soft bubble and waterbird feeding sounds; deterministic PCM assets."""
import math
from pathlib import Path
import struct
import wave

root = Path(__file__).resolve().parents[1] / 'assets/audio/aquarium'
root.mkdir(parents=True, exist_ok=True)
for name in ('collect', 'drop'):
    samples = []
    for i in range(6000):
        t = i / 24000
        envelope = min(1, t / .008) * math.exp(-t * 23)
        phase = 2 * math.pi * (620 * t - 650 * t * t)
        sound = math.sin(phase) if name == 'collect' else math.sin(phase * .58) * (.65 + .35 * math.sin(t * 110))
        samples.append(struct.pack('<h', int(sound * envelope * 14500)))
    with wave.open(str(root / (name + '.wav')), 'wb') as out:
        out.setparams((1, 2, 24000, 0, 'NONE', 'not compressed'))
        out.writeframes(b''.join(samples))
