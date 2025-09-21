class TextPressure{
  constructor(selector,opts={}){
    this.container=typeof selector==='string'?document.querySelector(selector):selector;
    this.text=opts.text||this.container.textContent||'Compressa';
    this.textColor=opts.textColor||'#FFFFFF';
    this.minFontSize=opts.minFontSize||24;
    this.width=opts.width!==false;
    this.weight=opts.weight!==false;
    this.italic=opts.italic!==false;
    this.alpha=opts.alpha||false;
    this.spans=[];
    this.mouse={x:0,y:0};
    this.cursor={x:0,y:0};
    this.init();
  }
  init(){
    this.container.innerHTML='';
    this.container.classList.add('text-pressure');
    this.container.style.color=this.textColor;
    const style=document.createElement('style');
    style.textContent=`@font-face{font-family:'Compressa VF';src:url('https://res.cloudinary.com/dr6lvwubh/raw/upload/v1529908256/CompressaPRO-GX.woff2') format('woff2');}`;
    document.head.appendChild(style);
    this.buildSpans();
    this.bindEvents();
    this.animate();
  }
  buildSpans(){
    this.text.split('').forEach((ch,i)=>{
      const span=document.createElement('span');
      span.textContent=ch===''?'\u00A0':ch;
      this.container.appendChild(span);
      this.spans.push(span);
    });
  }
  bindEvents(){
    const onMove=e=>{
      const t=e.touches?e.touches[0]:e;
      this.cursor.x=t.clientX;
      this.cursor.y=t.clientY;
    };
    window.addEventListener('mousemove',onMove);
    window.addEventListener('touchmove',onMove,{passive:false});
    window.addEventListener('resize',()=>this.setSize());
    this.setSize();
  }
  setSize(){
    const rect=this.container.getBoundingClientRect();
    const fontSize=Math.max(rect.width/(this.text.length/2),this.minFontSize);
    this.container.style.fontSize=fontSize+'px';
  }
  animate(){
    const loop=()=>{
      this.mouse.x+=(this.cursor.x-this.mouse.x)/15;
      this.mouse.y+=(this.cursor.y-this.mouse.y)/15;
      const rect=this.container.getBoundingClientRect();
      const maxDist=rect.width/2;
      this.spans.forEach(span=>{
        const r=span.getBoundingClientRect();
        const cx=r.x+r.width/2;
        const cy=r.y+r.height/2;
        const d=Math.hypot(this.mouse.x-cx,this.mouse.y-cy);
        const getAttr=(dist,min,max)=>Math.max(min,max-Math.abs((max*dist)/maxDist));
        const wdth=this.width?Math.floor(getAttr(d,5,200)):100;
        const wght=this.weight?Math.floor(getAttr(d,100,900)):400;
        const ital=this.italic?getAttr(d,0,1).toFixed(2):0;
        const alpha=this.alpha?getAttr(d,0,1).toFixed(2):1;
        span.style.opacity=alpha;
        span.style.fontVariationSettings=`'wght' ${wght}, 'wdth' ${wdth}, 'ital' ${ital}`;
      });
      requestAnimationFrame(loop);
    };
    loop();
  }
}
