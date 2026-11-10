from pathlib import Path
import numpy as np, subprocess

# Execute from the project folder or with an absolute script path.
out=Path(__file__).resolve().parents[1]
sounds=out/'assets/sounds'
sounds.mkdir(parents=True,exist_ok=True)
sr=22050
rng=np.random.default_rng(20261105)

def decay_sin(duration, freq, decay, amp=.6, pitch_drop=0):
    t=np.arange(int(sr*duration))/sr
    phase=2*np.pi*(freq*t - pitch_drop*t*t/2)
    sig=np.sin(phase)*np.exp(-t/decay)
    sig+=0.25*np.sin(2*phase+0.3)*np.exp(-t/(decay*.55))
    sig+=0.12*np.sin(3*phase+1.1)*np.exp(-t/(decay*.4))
    return amp*sig

def noise(duration, decay, amp=.2):
    t=np.arange(int(sr*duration))/sr
    white=rng.normal(size=len(t))
    # Warm low-frequency rolling/rattle texture without any external samples.
    smooth=np.convolve(white, np.array([.11,.23,.32,.23,.11]),mode='same')
    return amp*smooth*np.exp(-t/decay)

def build_pulses(duration,pulses,base=260,noise_level=.12):
    n=int(sr*duration)
    sig=np.zeros(n)
    for time,volume,pitch in pulses:
        idx=int(time*sr)
        piece=decay_sin(min(.26,duration-time), pitch, .028,volume, pitch_drop=80)
        sig[idx:idx+len(piece)]+=piece
        sig[idx:idx+len(piece)]+=noise(len(piece)/sr,.018, noise_level*volume)
    return sig

specs={
'dice-appear':(.36,[(.012,.37,330)],.10),
'dice-reroll':(.86,[(.03,.28,300),(.13,.36,235),(.25,.31,315),(.37,.43,220),(.52,.48,270),(.65,.38,190)],.24),
'dice-place':(.34,[(.012,.63,260)],.12),
'dice-hit':(.46,[(.01,.82,188),(.05,.37,310)],.18),
'dice-fall':(.90,[(.02,.54,235),(.16,.41,280),(.32,.31,200),(.52,.21,260),(.71,.15,170)],.17),
'shield-gain':(.37,[(.03,.33,430),(.105,.23,505)],.05),
'game-finish':(.98,[(.01,.33,290),(.23,.29,345),(.46,.29,400)],.07),
}
for name,(duration,pulses,rattle) in specs.items():
    arr=build_pulses(duration,pulses,noise_level=rattle)
    t=np.arange(len(arr))/sr
    # Very soft broad wood-ish background in rolling and falling effects.
    if name in {'dice-reroll','dice-fall'}:
        arr+=noise(duration,.35,.08)*(1-np.clip(t/duration,0,1))
    # Smooth final fade to silence.
    fade=min(250,len(arr)//4)
    arr[-fade:]*=np.linspace(1,0,fade)
    arr/=max(np.max(np.abs(arr)),1)*1.6
    raw=(np.clip(arr,-1,1)*32767).astype('<i2')
    wav=sounds/(name+'.wav')
    import wave
    with wave.open(str(wav),'wb') as f:
        f.setnchannels(1);f.setsampwidth(2);f.setframerate(sr);f.writeframes(raw.tobytes())
    mp3=sounds/(name+'.mp3')
    subprocess.run(['ffmpeg','-loglevel','error','-y','-i',str(wav),'-codec:a','libmp3lame','-q:a','5',str(mp3)],check=True)
    wav.unlink()
print('created:',[(p.name,p.stat().st_size) for p in sounds.glob('*')])
