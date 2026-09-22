const DEFAULT_MODEL = "@cf/zai-org/glm-4.7-flash";
const MAX_MESSAGES = 10, MAX_MESSAGE_CHARS = 1500, MAX_TOTAL_CHARS = 6000;
const SYSTEM_PROMPT = `
너는 SK7(상균7데이즈)의 제품 가이드다. 연결된 SK7 지식 문서를 우선 근거로 사용한다.
- 의료 진단, 치료, 예방 효과, 인과관계, 미래 발병 확률을 만들지 않는다.
- Model V2는 "입력 기반 위험군 선별 신호"라고 표현하며 진단으로 말하지 않는다.
- 혈압 기록, 챌린지 참여, Model V2 결과는 서로 다른 사실이다.
- 개인 혈압 수치나 증상을 개인 맞춤 의료판단으로 해석하지 않는다.
- 이메일, 전화번호, 인증정보, 원문 의료기록을 요구하지 않는다.
- 지식에 없는 내용은 추측하지 않는다.
- 제품 사용법에는 다음 행동을 1~3개 제시한다.
- 응급/심각 증상 질문에는 제품 가이드의 한계를 밝히고 즉시 적절한 의료 도움을 받도록 안내한다.
`.trim();

export function normalizeMessages(input) {
  if (!Array.isArray(input)) return [];
  const out=[]; let total=0;
  for (const item of input.slice(-MAX_MESSAGES)) {
    const role=item?.role==="user"?"user":item?.role==="assistant"?"assistant":null;
    if (!role || typeof item.content!=="string") continue;
    const content=item.content.trim();
    if (!content || content.length>MAX_MESSAGE_CHARS) continue;
    total += content.length; if (total>MAX_TOTAL_CHARS) return [];
    out.push({role,content});
  }
  return out;
}
export function redactSensitiveInput(text) {
  return text
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,"[이메일 비공개]")
    .replace(/\b(?:01[016789])[-.\s]?\d{3,4}[-.\s]?\d{4}\b/g,"[전화번호 비공개]")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+\b/gi,"Bearer [인증정보 비공개]")
    .replace(/\bsk-[A-Za-z0-9_-]{12,}\b/g,"[API 키 비공개]")
    .replace(/\b\d{2,3}\s*\/\s*\d{2,3}\s*(?:mmHg)?\b/gi,"[혈압 수치 비공개]");
}
export const sanitizeMessages=(messages)=>messages.map(m=>({...m,content:redactSensitiveInput(m.content)}));
const json=(p,s=200,h={})=>new Response(JSON.stringify(p),{status:s,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff",...h}});
const validSessionId=(v)=>typeof v==="string"&&/^[a-zA-Z0-9_-]{20,80}$/.test(v);
function originAllowed(req,env){const a=new Set(String(env.ALLOWED_ORIGINS??"https://hyeol.app,https://www.hyeol.app,https://guide.hyeol.app").split(",").map(x=>x.trim()).filter(Boolean));const o=req.headers.get("origin");return !o||a.has(o)}
function cors(resp,req,env){const h=new Headers(resp.headers),o=req.headers.get("origin");if(o&&originAllowed(req,env))h.set("access-control-allow-origin",o);h.set("vary","Origin");return new Response(resp.body,{status:resp.status,headers:h})}

export async function handleGuideRequest(request,env){
  const url=new URL(request.url), requestId=crypto.randomUUID();
  if(request.method==="OPTIONS"){
    if(!originAllowed(request,env))return new Response(null,{status:403});
    return cors(new Response(null,{status:204,headers:{"access-control-allow-methods":"POST, OPTIONS","access-control-allow-headers":"content-type","access-control-max-age":"86400"}}),request,env);
  }
  if(url.pathname==="/healthz")return json({ok:true,service:"sk7-guide",knowledge:Boolean(env.KNOWLEDGE),rateLimiter:Boolean(env.CHAT_RATE_LIMITER),model:env.GENERATION_MODEL||DEFAULT_MODEL},200,{"x-request-id":requestId});
  if(url.pathname!=="/api/chat")return new Response(GUIDE_HTML,{headers:{"content-type":"text/html; charset=utf-8","cache-control":"public, max-age=300","content-security-policy":"default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'","x-content-type-options":"nosniff","referrer-policy":"no-referrer"}});
  if(request.method!=="POST")return json({ok:false,code:"method_not_allowed"},405,{Allow:"POST, OPTIONS","x-request-id":requestId});
  if(!originAllowed(request,env))return json({ok:false,code:"origin_not_allowed"},403,{"x-request-id":requestId});
  let body; try{body=await request.json()}catch{return cors(json({ok:false,code:"invalid_json"},400,{"x-request-id":requestId}),request,env)}
  const messages=normalizeMessages(body?.messages);
  if(!messages.length||!messages.some(m=>m.role==="user"))return cors(json({ok:false,code:"invalid_messages"},400,{"x-request-id":requestId}),request,env);
  if(!validSessionId(body?.sessionId))return cors(json({ok:false,code:"invalid_session"},400,{"x-request-id":requestId}),request,env);
  if(env.CHAT_RATE_LIMITER?.limit){const rate=await env.CHAT_RATE_LIMITER.limit({key:`guide:${body.sessionId}`});if(!rate.success)return cors(json({ok:false,code:"rate_limited",message:"잠시 후 다시 질문해 주세요."},429,{"retry-after":"60","x-request-id":requestId}),request,env)}
  if(!env.KNOWLEDGE?.chatCompletions)return cors(json({ok:false,code:"knowledge_unavailable",message:"가이드 지식 연결을 점검 중이에요."},503,{"x-request-id":requestId}),request,env);
  try{
    const stream=await env.KNOWLEDGE.chatCompletions({messages:[{role:"system",content:SYSTEM_PROMPT},...sanitizeMessages(messages)],model:env.GENERATION_MODEL||DEFAULT_MODEL,stream:true,ai_search_options:{retrieval:{retrieval_type:"hybrid",max_num_results:5,match_threshold:.35,context_expansion:1},query_rewrite:{enabled:true},reranking:{enabled:true,model:"@cf/baai/bge-reranker-base",match_threshold:.35}}});
    return cors(new Response(stream,{headers:{"content-type":"text/event-stream; charset=utf-8","cache-control":"no-cache, no-store","x-request-id":requestId,"x-content-type-options":"nosniff"}}),request,env);
  }catch{return cors(json({ok:false,code:"generation_unavailable",message:"지금은 답변을 생성하지 못했어요. 잠시 후 다시 시도해 주세요."},503,{"x-request-id":requestId}),request,env)}
}

const GUIDE_HTML=`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SK7 Guide</title><style>:root{--bg:#f5f3ee;--paper:#fbfaf7;--ink:#171918;--muted:#565a55}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.6 system-ui,sans-serif}main{width:min(760px,calc(100% - 32px));margin:auto;padding:48px 0 80px}small,.notice,.sources{color:var(--muted)}h1{font-size:clamp(2rem,6vw,4rem);line-height:1}.msg{padding:14px 16px;border-radius:18px;background:var(--paper);margin:12px 0;white-space:pre-wrap}.user{margin-left:12%;background:#eceae4}.assistant{margin-right:7%}.sources{font-size:12px}form{position:sticky;bottom:14px;padding:10px;background:#f5f3eedd;backdrop-filter:blur(12px);border-radius:24px}textarea{width:100%;min-height:88px;border:0;border-radius:16px;padding:14px;font:inherit}button{float:right;border:0;border-radius:999px;background:var(--ink);color:#fff;padding:10px 16px;font-weight:700}</style></head><body><main><small>SK7 · PRODUCT GUIDE</small><h1>7일을 이해하는<br>작은 가이드.</h1><p class="notice">제품 사용법과 기록 구조를 설명합니다. 개인 건강정보를 입력하지 마세요. 의료 진단·치료 상담은 제공하지 않습니다.</p><section id="log" aria-live="polite"><div class="msg assistant">안녕하세요. SK7의 기록, 7일 여정, 챌린지, 분석 경계를 설명해드릴게요.</div></section><form id="form"><textarea id="input" maxlength="1500" placeholder="예: 혈압 기록과 챌린지는 어떻게 다른가요?"></textarea><button id="send">보내기</button><div style="clear:both"></div></form></main><script>const log=document.querySelector("#log"),form=document.querySelector("#form"),input=document.querySelector("#input"),send=document.querySelector("#send");let sid=localStorage.getItem("sk7-guide-session-v1");if(!sid){sid=crypto.randomUUID().replaceAll("-","");localStorage.setItem("sk7-guide-session-v1",sid)}const messages=[];function add(role,text){const e=document.createElement("div");e.className="msg "+role;e.textContent=text;log.append(e);return e}form.addEventListener("submit",async e=>{e.preventDefault();const text=input.value.trim();if(!text||send.disabled)return;messages.push({role:"user",content:text});add("user",text);input.value="";send.disabled=true;const answer=add("assistant",""),src=[];try{const r=await fetch("/api/chat",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({sessionId:sid,messages:messages.slice(-10)})});if(!r.ok){const p=await r.json().catch(()=>({}));throw new Error(p.message||"가이드 연결 실패")}const reader=r.body.getReader(),dec=new TextDecoder();let b="";while(true){const{done,value}=await reader.read();if(done)break;b+=dec.decode(value,{stream:true});let i;while((i=b.indexOf("\\n\\n"))>=0){const block=b.slice(0,i);b=b.slice(i+2);const lines=block.split("\\n"),event=lines.find(x=>x.startsWith("event:"))?.slice(6).trim(),data=lines.filter(x=>x.startsWith("data:")).map(x=>x.slice(5).trim()).join("");if(!data||data==="[DONE]")continue;try{const p=JSON.parse(data);if(event==="chunks"&&Array.isArray(p)){for(const c of p)if(c?.item?.key)src.push(c.item.key)}else{const d=p?.choices?.[0]?.delta?.content;if(d)answer.textContent+=d}}catch{}}}if(!answer.textContent)answer.textContent="답변을 받지 못했어요.";messages.push({role:"assistant",content:answer.textContent});if(src.length){const s=document.createElement("div");s.className="sources";s.textContent="참고: "+[...new Set(src)].join(" · ");log.append(s)}}catch(err){answer.textContent=err?.message||"가이드 연결 실패"}finally{send.disabled=false;input.focus()}});</script></body></html>`;
export default {fetch:(request,env)=>handleGuideRequest(request,env)};
