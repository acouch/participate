"use client";

import NameStep from "@/src/components/budget/NameStep";
import TaglineStep from "@/src/components/budget/TaglineStep";
import InfoStep from "@/src/components/budget/InfoStep";

interface WelcomeFlowProps {
  step: number;
  name: string;
  totalToSpend: number;
  /** Current fiscal year, e.g. "2027". */
  fiscalYear: string;
  /** Prior fiscal year, e.g. "2026". */
  priorFiscalYear: string;
  /** The uniform raise applied to every department (e.g. 0.018 for 1.8%). */
  baselineRaise: number;
  /** Unallocated funds before any edits. */
  baselineRemaining: number;
  nameDraft: string;
  taglineDraft: string;
  onNameDraftChange: (value: string) => void;
  onTaglineDraftChange: (value: string) => void;
  onSubmitName: () => void;
  onSubmitTagline: () => void;
  onNext: () => void;
}

/**
 * Multi-step welcome shown until the budget is "started". Step 1 collects the
 * name, step 2 the tagline, and steps 3–6 are informational onboarding.
 */
export default function WelcomeFlow({
  step,
  name,
  totalToSpend,
  fiscalYear,
  priorFiscalYear,
  baselineRaise,
  baselineRemaining,
  nameDraft,
  taglineDraft,
  onNameDraftChange,
  onTaglineDraftChange,
  onSubmitName,
  onSubmitTagline,
  onNext,
}: WelcomeFlowProps) {
  return (
    <div className="hero max-w-3xl py-1">
      {step === 1 ? (
        <NameStep
          totalToSpend={totalToSpend}
          fiscalYear={fiscalYear}
          priorFiscalYear={priorFiscalYear}
          nameDraft={nameDraft}
          onNameDraftChange={onNameDraftChange}
          onSubmit={onSubmitName}
        />
      ) : step === 2 ? (
        <TaglineStep
          name={name}
          taglineDraft={taglineDraft}
          onTaglineDraftChange={onTaglineDraftChange}
          onSubmit={onSubmitTagline}
        />
      ) : (
        <InfoStep
          step={step}
          name={name}
          tag={taglineDraft}
          totalToSpend={totalToSpend}
          fiscalYear={fiscalYear}
          priorFiscalYear={priorFiscalYear}
          baselineRaise={baselineRaise}
          baselineRemaining={baselineRemaining}
          onNext={onNext}
        />
      )}
    </div>
  );
}
