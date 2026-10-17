"""Rebuild original game music/effects: pip install numpy imageio-ffmpeg."""
from pathlib import Path
import subprocess
import tempfile
import wave
import numpy as np
import imageio_ffmpeg

ROOT = Path(__file__).resolve().parents[1] / 'assets' / 'audio'
RATE = 24000
ROOT.mkdir(parents=True, exist_ok=True)


def note(midi, length, kind='bell'):
    t = np.arange(int(length * RATE)) / RATE
    f = 440 * 2 ** ((midi - 69) / 12)
    attack = np.minimum(t / .008, 1)
    release = np.minimum((length - t) / .05, 1)
    if kind == 'bass':
        signal = np.sin(2*np.pi*f*t) + .18*np.sin(4*np.pi*f*t)
        envelope = np.exp(-t*4)
    else:
        signal = np.sin(2*np.pi*f*t) + .24*np.sin(4*np.pi*f*t)*np.exp(-t*8)
        signal += .08*np.sin(6*np.pi*f*t)*np.exp(-t*12)
        envelope = np.exp(-t*(5 if kind == 'bell' else 9))
    return signal * attack * release * envelope


def add(track, sound, seconds, gain):
    start = int(seconds * RATE)
    # Wrap the decay into the start of the loop, keeping the seam continuous.
    indexes = (start + np.arange(len(sound))) % len(track)
    np.add.at(track, indexes, sound * gain)


def wav(path, data):
    with wave.open(str(path), 'wb') as out:
        out.setparams((1, 2, RATE, 0, 'NONE', 'not compressed'))
        out.writeframes((np.clip(data, -.95, .95)*32767).astype('<i2').tobytes())


# Distinct pentatonic motifs with an eight-bar tonic / vi / IV / V progression.
THEMES = {
    'snake': (110, 60, [0, 4, 7, 9, 7, 4, 2, 4, 7, 12, 9, 7, 4, 2, 4, 0]),
    '2048': (88, 62, [7, 4, 2, 0, 4, 7, 12, 9, 7, 4, 9, 7, 4, 2, 0, 2]),
    'tetris': (118, 60, [0, 7, 4, 7, 2, 9, 4, 9, 7, 12, 9, 7, 4, 7, 2, 0]),
    'whack': (122, 65, [0, 0, 7, 4, 2, 2, 9, 7, 4, 7, 12, 7, 9, 4, 2, 0]),
    'shooter': (116, 62, [0, 7, 12, 7, 9, 4, 7, 2, 4, 9, 12, 9, 7, 4, 2, 7]),
    'racing': (126, 60, [0, 4, 7, 12, 9, 7, 4, 7, 2, 4, 9, 12, 7, 4, 2, 0]),
    'watermelon': (96, 65, [4, 7, 9, 7, 4, 2, 0, 4, 2, 7, 4, 9, 7, 4, 2, 0]),
}
for game, (bpm, root, motif) in THEMES.items():
    beat = 60 / bpm
    track = np.zeros(round(32 * beat * RATE))
    for bar in range(8):
        chord = [(0, 4, 7), (-3, 0, 4), (-7, -3, 0), (-5, -1, 2)][bar // 2]
        for step in range(8):
            time = (bar*4 + step*.5)*beat
            pitch = root + 12 + motif[(bar*4+step) % len(motif)]
            if step != 7 or bar % 2:
                add(track, note(pitch, .65), time, .16 if step % 2 == 0 else .10)
            add(track, note(root+chord[step % 3], .4, 'pluck'), time, .055)
        for step in (0, 2):
            add(track, note(root-12+chord[0], .7, 'bass'), (bar*4+step)*beat, .14)
        for step in (1, 3):
            add(track, note(root+24, .07, 'pluck'), (bar*4+step)*beat, .035)
    with tempfile.TemporaryDirectory() as temp:
        source = Path(temp)/'loop.wav'
        wav(source, track)
        subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), '-v', 'error', '-y', '-i', str(source),
                        '-codec:a', 'libmp3lame', '-b:a', '80k', str(ROOT/(game+'.mp3'))], check=True)

EFFECTS = {
    'move': ([72, 76], .035), 'rotate': ([72, 79], .07),
    'drop': ([60, 48], .07), 'collect': ([79, 84, 88], .07),
    'merge': ([72, 76, 79, 84], .065), 'clear': ([72, 76, 79, 84, 88], .085),
    'hit': ([79, 67], .045), 'crash': ([48, 43, 36], .09),
    'start': ([72, 76, 79], .085), 'finish': ([79, 76, 72, 67, 72], .12),
    'over': ([67, 64, 60, 48], .13), 'shoot': ([88, 81], .025),
}
for name, (notes, step) in EFFECTS.items():
    track = np.zeros(int((len(notes)*step+.22)*RATE))
    for i, pitch in enumerate(notes):
        add(track, note(pitch, .18 if name == 'shoot' else .25, 'pluck'), i*step, .38)
    wav(ROOT/(name+'.wav'), track)
print('Generated 7 original music loops and 12 effects.')
