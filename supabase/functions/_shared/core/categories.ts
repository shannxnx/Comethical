// GENERATED from src/core by `npm run sync:core`. Do not edit here.
import type { Category } from './types.ts';

/**
 * Default category catalogue. In online mode the `categories` table is the source of truth
 * (this list seeds it); new categories can be added as database rows without code changes.
 * The UI only reads `icon` and `color` from the record — there is no per-category logic.
 */
export const DEFAULT_CATEGORIES: readonly Category[] = [
  { id: 'data-privacy', name: 'Data Privacy', description: 'Collecting, sharing and protecting personal information.', icon: 'lock-closed', color: '#38BDF8', active: true },
  { id: 'cybersecurity', name: 'Cybersecurity', description: 'Hacking, vulnerabilities, passwords and responsible security practice.', icon: 'shield-checkmark', color: '#2DD4BF', active: true },
  { id: 'intellectual-property', name: 'Intellectual Property', description: 'Copyright, licensing, piracy and giving credit.', icon: 'bulb', color: '#FBBF24', active: true },
  { id: 'digital-citizenship', name: 'Digital Citizenship', description: 'Respectful, responsible and safe behaviour online.', icon: 'people', color: '#A78BFA', active: true },
  { id: 'ai-ethics', name: 'Artificial Intelligence Ethics', description: 'Bias, transparency and accountability in AI systems.', icon: 'hardware-chip', color: '#F472B6', active: true },
  { id: 'academic-integrity', name: 'Academic Integrity', description: 'Honesty in schoolwork, exams and research.', icon: 'school', color: '#60A5FA', active: true },
  { id: 'social-media', name: 'Social Media Ethics', description: 'Sharing, misinformation, consent and online reputation.', icon: 'chatbubbles', color: '#FB923C', active: true },
  { id: 'professional-ethics', name: 'Professional Ethics', description: 'Duties of IT professionals to employers, clients and the public.', icon: 'briefcase', color: '#34D399', active: true },
  { id: 'software-development', name: 'Software Development Ethics', description: 'Quality, honesty and harm prevention when building software.', icon: 'code-slash', color: '#22D3EE', active: true },
  { id: 'accessibility', name: 'Digital Accessibility', description: 'Designing technology that everyone can use.', icon: 'accessibility', color: '#C084FC', active: true },
  { id: 'environmental', name: 'Environmental Ethics', description: 'E-waste, energy use and sustainable computing.', icon: 'leaf', color: '#4ADE80', active: true },
  { id: 'digital-rights', name: 'Digital Rights', description: 'Free expression, surveillance and access to technology.', icon: 'globe', color: '#F87171', active: true },
];
