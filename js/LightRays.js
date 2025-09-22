/*  Vanilla LightRays  –  drop-in replacement for the React component  */
(() => {
  const VERT = `
attribute vec2 position;
varying vec2 vUv;
void main(){
  vUv=position*.5+.5;
  gl_Position=vec4(position,0.,1.);
}`;

  const FRAG = `
precision highp float;
uniform float iTime;
uniform vec2  iResolution;
uniform vec2  rayPos;
uniform vec2  rayDir;
uniform vec3  raysColor;
uniform float raysSpeed;
uniform float lightSpread;
uniform float rayLength;
uniform float pulsating;
uniform float fadeDistance;
uniform float saturation;
uniform vec2  mousePos;
uniform float mouseInfluence;
uniform float noiseAmount;
uniform float distortion;
varying vec2 vUv;

float noise(vec2 st){ return fract(sin(dot(st.xy,vec2(12.9898,78.233)))*43758.5453123); }

float rayStrength(vec2 raySource,vec2 rayRefDirection,vec2 coord,float seedA,float seedB,float speed){
  vec2 srcToCoord=coord-raySource;
  vec2 dirNorm=normalize(srcToCoord);
  float cosAngle=dot(dirNorm,rayRefDirection);
  float distortedAngle=cosAngle+distortion*sin(iTime*2.+length(srcToCoord)*.01)*.2;
  float spread=pow(max(distortedAngle,0.),1./max(lightSpread,.001));
  float dist=length(srcToCoord);
  float maxDist=iResolution.x*rayLength;
  float falloff=clamp((maxDist-dist)/maxDist,0.,1.);
  float fade=clamp((iResolution.x*fadeDistance-dist)/(iResolution.x*fadeDistance),.5,1.);
  float pulse=pulsating>.5?.8+.2*sin(iTime*speed*3.):1.;
  float str=.45+.15*sin(distortedAngle*seedA+iTime*speed)+.3+.2*cos(-distortedAngle*seedB+iTime*speed);
  return clamp(str,0.,1.)*falloff*fade*spread*pulse;
}

void main(){
  vec2 coord=vec2(gl_FragCoord.x,iResolution.y-gl_FragCoord.y);
  vec2 finalRayDir=rayDir;
  if(mouseInfluence>0.){
    vec2 mouseScreen=mousePos*iResolution.xy;
    vec2 mouseDir=normalize(mouseScreen-rayPos);
    finalRayDir=normalize(mix(rayDir,mouseDir,mouseInfluence));
  }
  vec4 rays1=vec4(1.)*rayStrength(rayPos,finalRayDir,coord,36.2214,21.11349,1.5*raysSpeed);
  vec4 rays2=vec4(1.)*rayStrength(rayPos,finalRayDir,coord,22.3991,18.0234,1.1*raysSpeed);
  vec4 col=rays1*.5+rays2*.4;
  if(noiseAmount>0.){
    float n=noise(coord*.01+iTime*.1);
    col.rgb*=1.-noiseAmount+noiseAmount*n;
  }
  float bright=1.-coord.y/iResolution.y;
  col.r*=.1+bright*.8; col.g*=.3+bright*.6; col.b*=.5+bright*.5;
  if(saturation!=1.){
    float gray=dot(col.rgb,vec3(.299,.587,.114));
    col.rgb=mix(vec3(gray),col.rgb,saturation);
  }
  col.rgb*=raysColor;
  gl_FragColor=col;
}`;

  /* ---------- helpers ---------- */
  const hexToRgb = h => {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(h);
    return m ? [parseInt(m[1],16)/255,parseInt(m[2],16)/255,parseInt(m[3],16)/255] : [1,1,1];
  };
  const getAnchor = (origin, w, h) => {
    const out = .2;
    switch(origin){
      case 'top-left':     return {anchor:[0,-out*h], dir:[0,1]};
      case 'top-right':    return {anchor:[w,-out*h], dir:[0,1]};
      case 'left':         return {anchor:[-out*w,.5*h], dir:[1,0]};
      case 'right':        return {anchor:[(1+out)*w,.5*h], dir:[-1,0]};
      case 'bottom-left':  return {anchor:[0,(1+out)*h], dir:[0,-1]};
      case 'bottom-center':return {anchor:[.5*w,(1+out)*h], dir:[0,-1]};
      case 'bottom-right': return {anchor:[w,(1+out)*h], dir:[0,-1]};
      default:             return {anchor:[.5*w,-out*h], dir:[0,1]}; // top-center
    }
  };

  /* ---------- web-component ---------- */
  class LightRays extends HTMLElement {
    static get observedAttributes(){
      return ['rays-color','rays-speed','light-spread','ray-length','follow-mouse','mouse-influence',
              'noise-amount','distortion','rays-origin'];
    }
    constructor(){
      super();
      this._dpr = Math.min(devicePixelRatio,2);
      this._canvas = document.createElement('canvas');
      this._canvas.style.cssText = 'width:100%;height:100%;display:block;pointer-events:none;';
      this._gl = this._canvas.getContext('webgl') || this._canvas.getContext('experimental-webgl');
      if(!this._gl){ console.warn('WebGL unavailable'); return; }
      this._program = this.createProgram(VERT,FRAG);
      this._gl.useProgram(this._program);
      this._uniforms = this.getUniformLocations(this._program);
      this.createQuad();
      this._mouse = [.5,.5];
      this._smoothMouse = [.5,.5];
      this._start = performance.now();
      this._resize();
      this._loop = this._loop.bind(this);
      requestAnimationFrame(this._loop);
      this._move = e => {
        const r = this.getBoundingClientRect();
        this._mouse[0] = (e.touches?e.touches[0].clientX-e.clientX+e.touches[0].pageX:e.pageX-r.left)/r.width;
        this._mouse[1] = 1-(e.touches?e.touches[0].clientY-e.clientY+e.touches[0].pageY:e.pageY-r.top)/r.height;
      };
      if(this.hasAttribute('follow-mouse')){
        addEventListener('mousemove',this._move);
        addEventListener('touchmove',this._move,{passive:true});
      }
      addEventListener('resize',()=>this._resize());
    }
    createProgram(v,f){
      const gl = this._gl;
      const vs = gl.createShader(gl.VERTEX_SHADER); gl.shaderSource(vs,v); gl.compileShader(vs);
      const fs = gl.createShader(gl.FRAGMENT_SHADER); gl.shaderSource(fs,f); gl.compileShader(fs);
      const p = gl.createProgram(); gl.attachShader(p,vs); gl.attachShader(p,fs); gl.linkProgram(p);
      return p;
    }
    getUniformLocations(p){
      const gl=this._gl, u={};
      gl.getProgramParameter(p,gl.ACTIVE_UNIFORMS);
      for(let i=0;i<gl.getProgramParameter(p,gl.ACTIVE_UNIFORMS);i++){
        const info=gl.getActiveUniform(p,i);
        u[info.name]=gl.getUniformLocation(p,info.name);
      }
      return u;
    }
    createQuad(){
      const gl=this._gl;
      const buf=gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER,buf);
      gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
      const pos=gl.getAttribLocation(this._program,'position');
      gl.enableVertexAttribArray(pos);
      gl.vertexAttribPointer(pos,2,gl.FLOAT,false,0,0);
    }
    _resize(){
      const rect=this.getBoundingClientRect();
      const w=rect.width, h=rect.height;
      this._canvas.width=w*this._dpr; this._canvas.height=h*this._dpr;
      this._gl.viewport(0,0,this._canvas.width,this._canvas.height);
      this._gl.uniform2f(this._uniforms.iResolution,this._canvas.width,this._canvas.height);
      const {anchor,dir}=getAnchor(this.getAttribute('rays-origin')||'top-center',this._canvas.width,this._canvas.height);
      this._gl.uniform2fv(this._uniforms.rayPos,anchor);
      this._gl.uniform2fv(this._uniforms.rayDir,dir);
    }
    _loop(t){
      const gl=this._gl;
      gl.uniform1f(this._uniforms.iTime,(t-this._start)*.001);
      /* smooth mouse */
      const inf=parseFloat(this.getAttribute('mouse-influence')||.1);
      if(inf>0){
        const s=.92;
        this._smoothMouse[0]=this._smoothMouse[0]*s+this._mouse[0]*(1-s);
        this._smoothMouse[1]=this._smoothMouse[1]*s+this._mouse[1]*(1-s);
        gl.uniform2fv(this._uniforms.mousePos,this._smoothMouse);
      }
      gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
      requestAnimationFrame(this._loop);
    }
    attributeChangedCallback(name,old,val){
      if(!this._gl) return;
      switch(name){
        case 'rays-color':     this._gl.uniform3fv(this._uniforms.raysColor,hexToRgb(val||'#ffffff')); break;
        case 'rays-speed':     this._gl.uniform1f(this._uniforms.raysSpeed,parseFloat(val||1)); break;
        case 'light-spread':   this._gl.uniform1f(this._uniforms.lightSpread,parseFloat(val||1)); break;
        case 'ray-length':     this._gl.uniform1f(this._uniforms.rayLength,parseFloat(val||2)); break;
        case 'mouse-influence':this._gl.uniform1f(this._uniforms.mouseInfluence,parseFloat(val||.1)); break;
        case 'noise-amount':   this._gl.uniform1f(this._uniforms.noiseAmount,parseFloat(val||0)); break;
        case 'distortion':     this._gl.uniform1f(this._uniforms.distortion,parseFloat(val||0)); break;
        case 'rays-origin':    this._resize(); break;
      }
    }
    connectedCallback(){ this.appendChild(this._canvas); }
    disconnectedCallback(){
      removeEventListener('mousemove',this._move);
      removeEventListener('touchmove',this._move);
    }
  }
  customElements.define('light-rays',LightRays);
})();
