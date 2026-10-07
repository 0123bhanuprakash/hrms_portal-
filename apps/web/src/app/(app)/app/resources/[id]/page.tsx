'use client';

import React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Card } from '@/components/ui/feedback';
import { RequestView } from '@/components/resources/request-view';

/** One request or release with its full step history (notifications link here). */
export default function ResourceRequestPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link href="/app/resources" className="inline-flex items-center gap-1 text-[13px] font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Resource requests
      </Link>
      <Card className="p-5 sm:p-6">
        <RequestView id={id} />
      </Card>
    </div>
  );
}
