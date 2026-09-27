import { useEffect, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Footer9 } from "../Store/Footer9";
import { SiteNav } from "../Store/SiteNav";
import { legalDoc, legalDocs, type DocContent, type LegalSlug } from "./legalDocs";
import "./LegalPage.css";

export function DocPage({
  doc,
  nav,
  note,
  children,
}: {
  doc: DocContent;
  nav?: ReactNode;
  note?: string;
  children?: ReactNode;
}) {
  useEffect(() => {
    window.scrollTo({ top: 0 });
    document.title = `${doc.title} · GameNow`;
  }, [doc.title]);

  return (
    <div className="legal-page">
      <SiteNav />
      <main className="legal-main">
        {nav}

        <header className="legal-head">
          <h1>{doc.title}</h1>
          <p className="legal-lead">{doc.lead}</p>
          <p className="legal-updated">Última actualización: {doc.updated}</p>
        </header>

        <div className="legal-body">
          <aside className="legal-toc" aria-label="En esta página">
            <p>En esta página</p>
            <ol>
              {doc.sections.map((section) => (
                <li key={section.id}>
                  <a href={`#${section.id}`}>{section.title}</a>
                </li>
              ))}
            </ol>
          </aside>

          <article className="legal-article">
            {doc.sections.map((section, index) => (
              <section key={section.id} id={section.id} className="legal-section">
                <h2>
                  <span aria-hidden>{String(index + 1).padStart(2, "0")}</span>
                  {section.title}
                </h2>
                {section.paragraphs?.map((text) => <p key={text}>{text}</p>)}
                {section.steps ? (
                  <ol className="legal-steps">
                    {section.steps.map((text) => (
                      <li key={text}>{text}</li>
                    ))}
                  </ol>
                ) : null}
                {section.list ? (
                  <ul>
                    {section.list.map((text) => (
                      <li key={text}>{text}</li>
                    ))}
                  </ul>
                ) : null}
                {section.table ? (
                  <div className="legal-table-wrap">
                    <table>
                      <thead>
                        <tr>
                          {section.table.head.map((cell) => (
                            <th key={cell} scope="col">
                              {cell}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {section.table.rows.map((row) => (
                          <tr key={row[0]}>
                            {row.map((cell, cellIndex) =>
                              cellIndex === 0 ? (
                                <th key={cell} scope="row">
                                  {cell}
                                </th>
                              ) : (
                                <td key={cell}>{cell}</td>
                              ),
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
                {section.tip ? <p className="legal-tip">{section.tip}</p> : null}
              </section>
            ))}
            {children}
            {note ? <p className="legal-note">{note}</p> : null}
          </article>
        </div>
      </main>
      <Footer9 />
    </div>
  );
}

export function LegalPage({ slug }: { slug: LegalSlug }) {
  return (
    <DocPage
      doc={legalDoc(slug)}
      note="Este documento es un ejemplo con fines demostrativos y no constituye asesoría legal."
      nav={
        <nav className="legal-tabs" aria-label="Documentos legales">
          {legalDocs.map((item) => (
            <Link
              key={item.slug}
              to={`/${item.slug}`}
              className={item.slug === slug ? "is-active" : undefined}
              aria-current={item.slug === slug ? "page" : undefined}
            >
              {item.tab}
            </Link>
          ))}
        </nav>
      }
    />
  );
}
