import { queryPattern } from "@/lib/utils";

/** Render text with every word of `query` marked with the highlighter. */
export function Highlight({ text, query }: { text: string; query: string }) {
  const pattern = queryPattern(query);
  if (!pattern || !text) return <>{text}</>;

  // split() with a capture group puts the matches at odd indexes
  const parts = text.split(new RegExp(`(${pattern})`, "gi"));
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="hl">
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  );
}
