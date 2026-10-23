"""Original tactile arcade sounds, synthesized without samples or libraries.

Run with Python's standard library. Each mono sound uses layered resonances,
short natural decays and click-free boundaries. No background music is made.
Keep names inside audio.js's twelve standard effects so offline preloads stay
bounded. Seeds are local and stable, making committed PCM reproducible.
"""
from pathlib import Path
import math
import random
import struct
import wave

ROOT = Path(__file__).resolve().parents[1] / 'assets/audio'
RATE = 24000
TAU = math.tau
REPORT = []


class Sound:
    def __init__(self, duration, peak=.44, seed=57):
        self.samples = [0.] * round(duration * RATE)
        self.peak = peak
        self.rng = random.Random(seed)

    def tone(self, at, length, hz, amp=1., end=None, decay=7.,
             partials=((1., 1.),), attack=.002):
        """A phase-continuous exponential pitch sweep with modal resonances."""
        first = round(at * RATE)
        count = min(round(length * RATE), len(self.samples) - first)
        k = math.log(end / hz) / length if end and end != hz else 0.
        for n in range(max(0, count)):
            t = n / RATE
            phase = TAU * hz * math.expm1(k * t) / k if k else TAU * hz * t
            env = min(1., t / attack) * math.exp(-decay * t / length)
            env *= min(1., (length - t) / .012)
            self.samples[first + n] += amp * env * sum(
                weight * math.sin(phase * ratio) for ratio, weight in partials)
        return self

    def noise(self, at, length, amp=.2, low=450., high=2800., decay=7.):
        """Band-limited air/impact; independent local RNG for deterministic PCM."""
        first = round(at * RATE)
        count = min(round(length * RATE), len(self.samples) - first)
        top = bottom = 0.
        a = 1. - math.exp(-TAU * high / RATE)
        b = 1. - math.exp(-TAU * low / RATE)
        for n in range(max(0, count)):
            t = n / RATE
            top += a * (self.rng.uniform(-1., 1.) - top)
            bottom += b * (top - bottom)
            env = min(1., t / .002) * math.exp(-decay * t / length)
            env *= min(1., (length - t) / .012)
            self.samples[first + n] += amp * env * (top - bottom)
        return self

    def pluck(self, at, hz, amp=.55, length=.24, material='glass'):
        partials = {
            'glass': ((1., 1.), (2.76, .20), (4.07, .075)),
            'wood': ((1., 1.), (2.34, .26), (3.85, .08)),
            'bell': ((1., 1.), (2., .28), (3., .08)),
            'metal': ((1., 1.), (1.49, .38), (2.73, .23), (4.17, .08)),
        }[material]
        # High partials decay separately so attacks sparkle without a long buzz.
        for ratio, weight in partials:
            self.tone(at, length / (1 + (ratio - 1) * .16), hz * ratio,
                      amp * weight, decay=5.8, attack=.0018)
        return self

    def pop(self, at=0., hz=920., amp=.8, length=.11):
        self.tone(at, length, hz, amp, end=hz * .18, decay=6.,
                  partials=((1., 1.), (2., .12)))
        self.tone(at + .008, length, 115., amp * .3, end=64., decay=7.)
        self.noise(at, .048, amp * .15, low=900., high=3400., decay=8.)
        return self

    def notes(self, at, hz, ratios=(1., 1.25, 1.5, 2.), spacing=.09,
              amp=.4, length=.27, material='bell'):
        for i, ratio in enumerate(ratios):
            self.pluck(at + i * spacing, hz * ratio, amp, length, material)
        return self

    def write(self, game, name):
        # Remove DC, then cosine fades at both file boundaries prevent clicks.
        samples = self.samples
        mean = sum(samples) / len(samples)
        for i, value in enumerate(samples):
            start = min(1., i / (RATE * .0015))
            end = min(1., (len(samples) - 1 - i) / (RATE * .016))
            samples[i] = (value - mean) * (.5 - .5 * math.cos(math.pi * start)) \
                * (.5 - .5 * math.cos(math.pi * end))
        max_value = max(abs(value) for value in samples)
        gain = self.peak / max_value
        pcm = [round(value * gain * 32767) for value in samples]
        assert pcm[0] == pcm[-1] == 0
        assert max(abs(value) for value in pcm) < 32767
        folder = ROOT / game
        folder.mkdir(parents=True, exist_ok=True)
        with wave.open(str(folder / (name + '.wav')), 'wb') as out:
            out.setparams((1, 2, RATE, 0, 'NONE', 'not compressed'))
            out.writeframes(struct.pack('<' + 'h' * len(pcm), *pcm))
        rms = math.sqrt(sum((value / 32767) ** 2 for value in pcm) / len(pcm))
        REPORT.append((game, name, len(pcm) / RATE, self.peak, rms))


def retry(game, hz):
    # A soft falling phrase, never an alarm or punitive buzzer.
    Sound(.48, .34).notes(0., hz, (1., .84), spacing=.14, amp=.6,
                         length=.3, material='wood').write(game, 'over')


def bubbles():
    game = 'bubblepop'
    Sound(.19, .40).noise(0., .12, .23, low=400., high=2100., decay=4.) \
        .tone(.008, .15, 180., .7, end=680., decay=3.8) \
        .pop(.095, 950., .22, .065).write(game, 'shoot')
    Sound(.09, .29).pop(hz=600., length=.075).write(game, 'hit')
    Sound(.12, .31).pop(hz=730., length=.105).write(game, 'drop')
    sound = Sound(.32, .48)
    for at, hz, amp in ((0., 1120., .8), (.026, 1420., .52),
                        (.063, 790., .55), (.102, 1720., .28)):
        sound.pop(at, hz, amp)
    sound.pluck(.14, 1175., .12, .14).write(game, 'clear')
    sound = Sound(.56, .46)
    for i, hz in enumerate((1200., 980., 840., 640., 470.)):
        sound.pop(i * .054, hz, .50 - i * .035)
    sound.notes(.20, 740., (1., 1.25, 1.5), spacing=.065,
                amp=.18, length=.22).write(game, 'merge')
    Sound(.89, .46).pop(0., 820., .32).notes(.09, 587.33,
        (1., 1.25, 1.5, 2.), spacing=.13, length=.39) \
        .notes(.52, 1174.66, (1., 1.25), spacing=.05,
               amp=.12, length=.3).write(game, 'finish')
    retry(game, 587.33)


def bricks():
    game = 'brickball'
    Sound(.095, .32).pluck(0., 490., .55, .08, 'wood') \
        .noise(0., .034, .08, low=700., high=2500.).write(game, 'shoot')
    Sound(.115, .40).pluck(0., 805., .6, .105) \
        .tone(0., .047, 150., .14, end=100.) \
        .noise(.003, .035, .04, low=800., high=3000.).write(game, 'hit')
    sound = Sound(.25, .46)
    sound.noise(0., .17, .25, low=1200., high=3900., decay=6.)
    for at, hz, amp in ((0., 1100., .55), (.019, 1610., .28),
                        (.043, 1240., .23), (.076, 2070., .12)):
        sound.pluck(at, hz, amp, .15)
    sound.tone(0., .095, 160., .14, end=75.).write(game, 'clear')
    Sound(.33, .42).notes(0., 880., (1., 1.5), spacing=.065,
                         length=.24).write(game, 'collect')
    Sound(.82, .46).notes(0., 523.25, (1., 1.25, 1.5, 2.),
                         spacing=.115, length=.39) \
        .pluck(.35, 261.63, .16, .43, 'wood').write(game, 'finish')
    retry(game, 523.25)


def miner():
    game = 'goldminer'
    sound = Sound(.25, .41)
    sound.pluck(0., 280., .52, .15, 'metal')
    for i in range(4):
        sound.noise(.025 + i * .03, .037, .11 - i * .016,
                    low=500., high=2300., decay=7.)
        sound.pluck(.025 + i * .03, 520. + i * 27., .08, .048, 'metal')
    sound.write(game, 'shoot')
    Sound(.19, .44).tone(0., .13, 130., .48, end=75., decay=6.) \
        .pluck(.004, 340., .37, .18, 'metal') \
        .noise(0., .065, .14, low=230., high=1700.).write(game, 'hit')
    Sound(.22, .40).noise(0., .20, .6, low=190., high=1800., decay=6.) \
        .tone(0., .18, 170., .5, end=62.) \
        .pluck(.04, 290., .15, .12, 'wood').write(game, 'clear')
    sound = Sound(.48, .46)
    for at, hz in ((0., 1318.51), (.065, 1567.98), (.14, 2093.)):
        sound.pluck(at, hz, .40, .29, 'metal')
    sound.pluck(.15, 659.25, .18, .27, 'bell').write(game, 'collect')
    Sound(.30, .40).noise(0., .24, .25, low=200., high=1600., decay=3.8) \
        .tone(0., .26, 145., .5, end=590., decay=3.,
              partials=((1., 1.), (2., .12))) \
        .pluck(.14, 880., .12, .14, 'metal').write(game, 'merge')
    Sound(.93, .46).notes(0., 659.25, (1., 1.25, 1.5, 2.),
                         spacing=.13, length=.36, material='metal') \
        .pluck(.40, 329.63, .2, .43, 'wood') \
        .pluck(.52, 1318.51, .18, .32).write(game, 'finish')
    retry(game, 659.25)


def ropes():
    game = 'ropefeast'
    # Fibres snap, followed by a muted loose-string twang.
    Sound(.145, .42).noise(0., .065, .70, low=850., high=3500., decay=5.) \
        .noise(.012, .055, .18, low=1800., high=4700., decay=6.) \
        .tone(.006, .115, 310., .24, end=170., decay=5.,
              partials=((1., 1.), (2., .15))).write(game, 'rotate')
    Sound(.16, .43).pop(hz=1480., length=.12) \
        .noise(0., .035, .10, low=1700., high=4600.).write(game, 'drop')
    # A separate fan toggle avoids playing a bubble burst for the switch.
    Sound(.14, .33).pluck(0., 370., .55, .09, 'wood') \
        .noise(.025, .11, .14, low=300., high=1300., decay=3.).write(game, 'move')
    Sound(.36, .43).notes(0., 1046.5, (1., 1.5), spacing=.055,
                         length=.27, amp=.38) \
        .pluck(.09, 2093., .10, .18).write(game, 'collect')
    # Two soft mouth movements then a happy rising phrase; no voice recordings.
    sound = Sound(.96, .46)
    for at in (0., .09):
        sound.tone(at, .12, 175., .48, end=85., decay=4.,
                   partials=((1., 1.), (2., .24), (3., .06)))
        sound.noise(at + .012, .07, .16, low=350., high=1300., decay=5.)
    sound.notes(.22, 698.46, (1., 1.25, 1.5, 2.), spacing=.10,
                length=.37, amp=.22).write(game, 'finish')
    retry(game, 698.46)


def snail():
    game = 'snailquest'
    Sound(.22, .43).pluck(0., 320., .6, .12, 'wood') \
        .pluck(.065, 205., .3, .14, 'wood') \
        .noise(.015, .12, .1, low=180., high=1800., decay=4.).write(game, 'drop')
    Sound(.38, .43).notes(0., 783.99, (1., 1.5), spacing=.08,
                         length=.27, amp=.38, material='wood') \
        .pluck(.08, 1567.98, .10, .26, 'bell').write(game, 'collect')
    Sound(.93, .46).notes(0., 523.25, (1., 1.25, 1.5, 2.),
                         spacing=.13, length=.38, material='wood') \
        .notes(.25, 1046.5, (1., 1.5), spacing=.16,
               amp=.11, length=.38).write(game, 'finish')
    retry(game, 523.25)


if __name__ == '__main__':
    for generate in (bubbles, bricks, miner, ropes, snail):
        generate()
    for game, name, duration, peak, rms in REPORT:
        print(f'{game:11} {name:7} {duration:5.3f}s  '
              f'peak={peak:.2f}  RMS={20 * math.log10(rms):5.1f} dBFS')
    print(f'Generated {len(REPORT)} original effects; mono PCM, {RATE} Hz, '
          '16-bit. All boundaries zero; no clipping.')
