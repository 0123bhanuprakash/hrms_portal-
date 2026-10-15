'use client';

import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Download, FileImage, FileText, FolderOpen, Loader2, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { Field, Input, inputClass, FormError } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  DOCUMENT_CATEGORIES,
  downloadDocument,
  useDeleteDocument,
  useDocuments,
  useUploadDocument,
  type EmployeeDocument,
} from '@/lib/company/profile';
import { getApiErrorMessage } from '@/lib/errors';
import { formatDate } from '@/lib/format';
import { Select } from '@/components/ui/pickers';

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp,.docx';

const size = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);

export function DocumentsSection({ employeeId }: { employeeId: string }) {
  const docs = useDocuments(employeeId);
  const remove = useDeleteDocument(employeeId);
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<EmployeeDocument | null>(null);

  const download = async (doc: EmployeeDocument) => {
    setDownloading(doc.id);
    try {
      await downloadDocument(employeeId, doc);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not download the file'));
    } finally {
      setDownloading(null);
    }
  };

  if (docs.isLoading) return <Skeleton className="h-48 w-full" />;
  if (docs.isLoadingError) return <ErrorState message={getApiErrorMessage(docs.error, 'Could not load documents')} onRetry={() => docs.refetch()} />;
  const { documents, canUpload } = docs.data!;

  return (
    <Card>
      <CardHeader
        icon={<FolderOpen />}
        title="Documents"
        description="Stored privately — downloads are recorded in the audit log."
        action={canUpload && <Button size="sm" onClick={() => setUploading(true)}><Upload /> Upload</Button>}
      />
      {documents.length === 0 ? (
        <EmptyState
          icon={<FolderOpen />}
          title="No documents yet"
          description={canUpload ? 'Upload ID proofs, certificates or letters (PDF, images or Word, up to 10 MB).' : undefined}
          className="py-10"
        />
      ) : (
        <ul className="divide-y divide-border border-t border-border">
          {documents.map((d) => (
            <li key={d.id} className="flex items-center gap-3 px-5 py-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground [&_svg]:size-4">
                {d.mimeType.startsWith('image/') ? <FileImage /> : <FileText />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  <span className="truncate">{d.name}</span>
                  <Badge>{DOCUMENT_CATEGORIES[d.category] ?? d.category}</Badge>
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {d.fileName} · {size(d.sizeBytes)} · {formatDate(d.createdAt)}
                  {d.uploadedBy && ` · by ${d.uploadedBy.firstName} ${d.uploadedBy.lastName}`}
                </p>
              </div>
              <Button size="icon-sm" variant="ghost" aria-label={`Download ${d.name}`} onClick={() => download(d)} disabled={downloading === d.id}>
                {downloading === d.id ? <Loader2 className="animate-spin" /> : <Download />}
              </Button>
              {d.canDelete && (
                <Button size="icon-sm" variant="ghost" aria-label={`Delete ${d.name}`} onClick={() => setConfirm(d)}>
                  <Trash2 />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      <UploadDialog open={uploading} onClose={() => setUploading(false)} employeeId={employeeId} />
      <ConfirmDialog
        isOpen={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        isDanger
        isLoading={remove.isPending}
        title="Delete document?"
        description={confirm ? `“${confirm.name}” will be permanently deleted.` : ''}
        confirmText="Delete"
        onConfirm={async () => {
          if (!confirm) return;
          try {
            await remove.mutateAsync(confirm.id);
            toast.success('Document deleted');
            setConfirm(null);
          } catch (err) {
            toast.error(getApiErrorMessage(err, 'Could not delete the document'));
          }
        }}
      />
    </Card>
  );
}

function UploadDialog({ open, onClose, employeeId }: { open: boolean; onClose: () => void; employeeId: string }) {
  const upload = useUploadDocument(employeeId);
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState('ID_PROOF');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setFile(null);
    setCategory('ID_PROOF');
    setName('');
    setError(null);
  }, [open]);

  const pick = (f: File | undefined) => {
    setError(null);
    if (!f) return;
    if (f.size > MAX_BYTES) return setError('File must be 10 MB or smaller');
    setFile(f);
    if (!name) setName(f.name.replace(/\.[^.]+$/, '').slice(0, 120));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return setError('Choose a file to upload');
    try {
      await upload.mutateAsync({ file, category, name: name.trim() || undefined });
      toast.success('Document uploaded');
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not upload the document'));
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      busy={upload.isPending}
      icon={<Upload />}
      title="Upload document"
      description="PDF, JPG, PNG, WebP or Word (.docx), up to 10 MB."
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={upload.isPending}>Cancel</Button>
          <Button type="submit" form="doc-form" loading={upload.isPending} disabled={!file}>Upload</Button>
        </>
      }
    >
      <form id="doc-form" onSubmit={submit} className="space-y-3">
        <FormError>{error}</FormError>
        <button
          type="button"
          onClick={() => input.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            pick(e.dataTransfer.files?.[0]);
          }}
          className="flex w-full flex-col items-center gap-1.5 rounded-lg border border-dashed border-input px-4 py-6 text-center text-sm transition-colors hover:bg-subtle"
        >
          <Upload className="h-5 w-5 text-muted-foreground" />
          {file ? (
            <span className="font-medium">{file.name} <span className="font-normal text-muted-foreground">({size(file.size)})</span></span>
          ) : (
            <span className="text-muted-foreground">Click to choose a file, or drop it here</span>
          )}
        </button>
        <input ref={input} type="file" accept={ACCEPT} className="sr-only" tabIndex={-1} onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
        <Field label="Category" htmlFor="doc-cat">
          <Select id="doc-cat" className={inputClass} value={category} onChange={(e) => setCategory(e.target.value)}>
            {Object.entries(DOCUMENT_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </Field>
        <Field label="Name" htmlFor="doc-name" hint="Shown in the list, e.g. “PAN card”">
          <Input id="doc-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
        </Field>
      </form>
    </Modal>
  );
}
