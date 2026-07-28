export function createAudioSystem(){
  let context=null,master=null,oceanGain=null,windGain=null,creakGain=null;
  function noiseSource(filterFrequency){
    const length=context.sampleRate*2,buffer=context.createBuffer(1,length,context.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<length;i++)data[i]=Math.random()*2-1;
    const source=context.createBufferSource();source.buffer=buffer;source.loop=true;const filter=context.createBiquadFilter();filter.type='lowpass';filter.frequency.value=filterFrequency;source.connect(filter);return{source,filter};
  }
  function start(){if(context)return;context=new AudioContext();master=context.createGain();master.gain.value=.16;master.connect(context.destination);const ocean=noiseSource(580);oceanGain=context.createGain();oceanGain.gain.value=.24;ocean.filter.connect(oceanGain);oceanGain.connect(master);ocean.source.start();const wind=noiseSource(1300);windGain=context.createGain();windGain.gain.value=.05;wind.filter.connect(windGain);windGain.connect(master);wind.source.start();const creak=context.createOscillator();creak.type='triangle';creak.frequency.value=78;creakGain=context.createGain();creakGain.gain.value=0;creak.connect(creakGain);creakGain.connect(master);creak.start()}
  function update(speedKnots,environment){if(!context)return;const now=context.currentTime;oceanGain.gain.linearRampToValueAtTime(.16+Math.min(speedKnots,10)*.018,now+.15);windGain.gain.linearRampToValueAtTime(.025+environment.windSpeed*.012,now+.15);creakGain.gain.linearRampToValueAtTime(Math.max(0,environment.waveIntensity-1)*.025,now+.2)}
  return{start,update,resume(){context?.resume()}};
}
