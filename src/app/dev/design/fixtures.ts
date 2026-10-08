import type { CandidateDetail } from "@/lib/candidate"

// Design-review fixtures: four records copied verbatim from data/candidates.json (images are real).
// Used only by /dev/design — never by search or tests.
export const FIXTURE_CANDIDATES: CandidateDetail[] = [
  {
    "id": "cand_0001",
    "full_name": "Amara Cohen",
    "avatar_url": "https://rotto.com/rotto/full-stack-assessment/avatars/avatar-038.svg",
    "headline": "DevOps Engineer · Ansible, CI/CD, Datadog",
    "current_title": "DevOps Engineer",
    "current_company": "Copperline",
    "current_company_logo_url": "https://rotto.com/rotto/full-stack-assessment/logos/copperline.svg",
    "role": "DevOps Engineer",
    "seniority": "mid",
    "years_experience": 4,
    "location": {
      "city": "New York",
      "state": "NY",
      "country": "US"
    },
    "open_to_work": false,
    "skills": [
      "Ansible",
      "CI/CD",
      "Datadog",
      "Docker",
      "GCP",
      "Terraform"
    ],
    "experiences": [
      {
        "title": "DevOps Engineer",
        "company": "Copperline",
        "company_logo_url": "https://rotto.com/rotto/full-stack-assessment/logos/copperline.svg",
        "company_type": "startup",
        "start_year": 2024,
        "end_year": null
      },
      {
        "title": "Junior DevOps Engineer",
        "company": "Copperline",
        "company_logo_url": "https://rotto.com/rotto/full-stack-assessment/logos/copperline.svg",
        "company_type": "startup",
        "start_year": 2022,
        "end_year": 2024
      }
    ],
    "education": [
      {
        "school": "University of Texas at Austin",
        "degree": "BS",
        "field": "Computer Science",
        "graduation_year": 2022
      }
    ]
  },
  {
    "id": "cand_0003",
    "full_name": "Priya Lee",
    "avatar_url": "https://rotto.com/rotto/full-stack-assessment/avatars/avatar-012.svg",
    "headline": "Staff DevOps Engineer · Ansible, Datadog, Linux",
    "current_title": "Staff DevOps Engineer",
    "current_company": "Tidal Health",
    "current_company_logo_url": "https://rotto.com/rotto/full-stack-assessment/logos/tidal-health.svg",
    "role": "DevOps Engineer",
    "seniority": "staff",
    "years_experience": 10,
    "location": {
      "city": "New York",
      "state": "NY",
      "country": "US"
    },
    "open_to_work": true,
    "skills": [
      "Ansible",
      "Datadog",
      "Linux",
      "Terraform"
    ],
    "experiences": [
      {
        "title": "Staff DevOps Engineer",
        "company": "Tidal Health",
        "company_logo_url": "https://rotto.com/rotto/full-stack-assessment/logos/tidal-health.svg",
        "company_type": "startup",
        "start_year": 2025,
        "end_year": null
      },
      {
        "title": "Senior DevOps Engineer",
        "company": "Pebblepay",
        "company_logo_url": "https://rotto.com/rotto/full-stack-assessment/logos/pebblepay.svg",
        "company_type": "startup",
        "start_year": 2022,
        "end_year": 2025
      },
      {
        "title": "DevOps Engineer",
        "company": "Northwind AI",
        "company_logo_url": "https://rotto.com/rotto/full-stack-assessment/logos/northwind-ai.svg",
        "company_type": "startup",
        "start_year": 2019,
        "end_year": 2022
      },
      {
        "title": "Junior DevOps Engineer",
        "company": "Meridian Financial",
        "company_logo_url": "https://rotto.com/rotto/full-stack-assessment/logos/meridian-financial.svg",
        "company_type": "enterprise",
        "start_year": 2016,
        "end_year": 2019
      }
    ],
    "education": [
      {
        "school": "New York University",
        "degree": "BS",
        "field": "Computer Science",
        "graduation_year": 2016
      }
    ]
  },
  {
    "id": "cand_0023",
    "full_name": "Chloe Moreau",
    "avatar_url": "https://rotto.com/rotto/full-stack-assessment/avatars/avatar-052.svg",
    "headline": "Senior Product Designer · Interaction Design, Prototyping, User Research",
    "current_title": "Senior Product Designer",
    "current_company": "Ironclad Systems",
    "current_company_logo_url": "https://rotto.com/rotto/full-stack-assessment/logos/ironclad-systems.svg",
    "role": "Product Designer",
    "seniority": "senior",
    "years_experience": 7,
    "location": {
      "city": "Austin",
      "state": "TX",
      "country": "US"
    },
    "open_to_work": true,
    "skills": [
      "Interaction Design",
      "Prototyping",
      "User Research",
      "Webflow"
    ],
    "experiences": [
      {
        "title": "Senior Product Designer",
        "company": "Ironclad Systems",
        "company_logo_url": "https://rotto.com/rotto/full-stack-assessment/logos/ironclad-systems.svg",
        "company_type": "enterprise",
        "start_year": 2025,
        "end_year": null
      }
    ],
    "education": [
      {
        "school": "University of Michigan",
        "degree": "BA",
        "field": "Psychology",
        "graduation_year": 2019
      }
    ]
  },
  {
    "id": "cand_0006",
    "full_name": "Yara Cohen",
    "avatar_url": "https://rotto.com/rotto/full-stack-assessment/avatars/avatar-023.svg",
    "headline": "Junior Product Manager · A/B Testing, Jira, Pricing",
    "current_title": "Junior Product Manager",
    "current_company": "Atlas Retail",
    "current_company_logo_url": "https://rotto.com/rotto/full-stack-assessment/logos/atlas-retail.svg",
    "role": "Product Manager",
    "seniority": "junior",
    "years_experience": 0,
    "location": {
      "city": "Seattle",
      "state": "WA",
      "country": "US"
    },
    "open_to_work": false,
    "skills": [
      "A/B Testing",
      "Jira",
      "Pricing",
      "Roadmapping",
      "SQL",
      "User Research"
    ],
    "experiences": [
      {
        "title": "Junior Product Manager",
        "company": "Atlas Retail",
        "company_logo_url": "https://rotto.com/rotto/full-stack-assessment/logos/atlas-retail.svg",
        "company_type": "enterprise",
        "start_year": 2026,
        "end_year": null
      }
    ],
    "education": [
      {
        "school": "University of Illinois",
        "degree": "MBA",
        "field": "Marketing",
        "graduation_year": 2025
      }
    ]
  }
]
