'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  AlertTriangle,
  Bookmark,
  Building2,
  CalendarClock,
  Check,
  ClipboardList,
  Columns3,
  DoorOpen,
  Download,
  Eye,
  GraduationCap,
  KanbanSquare,
  List,
  Mail,
  MapPin,
  MoreHorizontal,
  Network,
  Pencil,
  RotateCcw,
  Search,
  Settings2,
  ShieldCheck,
  Trash2,
  Upload,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, EmptyState, ErrorState, Pagination, Skeleton } from '@/components/ui/feedback';
import { Field, Input, inputClass } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { DropdownMenu, type MenuItem } from '@/components/ui/dropdown-menu';
import { PersonAvatar } from '@/components/profile/person-avatar';
import { EmployeeDrawer } from '@/components/employees/employee-drawer';
import { AddEmployeeWizard } from '@/components/employees/add-employee-wizard';
import { EmployeeBoard } from '@/components/employees/employee-board';
import { ChecklistDrawer, InternshipSettingsDialog, LifecycleDialog, ProfileMeter, StagePill, internshipText, isCurrentIntern, type LifecycleAction, type LifecycleTarget } from '@/components/employees/lifecycle-ui';
import { useAccess, SCOPE_LABELS } from '@/lib/access/use-access';
import { useDepartments, useEmployees, useLocations, type Employee, type EmployeesQuery, type EmployeeStage } from '@/lib/company/org';
import { PersonSearch } from '@/components/people/person-search';
import { downloadEmployeesCsv, exitReasonLabel, tenure, useBulkEmployees, useLifecycleSummary, type AttentionItem, type InternshipEndAction } from '@/lib/company/lifecycle';
import { useUiState } from '@/lib/preferences/ui-state';
import { getApiErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/cn';
import { Select } from '@/components/ui/pickers';

type View = 'table' | 'board';
const isView = (v: unknown): v is View => v === 'table' || v === 'board';
const COLUMNS = [
  { id: 'title', label: 'Title & team' },
  { id: 'manager', label: 'Manager' },
  { id: 'type', label: 'Type' },
  { id: 'status', label: 'Status' },
  { id: 'tenure', label: 'Tenure' },
  { id: 'profile', label: 'Profile %' },
] as const;
type Column = (typeof COLUMNS)[number]['id'];
const DEFAULT_COLUMNS: Column[] = ['title', 'manager', 'type', 'status', 'tenure', 'profile'];
const isColumns = (v: unknown): v is Column[] => Array.isArray(v) && v.every((c) => COLUMNS.some((x) => x.id === c));

interface Filters {
  search: string;
  stage: EmployeeStage | 'current' | 'all';
  departmentId: string;
  locationId: string;
  employmentType: string;
  managerId: string;
  sort: NonNullable<EmployeesQuery['sort']>;
}
const NO_FILTERS: Filters = { search: '', stage: 'current', departmentId: '', locationId: '', employmentType: '', managerId: '', sort: 'recent' };
interface SavedView { name: string; f: Partial<Filters> }
const isViews = (v: unknown): v is SavedView[] => Array.isArray(v) && v.every((x) => x && typeof x === 'object' && typeof (x as SavedView).name === 'string');
const TYPES = [['FULL_TIME', 'Full-time'], ['PART_TIME', 'Part-time'], ['CONTRACT', 'Contract'], ['INTERN', 'Intern']] as const;
const typeLabel = (t: string) => TYPES.find((x) => x[0] === t)?.[1] ?? t;
const STAGE_PARAM = ['joining', 'probation', 'active', 'notice', 'left', 'all'];

function EmployeesContent() {
  const { can, scopeOf, isLoading: accessLoading } = useAccess();
  const params = useSearchParams();
  const scope = scopeOf('employee.view');
  const ownOnly = scope === 'own';
  const canEditOthers = can('employee.edit') && scopeOf('employee.edit') !== 'own';
  const seesExits = can('employee.terminate');

  const [view, setView] = useUiState<View>('employees:view', 'table', isView);
  const [columns, setColumns] = useUiState<Column[]>('employees:columns', DEFAULT_COLUMNS, isColumns);
  const [views, setViews] = useUiState<SavedView[]>('employees:views', [], isViews);
  const initialStage = params.get('stage');
  const [f, setF] = useState<Filters>({ ...NO_FILTERS, ...(initialStage && STAGE_PARAM.includes(initialStage) ? { stage: initialStage as Filters['stage'] } : {}) });
  const [debounced, setDebounced] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [lifecycle, setLifecycle] = useState<{ action: LifecycleAction; person: LifecycleTarget } | null>(null);
  const [checklist, setChecklist] = useState<{ person: { id: string; firstName: string; lastName: string }; kind: 'joining' | 'exit' } | null>(null);
  const [bulk, setBulk] = useState<'manager' | 'department' | 'location' | 'remind' | null>(null);
  const [remindIds, setRemindIds] = useState<string[] | null>(null);
  const [internSettings, setInternSettings] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(f.search.trim()), 300);
    return () => clearTimeout(t);
  }, [f.search]);
  useEffect(() => setPage(1), [debounced, f.stage, f.departmentId, f.locationId, f.employmentType, f.managerId, f.sort]);
  // ?add=1 opens the wizard (once permissions are known)
  useEffect(() => {
    if (!accessLoading && params.get('add') === '1' && can('employee.create')) setAdding(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessLoading]);

  const query: EmployeesQuery = {
    search: debounced || undefined,
    stage: f.stage,
    departmentId: f.departmentId || undefined,
    locationId: f.locationId || undefined,
    employmentType: f.employmentType || undefined,
    managerId: f.managerId || undefined,
    sort: f.sort,
    page,
    limit: 25,
  };
  const list = useEmployees(query);
  const summary = useLifecycleSummary(!ownOnly && !accessLoading && can('employee.view'));
  const departments = useDepartments();
  const locations = useLocations();

  if (!accessLoading && !can('employee.view')) {
    return <EmptyState icon={<ShieldCheck />} title="No access" description="You don't have permission to view employees." />;
  }

  const filtered = JSON.stringify({ ...f, search: debounced }) !== JSON.stringify({ ...NO_FILTERS, sort: f.sort });
  const rows = list.data?.data ?? [];
  const show = (c: Column) => columns.includes(c);
  const pageIds = rows.map((r) => r.id);
  const allOnPage = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const onAttention = (a: AttentionItem) => {
    if (a.key === 'probation') setF({ ...NO_FILTERS, stage: 'probation', sort: 'probation' });
    if (a.key === 'internships') setF({ ...NO_FILTERS, employmentType: 'INTERN', sort: 'internship' });
    if (a.key === 'exits') setF({ ...NO_FILTERS, stage: 'notice', sort: 'last_day' });
    if (a.key === 'no-manager') {
      setF({ ...NO_FILTERS, managerId: 'none' });
      if (canEditOthers) setSelected(new Set(a.people.map((p) => p.id)));
    }
    if (a.key === 'profiles') setRemindIds(a.people.map((p) => p.id));
    setView('table');
  };

  const rowMenu = (e: Employee): Array<MenuItem | 'separator'> => {
    const items: Array<MenuItem | 'separator'> = [{ label: 'Open profile', icon: <Eye />, onSelect: () => { window.location.href = `/app/employees/${e.id}`; } }];
    if (can('employee.edit')) items.push({ label: 'Edit details', icon: <Pencil />, onSelect: () => setEditing(e) });
    const target: LifecycleTarget = e;
    if (canEditOthers && e.stage === 'probation') {
      items.push('separator', { label: 'Confirm probation', icon: <UserCheck />, onSelect: () => setLifecycle({ action: 'confirm', person: target }) }, { label: 'Extend probation', icon: <CalendarClock />, onSelect: () => setLifecycle({ action: 'extend', person: target }) });
    }
    if (canEditOthers && isCurrentIntern(e)) {
      items.push(
        'separator',
        { label: 'Convert to employee', icon: <GraduationCap />, onSelect: () => setLifecycle({ action: 'convert', person: target }) },
        { label: 'Extend internship', icon: <CalendarClock />, onSelect: () => setLifecycle({ action: 'extend-internship', person: target }) },
        ...(seesExits ? [{ label: 'End internship', icon: <DoorOpen />, danger: true, onSelect: () => setLifecycle({ action: 'end-internship', person: target }) }] : []),
      );
    }
    if (canEditOthers && e.stage === 'joining') items.push('separator', { label: 'Joining checklist', icon: <ClipboardList />, onSelect: () => setChecklist({ person: e, kind: 'joining' }) });
    if (seesExits && e.stage === 'notice') {
      items.push(
        'separator',
        { label: 'Exit checklist', icon: <ClipboardList />, onSelect: () => setChecklist({ person: e, kind: 'exit' }) },
        { label: 'Withdraw notice', icon: <RotateCcw />, onSelect: () => setLifecycle({ action: 'withdraw', person: target }) },
        { label: 'Mark as left', icon: <DoorOpen />, danger: true, onSelect: () => setLifecycle({ action: 'left', person: target }) },
      );
    }
    if (seesExits && (e.stage === 'active' || e.stage === 'probation') && !isCurrentIntern(e)) {
      items.push('separator', { label: 'Start notice period', icon: <DoorOpen />, danger: true, onSelect: () => setLifecycle({ action: 'notice', person: target }) });
    }
    return items;
  };

  return (
    <div className="space-y-5 pb-20">
      <PageHeader
        eyebrow="People"
        title="Employees"
        description={
          ownOnly
            ? 'Your employee record.'
            : scope && scope !== 'company'
              ? `You’re seeing ${SCOPE_LABELS[scope].hint.toLowerCase()} — joiners and probations included.`
              : seesExits
                ? 'Everyone in the company — joiners, probation, notice and exits in one place.'
                : 'Everyone in the company. Reporting managers here build the org chart.'
        }
        action={
          <div className="flex flex-wrap gap-2">
            {!ownOnly && (
              <div className="inline-flex rounded-lg border border-border bg-surface p-0.5" role="group" aria-label="View">
                {([['table', 'Table', <List key="l" />], ['board', 'Lifecycle', <KanbanSquare key="k" />]] as const).map(([id, l, icon]) => (
                  <button key={id} type="button" onClick={() => setView(id)} aria-pressed={view === id} className={cn('inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-semibold transition-colors [&_svg]:size-3.5', view === id ? 'bg-primary-soft text-primary-soft-foreground' : 'text-muted-foreground hover:text-foreground')}>
                    {icon} {l}
                  </button>
                ))}
              </div>
            )}
            {can('org.view') && (
              <Button variant="secondary" asChild>
                <Link href="/app/org"><Network /> Org chart</Link>
              </Button>
            )}
            {can('employee.import') && (
              <Button variant="secondary" asChild>
                <Link href="/app/employees/import"><Upload /> Import</Link>
              </Button>
            )}
            {can('employee.create') && (
              <Button onClick={() => setAdding(true)}>
                <UserPlus /> Add employee
              </Button>
            )}
          </div>
        }
      />

      {!ownOnly && summary.data && (
        <LifecycleStrip
          counts={summary.data.counts}
          active={view === 'table' ? f.stage : null}
          onPick={(stage) => {
            setF({ ...NO_FILTERS, stage, sort: stage === 'probation' ? 'probation' : stage === 'notice' ? 'last_day' : stage === 'joining' ? 'joined' : stage === 'left' ? 'joined_desc' : 'recent' });
            setView('table');
          }}
        />
      )}

      {!ownOnly && summary.data && summary.data.attention.length > 0 && (
        <AttentionCard items={summary.data.attention} onAct={onAttention} canEditOthers={canEditOthers} internshipRule={summary.data.managesInternships ? { value: summary.data.internshipEndAction, onChange: () => setInternSettings(true) } : null} />
      )}

      {view === 'board' && !ownOnly ? (
        <EmployeeBoard
          canEditOthers={canEditOthers}
          seesExits={seesExits}
          onAction={(action, person) => setLifecycle({ action, person })}
          onChecklist={(person, kind) => setChecklist({ person, kind })}
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={f.search} onChange={(e) => setF({ ...f, search: e.target.value })} placeholder="Search name, email or ID" className="pl-8" aria-label="Search employees" />
            </div>
            {!ownOnly && (
              <>
                <FilterSelect icon={<Building2 />} label="Department" value={f.departmentId} onChange={(v) => setF({ ...f, departmentId: v })} options={(departments.data ?? []).map((d) => [d.id, d.name])} />
                <FilterSelect icon={<MapPin />} label="Location" value={f.locationId} onChange={(v) => setF({ ...f, locationId: v })} options={(locations.data ?? []).map((l) => [l.id, l.name])} />
                <FilterSelect label="Type" value={f.employmentType} onChange={(v) => setF({ ...f, employmentType: v })} options={TYPES.map(([v, l]) => [v, l])} />
                <PersonSearch managers aria-label="Manager" className="w-44" triggerClassName={cn('h-9 text-xs', f.managerId && 'border-primary bg-primary-soft text-primary-soft-foreground')} value={f.managerId} onChange={(v) => setF({ ...f, managerId: v })} emptyLabel="Any manager" muteEmpty={false} extra={[{ value: 'none', label: 'No manager' }]} />
                <Select value={f.sort} onChange={(e) => setF({ ...f, sort: e.target.value as Filters['sort'] })} className={cn(inputClass, 'h-9 w-auto text-xs')} aria-label="Sort">
                  <option value="recent">Recently added</option>
                  <option value="name">Name A–Z</option>
                  <option value="joined_desc">Newest joiners</option>
                  <option value="joined">Longest serving</option>
                  <option value="probation">Probation ends</option>
                  <option value="internship">Internship ends</option>
                  {seesExits && <option value="last_day">Last day</option>}
                </Select>
                {filtered && (
                  <Button variant="ghost" size="sm" onClick={() => setF({ ...NO_FILTERS })}><X /> Clear</Button>
                )}
                <div className="ml-auto flex items-center gap-1">
                  <SavedViews views={views} current={f} onApply={(v) => setF({ ...NO_FILTERS, ...v.f })} onSave={(name) => setViews([...views.filter((v) => v.name !== name), { name, f: { ...f, search: '' } }].slice(-8))} onDelete={(name) => setViews(views.filter((v) => v.name !== name))} />
                  <ColumnPicker columns={columns} onChange={setColumns} />
                  {can('employee.export') && (
                    <Button variant="ghost" size="sm" onClick={() => downloadEmployeesCsv(query).catch((e) => toast.error(getApiErrorMessage(e, 'Could not export')))}>
                      <Download /> Export
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>

          {f.employmentType === 'INTERN' && summary.data?.managesInternships && (
            <div className="flex flex-wrap items-center gap-2 border-b border-border bg-subtle/60 px-4 py-2 text-xs text-muted-foreground">
              <GraduationCap className="h-3.5 w-3.5" />
              When an internship ends: <b className="text-foreground">{summary.data.internshipEndAction === 'convert' ? 'converted to Full-time automatically' : 'HR is reminded to decide'}</b>
              <button type="button" onClick={() => setInternSettings(true)} className="font-semibold text-primary hover:underline">Change</button>
            </div>
          )}
          {list.isLoadingError ? (
            <ErrorState message={getApiErrorMessage(list.error, 'Could not load employees')} onRetry={() => list.refetch()} />
          ) : list.isLoading ? (
            <div className="space-y-2 p-4">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : !rows.length ? (
            <EmptyState
              icon={<Users />}
              title={filtered ? 'No employees match' : 'No employees yet'}
              description={filtered ? 'Try another search or filter.' : 'Add your first employee — they get a sign-in automatically.'}
              action={!filtered && can('employee.create') ? <Button onClick={() => setAdding(true)}><UserPlus /> Add employee</Button> : undefined}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    {canEditOthers && (
                      <th className="w-10 px-4 py-3">
                        <input type="checkbox" className="h-4 w-4 accent-[hsl(var(--primary))]" checked={allOnPage} onChange={() => setSelected((s) => { const n = new Set(s); pageIds.forEach((id) => (allOnPage ? n.delete(id) : n.add(id))); return n; })} aria-label="Select everyone on this page" />
                      </th>
                    )}
                    <th className="px-4 py-3 font-semibold">Employee</th>
                    {show('title') && <th className="hidden px-4 py-3 font-semibold md:table-cell">Title &amp; team</th>}
                    {show('manager') && <th className="hidden px-4 py-3 font-semibold lg:table-cell">Manager</th>}
                    {show('type') && <th className="hidden px-4 py-3 font-semibold xl:table-cell">Type</th>}
                    {show('status') && <th className="hidden px-4 py-3 font-semibold sm:table-cell">Status</th>}
                    {show('tenure') && <th className="hidden px-4 py-3 font-semibold lg:table-cell">Tenure</th>}
                    {show('profile') && <th className="hidden px-4 py-3 font-semibold xl:table-cell">Profile</th>}
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((e) => (
                    <tr key={e.id} className={cn('transition-colors hover:bg-muted/50', selected.has(e.id) && 'bg-primary-soft/40')}>
                      {canEditOthers && (
                        <td className="px-4 py-3">
                          <input type="checkbox" className="h-4 w-4 accent-[hsl(var(--primary))]" checked={selected.has(e.id)} onChange={() => toggle(e.id)} aria-label={`Select ${e.firstName} ${e.lastName}`} />
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <PersonAvatar person={e} size="sm" className="h-9 w-9 rounded-lg" />
                          <div className="min-w-0">
                            <Link href={`/app/employees/${e.id}`} className="block truncate font-medium hover:text-primary hover:underline">
                              {e.firstName} {e.lastName}
                            </Link>
                            <p className="truncate text-xs text-muted-foreground">{e.employeeId} · {e.email}</p>
                          </div>
                        </div>
                      </td>
                      {show('title') && (
                        <td className="hidden px-4 py-3 md:table-cell">
                          <p>{e.designation?.name ?? <span className="text-muted-foreground">—</span>}</p>
                          <p className="text-xs text-muted-foreground">{e.department?.name ?? 'No department'}</p>
                        </td>
                      )}
                      {show('manager') && (
                        <td className="hidden px-4 py-3 lg:table-cell">
                          {e.reportingManager ? <span className="text-muted-foreground">{e.reportingManager.firstName} {e.reportingManager.lastName}</span> : <Badge tone="warning">No manager</Badge>}
                        </td>
                      )}
                      {show('type') && (
                        <td className="hidden px-4 py-3 text-muted-foreground xl:table-cell">
                          {(() => {
                            const intern = internshipText(e);
                            return intern ? <span className={cn(intern.overdue && 'font-medium text-destructive')}>{intern.text}</span> : typeLabel(e.employmentType);
                          })()}
                        </td>
                      )}
                      {show('status') && (
                        <td className="hidden px-4 py-3 sm:table-cell">
                          <StagePill person={e} />
                          {e.stage === 'left' && exitReasonLabel(e.exitReason) && <p className="mt-0.5 text-xs text-muted-foreground">{exitReasonLabel(e.exitReason)}</p>}
                          {e.checklist && <p className="mt-0.5 text-xs text-muted-foreground">{e.checklist.kind === 'joining' ? 'Joining' : 'Exit'} checklist {e.checklist.done}/{e.checklist.total}</p>}
                        </td>
                      )}
                      {show('tenure') && <td className="hidden px-4 py-3 tabular-nums text-muted-foreground lg:table-cell">{tenure(e.joiningDate, e.stage === 'left' ? e.terminationDate : null)}</td>}
                      {show('profile') && <td className="hidden px-4 py-3 xl:table-cell"><ProfileMeter percent={e.profilePercent} /></td>}
                      <td className="px-4 py-3 text-right">
                        <DropdownMenu
                          label={`Actions for ${e.firstName}`}
                          items={rowMenu(e)}
                          trigger={() => (
                            <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${e.firstName} ${e.lastName}`}>
                              <MoreHorizontal />
                            </Button>
                          )}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {list.data && list.data.meta.totalPages > 1 && (
            <div className="border-t border-border px-4 py-3">
              <Pagination page={list.data.meta.page} totalPages={list.data.meta.totalPages} total={list.data.meta.total} limit={list.data.meta.limit} onPageChange={setPage} />
            </div>
          )}
        </Card>
      )}

      {selected.size > 0 && canEditOthers && (
        <div className="fixed bottom-6 left-1/2 z-40 flex max-w-[calc(100%-2rem)] -translate-x-1/2 flex-wrap items-center gap-1.5 rounded-xl bg-foreground py-2 pl-4 pr-2 text-sm text-background shadow-dialog animate-in fade-in-0 slide-in-from-bottom-2" role="toolbar" aria-label="Bulk actions">
          <b className="mr-2">{selected.size} selected</b>
          {([['manager', 'Change manager', <Users key="m" />], ['department', 'Move team', <Building2 key="d" />], ['location', 'Change office', <MapPin key="l" />], ['remind', 'Remind to finish profile', <Mail key="r" />]] as const).map(([a, l, icon]) => (
            <button key={a} type="button" onClick={() => (a === 'remind' ? setRemindIds([...selected]) : setBulk(a))} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-background/10 px-3 text-xs font-semibold hover:bg-background/20 [&_svg]:size-3.5">
              {icon} {l}
            </button>
          ))}
          <button type="button" onClick={() => setSelected(new Set())} className="ml-1 rounded-lg p-1.5 hover:bg-background/20" aria-label="Clear selection"><X className="h-4 w-4" /></button>
        </div>
      )}

      <AddEmployeeWizard open={adding} onClose={() => setAdding(false)} />
      <EmployeeDrawer state={editing ? { mode: 'edit', employee: editing } : null} onClose={() => setEditing(null)} ownOnly={scopeOf('employee.edit') === 'own'} />
      <LifecycleDialog action={lifecycle?.action ?? null} person={lifecycle?.person ?? null} onClose={() => setLifecycle(null)} />
      <InternshipSettingsDialog open={internSettings} value={summary.data?.internshipEndAction ?? 'remind'} onClose={() => setInternSettings(false)} />
      {checklist && <ChecklistDrawer person={checklist.person} kind={checklist.kind} onClose={() => setChecklist(null)} />}
      <BulkDialog
        action={bulk}
        ids={[...selected]}
        onClose={() => setBulk(null)}
        onDone={() => setSelected(new Set())}
        departments={(departments.data ?? []).map((d) => [d.id, d.name] as [string, string])}
        locations={(locations.data ?? []).map((l) => [l.id, l.name] as [string, string])}
      />
      <RemindDialog ids={remindIds} onClose={() => setRemindIds(null)} onDone={() => setSelected(new Set())} />
    </div>
  );
}

export default function EmployeesPage() {
  return (
    <Suspense>
      <EmployeesContent />
    </Suspense>
  );
}

// ─── Pieces ─────────────────────────────────────────────────

function LifecycleStrip({ counts, active, onPick }: { counts: { all: number; joining: number; probation: number; active: number; notice: number | null; left: number | null }; active: Filters['stage'] | null; onPick: (s: Filters['stage']) => void }) {
  const cells: Array<[Filters['stage'], string, number | null, string]> = [
    ['current', 'Everyone', counts.all, 'bg-foreground'],
    ['joining', 'Joining soon', counts.joining, 'bg-primary'],
    ['probation', 'Probation', counts.probation, 'bg-warning'],
    ['active', 'Active', counts.active, 'bg-success'],
    ['notice', 'Notice period', counts.notice, 'bg-destructive'],
    ['left', 'Left · 90 days', counts.left, 'bg-muted-foreground'],
  ];
  return (
    <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-border bg-surface shadow-card sm:grid-cols-3 lg:flex">
      {cells.filter((c) => c[2] !== null).map(([id, label, n, dot]) => (
        <button
          key={id}
          type="button"
          onClick={() => onPick(id)}
          aria-pressed={active === id}
          className={cn('flex flex-1 flex-col items-start gap-0.5 border-b border-r border-border px-4 py-3 text-left transition-colors last:border-r-0 hover:bg-subtle lg:border-b-0', active === id && 'bg-primary-soft/50 shadow-[inset_0_-3px_0_hsl(var(--primary))]')}
        >
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><i className={cn('h-1.5 w-1.5 rounded-full', dot)} />{label}</span>
          <b className="text-xl tabular-nums">{n}</b>
        </button>
      ))}
    </div>
  );
}

const TONE: Record<AttentionItem['tone'], string> = {
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-destructive-soft text-destructive',
  info: 'bg-info-soft text-info',
  primary: 'bg-primary-soft text-primary-soft-foreground',
};
const ACTION_LABEL: Record<AttentionItem['key'], string> = { probation: 'Review', internships: 'Review', exits: 'See exits', 'no-manager': 'Assign', profiles: 'Send reminder' };
const ICONS: Record<AttentionItem['key'], React.ReactNode> = { probation: <CalendarClock />, internships: <GraduationCap />, exits: <DoorOpen />, 'no-manager': <Users />, profiles: <ClipboardList /> };

function AttentionCard({ items, onAct, canEditOthers, internshipRule }: { items: AttentionItem[]; onAct: (a: AttentionItem) => void; canEditOthers: boolean; internshipRule: { value: InternshipEndAction; onChange: () => void } | null }) {
  const [open, setOpen] = useUiState<boolean>('employees:attention-open', true, (v): v is boolean => typeof v === 'boolean');
  return (
    <Card className="p-4">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center gap-2 text-left" aria-expanded={open}>
        <AlertTriangle className="h-4 w-4 text-warning" />
        <span className="text-sm font-semibold">Needs your attention</span>
        <span className="ml-auto text-xs text-muted-foreground">{items.length} thing{items.length === 1 ? '' : 's'} · {open ? 'hide' : 'show'}</span>
      </button>
      {open && (
        <ul className="mt-3 grid gap-x-6 md:grid-cols-2">
          {items.map((a) => (
            <li key={a.key} className="flex items-center gap-3 border-b border-border py-2.5 last:border-b-0 md:[&:nth-last-child(2):nth-child(odd)]:border-b-0">
              <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg [&_svg]:size-4', TONE[a.tone])}>{ICONS[a.key]}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{a.title}</p>
                <p className="truncate text-xs text-muted-foreground" title={a.detail}>{a.detail}</p>
              </div>
              <div className="hidden -space-x-2 sm:flex">
                {a.people.slice(0, 3).map((p) => {
                  const [first, ...rest] = p.name.split(' ');
                  return <PersonAvatar key={p.id} person={{ firstName: first ?? '', lastName: rest.join(' '), avatarUrl: p.avatarUrl }} size="sm" className="h-7 w-7 border-2 border-surface text-[10px]" />;
                })}
              </div>
              {a.key === 'internships' && internshipRule && (
                <Button variant="ghost" size="icon-sm" onClick={internshipRule.onChange} aria-label="When an internship ends" title={internshipRule.value === 'convert' ? 'Converted automatically — change' : 'HR is reminded — change'}>
                  <Settings2 />
                </Button>
              )}
              {(a.key !== 'profiles' || canEditOthers) && (
                <Button variant="secondary" size="sm" onClick={() => onAct(a)}>{ACTION_LABEL[a.key]}</Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function FilterSelect({ label, value, onChange, options, icon }: { label: string; value: string; onChange: (v: string) => void; options: Array<[string, string]>; icon?: React.ReactNode }) {
  return (
    <div className={cn('relative inline-flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors [&_svg]:size-3.5', value ? 'border-primary bg-primary-soft text-primary-soft-foreground' : 'border-border bg-surface text-muted-foreground hover:text-foreground')}>
      {icon}
      <span className="max-w-[9rem] truncate">{value ? options.find((o) => o[0] === value)?.[1] ?? label : label}</span>
      <span aria-hidden>▾</span>
      <Select value={value} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" aria-label={label}>
        <option value="">Any {label.toLowerCase()}</option>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </Select>
    </div>
  );
}

function ColumnPicker({ columns, onChange }: { columns: Column[]; onChange: (c: Column[]) => void }) {
  return (
    <DropdownMenu
      label="Columns"
      items={COLUMNS.map((c) => ({
        label: c.label,
        icon: columns.includes(c.id) ? <Check /> : <span className="inline-block w-4" />,
        onSelect: () => onChange(columns.includes(c.id) ? columns.filter((x) => x !== c.id) : COLUMNS.map((x) => x.id).filter((x) => x === c.id || columns.includes(x))),
      }))}
      trigger={() => <Button variant="ghost" size="sm"><Columns3 /> Columns</Button>}
    />
  );
}

function SavedViews({ views, current, onApply, onSave, onDelete }: { views: SavedView[]; current: Filters; onApply: (v: SavedView) => void; onSave: (name: string) => void; onDelete: (name: string) => void }) {
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const items: Array<MenuItem | 'separator'> = [
    ...views.map((v) => ({ label: v.name, icon: <Bookmark />, onSelect: () => onApply(v) })),
    ...(views.length ? ['separator' as const] : []),
    { label: 'Save current filters…', icon: <Bookmark />, onSelect: () => { setName(''); setNaming(true); } },
    ...views.map((v) => ({ label: `Delete “${v.name}”`, icon: <Trash2 />, danger: true, onSelect: () => onDelete(v.name) })),
  ];
  return (
    <>
      <DropdownMenu label="Saved views" items={items} trigger={() => <Button variant="ghost" size="sm"><Bookmark /> Views{views.length ? ` (${views.length})` : ''}</Button>} />
      <Modal
        open={naming}
        onClose={() => setNaming(false)}
        icon={<Bookmark />}
        title="Save this view"
        description={`Stage, team, office, type, manager and sort are saved${current.search ? ' (not the search text)' : ''}. Up to 8 views.`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setNaming(false)}>Cancel</Button>
            <Button onClick={() => { if (name.trim()) { onSave(name.trim().slice(0, 40)); setNaming(false); toast.success('View saved'); } }} disabled={!name.trim()}>Save</Button>
          </>
        }
      >
        <Field label="Name" htmlFor="view-name"><Input id="view-name" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="e.g. Engineering on probation" autoFocus /></Field>
      </Modal>
    </>
  );
}

function BulkDialog({ action, ids, onClose, onDone, departments, locations }: { action: 'manager' | 'department' | 'location' | 'remind' | null; ids: string[]; onClose: () => void; onDone: () => void; departments: Array<[string, string]>; locations: Array<[string, string]> }) {
  const run = useBulkEmployees();
  const [value, setValue] = useState('');
  useEffect(() => setValue(''), [action]);
  if (!action || action === 'remind') return null;
  const meta = {
    manager: { title: 'Change manager', label: 'New manager', none: '— Nobody (top of the organisation)', options: [] as Array<[string, string]> },
    department: { title: 'Move team', label: 'Department', none: '— No department', options: departments },
    location: { title: 'Change office', label: 'Location', none: '— No location', options: locations },
  }[action];
  const apply = async () => {
    try {
      const r = await run.mutateAsync({ ids, action, value: value || null });
      const skipped = r.skipped.length ? ` · ${r.skipped.length} skipped (${[...new Set(r.skipped.map((s) => s.reason))].join('; ')})` : '';
      (r.updated ? toast.success : toast.info)(`${r.updated} updated${skipped}`);
      onDone();
      onClose();
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Could not update'));
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      busy={run.isPending}
      icon={action === 'manager' ? <Users /> : action === 'department' ? <Building2 /> : <MapPin />}
      title={`${meta.title} — ${ids.length} ${ids.length === 1 ? 'person' : 'people'}`}
      description={action === 'manager' ? 'Their teams move with them. Each change is kept in their employment history.' : 'Each change is kept in their employment history.'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={run.isPending}>Cancel</Button>
          <Button onClick={apply} loading={run.isPending}>Apply to {ids.length}</Button>
        </>
      }
    >
      <Field label={meta.label} htmlFor="bulk-value">
        {action === 'manager' ? (
          <PersonSearch id="bulk-value" value={value} onChange={(id) => setValue(id)} emptyLabel={meta.none} muteEmpty={false} hide={ids} />
        ) : (
          <Select id="bulk-value" className={inputClass} value={value} onChange={(e) => setValue(e.target.value)}>
            <option value="">{meta.none}</option>
            {meta.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
        )}
      </Field>
    </Modal>
  );
}

function RemindDialog({ ids, onClose, onDone }: { ids: string[] | null; onClose: () => void; onDone: () => void }) {
  const run = useBulkEmployees();
  if (!ids) return null;
  const send = async () => {
    try {
      const r = await run.mutateAsync({ ids, action: 'remind' });
      toast.success(`Reminder sent to ${r.updated} ${r.updated === 1 ? 'person' : 'people'}${r.skipped.length ? ` · ${r.skipped.length} skipped` : ''}`);
      onDone();
      onClose();
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Could not send reminders'));
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      busy={run.isPending}
      icon={<Mail />}
      title={`Remind ${ids.length} ${ids.length === 1 ? 'person' : 'people'} to finish their profile`}
      description="Each gets a notification (and an email, if they allow them) listing exactly what’s missing. People whose profile is complete are skipped."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={run.isPending}>Cancel</Button>
          <Button onClick={send} loading={run.isPending}><Mail /> Send reminder</Button>
        </>
      }
    />
  );
}
