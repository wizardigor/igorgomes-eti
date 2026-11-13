// Per-scene processing shared by playback and video export.
export const voiceStyles=['clean','robot','alien','radio','deep'];
export function voiceChain(ac,source,scene){
 const nodes=[],oscillators=[];
 let tail=source;
 function connect(node){tail.connect(node);nodes.push(node);tail=node;return node;}
 function filter(type,freq,gain=0){
  const f=ac.createBiquadFilter();f.type=type;f.frequency.value=freq;f.gain.value=gain;connect(f);
 }
 function modulate(freq,depth,type){
  const carrier=connect(ac.createGain());carrier.gain.value=1-depth/2;
  const oscillator=ac.createOscillator(),amount=ac.createGain();
  oscillator.type=type;oscillator.frequency.value=freq;amount.gain.value=depth/2;
  oscillator.connect(amount);amount.connect(carrier.gain);oscillator.start();oscillators.push(oscillator);nodes.push(amount);
 }
 switch(scene.voiceStyle){
  case 'robot':filter('bandpass',1350);modulate(54,.9,'square');break;
  case 'alien':filter('peaking',1650,8);modulate(19,.72,'sine');modulate(41,.55,'triangle');break;
  case 'radio':filter('highpass',350);filter('lowpass',3000);filter('peaking',1550,4);break;
  case 'deep':filter('lowshelf',340,6);filter('highshelf',2500,-8);break;
 }
 filter('lowshelf',220,scene.bass);
 filter('peaking',1400,scene.mids);
 filter('highshelf',4000,scene.treble);
 const gain=connect(ac.createGain());gain.gain.value=scene.volume;
 const limit=connect(ac.createDynamicsCompressor());limit.threshold.value=-5;limit.ratio.value=12;
 return {output:tail,stop(){for(const o of oscillators){o.stop();o.disconnect();}for(const n of nodes)n.disconnect();}};
}
