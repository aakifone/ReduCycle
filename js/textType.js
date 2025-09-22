/*  Vanilla TextType  –  single sentence only  */
class TextType extends HTMLElement {
  static get observedAttributes(){
    return ['text','typing-speed','pause-duration','cursor-character','cursor-blink-duration'];
  }

  constructor(){
    super();
    this.attachShadow({mode:'open'});
    this.shadowRoot.innerHTML=`
      <style>
        :host{ display:inline-block; white-space:pre-wrap; }
        .cursor{ margin-left:0.25rem; display:inline-block; }
        .cursor--hidden{ display:none; }
      </style>
      <span class="content"></span><span class="cursor">|</span>
    `;
    this._idx=0;
    this._forward=true;
    this._timer=null;
  }

  connectedCallback(){
    this._content=this.shadowRoot.querySelector('.content');
    this._cursor=this.shadowRoot.querySelector('.cursor');
    this.start();
  }

  disconnectedCallback(){ clearTimeout(this._timer); }

  start(){
    const txt=(this.getAttribute('text')||'').trim();
    const speed=parseInt(this.getAttribute('typing-speed')||'75');
    const pause=parseInt(this.getAttribute('pause-duration')||'1500');
    const blink=parseFloat(this.getAttribute('cursor-blink-duration')||'0.5');

    /* cursor blink */
    this._cursor.textContent=this.getAttribute('cursor-character')||'|';
    this._cursor.style.animation=`blink ${blink}s infinite`;
    const style=document.createElement('style');
    style.textContent=`@keyframes blink{0%,100%{opacity:1}50%{opacity:0}}`;
    this.shadowRoot.appendChild(style);

    const tick=()=>{
      if(this._forward){
        if(this._idx<=txt.length){
          this._content.textContent=txt.slice(0,this._idx++);
          this._timer=setTimeout(tick,speed);
        }else{
          this._timer=setTimeout(()=>{this._forward=false;tick();},pause);
        }
      }else{                    /* optional delete-back */
        if(this._idx>=0){
          this._content.textContent=txt.slice(0,this._idx--);
          this._timer=setTimeout(tick,speed/2);
        }else{
          this._forward=true;
          this._timer=setTimeout(tick,500);
        }
      }
    };
    tick();
  }
}
customElements.define('text-type',TextType);
