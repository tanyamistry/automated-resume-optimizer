# Automated Resume Customizer

MVP LaTeX resume ATS optimizer for tailoring a structured resume source to a job description while preserving authenticity.

## Setup

Install dependencies and run:

```bash
npm install
npm run dev
```

No paid AI API key is required. The MVP uses local rule-based scoring and conservative structured rewrite suggestions.

## MVP workflow

1. Paste a LaTeX resume source that uses the supported resume template commands.
2. Paste the job description.
3. Generate optimized structured changes.
4. Review the live resume preview with optimized wording already inserted.
5. Approve, reject, or manually edit each proposed change.
6. Copy the final optimized LaTeX source.

Supported MVP commands include `\resumeSubheading`, `\resumeProjectHeading`, `\resumeItemListStart`, `\resumeItem`, and `\resumeItemListEnd`.
