import { useEffect, useMemo, useState } from 'react';
import type { CreateFinesInput, FineBoxState, FineRecord, FineTypeRecord, UpdateFineStatusInput } from '../lib/fines';
import type { MemberProfile } from '../lib/member-options';
import type { Phase1Api } from '../lib/phase1-api';

type FinesPageProps = {
  api: Phase1Api;
  selectedMember: MemberProfile;
};

type FineStatusFilter = 'All' | FineRecord['payment_status'];

const fineStatusFilters: FineStatusFilter[] = ['All', 'Unpaid', 'Payment reported', 'Paid', 'Waived'];

export function FinesPage({ api, selectedMember }: FinesPageProps) {
  const [fineBox, setFineBox] = useState<FineBoxState | null>(null);
  const [selectedFineIds, setSelectedFineIds] = useState<string[]>([]);
  const [expandedFineIds, setExpandedFineIds] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<FineStatusFilter>('All');
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [isReporting, setIsReporting] = useState(false);
  const [adminBusyId, setAdminBusyId] = useState<string | null>(null);
  const [showCreateFine, setShowCreateFine] = useState(false);
  const [showFineTypeForm, setShowFineTypeForm] = useState(false);
  const [fineDraft, setFineDraft] = useState<CreateFinesInput>({
    participants: [],
    fineTypeId: null,
    description: '',
    amountDkk: 20,
  });
  const [fineTypeDraft, setFineTypeDraft] = useState({
    name: '',
    defaultAmountDkk: 20,
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const isAdmin = selectedMember.application_role === 'Admin';

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
  const visibleFines = useMemo(() => fineBox?.fines.filter((fine) => statusFilter === 'All' || fine.payment_status === statusFilter) ?? [], [fineBox, statusFilter]);
  const selectedTotal = selectedFines.reduce((total, fine) => total + fine.amount_dkk, 0);
  const canReport = selectedFineIds.length > 0 && !isReporting;
  const mobilePayUrl = fineBox?.settings.mobilepay_url ?? '';
  const createDisabled = adminBusyId === 'create-fine' || fineDraft.participants.length === 0 || !fineDraft.description.trim() || fineDraft.amountDkk <= 0;
  const createFineTypeDisabled = adminBusyId === 'create-fine-type' || !fineTypeDraft.name.trim() || fineTypeDraft.defaultAmountDkk < 0;
  const activeFineTypes = fineBox?.fineTypes.filter((fineType) => fineType.is_active) ?? [];
  const createFineButtonLabel = fineDraft.participants.length > 1 ? `Add ${fineDraft.participants.length} fines` : 'Add fine';

  function toggleFine(fineId: string) {
    setSelectedFineIds((current) => (current.includes(fineId) ? current.filter((id) => id !== fineId) : [...current, fineId]));
  }

  function toggleFineDetails(fineId: string) {
    setExpandedFineIds((current) => (current.includes(fineId) ? current.filter((id) => id !== fineId) : [...current, fineId]));
  }

  function toggleAll() {
    setSelectedFineIds((current) => (current.length === myUnpaidFines.length ? [] : myUnpaidFines.map((fine) => fine.id)));
  }

  function toggleParticipant(kind: 'member' | 'guest', id: string) {
    setFineDraft((current) => {
      const isSelected = current.participants.some((participant) => participant.kind === kind && participant.id === id);
      return {
        ...current,
        participants: isSelected ? current.participants.filter((participant) => participant.kind !== kind || participant.id !== id) : [...current.participants, { kind, id }],
      };
    });
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

  async function createFine() {
    if (createDisabled) return;

    setAdminBusyId('create-fine');
    setError(null);
    setSuccess(null);
    try {
      const createdCount = fineDraft.participants.length;
      const nextFineBox = await api.createFines(fineDraft);
      setFineBox(nextFineBox);
      setFineDraft((current) => ({ ...current, participants: [], fineTypeId: null, description: '', amountDkk: 20 }));
      setShowCreateFine(false);
      setSuccess(createdCount > 1 ? `${createdCount} fines added.` : 'Fine added.');
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Could not add fine.');
    } finally {
      setAdminBusyId(null);
    }
  }

  async function createFineType() {
    if (createFineTypeDisabled) return;

    setAdminBusyId('create-fine-type');
    setError(null);
    setSuccess(null);
    try {
      const nextFineBox = await api.createFineType(fineTypeDraft);
      setFineBox(nextFineBox);
      setFineTypeDraft({ name: '', defaultAmountDkk: 20 });
      setShowFineTypeForm(false);
      setSuccess('Fine type created.');
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Could not create fine type.');
    } finally {
      setAdminBusyId(null);
    }
  }

  async function updateFineType(fineType: FineTypeRecord) {
    if (adminBusyId) return;

    setAdminBusyId(`fine-type-${fineType.id}`);
    setError(null);
    setSuccess(null);
    try {
      const nextFineBox = await api.updateFineType({ fineTypeId: fineType.id, isActive: !fineType.is_active });
      setFineBox(nextFineBox);
      setSuccess(fineType.is_active ? 'Fine type deactivated.' : 'Fine type activated.');
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Could not update fine type.');
    } finally {
      setAdminBusyId(null);
    }
  }

  async function updateFineStatus(input: UpdateFineStatusInput) {
    if (adminBusyId) return;

    setAdminBusyId(`${input.action}-${input.fineId}`);
    setError(null);
    setSuccess(null);
    try {
      const nextFineBox = await api.updateFineStatus(input);
      setFineBox(nextFineBox);
      setSelectedFineIds((current) => current.filter((fineId) => fineId !== input.fineId));
      setSuccess(input.action === 'confirm-paid' ? 'Payment confirmed.' : 'Fine waived.');
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : 'Could not update fine.');
    } finally {
      setAdminBusyId(null);
    }
  }

  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-navy/10 bg-white p-4">
        <p className="text-sm font-semibold text-footballBlue">Fine Box</p>
        <div className="mt-1 flex items-start justify-between gap-3">
          <h2 className="text-xl font-bold text-navy">Fines</h2>
          {isAdmin ? (
            <button type="button" onClick={() => setShowCreateFine((current) => !current)} className="min-h-11 rounded-md border border-footballBlue px-3 text-sm font-bold text-footballBlue">
              {showCreateFine ? 'Close' : 'Add fine'}
            </button>
          ) : null}
        </div>
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

          {isAdmin ? (
            <div className="rounded-lg border border-navy/10 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-navy">Fine types</h3>
                  <p className="mt-1 text-sm text-navy/70">Reusable reasons and default DKK amounts.</p>
                </div>
                <button type="button" onClick={() => setShowFineTypeForm((current) => !current)} className="min-h-11 shrink-0 rounded-md border border-footballBlue px-3 text-sm font-bold text-footballBlue">
                  {showFineTypeForm ? 'Close' : 'New type'}
                </button>
              </div>

              {showFineTypeForm ? (
                <div className="mt-4 rounded-md bg-mist p-3">
                  <div className="grid gap-3">
                    <label className="text-sm font-semibold text-navy">
                      Fine type name
                      <input value={fineTypeDraft.name} onChange={(event) => setFineTypeDraft((current) => ({ ...current, name: event.target.value }))} className="mt-2 min-h-11 w-full rounded-md border border-navy/20 bg-white px-3 text-base" />
                    </label>
                    <label className="text-sm font-semibold text-navy">
                      Default amount DKK
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={fineTypeDraft.defaultAmountDkk}
                        onChange={(event) => setFineTypeDraft((current) => ({ ...current, defaultAmountDkk: Number(event.target.value) }))}
                        className="mt-2 min-h-11 w-full rounded-md border border-navy/20 bg-white px-3 text-base"
                      />
                    </label>
                  </div>
                  <button type="button" disabled={createFineTypeDisabled} onClick={createFineType} className="mt-3 min-h-12 w-full rounded-md bg-footballBlue px-4 text-base font-bold text-white disabled:bg-navy/40">
                    {adminBusyId === 'create-fine-type' ? 'Creating...' : 'Create fine type'}
                  </button>
                </div>
              ) : null}

              {fineBox.fineTypes.length === 0 ? (
                <p className="mt-4 text-sm text-navy/70">No fine types yet.</p>
              ) : (
                <div className="mt-4 divide-y divide-navy/10">
                  {fineBox.fineTypes.map((fineType) => (
                    <div key={fineType.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <p className="break-words text-sm font-bold text-navy">{fineType.name}</p>
                        <p className="mt-1 text-xs font-semibold text-navy/60">
                          {fineType.default_amount_dkk} DKK · {fineType.is_active ? 'Active' : 'Inactive'}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={adminBusyId !== null}
                        onClick={() => void updateFineType(fineType)}
                        className="min-h-11 shrink-0 rounded-md border border-footballBlue px-3 text-sm font-bold text-footballBlue disabled:border-navy/10 disabled:text-navy/40"
                      >
                        {adminBusyId === `fine-type-${fineType.id}` ? 'Saving...' : fineType.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          {showCreateFine && isAdmin ? (
            <div className="rounded-lg border border-navy/10 bg-white p-4">
              <h3 className="text-base font-bold text-navy">Add fine</h3>
              <div className="mt-4 grid gap-3">
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-navy">Participants</p>
                    <span className="rounded-md bg-mist px-2 py-1 text-xs font-bold text-navy">{fineDraft.participants.length} selected</span>
                  </div>
                  <div className="mt-2 overflow-hidden rounded-md border border-navy/10">
                    {fineBox.participants.map((participant) => {
                      const participantKey = `${participant.kind}:${participant.id}`;
                      const isSelected = fineDraft.participants.some((item) => item.kind === participant.kind && item.id === participant.id);
                      return (
                        <label key={participantKey} className="flex min-h-12 items-center gap-3 border-b border-navy/10 bg-white px-3 py-2 text-sm font-semibold text-navy last:border-b-0">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleParticipant(participant.kind, participant.id)}
                            className="h-5 w-5 shrink-0 accent-footballBlue"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block break-words">{participant.first_name}</span>
                            {participant.kind === 'guest' ? <span className="mt-1 block text-xs font-bold text-footballBlue">Guest{participant.context ? ` · ${participant.context}` : ''}</span> : null}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
                <label className="text-sm font-semibold text-navy">
                  Fine type
                  <select
                    value={fineDraft.fineTypeId ?? ''}
                    onChange={(event) => {
                      const fineType = activeFineTypes.find((item) => item.id === event.target.value);
                      setFineDraft((current) =>
                        fineType
                          ? { ...current, fineTypeId: fineType.id, description: fineType.name, amountDkk: fineType.default_amount_dkk }
                          : { ...current, fineTypeId: null },
                      );
                    }}
                    className="mt-2 min-h-11 w-full rounded-md border border-navy/20 bg-white px-3 text-base"
                  >
                    <option value="">Custom fine</option>
                    {activeFineTypes.map((fineType) => (
                      <option key={fineType.id} value={fineType.id}>
                        {fineType.name} - {fineType.default_amount_dkk} DKK
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm font-semibold text-navy">
                  Description
                  <input value={fineDraft.description} onChange={(event) => setFineDraft((current) => ({ ...current, description: event.target.value }))} className="mt-2 min-h-11 w-full rounded-md border border-navy/20 px-3 text-base" />
                </label>
                <label className="text-sm font-semibold text-navy">
                  Amount DKK
                  <input type="number" min="1" step="1" value={fineDraft.amountDkk} onChange={(event) => setFineDraft((current) => ({ ...current, amountDkk: Number(event.target.value) }))} className="mt-2 min-h-11 w-full rounded-md border border-navy/20 px-3 text-base" />
                </label>
              </div>
              <button type="button" disabled={createDisabled} onClick={createFine} className="mt-4 min-h-12 w-full rounded-md bg-footballBlue px-4 text-base font-bold text-white disabled:bg-navy/40">
                {adminBusyId === 'create-fine' ? 'Adding...' : createFineButtonLabel}
              </button>
            </div>
          ) : null}

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

          <div className="rounded-lg border border-navy/10 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-bold text-navy">Fine history</h3>
              <span className="shrink-0 rounded-md bg-mist px-2 py-1 text-xs font-bold text-navy">{visibleFines.length} shown</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {fineStatusFilters.map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => {
                    setStatusFilter(filter);
                    setExpandedFineIds([]);
                  }}
                  className={`min-h-11 rounded-md border px-3 text-sm font-bold ${statusFilter === filter ? 'border-footballBlue bg-footballBlue text-white' : 'border-navy/15 bg-white text-navy'}`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          {fineBox.fines.length === 0 ? (
            <div className="rounded-lg border border-navy/10 bg-white p-4">
              <h3 className="text-base font-bold text-navy">No fines yet</h3>
              <p className="mt-2 text-sm text-navy/70">Fine history will appear here after an Admin creates fines.</p>
            </div>
          ) : visibleFines.length === 0 ? (
            <div className="rounded-lg border border-navy/10 bg-white p-4">
              <h3 className="text-base font-bold text-navy">No {statusFilter.toLowerCase()} fines</h3>
              <p className="mt-2 text-sm text-navy/70">Choose another status to see more Fine Box history.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-navy/10 bg-white">
              {visibleFines.map((fine) => (
                <FineRow
                  key={fine.id}
                  fine={fine}
                  selected={selectedFineIds.includes(fine.id)}
                  expanded={expandedFineIds.includes(fine.id)}
                  canSelect={myUnpaidFines.some((item) => item.id === fine.id)}
                  isAdmin={isAdmin}
                  busyId={adminBusyId}
                  onToggle={() => toggleFine(fine.id)}
                  onToggleDetails={() => toggleFineDetails(fine.id)}
                  onUpdateStatus={updateFineStatus}
                />
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

function FineRow({
  fine,
  selected,
  expanded,
  canSelect,
  isAdmin,
  busyId,
  onToggle,
  onToggleDetails,
  onUpdateStatus,
}: {
  fine: FineRecord;
  selected: boolean;
  expanded: boolean;
  canSelect: boolean;
  isAdmin: boolean;
  busyId: string | null;
  onToggle: () => void;
  onToggleDetails: () => void;
  onUpdateStatus: (input: UpdateFineStatusInput) => Promise<void>;
}) {
  const canConfirm = isAdmin && fine.payment_status === 'Payment reported';
  const canWaive = isAdmin && (fine.payment_status === 'Unpaid' || fine.payment_status === 'Payment reported');

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
      <button type="button" onClick={onToggleDetails} className="mt-3 min-h-11 w-full rounded-md border border-navy/15 bg-white px-3 text-sm font-bold text-navy">
        {expanded ? 'Hide details' : 'Show details'}
      </button>
      {expanded ? <FineDetails fine={fine} /> : null}
      {isAdmin && (canConfirm || canWaive) ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={!canConfirm || busyId !== null}
            onClick={() => onUpdateStatus({ fineId: fine.id, action: 'confirm-paid' })}
            className="min-h-11 rounded-md bg-footballBlue px-3 text-sm font-bold text-white disabled:bg-navy/35"
          >
            {busyId === `confirm-paid-${fine.id}` ? 'Confirming...' : 'Confirm paid'}
          </button>
          <button
            type="button"
            disabled={!canWaive || busyId !== null}
            onClick={() => onUpdateStatus({ fineId: fine.id, action: 'waive' })}
            className="min-h-11 rounded-md border border-red-200 px-3 text-sm font-bold text-red-800 disabled:border-navy/10 disabled:text-navy/40"
          >
            {busyId === `waive-${fine.id}` ? 'Waiving...' : 'Waive'}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function FineDetails({ fine }: { fine: FineRecord }) {
  return (
    <div className="mt-3 rounded-md bg-mist p-3">
      <h4 className="text-sm font-bold text-navy">Fine details</h4>
      <dl className="mt-2 grid gap-2 text-sm">
        <DetailRow label="Participant" value={`${fine.first_name}${fine.participant_kind === 'guest' ? ' · Guest' : ''}`} />
        <DetailRow label="Reason" value={fine.fine_type_name ?? 'Custom fine'} />
        <DetailRow label="Description" value={fine.description} />
        <DetailRow label="Status" value={fine.payment_status} />
        <DetailRow label="Created" value={formatFineDate(fine.created_at)} />
        {fine.related_event_title ? <DetailRow label="Event" value={`${fine.related_event_title}${fine.related_event_date ? ` · ${formatFineDate(fine.related_event_date)}` : ''}`} /> : null}
        {fine.payment_reported_at ? <DetailRow label="Reported" value={formatFineDate(fine.payment_reported_at)} /> : null}
        {fine.payment_confirmed_at ? <DetailRow label="Confirmed paid" value={formatFineDate(fine.payment_confirmed_at)} /> : null}
        {fine.waived_at ? <DetailRow label="Waived" value={formatFineDate(fine.waived_at)} /> : null}
      </dl>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-2">
      <dt className="font-bold text-navy/60">{label}</dt>
      <dd className="break-words font-semibold text-navy">{value}</dd>
    </div>
  );
}

function formatFineDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: value.includes('T') ? '2-digit' : undefined,
    minute: value.includes('T') ? '2-digit' : undefined,
  }).format(date);
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
