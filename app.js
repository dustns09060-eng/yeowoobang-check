(() => {
  const $ = id => document.getElementById(id);
  let currentMissing = [], selectedFiles = [], lastOcrUsernames = [];

  const normalize = v => String(v || '').trim().replace(/^@/, '').toLowerCase();
  const isUsername = s => /^[a-z0-9._]{1,30}$/i.test(s || '');
  const cleanCandidate = raw => String(raw || '').trim().replace(/^@/, '').replace(/[^\w.]+$/g,'');
  const skeleton = v => normalize(v).replace(/[._]/g,'').replace(/[^a-z0-9]/g,'');
  const esc = s => String(s||'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

  function parseParticipantLine(line,lineNo){
    const original=String(line||'').trim(); if(!original)return null;
    let body=original.replace(/^\s*\d+\s*[.)]?\s*/,'').trim(), candidate='';
    const at=body.match(/@([A-Za-z0-9._]{1,30})/); if(at) candidate=at[1];
    if(!candidate&&body.includes('/')) candidate=cleanCandidate(body.split('/').pop());
    if(!candidate){
      const tokens=body.split(/\s+/).map(cleanCandidate).filter(Boolean);
      for(let i=tokens.length-1;i>=0;i--){ if(isUsername(tokens[i])){candidate=tokens[i];break;} }
    }
    candidate=cleanCandidate(candidate);
    if(!isUsername(candidate)) return {warning:true,lineNo,original,reason:'Instagram 아이디를 찾지 못함'};
    const numberMatch=original.match(/^\s*(\d+)/);
    let nickname=body.includes('/')?body.split('/')[0].trim():'';
    return {
      no:numberMatch?Number(numberMatch[1]):null,
      nickname,
      username:candidate,
      usernameNorm:normalize(candidate),
      usernameSkeleton:skeleton(candidate),
      autoFreePass:/프배/.test(body)
    };
  }

  function parseParticipants(text){
    const rows=String(text||'').split(/\r?\n/),items=[],warnings=[];
    rows.forEach((line,i)=>{if(!line.trim())return;const p=parseParticipantLine(line,i+1);p&&(p.warning?warnings.push(p):items.push(p));});
    const seen=new Set(),unique=items.filter(x=>!seen.has(x.usernameNorm)&&(seen.add(x.usernameNorm),true));
    return {items:unique,warnings};
  }

  function parseIdList(text){
    return new Set(String(text||'').split(/[\s,\n]+/).map(cleanCandidate).filter(isUsername).map(normalize));
  }

  function renderParsed(){
    const p=parseParticipants($('participants').value);
    $('recognizedCount').textContent=p.items.length;
    $('recognizedCountMirror').textContent=p.items.length+'명 인식';
    $('warningCount').textContent=p.warnings.length;

    $('extractedList').innerHTML=p.items.length
      ? p.items.map(x=>`<span>@${esc(x.username)}${x.autoFreePass?'<em>프배</em>':''}</span>`).join('')
      : '<small>추출된 아이디가 없습니다.</small>';

    if(p.warnings.length){
      $('parseWarningsWrap').classList.remove('hidden');
      $('parseWarnings').innerHTML=p.warnings.map(w=>`<div>${w.lineNo}. ${esc(w.original)} · ${esc(w.reason)}</div>`).join('');
    }else{
      $('parseWarningsWrap').classList.add('hidden');
    }
  }

  function runComparison(commenterNames, sourceLabel){
    const parsed=parseParticipants($('participants').value);
    if(!parsed.items.length) throw new Error('참여자 명단을 먼저 입력해주세요.');

    const commenters=new Set(commenterNames.map(normalize).filter(Boolean));
    const excluded=parseIdList($('excludeIds').value);
    const owner=normalize($('ownerId').value);
    if(owner) excluded.add(owner);

    const freePass=parseIdList($('freePassIds').value);
    parsed.items.filter(x=>x.autoFreePass).forEach(x=>freePass.add(x.usernameNorm));

    const excludedItems=parsed.items.filter(x=>excluded.has(x.usernameNorm));
    const active=parsed.items.filter(x=>!excluded.has(x.usernameNorm));
    const freePassItems=active.filter(x=>freePass.has(x.usernameNorm));
    const checkTargets=active.filter(x=>!freePass.has(x.usernameNorm));
    const commented=checkTargets.filter(x=>commenters.has(x.usernameNorm));
    const missing=checkTargets.filter(x=>!commenters.has(x.usernameNorm));

    currentMissing=missing.map(x=>x.username);

    $('statParticipants').textContent=parsed.items.length;
    $('statCommented').textContent=commented.length;
    $('statMissing').textContent=missing.length;
    $('statExcluded').textContent=excludedItems.length;
    $('statFreePass').textContent=freePassItems.length;
    $('missingTitleCount').textContent=missing.length+'명';
    $('checkedAt').textContent=new Date().toLocaleString('ko-KR');
    $('checkedPost').textContent=sourceLabel||'';

    $('missingList').innerHTML=!missing.length
      ? '<div class="all-clear">누락자가 없습니다 ✓</div>'
      : missing.map(x=>`
          <div class="missing-item">
            <div>
              <small>${x.no?x.no+'. ':''}${esc(x.nickname||'')}</small>
              <strong>@${esc(x.username)}</strong>
            </div>
            <span>미확인</span>
          </div>`).join('');

    $('resultCard').classList.remove('hidden');
    $('resultCard').scrollIntoView({behavior:'smooth',block:'start'});
  }

  function renderFileList(){
    $('imageCount').textContent=selectedFiles.length;
    const box=$('fileList');
    if(!selectedFiles.length){
      box.className='thumb-list empty';
      box.textContent='선택된 캡처가 없습니다.';
      return;
    }
    box.className='thumb-list';
    box.innerHTML=selectedFiles.map((f,i)=>`
      <div class="file-chip">
        <b>${i+1}</b>
        <span>${esc(f.name)}</span>
        <small>${Math.max(1,Math.round(f.size/1024))}KB</small>
      </div>`).join('');
  }

  function levenshtein(a,b){
    const n=b.length,dp=Array.from({length:n+1},(_,i)=>i);
    for(let i=1;i<=a.length;i++){
      let prev=dp[0];dp[0]=i;
      for(let j=1;j<=n;j++){
        const t=dp[j];
        dp[j]=Math.min(dp[j]+1,dp[j-1]+1,prev+(a[i-1]===b[j-1]?0:1));
        prev=t;
      }
    }
    return dp[n];
  }

  function ocrTokens(text){
    const lower=String(text||'').toLowerCase()
      .replace(/[|]/g,'l')
      .replace(/\s*([._])\s*/g,'$1');
    const raw=[...lower.matchAll(/@?([a-z0-9][a-z0-9._]{1,29})/g)].map(m=>normalize(m[1]));
    return {
      raw:[...new Set(raw)],
      skeletons:[...new Set(raw.map(skeleton).filter(Boolean))],
      allSkeleton:skeleton(lower)
    };
  }

  function matchParticipantsFromOcr(text,items){
    const t=ocrTokens(text), matched=new Set();

    items.forEach(p=>{
      const u=p.usernameNorm, us=p.usernameSkeleton;

      if(t.raw.includes(u)){
        matched.add(u); return;
      }

      if(us.length>=4 && (t.skeletons.includes(us) || t.allSkeleton.includes(us))){
        matched.add(u); return;
      }

      if(us.length>=6){
        let best=99;
        for(const ts of t.skeletons){
          if(Math.abs(ts.length-us.length)>2)continue;
          best=Math.min(best,levenshtein(us,ts));
          if(best===0)break;
        }
        const threshold=us.length>=11?2:1;
        if(best<=threshold) matched.add(u);
      }
    });

    return matched;
  }

  async function preprocessImage(file){
    const bitmap=await createImageBitmap(file);
    const maxWidth=2000, scale=Math.min(1.35,maxWidth/bitmap.width);
    const canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(bitmap.width*scale));
    canvas.height=Math.max(1,Math.round(bitmap.height*scale));
    canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);
    return canvas;
  }

  function setProgress(status,pct){
    $('ocrProgressWrap').classList.remove('hidden');
    $('ocrStatus').textContent=status;
    $('ocrPercent').textContent=Math.round(pct)+'%';
    $('ocrBar').style.width=pct+'%';
  }

  async function runCaptureCheck(){
    const parsed=parseParticipants($('participants').value);
    if(!parsed.items.length) throw new Error('참여자 명단을 먼저 입력해주세요.');
    if(!selectedFiles.length) throw new Error('댓글 캡처를 한 장 이상 선택해주세요.');
    if(!window.Tesseract) throw new Error('OCR 모듈을 불러오지 못했습니다.');

    const btn=$('captureCheckBtn');
    btn.disabled=true;
    btn.textContent='분석 중...';

    let worker=null;
    try{
      setProgress('OCR 준비 중',2);
      worker=await Tesseract.createWorker('eng');

      const allMatched=new Set();

      for(let i=0;i<selectedFiles.length;i++){
        setProgress(`${i+1}/${selectedFiles.length}장 읽는 중`,(i/selectedFiles.length)*100);
        const canvas=await preprocessImage(selectedFiles[i]);
        const result=await worker.recognize(canvas);
        const matched=matchParticipantsFromOcr(result.data.text||'',parsed.items);
        matched.forEach(x=>allMatched.add(x));
        setProgress(`${i+1}/${selectedFiles.length}장 완료`,((i+1)/selectedFiles.length)*100);
      }

      lastOcrUsernames=[...allMatched].sort();
      $('captureMatchedCount').textContent=lastOcrUsernames.length;
      $('ocrResultCount').textContent=lastOcrUsernames.length+'명';
      $('ocrUsernames').value=lastOcrUsernames.map(x=>'@'+x).join('\n');
      $('ocrResultFold').classList.remove('hidden');
      setProgress(`완료 · ${lastOcrUsernames.length}명 인식`,100);

      runComparison(lastOcrUsernames,`댓글 캡처 ${selectedFiles.length}장 · OCR 보정 분석`);
    }finally{
      if(worker)try{await worker.terminate();}catch(_){}
      btn.disabled=false;
      btn.textContent='캡처 분석 시작';
    }
  }

  function rerunFromOcr(){
    const ids=String($('ocrUsernames').value||'').split(/[\s,\n]+/).map(cleanCandidate).filter(isUsername);
    if(!ids.length) throw new Error('인식된 아이디가 없습니다.');
    lastOcrUsernames=[...new Set(ids.map(normalize))];
    $('captureMatchedCount').textContent=lastOcrUsernames.length;
    $('ocrResultCount').textContent=lastOcrUsernames.length+'명';
    runComparison(lastOcrUsernames,'OCR 결과 수정 후 재검사');
  }

  async function copyMissing(){
    const text=currentMissing.map(x=>'@'+x).join('\n');
    if(!text)return alert('복사할 누락자가 없습니다.');
    await navigator.clipboard.writeText(text);
    alert(`${currentMissing.length}명 아이디를 복사했습니다.`);
  }

  $('participants').addEventListener('input',renderParsed);
  $('commentImages').addEventListener('change',e=>{
    selectedFiles=Array.from(e.target.files||[]);
    renderFileList();
    $('ocrResultFold').classList.add('hidden');
    $('ocrProgressWrap').classList.add('hidden');
    $('captureMatchedCount').textContent='0';
  });

  $('captureCheckBtn').addEventListener('click',()=>runCaptureCheck().catch(e=>alert(e.message)));
  $('rerunFromOcrBtn').addEventListener('click',()=>{try{rerunFromOcr()}catch(e){alert(e.message)}});
  $('copyMissingBtn').addEventListener('click',()=>copyMissing().catch(e=>alert(e.message)));
  $('resetBtn').addEventListener('click',()=>location.reload());

  $('showIdsBtn').addEventListener('click',()=>{
    $('idDrawer').classList.toggle('hidden');
    $('showIdsBtn').textContent=$('idDrawer').classList.contains('hidden')?'아이디 보기':'접기';
  });

  $('toggleOptionsBtn').addEventListener('click',()=>{
    $('optionBody').classList.toggle('hidden');
    $('toggleOptionsBtn').textContent=$('optionBody').classList.contains('hidden')?'＋':'−';
  });

  const savedOwner=localStorage.getItem('yeowoobang_owner_id');
  $('ownerId').value=savedOwner || 'tlso_94';
  $('ownerId').addEventListener('input',()=>localStorage.setItem('yeowoobang_owner_id',$('ownerId').value.trim()));

  renderParsed();
  renderFileList();
})();