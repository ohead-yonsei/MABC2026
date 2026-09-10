// api/check.js — 진입점 1개 (CJS)
// Solar 호출 → JSON 파싱 → _match.js 판정 → 응답
// Solar 호출이 실패하면 결과를 지어내지 않고 오류를 반환한다.

const _prompt = require("./_prompt.js");
const _match = require("./_match.js");
const { mdTable, csvRows, normalizeName, normalizeOwnedItem, makeFormatQuestion, makeConditionalQuestion } = _match;
const _samples = require("./_samples.js");

const HAS_DOCS_TERM = /(제출|서류|신청서|증명|사업자등록|부가가치세|과세표준|4대보험|가입자명부|신분증|가점|추가\s*서류|제출\s*서류|제출서류)/i;

module.exports = async function (req, res) {
  let body;
  try {
    body = await req.json();
  } catch (err) {
    return res.status(400).json({ error: "잘못된 요청 본문입니다." });
  }

  const text = (body.text || "").trim();
  const owned = Array.isArray(body.owned) ? body.owned : [];

  if (!text) {
    return res.status(200).json({ notice: "공고문을 붙여넣어 주세요." });
  }

  
  const solarResult = await callSolar(text, owned);

  if (!solarResult.ok) {
    return res.status(500).json({
      error: "대조 엔진 호출 결과를 읽을 수 없습니다. 결과를 추정하지 않습니다.",
      detail: solarResult.detail,
    });
  }

  const reqs = solarResult.requirements || [];
  if (!reqs.length) {
    return res.status(200).json({
      summary: "대조 결과 — 제출 요건 미기재",
      rows: [],
      actionLines: { prepare: ["제출 요건 미기재"], check: ["없음"], deadline: "없음" },
    });
  }

  // ---- 보유 목록을 정규화 ----
  const rows = matchRows(reqs, owned);

  // ---- 요약 + 표 + 다음 행동 ----
  const summary = buildSummary(rows);
  const table = mdTable(rows);
  const actionLines = buildActionLines(rows);

  return res.status(200).json({
    summary,
    table,
    actionLines,
    rows,
    disclaimer: "이 결과는 공고 원문 대조 결과이며 자격 판정이 아닙니다. 최종 확인은 주관기관 공고와 담당 부서를 따르십시오.",
  });
};

// ---- helpers ----

function normalizeOwned(item) {
  return normalizeOwnedItem(item);
}

function matchRows(reqs, ownedOriginal) {
  const rows = [];
  for (const r of reqs) {
    const match = _match.matchRequirement({ name: r.name, evidence: r.evidence, format_note: r.format_note || "", conditional: !!r.conditional }, ownedOriginal);
    let status = _match.decideStatus({ conditional: !!r.conditional, format_note: r.format_note || "" }, match);

    // 발급일 계산 추가
    if (status === "형식확인") {
      const ownedItem = findOwnedItem(reqs, r, ownedOriginal); // 팔로우할 때 required로 붙일 것
      if (ownedItem && ownedItem.issued) {
        const nowISO = new Date().toISOString();
        const ok = _match.evaluateDateCondition({ format_note: r.format_note || "" }, ownedItem, nowISO);
        if (ok === true) status = "충족";
        else if (ok === false) status = "미충족";
      }
    }

    let matched_owned = "";
    if (match.matched) {
      const reqNorm = normalizeName(r.name);
      for (let i = 0; i < ownedOriginal.length; i++) {
        const oNorm = normalizeOwned(ownedOriginal[i]);
        if (oNorm === reqNorm || reqNorm.includes(oNorm) || oNorm.includes(reqNorm)) {
          matched_owned = String(ownedOriginal[i].name || ownedOriginal[i]);
          break;
        }
      }
    }

    rows.push({
      no: r.no,
      name: r.name,
      evidence: r.evidence || "",
      conditional: !!r.conditional,
      conditional_info: r.conditional_info || "",
      format_note: (r.format_note || ""),
      status,
      matched_owned,
    });
  }
  return rows;
}

function findOwnedItem(reqs, req, ownedOriginal) {
  const reqNorm = normalizeName(req.name);
  for (let i = 0; i < ownedOriginal.length; i++) {
    const oNorm = normalizeOwned(ownedOriginal[i]);
    if (oNorm === reqNorm || reqNorm.includes(oNorm) || oNorm.includes(reqNorm)) {
      return ownedOriginal[i];
    }
  }
  return null;
}

function buildSummary(rows) {
  const total = rows.length;
  const lacking = rows.filter((r) => r.status === "미충족").length;
  const formatCheck = rows.filter((r) => r.status === "형식확인").length;
  const cannotDecide = rows.filter((r) => r.status === "판단불가").length;
  return `대조 결과 — 총 ${total}건 중 미충족 ${lacking}건 / 형식확인 ${formatCheck}건 / 판단불가 ${cannotDecide}건`;
}

function buildActionLines(rows) {
  const prepare = rows.filter((r) => r.status === "미충족").map((r) => r.name);
  const check = [];
  for (const r of rows) {
    if (r.status === "형식확인") {
      check.push(makeFormatQuestion(r));
    } else if (r.status === "판단불가") {
      check.push(makeConditionalQuestion(r));
    }
  }
  return {
    prepare: prepare.length ? prepare : ["없음"],
    check: check.length ? check : ["없음"],
    deadline: "없음",
  };
}

async function callSolar(text, owned) {
  // 실제 Solar 호출부. 값을 길이·속도 때문에 추정하지 않음.
  // 프로덕션에서는 여기 Vercel/secrets 접근 전에 UPSTAGE_API_KEY가 등록되어 있어야 한다.
  const apiKey = process.env.UPSTAGE_API_KEY;
  if (!apiKey) {
    return { ok: false, detail: "UPSTAGE_API_KEY가 등록되지 않았습니다." };
  }

  const system = _prompt;
  const user = [
    "다음 inputs를 그대로 전달한다.",
    "",
    "INPUTS:",
    "- 공고 원문:\n" + text,
    "- 보유 서류 목록:\n" + owned.map((o) => "- " + (o.name || o)).join("\n"),
    "",
    "출력은 다음 JSON만 반환한다. 다른 텍스트는 일절 넣지 않는다.",
    '{"requirements":[{"no":1,"name":"","evidence":"","conditional":false,"format_note":"","conditional_info":""}]}',
  ].join("\n");

  try {
    const res = await fetch("https://api.upstage.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + apiKey,
      },
      body: JSON.stringify({
        model: "solar-pro4",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
        temperature: 0,
        max_tokens: 4096,
      }),
    });

    if (!res.ok) {
      return { ok: false, detail: "Solar 호출 HTTP " + res.status };
    }

    const json = await res.json();
    const content = extractTextFromChoice(json);
    if (!content) {
      return { ok: false, detail: "Solar 응답에서 텍스트를 읽을 수 없습니다." };
    }

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (err) {
      return { ok: false, detail: "Solar 응답이 요구 JSON 형식이 아닙니다." };
    }

    if (!parsed || !Array.isArray(parsed.requirements)) {
      return { ok: false, detail: "Solar 응답이 요구 JSON 형식이 아닙니다." };
    }

    return { ok: true, requirements: parsed.requirements };
  } catch (err) {
    return { ok: false, detail: "Solar 호출 중 오류가 발생했습니다." };
  }
}

function extractTextFromChoice(json) {
  try {
    const choice = json.choices && json.choices[0];
    if (!choice) return null;
    if (choice.message && typeof choice.message.content === "string") return choice.message.content;
    if (Array.isArray(choice.message && choice.message.content)) {
      for (const part of choice.message.content) {
        if (typeof part.text === "string") return part.text;
      }
    }
    if (typeof choice.text === "string") return choice.text;
  } catch (err) {
    // 인식 불가
  }
  return null;
}
