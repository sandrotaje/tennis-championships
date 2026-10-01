import pathlib,re,json,shutil,sys
if len(sys.argv)!=2:
 raise SystemExit('Usage: python3 scripts/prepare-art.py /path/to/exported-art')
src=pathlib.Path(sys.argv[1]); out=pathlib.Path('public/art'); out.mkdir(parents=True,exist_ok=True)
manifest={}
def add(name,path,scene=False,remove=[]):
 s=path.read_text(); w=float(re.search(r'width="([\d.]+)px"',s)[1]);h=float(re.search(r'height="([\d.]+)px"',s)[1]);m=re.search(r'<g transform="matrix\(1.0, 0.0, 0.0, 1.0, ([\d.-]+), ([\d.-]+)\)">',s);ox=float(m[1]) if m else 0;oy=float(m[2]) if m else 0
 for id in remove:s=re.sub(r'<use\b[^>]*ffdec:characterId="'+str(id)+r'"[^>]*/>','',s)
 if scene:
  s=s.replace(m[0],'<g transform="matrix(1,0,0,1,0,0)">',1);s=re.sub(r'width="[\d.]+px"','width="600px"',s,count=1);s=re.sub(r'height="[\d.]+px"','height="600px"',s,count=1);w=h=600;ox=oy=0
 (out/(name+'.svg')).write_text(s);manifest[name]={'w':w,'h':h,'ox':ox,'oy':oy}
for n,i,rm in [('menu',15,[29]),('setup',33,[35,47]),('select',284,list(range(302,318))+[35]),('bracket',318,list(range(321,339))+[47])]:add(n,src/f'sprites/DefineSprite_{i}/1.svg',True,rm)
add('champion',src/'sprites/DefineSprite_339/2.svg',True,[344])
add('message',src/'sprites/DefineSprite_256/8.svg',False,[258,259])
add('point',src/'sprites/DefineSprite_256/13.svg',False,[258,259])
add('gamepanel',src/'sprites/DefineSprite_256/19.svg',False,[259,269,270,263,264,265,266,47])
add('court',src/'shapes/54.svg',True)
add('exit',src/'buttons/DefineButton2_279/1_up.svg')
add('barbase',src/'shapes/36.svg')
add('barfill',src/'sprites/DefineSprite_38/1.svg')
for n,i in [('net',17),('shadow',57),('ball',5),('ballshadow',158)]:add(n,src/f'sprites/DefineSprite_{i}/1.svg')
for side,data in enumerate([{'wait':(160,-150.4,-200.5),'right':(161,-150.15,-200.4),'left':(175,-151.3,-201.1),'fore':(189,-151.45,-200.65),'back':(208,-151.45,-200.65),'smash':(226,-150.1,-201.05),'serve':(243,-151.15,-200.5),'toss':(244,-150.05,-199.55),'lose':(254,-150.75,-200.9),'win':(255,-150.5,-200.7)}, {'wait':(60,-150.55,-201.05),'right':(61,-151.3,-199.5),'left':(75,-151.15,-200.4),'fore':(89,-151.3,-201.35),'back':(108,-151.15,-201.25),'smash':(126,-151.1,-201.2),'serve':(143,-151.15,-200.95),'toss':(144,-151.15,-200.95),'lose':(154,-150.95,-200.95),'win':(155,-151.35,-201.15)}]):
 for state,(i,tx,ty) in data.items():
  paths=sorted((src/f'sprites/DefineSprite_{i}').glob('*.svg'),key=lambda p:int(p.stem)) if (src/f'sprites/DefineSprite_{i}').exists() else [src/f'shapes/{i}.svg']
  for j,p in enumerate(paths):
   n=f'p{side}-{state}-{j}';add(n,p);manifest[n]['ox']-=tx;manifest[n]['oy']-=ty
pathlib.Path('src/art.json').write_text(json.dumps(manifest))
pathlib.Path('public/fonts').mkdir(exist_ok=True)
for p in (src/'fonts').glob('*.ttf'):shutil.copy(p,'public/fonts')
