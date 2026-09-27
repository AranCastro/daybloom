"""
Synthesises Daybloom's built-in focus sounds as seamless 60-second loops.

Everything is generated here (no recordings), so the sounds carry no licence terms.
Noise is shaped in the frequency domain over the whole loop, and every event and
slow modulation wraps around the loop length, so the end joins the start without a click.

Requirements: Python 3.11, numpy 2.4, scipy 1.17, imageio-ffmpeg 0.6 (bundles ffmpeg with the LAME MP3 encoder).
Run:  python scripts/make-focus-sounds.py   -> assets/sounds/<id>.mp3 (MP3 plays on Android and in every browser)
"""
import os
import subprocess
import tempfile

import imageio_ffmpeg
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt

SR = 44100
SECONDS = 60
N = SR * SECONDS
rng = np.random.default_rng(20260927)  # fixed seed: the same files on every run
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'sounds')


def shaped_noise(shape, n=N):
    """Noise with amplitude spectrum shape(f); circular, so it loops perfectly."""
    f = np.fft.rfftfreq(n, 1 / SR)
    spec = (rng.normal(size=f.size) + 1j * rng.normal(size=f.size)) * shape(np.maximum(f, 1.0))
    spec[0] = 0
    x = np.fft.irfft(spec, n)
    return x / np.max(np.abs(x))


def band(lo, hi, slope=1.0):
    """Smooth band-pass amplitude shape with 1/f^slope tilt."""
    return lambda f: (1 / f**slope) * (1 / (1 + (lo / f) ** 4)) * (1 / (1 + (f / hi) ** 4))


def lfo(cycles, depth, phase=0.0):
    """Slow modulation with a whole number of cycles per loop (seamless)."""
    t = np.arange(N) / N
    return 1 - depth + depth * 0.5 * (1 + np.sin(2 * np.pi * cycles * t + phase))


def place(track, event, at):
    """Adds an event at sample `at`, wrapping past the end back to the start."""
    idx = (np.arange(event.size) + at) % track.size
    np.add.at(track, idx, event)


def lowpass(x, hz, order=2):
    return sosfilt(butter(order, hz, 'low', fs=SR, output='sos'), x)


def highpass(x, hz, order=2):
    return sosfilt(butter(order, hz, 'high', fs=SR, output='sos'), x)


def bandpass(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], 'band', fs=SR, output='sos'), x)


def normalise(x, peak=0.7):
    return x * (peak / np.max(np.abs(x)))


# ── The sounds ───────────────────────────────────────────────────────────────

def white_noise():
    # Soft white noise: flat, with the harshest top end rolled off.
    return normalise(shaped_noise(lambda f: 1 / (1 + (f / 9000) ** 2)), 0.5)


def rain():
    bed = shaped_noise(band(200, 4500, 0.7)) * lfo(3, 0.15)
    drops = np.zeros(N)
    for _ in range(9000):
        n = int(rng.uniform(0.003, 0.012) * SR)
        d = rng.normal(size=n) * np.exp(-np.linspace(0, 7, n))
        d = bandpass(d, rng.uniform(1500, 3500), rng.uniform(5000, 9000))
        place(drops, d * rng.uniform(0.05, 0.35), int(rng.integers(N)))
    return normalise(bed * 0.8 + drops / np.max(np.abs(drops)) * 0.35, 0.6)


def fire():
    roar = shaped_noise(band(40, 600, 1.0)) * lfo(5, 0.35) * lfo(13, 0.2, 1.0)
    crackle = np.zeros(N)
    for _ in range(1400):
        n = int(rng.uniform(0.001, 0.006) * SR)
        c = rng.normal(size=n) * np.exp(-np.linspace(0, 9, n))
        c = highpass(c, rng.uniform(1200, 3000))
        place(crackle, c * rng.uniform(0.2, 1.0) ** 2, int(rng.integers(N)))
    return normalise(roar * 0.9 + crackle / np.max(np.abs(crackle)) * 0.55, 0.6)


def wind():
    # Two layers of shaped noise under slow, uneven gusts.
    low = shaped_noise(band(80, 900, 0.8)) * (lfo(2, 0.6) * lfo(5, 0.3, 2.0))
    high = shaped_noise(band(600, 3000, 0.5)) * (lfo(3, 0.8, 1.3) * lfo(7, 0.4, 0.4))
    return normalise(low + 0.35 * high, 0.6)


def thunderstorm():
    storm = rain() * 0.8
    thunder = np.zeros(N)
    for start in (6, 27, 46):
        n = int(rng.uniform(5, 8) * SR)
        env = np.concatenate([np.linspace(0, 1, int(0.25 * SR)), np.exp(-np.linspace(0, 5, n - int(0.25 * SR)))])
        rumble = lowpass(rng.normal(size=n), 160, 4) * env
        # A few rolls inside each clap.
        rumble *= 1 + 0.6 * np.sin(np.linspace(0, rng.uniform(6, 12), n)) ** 2
        place(thunder, rumble / np.max(np.abs(rumble)) * rng.uniform(0.7, 1.0), int(start * SR))
    return normalise(storm + thunder * 0.9, 0.7)


def birds():
    bed = shaped_noise(band(150, 2500, 0.9)) * 0.06  # distant air
    song = np.zeros(N)
    t = 0.4
    while t < SECONDS - 0.2:
        kind = rng.integers(3)
        base = rng.uniform(2400, 4600)
        notes = int(rng.integers(2, 7))
        for k in range(notes):
            n = int(rng.uniform(0.05, 0.14) * SR)
            tt = np.arange(n) / SR
            if kind == 0:  # rising chirp
                freq = base * (1 + 0.5 * tt / tt[-1])
            elif kind == 1:  # falling whistle
                freq = base * (1.4 - 0.5 * tt / tt[-1])
            else:  # trill
                freq = base * (1 + 0.08 * np.sin(2 * np.pi * 38 * tt))
            phase = 2 * np.pi * np.cumsum(freq) / SR
            env = np.sin(np.pi * tt / tt[-1]) ** 2
            note = np.sin(phase) * env * rng.uniform(0.25, 0.6)
            place(song, note, int((t + k * rng.uniform(0.09, 0.2)) * SR))
        t += rng.uniform(0.8, 3.2)
    return normalise(bed + song, 0.55)


def gamma():
    # 40 Hz binaural beat: 200 Hz left, 240 Hz right, over a quiet pink bed. Needs headphones.
    t = np.arange(N) / SR
    left = np.sin(2 * np.pi * 200 * t)
    right = np.sin(2 * np.pi * 240 * t)
    bed = shaped_noise(band(60, 4000, 1.0)) * 0.12
    return np.stack([normalise(left * 0.35 + bed, 0.45), normalise(right * 0.35 + bed, 0.45)], axis=1)


SOUNDS = {
    'white-noise': white_noise,
    'rain': rain,
    'fire': fire,
    'wind': wind,
    'thunderstorm': thunderstorm,
    'birds': birds,
    'gamma': gamma,
}


def encode(name, x):
    stereo = x.ndim == 2
    with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tmp:
        wavfile.write(tmp.name, SR, (x * 32767).astype(np.int16))
    out = os.path.join(OUT, f'{name}.mp3')
    subprocess.run(
        [imageio_ffmpeg.get_ffmpeg_exe(), '-y', '-loglevel', 'error', '-i', tmp.name,
         '-c:a', 'libmp3lame', '-b:a', '112k' if stereo else '64k', out],
        check=True,
    )
    os.unlink(tmp.name)
    print(f'{out}  {os.path.getsize(out) // 1024} KB')


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    for name, make in SOUNDS.items():
        encode(name, make())
