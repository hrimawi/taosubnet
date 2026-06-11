import type { PipelineStage } from "../types";

/** CRM pipeline stages, in board order. */
export const PIPELINE_STAGES: {
  slug: PipelineStage;
  label: string;
  badgeClass: string;
  dotClass: string;
}[] = [
  {
    slug: "not_contacted",
    label: "Not Contacted",
    badgeClass: "bg-slate-500/15 text-slate-300 border-slate-500/30",
    dotClass: "bg-slate-400",
  },
  {
    slug: "contacted",
    label: "Contacted",
    badgeClass: "bg-sky-500/15 text-sky-300 border-sky-500/30",
    dotClass: "bg-sky-400",
  },
  {
    slug: "follow_up",
    label: "Follow Up",
    badgeClass: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    dotClass: "bg-amber-400",
  },
  {
    slug: "meeting_booked",
    label: "Meeting Booked",
    badgeClass: "bg-violet-500/15 text-violet-300 border-violet-500/30",
    dotClass: "bg-violet-400",
  },
  {
    slug: "proposal_sent",
    label: "Proposal Sent",
    badgeClass: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30",
    dotClass: "bg-indigo-400",
  },
  {
    slug: "closed_won",
    label: "Closed Won",
    badgeClass: "bg-green-500/15 text-green-300 border-green-500/30",
    dotClass: "bg-green-400",
  },
  {
    slug: "closed_lost",
    label: "Closed Lost",
    badgeClass: "bg-red-500/15 text-red-300 border-red-500/30",
    dotClass: "bg-red-400",
  },
];

export const STAGE_BY_SLUG = Object.fromEntries(
  PIPELINE_STAGES.map((s) => [s.slug, s]),
) as Record<PipelineStage, (typeof PIPELINE_STAGES)[number]>;

export const STAGE_SLUGS = PIPELINE_STAGES.map((s) => s.slug);

export function isValidStage(v: string): v is PipelineStage {
  return (STAGE_SLUGS as string[]).includes(v);
}
