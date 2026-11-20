from playwright.sync_api import sync_playwright
from pathlib import Path
from PIL import Image, ImageDraw
from io import BytesIO
import base64, json

src=Path('/mnt/data/scanner_upgrade/client-v7-public.js').read_text()
im=Image.new('RGB',(480,240),'white'); ImageDraw.Draw(im).text((18,40),'GRAPH: 7 + 8 = 15',fill='black')
by=BytesIO();im.save(by,'PNG');uri='data:image/png;base64,'+base64.b64encode(by.getvalue()).decode()

html=f'''<!doctype html><html><head><meta charset="utf-8"><title>Тест, українська мова</title><style>body{{font:18px Arial}} main{{max-width:690px}} .option{{padding:12px;background:#eef;display:flex;gap:8px;margin:6px}} b{{display:block;width:28px;height:28px}} img,svg{{display:block}}</style></head><body><main><div id="qnum">ЗАПИТАННЯ 1 · 5 БАЛІВ</div><div id="qtext">Яке твердження підтверджує графік?</div><div id="figs"><img id="qimg" alt="Графік" width="480" height="240" src="{uri}"></div><div id="options"><div class="option"><b>A</b><span>Відповідь A</span></div><div class="option"><b>B</b><span>Відповідь B</span></div></div></main><script>
window.requests=[];window.fetch=async(url,opts)=>{{const q=JSON.parse(opts.body);window.requests.push(q);return {{ok:true,json:async()=>({{answer:'A) Відповідь A',choices:['A'],explanation:'На схемі видно дані',verification:'Сходятся модели',imageAnalysis:{{received:q.images.length,visionModels:['gemini','apinex-vision']}},elapsedMs:900}})}}}};
</script><script>{src}</script></body></html>'''
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 results=[]
 def run(name,fn):
  page=b.new_page(viewport={'width':390,'height':844});errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.set_content(html,wait_until='domcontentloaded');row=fn(page);results.append({'test':name,'errors':errors,**row});page.close()
 def text_and_image(page):
  page.locator('#scanner-cloud-v7 button').nth(0).click();page.wait_for_timeout(1000)
  q=page.evaluate('requests[0]');return {'count':page.evaluate('requests.length'),'imageCount':len(q['images']),'imageSize':len(q['images'][0]['data']) if q['images'] else 0,'imageLabel':q['images'][0]['label'] if q['images'] else '', 'status':page.locator('#scanner-cloud-v7').inner_text()[-140:]}
 run('question_image_recognition',text_and_image)
 def image_options(page):
  page.locator('#figs').evaluate('e=>e.remove()')
  page.locator('#options .option').first.evaluate('e=>e.insertAdjacentHTML("beforeend",\'<img width="240" height="120" src="'+uri+'">\')')
  page.locator('#scanner-cloud-v7 button').nth(0).click();page.wait_for_timeout(700)
  q=page.evaluate('requests[0]');return {'count':len(q['images']),'labels':[z['label'] for z in q['images']],'options':q['options'],'question':q['question']}
 run('option_image_label',image_options)
 def svg_img(page):
  page.locator('#figs').evaluate('e=>e.innerHTML=\'<svg id="diagram" xmlns="http://www.w3.org/2000/svg" width="280" height="150" viewBox="0 0 280 150"><rect x="0" y="0" width="280" height="150" fill="white"/><text x="25" y="60" font-size="30">15</text></svg>\'')
  page.locator('#scanner-cloud-v7 button').nth(0).click();page.wait_for_timeout(1000)
  q=page.evaluate('requests[0]');return {'count':len(q['images']),'labels':[z['label'] for z in q['images']],'options':q['options'],'question':q['question']}
 run('inline_svg',svg_img)
 def auto_count(page):
  page.locator('#scanner-cloud-v7 button').nth(1).click();page.wait_for_timeout(2300)
  page.locator('#qnum').evaluate("e=>e.textContent='ЗАПИТАННЯ 2 · 4 БАЛИ'")
  page.wait_for_timeout(1900)
  return {'count':page.evaluate('requests.length')}
 run('no_dup_on_counter',auto_count)
 def change_content(page):
  page.locator('#scanner-cloud-v7 button').nth(1).click();page.wait_for_timeout(2300)
  page.locator('#qtext').evaluate("e=>e.textContent='Який колір позначено на схемі?' ")
  page.wait_for_timeout(2400)
  return {'count':page.evaluate('requests.length')}
 run('new_question_trigger',change_content)
 def fold(page):
  page.locator('#scanner-cloud-v7 button[aria-label="Свернуть панель"]').click()
  return {'collapsed':page.locator('#scanner-cloud-v7 button[aria-label="Развернуть панель"]').is_visible()}
 run('collapse',fold)
 b.close()
 for r in results:print(json.dumps(r,ensure_ascii=False))
 assert not [r for r in results if r['errors']]
 assert results[0]['count']==1 and results[0]['imageCount']==1
 assert results[1]['count']==1 and 'варианта A' in results[1]['labels'][0]
 assert results[2]['count']==1
 assert results[3]['count']==1
 assert results[4]['count']==2
 assert results[5]['collapsed']
 print('PASSED 6/6')