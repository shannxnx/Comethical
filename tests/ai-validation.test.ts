import {
  decideApprovalStatus,
  dedupeAgainst,
  ethicalRatio,
  isNearDuplicate,
  parseModelJson,
  validateAiAssessment,
  validateAiBatch,
  validateAiScenario,
  type AiAssessment,
} from '@/core';

const CATEGORIES = ['Data Privacy', 'Cybersecurity'];

const valid = {
  scenario: "A student installs monitoring software on a classmate's laptop without their knowledge.",
  category: 'Data Privacy',
  correctAnswer: 'unethical',
  explanation: 'Installing monitoring software without informed consent violates privacy and personal autonomy.',
  ethicalPrinciples: ['Privacy', 'Informed Consent'],
  recommendedAction: "Respect the classmate's privacy and obtain explicit authorization before installing software.",
  difficultyScore: 3,
  difficultyReasoning: 'The scenario involves a recognizable privacy violation without competing ethical responsibilities.',
  learningObjective: "Understand the importance of consent when accessing or monitoring another person's device.",
  ambiguous: false,
};

describe('AI scenario validation', () => {
  it('accepts the documented example schema', () => {
    const r = validateAiScenario(valid, CATEGORIES);
    expect(r.ok).toBe(true);
  });

  it('normalises category case and answer case', () => {
    const r = validateAiScenario({ ...valid, category: 'data privacy', correctAnswer: 'UNETHICAL' }, CATEGORIES);
    expect(r.ok && r.value.category).toBe('Data Privacy');
    expect(r.ok && r.value.correctAnswer).toBe('unethical');
  });

  it.each([
    ['unknown category', { category: 'Astrology' }],
    ['bad answer', { correctAnswer: 'maybe' }],
    ['difficulty out of range', { difficultyScore: 11 }],
    ['non-integer difficulty', { difficultyScore: 3.5 }],
    ['missing explanation', { explanation: '' }],
    ['no principles', { ethicalPrinciples: [] }],
    ['too long for mobile', { scenario: 'x'.repeat(400) }],
    ['fabricated citation', { explanation: 'According to Smith et al. this is a privacy violation that harms people.' }],
    ['link in explanation', { explanation: 'See https://example.com for why this violates privacy and consent rules.' }],
  ])('rejects %s', (_label, patch) => {
    const r = validateAiScenario({ ...valid, ...patch }, CATEGORIES);
    expect(r.ok).toBe(false);
  });

  it('rejects non-objects', () => {
    expect(validateAiScenario(null, CATEGORIES).ok).toBe(false);
    expect(validateAiScenario('text', CATEGORIES).ok).toBe(false);
  });
});

describe('model JSON parsing', () => {
  it('parses plain and fenced JSON', () => {
    expect(parseModelJson('{"a":1}')).toEqual({ a: 1 });
    expect(parseModelJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it('returns null for invalid JSON instead of throwing', () => {
    expect(parseModelJson('{"scenarios": [ {"broken": }')).toBeNull();
    expect(parseModelJson('Sorry, I cannot help with that.')).toBeNull();
  });
});

describe('batch validation', () => {
  it('separates valid and invalid items', () => {
    const r = validateAiBatch({ scenarios: [valid, { ...valid, correctAnswer: 'x' }] }, CATEGORIES);
    expect(r.valid).toHaveLength(1);
    expect(r.invalid).toHaveLength(1);
    expect(r.invalid[0]?.index).toBe(1);
  });

  it('flags structurally invalid responses', () => {
    expect(validateAiBatch({ nope: true }, CATEGORIES).structuralError).not.toBeNull();
  });

  it('measures answer balance', () => {
    expect(ethicalRatio([{ correctAnswer: 'ethical' }, { correctAnswer: 'unethical' }])).toBe(0.5);
  });
});

describe('assessment and approval', () => {
  const assessment: AiAssessment = {
    difficultyScore: 4,
    difficultyReasoning: 'Clear violation.',
    ambiguous: false,
    ambiguityReason: null,
    qualityIssues: [],
    verdict: 'approve',
    factors: null,
  };

  it('validates assessments', () => {
    expect(validateAiAssessment(assessment).ok).toBe(true);
    expect(validateAiAssessment({ ...assessment, verdict: 'sure' }).ok).toBe(false);
    expect(validateAiAssessment({ ...assessment, difficultyScore: 0 }).ok).toBe(false);
  });

  it('parses and clamps the difficulty factor breakdown', () => {
    const factors = {
      contextualComplexity: 3, principlesInvolved: 2, competingResponsibilities: 1, technicalKnowledge: 12,
      criticalThinking: 4, potentialConsequences: 5, decisionAmbiguity: 0,
    };
    const r = validateAiAssessment({ ...assessment, factors });
    expect(r.ok && r.value.factors).toMatchObject({ technicalKnowledge: 10, decisionAmbiguity: 1 });
    const missing = validateAiAssessment({ ...assessment, factors: { contextualComplexity: 3 } });
    expect(missing.ok && missing.value.factors).toBeNull();
  });

  it('flags ambiguous scenarios instead of forcing an answer', () => {
    expect(decideApprovalStatus({ ...assessment, ambiguous: true }, true)).toBe('flagged');
  });

  it('rejects scenarios the reviewer rejects', () => {
    expect(decideApprovalStatus({ ...assessment, verdict: 'reject' }, true)).toBe('rejected');
  });

  it('keeps AI scenarios pending unless auto-approval is enabled', () => {
    expect(decideApprovalStatus(assessment, false)).toBe('pending');
    expect(decideApprovalStatus(assessment, true)).toBe('approved');
  });
});

describe('duplicate detection', () => {
  it('detects exact and near duplicates', () => {
    expect(isNearDuplicate('A student copies homework.', 'a student copies homework')).toBe(true);
    expect(
      isNearDuplicate(
        "A student installs monitoring software on a classmate's laptop without their knowledge.",
        "A student secretly installs monitoring software on a classmate's laptop without them knowing.",
      ),
    ).toBe(true);
  });

  it('does not flag different scenarios', () => {
    expect(isNearDuplicate('A company dumps broken computers in a landfill.', 'A developer writes clear documentation and tests.')).toBe(false);
  });

  it('dedupes within a batch and against existing scenarios', () => {
    const existing = ['A company dumps broken computers in a landfill to avoid recycling fees.'];
    const batch = [
      'A company dumps broken computers into a landfill to avoid paying recycling fees.',
      'An influencer labels a sponsored post as an advert.',
      'An influencer clearly labels a sponsored post as an advert.',
    ];
    const { unique, duplicates } = dedupeAgainst(batch, existing, (s) => s);
    expect(unique).toEqual(['An influencer labels a sponsored post as an advert.']);
    expect(duplicates).toHaveLength(2);
  });
});
