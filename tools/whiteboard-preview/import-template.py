"""One-time source import. Normal Next builds use the checked-in templates.

Run from the repository root with Python + beautifulsoup4, then run scope-css.cjs.
No website requests, form submissions or CMS writes are made.
"""
from bs4 import BeautifulSoup, NavigableString, Comment
from pathlib import Path
from copy import deepcopy
import hashlib
import json
import re
import shutil
import sys

SOURCE = Path(sys.argv[1] if len(sys.argv) > 1 else 'E:/whiteboard-clone')
ROOT = Path(__file__).resolve().parents[2]
TARGET = ROOT / 'apps/web/components/whiteboard/original'
PUBLIC = ROOT / 'apps/web/public/whiteboard-original'
TARGET.mkdir(parents=True, exist_ok=True)
PUBLIC.mkdir(parents=True, exist_ok=True)
home = BeautifulSoup((SOURCE/'src/reference/index.html').read_text(encoding='utf-8'), 'html.parser')
work = BeautifulSoup((SOURCE/'src/reference/work.html').read_text(encoding='utf-8'), 'html.parser')
case = BeautifulSoup((SOURCE/'src/reference/case-studies--ted-conferences-event-platform.html').read_text(encoding='utf-8'), 'html.parser')
about = BeautifulSoup((SOURCE/'src/reference/about.html').read_text(encoding='utf-8'), 'html.parser')
templates = {}

def text(node, value):
    node.clear()
    node.append(value)

def slot(node, name):
    node.clear()
    node['data-zd-slot'] = name

def image(node, key='image'):
    node['src'] = '{{'+key+'}}'
    node['alt'] = '{{title}}'
    for attr in ['srcset', 'sizes']:
        node.attrs.pop(attr, None)

def links(node, key='href', label='title'):
    for a in node.select('a'):
        a['href'] = '{{'+key+'}}'
        a['aria-label'] = '{{'+label+'}}'
        a.attrs.pop('target', None)
        a.attrs.pop('aria-current', None)
        a['class'] = [c for c in a.get('class',[]) if c != 'w--current']
        for hidden in a.select('.u-sr-only'): text(hidden, '{{'+label+'}}')

def clean(node):
    for tag in node.select('script,style,link,form,iframe,noscript'):
        tag.decompose()
    for tag in node.find_all(True):
        for k in list(tag.attrs):
            if k.startswith('on') or k in ['data-taxi','data-taxi-view','data-barba','data-w-id']:
                del tag.attrs[k]
        if tag.name == 'img' and not tag.get('src','').startswith(('{{','/brand/')):
            raise ValueError('Unbound reference image: '+tag.get('src',''))

def props(attrs):
    result = {}
    alias = {'class':'className','for':'htmlFor','tabindex':'tabIndex','viewbox':'viewBox','preserveaspectratio':'preserveAspectRatio', 'playsinline':'playsInline','autoplay':'autoPlay','fetchpriority':'fetchPriority','readonly':'readOnly','maxlength':'maxLength','colspan':'colSpan'}
    boolean = {'muted','loop','controls','autoplay','playsinline','disabled','hidden','required','readonly','inert'}
    svg_alias = {'clip-path':'clipPath','clip-rule':'clipRule','fill-rule':'fillRule','stroke-width':'strokeWidth','stroke-linecap':'strokeLinecap','stroke-linejoin':'strokeLinejoin','stroke-miterlimit':'strokeMiterlimit','fill-opacity':'fillOpacity','stroke-opacity':'strokeOpacity','xlink:href':'xlinkHref','xmlns:xlink':'xmlnsXlink'}
    for key,value in attrs.items():
        if key == 'style':
            style = {}
            for pair in re.split(r';(?![^()]*\))',value):
                if ':' not in pair: continue
                prop,val = pair.split(':',1)
                prop=prop.strip()
                if not prop.startswith('--'): prop=re.sub(r'-([a-z])',lambda m:m[1].upper(),prop)
                style[prop]=val.strip()
            result['style']=style
        elif key in boolean: result[alias.get(key,key)]=True
        else: result[svg_alias.get(key,alias.get(key,key))]=' '.join(value) if isinstance(value,list) else value
    return result

def tree(node):
    if isinstance(node,Comment): return None
    if isinstance(node,NavigableString): return str(node) if str(node).strip() else None
    children=[x for child in node.children if (x:=tree(child)) is not None]
    name={'clippath':'clipPath','lineargradient':'linearGradient','radialgradient':'radialGradient','textpath':'textPath'}.get(node.name,node.name)
    return {'tag':name, 'props':props(node.attrs), 'children':children}

def save(name,node):
    clean(node)
    templates[name]=tree(node)

# Navigation: retain the original grid, hidden menu and icon markup.
nav=deepcopy(home.select_one('nav'))
nav_item=deepcopy(nav.select_one('.nav_link_wrap'))
nav_company=deepcopy(nav.select('.nav_content')[-1].select_one('.nav_link_wrap'))
for name,n in [('navProduct',nav_item),('navCompany',nav_company)]:
    text(n.select_one('.eyebrow'),'{{title}}')
    image(n.select_one('img'))
    links(n)
    save(name,n)
for logo in nav.select('.nav_logo'):
    for svg in logo.select('svg'): svg.decompose()
    img=home.new_tag('img',src='/brand/zhuduo-wordmark.png',alt='ZHUDUO')
    img['class']=['zd-reference-logo']
    logo.insert(0,img)
    for a in logo.select('a'): a['href']='{{homeHref}}'; a['aria-label']='ZHUDUO'; a.attrs.pop('aria-current',None)
for element in nav.find_all(string=lambda x:x and 'hello@whiteboard.is' in x): element.replace_with('{{email}}')
for a in nav.select('a[href^="mailto:"]'): a['href']='mailto:{{email}}'; a['aria-label']='{{email}}'
columns=nav.select('.nav_content')
text(columns[0].select_one('.h3'),'{{productLabel}}')
text(columns[-1].select_one('.h3'),'{{companyLabel}}')
slot(columns[0].select_one('.nav_links_wrap'),'navProducts')
slot(columns[-1].select_one('.nav_links_wrap'),'navCompany')
text(columns[0].select_one('.nav_content_link .btn-text'),'{{allProducts}}')
for a in columns[0].select('.nav_content_link a'): a['href']='{{catalogueHref}}'; a['aria-label']='{{allProducts}}'
text(nav.select_one('.nav_open_tagline .eyebrow'),'{{tagline}}')
for node in nav.select('.global_project_text'): text(node,'{{menuNote}}')
for node in nav.select('.button_main_text,.nav_open_mb .btn-text'): text(node,'{{inquiryLabel}}')
for a in nav.select('a[href*="typeform"]'): a['href']='#contact'; a.attrs.pop('target',None); a['aria-label']='{{inquiryLabel}}'
trigger=nav.select_one('[menu="trigger-open"]')
trigger.name='button'; trigger['type']='button'; trigger['aria-expanded']='false'; trigger['aria-controls']='zd-original-menu'; trigger['aria-label']='{{menuLabel}}'
text(trigger.select_one('.btn-text'),'{{menuLabel}}')
close=nav.select_one('[menu="trigger-close"]'); close.name='button'; close['type']='button'; close['aria-label']='{{closeLabel}}'
text(close.select_one('.btn-text'),'{{closeLabel}}')
container=nav.select_one('[menu="container"]'); container['id']='zd-original-menu'; container['role']='dialog'; container['aria-modal']='true'; container['aria-label']='{{menuLabel}}'; container['aria-hidden']='true'; container['inert']=''
language=home.new_tag('div'); language['data-zd-slot']='language'; language['class']=['zd-reference-language']
trigger.insert_before(language)
for button in nav.select('.clickable_btn'): button.decompose()
for n in nav.select('.u-sr-only'):
    if n.get_text(strip=True)=='View All Work': text(n,'{{allProducts}}')
    if n.get_text(strip=True)=='Work With Us': text(n,'{{inquiryLabel}}')
save('nav',nav)

# Original hero including the small-to-large film wrappers.
hero=deepcopy(home.select_one('.page-main > section'))
h1=hero.select_one('h1'); text(h1,'{{heroOne}}'); h1.append(home.new_tag('br')); h1.append('{{heroTwo}}')
text(hero.select_one('p'),'{{heroNote}}')
slot(hero.select_one('.video_container'),'film')
save('hero',hero)

# Keep two service cards for the housing and electrical video backgrounds.
services=deepcopy(home.select('.page-main > section')[1])
services['class'].append('zd-services')
text(services.select_one('h2'),'{{servicesTitle}}')
for i,card in enumerate(services.select('.card_wrapper')):
    if i >= 2:
        card.parent.decompose()
        continue
    card.parent['class']=['col','col-lg-6','col-sm-12']
    text(card.select_one('h3'),'{{service'+str(i)+'}}')
    for n in card.select('.card_bottom .btn-text'): text(n,'{{serviceNote'+str(i)+'}}')
    slot(card.select_one('.card_media'),'serviceMedia'+str(i))
    links(card,'serviceHref'+str(i),'service'+str(i))
save('services',services)

# Credential wall keeps the original hover-image / mobile-marquee structure.
wall=deepcopy(home.select('.page-main > section')[2])
for n in wall.select('h1,h2,h3,p'): text(n,'{{certNote}}')
wall_item=deepcopy(wall.select_one('.col.cc-logo'))
block=wall_item.select_one('.logo_block'); block.attrs.pop('id',None)
text(block.select_one('.logo_rich-text'),'{{title}}')
for img in block.select('img'): image(img)
links(block)
save('credential',wall_item)
slot(wall.select_one('.logos_wall-list'),'credentials')
save('credentials',wall)

# Image cards are the real reference cards, with their layered hover content.
card=deepcopy(home.select_one('[data-module="casestudy-card"]'))
for h in card.select('h1,h2,h3'): text(h, '{{summary}}' if h.parent.get('class') and 'rich-text' in h.parent.get('class') else '{{title}}')
for n in card.select('.eyebrow'): text(n,'{{category}}')
for h in card.select('.card_hover-content > .heading-component:last-of-type h3'): text(h,'{{category}}')
for img in card.select('img'): image(img)
for video in card.select('video'):
    replacement=home.new_tag('img',src='{{image}}',alt='',loading='lazy',**{'class':'bg_video zd-card-background'})
    video.replace_with(replacement)
card['data-zd-card']='{{kind}}'
links(card)
save('card',card)

feature=deepcopy(home.select_one('.casestudy_card.is--feature'))
for i,n in enumerate(feature.select('.feature_content-bar .eyebrow')): text(n, '{{featureLabel'+str(i)+'}}')
text(feature.select_one('h3'),'{{featureTitle}}')
text(feature.select_one('.btn-text'),'{{featureAction}}')
for i,img in enumerate(feature.select('img')): image(img,'featureImage'+str(i))
links(feature,'featureHref','featureAction')
save('feature',feature)

# Existing company figures occupy the original staggered statistics columns.
stats=deepcopy(home.select('.page-main > section')[4])
for i,col in enumerate(stats.select('.row.cc-stats > .col')):
    headings=col.select('h3')
    slot(headings[0],'stat'+str(i))
    headings[0].attrs.pop('data-split',None)
    text(headings[1],'{{statLabel'+str(i)+'}}')
    text(col.select_one('p'),'{{statNote'+str(i)+'}}')
    for video in col.select('video'): video.decompose()
    for img in col.select('img'): image(img,'statImage'+str(i))
save('stats',stats)

# Work page's tab bar and grid; actual filtering uses existing catalogue keys.
listing=deepcopy(work.select_one('.page-main > section'))
slot(listing.select_one('.tabs_menu'),'filters')
active=listing.select_one('.w-tab-pane'); active['class']=['w-tab-pane','w--tab-active']
for pane in listing.select('.w-tab-pane')[1:]: pane.decompose()
slot(active.select_one('.w-dyn-items'),'cards')
for row in listing.select('.container > .row'):
    row.decompose()
save('listing',listing)
tab=deepcopy(work.select_one('.tab')); tab.attrs.pop('data-w-tab',None); tab['href']='{{href}}'; tab['class']=['tab','w-inline-block','w-tab-link','{{current}}']; text(tab.select_one('.eyebrow'),'{{title}}')
save('filter',tab)

# Detail pages use the original TED case layout, not the former site layout.
sections=case.select('.page-wrap > section')
case_hero=deepcopy(sections[0]); hs=case_hero.select('h1'); text(hs[0],'{{title}}'); hs[1].name='p'; text(hs[1],'{{summary}}')
slot(case_hero.select_one('.casestudy_hero-img'),'gallery')
save('detailHero',case_hero)
feature_hero=deepcopy(case_hero)
feature_hero.select_one('h1').name='h2'
save('featureHero',feature_hero)
facts=deepcopy(sections[1])
for i,col in enumerate(facts.select('.shortilst_column')):
    text(col.select_one('.eyebrow'),'{{factLabel'+str(i)+'}}')
    text(col.select_one('p'),'{{fact'+str(i)+'}}')
save('detailFacts',facts)
intro=deepcopy(sections[2]); slot(intro.select_one('.rich-text'),'body'); save('detailBody',intro)
picture=deepcopy(sections[3].select_one('.w-dyn-item')); image(picture.select_one('img')); save('detailImage',picture)

about_hero=deepcopy(about.select_one('.page-main > section')); text(about_hero.select_one('h1'),'{{aboutTitle}}'); save('aboutHero',about_hero)

# Footer keeps the reference layout and typography, replaces all agency content.
footer=deepcopy(home.select_one('footer'))
item=deepcopy(footer.select_one('.footer_link')); text(item.select_one('.paragraph'),'{{title}}'); links(item); save('footerLink',item)
text(footer.select_one('.eyebrow'),'{{companyName}}')
text(footer.select_one('.u-text-chatt'),'{{address}}')
for tip in footer.select('.css-tooltip__icon'): tip.decompose()
for i,items in enumerate(footer.select('.footer_list')): slot(items,'footerLinks'+str(i))
for n in footer.select('.footer_links-wrap'): text(n,'{{demoNote}}')
for n in footer.select('.cc--footer-hover'): text(n,'© {{year}} ZHUDUO')
labels=footer.select('.eyebrow')
if len(labels)>1: text(labels[1],'{{linksLabel}}')
if len(labels)>2: text(labels[2],'{{contactLabel}}')
save('footer',footer)

# Collect original styling before removing embeds. Fonts + visual runtimes only.
styles=[]
for soup in [home,work,case,about]:
    for n in soup.select('style'):
        css=n.get_text()
        if css.strip() and css not in styles: styles.append(css)
base_css=(SOURCE/'assets/reference/css/b47064fd5c12-wb-is-2026.webflow.shared.e2281d4a4.min.css').read_text(encoding='utf-8')
(TARGET/'reference.unscoped.css.txt').write_text(base_css+'\n'+'\n'.join(styles),encoding='utf-8')
(TARGET/'templates.json').write_text(json.dumps(templates,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
fonts=PUBLIC/'fonts'; fonts.mkdir(exist_ok=True)
for name in re.findall(r'url\([\"\']?\.\./\.\./fonts/([^\"\')]+)',base_css): shutil.copy2(SOURCE/'assets/fonts'/name,fonts/name)
scripts=PUBLIC/'js'; scripts.mkdir(exist_ok=True)
for name in ['gsap.min.js','ScrollTrigger.min.js','Flip.min.js','SplitText.min.js','lenis.min.js']: shutil.copy2(SOURCE/'assets/reference/js'/name,scripts/name)
manifest={name:hashlib.sha256((SOURCE/'src/reference'/name).read_bytes()).hexdigest() for name in ['index.html','work.html','case-studies--ted-conferences-event-platform.html','about.html']}
(TARGET/'provenance.json').write_text(json.dumps({'source':'E:/whiteboard-clone','sha256':manifest,'templates':list(templates),'purpose':'Local ZHUDUO design preview; existing CMS and inquiry components retained.'},indent=2),encoding='utf-8')
print('Imported',len(templates),'reference fragments; original fonts and five local visual libraries.')
