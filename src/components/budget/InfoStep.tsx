"use client";

import NextButton from "@/src/components/budget/NextButton";
import { dollars } from "@/src/lib/budget-format";

interface InfoStepProps {
  step: number;
  tag: string;
  name: string;
  totalToSpend: number;
  /** Current fiscal year, e.g. "2027". */
  fiscalYear: string;
  /** Prior fiscal year, e.g. "2026". */
  priorFiscalYear: string;
  /** The uniform raise applied to every department (e.g. 0.018 for 1.8%). */
  baselineRaise: number;
  /** Unallocated funds left after the baseline raise, for the user to direct. */
  baselineRemaining: number;
  onNext: () => void;
}

const paragraphStyle: React.CSSProperties = {
  fontSize: "1rem",
  lineHeight: 1.6,
};

/**
 * Welcome steps 3–6: informational onboarding. Steps 3–5 accumulate the same
 * paragraphs; step 6 is a standalone note. The last step reveals the chart.
 */
export default function InfoStep({
  step,
  name,
  tag,
  totalToSpend,
  fiscalYear,
  priorFiscalYear,
  baselineRaise,
  baselineRemaining,
  onNext,
}: InfoStepProps) {
  const step3 = (
    <p className="lede" style={paragraphStyle}>
      You have <strong>{dollars.format(totalToSpend)}</strong>
      {" to spend, which is the same as Parker’s proposed "}
      {fiscalYear} budget. This is a {(baselineRaise * 100).toFixed(1)}%
      increase from FY{priorFiscalYear}. That has been applied to all of the
      departments, with <strong>{dollars.format(baselineRemaining)}</strong>{" "}
      left over to allocate. Click on a department to add or remove funds.
    </p>
  );

  const step4 = (
    <p className="lede" style={paragraphStyle}>
      Each of your decisions has outcomes. When you add or remove funding, you
      need to include those.
    </p>
  );

  const step5 = (
    <p className="lede" style={paragraphStyle}>
      Once you are done, you can review your budget before it is set in PDF.
    </p>
  );

  return (
    <>
      <h1>{step === 6 ? "WAIT…" : name}</h1>
      <h2 className="py-4 text-2xl text-gray-400 italic">{tag}</h2>
      {step === 3 && <>{step3}</>}
      {step === 4 && (
        <>
          {step3} {step4}
        </>
      )}
      {step === 5 && (
        <>
          {step3} {step4} {step5}
        </>
      )}
      {step === 6 && (
        <p className="lede" style={paragraphStyle}>
          Can&rsquo;t a mayor propose new funds? Yes, that functionality will be
          added soon.
        </p>
      )}
      <div style={{ marginTop: "1.5rem" }}>
        <NextButton onClick={onNext} enabled />
      </div>
    </>
  );
}
