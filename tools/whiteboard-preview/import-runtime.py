from pathlib import Path
from bs4 import BeautifulSoup

root=Path(__file__).resolve().parents[2]
source=Path('E:/whiteboard-clone/src/reference/index.html')
scripts=BeautifulSoup(source.read_text(encoding='utf-8'),'html.parser').find_all('script')
parts=[]
for index in [3,4,5,6,7,10,11,12]:
    code=scripts[index].get_text()
    if index==3:
        code=code.replace('var DURATION = 1;', 'var DURATION = reduced ? 0 : 1;')
        code=code.replace("menuContainer.setAttribute('aria-hidden', 'false');", "menuContainer.setAttribute('aria-hidden', 'false'); menuContainer.inert = false;")
        code=code.replace("menuContainer.setAttribute('aria-hidden', 'true');", "menuContainer.setAttribute('aria-hidden', 'true'); menuContainer.inert = true;")
        code=code.replace("if (!isActive || isAnimating) return;", "if (!isActive) return;")
        code=code.replace("if (!href || href === '#' || href.startsWith('mailto:') || href.startsWith('tel:')) {", "if (!href || href.startsWith('#')) {")
        code=code.replace("e.preventDefault();\n      closeMenu();\n      return;", "e.preventDefault(); closeMenu(); if (href && href.length > 1) document.querySelector(href)?.scrollIntoView({behavior: reduced ? 'instant' : 'smooth'}); return;",1)
    if index==10:
        code=code.replace('runHeroOnly(ROW, HEADING, paragraph, videoRow, CONFIG);', "if (root.lang !== 'ar') runHeroOnly(ROW, HEADING, paragraph, videoRow, CONFIG); else gsap.set(root.querySelectorAll('.row.cc-visible,.row.cc-hero-content,.row.cc-video'), {autoAlpha:1});")
    if index==11:
        # Match the reference's muted preview and theatre playback. A deliberate
        # pause remains paused when scrolling back through the theatre trigger.
        code=code.replace('audioUnlocked = true;', 'audioUnlocked = true; delete videoEl.dataset.userPaused;')
        code=code.replace('    if (audioUnlocked) videoEl.muted = false;\n    videoEl.play().catch(function () {});', '    if (audioUnlocked) videoEl.muted = false;\n    if (videoEl.dataset.userPaused !== "true") videoEl.play().catch(function () {});')
    if index==12:
        # Keep the reference's two outward reveals and tilted edge image, using
        # the space between our three labels instead of the source's six logos.
        start=code.index('    const positions = {')
        end=code.index('    blocks.forEach',start)
        code=code[:start]+'''    function getPositions(block) {
      const rect = block.getBoundingClientRect();
      const label = block.querySelector(".logo_rich-text").getBoundingClientRect();
      const widestLabel = Math.max(...Array.from(blocks, item =>
        item.querySelector(".logo_rich-text").getBoundingClientRect().width
      ));
      const gap = 28;
      const sideWidth = Math.min(160, rect.width - widestLabel - gap * 2);
      const below = sideWidth < 96;
      const width = below ? Math.min(160, rect.width * .34) : sideWidth;
      const height = width * 1.5;
      block.style.setProperty("--zd-certificate-width", width + "px");

      const centerX = (label.left + label.right) / 2 - rect.left;
      const centerY = (label.top + label.bottom) / 2 - rect.top;
      const position = (left, top, rotation = 0) => ({
        left: left + "px", top: top + "px", rotation,
        transformOrigin: "center center",
      });
      if (below) {
        const top = label.bottom - rect.top + gap;
        return {
          h1Pos: position(centerX - width - 8, top, -6),
          h2Pos: position(centerX + 8, top, 8),
        };
      }

      const edge = edgeMap.get(block) || {};
      const section = block.closest(".cc-logos").getBoundingClientRect();
      const upperTop = Math.max(label.top - rect.top - height - gap, section.top - rect.top + gap);
      return {
        h1Pos: edge.isFirst
          ? position(centerX - width / 2, upperTop, -6)
          : position(label.left - rect.left - width - gap, centerY - height / 2),
        h2Pos: edge.isLast
          ? position(centerX - width / 2, upperTop, 8)
          : position(label.right - rect.left + gap, centerY - height / 2),
      };
    }

'''+code[end:]
    if index in [4,5,10,11,12]: code='if (!reduced) {\n'+code+'\n}'
    parts.append('// Reference inline visual script '+str(index)+'\n'+code)

bootstrap=r'''/* Original Whiteboard visual timelines, scoped to the ZHUDUO preview.
 * No Webflow analytics, original forms, subscriptions or external integrations.
 */
(function (global) {
  global.initZhuduoWhiteboard = function (root) {
    if (root.dataset.runtimeReady) return function () {};
    root.dataset.runtimeReady = 'true';
    const nativeWindow = global, nativeDocument = global.document;
    const reduced = global.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const cleanup = [], frames = new Set(), timers = new Set(), splits = [];
    let disposed = false;
    const document = new Proxy(nativeDocument, {get(target,key) {
      if(key === 'querySelector') return selector => disposed ? null : root.querySelector(selector);
      if(key === 'querySelectorAll') return selector => disposed ? [] : root.querySelectorAll(selector);
      if(key === 'documentElement' || key === 'body') return root;
      if(key === 'addEventListener') return (type,fn,options) => {
        if(type === 'DOMContentLoaded') { fn(); return; }
        target.addEventListener(type,fn,options); cleanup.push(() => target.removeEventListener(type,fn,options));
      };
      const value=Reflect.get(target,key,target); return typeof value==='function' ? value.bind(target) : value;
    }});
    const window = new Proxy(nativeWindow, {get(target,key) {
      if(key === 'Webflow') return {push:fn=>fn()};
      if(key === 'addEventListener') return (type,fn,options) => {target.addEventListener(type,fn,options);cleanup.push(()=>target.removeEventListener(type,fn,options));};
      const value=Reflect.get(target,key,target); return typeof value==='function' && !/^[A-Z]/.test(String(key)) ? value.bind(target) : value;
    }});
    const gsap=global.gsap, ScrollTrigger=global.ScrollTrigger, Flip=global.Flip;
    const SplitText=new Proxy(global.SplitText,{construct(target,args){const split=new target(...args);splits.push(split);return split;},get(target,key){if(key==='create')return(...args)=>{const split=target.create(...args);splits.push(split);return split;};return Reflect.get(target,key);}});
    gsap.registerPlugin(ScrollTrigger,Flip,global.SplitText);
    const requestAnimationFrame=fn=>{if(disposed)return 0;const id=global.requestAnimationFrame(time=>{frames.delete(id);if(!disposed)fn(time);});frames.add(id);return id;};
    const cancelAnimationFrame=id=>{frames.delete(id);global.cancelAnimationFrame(id);};
    const setTimeout=(fn,ms)=>{const id=global.setTimeout(()=>{timers.delete(id);if(!disposed)fn();},ms);timers.add(id);return id;};
    const clearTimeout=id=>{timers.delete(id);global.clearTimeout(id);};
    const setInterval=(fn,ms)=>{const id=global.setInterval(()=>{if(!disposed)fn();},ms);timers.add(id);return id;};
    const clearInterval=id=>{timers.delete(id);global.clearInterval(id);};
    const oldScroll=nativeDocument.documentElement.style.scrollBehavior;
    nativeDocument.documentElement.style.scrollBehavior='auto';
    const menu=root.querySelector('[menu="container"]'), trigger=root.querySelector('[menu="trigger-open"]'), close=root.querySelector('[menu="trigger-close"]');
    const previousOverflow=nativeDocument.body.style.overflow;
    if(!reduced && global.Lenis){
      const lenis = new global.Lenis({autoRaf:false,anchors:true,allowNestedScroll:true}); global.lenis=lenis;
      const ticker=time=>lenis.raf(time*1000);gsap.ticker.add(ticker);lenis.on('scroll',ScrollTrigger.update);
      cleanup.push(()=>{gsap.ticker.remove(ticker);lenis.destroy();if(global.lenis===lenis)delete global.lenis;});
    }
    const context=gsap.context(()=>{
'''
tail=r'''
    },root);
    // Keyboard and focus behavior is supplied around the original menu timeline.
    const observer=new MutationObserver(()=>{
      const open=menu?.getAttribute('aria-hidden')==='false';
      nativeDocument.body.style.overflow=open?'hidden':previousOverflow;
      if(open && !menu.contains(nativeDocument.activeElement)) close?.focus({preventScroll:true});
    });
    if(menu)observer.observe(menu,{attributes:true,attributeFilter:['aria-hidden']});
    const keydown=event=>{
      if(menu?.getAttribute('aria-hidden')!=='false')return;
      if(event.key==='Escape'){setTimeout(()=>trigger?.focus({preventScroll:true}),reduced?0:1050);}
      if(event.key==='Tab'){
        const nodes=[...menu.querySelectorAll('a[href],button:not([disabled]),[tabindex="0"]')].filter(el=>el.getBoundingClientRect().width>0);
        const first=nodes[0],last=nodes[nodes.length-1];
        if(event.shiftKey && nativeDocument.activeElement===first){event.preventDefault();last?.focus();}
        else if(!event.shiftKey && nativeDocument.activeElement===last){event.preventDefault();first?.focus();}
      }
    };
    nativeDocument.addEventListener('keydown',keydown);cleanup.push(()=>nativeDocument.removeEventListener('keydown',keydown));
    const anchors=event=>{
      const a=event.target.closest('a[href^="#"]');if(!a||!root.contains(a))return;
      const selector=a.getAttribute('href');if(selector==='#')return;
      let target;try{target=root.querySelector(selector);}catch{return;}
      if(!target)return;event.preventDefault();
      if(menu?.getAttribute('aria-hidden')==='false')close?.click();
      if(global.lenis&&!reduced)global.lenis.scrollTo(target,{offset:-90});else target.scrollIntoView({behavior:reduced?'instant':'smooth'});
    };
    root.addEventListener('click',anchors);cleanup.push(()=>root.removeEventListener('click',anchors));
    // Preserve the original appearance when motion is disabled.
    if(reduced){root.querySelectorAll('.row.cc-visible,.row.cc-hero-content,.row.cc-video,[data-split]').forEach(el=>el.style.visibility='visible');}
    nativeDocument.fonts.ready.then(()=>{if(!disposed)ScrollTrigger.refresh();});
    return function destroy(){disposed=true;observer.disconnect();context.revert();splits.forEach(split=>split.revert());cleanup.reverse().forEach(fn=>fn());frames.forEach(global.cancelAnimationFrame.bind(global));timers.forEach(global.clearTimeout.bind(global));timers.forEach(global.clearInterval.bind(global));nativeDocument.body.style.overflow=previousOverflow;nativeDocument.documentElement.style.scrollBehavior=oldScroll;delete root.dataset.runtimeReady;};
  };
})(window);
'''
(root/'apps/web/public/whiteboard-original/reference-runtime.js').write_text(bootstrap+'\n'.join(parts)+tail,encoding='utf-8')
print('Imported original menu, card hover, parallax, letter blur, text reveal, video Flip and credential wall timelines.')
