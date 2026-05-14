import type { ResumeDocument } from "@/lib/types";

type LatexResumePreviewProps = {
  doc: ResumeDocument;
  changedPaths: string[];
};

export function LatexResumePreview({ doc, changedPaths }: LatexResumePreviewProps) {
  const changed = new Set(changedPaths);

  return (
    <section className="latex-preview" aria-label="Resume preview">
      <header className="resume-header-preview">
        <h1>{doc.contact.name || "Resume Preview"}</h1>
        <p>
          {[doc.contact.email, doc.contact.phone].filter(Boolean).join(" | ") ||
            "Contact details from LaTeX header"}
        </p>
      </header>

      {doc.summary ? (
        <PreviewSection title="Summary">
          <p className={changed.has("summary") ? "changed-text" : ""}>{doc.summary}</p>
        </PreviewSection>
      ) : null}

      <PreviewSection title="Experience">
        {doc.experience.map((item, itemIndex) => (
          <div className="preview-entry" key={`${item.company}-${itemIndex}`}>
            <div className="preview-entry-heading">
              <div>
                <strong>{item.company}</strong>
                <span>{item.title}</span>
              </div>
              <div>
                <span>{item.dates}</span>
                <span>{item.location}</span>
              </div>
            </div>
            <ul>
              {item.bullets.map((bullet, bulletIndex) => (
                <li
                  className={
                    changed.has(`experience.${itemIndex}.bullets.${bulletIndex}`)
                      ? "changed-text"
                      : ""
                  }
                  key={`${bullet}-${bulletIndex}`}
                >
                  {bullet}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </PreviewSection>

      <PreviewSection title="Projects">
        {doc.projects.map((item, itemIndex) => (
          <div className="preview-entry" key={`${item.name}-${itemIndex}`}>
            <div className="preview-entry-heading">
              <div>
                <strong>{item.name}</strong>
                {item.techStack ? <span>{item.techStack}</span> : null}
              </div>
              <div>{item.dates ? <span>{item.dates}</span> : null}</div>
            </div>
            <ul>
              {item.bullets.map((bullet, bulletIndex) => (
                <li
                  className={
                    changed.has(`projects.${itemIndex}.bullets.${bulletIndex}`)
                      ? "changed-text"
                      : ""
                  }
                  key={`${bullet}-${bulletIndex}`}
                >
                  {bullet}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </PreviewSection>

      <PreviewSection title="Education">
        {doc.education.map((item, index) => (
          <div className="preview-entry-heading compact" key={`${item.institution}-${index}`}>
            <div>
              <strong>{item.institution}</strong>
              <span>{item.degree}</span>
            </div>
            <div>
              <span>{item.dates}</span>
              <span>{item.location}</span>
            </div>
          </div>
        ))}
      </PreviewSection>

      <PreviewSection title="Technical Skills">
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
    </section>
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
