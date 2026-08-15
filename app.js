(() => {
  const $=id=>document.getElementById(id), cfg=window.YEOWOOBANG_CONFIG||{}; let currentMissing=[];
  const normalize=v=>String(v||'').trim().replace(/^@/,'').toLowerCase();
  const isUsername=s=>/^[a-z0-9._]{1,30}$/i.test(s||'');
  const cleanCandidate=raw=>String(raw||'').trim().replace(/^@/,'').replace(/\([^)]*\)\s*$/g,'').trim().replace(/[^\w.]+$/g,'');
  const esc=s=>String(s||'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

  function parseParticipantLine(line,lineNo){
    const original=String(line||'').trim(); if(!original)return null;
    if(/https?:\/\/(www\.)?instagram\.com\//i.test(original))return {warning:true,lineNo,original,reason:'게시물 링크 줄'};
    let body=original.replace(/^\s*\d+\s*[.)]?\s*/,'').trim(), candidate='';
    const at=body.match(/@([A-Za-z0-9._]{1,30})/); if(at) candidate=at[1];
    if(!candidate&&body.includes('/')) candidate=cleanCandidate(body.split('/').pop());
    if(!candidate){const tokens=body.split(/\s+/).map(cleanCandidate).filter(Boolean); for(let i=tokens.length-1;i>=0;i--){if(isUsername(tokens[i])&&/[A-Za-z0-9]/.test(tokens[i])){candidate=tokens[i];break;}}}
    candidate=cleanCandidate(candidate);
    if(!isUsername(candidate)||!/[A-Za-z0-9]/.test(candidate))return {warning:true,lineNo,original,reason:'Instagram 아이디를 찾지 못함'};
    const numberMatch=original.match(/^\s*(\d+)/); let nickname='';
    if(body.includes('/')) nickname=body.split('/')[0].trim();
    else nickname=body.replace(new RegExp('@?'+candidate.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'.*$','i'),'').trim();
    return {no:numberMatch?Number(numberMatch[1]):null,nickname,username:candidate,usernameNorm:normalize(candidate),original};
  }
  function parseParticipants(text){
    const rows=String(text||'').split(/\r?\n/),items=[],warnings=[];
    rows.forEach((line,i)=>{if(!line.trim())return;const p=parseParticipantLine(line,i+1);if(!p)return;p.warning?warnings.push(p):items.push(p);});
    const seen=new Set(), unique=items.filter(x=>{if(seen.has(x.usernameNorm))return false;seen.add(x.usernameNorm);return true;});
    return {items:unique,warnings,inputLines:rows.filter(x=>x.trim()).length};
  }
  function parseIdList(text){const out=[];String(text||'').split(/[\s,\n]+/).forEach(x=>{const y=cleanCandidate(x);if(isUsername(y))out.push(normalize(y));});return new Set(out);}
  function renderParsed(){
    const p=parseParticipants($('participants').value); $('recognizedCount').textContent=p.items.length+'명'; const box=$('extractedList');
    if(!p.items.length){box.className='scroll-list empty';box.textContent='명단을 입력하면 자동으로 추출됩니다.';}else{box.className='scroll-list';box.innerHTML=p.items.map(x=>`<div>@${esc(x.username)}</div>`).join('');}
    if(p.warnings.length){$('parseWarningsWrap').classList.remove('hidden');$('warningCount').textContent=p.warnings.length+'줄';$('parseWarnings').innerHTML=p.warnings.map(w=>`<div><strong>${w.lineNo}. ${esc(w.original)}</strong><br><small>${esc(w.reason)}</small></div>`).join('<hr>');}else $('parseWarningsWrap').classList.add('hidden');
  }
  function validatePostUrl(){const v=$('postUrl').value.trim(),ok=/^https:\/\/(www\.)?instagram\.com\/(p|reel)\/[^/?#]+\/?/i.test(v);$('urlStatus').textContent=v?(ok?'Instagram 게시물 링크가 확인되었습니다.':'Instagram 게시물 링크 형식을 확인해주세요.'):'';$('urlStatus').className='status-line '+(v&&ok?'status-ok':v?'status-bad':'');return ok;}
  async function api(params){if(!cfg.API_URL)throw new Error('config.js에 Apps Script API_URL을 먼저 입력해주세요.');const url=new URL(cfg.API_URL);Object.entries(params).forEach(([k,v])=>url.searchParams.set(k,v));url.searchParams.set('_',Date.now());const res=await fetch(url.toString(),{method:'GET',redirect:'follow'}),text=await res.text();let data;try{data=JSON.parse(text)}catch{throw new Error('API 응답을 읽지 못했습니다. Apps Script 배포/권한을 확인해주세요.')}if(!data.ok)throw new Error(data.message||'요청 실패');return data;}
  async function checkConnection(){const el=$('connectionState');el.textContent='연결 확인 중...';el.classList.remove('ok');try{const d=await api({action:'status'});el.textContent=`✅ Instagram 계정 연결 완료 · @${d.username||d.id}`;el.classList.add('ok')}catch(e){el.textContent='연결 안 됨 · '+e.message}}
  function runComparison(commenterNames,sourceLabel){
    const parsed=parseParticipants($('participants').value);if(!parsed.items.length)throw new Error('정상 인식된 참여자가 없습니다.');
    const commenters=new Set(commenterNames.map(normalize).filter(Boolean)),excluded=parseIdList($('excludeIds').value),freePass=parseIdList($('freePassIds').value);
    const effective=parsed.items.filter(x=>!excluded.has(x.usernameNorm)),missing=effective.filter(x=>!commenters.has(x.usernameNorm)),fpCount=missing.filter(x=>freePass.has(x.usernameNorm)).length; currentMissing=missing.map(x=>x.username);
    $('statInput').textContent=parsed.inputLines;$('statRecognized').textContent=parsed.items.length;$('statCommented').textContent=effective.filter(x=>commenters.has(x.usernameNorm)).length;$('statMissing').textContent=missing.length;$('statExcluded').textContent=parsed.items.filter(x=>excluded.has(x.usernameNorm)).length;$('statFreePass').textContent=fpCount;$('missingTitleCount').textContent=missing.length+'명';$('checkedAt').textContent=new Date().toLocaleString('ko-KR');$('checkedPost').textContent=sourceLabel||$('postUrl').value.trim();
    $('missingList').innerHTML=!missing.length?'<div class="ok-message">🎉 누락자가 없습니다.</div>':missing.map(x=>`<div class="missing-row"><div>${x.no?`<small>${x.no}. ${esc(x.nickname||'')}</small><br>`:''}<strong>@${esc(x.username)}</strong></div>${freePass.has(x.usernameNorm)?'<span class="badge">프패</span>':''}</div>`).join('');$('resultCard').classList.remove('hidden');$('resultCard').scrollIntoView({behavior:'smooth',block:'start'});
  }
  async function runApiCheck(){if(!validatePostUrl())throw new Error('Instagram 게시물 링크를 확인해주세요.');if(!parseParticipants($('participants').value).items.length)throw new Error('참여자 명단을 입력해주세요.');$('checkBtn').disabled=true;$('checkBtn').textContent='댓글 확인 중...';try{const d=await api({action:'comments',postUrl:$('postUrl').value.trim()});runComparison((d.comments||[]).map(c=>c.username).filter(Boolean),$('postUrl').value.trim())}finally{$('checkBtn').disabled=false;$('checkBtn').textContent='누락자 확인'}}
  function runManual(){const ids=String($('manualCommenters').value||'').split(/[\s,\n]+/).map(cleanCandidate).filter(isUsername);if(!ids.length)throw new Error('댓글 작성자 아이디를 입력해주세요.');runComparison(ids,'댓글 작성자 직접 입력 모드')}
  async function copyMissing(){const text=currentMissing.map(x=>'@'+x).join('\n');if(!text)return alert('복사할 누락자가 없습니다.');await navigator.clipboard.writeText(text);alert(`${currentMissing.length}명 아이디를 복사했습니다.`)}
  function resetAll(){['participants','postUrl','excludeIds','freePassIds','manualCommenters'].forEach(id=>$(id).value='');currentMissing=[];$('resultCard').classList.add('hidden');$('connectionState').textContent='연결 확인 전';$('connectionState').classList.remove('ok');$('urlStatus').textContent='';renderParsed()}
  $('participants').addEventListener('input',renderParsed);$('postUrl').addEventListener('input',validatePostUrl);$('connectBtn').addEventListener('click',checkConnection);$('checkBtn').addEventListener('click',()=>runApiCheck().catch(e=>alert(e.message)));$('manualBtn').addEventListener('click',()=>{try{runManual()}catch(e){alert(e.message)}});$('copyMissingBtn').addEventListener('click',()=>copyMissing().catch(e=>alert(e.message)));$('resetBtn').addEventListener('click',resetAll);renderParsed();
})();
