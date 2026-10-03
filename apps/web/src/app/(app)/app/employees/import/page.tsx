'use client';

import React, { useRef, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { AlertTriangle, ArrowLeft, CheckCircle2, Download, FileSpreadsheet, Mail, ShieldCheck, Upload, XCircle } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, EmptyState, Tabs } from '@/components/ui/feedback';
import { useAccess } from '@/lib/access/use-access';
import {
  IMPORT_COLUMNS,
  rowsFromCsv,
  templateCsv,
  useImportPreview,
  useRunImport,
  type ImportPreview,
  type ImportResult,
  type ImportRow,
} from '@/lib/company/advanced';
import { getApiErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/cn';

type Filter = 'all' | 'error' | 'warning' | 'ok';

export default function ImportEmployeesPage() {
  const { can, isLoading } = useAccess();
  const fileRef = useRef<HTMLInputElement>(null);
  const previewMut = useImportPreview();
  const run = useRunImport();
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [notes, setNotes] = useState<{ unknown: string[]; missing: string[] }>({ unknown: [], missing: [] });
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [sendInvites, setSendInvites] = useState(true);
  const [result, setResult] = useState<ImportResult | null>(null);

  if (!isLoading && !can('employee.import')) {
    return <EmptyState icon={<ShieldCheck />} title="No access" description="Bulk import needs the “Bulk import employees” permission." />;
  }

  const downloadTemplate = () => {
    const url = URL.createObjectURL(new Blob([templateCsv()], { type: 'text/csv;charset=utf-8' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: 'employees-template.csv' });
    a.click();
    URL.revokeObjectURL(url);
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setResult(null);
    setPreview(null);
    setFileName(file.name);
    if (!/\.csv$/i.test(file.name)) {
      toast.error('Please upload a .csv file (in Excel: File → Save as → CSV UTF-8)');
      return;
    }
    const parsed = rowsFromCsv(await file.text());
    setNotes({ unknown: parsed.unknownColumns, missing: parsed.missingColumns });
    if (!parsed.rows.length) {
      toast.error('No rows found under the header');
      return;
    }
    if (parsed.rows.length > 500) {
      toast.error(`That's ${parsed.rows.length} rows — import at most 500 at a time`);
      return;
    }
    setRows(parsed.rows);
    previewMut.mutate(parsed.rows, {
      onSuccess: (p) => {
        setPreview(p);
        setFilter(p.summary.errors ? 'error' : 'all');
      },
      onError: (e) => toast.error(getApiErrorMessage(e, 'Could not check the file')),
    });
  };

  const doImport = () =>
    run.mutate(
      { rows, sendInvites },
      {
        onSuccess: (r) => {
          setResult(r);
          toast.success(`${r.created} employee${r.created === 1 ? '' : 's'} imported`);
        },
        onError: (e) => toast.error(getApiErrorMessage(e, 'Import failed')),
      },
    );

  const shown = preview?.rows.filter((r) => filter === 'all' || r.status === filter) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <Link href="/app/employees" className="inline-flex items-center gap-1 text-[13px] font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Employees
        </Link>
        <PageHeader className="mt-2" title="Import employees" description="Add many people at once from a CSV. Nothing is saved until you’ve checked every row." />
      </div>

      {result ? (
        <Card className="space-y-4 p-6">
          <p className="flex items-center gap-2 text-lg font-semibold"><CheckCircle2 className="h-5 w-5 text-success" /> {result.created} employee{result.created === 1 ? '' : 's'} imported</p>
          <p className="text-sm text-muted-foreground">
            {result.invitesSent ? 'Each received a welcome email with a temporary password.' : 'No emails were sent — send invites later from Users → Resend invite.'}
          </p>
          {result.skipped.length > 0 && <p className="text-sm">{result.skipped.length} row{result.skipped.length === 1 ? ' was' : 's were'} skipped because of errors.</p>}
          {result.failed.length > 0 && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {result.failed.map((f) => <p key={f.row}>Row {f.row} ({f.name}): {f.error}</p>)}
            </div>
          )}
          <div className="flex gap-2">
            <Button asChild><Link href="/app/employees">View employees</Link></Button>
            <Button variant="secondary" asChild><Link href="/app/org">See the org chart</Link></Button>
            <Button variant="ghost" onClick={() => { setResult(null); setPreview(null); setRows([]); setFileName(''); }}>Import another file</Button>
          </div>
        </Card>
      ) : (
        <>
          <Card className="grid gap-4 p-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
            <div className="space-y-1.5 text-sm">
              <p className="font-medium">1. Prepare a CSV with one person per row</p>
              <p className="text-muted-foreground">
                Required: {IMPORT_COLUMNS.filter((c) => c.required).map((c) => c.header).join(', ')}. Optional: {IMPORT_COLUMNS.filter((c) => !c.required).map((c) => c.header).join(', ')}.
                Departments, titles and locations are matched by name; managers by work email (an existing employee or another row).
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={downloadTemplate}><Download /> Template</Button>
              <Button onClick={() => fileRef.current?.click()} loading={previewMut.isPending}><Upload /> {fileName ? 'Choose another file' : 'Choose CSV'}</Button>
              <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ''; }} />
            </div>
          </Card>

          {(notes.missing.length > 0 || notes.unknown.length > 0) && fileName && (
            <Card className="space-y-1 border-warning/30 bg-warning-soft/40 p-4 text-sm">
              {notes.missing.length > 0 && <p><AlertTriangle className="mr-1 inline h-4 w-4 text-warning" />Missing required columns: <b>{notes.missing.join(', ')}</b> — check the header row.</p>}
              {notes.unknown.length > 0 && <p className="text-muted-foreground">Ignored columns: {notes.unknown.join(', ')}</p>}
            </Card>
          )}

          {preview && (
            <Card>
              <CardHeader
                title={`2. Check ${preview.summary.total} row${preview.summary.total === 1 ? '' : 's'} from ${fileName}`}
                description={`${preview.summary.ok} ready · ${preview.summary.warnings} with warnings (imported) · ${preview.summary.errors} with errors (skipped)`}
                icon={<FileSpreadsheet />}
              />
              {preview.limit.exceeded && (
                <p className="mx-5 mb-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  Your plan allows {preview.limit.max} employees and you have {preview.limit.current}. Only {preview.limit.remaining} more can be added — remove rows or ask your platform administrator to raise the limit.
                </p>
              )}
              <div className="px-5">
                <Tabs<Filter>
                  value={filter}
                  onChange={setFilter}
                  tabs={[
                    { id: 'all', label: 'All', count: preview.summary.total },
                    { id: 'error', label: 'Errors', count: preview.summary.errors },
                    { id: 'warning', label: 'Warnings', count: preview.summary.warnings },
                    { id: 'ok', label: 'Ready', count: preview.summary.ok },
                  ]}
                />
              </div>
              <div className="max-h-[480px] overflow-auto border-t border-border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr><th className="px-4 py-2 font-semibold">Row</th><th className="px-4 py-2 font-semibold">Person</th><th className="px-4 py-2 font-semibold">Status</th></tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {shown.map((r) => (
                      <tr key={r.row} className={cn(r.status === 'error' && 'bg-destructive/5')}>
                        <td className="px-4 py-2 tabular-nums text-muted-foreground">{r.row}</td>
                        <td className="px-4 py-2"><p className="font-medium">{r.name || '—'}</p><p className="text-xs text-muted-foreground">{r.email || 'no email'}</p></td>
                        <td className="px-4 py-2">
                          <div className="flex items-start gap-2">
                            {r.status === 'ok' ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" /> : r.status === 'warning' ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />}
                            <div className="text-xs">{r.messages.length ? r.messages.map((m, i) => <p key={i}>{m}</p>) : <span className="text-muted-foreground">Ready</span>}</div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-col gap-3 border-t border-border p-4 sm:flex-row sm:items-center">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" className="accent-[hsl(var(--primary))]" checked={sendInvites} onChange={(e) => setSendInvites(e.target.checked)} />
                  <Mail className="h-4 w-4 text-muted-foreground" /> Send welcome emails with temporary passwords
                </label>
                <Button className="sm:ml-auto" onClick={doImport} loading={run.isPending} disabled={!preview.summary.importable || preview.limit.exceeded}>
                  3. Import {preview.summary.importable} employee{preview.summary.importable === 1 ? '' : 's'}
                </Button>
              </div>
              {preview.summary.errors > 0 && <p className="px-4 pb-4 text-xs text-muted-foreground">Rows with errors are skipped. Fix them in your file and import it again — rows already imported will show “already exists”.</p>}
            </Card>
          )}
          {!preview && !previewMut.isPending && (
            <Badge tone="neutral" className="w-fit">Tip: in Excel or Google Sheets, use File → Download / Save as → CSV</Badge>
          )}
        </>
      )}
    </div>
  );
}
