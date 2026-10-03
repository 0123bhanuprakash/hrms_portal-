'use client';

import React, { useState } from 'react';
import { Plus, ShieldCheck, UserRound } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { EmptyState, Tabs } from '@/components/ui/feedback';
import { TicketList } from '@/components/helpdesk/ticket-list';
import { NewTicketDialog } from '@/components/helpdesk/new-ticket-dialog';
import { useAccess } from '@/lib/access/use-access';
import { useMyCard } from '@/lib/company/profile';
import { useTickets, type TicketStatus } from '@/lib/company/helpdesk';

export default function MyTicketsPage() {
  const { can, hasFeature, isLoading: accessLoading } = useAccess();
  const me = useMyCard();
  const allowed = hasFeature('ops.helpdesk') && can('ticket.view');
  const [status, setStatus] = useState<TicketStatus | 'active' | ''>('active');
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const list = useTickets({ view: 'mine', status: status || undefined, page }, allowed);

  if (!accessLoading && !allowed) return <EmptyState icon={<ShieldCheck />} title="Helpdesk isn’t available" />;
  if (me.isSuccess && !me.data?.employee) return <EmptyState icon={<UserRound />} title="No employee profile" description="Tickets are raised by employees." />;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Helpdesk"
        title="My tickets"
        description="Ask IT, HR or Finance for help and follow the conversation here."
        action={can('ticket.create') && <Button onClick={() => setCreating(true)}><Plus /> Raise a ticket</Button>}
      />
      <Tabs
        tabs={[
          { id: 'active' as const, label: 'Open' },
          { id: 'WAITING' as const, label: 'Needs my reply' },
          { id: 'RESOLVED' as const, label: 'Resolved' },
          { id: 'CLOSED' as const, label: 'Closed' },
          { id: '' as const, label: 'All' },
        ]}
        value={status}
        onChange={(s) => { setStatus(s); setPage(1); }}
      />
      <TicketList
        query={list}
        empty={status === 'active' ? 'No open tickets' : 'Nothing here'}
        emptyText={status === 'active' && can('ticket.create') ? 'Stuck with something? Raise a ticket and the right team will pick it up.' : undefined}
        page={page}
        onPage={setPage}
      />
      <NewTicketDialog open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}
