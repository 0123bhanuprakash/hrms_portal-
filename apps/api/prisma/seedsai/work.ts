/* Projects, assignments, milestones, PM updates, resource requests + assignment history. */
import { type Ctx, type Member, fullName, p } from './org';
import { D, addDays, chunked, mondayOf, pick, rint, rnd, stamp, uuid } from './util';

interface ProjectDef {
  code: string; name: string; client: string | null; type: 'CLIENT' | 'INTERNAL'; status: 'PLANNED' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED';
  dd: string; color: string; start: string; end: string | null; description: string; tech: string[];
}
export const PROJECTS: ProjectDef[] = [
  { code: 'HELIX', name: 'Helix', client: 'Northstar Retail', type: 'CLIENT', status: 'ACTIVE', dd: 'dd1', color: '#2563EB', start: '2024-11-04', end: null, tech: ['Java', 'Spring Boot', 'React', 'Kafka', 'Snowflake', 'AWS'], description: 'Retail analytics platform for Northstar’s 340 stores — demand forecasting, store dashboards and a merchandising planner.' },
  { code: 'ORBIT', name: 'Orbit', client: 'Kaveri Bank', type: 'CLIENT', status: 'ACTIVE', dd: 'dd1', color: '#7C3AED', start: '2025-04-07', end: '2027-03-31', tech: ['Kotlin', 'Swift', 'Node.js', 'PostgreSQL', 'UPI'], description: 'New mobile banking app for Kaveri Bank: onboarding with video KYC, UPI, cards and loans.' },
  { code: 'PULSE', name: 'Pulse', client: 'MediCore Health', type: 'CLIENT', status: 'ACTIVE', dd: 'dd2', color: '#DC2626', start: '2024-06-03', end: null, tech: ['Python', 'FastAPI', 'React', 'HL7 FHIR', 'WebRTC'], description: 'Telehealth platform: video consults, e-prescriptions and patient records across MediCore’s 60 clinics.' },
  { code: 'ATLAS', name: 'Atlas', client: 'Swiftline Logistics', type: 'CLIENT', status: 'COMPLETED', dd: 'dd2', color: '#0891B2', start: '2025-01-13', end: '2026-06-30', tech: ['Node.js', 'React Native', 'PostgreSQL', 'Google Maps'], description: 'Shipment tracking and driver app for Swiftline. Went live in June 2026; support handed to the client.' },
  { code: 'LEDGER', name: 'Ledger', client: 'Trident Insurance', type: 'CLIENT', status: 'ACTIVE', dd: 'dd2', color: '#CA8A04', start: '2025-08-18', end: null, tech: ['Java', 'Camunda', 'Node.js', 'Python', 'OCR'], description: 'Claims automation for Trident: document reading, fraud checks and straight-through approval of small claims.' },
  { code: 'BEACON', name: 'Beacon', client: 'Sunrise Clinics', type: 'CLIENT', status: 'COMPLETED', dd: 'dd3', color: '#DB2777', start: '2025-03-03', end: '2025-10-31', tech: ['React', 'Node.js', 'Twilio'], description: 'Appointment booking app for Sunrise Clinics. Delivered October 2025.' },
  { code: 'NIMBUS', name: 'Nimbus', client: null, type: 'INTERNAL', status: 'ACTIVE', dd: 'dd3', color: '#0D9488', start: '2025-02-03', end: null, tech: ['Python', 'Apache Spark', 'Airflow', 'dbt', 'Go', 'Kubernetes'], description: 'SeedsAI’s internal data platform — the lakehouse and pipelines our client products are built on.' },
  { code: 'SPROUT', name: 'Sprout', client: null, type: 'INTERNAL', status: 'ACTIVE', dd: 'dd3', color: '#16A34A', start: '2025-09-01', end: null, tech: ['Python', 'PyTorch', 'LangChain', 'pgvector', 'React'], description: 'Our own AI assistant product: answers questions over a company’s documents. Pilot with two clients.' },
  { code: 'VERTEX', name: 'Vertex', client: 'BrightPath Learning', type: 'CLIENT', status: 'ON_HOLD', dd: 'dd3', color: '#EA580C', start: '2025-11-10', end: null, tech: ['Node.js', 'React', 'PostgreSQL', 'SCORM'], description: 'Learning management system for BrightPath. On hold since August while the client re-scopes phase 2.' },
  { code: 'QUILL', name: 'Quill', client: 'Lexora Legal', type: 'CLIENT', status: 'PLANNED', dd: 'dd3', color: '#4F46E5', start: '2026-11-02', end: null, tech: ['Python', 'LLMs', 'React'], description: 'Contract review assistant for Lexora Legal. SOW signed; kick-off on 2 November.' },
];

// [project, person, role, allocation, start, end, lead, billed]
type M = [string, string, 'MANAGER' | 'TEAM_LEAD' | 'MEMBER', number, string | null, string | null, string | null, boolean?];
const MEMBERS: M[] = [
  // Helix
  ['HELIX', 'pm1', 'MANAGER', 60, null, null, null], ['HELIX', 'l1', 'TEAM_LEAD', 100, null, null, null], ['HELIX', 'l2', 'TEAM_LEAD', 100, null, null, null], ['HELIX', 'l3', 'TEAM_LEAD', 100, null, null, null],
  ['HELIX', 'e01', 'MEMBER', 100, null, null, 'l1'], ['HELIX', 'e02', 'MEMBER', 100, null, null, 'l1'], ['HELIX', 'e03', 'MEMBER', 100, null, null, 'l1'], ['HELIX', 'e04', 'MEMBER', 100, null, null, 'l1'],
  ['HELIX', 'e05', 'MEMBER', 100, '2026-05-18', null, 'l1', false],
  ['HELIX', 'e06', 'MEMBER', 100, null, '2026-02-27', 'l2'], ['HELIX', 'e07', 'MEMBER', 100, null, null, 'l2'], ['HELIX', 'e08', 'MEMBER', 100, null, null, 'l2'], ['HELIX', 'e09', 'MEMBER', 100, '2025-10-13', null, 'l2'],
  ['HELIX', 'e10', 'MEMBER', 80, null, null, 'l2'],
  ['HELIX', 'e11', 'MEMBER', 100, null, null, 'l3'], ['HELIX', 'e12', 'MEMBER', 100, null, null, 'l3'], ['HELIX', 'e13', 'MEMBER', 100, '2025-11-03', null, 'l3'],
  ['HELIX', 'dv4', 'MEMBER', 100, null, '2026-03-13', 'l3'], ['HELIX', 'ux1', 'MEMBER', 50, '2025-06-02', null, 'l2'], ['HELIX', 'dv2', 'MEMBER', 30, '2025-04-01', null, 'l1'],
  // Orbit
  ['ORBIT', 'pm2', 'MANAGER', 80, null, null, null], ['ORBIT', 'l4', 'TEAM_LEAD', 100, null, null, null],
  ['ORBIT', 'l5', 'MEMBER', 100, null, '2026-03-31', 'l4'], ['ORBIT', 'l5', 'TEAM_LEAD', 100, '2026-04-01', null, null],
  ['ORBIT', 'e14', 'MEMBER', 100, null, '2026-11-13', 'l4'], ['ORBIT', 'e15', 'MEMBER', 100, null, null, 'l4'], ['ORBIT', 'e16', 'MEMBER', 100, null, null, 'l4'], ['ORBIT', 'e18', 'MEMBER', 100, null, null, 'l4'],
  ['ORBIT', 'e17', 'MEMBER', 100, '2026-01-12', '2026-06-30', 'l4', false], ['ORBIT', 'e17', 'MEMBER', 100, '2026-07-01', null, 'l4'],
  ['ORBIT', 'e19', 'MEMBER', 100, null, '2026-03-31', 'l4'], ['ORBIT', 'e19', 'MEMBER', 100, '2026-04-01', null, 'l5'],
  ['ORBIT', 'e20', 'MEMBER', 100, null, '2026-03-31', 'l4'], ['ORBIT', 'e20', 'MEMBER', 100, '2026-04-01', null, 'l5'],
  ['ORBIT', 'e21', 'MEMBER', 100, '2025-08-04', '2026-03-31', 'l4'], ['ORBIT', 'e21', 'MEMBER', 100, '2026-04-01', null, 'l5'],
  ['ORBIT', 'e22', 'MEMBER', 100, null, null, 'l4'], ['ORBIT', 'e10', 'MEMBER', 20, null, null, 'l4'], ['ORBIT', 'ux5', 'MEMBER', 60, null, null, 'l4'],
  // Pulse
  ['PULSE', 'pm3', 'MANAGER', 50, null, null, null], ['PULSE', 'l6', 'TEAM_LEAD', 100, null, null, null], ['PULSE', 'l7', 'TEAM_LEAD', 100, null, null, null],
  ['PULSE', 'e23', 'MEMBER', 100, null, null, 'l6'], ['PULSE', 'e24', 'MEMBER', 100, null, null, 'l6'], ['PULSE', 'e25', 'MEMBER', 100, null, null, 'l6'], ['PULSE', 'e26', 'MEMBER', 100, null, null, 'l6'],
  ['PULSE', 'e27', 'MEMBER', 100, '2026-02-02', null, 'l6'], ['PULSE', 'e28', 'MEMBER', 100, null, null, 'l7'], ['PULSE', 'e29', 'MEMBER', 100, null, null, 'l7'],
  ['PULSE', 'e30', 'MEMBER', 100, '2026-06-01', null, 'l7', false], ['PULSE', 'e31', 'MEMBER', 100, null, null, 'l7'],
  // Atlas (done)
  ['ATLAS', 'pm3', 'MANAGER', 40, null, '2026-06-30', null], ['ATLAS', 'l9', 'TEAM_LEAD', 100, null, '2026-06-30', null],
  ['ATLAS', 'e34', 'MEMBER', 100, null, '2026-06-30', 'l9'], ['ATLAS', 'e36', 'MEMBER', 100, null, '2026-06-30', 'l9'], ['ATLAS', 'b1', 'MEMBER', 100, null, '2026-06-30', 'l9'],
  // Ledger
  ['LEDGER', 'pm4', 'MANAGER', 70, null, null, null], ['LEDGER', 'l8', 'TEAM_LEAD', 100, null, null, null], ['LEDGER', 'l9', 'TEAM_LEAD', 100, '2026-07-01', null, null],
  ['LEDGER', 'e32', 'MEMBER', 100, null, null, 'l8'], ['LEDGER', 'e33', 'MEMBER', 100, null, null, 'l8'], ['LEDGER', 'e35', 'MEMBER', 100, null, null, 'l8'], ['LEDGER', 'e38', 'MEMBER', 100, '2025-10-20', null, 'l8'],
  ['LEDGER', 'e37', 'MEMBER', 100, null, '2026-06-30', 'l8'], ['LEDGER', 'e37', 'MEMBER', 100, '2026-07-01', null, 'l9'],
  ['LEDGER', 'e34', 'MEMBER', 100, '2026-07-06', null, 'l9'], ['LEDGER', 'e36', 'MEMBER', 100, '2026-07-06', null, 'l9'],
  // Beacon (done)
  ['BEACON', 'pm6', 'MANAGER', 50, null, '2025-10-31', null], ['BEACON', 'l13', 'TEAM_LEAD', 100, null, '2025-10-31', null],
  ['BEACON', 'e50', 'MEMBER', 100, null, '2025-10-31', 'l13'], ['BEACON', 'e51', 'MEMBER', 100, null, '2025-10-31', 'l13'], ['BEACON', 'b2', 'MEMBER', 100, null, '2025-10-31', 'l13'],
  // Nimbus
  ['NIMBUS', 'pm5', 'MANAGER', 50, null, null, null], ['NIMBUS', 'l10', 'TEAM_LEAD', 100, null, null, null], ['NIMBUS', 'l11', 'TEAM_LEAD', 100, null, null, null],
  ['NIMBUS', 'e39', 'MEMBER', 100, null, null, 'l10'], ['NIMBUS', 'e40', 'MEMBER', 100, null, null, 'l10'],
  ['NIMBUS', 'e41', 'MEMBER', 100, null, '2026-04-19', 'l10'], ['NIMBUS', 'e41', 'MEMBER', 70, '2026-04-20', null, 'l10'],
  ['NIMBUS', 'e42', 'MEMBER', 100, null, null, 'l11'], ['NIMBUS', 'e43', 'MEMBER', 100, null, null, 'l11'], ['NIMBUS', 'e44', 'MEMBER', 100, '2026-06-08', null, 'l10'],
  ['NIMBUS', 'e50', 'MEMBER', 40, '2026-08-17', null, 'l11'], ['NIMBUS', 'dv1', 'MEMBER', 20, null, null, 'l11'],
  // Sprout
  ['SPROUT', 'pm5', 'MANAGER', 40, null, null, null], ['SPROUT', 'l12', 'TEAM_LEAD', 100, null, null, null],
  ['SPROUT', 'e45', 'MEMBER', 100, null, null, 'l12'], ['SPROUT', 'e46', 'MEMBER', 100, null, null, 'l12'], ['SPROUT', 'e47', 'MEMBER', 100, null, null, 'l12'], ['SPROUT', 'e48', 'MEMBER', 100, '2025-09-08', null, 'l12'],
  ['SPROUT', 'e49', 'MEMBER', 100, '2026-07-13', null, 'l12'], ['SPROUT', 'e41', 'MEMBER', 30, '2026-04-20', null, 'l12'], ['SPROUT', 'ux2', 'MEMBER', 50, null, null, 'l12'],
  // Vertex (on hold)
  ['VERTEX', 'pm6', 'MANAGER', 60, null, null, null], ['VERTEX', 'l13', 'TEAM_LEAD', 100, null, '2026-11-01', null], ['VERTEX', 'l13', 'TEAM_LEAD', 60, '2026-11-02', null, null],
  ['VERTEX', 'e50', 'MEMBER', 100, null, '2026-08-16', 'l13'], ['VERTEX', 'e50', 'MEMBER', 60, '2026-08-17', null, 'l13'],
  ['VERTEX', 'e51', 'MEMBER', 100, null, null, 'l13'], ['VERTEX', 'e52', 'MEMBER', 100, null, null, 'l13'], ['VERTEX', 'b2', 'MEMBER', 100, null, '2026-08-14', 'l13'],
  // Quill (starts 2 Nov)
  ['QUILL', 'pm6', 'MANAGER', 30, null, null, null], ['QUILL', 'l13', 'TEAM_LEAD', 40, null, null, null],
];

const MILESTONES: Record<string, Array<[string, string, string | null, boolean | 'late']>> = {
  // [title, due, owner, done?]
  HELIX: [['Store dashboards v2 live (120 stores)', '2025-11-28', 'l2', true], ['Demand forecast model — UAT sign-off', '2026-02-20', 'l1', true], ['Rollout to all 340 stores', '2026-05-29', 'pm1', true], ['Merchandising planner beta', '2026-09-25', 'l1', 'late'], ['Festive-season load test', '2026-10-16', 'l3', false], ['Planner GA', '2026-12-18', 'pm1', false]],
  ORBIT: [['Video KYC onboarding live', '2025-12-15', 'l4', true], ['UPI module — NPCI certification', '2026-03-27', 'l5', true], ['RBI security audit closed', '2026-08-28', 'pm2', true], ['Cards & EMI release', '2026-10-30', 'l5', false], ['Personal loans journey', '2027-01-29', 'l4', false]],
  PULSE: [['e-Prescriptions in 60 clinics', '2025-11-14', 'l6', true], ['ABDM health-ID integration', '2026-03-13', 'l6', true], ['Doctor app v3', '2026-07-24', 'l6', true], ['Regression suite automated (80%)', '2026-09-30', 'l7', 'late'], ['Pharmacy delivery pilot', '2026-11-20', 'pm3', false]],
  ATLAS: [['Driver app pilot (Pune)', '2025-11-21', 'l9', true], ['Pan-India rollout', '2026-04-17', 'l9', true], ['Go-live + hypercare complete', '2026-06-30', 'pm3', true]],
  LEDGER: [['Claims intake + OCR', '2025-12-19', 'l8', true], ['Fraud rules engine', '2026-04-24', 'l8', true], ['Straight-through approval (motor claims < ₹50k)', '2026-08-21', 'l9', true], ['Health claims STP', '2026-11-27', 'l9', false], ['Agent portal', '2027-02-26', 'l8', false]],
  BEACON: [['Booking app live', '2025-08-29', 'l13', true], ['Hand-over to Sunrise IT', '2025-10-31', 'pm6', true]],
  NIMBUS: [['Lakehouse on Iceberg', '2025-12-12', 'l10', true], ['Data contracts for all pipelines', '2026-05-15', 'l10', true], ['Self-serve metrics layer', '2026-09-18', 'l11', true], ['Cost dashboard (FinOps)', '2026-10-23', 'l11', false]],
  SPROUT: [['Pilot with two clients', '2026-01-30', 'l12', true], ['RAG evaluation harness', '2026-04-10', 'l12', true], ['SSO + audit trail', '2026-08-07', 'l12', true], ['Public beta', '2026-10-30', 'pm5', false]],
  VERTEX: [['Course catalogue + SCORM player', '2026-02-27', 'l13', true], ['Assessments module', '2026-06-26', 'l13', true], ['Phase 2 scope sign-off', '2026-09-30', 'pm6', 'late']],
  QUILL: [['Kick-off with Lexora', '2026-11-02', 'pm6', false], ['Clause library v1', '2026-12-18', 'l13', false]],
};

/** PM's weekly word: [from, to, health, notes…] — picked per week inside the window */
const HEALTH: Record<string, Array<[string, string, 'on_track' | 'at_risk' | 'off_track', string[]]>> = {
  HELIX: [
    ['2025-10-01', '2026-01-31', 'on_track', ['Dashboards v2 rolled out to 120 stores, store managers love the stock-out view.', 'Sprint goals met. Forecast model MAPE down to 11%.', 'Smooth week; two minor production bugs fixed same day.']],
    ['2026-02-01', '2026-03-15', 'at_risk', ['Rakesh leaves on 27 Feb — frontend capacity is tight until we backfill.', 'UAT feedback on forecasts bigger than expected; asking the client for one more week.']],
    ['2026-03-16', '2026-08-31', 'on_track', ['All 340 stores live. Hypercare calm.', 'Planner discovery done with the merchandising team.', 'Velocity back to normal after onboarding Ishita and Keerthi.']],
    ['2026-09-01', '2026-12-31', 'at_risk', ['Planner beta slipped by a week — waiting on the client’s pricing API.', 'Festive load test planned; need one more senior frontend engineer (request raised).']],
  ],
  ORBIT: [
    ['2025-10-01', '2026-06-30', 'on_track', ['Video KYC conversion at 78%, above the bank’s target.', 'UPI certification passed first time.', 'Steady progress on cards; design reviews on track.']],
    ['2026-07-01', '2026-08-28', 'at_risk', ['RBI audit raised 14 findings — the team is fixing them before the cards release.', 'Two audit findings need backend changes; cards release may slip.']],
    ['2026-08-29', '2026-12-31', 'on_track', ['Audit closed. Cards & EMI back on plan.', 'Vishal is on notice; handover to Joseph in progress.']],
  ],
  PULSE: [
    ['2025-10-01', '2026-07-31', 'on_track', ['e-Prescriptions live in all clinics.', 'Doctor app v3 well received; NPS 61.', 'ABDM integration certified.']],
    ['2026-08-01', '2026-12-31', 'at_risk', ['Esha is on maternity leave until February — asked for cover.', 'Regression automation behind (64% vs 80%).']],
  ],
  ATLAS: [['2025-10-01', '2026-06-30', 'on_track', ['Driver app pilot in Pune is stable.', 'Rollout completed in 18 cities.', 'Go-live done; hypercare closing on 30 June.']]],
  LEDGER: [
    ['2025-10-01', '2026-05-31', 'on_track', ['OCR accuracy at 96% on motor claims.', 'Fraud rules engine in UAT.']],
    ['2026-06-01', '2026-07-15', 'at_risk', ['STP scope grew; Atlas team joining in July will help.']],
    ['2026-07-16', '2026-12-31', 'on_track', ['Madhuri’s squad up to speed.', 'Motor STP live: 41% of small claims approved without a person.']],
  ],
  BEACON: [['2025-10-01', '2025-10-31', 'on_track', ['Hand-over sessions with Sunrise IT done.']]],
  NIMBUS: [['2025-10-01', '2026-12-31', 'on_track', ['Pipelines green all week.', 'Iceberg migration done for 80% of tables.', 'Metrics layer adopted by Helix and Ledger.']]],
  SPROUT: [
    ['2025-10-01', '2026-03-31', 'on_track', ['Pilot clients asking ~300 questions a day.', 'Answer quality up after re-ranking.']],
    ['2026-04-01', '2026-12-31', 'on_track', ['Evaluation harness running nightly.', 'SSO shipped; beta waitlist at 40 companies.']],
  ],
  VERTEX: [
    ['2025-11-10', '2026-05-31', 'on_track', ['Catalogue and player live for the first 2,000 learners.']],
    ['2026-06-01', '2026-08-09', 'off_track', ['Client paused phase 2 payments pending a re-scope.', 'Client re-scoping; we are moving people to other work.']],
    ['2026-08-10', '2026-12-31', 'at_risk', ['On hold. Monika released to the PMO pool; Ajay part-time on Nimbus.', 'Phase 2 sign-off still pending from BrightPath.']],
  ],
};

export async function seedWork(ctx: Ctx) {
  const { prisma, companyId, today, start } = ctx;
  const pmo = p(ctx, 'pmo').userId;
  const pmoAnalysts = [p(ctx, 'pmo1').userId, p(ctx, 'pmo2').userId];
  const projectId: Record<string, string> = {};
  const events: object[] = [];
  const logs: object[] = [];
  const ev = (code: string, at: Date, actor: string | null, kind: string, text: string, value: string | null = null) =>
    events.push({ companyId, projectId: projectId[code], actorUserId: actor, kind, text, value, createdAt: at });

  for (const d of PROJECTS) {
    const created = stamp(d.start < start ? addDays(start, -10) : addDays(d.start, -14), 15, 10);
    const row = await prisma.project.create({
      data: {
        companyId, code: d.code, name: d.name, description: d.description, clientName: d.client, type: d.type, color: d.color, status: d.status,
        startDate: D(d.start), endDate: d.end ? D(d.end) : null, createdById: pmo, deliveryDirectorId: p(ctx, d.dd).id, techStack: d.tech, createdAt: created,
      },
    });
    projectId[d.code] = row.id;
    ev(d.code, created, pmo, 'created', `created ${d.name}`);
    ev(d.code, created, pmo, 'type', d.type === 'CLIENT' ? 'marked it a client project' : 'marked it an internal project', d.type);
    ev(d.code, new Date(created.getTime() + 60_000), pmo, 'member_updated', `set ${fullName(p(ctx, d.dd))} as Delivery Director`);
    if (d.status === 'COMPLETED') ev(d.code, stamp(d.end!, 18), pmo, 'status', 'marked it completed', 'COMPLETED');
    if (d.code === 'VERTEX') ev(d.code, stamp('2026-08-10', 11, 30), p(ctx, 'pm6').userId, 'status', 'put the project on hold — client re-scoping phase 2', 'ON_HOLD');
  }

  // Assignments
  const rows: object[] = [];
  ctx.members = [];
  const memberIds = new Map<string, string>(); // `${code}:${key}:${start}` → id
  for (const [code, key, role, allocation, s, e, lead, billed] of MEMBERS) {
    const d = PROJECTS.find((x) => x.code === code)!;
    const r = p(ctx, key);
    const from = s ?? (r.join > d.start ? r.join : d.start);
    const until = e ?? (r.lastDay && r.lastDay < '2027-01-01' ? r.lastDay : null);
    const id = uuid();
    memberIds.set(`${code}:${key}:${from}`, id);
    ctx.members.push({ code, key, role, allocation, from, to: until, lead, billed: billed ?? true });
    const createdAt = stamp(from < start ? addDays(start, -3) : addDays(from, -rint(id, 2, 9)), 12, rint(id + 'm', 0, 59));
    rows.push({
      id, companyId, projectId: projectId[code], employeeId: r.id, role, allocation, startDate: D(from), endDate: until ? D(until) : null,
      leadEmployeeId: lead ? p(ctx, lead).id : null, billed: billed ?? true, nightShift: key === 'e08', createdAt,
    });
    const actor = key.startsWith('pm') || role === 'TEAM_LEAD' ? pmo : pick(id, pmoAnalysts);
    const label = role === 'MANAGER' ? 'Project manager' : role === 'TEAM_LEAD' ? 'Team lead' : 'Member';
    const isContinuation = MEMBERS.some((m) => m[0] === code && m[1] === key && m[5] && addDays(m[5], 1) === from);
    ev(code, createdAt, actor, isContinuation ? 'member_updated' : 'member_added', isContinuation ? `changed ${fullName(r)} to ${label.toLowerCase()} · ${allocation}%` : `added ${fullName(r)} as ${label.toLowerCase()} · ${allocation}%`);
    logs.push({ companyId, employeeId: r.id, projectId: projectId[code], actorUserId: actor, action: isContinuation ? 'changed' : 'assigned', allocation, note: `${label} · ${allocation}%${lead ? ` · lead ${fullName(p(ctx, lead))}` : ''}`, createdAt });
    if (until && until < today && !MEMBERS.some((m) => m[0] === code && m[1] === key && m[4] === addDays(until, 1))) {
      const endNote = r.lastDay === until ? 'Left the company' : d.end === until ? `${d.name} completed` : `Last day ${until}`;
      const special = ['b1', 'b2', 'e34', 'e36', 'dv4'].includes(key) && code !== 'BEACON';
      if (!special) logs.push({ companyId, employeeId: r.id, projectId: projectId[code], actorUserId: actor, action: r.lastDay === until ? 'removed' : 'released', allocation, note: endNote, createdAt: stamp(until, 18, 30) });
    }
  }
  await prisma.projectMember.createMany({ data: rows as never });
  ctx.count.assignments = rows.length;

  // Milestones
  const ms: object[] = [];
  for (const [code, list] of Object.entries(MILESTONES)) {
    for (const [title, due, owner, done] of list) {
      const doneAt = done === true ? stamp(addDays(due, -rint(title, 0, 4)), 17, rint(title + 'm', 0, 59)) : null;
      ms.push({ companyId, projectId: projectId[code], title, dueDate: D(due), ownerEmployeeId: owner ? p(ctx, owner).id : null, doneAt, createdAt: stamp(addDays(due, -90) < start ? addDays(start, -5) : addDays(due, -90), 11) });
      if (doneAt) ev(code, doneAt, owner ? p(ctx, owner).userId : null, 'milestone_done', `ticked off “${title}”`);
    }
  }
  await prisma.projectMilestone.createMany({ data: ms as never });

  // PM updates, roughly weekly (some weeks skipped)
  const updates: object[] = [];
  for (const d of PROJECTS) {
    const periods = HEALTH[d.code];
    if (!periods) continue;
    const pm = MEMBERS.find((m) => m[0] === d.code && m[2] === 'MANAGER')![1];
    for (let wk = mondayOf(d.start > start ? d.start : start); wk <= today && (!d.end || wk <= d.end); wk = addDays(wk, 7)) {
      if (rnd(d.code + wk) < 0.18) continue;
      const fri = addDays(wk, 4);
      if (fri > today) break;
      const period = periods.find(([a, b]) => fri >= a && fri <= b);
      if (!period) continue;
      const at = stamp(fri, 16 + rint(d.code + wk + 'h', 0, 2), rint(d.code + wk + 'm', 0, 59));
      const note = pick(d.code + wk + 'n', period[3]);
      updates.push({ companyId, projectId: projectId[d.code], authorUserId: p(ctx, pm).userId, health: period[2], note, createdAt: at });
      ev(d.code, at, p(ctx, pm).userId, 'update', `posted an update: ${period[2].replace('_', ' ')}`);
    }
  }
  await prisma.projectUpdate.createMany({ data: updates as never });

  await seedRequests(ctx, projectId, memberIds, events, logs);
  await chunked(events, 1000, (part) => prisma.projectEvent.createMany({ data: part as never }));
  await chunked(logs, 1000, (part) => prisma.assignmentLog.createMany({ data: part as never }));
  ctx.count.projects = PROJECTS.length;
  ctx.count.projectUpdates = updates.length;
  ctx.projectId = projectId;
  return projectId;
}

// ─── Resource requests & releases ───────────────────────────

type Step = [string, string, string, number, number, string | null, object?]; // [actor, kind, day, hour, minute, note, data]

async function seedRequests(ctx: Ctx, projectId: Record<string, string>, memberIds: Map<string, string>, pEvents: object[], logs: object[]) {
  const { prisma, companyId } = ctx;
  const u = (k: string) => p(ctx, k).userId;
  const e = (k: string) => p(ctx, k).id;
  let made = 0;
  const create = async (def: {
    code: string; kind: 'REQUEST' | 'RELEASE'; status: string; step: 'PM' | 'DD' | 'PMO'; by: string; reason: string;
    title?: string; skills?: string[]; allocation?: number; from?: string; until?: string; preferred?: string;
    release?: string; memberFrom?: string; lastDate?: string; handover?: string;
    hold?: { by: string; reason: string; at: string; remind?: string; nudged?: string };
    filled?: string; filledAllocation?: number; target?: string; outcome?: string; decidedBy?: string; decidedAt?: string; nudgedAt?: string; previous?: string;
    pendingFill?: object; steps: Step[]; logsOut?: Array<[string, string, string, number | null, string, string]>;
  }) => {
    const id = uuid();
    const last = def.steps[def.steps.length - 1]!;
    const first = def.steps[0]!;
    await prisma.resourceRequest.create({
      data: {
        id, companyId, projectId: projectId[def.code]!, kind: def.kind, status: def.status as never, step: def.step,
        raisedByUserId: u(def.by), raisedByEmployeeId: e(def.by), reason: def.reason,
        title: def.title ?? null, skills: def.skills ?? [], allocation: def.allocation ?? null, fromDate: def.from ? D(def.from) : null, untilDate: def.until ? D(def.until) : null,
        preferredEmployeeId: def.preferred ? e(def.preferred) : null,
        memberId: def.release ? memberIds.get(`${def.code}:${def.release}:${def.memberFrom}`) ?? null : null, releaseEmployeeId: def.release ? e(def.release) : null,
        lastDate: def.lastDate ? D(def.lastDate) : null, handover: def.handover ?? null,
        holdReason: def.hold?.reason ?? null, heldAt: def.hold ? stamp(def.hold.at, 12) : null, heldByUserId: def.hold ? u(def.hold.by) : null,
        remindAt: def.hold?.remind ? D(def.hold.remind) : null, remindedAt: def.hold?.remind && def.hold.remind <= ctx.today ? stamp(def.hold.remind, 9) : null, holdNudgedAt: def.hold?.nudged ? stamp(def.hold.nudged, 10) : null,
        pendingFill: (def.pendingFill as never) ?? undefined,
        filledEmployeeId: def.filled ? e(def.filled) : null, filledAllocation: def.filledAllocation ?? null, targetProjectId: def.target ? projectId[def.target] : null,
        outcomeNote: def.outcome ?? null, decidedByUserId: def.decidedBy ? u(def.decidedBy) : null, decidedAt: def.decidedAt ? stamp(def.decidedAt, last[3], last[4]) : null,
        nudgedAt: def.nudgedAt ? stamp(def.nudgedAt, 10, 15) : null, previousRequestId: def.previous ?? null,
        createdAt: stamp(first[2], first[3], first[4]), updatedAt: stamp(last[2], last[3], last[4]),
        events: { create: def.steps.map(([actor, kind, day, h, m, note, data]) => ({ companyId, actorUserId: actor === 'system' ? null : u(actor), kind, note, data: (data as never) ?? undefined, createdAt: stamp(day, h, m) })) },
      },
    });
    for (const [person, code, action, allocation, note, day] of def.logsOut ?? []) {
      logs.push({ companyId, employeeId: e(person), projectId: projectId[code] ?? null, requestId: id, actorUserId: u(def.decidedBy ?? def.by), action, allocation, note, createdAt: stamp(day, last[3], last[4]) });
    }
    made++;
    return id;
  };
  const be = (code: string, day: string, actor: string, text: string) => pEvents.push({ companyId, projectId: projectId[code], actorUserId: u(actor), kind: 'member_updated', text, createdAt: stamp(day, 17) });

  // 1. Helix — senior frontend, waiting with the PM (raised 2 days ago)
  await create({ code: 'HELIX', kind: 'REQUEST', status: 'OPEN', step: 'PM', by: 'l2', title: 'Senior Frontend Engineer', skills: ['React', 'TypeScript', 'Performance'], allocation: 100, from: '2026-10-19',
    reason: 'Planner beta slipped and the festive load test needs more hands on the store dashboards. Need someone senior who can own the planner UI.', steps: [['l2', 'raised', addDays(ctx.today, -2), 11, 20, 'Planner beta slipped and the festive load test needs more hands on the store dashboards.', { step: 'PM' }]] });
  // 2. Helix — backend engineer, now with the PMO (preferred: Arnav from the pool)
  await create({ code: 'HELIX', kind: 'REQUEST', status: 'OPEN', step: 'PMO', by: 'l1', title: 'Backend Engineer (Java)', skills: ['Java', 'Spring Boot', 'Kafka'], allocation: 100, from: '2026-10-12', preferred: 'b3',
    reason: 'Pricing API integration for the planner. Arnav from the September batch knows Spring Boot — happy to mentor him.', steps: [
      ['l1', 'raised', '2026-09-28', 10, 5, 'Pricing API integration for the planner.', { step: 'PM' }],
      ['pm1', 'forwarded', '2026-09-29', 15, 40, 'Agreed — the client has approved the extra seat in the October SOW.', { from: 'PM', to: 'DD' }],
      ['dd1', 'forwarded', '2026-10-01', 9, 50, 'OK from my side. PMO, please check Arnav’s fit.', { from: 'DD', to: 'PMO' }],
    ] });
  // 3. Orbit — QA engineer at the PMO, on hold
  await create({ code: 'ORBIT', kind: 'REQUEST', status: 'ON_HOLD', step: 'PMO', by: 'l4', title: 'QA Engineer (mobile)', skills: ['Appium', 'Mobile testing', 'API testing'], allocation: 100, from: '2026-10-05', preferred: 'b5',
    reason: 'Cards & EMI release has 3x the test cases of UPI. Anusha alone can’t cover iOS and Android.', hold: { by: 'pmo', reason: 'Waiting for Kaveri Bank to sign the SOW extension that funds this seat.', at: '2026-09-30', remind: '2026-10-12' }, steps: [
      ['l4', 'raised', '2026-09-22', 12, 10, 'Cards & EMI release has 3x the test cases of UPI.', { step: 'PM' }],
      ['pm2', 'forwarded', '2026-09-23', 10, 0, null, { from: 'PM', to: 'DD' }],
      ['dd1', 'forwarded', '2026-09-24', 18, 20, 'Approved if the bank funds it.', { from: 'DD', to: 'PMO' }],
      ['pmo', 'held', '2026-09-30', 12, 0, 'Waiting for Kaveri Bank to sign the SOW extension that funds this seat.', { remindAt: '2026-10-12' }],
    ] });
  // 4. Orbit — Android developer, rejected by the PM
  await create({ code: 'ORBIT', kind: 'REQUEST', status: 'REJECTED', step: 'PM', by: 'l5', title: 'Android Developer (Kotlin)', skills: ['Kotlin', 'Jetpack Compose'], allocation: 50, from: '2026-09-01',
    reason: 'Loans journey prototype in parallel with cards.', outcome: 'Q4 budget is closed — let’s raise it again in January with the loans SOW.', decidedBy: 'pm2', decidedAt: '2026-08-21', steps: [
      ['l5', 'raised', '2026-08-18', 14, 30, 'Loans journey prototype in parallel with cards.', { step: 'PM' }],
      ['pm2', 'rejected', '2026-08-21', 11, 15, 'Q4 budget is closed — let’s raise it again in January with the loans SOW.', { step: 'PM' }],
    ] });
  // 5. Pulse — maternity cover, on hold with the Delivery Director (reminder passed → nudged)
  await create({ code: 'PULSE', kind: 'REQUEST', status: 'ON_HOLD', step: 'DD', by: 'l6', title: 'Software Engineer (React) — maternity cover', skills: ['React', 'TypeScript'], allocation: 100, from: '2026-08-03', until: '2027-02-05',
    reason: 'Esha is on maternity leave from 3 Aug to early February. Doctor app v3 follow-ups need a frontend engineer.', hold: { by: 'dd2', reason: 'Checking whether Ledger can spare someone after the September STP release.', at: '2026-08-06', remind: '2026-09-15', nudged: '2026-08-13' }, nudgedAt: '2026-09-22', steps: [
      ['l6', 'raised', '2026-07-20', 11, 0, 'Esha is on maternity leave from 3 Aug.', { step: 'PM' }],
      ['pm3', 'forwarded', '2026-07-21', 16, 30, 'Needed — we can’t slip the regression work too.', { from: 'PM', to: 'DD' }],
      ['dd2', 'held', '2026-08-06', 12, 0, 'Checking whether Ledger can spare someone after the September STP release.', { remindAt: '2026-09-15' }],
      ['pmo', 'nudged', '2026-09-22', 10, 15, null],
    ] });
  // 6. Ledger — contractor backfill, filled by the PMO a year ago (Lokesh)
  await create({ code: 'LEDGER', kind: 'REQUEST', status: 'FILLED', step: 'PMO', by: 'l8', title: 'Python Developer', skills: ['Python', 'OCR', 'FastAPI'], allocation: 100, from: '2025-10-20',
    reason: 'OCR pipeline for claims intake.', filled: 'e38', filledAllocation: 100, decidedBy: 'pmo', decidedAt: '2025-10-14', outcome: 'Contractor from Coreforce — joins 20 Oct.', steps: [
      ['l8', 'raised', '2025-09-24', 11, 0, 'OCR pipeline for claims intake.', { step: 'PM' }],
      ['pm4', 'forwarded', '2025-09-25', 10, 20, null, { from: 'PM', to: 'DD' }],
      ['dd2', 'forwarded', '2025-09-26', 17, 45, 'No one free internally — please hire.', { from: 'DD', to: 'PMO' }],
      ['pmo', 'filled', '2025-10-14', 15, 30, 'Contractor from Coreforce — joins 20 Oct.', { employeeId: e('e38'), allocation: 100, step: 'PMO' }],
    ] });
  // 7. Nimbus — Go engineer; DD fills with Ajay from Vertex → Vertex PM agrees
  await create({ code: 'NIMBUS', kind: 'REQUEST', status: 'FILLED', step: 'DD', by: 'l11', title: 'Backend Engineer (Go)', skills: ['Go', 'gRPC', 'PostgreSQL'], allocation: 50, from: '2026-08-17', preferred: 'e50',
    reason: 'Metrics layer API needs a second Go engineer. Ajay has Go experience and Vertex is quieter now.', filled: 'e50', filledAllocation: 40, decidedBy: 'dd3', decidedAt: '2026-08-14', outcome: 'Ajay at 40% — Vertex keeps 60% for client calls.', steps: [
      ['l11', 'raised', '2026-08-10', 10, 40, 'Metrics layer API needs a second Go engineer.', { step: 'PM' }],
      ['pm5', 'forwarded', '2026-08-11', 12, 0, 'Ajay isn’t on my projects — over to Farhan.', { from: 'PM', to: 'DD' }],
      ['dd3', 'consent_asked', '2026-08-12', 17, 5, 'Ajay at 40% — Vertex keeps 60% for client calls.', { employeeId: e('e50'), allocation: 40, project: 'Vertex' }],
      ['pm6', 'consent_given', '2026-08-14', 11, 30, 'Fine while Vertex is on hold.', { project: 'Vertex' }],
      ['dd3', 'filled', '2026-08-14', 11, 31, 'Ajay at 40% — Vertex keeps 60% for client calls.', { employeeId: e('e50'), allocation: 40, step: 'DD' }],
    ], logsOut: [['e50', 'VERTEX', 'changed', 60, 'Cut to 60% for Nimbus (agreed by Divya Menon)', '2026-08-14']] });
  // 8. Sprout — data engineer, PM fills at a lower % from Nimbus (Gaurav)
  await create({ code: 'SPROUT', kind: 'REQUEST', status: 'FILLED', step: 'PM', by: 'l12', title: 'Data Engineer', skills: ['Python', 'Airflow', 'pgvector'], allocation: 50, from: '2026-04-20', preferred: 'e41',
    reason: 'Ingestion pipelines for the beta — documents from SharePoint and Drive.', filled: 'e41', filledAllocation: 30, decidedBy: 'pm5', decidedAt: '2026-04-16', outcome: 'Gaurav at 30% — Nimbus can’t spare more before the data-contracts milestone.', steps: [
      ['l12', 'raised', '2026-04-13', 12, 20, 'Ingestion pipelines for the beta.', { step: 'PM' }],
      ['pm5', 'filled', '2026-04-16', 16, 10, 'Gaurav at 30% — Nimbus can’t spare more before the data-contracts milestone.', { employeeId: e('e41'), allocation: 30, step: 'PM' }],
    ], logsOut: [['e41', 'NIMBUS', 'changed', 70, 'Cut to 70% — 30% to Sprout', '2026-04-16']] });
  // 9. Sprout — frontend engineer, withdrawn by the lead
  await create({ code: 'SPROUT', kind: 'REQUEST', status: 'WITHDRAWN', step: 'DD', by: 'l12', title: 'Frontend Engineer', skills: ['React', 'Design systems'], allocation: 100, from: '2026-06-01',
    reason: 'Admin console for beta customers.', decidedBy: 'l12', decidedAt: '2026-05-20', steps: [
      ['l12', 'raised', '2026-05-11', 11, 0, 'Admin console for beta customers.', { step: 'PM' }],
      ['pm5', 'forwarded', '2026-05-12', 15, 0, null, { from: 'PM', to: 'DD' }],
      ['l12', 'withdrawn', '2026-05-20', 10, 30, 'Pragya picked it up after the SSO work — no longer needed.'],
    ] });
  // 10–12. Interns filled by the PMO
  for (const [code, lead, who, title, day, skills] of [['HELIX', 'l1', 'e05', 'Software Engineer Intern', '2026-05-04', ['Java']], ['NIMBUS', 'l10', 'e44', 'Data Engineering Intern', '2026-05-25', ['Python', 'SQL']], ['SPROUT', 'l12', 'e49', 'ML Intern', '2026-06-29', ['Python', 'LLMs']]] as const) {
    const joins = p(ctx, who).join;
    await create({ code, kind: 'REQUEST', status: 'FILLED', step: 'PMO', by: lead, title, skills: [...skills], allocation: 100, from: joins, reason: 'Summer internship seat agreed in the yearly plan.', filled: who, filledAllocation: 100, decidedBy: 'pmo', decidedAt: addDays(day, 9), outcome: 'From the 2026 campus batch.', steps: [
      [lead, 'raised', day, 11, 0, 'Summer internship seat agreed in the yearly plan.', { step: 'PM' }],
      [MEMBERS.find((m) => m[0] === code && m[2] === 'MANAGER')![1], 'forwarded', addDays(day, 1), 12, 0, null, { from: 'PM', to: 'DD' }],
      [PROJECTS.find((x) => x.code === code)!.dd, 'forwarded', addDays(day, 2), 16, 0, null, { from: 'DD', to: 'PMO' }],
      ['pmo', 'filled', addDays(day, 9), 14, 30, 'From the 2026 campus batch.', { employeeId: e(who), allocation: 100, step: 'PMO' }],
    ] });
  }
  // 13. Orbit — Diya (intern, January)
  await create({ code: 'ORBIT', kind: 'REQUEST', status: 'FILLED', step: 'PMO', by: 'l4', title: 'Android Intern', skills: ['Kotlin'], allocation: 100, from: '2026-01-12', reason: 'Help with the KYC app backlog.', filled: 'e17', filledAllocation: 100, decidedBy: 'pmo1', decidedAt: '2026-01-07', steps: [
    ['l4', 'raised', '2025-12-15', 11, 0, 'Help with the KYC app backlog.', { step: 'PM' }],
    ['pm2', 'forwarded', '2025-12-16', 10, 0, null, { from: 'PM', to: 'DD' }],
    ['dd1', 'forwarded', '2025-12-17', 18, 0, null, { from: 'DD', to: 'PMO' }],
    ['pmo1', 'filled', '2026-01-07', 12, 0, null, { employeeId: e('e17'), allocation: 100, step: 'PMO' }],
  ] });
  // 14. Ledger — QA engineer, rejected by the Delivery Director
  await create({ code: 'LEDGER', kind: 'REQUEST', status: 'REJECTED', step: 'DD', by: 'l9', title: 'QA Engineer', skills: ['API testing', 'Playwright'], allocation: 100, from: '2026-08-01',
    reason: 'Health STP adds a lot of regression.', outcome: 'Let’s automate first — Juhi plus the shared Playwright suite should cover it. Raise again in November if not.', decidedBy: 'dd2', decidedAt: '2026-07-24', steps: [
      ['l9', 'raised', '2026-07-20', 15, 0, 'Health STP adds a lot of regression.', { step: 'PM' }],
      ['pm4', 'forwarded', '2026-07-21', 11, 0, null, { from: 'PM', to: 'DD' }],
      ['dd2', 'rejected', '2026-07-24', 17, 20, 'Let’s automate first — Juhi plus the shared Playwright suite should cover it.', { step: 'DD' }],
    ] });

  // Releases
  // 15. Atlas → Sudhir to the PMO pool
  await create({ code: 'ATLAS', kind: 'RELEASE', status: 'RELEASED', step: 'PM', by: 'l9', release: 'b1', memberFrom: '2025-01-13', lastDate: '2026-06-30', handover: 'Runbooks in Confluence; support handed to Swiftline IT.',
    reason: 'Atlas is live and hypercare ends 30 June.', decidedBy: 'pm3', decidedAt: '2026-06-24', outcome: 'Strong Python + AWS — good fit for Ledger or Quill later.', steps: [
      ['l9', 'raised', '2026-06-16', 11, 0, 'Atlas is live and hypercare ends 30 June.', { lastDate: '2026-06-30' }],
      ['pm3', 'released', '2026-06-24', 16, 0, 'Strong Python + AWS — good fit for Ledger or Quill later.'],
    ], logsOut: [['b1', 'ATLAS', 'to_pool', 100, 'Released to the PMO pool — Strong Python + AWS', '2026-06-24']] });
  // 16–17. Atlas → Chetan, Dinesh reassigned to Ledger by the Delivery Director
  for (const who of ['e34', 'e36']) {
    await create({ code: 'ATLAS', kind: 'RELEASE', status: 'REASSIGNED', step: 'PM', by: 'l9', release: who, memberFrom: '2025-01-13', lastDate: '2026-06-30', handover: 'Driver app tickets closed or moved to the client backlog.',
      reason: 'Atlas wraps up on 30 June.', target: 'LEDGER', filledAllocation: 100, decidedBy: 'dd2', decidedAt: '2026-06-26', outcome: 'Moving with Madhuri to Ledger for health STP.', steps: [
        ['l9', 'raised', '2026-06-16', 11, who === 'e34' ? 5 : 10, 'Atlas wraps up on 30 June.', { lastDate: '2026-06-30' }],
        ['dd2', 'reassigned', '2026-06-26', 12, 0, 'Moving with Madhuri to Ledger for health STP.', { project: 'Ledger', allocation: 100, startDate: '2026-07-06' }],
      ], logsOut: [[who, 'ATLAS', 'reassigned', 100, 'Moved to Ledger', '2026-06-26'], [who, 'LEDGER', 'reassigned', 100, 'Moved from Atlas', '2026-06-26']] });
  }
  be('LEDGER', '2026-07-06', 'dd2', 'welcomed Chetan Bhatt and Dinesh Waghmare from Atlas');
  // 18. Vertex → Monika to the PMO pool
  const monikaRelease = await create({ code: 'VERTEX', kind: 'RELEASE', status: 'RELEASED', step: 'PM', by: 'l13', release: 'b2', memberFrom: '2025-11-10', lastDate: '2026-08-14', handover: 'Assessment module docs updated.',
    reason: 'Vertex is on hold — no frontend work until BrightPath re-scopes phase 2.', decidedBy: 'pm6', decidedAt: '2026-08-12', steps: [
      ['l13', 'raised', '2026-08-10', 15, 0, 'Vertex is on hold — no frontend work until BrightPath re-scopes phase 2.', { lastDate: '2026-08-14' }],
      ['pm6', 'released', '2026-08-12', 10, 30, null],
    ], logsOut: [['b2', 'VERTEX', 'to_pool', 100, 'Released to the PMO pool', '2026-08-12']] });
  // 19. Vertex — request Monika back when the project restarts (on hold)
  await create({ code: 'VERTEX', kind: 'REQUEST', status: 'ON_HOLD', step: 'PM', by: 'l13', title: 'Frontend Engineer (request back)', skills: ['React'], allocation: 100, from: '2026-11-02', preferred: 'b2', previous: monikaRelease,
    reason: 'Requesting Monika back for phase 2 — she built the assessment UI.', hold: { by: 'pm6', reason: 'Phase 2 restart date not confirmed by BrightPath yet.', at: '2026-09-30', remind: '2026-10-20' }, steps: [
      ['l13', 'raised', '2026-09-28', 12, 0, 'Requesting Monika back for phase 2 — she built the assessment UI.', { step: 'PM', again: monikaRelease }],
      ['pm6', 'held', '2026-09-30', 17, 0, 'Phase 2 restart date not confirmed by BrightPath yet.', { remindAt: '2026-10-20' }],
    ] });
  // 20. Helix → Akash released (moved to DevOps)
  await create({ code: 'HELIX', kind: 'RELEASE', status: 'RELEASED', step: 'PM', by: 'l3', release: 'dv4', memberFrom: '2024-11-04', lastDate: '2026-03-13', handover: 'Automation suite ownership moved to Bhavana.',
    reason: 'Akash is moving to the DevOps team from 16 March.', decidedBy: 'pm1', decidedAt: '2026-03-04', outcome: 'Internal move — DevOps picks him up.', steps: [
      ['l3', 'raised', '2026-03-02', 10, 0, 'Akash is moving to the DevOps team from 16 March.', { lastDate: '2026-03-13' }],
      ['pm1', 'released', '2026-03-04', 12, 0, 'Internal move — DevOps picks him up.'],
    ], logsOut: [['dv4', 'HELIX', 'released', 100, 'Moved to the DevOps department', '2026-03-04']] });
  // 21. Orbit → Vishal (on notice) — waiting for the PM / DD
  await create({ code: 'ORBIT', kind: 'RELEASE', status: 'OPEN', step: 'PM', by: 'l4', release: 'e14', memberFrom: '2025-04-07', lastDate: '2026-11-13', handover: 'Joseph takes over the iOS build pipeline; KT sessions twice a week.',
    reason: 'Vishal resigned — last day 13 November.', steps: [['l4', 'raised', '2026-09-18', 11, 45, 'Vishal resigned — last day 13 November.', { lastDate: '2026-11-13' }]] });
  // 22. Pulse → Hemant, kept by the PM
  await create({ code: 'PULSE', kind: 'RELEASE', status: 'KEPT', step: 'PM', by: 'l7', release: 'e29', memberFrom: '2024-06-03', lastDate: '2026-09-30',
    reason: 'Manual regression load is lower now that 64% is automated.', decidedBy: 'pm3', decidedAt: '2026-09-17', outcome: 'Keep him — the October release needs a full manual regression cycle.', steps: [
      ['l7', 'raised', '2026-09-14', 12, 0, 'Manual regression load is lower now that 64% is automated.', { lastDate: '2026-09-30' }],
      ['pm3', 'kept', '2026-09-17', 15, 30, 'Keep him — the October release needs a full manual regression cycle.'],
    ] });
  ctx.count.resourceRequests = made;
}
