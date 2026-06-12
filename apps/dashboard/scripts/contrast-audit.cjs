/**
 * WCAG contrast audit for No Limits Ops. Walks every text node on each
 * screen/state, composites effective backgrounds, and applies AA for real
 * text and a 2.5:1 floor for aria-hidden decoration.
 *
 * Usage: dashboard dev server on :3001 (seeded), then
 *   NODE_PATH=$(npm root -g) node scripts/contrast-audit.cjs
 */
const { chromium } = require("playwright");

const AUDIT = `(() => {
  const toRGBA = (s) => { const m = s.match(/rgba?\\(([^)]+)\\)/); if (!m) return null;
    const p = m[1].split(",").map(parseFloat); return { r:p[0], g:p[1], b:p[2], a:p.length>3?p[3]:1 }; };
  const blend = (t,b)=>({ r:t.r*t.a+b.r*(1-t.a), g:t.g*t.a+b.g*(1-t.a), b:t.b*t.a+b.b*(1-t.a), a:1 });
  const lum = (c)=>{ const f=v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)};
    return .2126*f(c.r)+.7152*f(c.g)+.0722*f(c.b); };
  const ratio=(a,b)=>{const l1=lum(a),l2=lum(b);return (Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05)};
  const effBg=(el)=>{ let layers=[];
    for (let n=el;n;n=n.parentElement){ const bg=toRGBA(getComputedStyle(n).backgroundColor);
      if(bg&&bg.a>0)layers.push(bg); if(bg&&bg.a>=1)break; if(n===document.body)break; }
    let acc={r:14,g:19,b:32,a:1}; // ink page ground
    for(let i=layers.length-1;i>=0;i--)acc=blend(layers[i],acc); return acc; };
  const out=[]; const seen=new Set();
  const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
  while(w.nextNode()){ const t=w.currentNode; const text=t.textContent.trim(); if(!text)continue;
    const el=t.parentElement; if(!el||seen.has(el))continue; seen.add(el);
    const cs=getComputedStyle(el);
    if(cs.visibility==="hidden"||cs.display==="none"||parseFloat(cs.opacity)===0)continue;
    const r0=el.getBoundingClientRect(); if(r0.width===0||r0.height===0)continue;
    let hidden=false,decor=false;
    for(let n=el;n;n=n.parentElement){ if(n.tagName==="DIALOG"&&!n.open)hidden=true;
      if(n.getAttribute&&n.getAttribute("aria-hidden")==="true")decor=true; }
    if(hidden)continue;
    let fg=toRGBA(cs.color); if(!fg)continue;
    const bg=effBg(el); if(fg.a<1)fg=blend(fg,bg);
    const r=ratio(fg,bg); const size=parseFloat(cs.fontSize);
    const bold=parseInt(cs.fontWeight,10)>=700;
    const large=size>=24||(size>=18.66&&bold);
    const req=decor?2.5:large?3:4.5;
    if(r<req)out.push({text:text.slice(0,40),ratio:Math.round(r*100)/100,req,decor,size:Math.round(size),fg:cs.color,cls:String(el.className).slice(0,70)});
  }
  return out;
})()`;

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await page.setViewportSize({ width: 1366, height: 900 });
  const failures = [];
  const audit = async (label) => {
    for (const f of await page.evaluate(AUDIT)) failures.push({ label, ...f });
  };

  // Sign-in (grid + pad)
  await page.goto("http://localhost:3001/sign-in", { waitUntil: "networkidle" });
  await audit("sign-in grid");
  await page.click("text=Manager");
  await audit("pin pad");
  for (const d of ["1", "2", "3", "4", "5", "6"]) await page.click(`button:text-is("${d}")`);
  await page.click("button:text-is('Go')");
  await page.waitForSelector("text=The board", { timeout: 30000 });
  await audit("board daily");
  await page.click("button:text-is('Monthly')");
  await audit("board monthly");

  // Quick-add dialog open
  await page.click("text=+ Job");
  await page.click("text=+ More details");
  await audit("quick-add dialog");
  await page.click("button[aria-label='Close']");

  await page.goto("http://localhost:3001/bookings?filter=all", { waitUntil: "networkidle" });
  await audit("bookings list");
  const link = page.locator("tbody a").first();
  if (await link.count()) {
    await link.click();
    await page.waitForSelector("text=Audit trail");
    await audit("booking detail");
  }

  await page.goto("http://localhost:3001/roster", { waitUntil: "networkidle" });
  await audit("roster grid");
  await page.click("button:text-is('Timesheet')");
  await audit("timesheet");

  await page.goto("http://localhost:3001/manage", { waitUntil: "networkidle" });
  await audit("manage");

  await page.goto("http://localhost:3001/tv", { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await audit("tv");

  await browser.close();
  for (const f of failures) {
    console.log(`[${f.label}] ${f.decor ? "(decor) " : ""}${f.ratio} < ${f.req} | ${f.size}px | "${f.text}" | ${f.fg} | ${f.cls}`);
  }
  console.log(`TOTAL FAILURES: ${failures.length}`);
  process.exit(failures.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
