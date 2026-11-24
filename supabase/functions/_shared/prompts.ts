import { DIFFICULTY_TIERS } from './core/difficulty.config.ts';

const TIER_TEXT = DIFFICULTY_TIERS.map((t) => `${t.min}-${t.max} ${t.label}`).join(', ');

export const GENERATION_SYSTEM = `You write short, realistic computer-ethics scenarios for an educational swipe game.
Players read one scenario and decide whether the described ACTION is "ethical" or "unethical".

Rules:
- Each scenario describes ONE clear action by a person or organisation (students, teachers, employees, developers, companies, social media users, everyday technology users).
- Keep the scenario under 260 characters, plain language, no jargon without context, no names of real people or companies.
- The correct answer must be defensible by mainstream computer-ethics principles (for example the ACM Code of Ethics: avoid harm, be honest, respect privacy, respect the work required to produce new ideas, honour confidentiality, contribute to society).
- Do not write trick questions, misleading wording or scenarios that hinge on missing information.
- If more than one answer is reasonably defensible, set "ambiguous": true instead of forcing an answer.
- The explanation (1–3 sentences) must explain THIS scenario directly. Never invent citations, studies, statistics, laws or links.
- recommendedAction: a constructive alternative for unethical actions; may be null for ethical ones.
- Difficulty (1–10) reflects the depth of ethical reasoning required (competing responsibilities, number of principles, technical knowledge, consequences, clarity) — NOT length or vocabulary. Tiers: ${TIER_TEXT}.
- Use encouraging, educational language.`;

export function generationPrompt(input: {
  count: number;
  categories: string[];
  difficultyMin: number;
  difficultyMax: number;
  avoidExamples: string[];
}): string {
  return `Generate ${input.count} new scenarios.
Categories to use (spread across them, use the exact names): ${input.categories.join('; ')}.
Difficulty range: ${input.difficultyMin} to ${input.difficultyMax}, spread across the range.
Make roughly half "ethical" and half "unethical", in an unpredictable order.
Do not repeat or closely paraphrase any of these existing scenarios:
${input.avoidExamples.map((s) => `- ${s}`).join('\n') || '- (none)'}
Return JSON: {"scenarios": [...]}.`;
}

const STRING = { type: 'STRING' };

export const SCENARIO_BATCH_SCHEMA = {
  type: 'OBJECT',
  properties: {
    scenarios: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          scenario: STRING,
          category: STRING,
          correctAnswer: { type: 'STRING', enum: ['ethical', 'unethical'] },
          explanation: STRING,
          ethicalPrinciples: { type: 'ARRAY', items: STRING },
          recommendedAction: { type: 'STRING', nullable: true },
          difficultyScore: { type: 'INTEGER' },
          difficultyReasoning: STRING,
          learningObjective: STRING,
          ambiguous: { type: 'BOOLEAN' },
        },
        required: [
          'scenario', 'category', 'correctAnswer', 'explanation', 'ethicalPrinciples',
          'difficultyScore', 'difficultyReasoning', 'learningObjective', 'ambiguous',
        ],
      },
    },
  },
  required: ['scenarios'],
};

export const ASSESSMENT_SYSTEM = `You are an independent reviewer of computer-ethics teaching scenarios.
You did not write the scenario. Judge it critically.

Assess:
1. Difficulty 1–10 from the depth of ethical reasoning required: contextual complexity, number of ethical principles involved, competing responsibilities, required technical knowledge, required critical thinking, potential consequences, and how clear the ethical decision is. Ignore length and vocabulary. Tiers: ${TIER_TEXT}.
2. Ambiguity: is more than one answer (ethical / unethical) reasonably defensible? If yes, ambiguous = true.
3. Quality: is the stated correct answer right under mainstream computer-ethics principles (e.g. ACM Code of Ethics)? Does the explanation directly address the scenario without invented facts or citations? Is the wording clear and not misleading? Is it realistic and appropriate for students?
Verdict: "approve" if correct, clear and educational; "flag" if ambiguous or needs a human look; "reject" if the answer is wrong, the content is inappropriate, or the explanation is misleading.`;

export function assessmentPrompt(s: {
  text: string;
  category: string;
  correctAnswer: string;
  explanation: string;
  principles: string[];
}): string {
  return `Scenario: ${s.text}
Category: ${s.category}
Stated correct answer: ${s.correctAnswer}
Explanation: ${s.explanation}
Principles: ${s.principles.join(', ')}
Return JSON with difficultyScore, difficultyReasoning, ambiguous, ambiguityReason, qualityIssues, verdict.`;
}

export const ASSESSMENT_SCHEMA = {
  type: 'OBJECT',
  properties: {
    difficultyScore: { type: 'INTEGER' },
    difficultyReasoning: STRING,
    ambiguous: { type: 'BOOLEAN' },
    ambiguityReason: { type: 'STRING', nullable: true },
    qualityIssues: { type: 'ARRAY', items: STRING },
    verdict: { type: 'STRING', enum: ['approve', 'flag', 'reject'] },
  },
  required: ['difficultyScore', 'difficultyReasoning', 'ambiguous', 'qualityIssues', 'verdict'],
};
