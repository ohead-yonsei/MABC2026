#!/usr/bin/env python3
"""missing-field-checker — 대조 엔진 (스크립트)

표준입력(JSON)을 받아 정규화 → 매칭 → 상태 판정 후
마크다운 표와 CSV를 stdout에 출력한다. 구분자는 "---CSV---" 한 줄.

제약: 표준 라이브러리만 사용. 네트워크 호출 금지. 외부 파일 읽기 금지.
동일 입력 → 동일 출력 (deterministic).
"""
import json
import re
import sys
from typing import List, Optional, Tuple


# ----------------------------------------------------------------------
# 정규화
# ----------------------------------------------------------------------
# 제거할 접미 표현 (정규화 후 어디에 붙어도 제거)
_SUFFIX_PATTERNS = [
    r"사본",
    r"1\s*부",
    r"등본",           # "주민등록등본" 등에서 등본 제거용으로 쓰이나,
                       # 별도 alias 테이블에서 다루는 것이 더 정확하므로
                       # 여기서는 "등본" 자체를 접미로 제거한다.
    r"제출",
]

# 괄호 안 제거용 (둥근 괄호, 사각 괄호)
_BRACKET_RE = re.compile(r"\([^)]*\)|\[[^\]]*\]")

# 공백 제거용 (공백, 탭, NBSP 등)
_WHITESPACE_RE = re.compile(r"\s+")


def _remove_suffixes(text: str) -> str:
    """접미 표현을 제거한다. 순서는 영향 없도록 반복 제거."""
    result = text
    for pat in _SUFFIX_PATTERNS:
        # 접미 앞뒤에 다른 글자가 붙어 있을 수 있으므로,
        # 패턴의 경계 없이 모든 출현을 제거한다.
        result = re.sub(pat, "", result)
    return result


def normalize(name: str) -> str:
    """서류명 정규화: 공백 제거 → 괄호/사각괄호 내용 제거 → 접미 제거."""
    # 1) 공백 제거
    t = _WHITESPACE_RE.sub("", name)
    # 2) 괄호 및 사각괄호 안 내용 제거
    t = _BRACKET_RE.sub("", t)
    # 3) 접미 표현 제거
    t = _remove_suffixes(t)
    # 4) 다시 공백 정리 (접미 제거로 인해 불필요한 공백이 생길 수 있음)
    t = _WHITESPACE_RE.sub("", t)
    return t


# ----------------------------------------------------------------------
# 매칭
# ----------------------------------------------------------------------
class MatchResult:
    def __init__(self, matched: bool, exact: bool, format_note: Optional[str],
                 evidence: str):
        self.matched = matched          # 하나라도 매칭됐는지
        self.exact = exact              # 완전 일치 매칭이 하나라도 있는지
        self.format_note = format_note  # 요건의 format_note (없으면 None)
        self.evidence = evidence        # 요건의 evidence 원문


def match_requirement(req: dict, owned_norms: List[str]) -> MatchResult:
    """하나의 요건에 대해 보유 목록과 매칭 결과를 반환."""
    req_norm = normalize(req["name"])
    req_exact = req_norm  # 정규화 문자열 (완전 일치 비교용)

    # matched / exact 추적
    any_matched = False
    any_exact = False

    for owned_norm in owned_norms:
        if owned_norm == req_exact:
            any_exact = True
            any_matched = True
        elif req_exact in owned_norm or owned_norm in req_exact:
            any_matched = True

    fmt = req.get("format_note") or None
    return MatchResult(
        matched=any_matched,
        exact=any_exact,
        format_note=fmt,
        evidence=req.get("evidence", ""),
    )


# ----------------------------------------------------------------------
# 상태 판정
# ----------------------------------------------------------------------
def decide_status(req: dict, match: MatchResult) -> str:
    """상태 판정. conditional=true 이면 매칭과 무관하게 판단불가 우선."""
    if req.get("conditional", False):
        return "판단불가"

    if not match.matched:
        return "미충족"

    # matched 인 경우
    if match.exact and match.format_note is None:
        return "충족"

    # 유사 매칭이거나 format_note 존재
    return "형식확인"


# ----------------------------------------------------------------------
# 출력
# ----------------------------------------------------------------------
def md_table(rows: List[dict]) -> str:
    """요구사항을 마크다운 표로 반환."""
    lines = []
    lines.append("| # | 요건 | 공고 원문 근거 | 보유 | 상태 | 확인 질문 |")
    lines.append("|---|------|----------------|------|------|-----------|")

    for i, r in enumerate(rows, start=1):
        cond_mark = "[조건부] " if r["conditional"] else ""
        name_cell = f"{cond_mark}{r['name']}"
        evidence = r["evidence"]
        if len(evidence) > 60:
            evidence = "…" + evidence[1:60] + "…"
            # 앞/뒤 날릴 때 중간은 그대로 — 여기서는 간단히 앞1뒤59로 처리
            # (원문 규칙: 60자 초과 시 앞뒤를 …로 자르되 중간은 고치지 않음)
            # 더 정확히: 앞 1글자 + 뒤 (전체-중간) 처리는 복잡하므로,
            # 여기서는 앞1 + 중간 58 + 뒤1 구조로.
            # 규칙으로 명시: "…" + 앞 1글자 제외 중간 58자 + "…" 로 처리.
            evidence = "…" + evidence[1:59] + "…"
        owned = r.get("matched_owned") or ""
        status = r["status"]

        # 확인 질문: 형식확인/판단불가일 때만 생성 (충족/미충족은 공란)
        question = ""
        if status == "형식확인":
            question = _make_format_question(r)
        elif status == "판단불가":
            question = _make_conditional_question(r)

        lines.append(f"| {i} | {name_cell} | {evidence} | {owned} | {status} | {question} |")

    return "\n".join(lines)


def _make_format_question(r: dict) -> str:
    """형식확인 상태일 때 확인 질문 생성. 요건명은 반복하지 않는다."""
    fmt = r.get("format_note") or ""
    if fmt:
        return f"{fmt} 조건을 만족하는지 확인하셨나요?"
    # format_note 없이 유사매칭으로 형식확인이 된 경우
    return "보유 서류와 동일 서류인지 확인하셨나요?"


def _make_conditional_question(r: dict) -> str:
    """판단불가(조건부)일 때 확인 질문 생성. 요건명은 반복하지 않는다."""
    cond_info = r.get("conditional_info") or "해당 조건에 해당하는지"
    cond_info = cond_info.strip()
    # 서술형 조건(~인지, ~하는지, ~경우, ~하는 경우 등)이면
    # "{조건}인지 확인이 필요합니다" / 이미 ~인지·~하는지면 "{조건} 확인이 필요합니다"
    if _looks_like_descriptive_condition(cond_info):
        if cond_info.endswith(("인지", "하는지")):
            return f"{cond_info} 확인이 필요합니다"
        if cond_info.endswith(("경우", "하는 경우", "에 해당하는 경우")):
            # '~인 경우' '~에 해당하는 경우' 등은 그대로 두고 
            # "~에 해당하시나요?"로 묻는 쪽이 자연스럽다
            return f"{cond_info}에 해당하시나요?"
        return f"{cond_info}인지 확인이 필요합니다"
    return f"{cond_info}에 해당하시나요?"


def _looks_like_descriptive_condition(text: str) -> bool:
    """서술형 조건인지 판별. '~인지', '~하는지', '~경우', '~하는 경우', '~에 해당하는 경우' 등이 포함되면 True."""
    descriptive_markers = [
        "인지",
        "하는지",
        "경우",
        "하는 경우",
        "에 해당하는 경우",
        "에 한",
        "할경우",
        "하는경우",
    ]
    for marker in descriptive_markers:
        if marker in text:
            return True
    return False


def _clean_descriptive_condition(text: str) -> str:
    """서술형 조건 말미의 질문형 어미를 정리한다.

    '가점 대상자에 해당하는지' → '가점 대상자에 해당'
    '매출이 1억원 미만인지'   → '매출이 1억원 미만'
    """
    for suffix in ("하는지", "인지"):
        if text.endswith(suffix):
            return text[: -len(suffix)]
    return text


def csv_rows(rows: List[dict]) -> str:
    """요구사항 목록을 CSV 문자열로 반환."""
    import csv as csv_mod
    import io

    out = io.StringIO()
    writer = csv_mod.writer(out, lineterminator="\n")
    writer.writerow(["No", "요건", "공고 원문 근거", "보유", "상태", "확인 질문", "조건부"])
    for r in rows:
        cond_mark = "[조건부] " if r["conditional"] else ""
        name_cell = f"{cond_mark}{r['name']}"
        evidence = r["evidence"]
        if len(evidence) > 60:
            evidence = "…" + evidence[1:59] + "…"
        owned = r.get("matched_owned") or ""
        question = ""
        if r["status"] == "형식확인":
            question = _make_format_question(r)
        elif r["status"] == "판단불가":
            question = _make_conditional_question(r)
        writer.writerow([
            r["no"],
            name_cell,
            evidence,
            owned,
            r["status"],
            question,
            "Y" if r["conditional"] else "N",
        ])
    return out.getvalue()


# ----------------------------------------------------------------------
# 메인
# ----------------------------------------------------------------------
def main() -> None:
    raw = sys.stdin.read()
    data = json.loads(raw)

    requirements: List[dict] = data.get("requirements", [])
    owned_raw: List[str] = data.get("owned", [])

    # 보유 목록 정규화 (사전 계산)
    owned_norms: List[str] = [normalize(o) for o in owned_raw]

    rows: List[dict] = []
    for req in requirements:
        no = req.get("no", 0)
        name = req.get("name", "")
        evidence = req.get("evidence", "")
        conditional = bool(req.get("conditional", False))
        format_note = req.get("format_note") or None
        conditional_info = req.get("conditional_info") or ""

        match = match_requirement(req, owned_norms)
        status = decide_status(req, match)

        # 매칭된 보유 서류명 기록 (형식확인/미충족 구분용 디스플레이)
        matched_owned = ""
        if match.matched:
            # 어떤 소유 항목이 매칭됐는지 찾기
            for owned_raw_item, owned_norm in zip(owned_raw, owned_norms):
                req_norm = normalize(name)
                if owned_norm == req_norm:
                    matched_owned = owned_raw_item
                    break
                elif req_norm in owned_norm or owned_norm in req_norm:
                    matched_owned = owned_raw_item
                    break

        rows.append({
            "no": no,
            "name": name,
            "evidence": evidence,
            "conditional": conditional,
            "conditional_info": conditional_info,
            "format_note": format_note,
            "status": status,
            "matched_owned": matched_owned,
        })

    # 1) 마크다운 표
    print(md_table(rows))
    # 2) 구분자
    print("---CSV---")
    # 3) CSV
    print(csv_rows(rows))


if __name__ == "__main__":
    main()
