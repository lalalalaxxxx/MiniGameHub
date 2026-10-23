"""Generate original soft UI sounds for the quiet puzzle and teaching games."""
import math
import struct
import wave
from pathlib import Path

folder = Path(__file__).resolve().parents[1] / 'assets/audio/feedback'
folder.mkdir(parents=True, exist_ok=True)
notes = {'move': [440], 'rotate': [350, 460], 'drop': [540, 380],
         'collect': [660, 880], 'clear': [520, 660, 780], 'finish': [523, 659, 784, 1047]}
for name, frequencies in notes.items():
    duration = .15 + len(frequencies) * .065
    data = []
    for i in range(int(duration * 24000)):
        t = i / 24000
        sample = 0
        for n, hz in enumerate(frequencies):
            u = t - n * .065
            if u >= 0:
                envelope = min(1, u / .008) * math.exp(-u * 24)
                sample += math.sin(2 * math.pi * hz * u) * envelope * .28
        data.append(struct.pack('<h', int(max(-.8, min(.8, sample)) * 32767)))
    with wave.open(str(folder / (name + '.wav')), 'wb') as out:
        out.setparams((1, 2, 24000, 0, 'NONE', 'not compressed'))
        out.writeframes(b''.join(data))
