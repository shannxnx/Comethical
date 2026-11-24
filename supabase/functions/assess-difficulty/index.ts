// Admin: independent AI difficulty (re)assessment. Only updates difficulty score + reasoning,
// so existing scenarios can be re-scored without changing their approval status.
//
// POST { "scenarioIds": ["uuid", ...] }  or  { "status": "approved", "limit": 20 }
// Header: x-admin-key: <ADMIN_API_KEY>
import { HttpError, isUuid, json, readJson, serve } from '../_shared/http.ts';
import { adminClient, requireAdmin } from '../_shared/supabase.ts';
import { geminiModel } from '../_shared/gemini.ts';
import { enforceAiRateLimit, logGeneration } from '../_shared/game.ts';
import { assessAndStore, loadScenariosForAssessment } from '../_shared/assessment.ts';

const STATUSES = ['pending', 'approved', 'flagged', 'rejected'];

serve(async (req) => {
  requireAdmin(req);
  const admin = adminClient();
  const body = await readJson(req);
  await enforceAiRateLimit(admin);

  const ids = Array.isArray(body.scenarioIds) ? body.scenarioIds.filter(isUuid).slice(0, 25) : [];
  const status = typeof body.status === 'string' && STATUSES.includes(body.status) ? body.status : 'pending';
  const limit = Math.min(25, Math.max(1, Math.floor(Number(body.limit ?? 10))));
  if (Array.isArray(body.scenarioIds) && ids.length === 0) throw new HttpError(400, 'invalid_request', 'scenarioIds must be UUIDs.');

  const scenarios = await loadScenariosForAssessment(admin, { ids, status, limit: ids.length || limit });
  const started = Date.now();
  const model = geminiModel();
  const outcomes = await assessAndStore(admin, scenarios, 'difficulty', model);
  const ok = outcomes.filter((o) => o.ok).length;

  await logGeneration(admin, {
    model,
    operation: 'assess',
    requested: scenarios.length,
    generated: outcomes.length,
    accepted: ok,
    status: ok === outcomes.length ? 'success' : ok === 0 && outcomes.length > 0 ? 'failed' : 'partial',
    errors: outcomes.filter((o) => !o.ok),
    durationMs: Date.now() - started,
  });

  return json({ assessed: ok, failed: outcomes.length - ok, outcomes });
});
