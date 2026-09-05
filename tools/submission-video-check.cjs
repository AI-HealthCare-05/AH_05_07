// Decode/play the final MP4 in Edge, then inspect representative frames separately.
const { chromium } = require('../web/node_modules/playwright');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const assert = require('node:assert/strict');
(async () => {
  const file = path.resolve(process.argv[2]), out = path.resolve(process.argv[3]);
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'playback.html'), `<html><style>body{margin:0;background:#eee}video{width:100%;height:100vh}</style><video controls muted src="${pathToFileURL(file).href}"></video></html>`);
  const browser = await chromium.launch({ channel: 'msedge' });
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 1000 } });
    await page.goto(pathToFileURL(path.join(out,'playback.html')).href);
    await page.waitForFunction(() => document.querySelector('video').readyState >= 2);
    const info = await page.evaluate(async () => { const v=document.querySelector('video'); await v.play(); return { duration:v.duration,width:v.videoWidth,height:v.videoHeight,rate:v.playbackRate }; });
    assert(info.duration >= 180 && info.duration <= 300);
    console.log(JSON.stringify(info));
    await page.waitForFunction(() => document.querySelector('video').ended, null, { timeout: 330000 });
    assert.equal(await page.evaluate(() => document.querySelector('video').error), null);
    for (let time=5;time<info.duration;time+=20) {
      await page.evaluate(t => new Promise(resolve => {const v=document.querySelector('video');v.addEventListener('seeked',resolve,{once:true});v.currentTime=t;}),time);
      await page.screenshot({path:path.join(out,`frame-${time}.png`)});
    }
    fs.writeFileSync(path.join(out,'playback-check.json'),JSON.stringify({...info,ended:true,error:null,sampled_every_seconds:20},null,2));
    console.log('PASS: normal-speed MP4 playback reached end without media error.');
  } finally { await browser.close(); }
})().catch(e=>{console.error(e.message);process.exitCode=1;});
