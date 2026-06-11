/** Row shapes as returned by Supabase (snake_case mirrors the schema). */

export interface ScoreFactor {
  key: string;
  label: string;
  points: number;
  max: number;
  detail: string;
}

export interface ScoreBreakdown {
  leadScore: ScoreFactor[];
  closeProbability: ScoreFactor[];
  contractValue: {
    base: number;
    employeeMultiplier: number;
    revenueMultiplier: number;
    multiLocationMultiplier: number;
    capApplied: string | null;
  };
}

export interface AutomationOpportunity {
  id: string;
  name: string;
  description: string;
}

export type WebsiteQuality =
  | "none"
  | "broken"
  | "social_only"
  | "basic"
  | "good"
  | "sophisticated";

export type PipelineStage =
  | "not_contacted"
  | "contacted"
  | "follow_up"
  | "meeting_booked"
  | "proposal_sent"
  | "closed_won"
  | "closed_lost";

export interface Business {
  id: string;
  place_id: string;
  name: string;
  brand_key: string | null;
  formatted_address: string | null;
  street_address: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  website: string | null;
  website_domain: string | null;
  google_maps_url: string | null;
  google_rating: number | null;
  review_count: number | null;
  google_primary_type: string | null;
  google_types: string[] | null;
  business_status: string | null;
  industry: string;
  also_matched_industries: string[];
  search_city: string | null;
  is_multi_location: boolean;
  location_count: number;
  website_quality: WebsiteQuality | null;
  website_probe: Record<string, unknown> | null;
  apollo_org_id: string | null;
  owner_name: string | null;
  owner_title: string | null;
  owner_email: string | null;
  owner_linkedin_url: string | null;
  company_linkedin_url: string | null;
  employee_count: number | null;
  revenue_estimate: number | null;
  apollo_industry: string | null;
  company_description: string | null;
  founded_year: number | null;
  apollo_attempted_at: string | null;
  apollo_matched: boolean | null;
  lead_score: number | null;
  close_probability: number | null;
  estimated_contract_value: number | null;
  expected_monthly_value: number | null;
  score_breakdown: ScoreBreakdown | null;
  automation_opportunities: AutomationOpportunity[] | null;
  scored_at: string | null;
  pipeline_stage?: PipelineStage; // added by the Phase 2 migration
  google_fetched_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Lightweight map pin payload. */
export interface MapPoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
  score: number | null;
  industry: string;
}

export interface Note {
  id: string;
  business_id: string;
  content: string;
  created_at: string;
}

export interface Activity {
  id: string;
  business_id: string;
  type: string;
  from_stage: string | null;
  to_stage: string | null;
  detail: string | null;
  created_at: string;
}

export interface Reminder {
  id: string;
  business_id: string;
  note: string;
  due_at: string;
  completed_at: string | null;
  created_at: string;
  businesses?: { name: string } | null;
}

export type AiContentType =
  | "summary"
  | "cold_email"
  | "call_script"
  | "linkedin_message"
  | "follow_up_email";

export interface AiContent {
  id: string;
  business_id: string;
  content_type: AiContentType;
  content: string;
  model: string;
  generated_at: string;
}

/** Shared filter params accepted by list / map / leaderboard / export endpoints. */
export interface BusinessFilters {
  city?: string;
  industry?: string;
  minScore?: number;
  minCloseProb?: number;
  minValue?: number;
  minEmployees?: number;
  minReviews?: number;
  minRevenue?: number;
  stage?: string;
  q?: string;
}
