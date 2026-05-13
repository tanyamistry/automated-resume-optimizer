# Automated Resume Customizer

MVP resume ATS optimizer for tailoring Google Docs resume text or a PDF resume to a job description while preserving authenticity.

## Setup

Install dependencies and run:

```bash
npm install
npm run dev
```

No paid AI API key is required. The MVP uses local rule-based scoring and conservative rewrite suggestions.

## MVP workflow

1. Upload a text-based resume PDF or paste resume text.
2. Paste the job description.
3. Review matched, missing, and weak keywords.
4. Approve individual bullet edits.
5. Download an optimized `.txt` resume draft for Google Docs.
