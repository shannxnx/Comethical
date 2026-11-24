// Admin: validation pass for pending scenarios. Runs the independent AI review and sets
// approval status: ambiguous → flagged, wrong/misleading → rejected, otherwise pending
// (or approved when AUTO_APPROVE_VALIDATED=true). Humans can also set statuses directly.
//
// POST { "scenarioIds": ["uuid"] } or { "limit": 10 }   (defaults to pending scenarios)
// POST { "scenarioIds": ["uuid"], "setStatus": "approved", "notes": "Checked by J." }  (manual review)
// Header: x-admin-key: <ADMIN_API_KEY>
import { HttpError, isUuid, json, readJson, serve } from '../_shared/http.ts';
import { adminClient, requireAdmin } from '../_shared/supabase.ts';
import { geminiModel } from '../_shared/gemini.ts';
import { enforceAiRateLimit, logGeneration } from '../_shared/game.ts';
import { assessAndStore, loadScenariosForAssessment } from '../_shared/assessment.ts';

const MANUAL_STATUSES = ['approved', 'rejected', 'flagged', 'pending'];

serve(async (req) => {
  requireAdmin(req);
  const admin = adminClient();
  const body = await readJson(req);
  const ids = Array.isArray(body.scenarioIds) ? body.scenarioIds.filter(isUuid).slice(0, 50) : [];

  // Manual human decision — no AI call.
  if (typeof body.setStatus === 'string') {
    if (!MANUAL_STATUSES.includes(body.setStatus)) throw new HttpError(400, 'invalid_request', 'Unknown status.');
    if (ids.length === 0) throw new HttpError(400, 'invalid_request', 'scenarioIds is required.');
    const notes = typeof body.notes === 'string' ? body.notes.slice(0, 500) : null;
    const { data, error } = await admin
      .from('scenarios')
      .update({ approval_status: body.setStatus, review_notes: notes })
      .in('id', ids)
      .select('id');
    if (error) throw new HttpError(500, 'db_error', error.message);
    return json({ updated: (data ?? []).length });
  }

  await enforceAiRateLimit(admin);
  const limit = Math.min(25, Math.max(1, Math.floor(Number(body.limit ?? 10))));
  const scenarios = await loadScenariosForAssessment(admin, { ids, status: 'pending', limit: ids.length || limit });
  const started = Date.now();
  const model = geminiModel();
  const outcomes = await assessAndStore(admin, scenarios, 'validate', model);
  const ok = outcomes.filter((o) => o.ok).length;

  await logGeneration(admin, {
    model,
    operation: 'validate',
    requested: scenarios.length,
    generated: outcomes.length,
    accepted: outcomes.filter((o) => o.status === 'approved' || o.status === 'pending').length,
    status: ok === outcomes.length ? 'success' : ok === 0 && outcomes.length > 0 ? 'failed' : 'partial',
    errors: outcomes.filter((o) => !o.ok),
    durationMs: Date.now() - started,
  });

  return json({ validated: ok, failed: outcomes.length - ok, outcomes });
});
