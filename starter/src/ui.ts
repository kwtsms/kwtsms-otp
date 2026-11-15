/*
FILE:      starter/src/ui.ts
CREATED:   2026-11-16 02:00 +03
TASK:      int-node-boilerplates
AUTHOR:    M Alhassoun
WHAT:      renderPage(): the 3 screens (phone, code, done) as one HTML page, EN/AR, dir=rtl for Arabic.
WHY:       A starter people read in a minute: no framework, one inline script that calls POST /otp/send and /otp/verify.
*/

import { dict, dir, type Lang } from "./i18n";

export type Mode = "demo" | "test" | "live";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export function renderPage(lang: Lang, mode: Mode, appName: string): string {
  const t = dict[lang];
  const other: Lang = lang === "ar" ? "en" : "ar";
  const banner = mode === "demo" ? t.demoBanner : mode === "test" ? t.testBanner : "";
  // JSON in a script tag: "<" escaped so the strings can never close the tag
  const strings = JSON.stringify(t).replace(/</g, "\\u003c");
  return `<!doctype html>
<html lang="${lang}" dir="${dir(lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(appName)}: ${esc(t.title)}</title>
<style>
:root{--ink:#14213d;--muted:#5b6578;--line:#d5dbe6;--brand:#0b6e4f;--bg:#f4f6fa}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:grid;place-items:center;background:var(--bg);color:var(--ink);font:16px/1.5 system-ui,"Segoe UI",Tahoma,Arial,sans-serif}
main{width:min(100% - 2rem,26rem);background:#fff;border:1px solid var(--line);border-radius:12px;padding:1.5rem}
h1{font-size:1.25rem;margin:0 0 1rem}
.bar{display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;font-size:.875rem}
.bar a{color:var(--brand)}
.banner{background:#fff4d6;border:1px solid #ecd187;border-radius:8px;padding:.5rem .75rem;margin-bottom:1rem;font-size:.875rem}
label{display:block;font-weight:600;margin-bottom:.25rem}
input{width:100%;padding:.65rem .75rem;border:1px solid var(--line);border-radius:8px;font-size:1.1rem;letter-spacing:.05em}
input:focus-visible,button:focus-visible,a:focus-visible{outline:3px solid #7fb8a4;outline-offset:2px}
.hint{color:var(--muted);font-size:.875rem;margin:.25rem 0 1rem}
button{width:100%;padding:.7rem;border:0;border-radius:8px;background:var(--brand);color:#fff;font-size:1rem;font-weight:600;cursor:pointer}
button[disabled]{opacity:.6;cursor:wait}
button.link{background:none;color:var(--brand);font-weight:400;margin-top:.5rem;text-decoration:underline}
.msg{min-height:1.5rem;margin:.75rem 0 0;font-size:.9rem}
.err{color:#b3261e}.ok{color:var(--brand)}
[hidden]{display:none!important}
</style>
</head>
<body>
<main>
<div class="bar"><strong>${esc(appName)}</strong><a href="?lang=${other}" hreflang="${other}">${esc(t.otherLang)}</a></div>
${banner ? `<div class="banner" role="status">${esc(banner)}</div>` : ""}
<h1>${esc(t.title)}</h1>
<section id="s1">
<form id="f1" novalidate>
<label for="phone">${esc(t.phoneLabel)}</label>
<input id="phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" dir="ltr" required>
<p class="hint">${esc(t.phoneHint)}</p>
<button type="submit">${esc(t.send)}</button>
</form>
</section>
<section id="s2" hidden>
<form id="f2" novalidate>
<label for="code">${esc(t.codeLabel)}</label>
<input id="code" name="code" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" dir="ltr" required>
<p class="hint">${esc(t.codeHint)}</p>
<button type="submit">${esc(t.verify)}</button>
<button type="button" class="link" id="back">${esc(t.change)}</button>
</form>
</section>
<section id="s3" hidden><p class="ok" role="status"><strong>${esc(t.done)}</strong></p></section>
<p class="msg" id="msg" aria-live="polite"></p>
</main>
<script>
const T=${strings},LANG=${JSON.stringify(lang)};
const $=(i)=>document.getElementById(i);
const msg=(k,cls,extra)=>{const m=$("msg");m.className="msg "+(cls||"");m.textContent=(T[k]||k)+(extra||"")};
const show=(n)=>{for(const i of ["s1","s2","s3"])$(i).hidden=i!=="s"+n};
async function post(url,body){
  try{const r=await fetch(url,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});return await r.json()}
  catch{return{ok:false,error:"GENERIC"}}
}
$("f1").addEventListener("submit",async(e)=>{
  e.preventDefault();const b=e.target.querySelector("button");b.disabled=true;
  const r=await post("/otp/send",{phone:$("phone").value,lang:LANG,purpose:"login"});
  b.disabled=false;
  if(!r.ok){msg(r.error,"err");return}
  show(2);msg("codeSent","ok",r.demoCode?" ("+T.demoCode+": "+r.demoCode+")":"");$("code").focus();
});
$("f2").addEventListener("submit",async(e)=>{
  e.preventDefault();const b=e.target.querySelector("button");b.disabled=true;
  const r=await post("/otp/verify",{phone:$("phone").value,code:$("code").value});
  b.disabled=false;
  if(!r.ok){msg(r.error,"err");if(r.error==="TOO_MANY_ATTEMPTS"||r.error==="OTP_EXPIRED")show(1);return}
  show(3);msg("","");
});
$("back").addEventListener("click",()=>{show(1);msg("","")});
</script>
</body>
</html>`;
}
