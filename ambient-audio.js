'use strict';

(() => {
  const preferenceKey='tefinanza-ambient-audio-v1';
  const defaultPreferences={enabled:true,volume:0.14,track:'rain'};
  const tracks={
    rain:{label:'Theta 6 Hz · Pioggia',beat:6,tempo:9000,chords:[[130.81,164.81,196,246.94],[110,130.81,164.81,196],[87.31,130.81,174.61,220],[98,146.83,196,220]],notes:[329.63,392,523.25,392,293.66,349.23,440,349.23,261.63,329.63,392,329.63]},
    ocean:{label:'Theta 7 Hz · Onde',beat:7,tempo:11000,chords:[[146.83,174.61,220,261.63],[110,146.83,174.61,220],[98,130.81,164.81,196],[116.54,146.83,174.61,233.08]],notes:[293.66,349.23,440,349.23,261.63,329.63,392,329.63,220,293.66,349.23,293.66]},
    focus:{label:'Alpha 10 Hz · Focus',beat:10,tempo:7600,chords:[[164.81,196,246.94,293.66],[130.81,164.81,196,246.94],[110,146.83,174.61,220],[146.83,174.61,220,261.63]],notes:[392,440,523.25,440,349.23,392,493.88,392,293.66,349.23,440,349.23]}
  };
  const control=document.getElementById('ambientPlayer'),toggle=document.getElementById('ambientToggle'),slider=document.getElementById('ambientVolume'),status=document.getElementById('ambientStatus'),selector=document.getElementById('ambientTrack');
  if(!control||!toggle||!slider||!status||!selector)return;
  function readPreferences(){
    try{const saved=JSON.parse(localStorage.getItem(preferenceKey)||'null');return{enabled:typeof saved?.enabled==='boolean'?saved.enabled:defaultPreferences.enabled,volume:Number.isFinite(saved?.volume)?Math.min(1,Math.max(0,saved.volume)):defaultPreferences.volume,track:tracks[saved?.track]?saved.track:defaultPreferences.track}}
    catch{return{...defaultPreferences}}
  }
  let preferences=readPreferences(),audioContext=null,master=null,compressor=null,convolver=null,padFilter=null,voicePairs=[],binaural=[],chordTimer=0,scoreTimer=0,chordIndex=0,scoreIndex=0,playing=false;
  function savePreferences(){try{localStorage.setItem(preferenceKey,JSON.stringify(preferences))}catch{}}
  function updateUI(){
    toggle.setAttribute('aria-pressed',String(preferences.enabled));toggle.setAttribute('aria-label',preferences.enabled?'Disattiva audio ambientale':'Attiva audio ambientale');
    slider.value=String(Math.round(preferences.volume*100));selector.value=preferences.track;
    status.textContent=!preferences.enabled?'In pausa':!playing?'Avvio al primo tocco':preferences.volume===0?'Volume zero · audio attivo':'Riproduzione in corso';control.dataset.playing=String(playing&&preferences.enabled)
  }
  function makeImpulse(ctx){const length=Math.floor(ctx.sampleRate*3.2),buffer=ctx.createBuffer(2,length,ctx.sampleRate);for(let c=0;c<2;c++){const data=buffer.getChannelData(c);for(let i=0;i<length;i++)data[i]=(Math.random()*2-1)*Math.pow(1-i/length,3.4)*(c?.78:1)}return buffer}
  function createGraph(){
    const AudioContextClass=window.AudioContext||window.webkitAudioContext;if(!AudioContextClass)throw new Error('Audio non supportato in questo browser.');
    audioContext=new AudioContextClass();master=audioContext.createGain();master.gain.value=0;compressor=audioContext.createDynamicsCompressor();compressor.threshold.value=-25;compressor.knee.value=18;compressor.ratio.value=2.2;compressor.attack.value=.2;compressor.release.value=.8;master.connect(compressor);compressor.connect(audioContext.destination);
    convolver=audioContext.createConvolver();convolver.buffer=makeImpulse(audioContext);const wet=audioContext.createGain();wet.gain.value=.18;master.connect(convolver);convolver.connect(wet);wet.connect(compressor);
    padFilter=audioContext.createBiquadFilter();padFilter.type='lowpass';padFilter.frequency.value=980;padFilter.Q.value=.35;const padLevel=audioContext.createGain();padLevel.gain.value=.3;padFilter.connect(padLevel);padLevel.connect(master);
    for(let i=0;i<4;i++){const base=audioContext.createOscillator(),harmonic=audioContext.createOscillator(),baseGain=audioContext.createGain(),harmonicGain=audioContext.createGain();base.type='sine';harmonic.type='sine';harmonic.detune.value=i%2?4:-4;baseGain.gain.value=.13;harmonicGain.gain.value=.035;base.connect(baseGain);harmonic.connect(harmonicGain);baseGain.connect(padFilter);harmonicGain.connect(padFilter);base.start();harmonic.start();voicePairs.push({base,harmonic})}
    const carrier=220;
    for(const pan of [-1,1]){const osc=audioContext.createOscillator(),gain=audioContext.createGain(),panner=audioContext.createStereoPanner();osc.type='sine';gain.gain.value=.055;panner.pan.value=pan;osc.connect(gain);gain.connect(panner);panner.connect(master);osc.start();binaural.push(osc)}
    updateBinaural();setChord(0)
  }
  function updateBinaural(){if(!audioContext||!binaural.length)return;const now=audioContext.currentTime,half=tracks[preferences.track].beat/2;binaural[0].frequency.setTargetAtTime(220-half,now,.5);binaural[1].frequency.setTargetAtTime(220+half,now,.5)}
  function setChord(index){if(!audioContext)return;const chord=tracks[preferences.track].chords[index%tracks[preferences.track].chords.length],now=audioContext.currentTime;chordIndex=index%tracks[preferences.track].chords.length;chord.forEach((frequency,i)=>{voicePairs[i].base.frequency.setTargetAtTime(frequency,now,7);voicePairs[i].harmonic.frequency.setTargetAtTime(frequency*1.5,now,7)})}
  function scheduleBed(){
    clearInterval(chordTimer);clearTimeout(scoreTimer);chordTimer=setInterval(()=>{if(preferences.enabled)setChord(chordIndex+1)},tracks[preferences.track].tempo*4);
    const playScoreNote=()=>{if(!preferences.enabled)return;const notes=tracks[preferences.track].notes,now=audioContext.currentTime,frequency=notes[scoreIndex++%notes.length],tone=audioContext.createOscillator(),overtone=audioContext.createOscillator(),envelope=audioContext.createGain(),filter=audioContext.createBiquadFilter();tone.type='sine';tone.frequency.value=frequency;overtone.type='sine';overtone.frequency.value=frequency*2;filter.type='lowpass';filter.frequency.value=1650;filter.Q.value=.25;envelope.gain.setValueAtTime(.0001,now);envelope.gain.exponentialRampToValueAtTime(.055,now+1.1);envelope.gain.exponentialRampToValueAtTime(.0001,now+6.2);tone.connect(filter);overtone.connect(filter);filter.connect(envelope);envelope.connect(master);tone.start(now);overtone.start(now);tone.stop(now+6.3);overtone.stop(now+6.3);scoreTimer=setTimeout(playScoreNote,tracks[preferences.track].tempo+Math.random()*1700)};
    scoreTimer=setTimeout(playScoreNote,3200)
  }
  async function startAudio(){try{if(!audioContext)createGraph();if(audioContext.state==='suspended')await audioContext.resume();if(!preferences.enabled)return;playing=true;master.gain.cancelScheduledValues(audioContext.currentTime);master.gain.setTargetAtTime(preferences.volume,audioContext.currentTime,.75);scheduleBed();updateUI()}catch(error){playing=false;preferences.enabled=false;savePreferences();status.textContent=error.message||'Audio non disponibile';updateUI()}}
  function pauseAudio(){preferences.enabled=false;savePreferences();if(audioContext&&master){master.gain.cancelScheduledValues(audioContext.currentTime);master.gain.setTargetAtTime(0,audioContext.currentTime,.32)}clearInterval(chordTimer);clearTimeout(scoreTimer);playing=false;updateUI()}
  toggle.addEventListener('click',()=>{if(preferences.enabled)pauseAudio();else{preferences.enabled=true;savePreferences();updateUI();startAudio()}});
  slider.addEventListener('input',()=>{preferences.volume=Number(slider.value)/100;savePreferences();if(preferences.enabled&&playing&&master){master.gain.cancelScheduledValues(audioContext.currentTime);master.gain.setTargetAtTime(preferences.volume,audioContext.currentTime,.18)}});
  selector.addEventListener('change',()=>{preferences.track=tracks[selector.value]?selector.value:defaultPreferences.track;scoreIndex=0;savePreferences();updateBinaural();setChord(0);if(playing)scheduleBed()});
  function startAfterGesture(event){if(event.target.closest?.('#ambientPlayer'))return;document.removeEventListener('pointerdown',startAfterGesture);document.removeEventListener('keydown',startAfterGesture);if(preferences.enabled)startAudio()}
  document.addEventListener('pointerdown',startAfterGesture,{passive:true});document.addEventListener('keydown',startAfterGesture);updateUI()
})();
