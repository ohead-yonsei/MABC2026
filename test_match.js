const _m = require("./api/_match.js");

function runTest(name, reqs, owned, nowISO){
  console.log("\n========== " + name + " ==========");
  const rows = [];
  for(const r of reqs){
    const match = _m.matchRequirement(r, owned);
    let status = _m.decideStatus(r, match);

    if(status === "형식확인" && nowISO){
      const ownedItem = owned.find(o => typeof o !== "string" && (o.name === r.name));
      if(ownedItem && ownedItem.issued){
        const ok = _m.evaluateDateCondition({ format_note: r.format_note || "" }, ownedItem, nowISO);
        if(ok === true){ status = "충족"; }
        else if(ok === false){ status = "미충족"; }
      }
    }

    let matched_owned = "";
    if(match.matched){
      const reqNorm = _m.normalizeName(r.name);
      for(const o of owned){
        const oNorm = typeof o === "string" ? _m.normalizeName(o) : _m.normalizeName(o.name || "");
        if(oNorm === reqNorm || reqNorm.includes(oNorm) || oNorm.includes(reqNorm)){
          matched_owned = typeof o === "string" ? o : (o.name || "");
          break;
        }
      }
    }

    const question =
      status === "형식확인" ? _m.makeFormatQuestion(Object.assign({}, r, { format_note: r.format_note || "" })) :
      status === "판단불가" ? _m.makeConditionalQuestion(Object.assign({}, r, { conditional_info: r.conditional_info || "" })) : "";

    rows.push({
      no: r.no,
      name: r.name,
      evidence: r.evidence || "",
      conditional: !!r.conditional,
      conditional_info: r.conditional_info || "",
      format_note: r.format_note || "",
      status,
      matched_owned,
      question,
    });
  }

  console.log(_m.mdTable(rows));
  console.log("---CSV---");
  console.log(_m.csvRows(rows));
  console.log("STATUS_COUNTS");
  const counts = { 충족:0, 미충족:0, 형식확인:0, 판단불가:0 };
  for(const r of rows){ counts[r.status] = (counts[r.status]||0) + 1; }
  console.log(JSON.stringify(counts));
}

// 1) 정상 입력
runTest("1) 정상 입력 (기대: 총7/미충족1/형식확인3/판단불가3)", [
  { no:1, name:"지원신청서", evidence:"가. 지원신청서(별지 제1호 서식) 1부", conditional:false, format_note:"지정 서식(별지 제1호 서식) 사용 여부" },
  { no:2, name:"사업자등록증명원", evidence:"나. 사업자등록증명원 사본 1부 (발급일로부터 3개월 이내의 것)", conditional:false, format_note:"발급일로부터 3개월 이내 여부" },
  { no:3, name:"대표자 신분증 사본", evidence:"다. 대표자 신분증 사본 1부", conditional:false, format_note:"보유 서류와 동일 서류인지" },
  { no:4, name:"최근 연도 부가가치세 과세표준증명원", evidence:"라. 최근 연도 부가가치세 과세표준증명원 1부", conditional:false, format_note:"" },
  { no:5, name:"4대보험 가입자명부", evidence:"마. 4대보험 가입자명부 1부. 다만 대표자 1인 기업은 제출을 생략할 수 있다.", conditional:true, format_note:"대표자 1인 기업 여부", conditional_info:"대표자 1인 기업 여부" },
  { no:6, name:"가점 대상자 증빙", evidence:"바. 가점 대상자는 해당 증빙(장애인기업확인서, 여성기업확인서 등)을 함께 제출한다.", conditional:true, format_note:"가점 대상자 해당 여부", conditional_info:"가점 대상자 해당 여부" },
  { no:7, name:"추가 요청 서류", evidence:"사. 심사 과정에서 필요시 추가 서류를 요청할 수 있다.", conditional:true, format_note:"심사 중 추가 요청 여부", conditional_info:"심사 중 추가 요청 여부" }
], [
  "지원신청서 작성 완료",
  "사업자등록증명원 (작년 3월 발급분)",
  "신분증 사본"
]);

// 2) 발급일 계산 검증 - 사업자등록증명원 issued 2026-09-01 → 충족
runTest("2) 발급일 계산 검증 (owned issued 2026-09-01 → 사업자등록증명원 충족 기대)", [
  { no:2, name:"사업자등록증명원", evidence:"나. 사업자등록증명원 사본 1부 (발급일로부터 3개월 이내의 것)", conditional:false, format_note:"발급일로부터 3개월 이내 여부" },
  { no:1, name:"지원신청서", evidence:"가. 지원신청서(별지 제1호 서식) 1부", conditional:false, format_note:"지정 서식(별지 제1호 서식) 사용 여부" },
  { no:3, name:"대표자 신분증 사본", evidence:"다. 대표자 신분증 사본 1부", conditional:false, format_note:"보유 서류와 동일 서류인지" }
], [
  { name:"사업자등록증명원", issued:"2026-09-01" },
  { name:"지원신청서" },
  { name:"신분증 사본" }
], "2026-09-10T00:00:00.000Z");

// 2-2) 발급일 계산 검증 - 사업자등록증명원 issued 2025-03-01 → 미충족
runTest("2-2) 발급일 계산 검증 (owned issued 2025-03-01 → 사업자등록증명원 미충족 기대)", [
  { no:2, name:"사업자등록증명원", evidence:"나. 사업자등록증명원 사본 1부 (발급일로부터 3개월 이내의 것)", conditional:false, format_note:"발급일로부터 3개월 이내 여부" },
  { no:1, name:"지원신청서", evidence:"가. 지원신청서(별지 제1호 서식) 1부", conditional:false, format_note:"지정 서식(별지 제1호 서식) 사용 여부" },
  { no:3, name:"대표자 신분증 사본", evidence:"다. 대표자 신분증 사본 1부", conditional:false, format_note:"보유 서류와 동일 서류인지" }
], [
  { name:"사업자등록증명원", issued:"2025-03-01" },
  { name:"지원신청서" },
  { name:"신분증 사본" }
], "2026-09-10T00:00:00.000Z");

// 3) 빈 입력
runTest("3) 빈 입력 (requirements 빈 배열)", [], []);
