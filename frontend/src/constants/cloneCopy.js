export const CLONE_COPY = {
  intro: {
    headline: '이 사람이랑\n대화하면 어떨까?',
    subheadline: 'AI가 두 사람의 첫 대화를 미리 시뮬레이션해요.',
    cta: '내 클론 만들기',
    ctaSecondary: '이미 클론을 만들었어요',
  },

  howItWorks: {
    title: '어떻게 작동하나요?',
    steps: [
      {
        number: '01',
        title: '인스타 인증으로 나를 분석',
        description:
          '공개된 프로필, 말투, 관심사를 읽어\n당신만의 대화 스타일을 파악해요.',
      },
      {
        number: '02',
        title: 'AI가 나의 클론을 생성',
        description:
          '말투, 감정 패턴, 반응 속도까지\n나를 닮은 AI가 만들어져요.',
      },
      {
        number: '03',
        title: '클론끼리 대화를 나눠요',
        description:
          '실제 두 사람이라면 어떤 대화가\n오갈지, AI가 시뮬레이션해요.',
      },
    ],
  },

  trust: {
    title: '어떻게 가능한 거지?',
    description:
      '관계 심리학 30년 연구를 학습한 AI가\n성격, 대화 패턴, 감정 역학을 분석해요.',
    badges: [
      '성격 분석 엔진',
      '대화 패턴 학습',
      '감정 역학 시뮬레이션',
    ],
  },

  safety: {
    title: '안전하게 설계했어요',
    points: [
      {
        icon: 'shield',
        text: '인스타 인증된 본인만 클론 생성 가능',
      },
      {
        icon: 'lock',
        text: '양쪽 모두 동의해야 대화 시뮬레이션 시작',
      },
      {
        icon: 'eye-off',
        text: '상대 프로필은 호감 표시 후에만 공개',
      },
      {
        icon: 'trash',
        text: '언제든 클론 삭제 및 대화 기록 삭제 가능',
      },
    ],
  },

  pricing: {
    cloneCreation: {
      label: '클론 생성',
      price: '무료',
      description: '인스타 인증만 하면 바로 시작',
    },
    conversationView: {
      label: '케미 시뮬레이션 결과 조회',
      price: '1,900원',
      description: '대화 전문 + 케미 리포트',
    },
    alarmPreview: {
      label: '알람 추가 전 미리보기',
      price: '990원',
      description: '이 사람과의 케미를 먼저 확인',
    },
  },

  alarmPreviewSheet: {
    title: '이 사람과의 케미를\n미리 볼 수 있어요',
    description:
      '상대가 AI 클론을 등록했어요.\n알람을 보내기 전에 대화 시뮬레이션을 확인해 보세요.',
    ctaPrimary: '미리보기 (990원)',
    ctaSecondary: '건너뛰기',
  },

  cloneManagement: {
    createTitle: 'AI 클론 만들기',
    createDescription: '인스타그램 프로필을 분석해서\n나를 닮은 AI를 만들어요.',
    genderLabel: '성별',
    genderOptions: [
      { value: 'male', label: '남성' },
      { value: 'female', label: '여성' },
      { value: 'other', label: '기타' },
    ],
    interestedInLabel: '관심 있는 성별',
    interestedInOptions: [
      { value: 'male', label: '남성' },
      { value: 'female', label: '여성' },
      { value: 'all', label: '모두' },
    ],
    allowMatchingLabel: '다른 사용자와의 AI 대화 허용',
    allowMatchingDescription:
      'ON으로 설정하면 다른 사용자의 클론과\nAI 대화가 자동으로 진행돼요.',
    statusActive: '클론 활성화됨',
    statusPaused: '클론 일시정지됨',
    deleteConfirm: '클론을 삭제하면 모든 대화 기록도 함께 삭제돼요.\n정말 삭제할까요?',
  },

  notifications: {
    chemistryFound:
      '당신의 클론이 누군가와 좋은 대화를 나눴어요',
    mutualInterest: '상대방도 호감을 표시했어요! 인스타 프로필을 확인해 보세요.',
    cloneCreated: 'AI 클론이 만들어졌어요! 대화 매칭을 시작합니다.',
  },
};
