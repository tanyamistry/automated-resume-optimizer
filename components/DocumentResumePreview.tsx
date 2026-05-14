import type { ResumeDocument } from "@/lib/types";

type DocumentResumePreviewProps = {
  doc: ResumeDocument;
  changedPaths: string[];
  onAssignUnassignedLine: (
    index: number,
    target: "summary" | "experience" | "projects" | "education" | "skills"
  ) => void;
};

export function DocumentResumePreview({
  doc,
  changedPaths,
  onAssignUnassignedLine
}: DocumentResumePreviewProps) {
  const changed = new Set(changedPaths);
  const hasUnassigned = doc.unassignedLines.length > 0;

  return (
    <section className="document-preview" aria-label="Parsed resume preview">
      <header className="resume-header-preview">
        <h1>{doc.contact.name || "Parsed Resume"}</h1>
        <p>{doc.contact.raw || "Contact details from uploaded resume"}</p>
      </header>

      {doc.summary ? (
        <PreviewSection title="Summary">
          <p className={changed.has("summary") ? "changed-text" : ""}>{doc.summary}</p>
        </PreviewSection>
      ) : null}

      <PreviewSection title="Experience">
        {doc.experience.map((item, itemIndex) => (
          <ResumeEntry
            bullets={item.bullets}
            changed={changed}
            heading={[item.company, item.title].filter(Boolean).join(" | ")}
            key={`${item.company}-${itemIndex}`}
            meta={[item.dates, item.location].filter(Boolean).join(" | ")}
            pathPrefix={`experience.${itemIndex}.bullets`}
          />
        ))}
      </PreviewSection>

      <PreviewSection title="Projects">
        {doc.projects.map((item, itemIndex) => (
          <ResumeEntry
            bullets={item.bullets}
            changed={changed}
            heading={[item.name, item.techStack].filter(Boolean).join(" | ")}
            key={`${item.name}-${itemIndex}`}
            meta={item.dates ?? ""}
            pathPrefix={`projects.${itemIndex}.bullets`}
          />
        ))}
      </PreviewSection>

      <PreviewSection title="Education">
        {doc.education.map((item, index) => (
          <div className="preview-entry" key={`${item.institution}-${index}`}>
            <div className="preview-entry-heading compact">
              <div>
                <strong>{item.institution}</strong>
                <span>{item.degree}</span>
              </div>
              <div>
                <span>{item.dates}</span>
                <span>{item.location}</span>
              </div>
            </div>
            {item.details?.length ? (
              <ul>
                {item.details.map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ))}
      </PreviewSection>

      <PreviewSection title="Skills">
        <div className="preview-skills">
          {Object.entries(doc.skills).map(([category, values]) => (
            <p
              className={changed.has(`skills.${category}`) ? "changed-text" : ""}
              key={category}
            >
              <strong>{category}:</strong> {values.join(", ")}
            </p>
          ))}
        </div>
      </PreviewSection>

      {hasUnassigned ? (
        <PreviewSection title="Unassigned Lines">
          <div className="parser-warning">
            Some content could not be structured yet
          </div>
          <div className="unassigned-list">
            {doc.unassignedLines.map((line, index) => (
              <div className="unassigned-line" key={`${line}-${index}`}>
                <p>{line}</p>
                <div className="button-row">
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => onAssignUnassignedLine(index, "summary")}
                  >
                    Summary
                  </button>
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => onAssignUnassignedLine(index, "experience")}
                  >
                    Experience
                  </button>
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => onAssignUnassignedLine(index, "projects")}
                  >
                    Projects
                  </button>
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => onAssignUnassignedLine(index, "education")}
                  >
                    Education
                  </button>
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => onAssignUnassignedLine(index, "skills")}
                  >
                    Skills
                  </button>
                </div>
              </div>
            ))}
          </div>
        </PreviewSection>
      ) : null}
    </section>
  );
}

function ResumeEntry({
  bullets,
  changed,
  heading,
  meta,
  pathPrefix
}: {
  bullets: string[];
  changed: Set<string>;
  heading: string;
  meta: string;
  pathPrefix: string;
}) {
  return (
    <div className="preview-entry">
      <div className="preview-entry-heading">
        <strong>{heading}</strong>
        <span>{meta}</span>
      </div>
      <ul>
        {bullets.map((bullet, index) => (
          <li
            className={changed.has(`${pathPrefix}.${index}`) ? "changed-text" : ""}
            key={`${bullet}-${index}`}
          >
            {bullet}
          </li>
        ))}
      </ul>
    </div>
  );
}

function PreviewSection({
  children,
  title
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <section className="preview-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}
