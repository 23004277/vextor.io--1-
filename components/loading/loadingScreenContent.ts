export type LoadingPhase = 'unlocking' | 'revealing';

type LoadingPhaseContent = {
  eyebrow: string;
  title: string;
  description: string;
  progressLabel: string;
  sequenceLabel: string;
  statuses: Array<{
    label: string;
    unlockingValue: string;
    revealingValue: string;
  }>;
};

export const LOADING_PHASE_CONTENT: Record<LoadingPhase, LoadingPhaseContent> = {
  unlocking: {
    eyebrow: 'System Bootstrap',
    title: 'Calibrating Vextor',
    description: 'Audio, reactor telemetry, and interface systems are coming online in one clean boot pass.',
    progressLabel: 'Syncing audio core, reactor telemetry, and menu shell',
    sequenceLabel: 'Stage 1 / 2',
    statuses: [
      { label: 'Audio Core', unlockingValue: 'Igniting', revealingValue: 'Stable' },
      { label: 'Telemetry', unlockingValue: 'Linking', revealingValue: 'Live' },
      { label: 'Command Deck', unlockingValue: 'Building', revealingValue: 'Handing Off' },
    ],
  },
  revealing: {
    eyebrow: 'Command Deck Finalization',
    title: 'Sealing Menu Uplink',
    description: 'The deck is already compiled. Final handoff checks are clearing before live control is released.',
    progressLabel: 'Finalizing render pass and control handoff',
    sequenceLabel: 'Stage 2 / 2',
    statuses: [
      { label: 'Audio Core', unlockingValue: 'Igniting', revealingValue: 'Stable' },
      { label: 'Telemetry', unlockingValue: 'Linking', revealingValue: 'Live' },
      { label: 'Command Deck', unlockingValue: 'Building', revealingValue: 'Handing Off' },
    ],
  },
};

export const getLoadingStatusValue = (
  phase: LoadingPhase,
  status: LoadingPhaseContent['statuses'][number],
) => (phase === 'unlocking' ? status.unlockingValue : status.revealingValue);
