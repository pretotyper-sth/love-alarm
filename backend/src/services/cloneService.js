/**
 * AI 클론 생성 서비스
 *
 * 인스타그램 공개 프로필 데이터를 기반으로 성격을 분석하고
 * LLM 시스템 프롬프트(클론 페르소나)를 생성한다.
 *
 * 비용: Groq/Gemini 무료 티어 사용 → 고정비용 0원
 */

import { callLLMJson } from './llmProvider.js';

/**
 * 인스타그램 공개 프로필에서 분석 가능한 데이터를 수집한다.
 * 실제 구현에서는 Apify, Instaloader 등 크롤링 서비스를 사용한다.
 * 여기서는 Instagram Basic Display API 또는 크롤링 결과를 받는 구조로 설계.
 */
export async function fetchInstagramProfile(instagramId) {
  // TODO: 실제 크롤링 서비스 연동 (Apify Actor, Brightdata 등)
  // 현재는 인증된 사용자의 ID만 사용하므로, 최소한의 프로필 정보로 진행
  try {
    const response = await fetch(
      `https://www.instagram.com/api/v1/users/web_profile_info/?username=${instagramId}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
          'X-IG-App-ID': '936619743392459',
        },
      }
    );

    if (!response.ok) {
      return buildFallbackProfile(instagramId);
    }

    const data = await response.json();
    const user = data?.data?.user;

    if (!user) {
      return buildFallbackProfile(instagramId);
    }

    return {
      username: user.username,
      fullName: user.full_name || '',
      biography: user.biography || '',
      followerCount: user.edge_followed_by?.count || 0,
      followingCount: user.edge_follow?.count || 0,
      postCount: user.edge_owner_to_timeline_media?.count || 0,
      isPrivate: user.is_private,
      profilePicUrl: user.profile_pic_url_hd || user.profile_pic_url,
      recentCaptions: extractRecentCaptions(user),
    };
  } catch {
    return buildFallbackProfile(instagramId);
  }
}

function buildFallbackProfile(instagramId) {
  return {
    username: instagramId,
    fullName: '',
    biography: '',
    followerCount: 0,
    followingCount: 0,
    postCount: 0,
    isPrivate: false,
    profilePicUrl: null,
    recentCaptions: [],
  };
}

function extractRecentCaptions(user) {
  const edges = user.edge_owner_to_timeline_media?.edges || [];
  return edges
    .slice(0, 12)
    .map((e) => e.node?.edge_media_to_caption?.edges?.[0]?.node?.text)
    .filter(Boolean);
}

/**
 * 인스타그램 프로필 데이터를 기반으로 성격 분석(Big Five + 대화 스타일)을 수행한다.
 * Groq/Gemini 무료 티어로 비용 0원 운영.
 */
export async function analyzePersonality(profileData, userInputs = {}) {
  const prompt = buildAnalysisPrompt(profileData, userInputs);

  const systemPrompt = `너는 심리분석 전문 AI다. Big Five 성격 모델과 Gottman 관계 이론을 기반으로 
SNS 프로필과 게시물을 분석해서 성격 프로파일을 생성한다.
반드시 JSON으로만 응답하라. 다른 텍스트는 포함하지 마라.`;

  try {
    const result = await callLLMJson(systemPrompt, prompt, {
      temperature: 0.7,
      maxTokens: 1500,
    });

    if (!result) {
      return buildDefaultPersonality(profileData, userInputs);
    }

    return {
      bigFive: result.bigFive || defaultBigFive(),
      communicationStyle: result.communicationStyle || {},
      emotionalPatterns: result.emotionalPatterns || {},
      interests: result.interests || [],
      conversationTopics: result.conversationTopics || [],
      toneDescription: result.toneDescription || '친근하고 자연스러운 말투',
    };
  } catch (error) {
    console.error('Personality analysis failed:', error.message);
    return buildDefaultPersonality(profileData, userInputs);
  }
}

function buildAnalysisPrompt(profileData, userInputs) {
  const parts = [
    `## 인스타그램 프로필 분석 요청`,
    `- 사용자명: @${profileData.username}`,
  ];

  if (profileData.fullName) parts.push(`- 이름: ${profileData.fullName}`);
  if (profileData.biography) parts.push(`- 바이오: ${profileData.biography}`);
  if (profileData.postCount) parts.push(`- 게시물 수: ${profileData.postCount}`);
  if (profileData.followerCount) parts.push(`- 팔로워: ${profileData.followerCount}`);

  if (profileData.recentCaptions?.length > 0) {
    parts.push(`\n## 최근 게시물 캡션 (최대 12개):`);
    profileData.recentCaptions.forEach((caption, i) => {
      parts.push(`${i + 1}. "${caption.slice(0, 200)}"`);
    });
  }

  if (userInputs.gender) parts.push(`\n- 성별: ${userInputs.gender}`);
  if (userInputs.selfDescription) {
    parts.push(`- 자기소개: ${userInputs.selfDescription}`);
  }

  parts.push(`
## 응답 형식 (JSON):
{
  "bigFive": {
    "openness": 0-100,
    "conscientiousness": 0-100,
    "extraversion": 0-100,
    "agreeableness": 0-100,
    "neuroticism": 0-100
  },
  "communicationStyle": {
    "formality": "casual|neutral|formal",
    "humor": "low|medium|high",
    "emotionExpression": "reserved|moderate|expressive",
    "responseLength": "short|medium|long",
    "emojiUsage": "none|occasional|frequent"
  },
  "emotionalPatterns": {
    "attachmentStyle": "secure|anxious|avoidant|disorganized",
    "conflictStyle": "collaborative|compromising|avoiding|competing",
    "loveLanguage": "words|acts|gifts|time|touch"
  },
  "interests": ["관심사1", "관심사2", ...],
  "conversationTopics": ["대화 주제1", "주제2", ...],
  "toneDescription": "이 사람의 대화 말투를 한 문장으로 설명"
}`);

  return parts.join('\n');
}

function defaultBigFive() {
  return {
    openness: 60,
    conscientiousness: 55,
    extraversion: 50,
    agreeableness: 65,
    neuroticism: 40,
  };
}

function buildDefaultPersonality(profileData, userInputs) {
  return {
    bigFive: defaultBigFive(),
    communicationStyle: {
      formality: 'casual',
      humor: 'medium',
      emotionExpression: 'moderate',
      responseLength: 'medium',
      emojiUsage: 'occasional',
    },
    emotionalPatterns: {
      attachmentStyle: 'secure',
      conflictStyle: 'collaborative',
      loveLanguage: 'words',
    },
    interests: [],
    conversationTopics: ['일상', '취미', '여행', '음식'],
    toneDescription: '친근하고 자연스러운 말투',
  };
}

/**
 * 성격 분석 결과를 기반으로 클론의 LLM 시스템 프롬프트를 생성한다.
 */
export function generateClonePrompt(personalityData, profileData) {
  const { bigFive, communicationStyle, emotionalPatterns, interests, toneDescription } =
    personalityData;

  const formalityMap = {
    casual: '반말 섞인 편한 말투',
    neutral: '보통 말투 (존댓말 기본)',
    formal: '정중한 존댓말',
  };

  const humorMap = {
    low: '진지한 편',
    medium: '적절히 유머를 섞음',
    high: '유머 감각이 좋고 재미있게 말함',
  };

  const emojiMap = {
    none: '이모지를 거의 쓰지 않음',
    occasional: '이모지를 가끔 씀',
    frequent: '이모지를 자주 씀',
  };

  const lengthMap = {
    short: '짧고 간결하게 답함 (1~2문장)',
    medium: '적당한 길이로 답함 (2~3문장)',
    long: '길고 상세하게 답함 (3문장 이상)',
  };

  const lines = [
    `너는 인스타그램 사용자 @${profileData.username}의 AI 클론이다.`,
    `이 사람처럼 대화해야 한다.`,
    ``,
    `## 성격 특성 (Big Five)`,
    `- 개방성: ${bigFive.openness}/100 (${bigFive.openness > 60 ? '새로운 경험에 열려있음' : '익숙한 것을 선호'})`,
    `- 성실성: ${bigFive.conscientiousness}/100`,
    `- 외향성: ${bigFive.extraversion}/100 (${bigFive.extraversion > 60 ? '사교적이고 활발함' : '조용하고 내성적인 편'})`,
    `- 친화성: ${bigFive.agreeableness}/100`,
    `- 신경성: ${bigFive.neuroticism}/100`,
    ``,
    `## 대화 스타일`,
    `- 말투: ${toneDescription}`,
    `- 격식: ${formalityMap[communicationStyle.formality] || '보통'}`,
    `- 유머: ${humorMap[communicationStyle.humor] || '적절히'}`,
    `- 이모지: ${emojiMap[communicationStyle.emojiUsage] || '가끔'}`,
    `- 답변 길이: ${lengthMap[communicationStyle.responseLength] || '적당히'}`,
    ``,
    `## 감정 패턴`,
    `- 애착 유형: ${emotionalPatterns.attachmentStyle || 'secure'}`,
    `- 갈등 스타일: ${emotionalPatterns.conflictStyle || 'collaborative'}`,
    `- 사랑의 언어: ${emotionalPatterns.loveLanguage || 'words'}`,
  ];

  if (interests?.length > 0) {
    lines.push(``, `## 관심사`, `${interests.join(', ')}`);
  }

  if (profileData.biography) {
    lines.push(``, `## 바이오`, `"${profileData.biography}"`);
  }

  lines.push(
    ``,
    `## 규칙`,
    `- 자연스러운 한국어로 대화할 것`,
    `- 위 성격과 말투를 일관되게 유지할 것`,
    `- 상대방의 말에 적극적으로 반응하고 질문도 할 것`,
    `- 너무 길거나 너무 짧지 않게, 자연스러운 대화 흐름을 유지할 것`,
    `- 실제 사람처럼 불완전한 문장, 추임새, 감탄사도 자연스럽게 사용할 것`
  );

  return lines.join('\n');
}

/**
 * AI 클론 생성 전체 파이프라인
 */
export async function createClone(prisma, userId, instagramId, userInputs = {}) {
  const existing = await prisma.aiClone.findUnique({ where: { userId } });
  if (existing) {
    throw new Error('이미 클론이 존재합니다. 기존 클론을 삭제하고 다시 생성해 주세요.');
  }

  const profileData = await fetchInstagramProfile(instagramId);

  if (profileData.isPrivate) {
    throw new Error('비공개 계정은 클론을 생성할 수 없어요. 계정을 공개로 전환해 주세요.');
  }

  const personalityData = await analyzePersonality(profileData, userInputs);
  const clonePrompt = generateClonePrompt(personalityData, profileData);

  const clone = await prisma.aiClone.create({
    data: {
      userId,
      instagramId,
      personalityData,
      clonePrompt,
      gender: userInputs.gender || null,
      interestedIn: userInputs.interestedIn || null,
      allowMatching: userInputs.allowMatching ?? false,
      status: 'active',
    },
  });

  return clone;
}

/**
 * AI 클론 업데이트 (설정 변경)
 */
export async function updateClone(prisma, userId, updates) {
  const allowed = ['allowMatching', 'gender', 'interestedIn', 'status'];
  const data = {};
  for (const key of allowed) {
    if (updates[key] !== undefined) data[key] = updates[key];
  }

  return prisma.aiClone.update({
    where: { userId },
    data,
  });
}

/**
 * AI 클론 삭제 (cascade로 대화도 함께 삭제됨)
 */
export async function deleteClone(prisma, userId) {
  return prisma.aiClone.delete({ where: { userId } });
}
