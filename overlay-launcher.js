/* Self-contained function: this exact source is embedded in the Safari bookmarklet. */
function launchStudyOverlay3(siteURL) {
  'use strict';
  const ID = 'study-overlay-3-container';
  const old = document.getElementById(ID);
  if (old) { old.remove(); return; }
  document.getElementById('study-overlay-frame')?.remove(); // old launcher
  document.getElementById('study-overlay-v3-host')?.remove(); // old launcher
  const target = new URL(siteURL);
  const origin = target.origin;
  const host = document.createElement('div'); host.id = ID;
  host.style.setProperty('all','initial','important');
  const bubble = document.createElement('button'); bubble.type = 'button'; bubble.textContent = 'S';
  bubble.title = 'Study Overlay: нажми для открытия, перетащи для перемещения';
  bubble.setAttribute('aria-label','Открыть Study Overlay');
  bubble.style.cssText = 'all:initial!important;position:fixed!important;top:17vh!important;left:5px!important;width:38px!important;height:38px!important;box-sizing:border-box!important;border-radius:13px!important;background:linear-gradient(145deg,#b2c7ff,#7b92ef)!important;border:1px solid #f0f7ff!important;color:#17223b!important;font:900 21px system-ui,sans-serif!important;display:grid!important;place-items:center!important;z-index:2147483646!important;box-shadow:0 5px 18px #0008!important;touch-action:none!important;cursor:pointer!important;user-select:none!important;';
  const frame = document.createElement('iframe'); frame.src = siteURL; frame.title = 'Study Overlay 3'; frame.referrerPolicy='no-referrer';
  frame.style.cssText = 'position:fixed!important;top:8vh!important;left:7px!important;width:min(410px,calc(100vw - 14px))!important;height:min(600px,78vh)!important;max-width:none!important;max-height:none!important;display:none!important;background:#0d111c!important;border:1px solid #5f7094!important;border-radius:17px!important;box-shadow:0 12px 45px #0009!important;z-index:2147483647!important;';
  host.append(bubble,frame); (document.body||document.documentElement).append(host);
  let x=5,y=Math.round(innerHeight*0.17),moved=false,drag=null,downAt=0;
  const clamp=(n,lo,hi)=>Math.min(hi,Math.max(lo,n));
  function setB(){x=clamp(x,2,Math.max(2,innerWidth-42));y=clamp(y,2,Math.max(2,innerHeight-42));bubble.style.setProperty('left',x+'px','important');bubble.style.setProperty('top',y+'px','important');}
  function openPanel(){
    const w=Math.min(410,innerWidth-14),h=Math.min(600,innerHeight*.78);
    frame.style.setProperty('left',clamp(x+4,3,Math.max(3,innerWidth-w-3))+'px','important');
    frame.style.setProperty('top',clamp(y-35,3,Math.max(3,innerHeight-h-3))+'px','important');
    frame.style.setProperty('display','block','important');bubble.style.setProperty('display','none','important');
  }
  function closePanel(){frame.style.setProperty('display','none','important');bubble.style.setProperty('display','grid','important');setB();}
  bubble.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY,sx:x,sy:y};moved=false;try{bubble.setPointerCapture(e.pointerId);}catch{}e.preventDefault();});
  bubble.addEventListener('pointermove',e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.abs(dx)+Math.abs(dy)>6)moved=true;if(moved){x=drag.sx+dx;y=drag.sy+dy;setB();}});
  bubble.addEventListener('pointerup',e=>{if(!drag)return;drag=null;downAt=Date.now();if(!moved)openPanel();e.preventDefault();});
  bubble.addEventListener('pointercancel',()=>{drag=null;});
  bubble.addEventListener('click',()=>{if(Date.now()-downAt>400)openPanel();});
  function visible(el) {
    if(!el||!el.getClientRects().length||el.closest('#'+ID+',nav,footer,header,[aria-hidden="true"]'))return false;
    const r=el.getBoundingClientRect(),style=getComputedStyle(el);
    return r.bottom>0&&r.top<innerHeight&&r.right>0&&r.left<innerWidth&&style.display!=='none'&&style.visibility!=='hidden'&&style.opacity!=='0';
  }
  function readPage() {
    const selected=String(getSelection()?.toString()||'').trim();
    if(selected.length>2)return selected.slice(0,6500);
    const seen=new Set(),candidates=[];
    const questionSelector='[data-testid*="question"], [class*="question-title"], [class*="questionTitle"], [id*="question"], h1, h2';
    for(const el of document.querySelectorAll(questionSelector)){
      if(candidates.length>12)break;
      if(!visible(el))continue;
      const content=String(el.innerText||el.textContent||'').trim().replace(/\s+/g,' ');
      if(content.length<4||content.length>450||seen.has(content))continue;
      seen.add(content);candidates.push({text:content,y:el.getBoundingClientRect().top});
    }
    candidates.sort((a,b)=>a.y-b.y);
    const answers=[];
    for(const el of document.querySelectorAll('button,[role="button"],[data-testid*="answer"],[class*="answer-option"]')){
      if(answers.length>18)break;
      if(!visible(el))continue;
      const content=String(el.innerText||el.textContent||'').trim().replace(/\s+/g,' ');
      if(content.length<1||content.length>130||seen.has(content))continue;
      if(/^(next|back|submit|join|skip|settings|help|поделиться|далее|назад|готово|участники|play|login)$/i.test(content))continue;
      seen.add(content);answers.push(content);
    }
    if(candidates.length&&answers.length) return ('Вопрос (проверь правильность распознавания):\n'+candidates.slice(0,4).map(i=>i.text).join('\n')+'\n\nВарианты:\n'+answers.map((v,i)=>(i+1)+'. '+v).join('\n')).slice(0,6500);
    // On generic pages the bookmarklet can only read visible DOM text, not canvas or images.
    const nodes=[],walker=document.createTreeWalker(document.body||document.documentElement,NodeFilter.SHOW_TEXT);
    let item,steps=0;
    while((item=walker.nextNode())&&steps++<12000&&nodes.length<160){
      const val=String(item.nodeValue||'').trim();const el=item.parentElement;
      if(!val||!el||val.length>550||!visible(el)||el.closest('script,style,noscript,svg,iframe'))continue;
      const rect=el.getBoundingClientRect();nodes.push({value:val,top:rect.top,left:rect.left});
    }
    nodes.sort((a,b)=>Math.abs(a.top-b.top)<7?a.left-b.left:a.top-b.top);
    const lines=[],used=new Set();for(const n of nodes){if(used.has(n.value))continue;used.add(n.value);lines.push(n.value);}
    return lines.join('\n').slice(0,6500);
  }
  const message=e=>{
    if(e.origin!==origin||e.source!==frame.contentWindow||!e.data)return;
    if(e.data.type==='STUDY_OVERLAY_READ_PAGE'){
      let text='';try{text=readPage();}catch{}
      frame.contentWindow.postMessage({type:'STUDY_OVERLAY_PAGE_TEXT',text},origin);
    }
    if(e.data.type==='STUDY_OVERLAY_HIDE_PANEL')closePanel();
  };
  addEventListener('message',message);
  addEventListener('resize',setB);
  setB();
}
