(() => {
  const $ = id => document.getElementById(id);

  let mode = null;
  let currentMissing = [];
  let selectedFiles = [];
  let voteFiles = [];
  let lastRecognized = [];

  // 여우방 운영진: Instagram 검사 시 자동 제외
  const INSTAGRAM_ADMIN_IDS = [
    'somy_jee',
    'yeolmu.___.v',
    'da_in_9.4',
    'bebehome_seol',
    'my_tinykitty',
    'j_dragon_mom',
    'gani_meal',
    'wooha_hada'
  ].map(v => String(v).toLowerCase());

  const esc = s => String(s||'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const normalizeIg = v => String(v||'').trim().replace(/^@/,'').toLowerCase();
  const normalizeBlog = v => String(v||'').trim().toLowerCase().replace(/\s+/g,'');
  const cleanIg = raw => String(raw||'').trim().replace(/^@/,'').replace(/[^\w.]+$/g,'');
  const igSkeleton = v => normalizeIg(v).replace(/[._]/g,'').replace(/[^a-z0-9]/g,'');
  const igOcrCanonical = v => igSkeleton(v)
    .replace(/l/g,'1')
    .replace(/0/g,'o');
  const isIg = s => /^[a-z0-9._]{1,30}$/i.test(s||'');

  function configForMode(){
    if(mode === 'like'){
      return {
        title:'인스타 좋아요 확인',
        eyebrow:'INSTAGRAM LIKE CHECK',
        placeholder:`1. 대박 / uju____like
2. 유별 / tlso_94
3. 토끼맘프패 / rabbit_mom

또는
@fox_mom
@rabbit_mom`,
        listHelp:'직접 명단을 붙여넣거나, 아래 카톡 투표 캡처에서 참여자를 자동으로 만들 수 있어요.',
        captureHelp:'게시물의 좋아요 목록을 열고 아이디가 보이게 여러 장 캡처',
        ownerLabel:'내 Instagram 아이디',
        ownerPlaceholder:'@tlso_94',
        ownerHelp:'내 계정과 운영진은 좋아요 의무에서 자동 제외',
        ocrHint:'좋아요 목록의 아이디를 읽어 참여 명단과 비교합니다.'
      };
    }

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
    $('likeRosterBox').classList.toggle('hidden', mode !== 'like');

    const resultHeading = document.querySelector('.missing-title h3');
    const resultLabel = document.querySelector('.result-header h2');
    if(resultHeading){
      resultHeading.textContent = mode === 'like' ? '좋아요 누락자' : '누락자';
    }
    if(resultLabel){
      resultLabel.textContent = mode === 'like' ? '좋아요 누락 결과' : '누락 결과';
    }

    const key = mode === 'naver' ? 'yeowoobang_naver_owner' : (mode === 'like' ? 'yeowoobang_like_owner' : 'yeowoobang_instagram_owner');
    $('ownerId').value = localStorage.getItem(key) || ((mode === 'instagram'||mode === 'like') ? 'tlso_94' : '');

    resetCheckOnly();
  }

  function goHome(){
    resetCheckOnly();
    mode = null;
    $('checkScreen').classList.add('hidden');
    $('homeScreen').classList.remove('hidden');
  }


  function normalizeNickname(s){
    return String(s||'')
      .replace(/\([^)]*\)/g,' ')
      .replace(/[@#]/g,' ')
      .replace(/[·•|]/g,' ')
      .replace(/\s+/g,' ')
      .trim()
      .toLowerCase();
  }

  function parseMemberMapping(text){
    const map = new Map();
    String(text||'').split(/\r?\n/).forEach(line=>{
      let s=line.trim();
      if(!s) return;
      s=s.replace(/^\s*\d+\s*[.)]?\s*/,'').trim();
      let nick='', id='';
      if(s.includes('/')){
        const k=s.indexOf('/');
        nick=s.slice(0,k).trim();
        const m=s.slice(k+1).match(/@?([A-Za-z0-9._]{1,30})/);
        if(m) id=m[1];
      }else{
        const at=s.match(/@([A-Za-z0-9._]{1,30})/);
        if(at){ id=at[1]; nick=s.slice(0,at.index).trim(); }
        else{
          const parts=s.split(/\s+/);
          const last=parts[parts.length-1]?.replace(/^@/,'');
          if(isIg(last)){ id=last; nick=parts.slice(0,-1).join(' '); }
        }
      }
      if(nick && isIg(id)) map.set(normalizeNickname(nick), {nickname:nick,id});
    });
    return map;
  }

  function renderVoteFiles(){
    const box=$('voteFileList');
    if(!voteFiles.length){ box.className='thumb-list empty'; box.textContent='선택된 투표 캡처가 없습니다.'; return; }
    box.className='thumb-list';
    box.innerHTML=voteFiles.map((f,i)=>`<div class="file-chip"><span>${i+1}. ${esc(f.name)}</span></div>`).join('');
  }

  async function extractVoteParticipants(){
    if(mode!=='like') return;
    const mapping=parseMemberMapping($('memberMapping').value);
    if(!mapping.size){ alert('여우방 등록 명단을 먼저 붙여넣어주세요.'); return; }
    if(!voteFiles.length){ alert('카톡 투표 현황 캡처를 먼저 추가해주세요.'); return; }

    const status=$('voteExtractStatus');
    status.className='notice';
    status.innerHTML='카톡 투표 캡처에서 닉네임을 읽는 중이에요…';

    const allText=[];
    for(let i=0;i<voteFiles.length;i++){
      status.innerHTML=`투표 캡처 분석 중 · ${i+1}/${voteFiles.length}`;
      const r=await Tesseract.recognize(voteFiles[i],'kor+eng',{
        logger:m=>{},
        tessedit_pageseg_mode:'6'
      });
      allText.push(r.data.text||'');
    }

    const blob=allText.join('\n');
    const found=[], missing=[];
    for(const [key, rec] of mapping.entries()){
      const nick=rec.nickname;
      const compactNick=normalizeNickname(nick).replace(/\s/g,'');
      const compactBlob=normalizeNickname(blob).replace(/\s/g,'');
      if(compactNick && compactBlob.includes(compactNick)){
        found.push(rec);
      }
    }

    // OCR may split Korean names. Check line fragments with loose character containment.
    if(found.length < mapping.size){
      const foundIds=new Set(found.map(x=>normalizeIg(x.id)));
      const lines=blob.split(/\r?\n/).map(normalizeNickname).filter(Boolean);
      for(const rec of mapping.values()){
        if(foundIds.has(normalizeIg(rec.id))) continue;
        const chars=[...normalizeNickname(rec.nickname).replace(/\s/g,'')];
        const hit=lines.some(line=>{
          let pos=0;
          const c=line.replace(/\s/g,'');
          for(const ch of chars){ pos=c.indexOf(ch,pos); if(pos<0) return false; pos++; }
          return chars.length>=2;
        });
        if(hit){ found.push(rec); foundIds.add(normalizeIg(rec.id)); }
      }
    }

    const unique=[...new Map(found.map(x=>[normalizeIg(x.id),x])).values()];
    $('participants').value=unique.map((x,i)=>`${i+1}. ${x.nickname} / ${x.id}`).join('\n');
    updateParsedPreview();

    status.className='notice';
    status.innerHTML=`<strong>${unique.length}명 참여자 생성 완료</strong><br>카톡에서 잘린 아이디 대신 등록 명단의 전체 Instagram 아이디로 변환했어요.`;
  }

  function parseParticipantLine(line, lineNo){
    const original = String(line||'').trim();
    if(!original) return null;

    let body = original.replace(/^\s*\d+\s*[.)]?\s*/,'').trim();
    const numberMatch = original.match(/^\s*(\d+)/);
    const autoFreePass = /프패/.test(body);

    if(mode === 'instagram' || mode === 'like'){
      let candidate = '';
      let nickname = '';

      // 1) "닉네임/아이디 (메모)" 형식 우선 처리
      // 슬래시 뒤에서 첫 번째 공백/괄호/한글 메모 전까지만 Instagram 아이디로 사용
      if(body.includes('/')){
        const slashIndex = body.indexOf('/');
        nickname = body.slice(0, slashIndex).trim();

        const right = body.slice(slashIndex + 1).trim();

        // 실제 Instagram username 규칙: 영문/숫자/._, 최대 30자
        // 첫 글자도 "_" 또는 "." 가능하도록 허용
        const m = right.match(/^([A-Za-z0-9._]{1,30})/);
        if(m) candidate = m[1];
      }

      // 2) @아이디 형식
      if(!candidate){
        const at = body.match(/@([A-Za-z0-9._]{1,30})/);
        if(at) candidate = at[1];
      }

      // 3) 슬래시가 없는 "닉네임 아이디" 형식
      if(!candidate){
        const tokens = body.split(/\s+/);
        for(let i=tokens.length-1;i>=0;i--){
          const token = String(tokens[i] || '')
            .replace(/^@/, '')
            .replace(/\([^)]*$/, '')
            .replace(/[^\w.]+$/g, '')
            .trim();

          if(isIg(token)){
            candidate = token;
            break;
          }
        }
      }

      candidate = String(candidate || '').trim();

      // 괄호/메모가 바로 붙은 경우 한 번 더 안전 정리
      candidate = candidate
        .split('(')[0]
        .split('[')[0]
        .split('{')[0]
        .trim();

      if(!isIg(candidate)){
        return {warning:true,lineNo,original,reason:'Instagram 아이디를 찾지 못함'};
      }

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

    // 같은 아이디가 여러 일반 품앗이방에 있으면 참여 횟수만큼 댓글이 필요합니다.
    // 소굴방 명단은 이 입력에 넣지 않는 방식으로 사용합니다.
    const grouped = new Map();
    items.forEach(x=>{
      if(!grouped.has(x.norm)){
        grouped.set(x.norm,{...x, requiredCount:1, entries:[x]});
      }else{
        const g=grouped.get(x.norm);
        g.requiredCount += 1;
        g.entries.push(x);
        // 한 줄이라도 프패면 해당 아이디는 프패로 처리
        g.autoFreePass = g.autoFreePass || x.autoFreePass;
      }
    });

    return {items:[...grouped.values()],warnings,totalEntries:items.length};
  }

  function parseIdList(text){
    const normalizer = (mode === 'instagram' || mode === 'like') ? normalizeIg : normalizeBlog;
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
    $('recognizedCount').textContent = p.totalEntries ?? p.items.length;
    $('recognizedCountMirror').textContent = (p.totalEntries ?? p.items.length)+'건 인식';
    $('warningCount').textContent = p.warnings.length;

    $('extractedList').innerHTML = p.items.length
      ? p.items.map(x=>{
          const isAdmin = (mode==='instagram'||mode==='like') && INSTAGRAM_ADMIN_IDS.includes(normalizeIg(x.target));
          return `<span>${(mode==='instagram'||mode==='like')?'@':''}${esc(x.target)}${x.requiredCount>1?`<em class="count-badge">${x.requiredCount}회</em>`:''}${isAdmin?'<em class="admin-badge">운영진</em>':''}${x.autoFreePass?'<em>프패</em>':''}</span>`;
        }).join('')
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

    const normalizer = (mode === 'instagram' || mode === 'like') ? normalizeIg : normalizeBlog;
    const recognizedCounts = new Map();
    recognizedNames.map(normalizer).filter(Boolean).forEach(id=>{
      recognizedCounts.set(id,(recognizedCounts.get(id)||0)+1);
    });

    const excluded = parseIdList($('excludeIds').value);
    if(mode === 'instagram' || mode === 'like'){
      INSTAGRAM_ADMIN_IDS.forEach(id => excluded.add(normalizeIg(id)));
    }
    const owner = normalizer($('ownerId').value);
    if(owner) excluded.add(owner);

    const freePass = parseIdList($('freePassIds').value);
    parsed.items.filter(x=>x.autoFreePass).forEach(x=>freePass.add(x.norm));

    const excludedItems = parsed.items.filter(x=>excluded.has(x.norm));
    const active = parsed.items.filter(x=>!excluded.has(x.norm));
    const freePassItems = active.filter(x=>freePass.has(x.norm));
    const checkTargets = active.filter(x=>!freePass.has(x.norm));

    const completed = [];
    const missing = [];
    checkTargets.forEach(x=>{
      const required = mode === 'like' ? 1 : (x.requiredCount || 1);
      const found = recognizedCounts.get(x.norm) || 0;
      const shortage = Math.max(0,required-found);
      const row={...x,requiredCount:required,foundCount:found,shortage};
      (shortage===0?completed:missing).push(row);
    });

    currentMissing = missing.map(x=>x.target);

    $('statParticipants').textContent = parsed.totalEntries ?? parsed.items.length;
    $('statCommented').textContent = completed.length;
    $('statMissing').textContent = missing.length;
    $('statExcluded').textContent = excludedItems.length;
    $('statFreePass').textContent = freePassItems.length;
    $('missingTitleCount').textContent = missing.length+'명';
    $('checkedAt').textContent = new Date().toLocaleString('ko-KR');
    $('checkedPost').textContent = sourceLabel||'';

    $('missingList').innerHTML = !missing.length
      ? mode === 'like' ? '<div class="all-clear">좋아요 누락자가 없습니다 ✓</div>' : '<div class="all-clear">누락자가 없습니다 ✓</div>'
      : missing.map(x=>`
          <div class="missing-item">
            <div>
              <small>${x.no?x.no+'. ':''}${esc(x.nickname||'')}</small>
              <strong>${(mode==='instagram'||mode==='like')?'@':''}${esc(x.target)}</strong>
              <small class="count-detail">필요 ${x.requiredCount}회 · 확인 ${x.foundCount}회 · ${x.shortage}회 부족</small>
            </div>
            <span>${x.shortage}회 부족</span>
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
    const lines=String(text||'').toLowerCase().split(/\r?\n/);
    const counts=new Map(items.map(p=>[p.norm,0]));

    for(const line0 of lines){
      const line=line0.replace(/[|]/g,'l').replace(/\s*([._])\s*/g,'$1');
      const raw=[...line.matchAll(/@?([._a-z0-9][._a-z0-9]{1,29})/g)].map(m=>normalizeIg(m[1]));
      const rawSet=new Set(raw);
      const skels=[...new Set(raw.map(igSkeleton).filter(Boolean))];
      const cans=[...new Set(raw.map(igOcrCanonical).filter(Boolean))];
      const allSkel=igSkeleton(line), allCan=igOcrCanonical(line);

      items.forEach(p=>{
        let hit=false;
        const pc=igOcrCanonical(p.norm);
        if(rawSet.has(p.norm)) hit=true;
        else if(p.skeleton.length>=4 && (skels.includes(p.skeleton)||allSkel.includes(p.skeleton))) hit=true;
        else if(pc.length>=4 && (cans.includes(pc)||allCan.includes(pc))) hit=true;
        else if(p.skeleton.length>=6){
          let best=99,bestc=99;
          for(const s of skels){
            if(Math.abs(s.length-p.skeleton.length)<=2) best=Math.min(best,levenshtein(p.skeleton,s));
          }
          for(const s of cans){
            if(Math.abs(s.length-pc.length)<=2) bestc=Math.min(bestc,levenshtein(pc,s));
          }
          const threshold=p.skeleton.length>=11?2:1;
          if(best<=threshold||bestc<=threshold) hit=true;
        }
        // 댓글 화면에서 한 댓글 작성자의 아이디는 한 줄에 한 번만 카운트
        if(hit) counts.set(p.norm,(counts.get(p.norm)||0)+1);
      });
    }
    const out=[];
    counts.forEach((n,id)=>{ for(let i=0;i<n;i++) out.push(id); });
    return out;
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

    // 모바일 댓글 캡처의 작은 아이디 글자를 OCR이 더 잘 읽도록 확대
    const targetWidth = Math.min(2600, Math.max(1800, bitmap.width * 1.8));
    const scale = targetWidth / bitmap.width;

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1,Math.round(bitmap.width*scale));
    canvas.height = Math.max(1,Math.round(bitmap.height*scale));

    const ctx = canvas.getContext('2d', {willReadFrequently:true});
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);

    // 가벼운 흑백 + 대비 보정
    const img = ctx.getImageData(0,0,canvas.width,canvas.height);
    const d = img.data;
    for(let i=0;i<d.length;i+=4){
      let gray = Math.round(d[i]*0.299 + d[i+1]*0.587 + d[i+2]*0.114);
      gray = gray < 150 ? Math.max(0, gray - 28) : Math.min(255, gray + 18);
      d[i]=d[i+1]=d[i+2]=gray;
    }
    ctx.putImageData(img,0,0);

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

      if(mode === 'instagram' || mode === 'like'){
        try{
          await worker.setParameters({
            preserve_interword_spaces: '1',
            tessedit_pageseg_mode: '6'
          });
        }catch(_){}
      }

      const allMatched = [];

      for(let i=0;i<selectedFiles.length;i++){
        setProgress(`${i+1}/${selectedFiles.length}장 읽는 중`,(i/selectedFiles.length)*100);

        const canvas = await preprocessImage(selectedFiles[i]);
        const result = await worker.recognize(canvas);
        const text = result?.data?.text || '';

        const matched = mode === 'naver'
          ? recognizeNaver(text,parsed.items)
          : recognizeInstagram(text,parsed.items);

        matched.forEach(x=>allMatched.push(x));

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

      runComparison(lastRecognized,`${mode==='naver'?'네이버 블로그 댓글':(mode==='like'?'인스타 좋아요':'인스타 댓글')} 캡처 ${selectedFiles.length}장 분석`);
    }finally{
      if(worker){
        try{await worker.terminate();}catch(_){}
      }
      btn.disabled=false;
      btn.textContent='캡처 분석 시작';
    }
  }

  function rerunFromOcr(){
    const normalizer = (mode === 'instagram' || mode === 'like') ? normalizeIg : normalizeBlog;

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
      const key = mode === 'naver' ? 'yeowoobang_naver_owner' : (mode === 'like' ? 'yeowoobang_like_owner' : 'yeowoobang_instagram_owner');
      $('ownerId').value = localStorage.getItem(key) || ((mode==='instagram'||mode==='like')?'tlso_94':'');
    }
  }

  document.querySelectorAll('.channel-card').forEach(btn=>{
    btn.addEventListener('click',()=>selectMode(btn.dataset.mode));
  });

  $('backHomeBtn').addEventListener('click',goHome);
  $('participants').addEventListener('input',renderParsed);


  $('voteImages').addEventListener('change',e=>{
    voteFiles=Array.from(e.target.files||[]);
    renderVoteFiles();
  });
  $('voteExtractBtn').addEventListener('click',extractVoteParticipants);
  $('memberMapping').addEventListener('input',()=>{
    try{ localStorage.setItem('yeowoobang_member_mapping',$('memberMapping').value); }catch(e){}
  });
  $('memberMapping').value=localStorage.getItem('yeowoobang_member_mapping')||'';

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
    const key = mode === 'naver' ? 'yeowoobang_naver_owner' : (mode === 'like' ? 'yeowoobang_like_owner' : 'yeowoobang_instagram_owner');
    localStorage.setItem(key,$('ownerId').value.trim());
  });

  renderFileList();
})();