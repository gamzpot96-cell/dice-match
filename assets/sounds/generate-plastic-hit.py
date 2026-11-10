"""Dice Match original crisp plastic-dice hit: short 'ttaak' with soft ring."""
from pathlib import Path
import numpy as np
import subprocess
import wave
sr = 44100
length = 0.30
t = np.arange(int(sr * length)) / sr
rng = np.random.default_rng(20261105)
# A very short high-frequency crack on contact (no imported recordings).
noise = rng.standard_normal(len(t))
high = noise - np.convolve(noise, np.ones(41) / 41, mode="same")
attack = 0.78 * high * np.exp(-t / 0.0044)
# Hollow, bright plastic-body resonance fades quickly but is audible after the crack.
resonance = (
    0.63 * np.sin(2 * np.pi * (1140 * t + 65 * t*t) + 0.3) * np.exp(-t / 0.078)
    + 0.35 * np.sin(2 * np.pi * 1760 * t + 0.8) * np.exp(-t / 0.10)
    + 0.24 * np.sin(2 * np.pi * 2540 * t + 1.3) * np.exp(-t / 0.044)
)
# Tiny secondary click, like two hard plastic corners briefly making contact.
delayed = np.zeros_like(t)
delay = int(sr * 0.011)
delayed[delay:] = 0.19 * high[:len(t)-delay] * np.exp(-t[:len(t)-delay]/0.003)
signal = attack + resonance + delayed
signal *= np.minimum(1.0, t/0.00055)
fade = int(sr * 0.045)
signal[-fade:] *= np.linspace(1, 0, fade)
signal *= 0.85 / max(np.max(np.abs(signal)), 1e-9)
p = Path(__file__).resolve().parent
wav = p / 'dice-hit-temp.wav'
with wave.open(str(wav), 'wb') as f:
    f.setnchannels(1)
    f.setsampwidth(2)
    f.setframerate(sr)
    f.writeframes((np.clip(signal,-1,1)*32767).astype('<i2').tobytes())
subprocess.run(['ffmpeg','-v','error','-y','-i',str(wav),'-codec:a','libmp3lame','-q:a','3',str(p/'dice-hit.mp3')],check=True)
wav.unlink()
