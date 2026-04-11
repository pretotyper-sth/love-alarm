/**
 * LLM Provider 추상화 레이어
 *
 * 고정비용 0원 운영을 위해 무료 티어 API를 우선 사용한다.
 * 우선순위: Groq (무료, 초고속) → Gemini (무료) → OpenAI (유료 폴백)
 *
 * 무료 티어 사양 (2026년 기준):
 * - Groq:    llama-3.1-8b-instant, 14,400 RPD, 500K TPD (카드 불필요)
 * - Gemini:  gemini-2.5-flash-lite, 1,000 RPD, 250K TPM (카드 불필요)
 * - OpenAI:  gpt-4o-mini, 유료 (폴백용)
 *
 * 환경변수:
 * - GROQ_API_KEY:    Groq 무료 API 키 (console.groq.com)
 * - GEMINI_API_KEY:  Google AI Studio 무료 API 키 (aistudio.google.com)
 * - OPENAI_API_KEY:  OpenAI 유료 API 키 (옵션)
 * - LLM_PROVIDER:    강제 지정 (groq | gemini | openai), 미설정 시 자동 선택
 */

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const FORCE_PROVIDER = process.env.LLM_PROVIDER;

function getProvider() {
  if (FORCE_PROVIDER) return FORCE_PROVIDER;
  if (GROQ_API_KEY) return 'groq';
  if (GEMINI_API_KEY) return 'gemini';
  if (OPENAI_API_KEY) return 'openai';
  return null;
}

/**
 * Groq API 호출 (무료, 초고속 ~100ms)
 * llama-3.1-8b-instant: 14,400 RPD, 500K TPD
 */
async function callGroq(systemPrompt, userPrompt, options = {}) {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: options.model || 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 2000,
      response_format: options.jsonMode ? { type: 'json_object' } : undefined,
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`Groq API error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

/**
 * Google Gemini API 호출 (무료, 1,000 RPD)
 * gemini-2.5-flash-lite: 15 RPM, 1,000 RPD
 */
async function callGemini(systemPrompt, userPrompt, options = {}) {
  const model = options.model || 'gemini-2.5-flash-lite';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

  const body = {
    contents: [{ parts: [{ text: userPrompt }] }],
    systemInstruction: { parts: [{ text: systemPrompt }] },
    generationConfig: {
      temperature: options.temperature ?? 0.7,
      maxOutputTokens: options.maxTokens ?? 2000,
    },
  };

  if (options.jsonMode) {
    body.generationConfig.responseMimeType = 'application/json';
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`Gemini API error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

/**
 * OpenAI API 호출 (유료 폴백)
 */
async function callOpenAI(systemPrompt, userPrompt, options = {}) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: options.model || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 2000,
      response_format: options.jsonMode ? { type: 'json_object' } : undefined,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

/**
 * 통합 LLM 호출 함수
 *
 * @param {string} systemPrompt - 시스템 프롬프트
 * @param {string} userPrompt - 사용자 프롬프트
 * @param {object} options - { temperature, maxTokens, jsonMode, model }
 * @returns {string} LLM 응답 텍스트
 * @throws {Error} 모든 provider 실패 시 또는 키 없을 때
 */
export async function callLLM(systemPrompt, userPrompt, options = {}) {
  const provider = getProvider();

  if (!provider) {
    return null; // 키 없음 → 호출자가 폴백 처리
  }

  const providers = {
    groq: callGroq,
    gemini: callGemini,
    openai: callOpenAI,
  };

  // 지정된 provider 시도
  try {
    return await providers[provider](systemPrompt, userPrompt, options);
  } catch (error) {
    console.warn(`[LLM] ${provider} failed: ${error.message}`);
  }

  // 실패 시 다른 무료 provider로 폴백
  const fallbackOrder = ['groq', 'gemini', 'openai'].filter(
    (p) => p !== provider
  );
  const keyMap = { groq: GROQ_API_KEY, gemini: GEMINI_API_KEY, openai: OPENAI_API_KEY };

  for (const fb of fallbackOrder) {
    if (!keyMap[fb]) continue;
    try {
      console.log(`[LLM] Falling back to ${fb}`);
      return await providers[fb](systemPrompt, userPrompt, options);
    } catch (err) {
      console.warn(`[LLM] ${fb} fallback failed: ${err.message}`);
    }
  }

  return null; // 모든 provider 실패
}

/**
 * JSON 응답을 파싱하는 헬퍼
 */
export async function callLLMJson(systemPrompt, userPrompt, options = {}) {
  const raw = await callLLM(systemPrompt, userPrompt, {
    ...options,
    jsonMode: true,
  });

  if (!raw) return null;

  try {
    // Gemini가 가끔 ```json ... ``` 형태로 감싸서 반환함
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
    return JSON.parse(cleaned);
  } catch {
    console.warn('[LLM] JSON parse failed, trying relaxed parse');
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try { return JSON.parse(jsonMatch[0]); } catch { /* */ }
    }
    const arrMatch = raw.match(/\[[\s\S]*\]/);
    if (arrMatch) {
      try { return JSON.parse(arrMatch[0]); } catch { /* */ }
    }
    return null;
  }
}

/**
 * 현재 활성 provider 정보 (디버그/로깅용)
 */
export function getActiveProvider() {
  return getProvider() || 'none (mock mode)';
}
