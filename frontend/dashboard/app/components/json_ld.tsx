type JsonLdProps = {
  // A schema.org node, or { "@graph": [...] } for several nodes. The
  // "@context" key is added here so callers never have to.
  data: Record<string, unknown>;
};

export default function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      // "<" is escaped so content strings can never close the script tag.
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          "@context": "https://schema.org",
          ...data,
        }).replace(/</g, "\\u003c"),
      }}
    />
  );
}
