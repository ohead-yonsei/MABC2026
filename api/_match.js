// check.py 포팅: 정규화 → 매칭 → 상태 판정 → 표/CSV 조립
// 로직을 개선하거나 단순화하지 않음. 같은 입력에 같은 출력이어야 함.

const RE_BRACKET = /[{(][^)}]*[)}]/g;
const SUFFIX_PATTERNS = [/사본/g, /1\s*부/g, /등본/g, /제출/g];

function normalizeName(name) {
  let t = name.replace(/\s+/g, "");
  t = t.replace(RE_BRACKET, "");
  for (const pat of SUFFIX_PATTERNS) {
    t = t.replace(pat, "");
  }
  t = t.replace(/\s+/g, "");
  return t;
}

function normalizeOwnedItem(item) {
  const name = typeof item === "string" ? item : (item && item.name ? item.name : "");
  return normalizeName(String(name).trim());
}

function matchRequirement(req, owned) {
  const reqNorm = normalizeName(req.name);
  const ownedNorms = owned.map(normalizeOwnedItem);
  let anyMatched = false;
  let anyExact = false;
  for (const ownedNorm of ownedNorms) {
    if (ownedNorm === reqNorm) {
      anyExact = true;
      anyMatched = true;
    } else if (reqNorm.includes(ownedNorm) || ownedNorm.includes(reqNorm)) {
      anyMatched = true;
    }
  }
  const fmt = req.format_note || null;
  return { matched: anyMatched, exact: anyExact, formatNote: fmt };
}

function decideStatus(req, match) {
  if (req.conditional) return "판단불가";
  if (!match.matched) return "미충족";
  if (match.exact && !match.formatNote) return "충족";
  return "형식확인";
}

function makeFormatQuestion(r) {
  const fmt = r.format_note || "";
  if (fmt) return `${fmt} 조건을 만족하는지 확인하셨나요?`;
  return "보유 서류와 동일 서류인지 확인하셨나요?";
}

function makeConditionalQuestion(r) {
  const condInfo = (r.conditional_info || "해당 조건에 해당하는지").trim();
  if (/인지|하는지|경우|하는 경우|에 해당하는 경우|에 한|할경우|하는경우/.test(condInfo)) {
    if (condInfo.endsWith("인지") || condInfo.endsWith("하는지")) {
      return `${condInfo} 확인이 필요합니다`;
    }
    if (condInfo.endsWith("경우") || condInfo.endsWith("하는 경우") || condInfo.endsWith("에 해당하는 경우")) {
      return `${condInfo}에 해당하시나요?`;
    }
    return `${condInfo}인지 확인이 필요합니다`;
  }
  return `${condInfo}에 해당하시나요?`;
}

function mdTable(rows) {
  const lines = [];
  lines.push("| # | 요건 | 공고 원문 근거 | 보유 | 상태 | 확인 질문 |");
  lines.push("|---|------|----------------|------|------|-----------|");
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const condMark = r.conditional ? "[조건부] " : "";
    const nameCell = `${condMark}${r.name}`;
    let evidence = r.evidence;
    if (evidence && evidence.length > 60) {
      evidence = "…" + evidence.slice(1, 59) + "…";
    }
    const owned = r.matched_owned || "";
    const status = r.status;
    const question =
      status === "형식확인" ? makeFormatQuestion(r) :
      status === "판단불가" ? makeConditionalQuestion(r) : "";
    lines.push(`| ${i+1} | ${nameCell} | ${evidence} | ${owned} | ${status} | ${question} |`);
  }
  return lines.join("\n");
}

function csvRows(rows) {
  const header = ["No","요건","공고 원문 근거","보유","상태","확인 질문","조건부"];
  const out = [header.join(",")];
  for (const r of rows) {
    const condMark = r.conditional ? "[조건부] " : "";
    const nameCell = `${condMark}${r.name}`;
    let evidence = r.evidence;
    if (evidence && evidence.length > 60) {
      evidence = "…" + evidence.slice(1, 59) + "…";
    }
    const owned = r.matched_owned || "";
    const question =
      r.status === "형식확인" ? makeFormatQuestion(r) :
      r.status === "판단불가" ? makeConditionalQuestion(r) : "";
    out.push([
      r.no,
      nameCell,
      evidence,
      owned,
      r.status,
      question,
      r.conditional ? "Y" : "N",
    ].join(","));
  }
  return out.join("\n") + "\n";
}

/**
 * 발급일 계산: 보유한 발급일(issued)이 있으면
 * format_note에 "발급일로부터 3개월 이내"가 있을 때 기준일 기준으로 판정.
 *
 * 기준일은 services의 서버 시각을 쓰는 것이 원칙이나,
 * 이번 MVP에서는 클라이언트/서버 공통 기준이 없으므로
 * 호출 시 넘겨받은 nowISO를 기준으로 계산한다. (값 추정 금지)
 */
function parseISO(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

function addMonths(d, months) {
  const r = new Date(d.getTime());
  r.setMonth(r.getMonth() + months);
  return r;
}

function evaluateDateCondition(req, ownedItem, nowISO) {
  if (!req.format_note) return null;
  const note = req.format_note;
  if (!/발급일로부터\s*3\s*개월/i.test(note)) return null;

  const issued = (ownedItem && ownedItem.issued) ? parseISO(ownedItem.issued) : null;
  if (!issued) return null;

  const now = parseISO(nowISO);
  if (!now) return null;

  const due = addMonths(issued, 3);
  return due >= now;
}

module.exports = {
  normalizeName,
  normalizeOwnedItem,
  matchRequirement,
  decideStatus,
  makeFormatQuestion,
  makeConditionalQuestion,
  mdTable,
  csvRows,
  parseISO,
  addMonths,
  evaluateDateCondition,
};
