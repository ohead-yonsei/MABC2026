(function(){
  const SAMPLE_NOTICE = `2026년 청년 창업 도약 지원사업 모집 공고

1. 지원 대상: 공고일 기준 만 19세 이상 39세 이하, 사업자등록 3년 이내 창업자

2. 제출 서류
  가. 지원신청서(별지 제1호 서식) 1부
  나. 사업자등록증명원 사본 1부 (발급일로부터 3개월 이내의 것)
  다. 대표자 신분증 사본 1부
  라. 최근 연도 부가가치세 과세표준증명원 1부
  마. 4대보험 가입자명부 1부. 다만 대표자 1인 기업은 제출을 생략할 수 있다.
  바. 가점 대상자는 해당 증빙(장애인기업확인서, 여성기업확인서 등)을 함께 제출한다.
  사. 심사 과정에서 필요시 추가 서류를 요청할 수 있다.

3. 접수 기한: 2026년 9월 15일(화) 18:00까지 온라인 접수`;

  const $ = (s)=>document.querySelector(s);
  const textEl = $("#text");
  const runBtn = $("#runBtn");
  const sampleBtn = $("#sampleBtn");
  const docList = $("#docList");
  const docListDocs = $("#docListDocs");
  const docAddBtnDocs = $("#docAddBtnDocs");
  const docResetBtnDocs = $("#docResetBtnDocs");
  const docCountTag = $("#docCountTag");
  const docCountTagDocs = $("#docCountTagDocs");
  const dropZone = $("#dropZone");
  const leftPanel = $("#left-panel");
  const centerCompare = $("#center-compare");
  const centerDocs = $("#center-docs");
  const centerIntro = $("#center-intro");
  const centerPanel = $("#center-panel");
  const rightPanel = document.querySelector(".right-panel");
  const detailContent = $("#detailContent");
  const detailCloseBtn = $("#detailCloseBtn");
  const tabCompare = $("#tab-compare");
  const tabDocs = $("#tab-docs");
  const tabIntro = $("#tab-intro");
  let noticeEl = $("#notice");
  const resultBox = $("#resultBox");
  const resultSummary = $("#resultSummary");
  const resultTable = $("#resultTable");
  const resultAction = $("#resultAction");
  const resultDisclaimer = $("#resultDisclaimer");
  const copyBtn = $("#copyBtn");

  const STORAGE_KEY_DOCS = "mfc_docs_v1";

  function readDocs(){
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY_DOCS) || "[]"); } catch(e){ return []; }
  }
  function writeDocs(docs){ try { localStorage.setItem(STORAGE_KEY_DOCS, JSON.stringify(docs)); } catch(e){} }

  function normalizeName(name){
    return name.toLowerCase().trim().replace(/[\s\-()[]]/g, "");
  }

  function isPublicDocument(name){
    const n = name.toLowerCase();
    return /\b(증명서|확인증|신고증|등록증|허가증|확인서|확인서|등본|초본|납세증명|자격확인|인허가|신고필증)\b/.test(n);
  }

  // 왼쪽 패널 내 서류 목록을 상태에 따라 렌더링 (대조 결과 탭용)
  function renderDocList(docs, statuses){
    if(!docList) return;
    docList.innerHTML = "";
    docCountTag.textContent = "내 서류: " + docs.length;
    if(!docs.length){
      docList.innerHTML = "<p class='text-sm text-gray-400'>아직 등록한 서류가 없습니다. 대조 결과에서 '등록하기'로 서류를 추가하세요.</p>";
      return;
    }
    for(const d of docs){
      const card = document.createElement("div");
      const norm = normalizeName(d.name);
      const status = statuses && statuses[norm] ? statuses[norm] : "대조전";
      let cardClass = "doc-card cond";
      let badgeText = "";
      let badgeClass = "";
      if(status === "대조전"){
        cardClass = "doc-card cond";
        badgeText = "대조 전";
        badgeClass = "bg-gray-100 text-gray-600";
      } else if(status === "충족"){
        cardClass = "doc-card ok";
        badgeText = "조건 충족";
        badgeClass = "bg-green-100 text-green-700";
      } else if(status === "미충족"){
        cardClass = "doc-card missing";
        badgeText = "미충족";
        badgeClass = "bg-red-100 text-red-700";
      } else if(status === "형식확인"){
        cardClass = "doc-card cond";
        badgeText = "형식 확인 필요";
        badgeClass = "bg-yellow-100 text-yellow-700";
      } else if(status === "판단불가"){
        cardClass = "doc-card cond";
        badgeText = "판단 불가";
        badgeClass = "bg-gray-100 text-gray-600";
      } else {
        cardClass = "doc-card missing";
        badgeText = "서류 누락";
        badgeClass = "bg-red-100 text-red-700";
      }
      const head = document.createElement("div");
      head.className = "flex items-center justify-between gap-3";
      const info = document.createElement("div");
      const nameEl = document.createElement("div");
      nameEl.className = "doc-name";
      nameEl.textContent = d.name;
      const issuedEl = document.createElement("div");
      issuedEl.className = "doc-issued";
      issuedEl.textContent = d.issued ? ("발급일: " + d.issued) : "발급일 없음";
      info.appendChild(nameEl);
      info.appendChild(issuedEl);
      const right = document.createElement("div");
      right.className = "flex items-center gap-2";
      if(status === "미충족" || status === "서류 누락" || status === "대조전"){
        const regBtn = document.createElement("button");
        regBtn.type = "button";
        regBtn.className = "doc-register";
        regBtn.textContent = "등록하기";
        regBtn.setAttribute("data-register", d.name.replace(/"/g, "&quot;"));
        right.appendChild(regBtn);
        if(isPublicDocument(d.name)){
          const issueBtn = document.createElement("button");
          issueBtn.type = "button";
          issueBtn.className = "doc-issue";
          issueBtn.textContent = "발급하기";
          issueBtn.setAttribute("data-issue", d.name.replace(/"/g, "&quot;"));
          right.appendChild(issueBtn);
        }
      }
      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "doc-del";
      delBtn.textContent = "삭제";
      delBtn.addEventListener("click", ()=>{
        const next = readDocs().filter(x=>x!==d);
        writeDocs(next);
        renderDocList(next);
        renderDocListDocs(next);
      });
      right.appendChild(delBtn);
      const badge = document.createElement("span");
      badge.className = "doc-tag " + badgeClass;
      badge.textContent = badgeText;
      right.insertBefore(badge, right.firstChild);
      head.appendChild(info);
      head.appendChild(right);
      card.appendChild(head);
      card.className = cardClass;
      docList.appendChild(card);
    }
    // 등록하기 버튼 이벤트 바인딩
    docList.querySelectorAll(".doc-register").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        const name = btn.getAttribute("data-register");
        const issued = prompt("발급일 (선택, YYYY-MM-DD):", "");
        const docs = readDocs();
        docs.push({ name: name.trim(), issued: issued && issued.trim() ? issued.trim() : null });
        writeDocs(docs);
        const statuses = buildStatusesFromResult(currentResult);
        renderDocList(docs, statuses);
        renderDocListDocs(docs);
      });
    });
    docList.querySelectorAll(".doc-issue").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        const name = btn.getAttribute("data-issue");
        alert(name + " 발급 안내: 해당 서류는 관공서/공공기관에서 발급 가능합니다. (서비스 연동 예정)");
      });
    });
  }

  // 내 서류함 탭용 순수 목록 렌더링 (상태 뱃지 없음, 수정/삭제만)
  function renderDocListDocs(docs){
    docListDocs.innerHTML = "";
    docCountTagDocs.textContent = "총 서류: " + docs.length;
    $("#detailContent").classList.add("hidden");
    if(!docs.length){
      docListDocs.innerHTML = "<p class='text-sm text-gray-400'>아직 등록한 서류가 없습니다. '새 서류 등록'으로 서류를 추가하세요.</p>";
      return;
    }
    for(const d of docs){
      const card = document.createElement("div");
      card.className = "doc-card cond";
      const head = document.createElement("div");
      head.className = "flex items-center justify-between gap-3";
      const info = document.createElement("div");
      const nameEl = document.createElement("div");
      nameEl.className = "doc-name";
      nameEl.textContent = d.name;
      const issuedEl = document.createElement("div");
      issuedEl.className = "doc-issued";
      issuedEl.textContent = d.issued ? ("발급일: " + d.issued) : "발급일 없음";
      info.appendChild(nameEl);
      info.appendChild(issuedEl);
      const right = document.createElement("div");
      right.className = "flex items-center gap-2";
      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "doc-edit";
      editBtn.textContent = "수정";
      editBtn.addEventListener("click", ()=>{
        const newName = prompt("서류명:", d.name);
        if(!newName || !newName.trim()) return;
        const newIssued = prompt("발급일 (선택, YYYY-MM-DD):", d.issued || "");
        const idx = readDocs().indexOf(d);
        if(idx >= 0){
          const arr = readDocs();
          arr[idx] = { name: newName.trim(), issued: newIssued && newIssued.trim() ? newIssued.trim() : null };
          writeDocs(arr);
          renderDocListDocs(readDocs());
        }
      });
      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "doc-del";
      delBtn.textContent = "삭제";
      delBtn.addEventListener("click", ()=>{
        const next = readDocs().filter(x=>x!==d);
        writeDocs(next);
        renderDocListDocs(next);
      });
      right.appendChild(editBtn);
      right.appendChild(delBtn);
      head.appendChild(info);
      head.appendChild(right);
      card.appendChild(head);
      docListDocs.appendChild(card);
    }

    // 열람: 카드 클릭 시 오른쪽 미리보기
    docListDocs.querySelectorAll(".doc-card").forEach(card=>{
      const idx = Array.prototype.indexOf.call(docListDocs.querySelectorAll(".doc-card"), card);
      if(!(idx >= 0)) return;
      const d = docs[idx];
      if(!d) return;
      card.addEventListener("click", ()=> showDocPreview(d));
    });
  }

  function showNotice(msg){
    if(!noticeEl){
      const el = document.createElement("div");
      el.id = "notice";
      el.className = "result-foot";
      el.style.color = "#9b1c1c";
      el.style.background = "#fef2f2";
      el.style.border = "1px solid #fca5a5";
      el.style.borderRadius = "6px";
      el.style.padding = "8px";
      el.style.marginTop = "14px";
      el.style.fontSize = "13px";
      document.querySelector("#center-compare").appendChild(el);
      noticeEl = el;
    }
    noticeEl.textContent = msg;
    noticeEl.style.display = msg ? "block" : "none";
  }

  // 열람: 카드 클릭 시 오른쪽 미리보기
  function showDocPreview(doc){
    // 상세 카드에 서류 정보 표시
    const now = new Date().toLocaleString("ko-KR");
    detailContent.classList.remove("hidden");
    detailContent.innerHTML = "
      <div class="flex justify-between items-start gap-3 mb-3">
        <div>
          <p class="text-sm text-gray-400">선택한 서류</p>
          <p class="font-semibold text-lg mt-1">" + escapeHtml(doc.name) + "</p>
          <p class="text-sm text-gray-500 mt-1">" + (doc.issued ? "발급일: " + doc.issued : "발급일 없음") + "</p>
          <p class="text-sm text-gray-400 mt-1">등록: " + (doc.regDate ? doc.regDate : now) + "</p>
          <p class="text-sm text-gray-400 mt-1">최종 수정: " + now + "</p>
        </div>
      </div>
      <div class="flex gap-2 mb-3">
        <button id="previewEditBtn" class="text-sm text-gray-500 hover:text-gray-800">수정</button>
        <button id="previewDeleteBtn" class="text-sm text-red-600 hover:text-red-800">삭제</button>
      </div>
      <button id="previewCloseBtn" class="text-sm text-gray-500 hover:text-gray-800">닫기</button>
    ";

    document.getElementById("previewEditBtn").onclick = ()=>{
      const newName = prompt("서류명:", doc.name);
      if(!newName || !newName.trim()) return;
      const newIssued = prompt("발급일 (선택, YYYY-MM-DD):", doc.issued || "");
      const docs = readDocs();
      const idx = docs.indexOf(doc);
      if(idx >= 0){
        docs[idx] = { name: newName.trim(), issued: newIssued && newIssued.trim() || null, regDate: docs[idx].regDate || new Date().toLocaleString("ko-KR"), modDate: now };
        writeDocs(docs);
        renderDocListDocs(docs);
        $("#detailContent").classList.add("hidden");
      }
    };
    document.getElementById("previewDeleteBtn").onclick = ()=>{
      if(!confirm("'" + doc.name + "'을(를) 삭제하시겠습니까?")) return;
      const next = readDocs().filter(x=>x!==doc);
      writeDocs(next);
      renderDocListDocs(next);
      $("#detailContent").classList.add("hidden");
    };
    $("#previewCloseBtn").onclick = ()=> $("#detailContent").classList.add("hidden");
  }

  // 대비용: 필요 서류+보유 여부 전용 렌더
  function renderContrastResult(result){
    const ownedNames = readDocs().map(d=>d.name);
    const ownedNorms = new Set(ownedNames.map(normalizeName));
    const list = $("#contrastList");

    if(!result || !result.rows || !result.rows.length){
      list.innerHTML = "<p class='text-sm text-gray-400'>" + (result && result.rows && result.rows.length === 0
        ? "이 공고문에서는 필수·구비 서류로 추출된 항목이 없습니다."
        : "대조 결과가 없습니다. 공고문을 다시 확인해 주세요.") + "</p>";
      $("#contrastSummary").textContent = "대조 결과가 없습니다.";

      return;
    }

    const rows = result.rows;
    list.innerHTML = "";
    let haveCount = 0;
    let formatCheckCount = 0;
    let cannotDecideCount = 0;
    let lackingCount = 0;

    for(const row of rows){
      const r = document.createElement("div");
      r.className = "border border-gray-100 rounded-lg p-4";
      const needNorm = normalizeName(row.name || "");
      const isOwn = ownedNorms.has(needNorm);

      if(row.status === "충족") haveCount++;
      else if(row.status === "형식확인") formatCheckCount++;
      else if(row.status === "판단불가") cannotDecideCount++;
      else lackingCount++;

      const head = document.createElement("div");
      head.className = "flex justify-between items-start gap-2 mb-2";

      const name = document.createElement("div");
      name.className = "font-medium";
      name.textContent = row.name;
      head.appendChild(name);

      const badge = document.createElement("span");
      badge.className = "text-xs px-2 py-0.5 rounded";
      if(isOwn){
        if(row.status === "충족"){
          badge.classList.add("bg-green-100", "text-green-700");
          badge.textContent = "가지고 있음(충족)";
        } else if(row.status === "형식확인"){
          badge.classList.add("bg-yellow-100", "text-yellow-700");
          badge.textContent = "가지고 있음(형식 확인 필요)";
        } else if(row.status === "판단불가"){
          badge.classList.add("bg-gray-100", "text-gray-600");
          badge.textContent = "가지고 있음(판단 불가)";
        } else {
          badge.classList.add("bg-red-100", "text-red-700");
          badge.textContent = "가지고 있음(보유 확인 필요)";
        }
      } else {
        if(row.status === "판단불가"){
          badge.classList.add("bg-gray-100", "text-gray-600");
          badge.textContent = "판단 불가";
        } else if(row.status === "형식확인"){
          badge.classList.add("bg-yellow-100", "text-yellow-700");
          badge.textContent = "필요함(형식 확인 필요)";
        } else {
          badge.classList.add("bg-red-100", "text-red-700");
          badge.textContent = "필요함";
        }
      }
      head.appendChild(badge);
      r.appendChild(head);

      const evidence = document.createElement("div");
      evidence.className = "text-sm text-gray-500 mt-1";
      evidence.textContent = (row.evidence || "").trim() || "공고 원문 근거 없음";
      r.appendChild(evidence);

      const sub = document.createElement("div");
      sub.className = "text-sm text-gray-500 mt-1";
      if(row.status === "형식확인"){
        const fmt = (row.format_note || "").trim();
        sub.textContent = fmt ? fmt + " 조건을 만족하는지 확인하셨나요?" : "보유 서류와 동일 서류인지 확인하셨나요?";
      } else if(row.status === "판단불가"){
        const condInfo = (row.conditional_info || "해당 조건에 해당하는지").trim();
        const condNote = (row.format_note || "").trim();
        const condParts = []
          .concat(condInfo ? [condInfo] : [])
          .concat(condNote ? [condNote] : [])
          .filter(Boolean);
        if(condParts.length){
          const text = condParts.join(" / ");
          if(/인지|하는지|경우|하는 경우|에 해당하는 경우|에 한|할경우|하는경우/.test(text)){
            sub.textContent = /인지$/.test(text) || /하는지$/.test(text)
              ? text + " 확인이 필요합니다"
              : /경우$/.test(text) || /하는 경우$/.test(text) || /에 해당하는 경우$/.test(text)
                ? text + "에 해당하시나요?"
                : text + "인지 확인이 필요합니다";
          } else {
            sub.textContent = text + "에 해당하시나요?";
          }
        } else {
          sub.textContent = "조건 해당 여부를 확인할 수 없습니다.";
        }
      } else {
        sub.textContent = "";
      }
      r.appendChild(sub);

      r.onclick = () => showContrastDetail(row, isOwn);
      r.style.cursor = "pointer";
      r.title = rowExplain(row, isOwn);

      list.appendChild(r);
    }

    const total = haveCount + formatCheckCount + cannotDecideCount + lackingCount;
    $("#contrastSummary").textContent =
      "필수·구비 서류 " + total + "건 중 보유 " + haveCount + "건 / 형식확인 " + formatCheckCount + "건 / 판단불가 " + cannotDecideCount + "건 / 미충족 " + lackingCount + "건";
    $("#docCountTag").textContent = "내 서류: " + ownedNames.length;
  }

  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]||c));
  }

  function rowExplain(row, isOwn){
    const status = row.status || "";
    const name = (row.name || "").trim();
    const evidence = (row.evidence || "").trim();
    const fmt = (row.format_note || "").trim();
    const condInfo = (row.conditional_info || "").trim();

    const hasEvidence = evidence.length > 0;
    const genericDoc = /지원신청|신청서|사업신청서|참가신청서|등록신청서|가입신청서|지급신청서|확인서\s*신청|신고서/i.test(name);

    let lines = [];
    if(genericDoc){
      lines.push("서류명만 대조한 결과라 내부 서식·양식은 별도 확인이 필요합니다.");
    }
    if(status === "충족"){
      lines.push(isOwn ? "보유하고 계신 서류와 공고 요건을 대조한 결과, 충족된 것으로 판단됩니다." : "보유 서류 기준 충족으로 판정되었습니다.");
    } else if(status === "형식확인"){
      if(isOwn){
        lines.push(fmt ? ("보유하신 " + escapeHtml(name) + "가 공고에서 요구하는 " + escapeHtml(fmt) + " 조건을 만족하는지 확인이 필요합니다.") : "보유 서류와 공고 요건 서류의 동일 여부/형식 확인이 필요합니다.");
        if(!hasEvidence){
          lines.push("서류명만 대조한 결과라 형식 확인이 필요합니다.");
        }
      } else {
        lines.push(fmt ? ("해당 서류는 " + escapeHtml(fmt) + " 조건을 확인해야 합니다.") : "해당 서류의 형식 확인이 필요합니다.");
        if(!hasEvidence){
          lines.push("서류명만 대조한 결과라 형식 확인 필요입니다.");
        }
      }
    } else if(status === "판단불가"){
      if(condInfo){
        lines.push(condInfo + "에 해당하는지 확인이 필요합니다.");
      } else {
        lines.push("요건을 특정할 수 없어 판단이 어렵습니다.");
      }
    } else {
      lines.push("현재 보유 서류에는 없는 제출 요건입니다.");
    }
    return lines.join(" ");
  }

  function showContrastDetail(row, isOwn){
    const d = document.getElementById("detailContent");
    if(!d) return;
    d.classList.remove("hidden");
    d.innerHTML = "";
    const status = row.status || "";
    const name = (row.name || "").trim();
    const evidence = (row.evidence || "").trim();
    const fmt = (row.format_note || "").trim();
    const condInfo = (row.conditional_info || "").trim();

    const hasEvidence = evidence.length > 0;
    const genericDoc = /지원신청|신청서|사업신청서|참가신청서|등록신청서|가입신청서|지급신청서|확인서\s*신청|신고서/i.test(name);
    const owned = readDocs() || [];
    const ownMatch = owned.filter(o => normalizeName(o.name) === normalizeName(name));

    const parts = [];

    parts.push("<div class='flex justify-between gap-2 items-start'>");
    parts.push("<div class='font-medium text-gray-900'>" + escapeHtml(name) + "</div>");

    const badgeCls = status === "충족" ? "bg-green-100 text-green-700" :
      status === "형식확인" ? "bg-yellow-100 text-yellow-700" :
      status === "판단불가" ? "bg-gray-100 text-gray-600" : "bg-red-100 text-red-700";
    const badgeText = isOwn
      ? (status === "충족" ? "가지고 있음(충족)" : status === "형식확인" ? "가지고 있음(형식 확인 필요)" : status === "판단불가" ? "가지고 있음(판단 불가)" : "가지고 있음(보유 확인 필요)")
      : (status === "판단불가" ? "판단 불가" : status === "형식확인" ? "필요함(형식 확인 필요)" : "필요함");
    parts.push("<span class='text-xs px-2 py-0.5 rounded " + badgeCls + "'>" + escapeHtml(badgeText) + "</span>");
    parts.push("</div>");

    if(ownMatch.length){
      parts.push("<div class='mt-3 text-sm'><span class='font-medium text-gray-700'>보유 서류:</span>");
      parts.push("<ul class='mt-1 space-y-1'>");
      for(const o of ownMatch){
        parts.push("<li>" + escapeHtml((o.name||"").trim()) + (o.issuedAt ? " (발급일: " + escapeHtml(o.issuedAt) + ")" : "") + "</li>");
      }
      parts.push("</ul></div>");
    } else if(isOwn){
      parts.push("<div class='mt-2 text-sm text-gray-600'>보유 서류 목록에 같은 이름의 서류가 없습니다.</div>");
    }

    parts.push("<div class='mt-3 text-sm'>");
    parts.push("<span class='font-medium text-gray-700'>판단 이유:</span> ");
    parts.push(escapeHtml(rowExplain(row, isOwn)));
    parts.push("</div>");

    if(fmt || condInfo){
      parts.push("<div class='mt-2 text-sm'>");
      parts.push("<span class='font-medium text-gray-700'>확인할 내용:</span> ");
      const checkParts = []
        .concat(fmt ? [fmt + " 조건 확인"] : [])
        .concat(condInfo ? [condInfo] : [])
        .filter(Boolean);
      parts.push(escapeHtml(checkParts.join(" / ") || "요건 확인 필요"));
      parts.push("</div>");
    }

    if(!hasEvidence){
      parts.push("<div class='mt-2 text-sm text-gray-600'>공고 원문 근거가 확인되지 않아, 서류명만 대조한 결과입니다. 실제 공고문에서 해당 요건의 정확한 내용을 함께 확인하시기 바랍니다.</div>");
    }

    if(genericDoc){
      parts.push("<div class='mt-3'>");
      parts.push("<span class='inline-flex items-center gap-1.5 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2'><svg class='w-4 h-4 text-amber-600' fill='none' viewBox='0 0 24 24' stroke='currentColor' stroke-width='2'><path stroke-linecap='round' stroke-linejoin='round' d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z'/></svg><span class='font-medium'>내부 서식 확인 필요</span></span>");
      parts.push("<div class='mt-2 text-sm text-amber-900'>" + escapeHtml(name) + "는 제목만으로는 실제 제출 서류의 내용·양식·서식을 알 수 없는 범용 서류입니다. 공고문에 첨부된 서식·양식 예시와 보유 서류의 내부를 직접 비교해 보시고, 일치하지 않으면 형식 확인이 필요합니다.</div>");
      parts.push("</div>");
    }

    hideLoading();
    hideLoading();
    d.innerHTML = parts.join("");
    d.classList.remove("hidden");
  }

  let currentResult = null;

  function buildStatusesFromResult(result){
    if(!result || !result.rows) return {};
    const m = {};
    for(const r of result.rows){
      const norm = normalizeName(r.name);
      m[norm] = r.status;
    }
    return m;
  }

  function tabSwitch(tab){
    currentTab = tab;
    tabCompare.classList.toggle("active", tab === "compare");
    tabDocs.classList.toggle("active", tab === "docs");
    tabIntro.classList.toggle("active", tab === "intro");
    if(tab === "compare"){
      leftPanel.classList.remove("hidden");
      centerCompare.classList.add("active");
      centerDocs.classList.remove("active");
      centerIntro.classList.remove("active");
      renderContrastResult(currentResult);
    } else if(tab === "docs"){
      leftPanel.classList.add("hidden");
      centerCompare.classList.remove("active");
      centerDocs.classList.add("active");
      centerIntro.classList.remove("active");
      renderDocListDocs(readDocs());
    } else {
      leftPanel.classList.add("hidden");
      centerCompare.classList.remove("active");
      centerDocs.classList.remove("active");
      centerIntro.classList.add("active");
    }
  }

  tabCompare.addEventListener("click", (e)=>{ e.preventDefault(); tabSwitch("compare"); });
  tabDocs.addEventListener("click", (e)=>{ e.preventDefault(); tabSwitch("docs"); });
  tabIntro.addEventListener("click", (e)=>{ e.preventDefault(); tabSwitch("intro"); });

  function runWithText(text, docs){
    if(!text.trim()){ showNotice("공고문을 붙여넣어 주세요."); return; }
    runBtn.disabled = true;
    runBtnText.textContent = "대조 중";
    runBtnSpinner.style.display = "inline-block";
    setRunStatus("서버에 대조 요청을 보내는 중...");
    currentResult = null;
    if(noticeEl){
      noticeEl.textContent = "";
      noticeEl.style.display = "none";
    }
    showLoading("서버에 대조 요청을 보내는 중...", "공고문을 분석하고 있습니다.");
    fetch("/api/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, owned: docs })
    })
      .then(r=>{
        if(!r.ok){
          runBtn.disabled = false;
          runBtnText.textContent = "대조하기";
          runBtnSpinner.style.display = "none";
          setRunStatus("");
          showNotice("대조 결과 요청이 실패했습니다. (HTTP " + r.status + ")");
          return Promise.reject(new Error("HTTP " + r.status));
        }
        setRunStatus("Solar Pro 4가 공고문에서 제출 요건을 추출 중...");
        showLoading("Solar Pro 4가 분석 중...", "공고문에서 제출 요건을 추출하고 있습니다.");
        return r.json().then(data=>{
          // 실제 호출과 별개로 잠깐 대기해 중간 상태가 보이도록 함
          return new Promise(resolve=>setTimeout(resolve, 900)).then(()=>data);
        });
      })
      .then(data=>{
        runBtn.disabled = false;
        runBtnText.textContent = "대조하기";
        runBtnSpinner.style.display = "none";
        if(data.error || data.detail){
          setRunStatus("");
          showNotice(data.error + " " + (data.detail||""));
          return;
        }
        if(data.notice){
          setRunStatus("");
          showNotice(data.notice);
          return;
        }
        setRunStatus("추출한 요건과 보유 서류를 대조 중...");
        showLoading("요건과 서류를 대조 중...", "보유 서류와 하나씩 비교하고 있습니다.");
        currentResult = data;
        // 대조 결과 탭으로 전환
        return new Promise(resolve=>setTimeout(resolve, 500)).then(()=>{
          tabSwitch("compare");
          setRunStatus("");
          hideLoading();
          return data;
        });
      })
      .catch(err=>{
        runBtn.disabled = false;
        runBtnText.textContent = "대조하기";
        runBtnSpinner.style.display = "none";
        setRunStatus("");
        showNotice("대조 결과를 가져올 수 없습니다. 다시 시도해 주세요.");
      });
  }

  function showLoading(msg, sub){
    const ov = document.getElementById("loadingOverlay");
    if(!ov) return;
    ov.classList.remove("hidden");
    const t = document.getElementById("loaderTitle");
    const s = document.getElementById("loaderSub");
    if(t) t.textContent = msg;
    if(s) s.textContent = sub || "";
  }
  function hideLoading(){
    const ov = document.getElementById("loadingOverlay");
    if(!ov) return;
    ov.classList.add("hidden");
  }

  function setRunStatus(msg){
    const el = $("#runStatus");
    if(!el) return;
    if(msg){
      el.textContent = msg;
      el.classList.remove("text-gray-400");
      el.classList.add("text-blue-600", "font-medium");
    } else {
      el.textContent = "";
      el.classList.remove("text-blue-600", "font-medium");
      el.classList.add("text-gray-400");
    }
  }

  // 예시 공고로 해보기: 왼쪽 텍스트 채우고 바로 대조
  sampleBtn.addEventListener("click", ()=>{ textEl.value = SAMPLE_NOTICE; runWithText(SAMPLE_NOTICE, readDocs()); });
  runBtn.addEventListener("click", ()=>{ runWithText(textEl.value, readDocs()); });

  docAddBtnDocs.addEventListener("click", ()=>{
    const name = prompt("서류명:");
    if(!name || !name.trim()) return;
    const issued = prompt("발급일 (선택, YYYY-MM-DD):", "");
    const docs = readDocs();
    docs.push({ name: name.trim(), issued: issued && issued.trim() ? issued.trim() : null });
    writeDocs(docs);
    renderDocListDocs(docs);
  });

  docResetBtnDocs.addEventListener("click", ()=>{
    if(!confirm("내 서류를 모두 삭제하시겠습니까?")) return;
    writeDocs([]);
    renderDocListDocs([]);
  });

  // 드래그앤드롭
  ["dragenter","dragover","dragleave","drop"].forEach(n=>{
    dropZone.addEventListener(n, e=>{ e.preventDefault(); e.stopPropagation(); }, false);
  });
  ["dragenter","dragover"].forEach(n=>{
    dropZone.addEventListener(n, ()=>{ dropZone.classList.add("dragover"); }, false);
  });
  ["dragleave","drop"].forEach(n=>{
    dropZone.addEventListener(n, ()=>{ dropZone.classList.remove("dragover"); }, false);
  });
  dropZone.addEventListener("drop", e=>{
    e.preventDefault();
    e.stopPropagation();
    const files = e.dataTransfer.files;
    if(files.length){
      const file = files[0];
      if(!file.type.startsWith("application/pdf") && !file.type.startsWith("image/") && !file.name.match(/\.(pdf|jpg|jpeg|png|webp|docx|pptx|xlsx)$/i)){
        showNotice("지원하지 않는 파일 형식입니다. PDF, JPG, PNG 등 공고문 파일을 업로드하세요.");
        return;
      }
      uploadFileToParse(file);
    } else {
      showNotice("파일이 첨부되지 않았습니다.");
    }
  });
  dropZone.addEventListener("click", ()=>{
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".pdf,.jpg,.jpeg,.png,.webp,.docx,.pptx,.xlsx";
    input.onchange = ()=>{
      const files = input.files;
      if(files && files.length){
        uploadFileToParse(files[0]);
      }
    };
    input.click();
  });

  // 파일 업로드 → 파싱 → 텍스트 채우기
  async function uploadFileToParse(file){
    if(file.size > 4 * 1024 * 1024){
      showNotice("파일 크기가 너무 큽니다. 최대 4MB까지 업로드할 수 있습니다.");
      return;
    }
    dropZone.classList.add("dragover");
    showNotice("문서를 파싱 중...");
    try{
      const formData = new FormData();
      formData.append("document", file);
      const response = await fetch("/api/parse", { method: "POST", body: formData });
      const data = await response.json();
      if(!response.ok){
        showNotice(data.error || "문서 파싱에 실패했습니다.");
        return;
      }
      if(!data.ok){
        showNotice(data.detail || "문서 파싱 결과를 읽을 수 없습니다.");
        return;
      }
      textEl.value = data.text;
      $("#contrastSummary").textContent = "문서에서 " + (data.text || "").length + "자 추출됨. 결과를 확인하려면 '대조하기'를 누르세요.";
      showNotice("문서 파싱 완료: " + (data.text || "").length + "자 추출됨");
    }catch(err){
      showNotice("문서 파싱 요청 중 오류가 발생했습니다.");
    }finally{
      dropZone.classList.remove("dragover");
    }
  }

  // 온보딩: '직접 해보기' 버튼 → 공고 비교하기 탭으로 이동
  const onboardingNextBtn = $("#onboardingNextBtn");
  if(onboardingNextBtn){
    onboardingNextBtn.addEventListener("click", ()=>{
      tabSwitch("compare");
      if(textEl) textEl.focus();
    });
  }

  // 초기 렌더링: 온보딩 화면 먼저 표시
  tabSwitch("intro");
})();