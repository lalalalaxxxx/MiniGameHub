"""Small original toy/flower sounds; deterministic synthesis with soft envelopes."""
from pathlib import Path
import math, random, struct, wave
root = Path(__file__).resolve().parents[1] / 'assets/audio'
rate = 24000
for game in ['gardenwatch', 'toydefense']:
    for name, duration in [('shoot', .16), ('rotate', .23), ('merge', .28), ('hit', .14), ('clear', .25), ('collect', .35), ('drop', .24), ('finish', .65)]:
        rng = random.Random(19); samples = []; phase = 0
        for i in range(int(rate * duration)):
            t = i / rate; u = t / duration
            if name == 'shoot': frequency = 540 * (1-u) + 160; gain = .6 * math.exp(-u*5)
            elif name == 'rotate': frequency = 400 + 750 * math.sin(u*math.pi); gain = .48 * math.exp(-u*4)
            elif name == 'merge': frequency = 1200 if u < .4 else 1600; gain = .35 * math.exp(-u*4)
            elif name == 'hit': frequency = 280 - 170*u; gain = .42 * math.exp(-u*5)
            elif name == 'clear': frequency = 650 + 500*u; gain = .36 * math.sin(math.pi*u)**2
            elif name == 'drop': frequency = 300 + 400*u; gain = .4 * math.exp(-u*4)
            else:
                notes = [659, 880, 1047] if name == 'finish' else [880, 1175]
                frequency = notes[min(len(notes)-1, int(u*len(notes)))]; gain = .34 * math.sin(math.pi*(u*len(notes)%1))**2
            phase += 2*math.pi*frequency*(1 if game == 'gardenwatch' else .88)/rate
            value = (math.sin(phase) + .18*math.sin(phase*2)) * gain
            if name in ['hit', 'clear']: value += rng.uniform(-1,1)*.06*(1-u)**4
            value *= min(1,t/.006)*min(1,(duration-t)/.025)
            samples.append(struct.pack('<h',round(max(-.85,min(.85,value))*32767)))
        target = root / game / (name+'.wav'); target.parent.mkdir(parents=True,exist_ok=True)
        with wave.open(str(target),'wb') as out:
            out.setnchannels(1); out.setsampwidth(2); out.setframerate(rate); out.writeframes(b''.join(samples))
print('Generated 16 original defense sound effects.')
