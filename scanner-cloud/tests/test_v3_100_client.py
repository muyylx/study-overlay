from pathlib import Path
BASE=Path(__file__).resolve().parents[1]
from playwright.sync_api import sync_playwright
from PIL import Image,ImageDraw
from io import BytesIO
import base64,json,time
S=(BASE/'client-v3.100.js').read_text().replace("const IS_KAHOOT=/^(?:play\\.)?kahoot\\.it$/i.test(location.hostname);",'const IS_KAHOOT=true;')
img=Image.new('RGB',(440,210),'white');ImageDraw.Draw(img).text((60,35),'VISUAL DATA',fill='black');b=BytesIO();img.save(b,'PNG');URL='data:image/png;base64,'+base64.b64encode(b.getvalue()).decode()
HTML=f'''<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{{font:20px sans-serif;margin:20px}}main{{max-width:640px}} button.tile{{width:48%;height:112px;display:inline-block;margin:5px;font-size:21px;color:white}}.tile:nth-child(1){{background:rgb(210,20,50)}}.tile:nth-child(2){{background:rgb(20,110,230)}}.tile:nth-child(3){{background:rgb(220,170,0)}}.tile:nth-child(4){{background:rgb(30,140,20)}}#img{{width:440px;height:210px}} </style></head><body><main><div id="timer">13</div><h1 data-functional-selector="question-text">Що правильно описує гази?</h1><div id="fig"><img id="img" src="{URL}" width="440" height="210"></div><section><button class="tile" data-functional-selector="answer-0">Газ має об'єм</button><button class="tile" data-functional-selector="answer-1">Газ має форму</button><button class="tile" data-functional-selector="answer-2">Газ заповнює весь об'єм</button><button class="tile" data-functional-selector="answer-3">Газ не стискається</button></section></main><script>window.requests=[];window.fetch=async(url,opts)=>{{const q=JSON.parse(opts.body);window.requests.push({{url, q, at:performance.now()}});return{{ok:true,json:async()=>({{answer:'C) Третій варіант',choices:['C'],explanation:'LONG EXPLANATION NOT TO DISPLAY',verification:'Ответ одной модели, не подтверждён',elapsedMs:1400,uncertain:true,imageAnalysis:{{received:q.images.length}}}})}}}};</script><script>{S}</script></body></html>'''

def run():
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
  errors=[];results=[]
  def new():
   page=browser.new_page(viewport={'width':390,'height':844});page.on('pageerror',lambda e:errors.append(str(e)));page.set_content(HTML,wait_until='domcontentloaded');return page
  page=new();page.locator('#scanner-cloud-3-100 button').first.click();page.wait_for_timeout(500)
  req=page.evaluate('requests[0]');results.append(('shape_color',{'count':page.evaluate('requests.length'),'q':req['q']['question'],'opts':req['q']['options'],'quick':req['q']['quick'],'url':req['url'],'label':page.locator('#scanner-cloud-3-100').inner_text(),'imageCount':len(req['q']['images'])}))
  assert '● (жёлтый)' in results[-1][1]['label']
  assert 'LONG EXPLANATION' not in results[-1][1]['label']
  assert req['q']['options'][2].startswith('Газ заповнює')
  assert req['q']['images'] and req['url'].endswith('?quick=1')
  assert 'v3.100' in results[-1][1]['label']
  page.close()
  page=new();page.locator('#scanner-cloud-3-100 button').nth(1).click();page.wait_for_timeout(1300)
  first=page.evaluate('requests.length');page.locator('#timer').evaluate("e=>e.textContent='5'");page.wait_for_timeout(950)
  results.append(('auto_timer_no_duplicate',{'before':first,'after':page.evaluate('requests.length')}));assert first==1 and page.evaluate('requests.length')==1
  page.locator('[data-functional-selector="question-text"]').evaluate("e=>e.textContent='Яку властивість газів досліджують?' ")
  page.wait_for_timeout(1300);results.append(('auto_new_question',{'requests':page.evaluate('requests.length')}));assert page.evaluate('requests.length')==2
  page.locator('#scanner-cloud-3-100 button[aria-label="Свернуть панель"]').click();mini=page.locator('#scanner-cloud-3-100 button[aria-label="Развернуть панель"]');results.append(('collapse',{'visible':mini.is_visible(),'version':page.locator('#scanner-cloud-3-100').inner_text()}));assert mini.is_visible();page.close()
  browser.close();print('ERRORS',errors)
  for name,result in results:print(name,json.dumps(result,ensure_ascii=False)[:850])
  assert not errors
  print('PASSED 4/4')
run()