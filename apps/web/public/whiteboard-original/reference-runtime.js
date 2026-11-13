/* Original Whiteboard visual timelines, scoped to the ZHUDUO preview.
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
// Reference inline visual script 3


function domReady(fn) {
  if (window.Webflow) { window.Webflow.push(fn); }
  else { document.addEventListener('DOMContentLoaded', fn); }
}

domReady(function () {
  var EASE = 'expo.out';
  var DURATION = reduced ? 0 : 1;
  var KEY = 'wb-page-transition';

  var btn = document.querySelector('[menu="trigger-open"]');
  var btnClose = document.querySelector('[menu="trigger-close"]');
  var menuContainer = document.querySelector('[menu="container"]');
  var menuContent = document.querySelectorAll('[menu="content"]');

  if (!btn || !menuContainer) return;

  var isActive = false;
  var currentTl = null;
  var isAnimating = false;

  // ── INIT ──────────────────────────────────────────────────────
  gsap.set(menuContainer, {
    clipPath: 'polygon(0% 100%, 100% 100%, 100% 100%, 0% 100%)',
    display: 'flex',
    autoAlpha: 0,
    pointerEvents: 'none',
  });
  menuContainer.setAttribute('aria-hidden', 'true'); menuContainer.inert = true;

  gsap.set(menuContent, { y: '50%', opacity: 0.25 });

  // ── OPEN ──────────────────────────────────────────────────────
  function openMenu() {
    if (isActive || isAnimating) return;
    isActive = true;
    isAnimating = true;
    if (window.lenis) window.lenis.stop();
    btn.classList.add('disabled', 'menu-open');
    btn.setAttribute('aria-expanded', 'true');

    menuContainer.setAttribute('aria-hidden', 'false'); menuContainer.inert = false;
    gsap.set(menuContainer, {
      autoAlpha: 1,
      pointerEvents: 'auto',
    });

    if (currentTl) currentTl.kill();

    var tl = gsap.timeline({
      paused: true,
      defaults: { ease: EASE, duration: DURATION },
      onComplete: function () {
        isAnimating = false;
        btn.classList.remove('disabled');
      },
    });
    currentTl = tl;

    tl.to(menuContainer, {
      clipPath: 'polygon(0% 100%, 100% 100%, 100% 0%, 0% 0%)',
    });
    tl.to(menuContent, { y: '0%', opacity: 1 }, '<');

    tl.play();
  }

  // ── CLOSE ─────────────────────────────────────────────────────
  function closeMenu() {
    if (!isActive) return;
    isAnimating = true;
    btn.classList.add('disabled');
    btn.classList.remove('menu-open');
    btn.setAttribute('aria-expanded', 'false');

    if (currentTl) currentTl.kill();

    var tl = gsap.timeline({
      paused: true,
      defaults: { ease: EASE, duration: DURATION },
      onComplete: function () {
        gsap.set(menuContainer, {
          clipPath: 'polygon(0% 100%, 100% 100%, 100% 100%, 0% 100%)',
          autoAlpha: 0,
          pointerEvents: 'none',
        });
        menuContainer.setAttribute('aria-hidden', 'true'); menuContainer.inert = true;

        gsap.set(menuContent, { y: '50%', opacity: 0.25 });
        isActive = false;
        isAnimating = false;
        btn.classList.remove('disabled');
        if (window.lenis) window.lenis.start();
      },
    });
    currentTl = tl;

    tl.to(menuContainer, {
      clipPath: 'polygon(0% 0%, 100% 0%, 100% 0%, 0% 0%)',
    });
    tl.to(menuContent, { y: '-100%', opacity: 0.25 }, '<');

    tl.play();
  }

  // ── HOVER FLICKER ─────────────────────────────────────────────
  function attachHoverFlicker(button) {
    var svgChildren = button.querySelectorAll('svg > *');
    if (!svgChildren.length) return;
    function flickerOut() {
      gsap.to(svgChildren, { opacity: 0, duration: 0.001, stagger: { amount: 0.4, from: 'random' }, onComplete: flickerIn });
    }
    function flickerIn() {
      gsap.to(svgChildren, { opacity: 1, duration: 0.001, stagger: { amount: 0.3, from: 'random' } });
    }
    button.addEventListener('mouseenter', flickerOut);
  }

  attachHoverFlicker(btn);
  if (btnClose) {
    btnClose.addEventListener('click', function () { closeMenu(); });
    attachHoverFlicker(btnClose);
  }

  btn.addEventListener('click', function () {
    isActive ? closeMenu() : openMenu();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && isActive) closeMenu();
  });

  // ── NAV LINK CLICKS ───────────────────────────────────────────
  menuContainer.addEventListener('click', function (e) {
    var a = e.target.closest('a');
    if (!a) return;

    var href = a.getAttribute('href');

    if (!href || href.startsWith('#')) {
      e.preventDefault(); closeMenu(); if (href && href.length > 1) document.querySelector(href)?.scrollIntoView({behavior: reduced ? 'instant' : 'smooth'}); return;
    }

    var current = (window.location.pathname.replace(/\/$/, '') || '/');
    var target = (href.replace(/\/$/, '') || '/');
    if (target === current || a.getAttribute('aria-current') === 'page') {
      e.preventDefault();
      closeMenu();
      return;
    }

    e.preventDefault();

    if (window.lenis) window.lenis.stop();

    try { sessionStorage.setItem(KEY, 'nav'); } catch (ex) {}

    window.location.href = href;
  });
});

// Reference inline visual script 4
if (!reduced) {

// Split Text + Stagger Reveal
// Attributes:
//   data-split="lines"              → split into lines, mask reveal (slide up)
//   data-split="lines" data-blur    → split into lines, blur + fade + slide up
//   data-split="chars"              → split into chars, blur reveal
//   data-blur                       → blur + fade + slide up on direct children (no split)

document.addEventListener('DOMContentLoaded', function () {
  function initSplitTextAnimations() {
    if (
      typeof gsap === 'undefined' ||
      typeof ScrollTrigger === 'undefined' ||
      typeof SplitText === 'undefined'
    ) {
      return requestAnimationFrame(initSplitTextAnimations);
    }

    var isTouchDevice =
      ScrollTrigger.isTouch === 1 ||
      window.matchMedia('(pointer: coarse)').matches ||
      'ontouchstart' in window;

    document.fonts.ready.then(function () {

      // ── Lines (default masked slide-up) ──
      function playLines(text) {
        if (text.hasAttribute('data-split-played')) return;
        text.setAttribute('data-split-played', 'true');

        var split = SplitText.create(text, {
          type: 'lines',
          mask: 'lines',
          linesClass: 'line'
        });

        gsap.set(text, { visibility: 'visible' });

        gsap.from(split.lines, {
          yPercent: 102,
          duration: 0.6,
          stagger: { amount: 0.4 },
          ease: 'power2.out'
        });
      }

      // ── Lines + blur (no mask, blur + fade + slide) ──
      function playLinesBlur(text) {
        if (text.hasAttribute('data-split-played')) return;
        text.setAttribute('data-split-played', 'true');

        var split = SplitText.create(text, {
          type: 'lines',
          linesClass: 'line'
        });

        gsap.set(text, { visibility: 'visible' });

        gsap.from(split.lines, {
          filter: 'blur(4px)',
          opacity: 0,
          yPercent: 40,
          duration: 0.8,
          stagger: { amount: 0.4 },
          ease: 'power2.out'
        });
      }

      // ── Chars (blur reveal) ──
      function playChars(text) {
        if (text.hasAttribute('data-split-played')) return;
        text.setAttribute('data-split-played', 'true');

        var split = SplitText.create(text, {
          type: 'chars',
          mask: 'chars',
          charsClass: 'char'
        });

        gsap.set(text, { visibility: 'visible' });

        gsap.from(split.chars, {
          filter: 'blur(4px)',
          opacity: 0,
          xPercent: 4,
          duration: 0.6,
          stagger: { amount: 0.5 },
          ease: 'power2.out'
        });
      }

      // ── Standalone blur (direct children stagger) ──
      function playBlurChildren(wrapper) {
        if (wrapper.hasAttribute('data-blur-played')) return;
        wrapper.setAttribute('data-blur-played', 'true');

        var children = wrapper.children;
        if (!children.length) return;

        gsap.set(wrapper, { visibility: 'visible' });

        gsap.from(children, {
          filter: 'blur(4px)',
          opacity: 0,
          y: 20,
          duration: 0.8,
          stagger: { amount: 0.5 },
          ease: 'power2.out'
        });
      }

      // ── Dispatch ──
      function playElement(el) {
        var splitAttr = el.getAttribute('data-split');
        var hasBlur = el.hasAttribute('data-blur');

        if (splitAttr === 'lines' && hasBlur) {
          playLinesBlur(el);
        } else if (splitAttr === 'lines') {
          playLines(el);
        } else if (splitAttr === 'chars') {
          playChars(el);
        } else if (hasBlur && !splitAttr) {
          playBlurChildren(el);
        }
      }

      // ── Selectors ──
      var selector = '[data-split="lines"], [data-split="chars"], [data-blur]:not([data-split])';

      // ── Desktop: ScrollTrigger ──
      function setupDesktopScrollTrigger() {
        document.querySelectorAll(selector).forEach(function (el) {
          if (el.hasAttribute('data-split-init')) return;
          el.setAttribute('data-split-init', 'true');

          ScrollTrigger.create({
            trigger: el,
            start: 'top 92%',
            once: true,
            onEnter: function () {
              playElement(el);
            }
          });
        });

        ScrollTrigger.refresh(true);

        setTimeout(function () {
          ScrollTrigger.refresh(true);
        }, 400);
      }

      // ── Touch: IntersectionObserver ──
      function setupTouchObserver() {
        var observer = new IntersectionObserver(function (entries, obs) {
          entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            playElement(entry.target);
            obs.unobserve(entry.target);
          });
        }, {
          root: null,
          rootMargin: '0px 0px -8% 0px',
          threshold: 0.15
        });

        document.querySelectorAll(selector).forEach(function (el) {
          if (el.hasAttribute('data-split-init')) return;
          el.setAttribute('data-split-init', 'true');
          observer.observe(el);
        });

        // reveal anything already in view
        document.querySelectorAll(selector).forEach(function (el) {
          var rect = el.getBoundingClientRect();
          var inView = rect.top < window.innerHeight * 0.92 && rect.bottom > 0;
          if (inView) playElement(el);
        });
      }

      if (isTouchDevice) {
        setupTouchObserver();
      } else {
        setupDesktopScrollTrigger();
      }
    });
  }

  initSplitTextAnimations();
});


}
// Reference inline visual script 5
if (!reduced) {

window.Webflow = window.Webflow || [];
window.Webflow.push(function () {
  gsap.registerPlugin(ScrollTrigger);

  var elements = document.querySelectorAll('[data-parallax]');
  if (!elements.length) return;

  elements.forEach(function (element) {
    var parallaxValue = element.getAttribute('data-parallax');
    var speed = element.getAttribute('data-parallax-speed');
    if (!parallaxValue) return;

    gsap.to(element, {
      yPercent: Number(parallaxValue) * 100,
      ease: 'none',
      scrollTrigger: {
        trigger: element,
        start: 'top bottom',
        end: 'bottom top',
        scrub: speed ? Number(speed) : true,
      },
    });
  });
});

}
// Reference inline visual script 6

document.addEventListener("DOMContentLoaded", function () {
  var cards = document.querySelectorAll('[data-module="casestudy-card"]');
  if (!cards.length) return;
  cards.forEach(function (card) {
    var overlay = card.querySelector(".gradient_overlay-blur");
    var image   = card.querySelector(".casestudy_img-sm");
    var content = card.querySelector(".card_content");
    var hover   = card.querySelector(".card_hover-content");
    if (!content || !hover) return;
    gsap.set(hover,   { opacity: 0, y: 6 });
    gsap.set(content, { opacity: 1, y: 0 });
    if (image) gsap.set(image, { scale: 1, opacity: 1 });
    if (overlay) gsap.set(overlay, { opacity: 1, backdropFilter: "blur(0px)" });
    var tlIn  = null;
    var tlOut = null;
    card.addEventListener("mouseenter", function () {
      if (tlOut) { tlOut.kill(); tlOut = null; }
      tlIn = gsap.timeline();
      if (overlay) tlIn.to(overlay, { opacity: 1, backdropFilter: "blur(4px)", duration: 0.5, ease: "power2.inOut" }, 0);
      if (image)   tlIn.to(image,   { scale: 0.97, opacity: 0, duration: 0.5, ease: "power2.inOut" }, 0);
      tlIn.to(content, { y: -16, opacity: 0, duration: 0.35, ease: "power2.inOut" }, 0);
      tlIn.to(hover,   { y: 0,   opacity: 1, duration: 0.45, ease: "power3.out"   }, 0.1);
    });
    card.addEventListener("mouseleave", function () {
      if (tlIn) { tlIn.kill(); tlIn = null; }
      tlOut = gsap.timeline();
      if (overlay) tlOut.to(overlay, { opacity: 0, backdropFilter: "blur(0px)", duration: 0.5, ease: "power2.inOut" }, 0);
      if (image)   tlOut.to(image,   { scale: 1, opacity: 1, duration: 0.5, ease: "power2.inOut" }, 0);
      tlOut.to(hover,   { y: 6,  opacity: 0, duration: 0.3,  ease: "power2.inOut" }, 0);
      tlOut.to(content, { y: 0,  opacity: 1, duration: 0.45, ease: "power3.out"   }, 0.1);
    });
  });
});

// Reference inline visual script 7

document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('[color-fill]').forEach(function (el) {
    var value = el.getAttribute('color-fill');

    if (!value) return;

    if (value.includes('gradient')) {
      el.style.setProperty('background-image', value, 'important');
    } else {
      el.style.setProperty('background-color', value, 'important');
    }
  });
});

// Reference inline visual script 10
if (!reduced) {

  // ═══════════════════════════════════════════════════════════════════════
  // PAGE LOADER + HERO ENTRANCE — UNIFIED TIMELINE (v3)
  //
  // Changes from v2:
  //   - Removed black panel transition — cream/GIF layer swipes up
  //     directly to reveal the page beneath
  //
  // Flow:
  //   1. GIF fades in, plays ~3s
  //   2. GIF fades out → cream wipes UP → page revealed
  //   3. Nav drops in (y: -80 → 0, opacity 0 → 1)
  //   4. Hero heading chars drop in with blur
  //   5. Paragraph lines slide up
  //   6. Video row fades up
  //   7. Per-letter cursor blur activates
  //   8. Loader wrapper removed from DOM
  // ═══════════════════════════════════════════════════════════════════════

  document.addEventListener('DOMContentLoaded', function () {
    // ── WAIT FOR GSAP + SPLITTEXT ─────────────────────────────────
    function waitForGSAP(callback) {
      if (typeof gsap !== 'undefined' && typeof SplitText !== 'undefined') {
        callback();
        return;
      }
      var attempts = 0;
      var poll = setInterval(function () {
        attempts++;
        if (typeof gsap !== 'undefined' && typeof SplitText !== 'undefined') {
          clearInterval(poll);
          callback();
        } else if (attempts > 100) {
          clearInterval(poll);
          console.warn('[page-loader] GSAP or SplitText not found after 5s');
        }
      }, 50);
    }

    waitForGSAP(function () {
      gsap.registerPlugin(SplitText);
      initPageLoader();
    });

    // ═════════════════════════════════════════════════════════════════
    // MAIN INIT
    // ═════════════════════════════════════════════════════════════════
    function initPageLoader() {
      var EASE = 'expo.out';
      var DURATION = 1;

      // ── LOADER ELEMENTS ──────────────────────────────────────────
      var loadWrap = document.querySelector('.page_load-wrap');
      var loader = document.querySelector('.page_loader');
      var gif = document.querySelector('.page_loader-gif');

      // ── PAGE ELEMENTS ────────────────────────────────────────────
      var nav = document.querySelector('.nav_wrap');
      var mainPage = document.querySelector('.page-main');

      // ── HERO ELEMENTS ────────────────────────────────────────────
      var ROW = document.querySelector('.row.cc-visible');
      var HEADING = ROW ? ROW.querySelector("h1, h2, h3, h4, h5, h6, .heading-style-h1, [class*='heading']") : null;
      var paragraph = document.querySelector('.row.cc-hero-content p');
      var videoRow = document.querySelector('.row.cc-video');

      // ── HERO CONFIG ──────────────────────────────────────────────
      var CONFIG = {
        dropDuration: 1.2,
        charStagger: 0.04,
        dropDistance: -40,
        ease: 'power2.inOut',
        blurValues: [12, 6, 0],
        blurClearDuration: 1.0,
        cursorBlurMax: 4,
        cursorClearRadius: 100,
        cursorBlurRadius: 300,
        cursorFadeIn: 0.3,
        cursorFadeOut: 0.5,
        lerpFactor: 0.12,
      };

      // ── NO LOADER? Skip straight to hero ─────────────────────────
      if (!loader) {
        if (nav) gsap.set(nav, { autoAlpha: 1 });
        if (root.lang !== 'ar') runHeroOnly(ROW, HEADING, paragraph, videoRow, CONFIG); else gsap.set(root.querySelectorAll('.row.cc-visible,.row.cc-hero-content,.row.cc-video'), {autoAlpha:1});
        return;
      }

      // ═════════════════════════════════════════════════════════════
      // LOCK SCROLL DURING LOADER
      // ═════════════════════════════════════════════════════════════
      if (window.lenis) window.lenis.stop();
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';

      // ═════════════════════════════════════════════════════════════
      // SET INITIAL STATES
      // ═════════════════════════════════════════════════════════════

      // Loader layer: fully covering
      gsap.set(loader, {
        clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)',
      });

      // GIF: hidden until we fade it in
      if (gif) gsap.set(gif, { opacity: 0 });

      // Nav: hidden — we animate this, not Webflow's native interaction
      if (nav) gsap.set(nav, { autoAlpha: 0, y: -80 });

      // Page content: hidden + offset
      if (mainPage) gsap.set(mainPage, { opacity: 0, y: 60 });

      // ── HERO: split text + set initial states ────────────────────
      var split = null;
      var chars = [];
      var words = [];
      var charWordIndex = new Map();
      var lineSplit = null;

      if (HEADING) {
        split = new SplitText(HEADING, { type: 'words, chars' });
        words = split.words;
        chars = split.chars;

        applyCharClipFix(words, chars);

        words.forEach(function (wordEl, wordIdx) {
          wordEl.querySelectorAll('.char').forEach(function (ch) {
            charWordIndex.set(ch, wordIdx);
          });
        });

        chars.forEach(function (charEl) {
          var wordIdx = charWordIndex.get(charEl) || 0;
          var blurAmount = CONFIG.blurValues[Math.min(wordIdx, CONFIG.blurValues.length - 1)];
          gsap.set(charEl, {
            yPercent: CONFIG.dropDistance,
            opacity: 0,
            filter: 'blur(' + blurAmount + 'px)',
            willChange: 'transform, filter, opacity',
          });
        });

        gsap.set(HEADING, { autoAlpha: 1 });
      }

      if (ROW) gsap.set(ROW, { autoAlpha: 1 });

      if (paragraph) {
        lineSplit = SplitText.create(paragraph, {
          type: 'lines',
          mask: 'lines',
          linesClass: 'hero-line',
        });
        gsap.set(lineSplit.lines, { yPercent: 110 });
        gsap.set(paragraph, { visibility: 'visible' });
        gsap.set('.row.cc-hero-content', { autoAlpha: 1 });
      }

      if (videoRow) gsap.set(videoRow, { autoAlpha: 0, yPercent: 15 });

      // ═════════════════════════════════════════════════════════════
      // PHASE 1: GIF FADE IN
      // ═════════════════════════════════════════════════════════════
      if (gif) {
        gsap.to(gif, {
          opacity: 1,
          duration: 0.5,
          delay: 0.2,
          ease: 'power2.out',
        });
      }

      // ═════════════════════════════════════════════════════════════
      // PHASE 2: AFTER GIF → FULL TRANSITION TIMELINE
      // ═════════════════════════════════════════════════════════════
      var GIF_PLAY_TIME = 3000;

      setTimeout(function () {
        var tl = gsap.timeline({
          defaults: { ease: EASE, duration: DURATION },
          onComplete: function () {
            chars.forEach(function (ch) {
              ch.style.willChange = 'auto';
            });
            if (ROW && chars.length) initCursorLetterBlur(ROW, chars, CONFIG);
          },
        });

        // ── 1. FADE OUT GIF ──────────────────────────────────────
        if (gif) {
          tl.to(gif, {
            opacity: 0,
            duration: 0.3,
            ease: 'power2.in',
          });
        }

        // ── 2. CREAM WIPES UP → reveals page directly ────────────
        tl.to(
          loader,
          {
            clipPath: 'polygon(0% 0%, 100% 0%, 100% 0%, 0% 0%)',
            duration: DURATION,
            ease: EASE,
            onStart: function () {
              if (window.lenis) window.lenis.start();
              document.documentElement.style.overflow = '';
              document.body.style.overflow = '';
            },
            onComplete: function () {
              if (loadWrap) loadWrap.remove();
            },
          },
          gif ? '-=0.1' : undefined,
        );

        // ── 3. PAGE SLIDES IN (with wipe) ──────────────────────────
        if (mainPage) {
          tl.to(
            mainPage,
            {
              opacity: 1,
              y: 0,
              duration: DURATION,
              ease: EASE,
            },
            '<',
          );
        }

        // ── 4. NAV DROPS IN ──────────────────────────────────────
        if (nav) {
          tl.to(
            nav,
            {
              autoAlpha: 1,
              y: 0,
              duration: 0.8,
              ease: 'sine.inOut',
            },
            '-=0.6',
          );
        }

        // ── 5. HEADING CHARS DROP + BLUR CLEAR ───────────────────
        if (chars.length) {
          tl.to(
            chars,
            {
              yPercent: 0,
              opacity: 1,
              duration: CONFIG.dropDuration,
              ease: CONFIG.ease,
              stagger: { each: CONFIG.charStagger, from: 'start' },
            },
            '-=0.4',
          );

          tl.to(
            chars,
            {
              filter: 'blur(0px)',
              duration: CONFIG.blurClearDuration,
              ease: 'power2.inOut',
              stagger: { each: CONFIG.charStagger, from: 'start' },
            },
            '<0.1',
          );
        }

        // ── 6. PARAGRAPH LINES SLIDE UP ──────────────────────────
        if (lineSplit) {
          tl.to(lineSplit.lines, {
            yPercent: 0,
            duration: 0.6,
            stagger: 0.1,
            ease: 'power2.out',
          });
        }

        // ── 7. VIDEO ROW FADES UP ────────────────────────────────
        if (videoRow) {
          tl.to(
            videoRow,
            {
              autoAlpha: 1,
              yPercent: 0,
              duration: 1,
              ease: 'power2.out',
            },
            '-=0.3',
          );
        }
      }, GIF_PLAY_TIME);
    }

    // ═════════════════════════════════════════════════════════════════
    // SAFARI CLIPPING FIX
    // ═════════════════════════════════════════════════════════════════
    function applyCharClipFix(words, chars) {
      words.forEach(function (w) {
        w.style.overflow = 'visible';
      });
      chars.forEach(function (ch) {
        ch.style.overflow = 'visible';
        ch.style.padding = '0.05em 0.08em';
        ch.style.margin = '-0.05em -0.08em';
      });
    }

    // ═════════════════════════════════════════════════════════════════
    // FALLBACK: No loader present, run hero standalone
    // ═════════════════════════════════════════════════════════════════
    function runHeroOnly(ROW, HEADING, paragraph, videoRow, CONFIG) {
      if (!ROW || !HEADING) return;

      var split = new SplitText(HEADING, { type: 'words, chars' });
      var words = split.words;
      var chars = split.chars;
      var charWordIndex = new Map();

      applyCharClipFix(words, chars);

      words.forEach(function (wordEl, wordIdx) {
        wordEl.querySelectorAll('.char').forEach(function (ch) {
          charWordIndex.set(ch, wordIdx);
        });
      });

      var lineSplit = paragraph
        ? SplitText.create(paragraph, {
            type: 'lines',
            mask: 'lines',
            linesClass: 'hero-line',
          })
        : null;

      chars.forEach(function (charEl) {
        var wordIdx = charWordIndex.get(charEl) || 0;
        var blurAmount = CONFIG.blurValues[Math.min(wordIdx, CONFIG.blurValues.length - 1)];
        gsap.set(charEl, {
          yPercent: CONFIG.dropDistance,
          opacity: 0,
          filter: 'blur(' + blurAmount + 'px)',
          willChange: 'transform, filter, opacity',
        });
      });

      if (lineSplit) gsap.set(lineSplit.lines, { yPercent: 110 });
      if (videoRow) gsap.set(videoRow, { autoAlpha: 0, yPercent: 15 });
      gsap.set(HEADING, { autoAlpha: 1 });
      gsap.set(ROW, { autoAlpha: 1 });
      if (paragraph) {
        gsap.set(paragraph, { visibility: 'visible' });
        gsap.set('.row.cc-hero-content', { autoAlpha: 1 });
      }

      var tl = gsap.timeline({
        delay: 0.2,
        onComplete: function () {
          chars.forEach(function (ch) {
            ch.style.willChange = 'auto';
          });
          if (chars.length) initCursorLetterBlur(ROW, chars, CONFIG);
        },
      });

      tl.to(chars, {
        yPercent: 0,
        opacity: 1,
        duration: CONFIG.dropDuration,
        ease: CONFIG.ease,
        stagger: { each: CONFIG.charStagger, from: 'start' },
      });

      tl.to(
        chars,
        {
          filter: 'blur(0px)',
          duration: CONFIG.blurClearDuration,
          ease: 'power2.inOut',
          stagger: { each: CONFIG.charStagger, from: 'start' },
        },
        0.1,
      );

      if (lineSplit) {
        tl.to(lineSplit.lines, {
          yPercent: 0,
          duration: 0.6,
          stagger: 0.1,
          ease: 'power2.out',
        });
      }

      if (videoRow) {
        tl.to(
          videoRow,
          {
            autoAlpha: 1,
            yPercent: 0,
            duration: 1,
            ease: 'power2.out',
          },
          '-=0.3',
        );
      }
    }

    // ═════════════════════════════════════════════════════════════════
    // PER-LETTER CURSOR BLUR
    // ═════════════════════════════════════════════════════════════════
    function initCursorLetterBlur(ROW, chars, CONFIG) {
      var isHovering = false;
      var isActive = false;
      var animFrame = null;
      var mouseX = 0,
        mouseY = 0;
      var curX = 0,
        curY = 0;

      var charCenters = [];

      function cacheCharPositions() {
        charCenters = chars.map(function (ch) {
          var rect = ch.getBoundingClientRect();
          return {
            el: ch,
            cx: rect.left + rect.width / 2,
            cy: rect.top + rect.height / 2,
          };
        });
      }

      function updateBlurs() {
        var clearR = CONFIG.cursorClearRadius;
        var blurR = CONFIG.cursorBlurRadius;
        var maxBlur = CONFIG.cursorBlurMax;
        var range = blurR - clearR;

        for (var i = 0; i < charCenters.length; i++) {
          var c = charCenters[i];
          var dx = curX - c.cx;
          var dy = curY - c.cy;
          var dist = Math.sqrt(dx * dx + dy * dy);

          var t = Math.max(0, Math.min(1, (dist - clearR) / range));
          var blur = t * maxBlur;

          c.el.style.filter = 'blur(' + blur.toFixed(1) + 'px)';
        }
      }

      function animate() {
        if (!isHovering) return;
        curX += (mouseX - curX) * CONFIG.lerpFactor;
        curY += (mouseY - curY) * CONFIG.lerpFactor;
        updateBlurs();
        animFrame = requestAnimationFrame(animate);
      }

      function onEnter(e) {
        isHovering = true;
        mouseX = curX = e.clientX;
        mouseY = curY = e.clientY;
        cacheCharPositions();
        updateBlurs();
        animate();
      }

      function onMove(e) {
        mouseX = e.clientX;
        mouseY = e.clientY;
      }

      function onLeave() {
        isHovering = false;
        if (animFrame) {
          cancelAnimationFrame(animFrame);
          animFrame = null;
        }

        gsap.to(chars, {
          filter: 'blur(0px)',
          duration: CONFIG.cursorFadeOut,
          ease: 'power2.inOut',
          overwrite: true,
        });
      }

      function isDesktop() {
        return window.matchMedia('(pointer:fine)').matches && window.matchMedia('(min-width:1024px)').matches;
      }

      function activate() {
        if (isActive) return;
        isActive = true;
        ROW.addEventListener('mouseenter', onEnter);
        ROW.addEventListener('mousemove', onMove);
        ROW.addEventListener('mouseleave', onLeave);
      }

      function deactivate() {
        if (!isActive) return;
        isActive = false;
        isHovering = false;
        ROW.removeEventListener('mouseenter', onEnter);
        ROW.removeEventListener('mousemove', onMove);
        ROW.removeEventListener('mouseleave', onLeave);
        if (animFrame) {
          cancelAnimationFrame(animFrame);
          animFrame = null;
        }
        gsap.set(chars, { filter: 'blur(0px)' });
      }

      function handleResize() {
        if (isDesktop() && !isActive) activate();
        else if (!isDesktop() && isActive) deactivate();
        if (isActive) cacheCharPositions();
      }

      handleResize();
      window.addEventListener('resize', handleResize);
    }
  });

}
// Reference inline visual script 11
if (!reduced) {

document.addEventListener("DOMContentLoaded", function () {
  gsap.registerPlugin(ScrollTrigger, Flip);

  var wrappers = document.querySelectorAll("[data-flip-element='wrapper']");
  var target = document.querySelector("[data-flip-element='target']");
  var pageWrapper = document.querySelector(".page-wrapper");
  var navWrap = document.querySelector(".nav_wrap");
  var videoLg = document.querySelector(".video_lg");
  var videoRow = document.querySelector(".row.cc-video");

  if (!wrappers.length || !target || !pageWrapper || !videoLg || !videoRow)
    return;

  var videoEl = target.querySelector("video");
  if (!videoEl) return;

  var tl;
  var audioUnlocked = false;

  var speakerOffSVG =
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>' +
    '<line x1="23" y1="9" x2="17" y2="15"></line>' +
    '<line x1="17" y1="9" x2="23" y2="15"></line></svg>';

  var speakerOnSVG =
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>' +
    '<path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>' +
    '<path d="M15.54 8.46a5 5 0 0 1 0 7.08"></path></svg>';

  var unmuteBtn = document.createElement("button");
  unmuteBtn.classList.add("video-unmute");
  unmuteBtn.setAttribute("aria-label", "Unmute video");
  unmuteBtn.innerHTML = speakerOffSVG;
  videoLg.appendChild(unmuteBtn);

  unmuteBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    audioUnlocked = true; delete videoEl.dataset.userPaused;
    if (videoEl.muted) {
      videoEl.muted = false;
      videoEl.play().catch(function () {});
      unmuteBtn.innerHTML = speakerOnSVG;
    } else {
      videoEl.muted = true;
      unmuteBtn.innerHTML = speakerOffSVG;
    }
  });

  function enterTheater() {
    pageWrapper.classList.add("is-theater");
    if (navWrap) navWrap.classList.add("u-mode-dark");
    if (videoEl.ended) videoEl.currentTime = 0;
    if (audioUnlocked) videoEl.muted = false;
    if (videoEl.dataset.userPaused !== "true") videoEl.play().catch(function () {});
  }

  function exitTheater() {
    pageWrapper.classList.remove("is-theater");
    if (navWrap) navWrap.classList.remove("u-mode-dark");
    videoEl.muted = true;
    videoEl.pause();
    unmuteBtn.innerHTML = speakerOffSVG;
    unmuteBtn.classList.remove("is-visible");
  }

  function killFlipTriggers() {
    ScrollTrigger.getAll().forEach(function (st) {
      if (st.vars.id && st.vars.id.indexOf("flip-") === 0) {
        st.kill();
      }
    });
  }

  function buildFlip() {
    if (tl) {
      tl.kill();
      gsap.set(target, { clearProps: "all" });
    }

    killFlipTriggers();

    tl = gsap.timeline({
      scrollTrigger: {
        id: "flip-scale",
        trigger: wrappers[0],
        start: "center center",
        endTrigger: wrappers[wrappers.length - 1],
        end: "center center",
        scrub: 0.25,
        invalidateOnRefresh: true,
        onUpdate: function (self) {
          if (self.progress > 0.95) {
            unmuteBtn.classList.add("is-visible");
            if (audioUnlocked) unmuteBtn.innerHTML = speakerOnSVG;
          } else {
            unmuteBtn.classList.remove("is-visible");
          }
        },
      },
    });

    wrappers.forEach(function (el, i) {
      if (i + 1 >= wrappers.length) return;
      var next = wrappers[i + 1];
      var nextCenter =
        next.getBoundingClientRect().top +
        window.pageYOffset +
        next.offsetHeight / 2;
      var thisCenter =
        el.getBoundingClientRect().top +
        window.pageYOffset +
        el.offsetHeight / 2;
      tl.add(
        Flip.fit(target, next, {
          duration: nextCenter - thisCenter,
          ease: "none",
        })
      );
    });

    ScrollTrigger.create({
      id: "flip-theater",
      trigger: wrappers[0],
      start: "center center",
      endTrigger: videoRow,
      end: "bottom bottom",
      onEnter: enterTheater,
      onLeave: exitTheater,
      onEnterBack: enterTheater,
      onLeaveBack: exitTheater,
    });
  }

  buildFlip();

  var resizeTimer;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(buildFlip, 200);
  });
});

}
// Reference inline visual script 12
if (!reduced) {

  document.addEventListener("DOMContentLoaded", function () {
  const mm = gsap.matchMedia();

  // ── Desktop: hover reveal with edge detection ──
  mm.add("(min-width: 768px)", () => {
    const list = document.querySelector(".logos_wall-list");
    if (!list) return;

    const blocks = document.querySelectorAll(".logo_block");
    const items = document.querySelectorAll(".col.cc-logo");

    function getEdgeMap() {
      const map = new Map();
      items.forEach((item, i) => {
        const block = item.querySelector(".logo_block");
        if (!block) return;

        const isFirst = i === 0 || item.offsetLeft <= items[i - 1].offsetLeft;
        const next = items[i + 1];
        const isLast = !next || next.offsetLeft <= item.offsetLeft;

        map.set(block, { isFirst, isLast });
      });
      return map;
    }

    let edgeMap = getEdgeMap();

    // Debounced resize
    let resizeTimer;
    const onResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        edgeMap = getEdgeMap();
      }, 150);
    };
    window.addEventListener("resize", onResize);

    function getPositions(block) {
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

    blocks.forEach((block) => {
      const hover1 = block.querySelector(".logo_hover1");
      const hover2 = block.querySelector(".logo_hover2");
      if (!hover1 || !hover2) return;

      let tl;

      const onEnter = () => {
        if (tl) tl.kill();

        const { h1Pos, h2Pos } = getPositions(block);

        tl = gsap.timeline();

        // Set final positions
        tl.set(hover1, {
          display: "block",
          top: h1Pos.top,
          left: h1Pos.left,
          right: "auto",
          bottom: "auto",
        });
        tl.set(hover2, {
          display: "block",
          top: h2Pos.top,
          left: h2Pos.left,
          right: "auto",
          bottom: "auto",
        });

        // Animate from logo center outward
        tl.fromTo(
          hover1,
          {
            opacity: 0,
            scale: 0.5,
            rotation: 0,
            x: "50%",
            y: "50%",
          },
          {
            opacity: 1,
            scale: 1,
            rotation: h1Pos.rotation,
            x: "0%",
            y: "0%",
            duration: 0.6,
            ease: "expo.out",
            transformOrigin: h1Pos.transformOrigin,
          },
          0
        );

        tl.fromTo(
          hover2,
          {
            opacity: 0,
            scale: 0.5,
            rotation: 0,
            x: "-50%",
            y: "-50%",
          },
          {
            opacity: 1,
            scale: 1,
            rotation: h2Pos.rotation,
            x: "0%",
            y: "0%",
            duration: 0.6,
            ease: "expo.out",
            transformOrigin: h2Pos.transformOrigin,
          },
          0.06
        );
      };

      const onLeave = () => {
        if (tl) tl.kill();

        tl = gsap.timeline();
        tl.to([hover1, hover2], {
          opacity: 0,
          scale: 0.7,
          duration: 0.35,
          ease: "expo.in",
          stagger: 0.03,
        }).set([hover1, hover2], {
          display: "none",
          clearProps: "top,left,right,bottom,x,y,scale,opacity",
        });
      };

      block.addEventListener("mouseenter", onEnter);
      block.addEventListener("mouseleave", onLeave);

      return () => {
        block.removeEventListener("mouseenter", onEnter);
        block.removeEventListener("mouseleave", onLeave);
        window.removeEventListener("resize", onResize);
        gsap.set([hover1, hover2], { clearProps: "all" });
      };
    });
  });

  // ── Mobile: looping marquee ──
  mm.add("(max-width: 767px)", () => {
    const list = document.querySelector(".logos_wall-list");
    if (!list) return;

    const hoverImgs = list.querySelectorAll(".logo_hover1, .logo_hover2");
    gsap.set(hoverImgs, { display: "none" });

    const items = list.querySelectorAll(".col.cc-logo");
    gsap.set(items, { width: "30vw", flexShrink: 0 });

    const originals = Array.from(list.children);
    const clones = originals.map((item) => {
      const clone = item.cloneNode(true);
      list.appendChild(clone);
      return clone;
    });

    gsap.set(list.querySelectorAll(".col.cc-logo"), {
      width: "30vw",
      flexShrink: 0,
    });

    const gap = parseFloat(getComputedStyle(list).gap) || 0;
    const scrollDist = originals.reduce(
      (sum, item) => sum + item.offsetWidth + gap,
      0
    );

    const tl = gsap.to(list, {
      x: -scrollDist,
      duration: scrollDist / 50,
      ease: "none",
      repeat: -1,
    });

    return () => {
      tl.kill();
      clones.forEach((clone) => clone.remove());
      gsap.set(items, { clearProps: "all" });
      gsap.set(list, { clearProps: "all" });
      gsap.set(hoverImgs, { clearProps: "all" });
    };
  });
});



}
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
