// api/parse.js — PDF 등 문서 파일을 받아 Document Parse로 텍스트를 추출
//
// 요청: POST /api/parse
//  Content-Type: multipart/form-data
//  본문 필드: document (PDF/JPG/PNG/DOCX 등)
//
// 응답: { ok: true, text: string, format: string } 또는 오류 응답
//
// Document Parse 엔드포인트:
//  https://api.upstage.ai/v1/document-ai/document-parse
//  인증: Authorization: Bearer {UPSTAGE_API_KEY}
//  요청: multipart/form-data, 필드명 document

const busboyMod = require("busboy");

const ALLOWED_METHODS = new Set(["POST"]);
const MAX_FILE_BYTES = 4 * 1024 * 1024; // 4MB (Vercel 함수 본문 제한 4.5MB를 고려해 여유)

const DOCUMENT_PARSE_URL = "https://api.upstage.ai/v1/document-ai/document-parse";

module.exports = async function (req, res) {
  if (!ALLOWED_METHODS.has(req.method)) {
    return res.status(405).json({ error: "허용되지 않은 메서드입니다." });
  }

  const contentType = (req.headers && req.headers["content-type"]) || "";
  if (!contentType.toLowerCase().includes("multipart/form-data")) {
    return res.status(400).json({ error: "파일 업로드는 multipart/form-data로 전송해야 합니다." });
  }

  let fileBuffer = null;
  let fileName = null;
  let fileMime = null;
  let parseError = null;

  const busboy = busboyMod({ headers: req.headers });

  await new Promise((resolve, reject) => {
    busboy.on("file", (fieldname, file, info) => {
      if (fieldname !== "document") {
        // 파일 필드가 아니면 스킵
        file.resume();
        return;
      }

      const chunks = [];
      file.on("data", (chunk) => {
        if (fileBuffer && fileBuffer.length + chunk.length > MAX_FILE_BYTES) {
          parseError = "파일 크기가 너무 큽니다. (최대 4MB)";
          file.destroy();
          return;
        }
        chunks.push(chunk);
      });

      file.on("end", () => {
        if (parseError) return;
        fileBuffer = Buffer.concat(chunks);
        fileName = info.filename || "upload";
        fileMime = (info.mimeType || "").trim() || guessMimeFromName(fileName);
      });

      file.on("error", (err) => {
        parseError = "파일 읽기 중 오류가 발생했습니다.";
      });
    });

    busboy.on("error", (err) => {
      parseError = "요청 파싱 중 오류가 발생했습니다.";
    });

    busboy.on("finish", () => {
      resolve();
    });

    req.pipe(busboy);
  });

  if (parseError) {
    return res.status(400).json({ error: parseError });
  }

  if (!fileBuffer || !fileBuffer.length) {
    return res.status(400).json({ error: "파일이 첨부되지 않았습니다." });
  }

  const parsed = await callDocumentParse(fileBuffer, fileName, fileMime);
  if (!parsed.ok) {
    return res.status(parsed.status || 500).json({
      error: parsed.detail || "문서 파싱에 실패했습니다.",
      detail: parsed.detail,
    });
  }

  return res.status(200).json({
    ok: true,
    text: parsed.text,
    format: parsed.format,
    filename: fileName,
  });
};

// ---- Document Parse 호출 ----

async function callDocumentParse(fileBuffer, fileName, fileMime) {
  try {
    console.log('parseRuntime: node=' + process.version + ' hasFormData=' + (typeof FormData) + ' hasBlob=' + (typeof Blob));

    const apiKey = process.env.UPSTAGE_API_KEY;
    if (!apiKey) {
      return { ok: false, status: 500, detail: "UPSTAGE_API_KEY가 등록되지 않았습니다." };
    }

    if (typeof FormData !== 'function' && typeof FormData !== 'object') {
      return { ok: false, status: 500, detail: "서버 환경에서 FormData를 사용할 수 없습니다." };
    }

    const form = new FormData();
    const blob = new Blob([fileBuffer], { type: fileMime || 'application/pdf' });
    form.append('document', blob, fileName);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90000);

    try {
      const response = await fetch(DOCUMENT_PARSE_URL, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + apiKey,
        },
        body: form,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        return {
          ok: false,
          status: response.status,
          detail: "Document Parse HTTP " + response.status + (text ? " — " + text.slice(0, 500) : ''),
        };
      }

      const result = await response.json().catch(() => null);
      if (!result || typeof result !== 'object') {
        return { ok: false, status: 502, detail: "Document Parse 응답이 예상 형식이 아닙니다." };
      }

      // Document Parse 응답에서 텍스트를 찾는다. 필드명은 API 버전/파라미터에 따라 달라질 수 있다.
      let raw = result.markdown || result.html || result.text
        || result.content || result.text_content || result.result_text || ''
      || (typeof result === 'string' ? result : '');

      // result.text가 객체({html, markdown, text})로 올 수 있으므로, 그 경우 내부 텍스트를 우선 사용한다.
      if (typeof raw !== 'string' && typeof raw === 'object' && raw !== null) {
        raw = raw.markdown || raw.html || raw.text || raw.content || raw.text_content || raw.result_text || '';
      }

      // 문자열화: HTML이면 태그 벗겨 plain text로 만든다. Solar 대조/textarea 모두에 쓰기 위함이다.
      let text;
      let format = 'unknown';
      if (typeof raw === 'string') {
        text = raw;
        if (raw.trim().startsWith('<')) {
          format = 'html';
          // 간단한 HTML 태그 제거: <script>/<style> 블록은 제거, 나머지 태그는 공백으로 치환
          try {
            const tmp = raw
              .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
              .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
              .replace(/<head\b[^>]*>[\s\S]*?<\/head>/gi, '')
              .replace(/<[^>]+>/g, '\n')
              .replace(/\n[\s\r\n]+/g, '\n')
              .replace(/[\r\n]+/g, '\n')
              .trim();
            text = tmp || raw;
          } catch (e) {
            // 변환 실패해도 원본 유지
          }
        } else if (raw.trim()) {
          format = 'text';
        }
      } else {
        const keys = Array.isArray(raw) ? '[]' : Object.keys(raw).join(', ');
        return { ok: false, status: 502,
          detail: "Document Parse 응답에 추출 텍스트가 없습니다. 응답 keys: " + keys };
      }

      if (!text) {
        const keys = Array.isArray(result) ? '[]' : Object.keys(result).join(', ');
        return { ok: false, status: 502,
          detail: "Document Parse 응답에 추출 텍스트가 없습니다. 응답 keys: " + keys };
      }

      return { ok: true, text, format };
    } catch (err) {
      if (err && err.name === 'AbortError') {
        return { ok: false, status: 504, detail: "Document Parse 호출이 시간 초과되었습니다." };
      }
      return { ok: false, status: 500, detail: "Document Parse 호출 중 오류가 발생했습니다." };
    }
  } catch (outerErr) {
    console.log('parseRuntime: node=' + process.version + ' hasFormData=' + (typeof FormData) + ' hasBlob=' + (typeof Blob) + ' error=' + (outerErr && outerErr.message ? outerErr.message : (outerErr && outerErr.name ? outerErr.name : 'unknown')));
    return { ok: false, status: 500, detail: "문서 파싱 처리 중 오류가 발생했습니다." };
  }
}


// ---- helpers ----



function guessMimeFromName(name) {
  const lower = name.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (lower.endsWith(".pptx")) return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  if (lower.endsWith(".xlsx")) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  return "application/octet-stream";
}
