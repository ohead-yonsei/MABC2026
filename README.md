# 공섭이 (missing-field-checker)

Making AI Beneficial Challenge 2026 결선 프로젝트 — 이대호
공고문과 보유 서류 목록을 대조해, 아직 준비되지 않은 제출 요건과 판단할 수 없는 조건부 요건만 원문 근거와 함께 반환합니다.

- 서비스 URL: https://mabc-2026.vercel.app/
- Vercel 프로젝트: whats-missing (prj_IOz9LcaL4A7oRDRGphu9DVeepTVx)
- GitHub: ohead-yonsei/MABC2026
- 모델: Solar Pro 4 (Upstage API)

## 기능

- 공고 원문 텍스트 붙여넣기 또는 PDF 업로드
- PDF는 클라이언트 PDF.js로 텍스트 추출 후 기존 대조 흐름에 연결
- Solar Pro 4로 공고문에서 제출 요건 추출
- 보유 서류와 대조해 요건별 상태 표시 (준비 완료 / 확인 필요 / 준비 필요)
- 로그 보기: Solar 추출 및 대조 판정 내역 확인

## 구조

- `index.html`: UI (Tailwind CSS CDN, Font Awesome 6 CDN, PDF.js CDN 포함)
- `js/app.js`: 클라이언트 로직 (PDF 처리, 대조 실행, 로그 모달, 상세 모달)
- `api/check.js`: `/api/check` — 공고 텍스트 + 보유 서류로 Solar 대조 수행
- `api/parse.js`: `/api/parse` — PDF 등 문서 파일 수신, Document Parse 호출
- `api/_match.js`: check.py 포팅, 정규화/매칭/상태 판정/표/CSV
- `api/_prompt.js`: SKILL.md 기반 프롬프트 문자열
- `api/_samples.js`: 예시 공고 텍스트

## 개발 환경

- Node.js 20.x 기준
- 의존성: `busboy ^1.0.0`
- PDF 처리는 클라이언트 측 PDF.js 사용 (서버에 pdfjs-dist 미포함)

## 빌드/배포

- `git push` 시 Vercel에 자동 배포
- 환경변수: `UPSTAGE_API_KEY` (Vercel Production + Preview)

## 현재 상태

- `/api/check`: 정상 동작 확인됨 (POST + JSON body, 200)
- `/api/parse`: multipart/form-data 수신 후 Document Parse 호출 구조. 현재 Document Parse API 키 상태에 따라 응답이 달라질 수 있음.
