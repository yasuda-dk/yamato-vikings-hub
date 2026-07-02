import { useEffect, useMemo, useState } from 'react';
import type { FineBoxState, FineRecord } from '../lib/fines';
import type { MemberProfile } from '../lib/member-options';
import type { Phase1Api } from '../lib/phase1-api';

type FinesPageProps = {
  api: Phase1Api;
  selectedMember: MemberProfile;
};

export function FinesPage({ api, selectedMember }: FinesPageProps) {
  const [fineBox, setFineBox] = useState<FineBoxState | null>(null);
  const [selectedFineIds, setSelectedFineIds] = useState<string[]>([]);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [isReporting, setIsReporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadFineBox() {
      try {
        setLoadState('loading');
        setError(null);
        const nextFineBox = await api.getFineBox();
        if (isMounted) {
          setFineBox(nextFineBox);
          setLoadState('ready');
        }
      } catch (loadError) {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : 'Could not load Fine Box.');
          setLoadState('error');
        }
      }
    }

    void loadFineBox();

    return () => {
      isMounted = false;
    };
  }, [api]);

  const myUnpaidFines = useMemo(
    () => fineBox?.fines.filter((fine) => fine.participant_kind === 'member' && fine.participant_id === selectedMember.id && fine.payment_status === 'Unpaid') ?? [],
    [fineBox, selectedMember.id],
  );
  const selectedFines = useMemo(() => fineBox?.fines.filter((fine) => selectedFineIds.includes(fine.id)) ?? [], [fineBox, selectedFineIds]);
  const selectedTotal = selectedFines.reduce((total, fine) => total + fine.amount_dkk, 0);
  const canReport = selectedFineIds.length > 0 && !isReporting;
  const mobilePayUrl = fineBox?.settings.mobilepay_url ?? '';

  function toggleFine(fineId: string) {
    setSelectedFineIds((current) => (current.includes(fineId) ? current.filter((id) => id !== fineId) : [...current, fineId]));
  }

  function toggleAll() {
    setSelectedFineIds((current) => (current.length === myUnpaidFines.length ? [] : myUnpaidFines.map((fine) => fine.id)));
  }

  async function reportPayment() {
    if (!canReport) return;

    setIsReporting(true);
    setError(null);
    setSuccess(null);
    try {
      const nextFineBox = await api.reportFinePayment({ fineIds: selectedFineIds });
      setFineBox(nextFineBox);
      setSelectedFineIds([]);
      setSuccess('Payment reported. An Admin will confirm it after checking MobilePay.');
    } catch (reportError) {
      setError(reportError instanceof Error ? reportError.message : 'Could not report payment.');
    } finally {
      setIsReporting(false);
    }
  }

  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-navy/10 bg-white p-4">
        <p className="text-sm font-semibold text-footballBlue">Fine Box</p>
        <h2 className="mt-1 text-xl font-bold text-navy">Fines</h2>
        <p className="mt-3 text-sm leading-5 text-navy/70">Pay selected unpaid fines with MobilePay, then report the payment for Admin confirmation.</p>
      </div>

      {error ? (
        <div className="rounded-md border border-red-200 bg-white p-3 text-sm font-semibold text-red-800" role="alert">
          {error}
        </div>
      ) : null}
      {success ? <div className="rounded-md border border-footballBlue/20 bg-white p-3 text-sm font-semibold text-footballBlue">{success}</div> : null}

      {loadState === 'loading' ? <FinesLoading /> : null}
      {loadState === 'error' ? (
        <div className="rounded-lg border border-navy/10 bg-white p-4">
          <h3 className="text-base font-bold text-navy">Fine Box unavailable</h3>
          <p className="mt-2 text-sm text-navy/70">Try again after checking your connection.</p>
        </div>
      ) : null}
      {loadState === 'ready' && fineBox ? (
        <>
          <FineSummary fineBox={fineBox} />

          <div className="rounded-lg border border-navy/10 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-base font-bold text-navy">Your payment</h3>
                <p className="mt-1 text-sm text-navy/70">Reference: {selectedMember.first_name}</p>
              </div>
              <span className="shrink-0 rounded-md bg-mist px-2 py-1 text-xs font-bold text-navy">{selectedTotal} DKK</span>
            </div>

            <div className="mt-3 rounded-md bg-mist p-3">
              <p className="text-sm font-bold text-navy">Fine Box {fineBox.settings.mobilepay_box_number ?? 'not configured'}</p>
              <p className="mt-1 text-sm text-navy/70">Amount due: {selectedTotal} DKK</p>
              <p className="mt-1 text-sm text-navy/70">{fineBox.settings.payment_instructions ?? 'Use your first name as the payment reference.'}</p>
            </div>

            <div className="mt-3 grid gap-2">
              <button type="button" disabled={myUnpaidFines.length === 0 || isReporting} onClick={toggleAll} className="min-h-11 rounded-md border border-footballBlue px-3 text-sm font-bold text-footballBlue disabled:border-navy/10 disabled:text-navy/40">
                {selectedFineIds.length === myUnpaidFines.length && myUnpaidFines.length > 0 ? 'Clear selection' : 'Select all unpaid'}
              </button>
              <a
                href={mobilePayUrl || undefined}
                target="_blank"
                rel="noreferrer"
                aria-disabled={!mobilePayUrl || selectedTotal === 0}
                className={`flex min-h-12 items-center justify-center rounded-md px-4 text-base font-bold ${mobilePayUrl && selectedTotal > 0 ? 'bg-footballBlue text-white' : 'bg-navy/35 text-white'}`}
              >
                Pay with MobilePay
              </a>
              <button type="button" disabled={!canReport} onClick={reportPayment} className="min-h-12 rounded-md bg-footballBlue px-4 text-base font-bold text-white disabled:bg-navy/40">
                {isReporting ? 'Reporting...' : 'I have paid'}
              </button>
            </div>
          </div>

          {fineBox.fines.length === 0 ? (
            <div className="rounded-lg border border-navy/10 bg-white p-4">
              <h3 className="text-base font-bold text-navy">No fines yet</h3>
              <p className="mt-2 text-sm text-navy/70">Fine history will appear here after an Admin creates fines.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-navy/10 bg-white">
              {fineBox.fines.map((fine) => (
                <FineRow key={fine.id} fine={fine} selected={selectedFineIds.includes(fine.id)} canSelect={myUnpaidFines.some((item) => item.id === fine.id)} onToggle={() => toggleFine(fine.id)} />
              ))}
            </div>
          )}
        </>
      ) : null}
    </section>
  );
}

function FineSummary({ fineBox }: { fineBox: FineBoxState }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <SummaryTile label="Unpaid" value={`${fineBox.summary.unpaid_total_dkk} DKK`} />
      <SummaryTile label="Reported" value={`${fineBox.summary.payment_reported_total_dkk} DKK`} />
      <SummaryTile label="Paid" value={`${fineBox.summary.paid_total_dkk} DKK`} />
      <SummaryTile label="Waived" value={`${fineBox.summary.waived_total_dkk} DKK`} />
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-white p-3">
      <p className="text-xs font-bold text-navy/60">{label}</p>
      <p className="mt-1 text-lg font-bold text-navy">{value}</p>
    </div>
  );
}

function FineRow({ fine, selected, canSelect, onToggle }: { fine: FineRecord; selected: boolean; canSelect: boolean; onToggle: () => void }) {
  return (
    <div className="border-b border-navy/10 px-4 py-3 last:border-b-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="break-words text-base font-bold text-navy">{fine.first_name}</h3>
            {fine.participant_kind === 'guest' ? <span className="rounded bg-mist px-2 py-1 text-xs font-bold text-footballBlue">GUEST</span> : null}
          </div>
          <p className="mt-1 text-sm font-semibold text-navy/70">{fine.fine_type_name ?? 'Custom fine'}</p>
          <p className="mt-1 text-sm text-navy/60">{fine.description}</p>
          {fine.related_event_title ? <p className="mt-1 text-xs font-semibold text-navy/55">{fine.related_event_title}</p> : null}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-bold text-navy">{fine.amount_dkk} DKK</p>
          <span className="mt-1 inline-block rounded-md bg-mist px-2 py-1 text-xs font-bold text-navy">{fine.payment_status}</span>
        </div>
      </div>
      {canSelect ? (
        <button type="button" onClick={onToggle} className={`mt-3 min-h-11 w-full rounded-md border px-3 text-sm font-bold ${selected ? 'border-footballBlue bg-footballBlue text-white' : 'border-footballBlue bg-white text-footballBlue'}`}>
          {selected ? 'Selected for payment' : 'Select for payment'}
        </button>
      ) : null}
    </div>
  );
}

function FinesLoading() {
  return (
    <div className="rounded-lg border border-navy/10 bg-white p-4" aria-busy="true">
      <p className="text-sm font-semibold text-footballBlue">Loading fines</p>
      <div className="mt-4 space-y-3">
        <div className="h-14 rounded-md bg-mist" />
        <div className="h-14 rounded-md bg-mist" />
        <div className="h-20 rounded-md bg-mist" />
      </div>
    </div>
  );
}
