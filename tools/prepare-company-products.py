from pathlib import Path
import json, re, hashlib, io, argparse
from PIL import Image, ImageOps
import pymupdf
import cv2
import numpy as np

parser = argparse.ArgumentParser(description='Prepare company catalogue photos from the supplied brochures and electrical images.')
parser.add_argument('--source', type=Path, required=True)
parser.add_argument('--legacy-brochure', type=Path)
args = parser.parse_args()
root = args.source.resolve()
repo = Path(__file__).resolve().parents[1]
target = repo/'apps/web/public/products/company'
target.mkdir(parents=True, exist_ok=True)
bundle = repo/'.cache/product-import'
(bundle/'brochures').mkdir(parents=True, exist_ok=True)
old = json.loads((repo/'packages/contracts/company-products.json').read_text(encoding='utf-8'))
legacy = old.get('legacyProducts', old['products'])
products = json.loads(json.dumps(legacy, ensure_ascii=False))
assets = {}
pdfs = sorted(root.glob('*.pdf'))
docs = [pymupdf.open(p) for p in pdfs]
brochures = {}
for key,p in [(f'brochure-{i+1}',p) for i,p in enumerate(pdfs)] + [('original-container',args.legacy_brochure or repo/'Container House.pdf')]:
    filename = key+'.pdf'
    brochures[key] = {'name':p.name, 'path':'brochures/'+filename,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}

def save_image(im,name,source):
    im=ImageOps.exif_transpose(im)
    if im.mode not in ('RGB','RGBA'): im=im.convert('RGB')
    im.thumbnail((1440,1440),Image.Resampling.LANCZOS)
    path=target/(name+'.webp');im.save(path,'WEBP',quality=88,method=6)
    url='/products/company/'+path.name
    assets[url]={'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'source':source}
    return url

def crop(doc,page,name,box=(0,0,1,1),isolate=False):
    p=docs[doc-1][page-1];r=p.rect
    rect=pymupdf.Rect(box[0]*r.width,box[1]*r.height,box[2]*r.width,box[3]*r.height)
    pix=p.get_pixmap(matrix=pymupdf.Matrix(1.8,1.8),clip=rect,alpha=False)
    im=Image.frombytes('RGB',(pix.width,pix.height),pix.samples)
    return save_image(clean_equipment(im) if isolate else im,name,{'document':pdfs[doc-1].name,'page':page,'crop':box})

def embedded(doc, page, xref, name, box=None):
    data=docs[doc-1].extract_image(xref)
    im=Image.open(io.BytesIO(data['image']))
    if box:im=im.crop(tuple(int(v*(im.width if i%2==0 else im.height)) for i,v in enumerate(box)))
    return save_image(im, name, {'document':pdfs[doc-1].name,'page':page,'imageObject':xref,**({'crop':box} if box else {})})

def clean_equipment(im, template=False):
    # Only white studio photographs use this cutout. Factory and detail photos
    # retain their original background. Keep physical nameplates and labels.
    a=np.array(im.convert('RGB'));h,w=a.shape[:2]
    if template:
        header=a[:int(h*.21)]
        blue=(header[:,:,2].astype(float)>header[:,:,0]*1.3)&(header[:,:,2].astype(float)>header[:,:,1]*1.1)
        repair=np.zeros((h,w),dtype='uint8');repair[:int(h*.21)]=blue
        # Remove strokes before finding the silhouette: some logos cross the
        # metalwork edge, where white filling would leave letter-shaped holes.
        repair=cv2.dilate(repair,np.ones((3,3),np.uint8))
        a=cv2.inpaint(a,repair*255,3,cv2.INPAINT_TELEA)
    mask=(a.min(axis=2)<225).astype('uint8')
    if template:mask[int(h*.825):]=0
    n,labels,stats,_=cv2.connectedComponentsWithStats(mask,8)
    j=1+np.argmax(stats[1:,cv2.CC_STAT_AREA])
    m=(labels==j).astype('uint8')
    contours,_=cv2.findContours(m,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)
    cv2.drawContours(m,contours,-1,1,cv2.FILLED)
    m=cv2.dilate(m,np.ones((5,5),np.uint8))
    a[m==0]=255
    x,y,bw,bh,_=stats[j]
    return ImageOps.expand(Image.fromarray(a).crop((x,y,x+bw,y+bh)),border=35,fill='white')

def add(slug,key,zh,en,summary_zh,summary_en,detail_zh,detail_en,image,gallery,source,brochure=None,options_zh=None,options_en=None):
    p={'slug':slug,'categoryKey':key,'imageUrl':image,'galleryUrls':gallery,'source':source,
       'en':{'title':en,'category':names[key]['en'],'summary':summary_en,'detail':detail_en,'options':options_en or []},
       'zh-Hans':{'title':zh,'category':names[key]['zh'],'summary':summary_zh,'detail':detail_zh,'options':options_zh or []}}
    if brochure:p['brochureKey']=brochure
    products.append(p)
    return p

taxonomy=json.loads((repo/'packages/contracts/product-taxonomy.json').read_text(encoding='utf-8'))
housing=taxonomy['divisions'][1]['categories']
if not any(c['slug']=='apple-cabins' for c in housing):
    housing.append({'slug':'apple-cabins','name':{'zh':'苹果舱','en':'Apple Cabins'}})
names={c['slug']:c['name'] for d in taxonomy['divisions'] for c in d['categories']}

for p in products:
    p['categoryKey']='space-capsules' if p['slug']=='space-capsule-d7' else 'expandable-homes'
    p['galleryUrls']=[]
    p['brochureKey']='brochure-2' if p['slug']=='space-capsule-d7' else 'original-container'
    if p['slug'] in ('expandable-30ft','expandable-20ft-mini'):
        p['source']['note']='Retained existing company product; not re-specified by the supplied new brochures.'
        url=p['imageUrl'];data=(repo/'apps/web/public'/url.lstrip('/')).read_bytes()
        assets[url]={'sha256':hashlib.sha256(data).hexdigest(),'source':p['source']}

d7=next(p for p in products if p['slug']=='space-capsule-d7')
d7['source']={'document':pdfs[1].name,'page':24,'imagePage':21}
d7['imageUrl']=crop(2,21,'space-capsule-d7',(0.52,0.5,0.98,0.95))
d7['galleryUrls']=[crop(2,22,'d7-lounge',(0.07,0.17,0.94,0.97)),crop(2,23,'d7-interior',(0.04,0.04,0.94,0.97)),crop(2,26,'d7-exterior-setting')]

for model,page,length,weight,occupancy in [('20ft',4,5900,'4.5','2–4'),('40ft',7,11380,'7.9','4–6')]:
    p=next(p for p in products if p['slug']==f'expandable-{model}')
    p['source']={'document':pdfs[3].name,'page':page}
    p['brochureKey']='brochure-4'
    p['imageUrl']=crop(4,page,f'expandable-{model}',(0.03,0.6 if page==4 else 0.65,0.44,0.96))
    p['galleryUrls']=[crop(4,5 if page==4 else 8,f'expandable-{model}-interior',(0.13,0.16,0.85,0.97))]
    p['en']['summary']=f'{model.upper()} expandable house, {length} × 6320 × 2430 mm after expansion, with brochure occupancy of {occupancy} people.'
    p['zh-Hans']['summary']=f'{model.upper()} 拓展箱，展开后 {length} × 6320 × 2430 mm，产品册标注可入住 {occupancy} 人。'
    p['en']['detail']=f'Expanded dimensions (L × W × H): {length} × 6320 × 2430 mm.\nBefore expansion: {length} × 2300 × 2430 mm.\nBrochure weight: {weight} tonnes.\nOccupancy: {occupancy} people.\nListed electrical power: 12 kW.\nThis configuration follows the dedicated Expandable House brochure. Other brochures contain different configurations; agree final specifications before ordering.'
    p['zh-Hans']['detail']=f'展开后尺寸（长 × 宽 × 高）：{length} × 6320 × 2430 mm。\n展开前尺寸：{length} × 2300 × 2430 mm。\n产品册标注重量：{weight} 吨。\n入住人数：{occupancy} 人。\n标注用电功率：12 kW。\n本配置采用拓展箱专册数据；综合册另有不同配置，订购前请确认最终规格。'

apple=[('ac01',2,3,'5800 × 2150 × 2400','1–2',(0.52,0.48,0.99,0.91)),
       ('ac02',4,5,'5800 × 2150 × 2400','1–2',(0.52,0.48,0.99,0.91)),
       ('ac03',6,6,'5800 × 2150 × 2400','1–2',(0.52,0.54,0.98,0.96)),
       ('ac04',8,9,None,'2–4',(0.55,0.54,0.98,0.94)),
       ('ac05',10,11,None,'2–4',(0.52,0.42,0.98,0.96)),
       ('ac06',13,14,'11500 × 2150 × 2400','2–4',(0.48,0.38,0.99,0.85)),
       ('ae01',16,17,'2250 × 2150 × 2400','1',(0.025,0.15,0.49,0.65))]
for model,page,plan,size,people,box in apple:
    title=model.upper()
    en=f'{title} Apple Cabin';zh=f'{title} 苹果舱'
    sz_en=f'Brochure dimensions: {size} mm.' if size else ('First floor: 11500 × 2150 × 2400 mm. Second floor: 5800 × 2150 × 2400 mm.' if model=='ac04' else 'The brochure shows a two-level arrangement. Confirm the assembled dimensions for your site.')
    sz_zh=f'产品册尺寸：{size} mm。' if size else ('一层：11500 × 2150 × 2400 mm；二层：5800 × 2150 × 2400 mm。' if model=='ac04' else '产品册展示双层组合布局，整体安装尺寸按项目确认。')
    extra_en='The brochure lists 24.9 m² while its single-module dimensions describe a smaller footprint; confirm the module arrangement before ordering.' if model=='ac03' else 'The final layout, finishes, openings and equipment are agreed for each project.'
    extra_zh='产品册同时标注 24.9 m²，但单舱尺寸对应的占地面积更小，订购前须确认组合方式与面积。' if model=='ac03' else '最终布局、饰面、门窗和设备配置按项目确认。'
    objects={'ac01':29,'ac02':51,'ac03':60,'ac04':69,'ae01':97}
    image=embedded(1,page,objects[model],'apple-'+model) if model in objects else crop(1,page,'apple-'+model,(0.52,0.42,0.98,0.96) if model=='ac05' else (0.458,0.41,0.995,0.81))
    if model=='ac06':image=embedded(1,page,86,'apple-ac06',(.018,.175,.548,.42))
    galleries={'ac01':[(2,27),(2,28)],'ac02':[(4,49),(4,50)],'ac03':[], 'ac04':[(8,67)],'ac05':[],'ac06':[],'ae01':[(16,98),(16,99),(16,100)]}
    gallery=[embedded(1,pg,x,'apple-'+model+'-'+str(x)) for pg,x in galleries[model]]
    add('apple-cabin-'+model,'apple-cabins',zh,en,f'{title} 型苹果舱，产品册展示独立模块与室内布局，参考入住人数 {people} 人。',f'{title} apple cabin with exterior and layout illustrations; brochure occupancy: {people} people.',sz_zh+f'\n参考入住人数：{people} 人。\n'+extra_zh,sz_en+f'\nBrochure occupancy: {people} people.\n'+extra_en,image,gallery,{'document':pdfs[0].name,'page':page,'specificationPage':plan},'brochure-1',['布局与内饰配置','外墙、门窗与卫浴配置'],['Layout and interior finishes','Exterior panels, openings and bathroom configuration'])

for slug,key,page,zh,en,size in [('folding-house-z','folding-homes',4,'Z 字型折叠箱','Z Type Folding House','2438 × 5850 × 2620'),('folding-house-y','folding-homes',6,'Y 字型折叠箱','Y Type Folding House','2438 × 5900 × 2340'),('detachable-house','detachable-homes',7,'快拼箱房','Detachable Container House','3000 × 6000 × 2896'),('flat-pack-house','flat-pack-homes',8,'打包箱房','Flat Pack Container House','2438 × 5950 × 2896')]:
    box=(0.385,0.23,0.685,0.60) if page==7 else (0.36,0.22,0.625,0.56) if page==8 else (0.275,0.525,0.45,0.73) if page==4 else (0.245,0.55,0.445,0.825)
    add(slug,key,zh,en,f'{zh}，产品册尺寸 {size} mm，参考入住人数 1–2 人。',f'{en}; brochure dimensions {size} mm and occupancy of 1–2 people.',f'产品册尺寸：{size} mm。\n参考入住人数：1–2 人。\n标注用电功率：12 kW。\n墙板、门窗、地板、室内布局和运输方案按项目确认。',f'Brochure dimensions: {size} mm.\nOccupancy: 1–2 people.\nListed electrical power: 12 kW.\nConfirm panels, openings, floors, interior arrangement and shipping for your project.',crop(5,page,slug,box,isolate=True),[crop(5,9, 'container-interior',(0.03,0.17,0.97,0.95))],{'document':pdfs[4].name,'page':page},'brochure-5')

add('solar-container-house','solar-homes','光伏离网集装箱房','Solar Off-grid Container House','产品册展示集装箱房与屋顶光伏离网系统的组合方案。','A container house paired with a roof-mounted off-grid solar power system in the company brochure.','产品册展示屋顶光伏板与集装箱房的组合。\n系统容量、储能、电气标准、房屋尺寸及用电需求需按项目确认。','The brochure shows roof-mounted solar panels on a container house.\nConfirm system capacity, storage, electrical standards, house dimensions and loads for your project.',crop(3,4,'solar-container-house',(0.55,0.685,0.81,0.93)),[],{'document':pdfs[2].name,'page':4},'brochure-3')

images=[{'path':p.relative_to(root).as_posix(),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
        for p in sorted(root.rglob('*')) if p.suffix.lower() in ('.jpg','.jpeg','.png')]
image_urls={}
for i,item in enumerate(images):
    path=root/item['path'];name='electrical-'+item['sha256'][:16]
    template=bool(re.match(r'\d+KVA',path.name,re.I)) or (path.parent.name=='110主变' and not path.name.startswith('390b39'))
    studio=template or path.name.startswith(('390b39','2dd32d'))
    im=clean_equipment(Image.open(path),template) if studio else Image.open(path)
    image_urls[item['path']]=save_image(im,name,{'file':item['path'],'treatment':'isolated-product' if studio else 'original-photo'})

def equipment(slug,key,zh,en,items,options_zh=None,options_en=None):
    return add(slug,key,zh,en,f'{zh}，配图来自公司提供的电气产品资料。',f'{en}, illustrated with the supplied company product materials.',f'产品类型：{zh}。\n'+('\n'.join(options_zh)+'。\n' if options_zh else '')+'容量、变比、绝缘、冷却方式、接线与适用标准，以确认后的技术方案及铭牌为准。',f'Product: {en}.\n'+('\n'.join(options_en)+'.\n' if options_en else '')+'Confirm capacity, voltage ratio, insulation, cooling, connections and applicable standards in the agreed specification and nameplate.',image_urls[items[0]['path']],[image_urls[x['path']] for x in items[1:]],{'files':[x['path'] for x in items]},options_zh=options_zh,options_en=options_en)

for folder,slug,key,zh,en in [('YB 欧式箱式变电站','substation-yb','substations','YB 欧式箱式变电站','YB European-type Substation'),('ZGS11 美式箱变','substation-zgs11','substations','ZGS11 美式箱变','ZGS11 American-type Substation'),('华式箱变','substation-combined','substations','华式箱变','Combined-type Substation'),('预制舱式箱变','substation-prefabricated','substations','预制舱式箱变','Prefabricated Cabin Substation'),('油浸式变压器','oil-immersed-transformer','distribution-transformers','油浸式变压器系列','Oil-immersed Transformer Range'),('干式变压器产品图','dry-type-transformer','distribution-transformers','干式变压器系列','Dry-type Transformer Range')]:
    items=[x for x in images if Path(x['path']).parent.as_posix()=='电器设备/'+folder]
    # Detail-only photos belong to the gallery, not the main image.
    if slug=='oil-immersed-transformer':items.sort(key=lambda x:0 if '6298dd' in x['path'] else 1)
    equipment(slug,key,zh,en,items)

for item in images:
    match=re.match(r'(\d+)KVA\s+(\d+)KV(?:\s+SC\(B\)(\d+))?',Path(item['path']).name,re.I)
    if not match:continue
    capacity,voltage,series=match.groups()
    stem=f'scb{series}' if series else 'oil'
    zh=f'SC(B){series} 干式变压器' if series else '油浸式变压器'
    en=f'SC(B){series} Dry-type Transformer' if series else 'Oil-immersed Transformer'
    equipment(f'{stem}-{voltage}kv-{capacity}kva','distribution-transformers',f'{capacity} kVA / {voltage} kV {zh}',f'{capacity} kVA / {voltage} kV {en}',[item],[f'标注容量：{capacity} kVA',f'标注电压等级：{voltage} kV'],[f'Listed capacity: {capacity} kVA',f'Listed voltage class: {voltage} kV'])

main=[x for x in images if Path(x['path']).parent.name=='110主变']
capacities=[12500,80000,20000,16000,None,31500,6300,10000,63000,25000,8000]
equipment('power-transformer-110kv','power-transformers','110 kV 主变压器系列','110 kV Power Transformer Range',main)
for item,capacity in zip(main,capacities):
    if capacity:equipment(f'power-110kv-{capacity}kva','power-transformers',f'{capacity} kVA / 110 kV 主变压器',f'{capacity} kVA / 110 kV Power Transformer',[item],[f'图片标注容量：{capacity} kVA','图片标注电压等级：110 kV'],[f'Capacity shown in image: {capacity} kVA','Voltage class shown in image: 110 kV'])

for product in products:
    seen={assets[product['imageUrl']]['sha256']}
    unique=[]
    for url in product['galleryUrls']:
        digest=assets[url]['sha256']
        if digest not in seen:unique.append(url);seen.add(digest)
    product['galleryUrls']=unique
used={url for p in products for url in [p['imageUrl'],*p['galleryUrls']]}
assets={url:meta for url,meta in assets.items() if url in used}
result={'version':'2026-10-company-materials','products':products,'assets':assets,'brochures':brochures,'legacyProducts':legacy,'retiredProductSlugs':old['retiredProductSlugs']}
(repo/'packages/contracts/company-products.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(repo/'packages/contracts/product-taxonomy.json').write_text(json.dumps(taxonomy,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
# Remove only generated, unused photos in this dedicated output directory.
for file in target.glob('*.webp'):
    if '/products/company/'+file.name not in assets:file.unlink()
print('PRODUCTS',len(products),'HOUSING',sum(p['categoryKey'] not in ('distribution-transformers','power-transformers','substations') for p in products),'ASSETS',len(assets))
