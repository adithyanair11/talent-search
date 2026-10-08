/**
 * The closed vocabularies of the candidate data (docs/data-notes.md §2). Every search filter value must be
 * one of these exact strings; `vocabulary.test.ts` checks them against data/candidates.json.
 */

export const ROLES = [
  'Frontend Engineer',
  'Full Stack Engineer',
  'Backend Engineer',
  'Product Designer',
  'Product Manager',
  'Data Engineer',
  'Data Scientist',
  'Machine Learning Engineer',
  'Mobile Engineer',
  'Account Executive',
  'DevOps Engineer',
  'Marketing Manager',
  'Recruiter',
] as const
export type Role = (typeof ROLES)[number]

/** Disjoint years bands: junior 0–2, mid 3–5, senior 6–9, staff 10–15. */
export const SENIORITIES = ['junior', 'mid', 'senior', 'staff'] as const
export type Seniority = (typeof SENIORITIES)[number]

export const CITIES = [
  { city: 'New York', state: 'NY' },
  { city: 'San Francisco', state: 'CA' },
  { city: 'Los Angeles', state: 'CA' },
  { city: 'Seattle', state: 'WA' },
  { city: 'Chicago', state: 'IL' },
  { city: 'Austin', state: 'TX' },
  { city: 'Boston', state: 'MA' },
  { city: 'Denver', state: 'CO' },
  { city: 'Atlanta', state: 'GA' },
  { city: 'Miami', state: 'FL' },
] as const
export const CITY_NAMES: readonly City[] = CITIES.map((c) => c.city)
export type City = (typeof CITIES)[number]['city']

export const STATES = ['NY', 'CA', 'WA', 'IL', 'TX', 'MA', 'CO', 'GA', 'FL'] as const
export type State = (typeof STATES)[number]

export const SKILLS = [
  'Python', 'SQL', 'AWS', 'TypeScript', 'Next.js', 'User Research', 'React', 'Tailwind', 'Kubernetes',
  'GraphQL', 'Postgres', 'Node.js', 'A/B Testing', 'Kafka', 'Design Systems', 'Webflow', 'Vue',
  'Prototyping', 'Figma', 'Interaction Design', 'Svelte', 'Accessibility', 'Ruby on Rails', 'Jira',
  'Roadmapping', 'JavaScript', 'CSS', 'Pricing', 'Analytics', 'Negotiation', 'Java', 'Salesforce',
  'Outbound', 'Enterprise Sales', 'SaaS', 'Redis', 'Go', 'Pipeline Management', 'Rust', 'gRPC',
  'React Native', 'Greenhouse', 'Flutter', 'Employer Branding', 'Sourcing', 'Technical Recruiting',
  'Interviewing', 'Kotlin', 'Brand', 'HubSpot', 'Android', 'Lifecycle Marketing', 'Content Marketing',
  'Swift', 'SEO', 'Paid Social', 'Machine Learning', 'Pandas', 'TensorFlow', 'iOS', 'LLMs', 'R', 'MLOps',
  'PyTorch', 'CUDA', 'Scala', 'Airflow', 'Statistics', 'Snowflake', 'CI/CD', 'Tableau', 'Spark', 'dbt',
  'Datadog', 'GCP', 'Linux', 'Docker', 'Ansible', 'Terraform',
] as const
export type Skill = (typeof SKILLS)[number]

export const COMPANY_TYPES = ['startup', 'enterprise'] as const
export type CompanyType = (typeof COMPANY_TYPES)[number]

export const COMPANIES = [
  { name: 'Copperline', type: 'startup' },
  { name: 'Fernway', type: 'startup' },
  { name: 'Brightpath', type: 'startup' },
  { name: 'Arcadia Robotics', type: 'startup' },
  { name: 'Driftwood Data', type: 'startup' },
  { name: 'Paperplane', type: 'startup' },
  { name: 'Quillstack', type: 'startup' },
  { name: 'Northwind AI', type: 'startup' },
  { name: 'Kitebird', type: 'startup' },
  { name: 'Hexlane', type: 'startup' },
  { name: 'Orbitly', type: 'startup' },
  { name: 'Tidal Health', type: 'startup' },
  { name: 'Mintleaf', type: 'startup' },
  { name: 'Saltbox', type: 'startup' },
  { name: 'Lumen Labs', type: 'startup' },
  { name: 'Pebblepay', type: 'startup' },
  { name: 'Meridian Financial', type: 'enterprise' },
  { name: 'Ironclad Systems', type: 'enterprise' },
  { name: 'Globalcorp', type: 'enterprise' },
  { name: 'Summit Telecom', type: 'enterprise' },
  { name: 'Atlas Retail', type: 'enterprise' },
  { name: 'Harborview Health', type: 'enterprise' },
  { name: 'Keystone Logistics', type: 'enterprise' },
  { name: 'Beacon Energy', type: 'enterprise' },
  { name: 'Titan Software', type: 'enterprise' },
  { name: 'Crescent Media', type: 'enterprise' },
  { name: 'Pinnacle Insurance', type: 'enterprise' },
  { name: 'Evergreen Bank', type: 'enterprise' },
] as const
export type Company = (typeof COMPANIES)[number]['name']
export const COMPANY_NAMES: readonly Company[] = COMPANIES.map((c) => c.name)

export const DEGREES = ['BS', 'BA', 'MS', 'MBA', 'PhD'] as const
export type Degree = (typeof DEGREES)[number]

export const SCHOOLS = [
  'University of Washington',
  'MIT',
  'Georgia Tech',
  'Columbia University',
  'New York University',
  'University of Michigan',
  'Carnegie Mellon University',
  'Cornell University',
  'University of Illinois',
  'Northeastern University',
  'University of Texas at Austin',
  'UC Berkeley',
  'Stanford University',
] as const
export type School = (typeof SCHOOLS)[number]

export const FIELDS_OF_STUDY = [
  'Mathematics',
  'Computer Science',
  'Electrical Engineering',
  'Computer Engineering',
  'Psychology',
  'Economics',
  'Marketing',
  'Business',
  'Communications',
  'Human-Computer Interaction',
  'Design',
  'Fine Arts',
  'Physics',
  'Statistics',
] as const
export type FieldOfStudy = (typeof FIELDS_OF_STUDY)[number]
