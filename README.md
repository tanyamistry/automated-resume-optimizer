# Automated Resume Customizer

MVP DOCX resume ATS optimizer for tailoring resume wording to a job description while preserving the original document package as much as possible.

## Setup

Install dependencies and run:

```bash
npm install
npm run dev
```

No paid AI API key is required. The MVP uses local rule-based scoring and conservative structured replacement suggestions.

## MVP workflow

1. Upload a DOCX resume, or upload a PDF for parsing-only review.
2. Paste the job description.
3. Generate optimized bullet and skills replacements.
4. Review the parsed resume preview with changed wording inserted.
5. Approve, reject, or manually edit each proposed replacement.
6. Export an updated DOCX.

DOCX export patches text inside the original `.docx` package instead of regenerating the whole resume from scratch. PDF export is not implemented yet.
