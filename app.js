(() => {
  const $ = id => document.getElementById(id);
  const cfg = window.YEOWOOBANG_CONFIG || {};

  let mode = null;
  let currentMissing = [];
  let selectedFiles = [];
  let voteFiles = [];
  let moneCommentFiles = [];
  let lastRecognized = [];
  let selectedCommentVideo = null;
  let videoRecognized = [];
  let videoReview = [];

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
    if(mode === 'collector'){
      return {
        title:'대량 댓글 수집 도우미',
        eyebrow:'LARGE ROOM COLLECTOR',
        placeholder:`1. 대박 / uju____like
2. 유별 / tlso_94
3. 토끼맘프패 / rabbit_mom`,
        listHelp:'참여자 명단을 붙여넣고 댓글 화면 녹화 영상 1개로 작성자를 수집합니다.',
        captureHelp:'화면 녹화 분석이 어려울 때만 기존 캡처 방식도 사용할 수 있어요.',
        ownerLabel:'내 Instagram 아이디',
        ownerPlaceholder:'@tlso_94',
        ownerHelp:'내 계정과 운영진은 자동 제외',
        ocrHint:'화면 녹화 영상을 일정 간격으로 분석해 참여 명단의 Instagram 아이디를 찾습니다.'
      };
    }

    if(mode === 'personal'){
      return {
        title:'댓글 캡처 확인',
        eyebrow:'PERSONAL ACCOUNT COMMENT CHECK',
        placeholder:`1. 대박 / uju____like
2. 유별 / tlso_94
3. 토끼맘프패 / rabbit_mom`,
        listHelp:'계정 종류와 상관없이 참여자 명단을 붙여넣고 댓글 작성자 아이디가 보이도록 캡처해주세요.',
        captureHelp:'PC·모바일 모두 댓글 작성자 아이디가 보이도록 캡처해서 올려주세요. 여러 장을 한 번에 선택할 수 있어요.',
        ownerLabel:'내 Instagram 아이디',
        ownerPlaceholder:'@tlso_94',
        ownerHelp:'내 계정과 운영진은 자동 제외',
        ocrHint:'일반 계정은 Meta API 대신 댓글 화면 캡처에서 작성자 아이디를 인식해 참여 명단과 비교합니다.'
      };
    }

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

    if(mode === 'mone'){
      return {
        title:'모네방 확인',
        eyebrow:'MONE ROOM CHECK',
        placeholder:`벤 링크 대상자는 아래 참여 댓글 캡처에서 자동으로 만들어집니다.`,
        listHelp:'벤 링크 대상자를 만든 뒤 좋아요 목록 캡처와 비교합니다.',
        captureHelp:'벤 링크 대상자의 좋아요 여부를 확인할 좋아요 목록 캡처',
        ownerLabel:'내 Instagram 아이디',
        ownerPlaceholder:'@tlso_94',
        ownerHelp:'내 계정과 운영진은 검사에서 자동 제외',
        ocrHint:'좋아요 목록의 Instagram 아이디를 읽어 벤 링크 대상자와 비교합니다.'
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
      listHelp:'참여자 명단을 붙여넣고 게시물 링크로 댓글을 자동 확인합니다.',
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
    $('moneWorkflowBox').classList.toggle('hidden', mode !== 'mone');
    const showVideoFallback = (mode === 'collector' || mode === 'instagram');
    $('collectorVideoBox').classList.toggle('hidden', !showVideoFallback);
    $('commentPasteBox')?.classList.toggle('hidden', !(mode === 'instagram' || mode === 'personal' || mode === 'collector'));
    $('instagramFallbackFlow')?.classList.toggle('hidden', mode !== 'instagram');

    $('hybridApiBox').classList.toggle('hidden', mode !== 'instagram');
    $('instagramMethodGuide').classList.add('hidden');
    $('captureFallbackTitle').classList.toggle('hidden', mode !== 'instagram');
    if(mode === 'instagram'){
      $('captureTitle').textContent='댓글 캡처 대체 확인';
      $('captureHelp').textContent='API가 안 되면 화면 녹화(권장), 댓글 붙여넣기, 캡처 중 편한 방법으로 확인하세요.';
    }
    if(mode === 'personal'){
      $('captureTitle').textContent='댓글 캡처';
      $('captureHelp').textContent='댓글 작성자 아이디가 보이도록 캡처해주세요. 댓글이 많으면 여러 장을 한 번에 올려도 돼요.';
    }


    const resultHeading = document.querySelector('.missing-title h3');
    const resultLabel = document.querySelector('.result-header h2');
    if(resultHeading){
      resultHeading.textContent = mode === 'like' ? '좋아요 누락자' : '누락자';
    }
    if(resultLabel){
      resultLabel.textContent = mode === 'like' ? '좋아요 누락 결과' : '누락 결과';
    }

    const key = mode === 'naver' ? 'yeowoobang_naver_owner' : (mode === 'personal' ? 'yeowoobang_personal_owner' : (mode === 'like' ? 'yeowoobang_like_owner' : (mode === 'mone' ? 'yeowoobang_mone_owner' : 'yeowoobang_instagram_owner')));
    $('ownerId').value = localStorage.getItem(key) || ((mode === 'instagram'||mode === 'personal'||mode === 'like'||mode === 'mone') ? 'tlso_94' : '');

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



  // 참여 명단 입력 즉시 파싱 결과를 화면에 반영합니다.
  // 예:
  // 17. 다콩/yuyonyong
  // https://www.instagram.com/p/...
  // 18. 또용/dear_ddoyong
  // URL 줄은 참여자로 세지 않습니다.
  function renderParsed(){
    const parsed = parseParticipants($('participants')?.value || '');
    const items = Array.isArray(parsed.items) ? parsed.items : [];
    const warnings = Array.isArray(parsed.warnings) ? parsed.warnings : [];

    if($('recognizedCount')) {
      $('recognizedCount').textContent = String(items.length);
    }
    if($('recognizedCountMirror')) {
      $('recognizedCountMirror').textContent = `${items.length}명 인식`;
    }
    if($('warningCount')) {
      $('warningCount').textContent = String(warnings.length);
    }

    if($('extractedList')){
      $('extractedList').innerHTML = items.length
        ? items.map((x,i)=>{
            const id = mode === 'naver'
              ? (x.target || x.norm || '')
              : '@' + (x.target || x.norm || '');
            const nick = x.nickname ? `<small>${esc(x.nickname)}</small>` : '';
            return `<span class="id-chip"><b>${i+1}. ${esc(id)}</b>${nick}</span>`;
          }).join('')
        : '<small>인식된 참여자가 없습니다.</small>';
    }

    if($('parseWarningsWrap') && $('parseWarnings')){
      if(warnings.length){
        $('parseWarningsWrap').classList.remove('hidden');
        $('parseWarnings').innerHTML = warnings
          .slice(0,50)
          .map(w=>`<div><b>${w.line || w.lineNo || ''}줄</b> ${esc(w.text || w.original || '')} · ${esc(w.reason || '확인 필요')}</div>`)
          .join('');
      }else{
        $('parseWarningsWrap').classList.add('hidden');
        $('parseWarnings').innerHTML = '';
      }
    }

    return parsed;
  }

  // 예전 함수명과 호환
  function updateParsedPreview(){
    return renderParsed();
  }

  async function backendApi(params){
    if(!cfg.API_URL) throw new Error('Apps Script API 주소가 설정되지 않았습니다.');
    const url=new URL(cfg.API_URL);
    Object.entries(params).forEach(([k,v])=>url.searchParams.set(k,String(v)));
    url.searchParams.set('_',Date.now());

    const res=await fetch(url.toString(),{method:'GET',redirect:'follow'});
    const text=await res.text();

    try{
      return JSON.parse(text);
    }catch(e){
      throw new Error('API 응답을 읽지 못했습니다. Apps Script 배포 상태를 확인해주세요.');
    }
  }

  async function runHybridApiCheck(){
    if(!(mode==='instagram' || mode==='personal')) return;

    const parsed=parseParticipants($('participants').value);
    if(!parsed.items.length){
      alert('참여자 명단을 먼저 입력해주세요.');
      return;
    }

    const postUrl=String($('hybridPostUrl').value||'').trim();
    if(!/^https:\/\/(www\.)?instagram\.com\/(p|reel)\/[^/?#]+/i.test(postUrl)){
      alert('Instagram 게시물 링크를 확인해주세요.');
      return;
    }

    const btn=$('hybridApiBtn');
    const status=$('hybridApiStatus');
    btn.disabled=true;
    btn.textContent='API 확인 중...';
    status.className='hybrid-status checking';
    status.textContent='Instagram 댓글을 자동으로 불러오고 있어요.';

    try{
      const operationId=makeOperationId();
      const d=await backendApi({action:'comments',postUrl,operationId});

      if(!d || typeof d !== 'object'){
        throw new Error('API 응답이 비어 있습니다.');
      }

      if(d.ok && Array.isArray(d.comments) && d.comments.length>0){
        const names=[...new Set(d.comments.map(c=>normalizeIg(c.username)).filter(Boolean))];
        status.className='hybrid-status success';
        status.textContent=`자동 조회 성공 · 댓글 작성자 ${names.length}명 확인 (댓글 ${d.commentCount||d.comments.length}개)`;
        runComparison(names,`Instagram API 자동 확인 · ${postUrl}`);
        return;
      }

      if(d.ok && Number(d.instagramCommentCount||d.commentCount||0)===0){
        status.className='hybrid-status warning';
        status.textContent='API가 댓글 목록을 확인하지 못했습니다. 아래 화면 녹화 방식으로 이어서 확인해주세요.';
        activateInstagramFallback('API 대신 화면 녹화로 확인할 수 있어요. 댓글을 끝까지 펼치고 천천히 스크롤해주세요.');
        return;
      }

      status.className='hybrid-status fallback';
      const apiMessage=d.message||d.error||d.code||'Meta API가 댓글 목록을 반환하지 않았습니다.';
      status.innerHTML=`자동 조회를 사용할 수 없어요.<br><b>${esc(apiMessage)}</b><br>아래 화면 녹화·붙여넣기·캡처 중 하나로 이어서 확인해주세요.`;
      activateInstagramFallback('API 응답이 비어 있어 화면 녹화 확인으로 자동 전환했습니다.');
    }catch(e){
      status.className='hybrid-status fallback';
      logLocalEvent('api_error',e.message||e);
      status.innerHTML=`API 자동 확인에 실패했어요.<br><b>${String(e.message||e)}</b><br>아래 화면 녹화·붙여넣기·캡처 중 하나로 이어서 확인할 수 있어요.`;
      activateInstagramFallback('API 연결 실패로 화면 녹화 확인으로 자동 전환했습니다.');
    }finally{
      btn.disabled=false;
      btn.textContent='API로 댓글 자동 확인';
    }
  }


  function activateInstagramFallback(message){
    if(mode !== 'instagram') return;
    $('collectorVideoBox')?.classList.remove('hidden');
    $('commentPasteBox')?.classList.remove('hidden');
    $('instagramFallbackFlow')?.classList.remove('hidden');

    if(message && $('videoHint')){
      $('videoHint').textContent = message;
    }

    const target = $('collectorVideoBox');
    if(target){
      target.classList.add('fallback-active');
      setTimeout(()=>target.classList.remove('fallback-active'), 2400);
      target.scrollIntoView({behavior:'smooth', block:'center'});
    }
  }

  function runPastedCommentCheck(){
    if(!(mode === 'instagram' || mode === 'personal' || mode === 'collector')) return;

    const parsed = parseParticipants($('participants').value);
    if(!parsed.items.length){
      alert('참여자 명단을 먼저 입력해주세요.');
      return;
    }

    const text = String($('commentPasteText')?.value || '').trim();
    if(!text){
      alert('복사한 댓글 내용을 먼저 붙여넣어주세요.');
      return;
    }

    const recognized = recognizeInstagram(text, parsed.items);
    const unique = [...new Set(recognized.map(normalizeIg).filter(Boolean))];
    const status = $('commentPasteStatus');

    if(!unique.length){
      status.className='hybrid-status warning';
      status.textContent='참여 명단과 일치하는 Instagram 아이디를 찾지 못했습니다. 복사 범위를 확인해주세요.';
      return;
    }

    status.className='hybrid-status success';
    status.textContent=`붙여넣기 확인 완료 · ${unique.length}명 인식`;
    runComparison(recognized, '댓글 텍스트 붙여넣기 확인');
  }




  function makeOperationId(){
    return 'yb_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8);
  }

  function logLocalEvent(type, detail){
    try{
      const rows=JSON.parse(localStorage.getItem('yeowoobang_local_events')||'[]');
      rows.push({at:new Date().toISOString(),type,detail:String(detail||'').slice(0,180)});
      localStorage.setItem('yeowoobang_local_events',JSON.stringify(rows.slice(-30)));
    }catch(e){}
  }


  function setVideoProgress(status,pct){
    $('videoProgressWrap').classList.remove('hidden');
    $('videoStatus').textContent=status;
    $('videoPercent').textContent=Math.max(0,Math.min(100,Math.round(pct)))+'%';
    $('videoBar').style.width=Math.max(0,Math.min(100,pct))+'%';
  }

  function waitForEvent(el,event){
    return new Promise((resolve,reject)=>{
      const onOk=()=>{ cleanup(); resolve(); };
      const onErr=()=>{ cleanup(); reject(new Error('영상 파일을 읽지 못했습니다.')); };
      const cleanup=()=>{
        el.removeEventListener(event,onOk);
        el.removeEventListener('error',onErr);
      };
      el.addEventListener(event,onOk,{once:true});
      el.addEventListener('error',onErr,{once:true});
    });
  }

  async function seekVideo(video,time){
    if(Math.abs(video.currentTime-time)<0.04) return;
    const p=waitForEvent(video,'seeked');
    video.currentTime=Math.min(Math.max(0,time),Math.max(0,video.duration-0.05));
    await p;
  }

  function drawVideoFrame(video){
    const maxWidth=1500;
    const scale=Math.min(1,maxWidth/video.videoWidth);
    const canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(video.videoWidth*scale));
    canvas.height=Math.max(1,Math.round(video.videoHeight*scale));
    const ctx=canvas.getContext('2d',{willReadFrequently:true});
    ctx.drawImage(video,0,0,canvas.width,canvas.height);

    // 작은 사용자명 OCR을 위한 흑백/대비 보정
    const img=ctx.getImageData(0,0,canvas.width,canvas.height);
    const d=img.data;
    for(let i=0;i<d.length;i+=4){
      let gray=Math.round(d[i]*0.299+d[i+1]*0.587+d[i+2]*0.114);
      gray=gray<150?Math.max(0,gray-25):Math.min(255,gray+15);
      d[i]=d[i+1]=d[i+2]=gray;
    }
    ctx.putImageData(img,0,0);
    return canvas;
  }


  function nearestParticipantForOcrToken(token, items){
    const t=normalizeIg(token);
    if(!t || t.length<4) return null;

    let best=null;
    let bestDist=99;

    for(const p of items){
      const cand=p.norm;
      if(!cand) continue;
      if(Math.abs(cand.length-t.length)>2) continue;

      const d=levenshtein(cand,t);
      if(d<bestDist){
        bestDist=d;
        best=p;
      }
    }

    const maxDist = t.length>=8 ? 2 : 1;
    return best && bestDist<=maxDist ? {item:best,distance:bestDist,token:t} : null;
  }

  function extractPossibleIgTokens(text){
    const clean=String(text||'')
      .replace(/\s*([._])\s*/g,'$1')
      .toLowerCase();

    const tokens=clean.match(/@?[a-z0-9._]{4,30}/g)||[];
    return [...new Set(tokens.map(x=>x.replace(/^@/,'')))]
      .filter(x=>isIg(x) && !/^https?$/.test(x) && !/^(www|instagram|reply|like|likes|hours?|minutes?)$/.test(x));
  }

  async function analyzeCommentVideo(){
    if(mode!=='collector') return;

    const parsed=parseParticipants($('participants').value);
    if(!parsed.items.length){
      alert('참여자 명단을 먼저 입력해주세요.');
      return;
    }
    if(!selectedCommentVideo){
      alert('댓글 화면 녹화 영상을 먼저 선택해주세요.');
      return;
    }
    if(!window.Tesseract){
      alert('OCR 모듈을 불러오지 못했습니다.');
      return;
    }

    const btn=$('videoAnalyzeBtn');
    btn.disabled=true;
    btn.textContent='영상 분석 중...';
    $('videoRecognizedWrap').classList.add('hidden');

    const video=document.createElement('video');
    video.muted=true;
    video.playsInline=true;
    video.preload='metadata';
    const url=URL.createObjectURL(selectedCommentVideo);
    video.src=url;

    let worker=null;

    try{
      setVideoProgress('영상 정보 읽는 중...',1);
      await waitForEvent(video,'loadedmetadata');

      if(!Number.isFinite(video.duration) || video.duration<=0){
        throw new Error('영상 길이를 확인할 수 없습니다.');
      }

      const interval=Math.max(0.7,Number($('videoSampleInterval').value)||1.25);
      let times=[];
      for(let t=0.2;t<video.duration;t+=interval) times.push(t);

      // 과도한 모바일 부하 방지: 최대 120프레임.
      if(times.length>120){
        const step=times.length/120;
        times=Array.from({length:120},(_,i)=>times[Math.floor(i*step)]);
        $('videoHint').textContent='영상이 길어서 최대 120개 화면으로 나누어 분석합니다.';
      }else{
        $('videoHint').textContent=`약 ${times.length}개 화면을 분석합니다. 분석 중에는 이 페이지를 닫지 마세요.`;
      }

      setVideoProgress('OCR 엔진 준비 중...',3);
      worker=await Tesseract.createWorker('eng');
      try{
        await worker.setParameters({
          preserve_interword_spaces:'1',
          tessedit_pageseg_mode:'6'
        });
      }catch(_){}

      const matchedSet=new Set();
      const reviewMap=new Map();
      let analyzedFrames=0;

      for(let i=0;i<times.length;i++){
        const pct=5+(i/times.length)*90;
        setVideoProgress(`${i+1}/${times.length} 화면에서 아이디 찾는 중`,pct);

        await seekVideo(video,times[i]);
        const canvas=drawVideoFrame(video);
        const result=await worker.recognize(canvas);
        analyzedFrames++;
        const text=result?.data?.text||'';

        const matches=recognizeInstagram(text,parsed.items);
        matches.forEach(id=>matchedSet.add(normalizeIg(id)));

        // 정확 매칭은 아니지만 OCR상 매우 비슷한 아이디는 '확인 필요' 후보로만 보관
        const tokens=extractPossibleIgTokens(text);
        for(const token of tokens){
          const near=nearestParticipantForOcrToken(token,parsed.items);
          if(!near) continue;
          const id=near.item.norm;
          if(matchedSet.has(id)) continue;
          if(!reviewMap.has(id) || near.distance<reviewMap.get(id).distance){
            reviewMap.set(id,{
              norm:id,
              target:near.item.target,
              nickname:near.item.nickname||'',
              seenAs:near.token,
              distance:near.distance
            });
          }
        }

        // 이미 검사 대상 대부분을 찾았다면 조기 종료
        const expected=parsed.items.filter(x=>!x.autoFreePass).length;
        if(expected>0 && matchedSet.size>=expected) break;
      }

      if(analyzedFrames===0){
        throw new Error('영상 프레임을 분석하지 못했습니다. 다른 영상 파일로 다시 시도해주세요.');
      }

      videoRecognized=[...matchedSet].sort();
      videoReview=[...reviewMap.values()]
        .filter(x=>!matchedSet.has(x.norm))
        .sort((a,b)=>a.distance-b.distance || a.norm.localeCompare(b.norm));

      $('videoRecognizedCount').textContent=videoRecognized.length+'명';

      const parsedMap=new Map(parsed.items.map(x=>[x.norm,x.target]));
      const exactHtml=videoRecognized.length
        ? videoRecognized.map(id=>`<span>@${esc(parsedMap.get(id)||id)}</span>`).join('')
        : '<small>정확히 인식된 아이디가 없습니다.</small>';

      const reviewHtml=videoReview.length
        ? `<div class="review-subhead"><strong>확인 필요 ${videoReview.length}명</strong><small>OCR이 비슷하게 읽은 후보 · 누락으로 자동 처리하지 않음</small></div>
           <div class="review-list">
             ${videoReview.map(x=>`
               <label class="review-item">
                 <input type="checkbox" class="review-check" data-id="${esc(x.norm)}">
                 <span><b>@${esc(x.target)}</b><small>영상 인식: ${esc(x.seenAs)}</small></span>
               </label>`).join('')}
           </div>`
        : '';

      $('videoRecognizedList').innerHTML=exactHtml+reviewHtml;
      $('videoRecognizedWrap').classList.remove('hidden');

      if(videoRecognized.length===0){
        setVideoProgress('아이디 인식 실패 · 자동 판정 보류',100);
        $('videoHint').textContent='전원을 누락자로 처리하지 않았습니다. 스크롤 속도를 늦춰 다시 녹화하거나 캡처 방식으로 확인해주세요.';
      }else{
        setVideoProgress(`완료 · ${videoRecognized.length}명 인식`,100);
        $('videoHint').textContent=videoReview.length ? '정확 인식과 확인 필요 후보를 검토한 뒤 누락자 비교를 눌러주세요.' : '인식된 아이디 목록을 확인한 뒤 누락자 비교를 눌러주세요.';
      }

      logLocalEvent('video_collector_done',`${videoRecognized.length} recognized / ${analyzedFrames} frames`);
    }catch(e){
      setVideoProgress('영상 분석 실패',100);
      $('videoHint').textContent='오류: '+String(e.message||e);
      logLocalEvent('video_collector_error',e.message||e);
    }finally{
      if(worker){
        try{ await worker.terminate(); }catch(_){}
      }
      URL.revokeObjectURL(url);
      btn.disabled=false;
      btn.textContent='화면 녹화 분석 시작';
    }
  }

  function compareVideoRecognized(){
    const checked=[...document.querySelectorAll('.review-check:checked')]
      .map(el=>normalizeIg(el.dataset.id))
      .filter(Boolean);

    const recognized=[...new Set([...videoRecognized,...checked])];

    if(!recognized.length){
      alert('확정된 댓글 작성자가 없습니다. 자동 누락 판정은 하지 않습니다.');
      return;
    }

    // 확인 필요로 남겨둔 사람은 '누락'으로 자동 확정하지 않기 위해 비교 결과에서 별도 보류 처리
    const unresolved=new Set(
      videoReview
        .map(x=>x.norm)
        .filter(id=>!checked.includes(id))
    );

    runComparison(recognized,'대량 댓글 화면 녹화 분석');

    if(unresolved.size){
      // 현재 결과에서 unresolved를 누락자로 표시한 항목을 '확인 필요' 상태로 변경
      document.querySelectorAll('[data-missing-id]').forEach(el=>{
        const id=normalizeIg(el.getAttribute('data-missing-id'));
        if(unresolved.has(id)){
          el.classList.add('needs-review');
          const badge=el.querySelector('.missing-badge');
          if(badge) badge.textContent='확인 필요';
        }
      });
    }
  }

  function parseParticipantLine(line, lineNo){
    const original = String(line||'').trim();
    if(!original) return null;

    let body = original.replace(/^\s*\d+\s*[.)]?\s*/,'').trim();
    const numberMatch = original.match(/^\s*(\d+)/);
    const autoFreePass = /프패/.test(body);

    if(mode === 'instagram' || mode === 'personal' || mode === 'like' || mode === 'mone'){
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

  function isInstagramUrlLine(line){
    const s=String(line||'').trim().toLowerCase();
    return /^https?:\/\/(www\.)?instagram\.com\/(p|reel|tv)\//.test(s)
      || /^www\.instagram\.com\/(p|reel|tv)\//.test(s)
      || /^instagram\.com\/(p|reel|tv)\//.test(s);
  }

  function isAnyUrlLike(line){
    const s=String(line||'').trim().toLowerCase();
    return /^(https?:\/\/|www\.)/.test(s);
  }

  function parseParticipants(text){
    const raw=String(text||'');
    const lines=raw.split(/\r?\n/);
    const parsed=[];
    const warnings=[];
    let pendingPrefix=null;

    for(let i=0;i<lines.length;i++){
      let line=String(lines[i]||'').trim();
      if(!line) continue;

      // 게시물 링크는 참여자가 아님. 무조건 제외.
      if(isInstagramUrlLine(line) || isAnyUrlLike(line)){
        continue;
      }

      // 링크가 줄바꿈되어 '/www.instagram...'처럼 들어온 경우도 제외
      if(/^\/?www\.instagram\.com\/(p|reel|tv)\//i.test(line)
        || /^\/?instagram\.com\/(p|reel|tv)\//i.test(line)){
        continue;
      }

      // 숫자/기호만 있는 줄 제외
      if(/^[\d\s.)\-–—·•]+$/.test(line)) continue;

      const item=parseParticipantLine(line,i+1);
      if(!item) continue;

      // parseParticipantLine가 잘못 URL 조각을 username으로 본 경우 방지
      if(item.target && (
        /^https?$/i.test(item.target)
        || /^www$/i.test(item.target)
        || /instagram\.com/i.test(item.target)
        || /^p$/i.test(item.target)
        || /^reel$/i.test(item.target)
      )){
        continue;
      }

      // 일반 Instagram 계열 모드에서는 실제 username 형식만 허용
      if(mode!=='naver'){
        const n=normalizeIg(item.target);
        if(!isIg(n)){
          warnings.push({line:i+1,text:line,reason:'Instagram 아이디를 찾지 못함'});
          continue;
        }
        item.target=item.target.replace(/^@/,'');
        item.norm=n;
      }

      parsed.push(item);
    }

    // 같은 계정이 여러 방/줄에 반복될 수 있으므로 requiredCount 합산
    const merged=new Map();
    for(const x of parsed){
      const key=x.norm;
      if(!key) continue;

      if(!merged.has(key)){
        merged.set(key,{
          ...x,
          requiredCount:1,
          sourceLines:[x.lineNo]
        });
      }else{
        const m=merged.get(key);
        m.requiredCount=(m.requiredCount||1)+1;
        m.sourceLines.push(x.lineNo);
        // 프패/운영진 표시는 하나라도 있으면 유지
        m.autoFreePass=!!(m.autoFreePass||x.autoFreePass);
        m.isOperator=!!(m.isOperator||x.isOperator);
      }
    }

    return {
      items:[...merged.values()],
      warnings
    };
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

  function normalizeKoreanOcr(v){
    return String(v||'').toLowerCase().replace(/\s+/g,'').replace(/[^\p{L}\p{N}._-]/gu,'');
  }

  function recognizeNaver(text,items){
    const raw=String(text||'');
    const lines=raw.split(/\r?\n/).map(normalizeKoreanOcr).filter(Boolean);
    const joined=lines.join('');
    const matched=new Set();

    items.forEach(p=>{
      const target=normalizeKoreanOcr(p.target);
      if(!target) return;
      if(joined.includes(target)){ matched.add(p.norm); return; }

      if(target.length>=3){
        let best=99;
        for(const line of lines){
          if(line.length>=target.length){
            for(let i=0;i<=line.length-target.length;i++){
              best=Math.min(best,levenshtein(target,line.slice(i,i+target.length)));
              if(best<=1) break;
            }
          }else best=Math.min(best,levenshtein(target,line));
          if(best<=1) break;
        }
        const threshold=target.length>=6?2:1;
        if(best<=threshold){ matched.add(p.norm); return; }
      }

      if(target.length>=2){
        const hit=lines.some(line=>{
          let pos=0;
          for(const ch of [...target]){ pos=line.indexOf(ch,pos); if(pos<0) return false; pos++; }
          return true;
        });
        if(hit) matched.add(p.norm);
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

      if(mode === 'instagram' || mode === 'personal' || mode === 'like' || mode === 'mone'){
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

      runComparison(lastRecognized,`${mode==='naver'?'네이버 블로그 댓글':(mode==='like'?'인스타 좋아요':(mode==='mone'?'모네방 좋아요':(mode==='personal'?'일반 계정 댓글':'인스타 댓글')))} 캡처 ${selectedFiles.length}장 분석`);
    }finally{
      if(worker){
        try{await worker.terminate();}catch(_){}
      }
      btn.disabled=false;
      btn.textContent='캡처 분석 시작';
    }
  }

  function rerunFromOcr(){
    const normalizer = (mode === 'instagram' || mode === 'personal' || mode === 'like' || mode === 'mone') ? normalizeIg : normalizeBlog;

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

  function parseIdList(text, normalizer){
    return String(text||'')
      .split(/[\s,]+/)
      .map(v=>String(v||'').trim())
      .filter(Boolean)
      .map(v=>normalizer(v))
      .filter(Boolean);
  }

  function runComparison(recognizedValues, sourceLabel){
    const parsed=parseParticipants($('participants').value);
    const participants=parsed.items || [];
    if(!participants.length){
      alert('참여자 명단을 먼저 입력해주세요.');
      return;
    }

    const isInstaMode = mode !== 'naver';
    const normalizer = isInstaMode ? normalizeIg : normalizeBlog;
    const recognized = new Set((recognizedValues || []).map(v=>normalizer(v)).filter(Boolean));

    // 내 계정 / 운영진 / 직접 제외 / 프패는 누락 검사에서 제외
    const owner = normalizer($('ownerId')?.value || '');
    const manualExcluded = new Set(parseIdList($('excludeIds')?.value || '', normalizer));
    const manualFreePass = new Set(parseIdList($('freePassIds')?.value || '', normalizer));
    const adminSet = new Set(isInstaMode ? INSTAGRAM_ADMIN_IDS.map(normalizeIg) : []);

    let excludedCount=0;
    let freePassCount=0;
    let commentedCount=0;
    const missing=[];

    for(const person of participants){
      const id=normalizer(person.norm || person.target);
      if(!id) continue;

      const isOwner = !!owner && id === owner;
      const isAdmin = isInstaMode && adminSet.has(id);
      const isManualExcluded = manualExcluded.has(id);
      const isFreePass = !!person.autoFreePass || manualFreePass.has(id);

      if(isOwner || isAdmin || isManualExcluded){
        excludedCount++;
        continue;
      }
      if(isFreePass){
        freePassCount++;
        continue;
      }

      if(recognized.has(id)) commentedCount++;
      else missing.push(person.target || person.norm || id);
    }

    const requiredCount = participants.length - excludedCount - freePassCount;
    currentMissing = [...new Set(missing.map(v=>normalizer(v)).filter(Boolean))];
    lastRecognized = [...recognized];

    $('statParticipants').textContent = String(requiredCount);
    $('statCommented').textContent = String(commentedCount);
    $('statMissing').textContent = String(currentMissing.length);
    $('statExcluded').textContent = String(excludedCount);
    $('statFreePass').textContent = String(freePassCount);
    $('missingTitleCount').textContent = currentMissing.length + '명';
    $('checkedPost').textContent = sourceLabel || '확인 완료';
    $('checkedAt').textContent = new Date().toLocaleString('ko-KR', {month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});

    $('missingList').innerHTML = currentMissing.length
      ? currentMissing.map((id,i)=>`<div class="missing-item"><span>${i+1}</span><strong>${isInstaMode?'@':''}${esc(id)}</strong></div>`).join('')
      : '<div class="all-clear">✅ 누락자가 없습니다.</div>';

    $('recognizedCount').textContent = String(commentedCount);
    $('recognizedCountMirror').textContent = commentedCount + '명 인식';
    $('resultCard').classList.remove('hidden');
    $('resultCard').scrollIntoView({behavior:'smooth',block:'start'});
  }

  async function copyMissing(){
    const prefix = (mode === 'instagram' || mode === 'personal' || mode === 'like' || mode === 'mone') ? '@' : '';
    const text = currentMissing.map(x=>prefix+x).join('\n');

    if(!text) return alert('복사할 누락자가 없습니다.');

    await navigator.clipboard.writeText(text);
    alert(`${currentMissing.length}명 복사했습니다.`);
  }

  function resetCheckOnly(){
    selectedFiles = [];
    selectedCommentVideo=null;
    videoRecognized=[];
    videoReview=[];
    currentMissing = [];
    lastRecognized = [];

    ['participants','excludeIds','freePassIds','ocrUsernames'].forEach(id=>{
      if($(id)) $(id).value='';
    });

    if($('commentImages')) $('commentImages').value='';
    if($('commentVideo')) $('commentVideo').value='';
    if($('videoFileInfo')) { $('videoFileInfo').className='video-file-info empty'; $('videoFileInfo').textContent='선택된 영상이 없습니다.'; }
    $('videoProgressWrap')?.classList.add('hidden');
    $('videoRecognizedWrap')?.classList.add('hidden');
    if($('hybridPostUrl')) $('hybridPostUrl').value='';
    if($('hybridApiStatus')) { $('hybridApiStatus').textContent=''; $('hybridApiStatus').className='hybrid-status'; }
    if($('commentPasteText')) $('commentPasteText').value='';
    if($('commentPasteStatus')) { $('commentPasteStatus').textContent=''; $('commentPasteStatus').className='hybrid-status'; }


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
      const key = mode === 'naver' ? 'yeowoobang_naver_owner' : (mode === 'personal' ? 'yeowoobang_personal_owner' : (mode === 'like' ? 'yeowoobang_like_owner' : (mode === 'mone' ? 'yeowoobang_mone_owner' : 'yeowoobang_instagram_owner')));
      $('ownerId').value = localStorage.getItem(key) || ((mode==='instagram'||mode==='personal'||mode==='like'||mode==='mone')?'tlso_94':'');
    }
  }

  function renderMoneCommentFiles(){
    const box=$('moneCommentFileList');
    if(!moneCommentFiles.length){box.className='thumb-list empty';box.textContent='선택된 댓글 캡처가 없습니다.';return;}
    box.className='thumb-list';box.innerHTML=moneCommentFiles.map((f,i)=>`<div class="file-chip"><span>${i+1}. ${esc(f.name)}</span></div>`).join('');
  }

  async function extractMoneTargets(){
    const mapping=parseMemberMapping($('moneMemberMapping').value);
    if(!mapping.size){alert('여우방 등록 명단을 먼저 붙여넣어주세요.');return;}
    if(!moneCommentFiles.length){alert('참여 댓글 캡처를 먼저 추가해주세요.');return;}
    const status=$('moneExtractStatus');status.className='notice';status.textContent='참여 댓글에서 벤 링크 대상자를 찾는 중이에요…';
    const found=[];
    for(let i=0;i<moneCommentFiles.length;i++){
      status.textContent=`댓글 캡처 분석 중 · ${i+1}/${moneCommentFiles.length}`;
      const r=await Tesseract.recognize(moneCommentFiles[i],'kor+eng');const text=r.data.text||'';const compact=normalizeNickname(text).replace(/\s/g,'');
      for(const rec of mapping.values()){
        const nick=normalizeNickname(rec.nickname).replace(/\s/g,'');
        if(nick&&compact.includes(nick)) found.push(rec);
      }
    }
    const unique=[...new Map(found.map(x=>[normalizeIg(x.id),x])).values()];
    $('participants').value=unique.map((x,i)=>`${i+1}. ${x.nickname} / ${x.id}`).join('\n');renderParsed();
    status.className='notice';status.innerHTML=`<strong>${unique.length}명 벤 링크 검사 대상 생성</strong><br>좋아요 목록 캡처를 추가한 뒤 분석을 시작해주세요.`;
  }

  $('moneCommentImages').addEventListener('change',e=>{moneCommentFiles=Array.from(e.target.files||[]);renderMoneCommentFiles();});
  $('moneExtractBtn').addEventListener('click',extractMoneTargets);
  $('moneMemberMapping').value=localStorage.getItem('yeowoobang_mone_mapping')||'';
  $('moneMemberMapping').addEventListener('input',()=>localStorage.setItem('yeowoobang_mone_mapping',$('moneMemberMapping').value));


  $('commentVideo').addEventListener('change',e=>{
    selectedCommentVideo=(e.target.files&&e.target.files[0])||null;
    videoRecognized=[];
    videoReview=[];
    $('videoRecognizedWrap').classList.add('hidden');
    $('videoProgressWrap').classList.add('hidden');

    const box=$('videoFileInfo');
    if(!selectedCommentVideo){
      box.className='video-file-info empty';
      box.textContent='선택된 영상이 없습니다.';
      return;
    }

    const mb=(selectedCommentVideo.size/1024/1024).toFixed(1);
    box.className='video-file-info';
    box.innerHTML=`<strong>${esc(selectedCommentVideo.name)}</strong><span>${mb}MB</span>`;
  });

  $('videoAnalyzeBtn').addEventListener('click',analyzeCommentVideo);
  $('videoCompareBtn').addEventListener('click',compareVideoRecognized);
  $('commentPasteCheckBtn')?.addEventListener('click',runPastedCommentCheck);

  document.querySelectorAll('.channel-card').forEach(btn=>{
    btn.addEventListener('click',()=>selectMode(btn.dataset.mode));
  });

  $('backHomeBtn').addEventListener('click',goHome);
  $('participants')?.addEventListener('input',renderParsed);


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

  $('hybridApiBtn')?.addEventListener('click',runHybridApiCheck);

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

  $('showIdsBtn')?.addEventListener('click',()=>{
    $('idDrawer').classList.toggle('hidden');
    $('showIdsBtn').textContent = $('idDrawer').classList.contains('hidden') ? '추출 결과 보기' : '접기';
  });

  $('toggleOptionsBtn').addEventListener('click',()=>{
    $('optionBody').classList.toggle('hidden');
    $('toggleOptionsBtn').textContent = $('optionBody').classList.contains('hidden') ? '＋' : '−';
  });

  $('ownerId').addEventListener('input',()=>{
    if(!mode) return;
    const key = mode === 'naver' ? 'yeowoobang_naver_owner' : (mode === 'personal' ? 'yeowoobang_personal_owner' : (mode === 'like' ? 'yeowoobang_like_owner' : (mode === 'mone' ? 'yeowoobang_mone_owner' : 'yeowoobang_instagram_owner')));
    localStorage.setItem(key,$('ownerId').value.trim());
  });

  renderFileList();

  // 초기 화면에서도 현재 입력값을 즉시 반영
  try { renderParsed(); } catch(e) { console.warn('초기 명단 파싱 실패', e); }
})();