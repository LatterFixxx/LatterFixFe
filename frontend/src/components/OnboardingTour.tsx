import React, { useEffect, useState } from 'react';
import { ACTIONS, EVENTS, Joyride, STATUS, type EventData, type Step } from 'react-joyride';
import { useNavigate } from 'react-router-dom';

const TOUR_STEPS: Step[] = [
  {
    target: '#tour-welcome',
    content: "Welcome to LatterFix! Let's take a quick tour to get your organization started.",
    placement: 'bottom',
    skipBeacon: true,
  },
  {
    target: '#tour-connect',
    content: 'First, connect your Stellar wallet to securely manage your organization.',
    placement: 'bottom',
  },
  {
    target: '#tour-employees',
    content: 'Head here to set up your organization and manage your workforce.',
    placement: 'bottom',
  },
  {
    target: '#tour-add-employee',
    content: 'Add your employees here — one at a time, or bulk import via CSV.',
    placement: 'right',
  },
  {
    target: '#tour-payroll',
    content: 'Once your team is set up, track and run payroll batches from here.',
    placement: 'top',
  },
  {
    target: '#tour-init-payroll',
    content: 'Fund your distribution account so payroll runs have the balance to pay your team.',
    placement: 'top',
  },
];

/** Steps that only exist on the Bulk Payments page — the tour must navigate there first. */
const BULK_PAYMENTS_TARGET_IDS = new Set(['#tour-add-employee', '#tour-payroll', '#tour-init-payroll']);

/** Polls for a selector to appear in the DOM, e.g. after a route change, up to `timeoutMs`. */
function waitForTarget(selector: string, timeoutMs = 2000): Promise<void> {
  return new Promise((resolve) => {
    const start = Date.now();
    const check = () => {
      if (document.querySelector(selector) || Date.now() - start > timeoutMs) {
        resolve();
        return;
      }
      requestAnimationFrame(check);
    };
    check();
  });
}

export const OnboardingTour: React.FC<{
  run: boolean;
  onComplete: () => void;
}> = ({ run, onComplete }) => {
  const [stepIndex, setStepIndex] = useState(0);
  const navigate = useNavigate();

  // Reset to the first step whenever a fresh tour run is requested.
  useEffect(() => {
    if (run) setStepIndex(0);
  }, [run]);

  const handleJoyrideEvent = (data: EventData) => {
    const { status, action, index, type } = data;
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

    if (finishedStatuses.includes(status)) {
      onComplete();
      setStepIndex(0);
      return;
    }

    if (type === EVENTS.STEP_AFTER) {
      const nextIndex = index + (action === ACTIONS.PREV ? -1 : 1);
      const nextStep = TOUR_STEPS[nextIndex];
      const nextTarget = nextStep?.target as string | undefined;

      if (nextTarget && BULK_PAYMENTS_TARGET_IDS.has(nextTarget)) {
        void navigate('/bulk-payments');
      }

      // Wait for the next step's target to actually be in the DOM (route
      // changes render asynchronously) before advancing Joyride to it.
      void (nextTarget ? waitForTarget(nextTarget) : Promise.resolve()).then(() =>
        setStepIndex(nextIndex)
      );
    }
  };

  return (
    <Joyride
      steps={TOUR_STEPS}
      run={run}
      stepIndex={stepIndex}
      continuous
      onEvent={handleJoyrideEvent}
      options={{
        buttons: ['back', 'skip', 'primary'],
        showProgress: true,
        primaryColor: '#4AF0B8',
        backgroundColor: '#111827',
        arrowColor: '#111827',
        zIndex: 10000,
      }}
      styles={{
        tooltip: {
          borderRadius: '12px',
          padding: '20px',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
          color: '#fff',
        },
        tooltipContent: {
          padding: '10px 0',
          fontSize: '14px',
          lineHeight: '1.5',
        },
        buttonPrimary: {
          backgroundColor: '#4AF0B8',
          color: '#000',
          fontWeight: '800',
          borderRadius: '8px',
          padding: '10px 20px',
        },
        buttonBack: {
          color: '#9CA3AF',
          fontWeight: '600',
          marginRight: '10px',
        },
        buttonSkip: {
          color: '#9CA3AF',
          fontSize: '13px',
        },
        overlay: {
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(3px)',
        },
      }}
    />
  );
};
