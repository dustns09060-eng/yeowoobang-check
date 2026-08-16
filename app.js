(() => {
  const $ = id => document.getElementById(id);

  let mode = null;
  let currentMissing = [];
  let selectedFiles = [];
  let lastRecognized = [];

  const esc = s => String(s||'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const normalizeIg = v => String(v||'').trim().replace(/^@/,'').toLowerCase();
  const normalizeBlog = v => String(v||'').trim().toLowerCase().replace(/\s+/g,'');
  const cleanIg = raw => String(raw||'').trim().replace(/^@/,'').replace(/[^\w.]+$/g,'');
  const igSkeleton = v => normalizeIg(v).replace(/[._]/g,'').replace(/[^a-z0-9]/g,'');
  const isIg = s => /^[a-z0-9._]{1,30}$/i.test(s||'');

  function configForMode(){
    if(mode === 'naver'){
      return {
        title:'블로그 댓글 확인',
        eyebrow:'NAVER BLOG CHECK',
        placeholder:`1. 유별 / 유별맘\n2. 대박 / 대박이네\n3. 토끼맘프패 / 토끼네\n\n또는\n유별맘\n대박이네`,
        listHelp:'번호 · 여우방 닉네임 · 네이버 블로그 닉네임 형식',
        captureHelp:'댓글 작성자의 블로그 닉네임이 보이게 여러 장 선택',
        ownerLabel:'내 네이버 블로그 닉네임',
        ownerPlaceholder:'예: 유별맘',
        ownerHelp:'내 블로그 닉네임은 자동으로 누락 검사에서 제외',
        ocrHint:'한글 닉네임은 OCR 오독이 있을 수 있어 인식 결과를 꼭 확인해주세요.'
      };
    }

    return {
      title:'인스타 댓글 확인',
      eyebrow:'INSTAGRAM CHECK',
      placeholder:`1. 대박 / uju____like\n2. 유별 / tlso_94\n3. 토끼맘프패 / rabbit_mom\n\n또는\n@fox_mom\n@rabbit_mom`,
      listHelp:'번호 · 닉네임 · Instagram 아이디 형식',
      captureHelp:'댓글 작성자 Instagram 아이디가 보이게 여러 장 선택',
      ownerLabel:'내 Instagram 아이디',
      ownerPlaceholder:'@tlso_94',
      ownerHelp:'내 계정은 자동으로 누락 검사에서 제외',
      ocrHint:'아이디의 점(.)·밑줄(_) 누락은 보정해서 비교합니다.'
    };
  }

  function selectMode(nextMode){
    mode = nextMode;
    const c = configForMode();

    $('homeScreen').classList.add('hidden');
    $('checkScreen').classList.remove('hidden');

    $('modeEyebrow').textContent = c.eyebrow;
    $('modeTitle').textContent = c.title;
    $('listHelp').textContent = c.listHelp;
    $('captureHelp').textContent = c.captureHelp;
    $('participants').placeholder = c.placeholder;
    $('ownerLabel').textContent = c.ownerLabel;
    $('ownerId').placeholder = c.ownerPlaceholder;
    $('ownerHelp').textContent = c.ownerHelp;
    $('ocrHint').textContent = c.ocrHint;

    const key = mode === 'naver' ? 'yeowoobang_naver_owner' : 'yeowoobang_instagram_owner';
    $('ownerId').value = localStorage.getItem(key) || (mode === 'instagram' ? 'tlso_94' : '');

    resetCheckOnly();
  }

  function goHome(){
    resetCheckOnly();
    mode = null;
    $('checkScreen').classList.add('hidden');
    $('homeScreen').classList.remove('hidden');
  }

  function parseParticipantLine(line, lineNo){
    const original = String(line||'').trim();
    if(!original) return null;

    let body = original.replace(/^\s*\d+\s*[.)]?\s*/,'').trim();
    const numberMatch = original.match(/^\s*(\d+)/);
    const autoFreePass = /프패/.test(body);

    if(mode === 'instagram'){
      let candidate = '';
      const at = body.match(/@([A-Za-z0-9._]{1,30})/);
      if(at) candidate = at[1];
      if(!candidate && body.includes('/')) candidate = cleanIg(body.split('/').pop());

      if(!candidate){
        const tokens = body.split(/\s+/).map(cleanIg).filter(Boolean);
        for(let i=tokens.length-1;i>=0;i--){
          if(isIg(tokens[i])){ candidate=tokens[i]; break; }
        }
      }

      candidate = cleanIg(candidate);
      if(!isIg(candidate)){
        return {warning:true,lineNo,original,reason:'Instagram 아이디를 찾지 못함'};
      }

      let nickname = body.includes('/') ? body.split('/')[0].trim() : '';

      return {
        no:numberMatch?Number(numberMatch[1]):null,
        nickname,
        target:candidate,
        norm:normalizeIg(candidate),
        skeleton:igSkeleton(candidate),
        autoFreePass
      };
    }

    // Naver blog mode:
    // Prefer value after "/" as the visible blog nickname.
    let target = '';
    let nickname = '';

    if(body.includes('/')){
      const parts = body.split('/');
      nickname = parts[0].trim();
      target = parts.slice(1).join('/').trim();
    }else{
      // If only one value is supplied, use it as the blog nickname.
      target = body.replace(/프패/g,'').trim();
      nickname = target;
    }

    target = String(target||'').replace(/^@/,'').trim();
    if(!target){
      return {warning:true,lineNo,original,reason:'네이버 블로그 닉네임을 찾지 못함'};
    }

    return {
      no:numberMatch?Number(numberMatch[1]):null,
      nickname,
      target,
      norm:normalizeBlog(target),
      skeleton:normalizeBlog(target).replace(/[^\p{L}\p{N}]/gu,''),
      autoFreePass
    };
  }

  function parseParticipants(text){
    const rows = String(text||'').split(/\r?\n/);
    const items = [], warnings = [];

    rows.forEach((line,i)=>{
      if(!line.trim()) return;
      const p = parseParticipantLine(line,i+1);
      if(!p) return;
      p.warning ? warnings.push(p) : items.push(p);
    });

    const seen = new Set();
    const unique = items.filter(x=>{
      if(seen.has(x.norm)) return false;
      seen.add(x.norm);
      return true;
    });

    return {items:unique,warnings};
  }

  function parseIdList(text){
    const normalizer = mode === 'instagram' ? normalizeIg : normalizeBlog;
    return new Set(
      String(text||'')
        .split(/[\n,]+/)
        .map(x=>normalizer(x))
        .filter(Boolean)
    );
  }

  function renderParsed(){
    if(!mode) return;

    const p = parseParticipants($('participants').value);
    $('recognizedCount').textContent = p.items.length;
    $('recognizedCountMirror').textContent = p.items.length+'명 인식';
    $('warningCount').textContent = p.warnings.length;

    $('extractedList').innerHTML = p.items.length
      ? p.items.map(x=>`<span>${mode==='instagram'?'@':''}${esc(x.target)}${x.autoFreePass?'<em>프패</em>':''}</span>`).join('')
      : '<small>추출된 대상이 없습니다.</small>';

    if(p.warnings.length){
      $('parseWarningsWrap').classList.remove('hidden');
      $('parseWarnings').innerHTML = p.warnings.map(w=>`<div>${w.lineNo}. ${esc(w.original)} · ${esc(w.reason)}</div>`).join('');
    }else{
      $('parseWarningsWrap').classList.add('hidden');
    }
  }

  function runComparison(recognizedNames, sourceLabel){
    const parsed = parseParticipants($('participants').value);
    if(!parsed.items.length) throw new Error('참여자 명단을 먼저 입력해주세요.');

    const normalizer = mode === 'instagram' ? normalizeIg : normalizeBlog;
    const recognized = new Set(recognizedNames.map(normalizer).filter(Boolean));

    const excluded = parseIdList($('excludeIds').value);
    const owner = normalizer($('ownerId').value);
    if(owner) excluded.add(owner);

    const freePass = parseIdList($('freePassIds').value);
    parsed.items.filter(x=>x.autoFreePass).forEach(x=>freePass.add(x.norm));

    const excludedItems = parsed.items.filter(x=>excluded.has(x.norm));
    const active = parsed.items.filter(x=>!excluded.has(x.norm));
    const freePassItems = active.filter(x=>freePass.has(x.norm));
    const checkTargets = active.filter(x=>!freePass.has(x.norm));
    const commented = checkTargets.filter(x=>recognized.has(x.norm));
    const missing = checkTargets.filter(x=>!recognized.has(x.norm));

    currentMissing = missing.map(x=>x.target);

    $('statParticipants').textContent = parsed.items.length;
    $('statCommented').textContent = commented.length;
    $('statMissing').textContent = missing.length;
    $('statExcluded').textContent = excludedItems.length;
    $('statFreePass').textContent = freePassItems.length;
    $('missingTitleCount').textContent = missing.length+'명';
    $('checkedAt').textContent = new Date().toLocaleString('ko-KR');
    $('checkedPost').textContent = sourceLabel||'';

    $('missingList').innerHTML = !missing.length
      ? '<div class="all-clear">누락자가 없습니다 ✓</div>'
      : missing.map(x=>`
          <div class="missing-item">
            <div>
              <small>${x.no?x.no+'. ':''}${esc(x.nickname||'')}</small>
              <strong>${mode==='instagram'?'@':''}${esc(x.target)}</strong>
            </div>
            <span>미확인</span>
          </div>`).join('');

    $('resultCard').classList.remove('hidden');
    $('resultCard').scrollIntoView({behavior:'smooth',block:'start'});
  }

  function renderFileList(){
    $('imageCount').textContent = selectedFiles.length;
    const box = $('fileList');

    if(!selectedFiles.length){
      box.className = 'thumb-list empty';
      box.textContent = '선택된 캡처가 없습니다.';
      return;
    }

    box.className = 'thumb-list';
    box.innerHTML = selectedFiles.map((f,i)=>`
      <div class="file-chip">
        <b>${i+1}</b>
        <span>${esc(f.name)}</span>
        <small>${Math.max(1,Math.round(f.size/1024))}KB</small>
      </div>`).join('');
  }

  function levenshtein(a,b){
    const n=b.length,dp=Array.from({length:n+1},(_,i)=>i);
    for(let i=1;i<=a.length;i++){
      let prev=dp[0]; dp[0]=i;
      for(let j=1;j<=n;j++){
        const t=dp[j];
        dp[j]=Math.min(dp[j]+1,dp[j-1]+1,prev+(a[i-1]===b[j-1]?0:1));
        prev=t;
      }
    }
    return dp[n];
  }

  function recognizeInstagram(text,items){
    const lower = String(text||'').toLowerCase()
      .replace(/[|]/g,'l')
      .replace(/\s*([._])\s*/g,'$1');

    const raw = [...lower.matchAll(/@?([a-z0-9][a-z0-9._]{1,29})/g)]
      .map(m=>normalizeIg(m[1]));

    const rawSet = new Set(raw);
    const skeletons = [...new Set(raw.map(igSkeleton).filter(Boolean))];
    const allSkeleton = igSkeleton(lower);
    const matched = new Set();

    items.forEach(p=>{
      if(rawSet.has(p.norm)){
        matched.add(p.norm);
        return;
      }

      if(p.skeleton.length>=4 && (skeletons.includes(p.skeleton) || allSkeleton.includes(p.skeleton))){
        matched.add(p.norm);
        return;
      }

      if(p.skeleton.length>=6){
        let best=99;
        for(const s of skeletons){
          if(Math.abs(s.length-p.skeleton.length)>2) continue;
          best=Math.min(best,levenshtein(p.skeleton,s));
          if(best===0) break;
        }
        const threshold=p.skeleton.length>=11?2:1;
        if(best<=threshold) matched.add(p.norm);
      }
    });

    return matched;
  }

  function recognizeNaver(text,items){
    // Korean OCR is enabled in Naver mode.
    const raw = String(text||'').toLowerCase();
    const compact = normalizeBlog(raw);
    const matched = new Set();

    items.forEach(p=>{
      if(!p.norm) return;

      // exact normalized visible nickname
      if(compact.includes(p.norm)){
        matched.add(p.norm);
        return;
      }

      const targetSkeleton = p.skeleton;
      if(targetSkeleton.length >= 2){
        const ocrSkeleton = compact.replace(/[^\p{L}\p{N}]/gu,'');
        if(ocrSkeleton.includes(targetSkeleton)){
          matched.add(p.norm);
        }
      }
    });

    return matched;
  }

  async function preprocessImage(file){
    const bitmap = await createImageBitmap(file);
    const maxWidth = 2000;
    const scale = Math.min(1.35,maxWidth/bitmap.width);

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1,Math.round(bitmap.width*scale));
    canvas.height = Math.max(1,Math.round(bitmap.height*scale));
    canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);

    return canvas;
  }

  function setProgress(status,pct){
    $('ocrProgressWrap').classList.remove('hidden');
    $('ocrStatus').textContent = status;
    $('ocrPercent').textContent = Math.round(pct)+'%';
    $('ocrBar').style.width = pct+'%';
  }

  async function runCaptureCheck(){
    const parsed = parseParticipants($('participants').value);
    if(!parsed.items.length) throw new Error('참여자 명단을 먼저 입력해주세요.');
    if(!selectedFiles.length) throw new Error('댓글 캡처를 한 장 이상 선택해주세요.');
    if(!window.Tesseract) throw new Error('OCR 모듈을 불러오지 못했습니다.');

    const btn = $('captureCheckBtn');
    btn.disabled = true;
    btn.textContent = '분석 중...';

    let worker = null;

    try{
      setProgress('OCR 준비 중',2);

      const lang = mode === 'naver' ? 'kor+eng' : 'eng';
      worker = await Tesseract.createWorker(lang);

      const allMatched = new Set();

      for(let i=0;i<selectedFiles.length;i++){
        setProgress(`${i+1}/${selectedFiles.length}장 읽는 중`,(i/selectedFiles.length)*100);

        const canvas = await preprocessImage(selectedFiles[i]);
        const result = await worker.recognize(canvas);
        const text = result?.data?.text || '';

        const matched = mode === 'naver'
          ? recognizeNaver(text,parsed.items)
          : recognizeInstagram(text,parsed.items);

        matched.forEach(x=>allMatched.add(x));

        setProgress(`${i+1}/${selectedFiles.length}장 완료`,((i+1)/selectedFiles.length)*100);
      }

      lastRecognized = [...allMatched].sort();

      $('captureMatchedCount').textContent = lastRecognized.length;
      $('ocrResultCount').textContent = lastRecognized.length+'명';

      const parsedMap = new Map(parsed.items.map(x=>[x.norm,x.target]));
      $('ocrUsernames').value = lastRecognized
        .map(x => mode==='instagram' ? '@'+(parsedMap.get(x)||x) : (parsedMap.get(x)||x))
        .join('\n');

      $('ocrResultFold').classList.remove('hidden');
      setProgress(`완료 · ${lastRecognized.length}명 인식`,100);

      runComparison(lastRecognized,`${mode==='instagram'?'인스타':'네이버 블로그'} 댓글 캡처 ${selectedFiles.length}장 분석`);
    }finally{
      if(worker){
        try{await worker.terminate();}catch(_){}
      }
      btn.disabled=false;
      btn.textContent='캡처 분석 시작';
    }
  }

  function rerunFromOcr(){
    const normalizer = mode === 'instagram' ? normalizeIg : normalizeBlog;

    const values = String($('ocrUsernames').value||'')
      .split(/\r?\n/)
      .map(x=>normalizer(x))
      .filter(Boolean);

    if(!values.length) throw new Error('인식된 대상이 없습니다.');

    lastRecognized = [...new Set(values)];
    $('captureMatchedCount').textContent = lastRecognized.length;
    $('ocrResultCount').textContent = lastRecognized.length+'명';

    runComparison(lastRecognized,'OCR 결과 수정 후 재검사');
  }

  async function copyMissing(){
    const prefix = mode === 'instagram' ? '@' : '';
    const text = currentMissing.map(x=>prefix+x).join('\n');

    if(!text) return alert('복사할 누락자가 없습니다.');

    await navigator.clipboard.writeText(text);
    alert(`${currentMissing.length}명 복사했습니다.`);
  }

  function resetCheckOnly(){
    selectedFiles = [];
    currentMissing = [];
    lastRecognized = [];

    ['participants','excludeIds','freePassIds','ocrUsernames'].forEach(id=>{
      if($(id)) $(id).value='';
    });

    if($('commentImages')) $('commentImages').value='';

    ['ocrProgressWrap','ocrResultFold','resultCard','idDrawer','parseWarningsWrap'].forEach(id=>{
      $(id)?.classList.add('hidden');
    });

    $('captureMatchedCount').textContent='0';
    $('imageCount').textContent='0';
    $('recognizedCount').textContent='0';
    $('recognizedCountMirror').textContent='0명 인식';
    $('warningCount').textContent='0';

    renderFileList();

    if(mode){
      const key = mode === 'naver' ? 'yeowoobang_naver_owner' : 'yeowoobang_instagram_owner';
      $('ownerId').value = localStorage.getItem(key) || (mode==='instagram'?'tlso_94':'');
    }
  }

  document.querySelectorAll('.channel-card').forEach(btn=>{
    btn.addEventListener('click',()=>selectMode(btn.dataset.mode));
  });

  $('backHomeBtn').addEventListener('click',goHome);
  $('participants').addEventListener('input',renderParsed);

  $('commentImages').addEventListener('change',e=>{
    selectedFiles = Array.from(e.target.files||[]);
    renderFileList();

    $('ocrResultFold').classList.add('hidden');
    $('ocrProgressWrap').classList.add('hidden');
    $('captureMatchedCount').textContent='0';
  });

  $('captureCheckBtn').addEventListener('click',()=>runCaptureCheck().catch(e=>alert(e.message)));

  $('rerunFromOcrBtn').addEventListener('click',()=>{
    try{rerunFromOcr()}catch(e){alert(e.message)}
  });

  $('copyMissingBtn').addEventListener('click',()=>copyMissing().catch(e=>alert(e.message)));

  $('resetBtn').addEventListener('click',()=>{
    const currentMode = mode;
    resetCheckOnly();
    mode = currentMode;
    selectMode(currentMode);
  });

  $('showIdsBtn').addEventListener('click',()=>{
    $('idDrawer').classList.toggle('hidden');
    $('showIdsBtn').textContent = $('idDrawer').classList.contains('hidden') ? '추출 결과 보기' : '접기';
  });

  $('toggleOptionsBtn').addEventListener('click',()=>{
    $('optionBody').classList.toggle('hidden');
    $('toggleOptionsBtn').textContent = $('optionBody').classList.contains('hidden') ? '＋' : '−';
  });

  $('ownerId').addEventListener('input',()=>{
    if(!mode) return;
    const key = mode === 'naver' ? 'yeowoobang_naver_owner' : 'yeowoobang_instagram_owner';
    localStorage.setItem(key,$('ownerId').value.trim());
  });

  renderFileList();
})();