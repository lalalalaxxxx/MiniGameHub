"""Retro synth audio. Needs numpy and imageio-ffmpeg.

Tetris: public-domain Korobeiniki folk melody, newly arranged here.
All other melodies/effects are original. No commercial recordings/samples.
"""
from pathlib import Path
import math
import subprocess
import tempfile
import wave
import numpy as np
import imageio_ffmpeg

ROOT = Path(__file__).resolve().parents[1] / 'assets' / 'audio'
RATE = 24000
RNG = np.random.default_rng(1989)


def envelope(length, attack=.006, release=.035):
    t = np.arange(round(length * RATE)) / RATE
    return t, np.minimum(t / attack, 1) * np.minimum((length-t) / release, 1)


def oscillator(phase, kind):
    if kind == 'pulse':
        # Limited odd harmonics: handheld tone without a harsh square-wave buzz.
        return (np.sin(phase) + .22*np.sin(3*phase) + .08*np.sin(5*phase)) / 1.3
    if kind == 'triangle':
        return np.sin(phase) - np.sin(3*phase)/9 + np.sin(5*phase)/25
    if kind == 'pluck':
        return np.sin(phase) + .18*np.sin(2*phase)
    return np.sin(phase)


def note(midi, length, kind='triangle'):
    t, env = envelope(length)
    frequency = 440 * 2 ** ((midi-69)/12)
    decay = np.exp(-t * (9 if kind == 'pluck' else 2.5))
    return oscillator(2*np.pi*frequency*t, kind) * env * decay


def sweep(start, end, length, kind='pulse'):
    t, env = envelope(length, .003, min(.04, length/3))
    frequencies = start * (end/start) ** (t/length)
    return oscillator(2*np.pi*np.cumsum(frequencies)/RATE, kind) * env * np.exp(-t*5)


def noise(length, cutoff=1400):
    t, env = envelope(length, .002, .04)
    raw = RNG.uniform(-1, 1, len(t))
    width = max(3, RATE//cutoff)
    return np.convolve(raw, np.ones(width)/width, mode='same') * env * np.exp(-t*12)


def add(track, sound, seconds, gain=1, loop=True):
    indexes = round(seconds*RATE) + np.arange(len(sound))
    if loop:
        np.add.at(track, indexes % len(track), sound*gain)
    else:
        valid = indexes < len(track)
        track[indexes[valid]] += sound[valid]*gain


def normalize(data, peak, rms=None):
    scale = peak / max(np.max(np.abs(data)), 1e-9)
    if rms:
        scale = min(scale, rms / max(np.sqrt(np.mean(data**2)), 1e-9))
    return data*scale


def wav(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    assert np.max(np.abs(data)) < .96
    with wave.open(str(path), 'wb') as out:
        out.setparams((1, 2, RATE, 0, 'NONE', 'not compressed'))
        out.writeframes((data*32767).astype('<i2').tobytes())


def music(game, bpm, melody, bass, kind, percussion=False):
    beat = 60/bpm
    beats = math.ceil(sum(duration for _, duration in melody)/4)*4
    track = np.zeros(round(beats*beat*RATE))
    cursor = 0
    for pitch, duration in melody:
        if pitch is not None:
            add(track, note(pitch, duration*beat*.80, kind), cursor*beat, .18)
        cursor += duration
    for bar in range(beats//4):
        root = bass[bar % len(bass)]
        for offset in (0, 2):
            add(track, note(root, beat*.65, 'triangle'), (bar*4+offset)*beat, .10)
        if percussion:
            for offset in (1, 3):
                add(track, noise(.055, 2400), (bar*4+offset)*beat, .06)
    track = normalize(track, .32, .085)
    with tempfile.TemporaryDirectory() as temp:
        source = Path(temp)/'loop.wav'
        wav(source, track)
        subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), '-v', 'error', '-y', '-i', str(source),
                        '-codec:a', 'libmp3lame', '-b:a', '80k', str(ROOT/(game+'.mp3'))], check=True)


def phrase(pitches, durations):
    assert len(pitches) == len(durations)
    return list(zip(pitches, durations))


def make_music():
    # Sparse two-channel patterns instead of continuous high-pitched arpeggios.
    music('snake', 100, phrase(
        [72, 76, 79, None, 76, 74, 72, None, 74, 77, 81, None, 79, 76, 72, None],
        [1, .5, .5, 2]*4)*2, [48, 48, 53, 55], 'pulse')
    music('2048', 76, phrase(
        [64, None, 67, None, 69, None, 67, None, 65, None, 64, None, 62, None, 60, None],
        [1, 3]*8), [48, 45, 53, 55], 'pluck')
    folk = phrase(
        [76, 71, 72, 74, 72, 71, 69, 69, 72, 76, 74, 72,
         71, 72, 74, 76, 72, 69, 69, None,
         74, 77, 81, 79, 77, 76, 72, 76, 74, 72,
         71, 71, 72, 74, 76, 72, 69, 69, None],
        [1, .5, .5, 1, .5, .5, 1, .5, .5, 1, .5, .5,
         1.5, .5, 1, 1, 1, 1, 1, 1,
         1.5, .5, 1, .5, .5, 1.5, .5, 1, .5, .5,
         1, .5, .5, 1, 1, 1, 1, 1, 1])
    music('tetris', 112, folk, [45, 45, 40, 45, 50, 45, 40, 45], 'pulse')
    music('whack', 112, phrase(
        [72, 76, 79, 76, None, 74, 77, 81, 77, None,
         76, 79, 84, 79, None, 77, 74, 71, 72, None],
        [.5, .5, .5, .5, 2]*4)*2, [48, 50, 53, 55], 'pluck', True)
    music('shooter', 116, phrase(
        [69, 76, 81, None, 79, 76, 72, None, 65, 72, 77, None, 71, 76, 68, None],
        [.5, .5, 1, 2]*4)*2, [45, 48, 41, 40], 'pulse', True)
    music('racing', 124, phrase(
        [60, 67, 72, 67, None, 64, 69, 76, 69, None,
         65, 72, 77, 72, None, 67, 74, 79, 74, None],
        [.5, .5, .5, .5, 2]*4)*2, [36, 45, 41, 43], 'triangle', True)
    music('watermelon', 88, phrase(
        [72, 76, 79, None, 76, 74, 72, None, 69, 72, 77, None, 74, 71, 72, None],
        [1, .5, .5, 2]*4)*2, [48, 45, 53, 55], 'pluck')


def chime(notes, step=.065, kind='pulse'):
    track = np.zeros(round((len(notes)*step+.16)*RATE))
    for i, pitch in enumerate(notes):
        add(track, note(pitch, step+.10, kind), i*step, loop=False)
    return track


def mix(*sounds):
    out = np.zeros(max(map(len, sounds)))
    for sound in sounds:
        out[:len(sound)] += sound
    return out


def make_effects():
    effects = {
        'move': sweep(560, 420, .045, 'triangle'),
        'rotate': chime([72, 79], .04),
        'drop': mix(sweep(180, 55, .13, 'triangle'), noise(.07)*.4),
        'collect': chime([79, 91], .055),
        'merge': chime([72, 76, 84], .06, 'pluck'),
        'clear': chime([72, 76, 79, 84], .055),
        'hit': mix(sweep(240, 70, .12, 'triangle'), noise(.09)*.6),
        'crash': mix(noise(.28)*2, sweep(120, 35, .25, 'triangle')*.5),
        'start': chime([60, 67, 72], .09),
        'finish': chime([72, 76, 79, 84, 79, 84], .10),
        'over': chime([72, 67, 64, 60, 48], .12, 'triangle'),
        'shoot': sweep(1800, 280, .075),
        'snake/collect': chime([84, 88], .045),
        'whack/hit': mix(sweep(430, 100, .09, 'triangle'), noise(.055)*.5),
        'shooter/hit': mix(noise(.18)*1.6, sweep(180, 45, .16)*.5),
        'watermelon/drop': sweep(320, 140, .11, 'sine'),
        'watermelon/merge': mix(sweep(280, 900, .14, 'sine'), chime([79, 84], .065, 'pluck')*.3),
        '2048/move': noise(.055, 900),
        '2048/merge': chime([72, 79], .055, 'pluck'),
    }
    for name, sound in effects.items():
        wav(ROOT/(name+'.wav'), normalize(sound, .48))
    print(f'Generated 7 retro music loops and {len(effects)} effects.')


if __name__ == '__main__':
    ROOT.mkdir(parents=True, exist_ok=True)
    make_music()
    make_effects()
