import { openapi } from "@/app/utils/openapi_source";
import { source } from "@/app/utils/docs_source";
import { sharedOpenGraph } from "@/app/utils/metadata";
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
} from "fumadocs-ui/layouts/docs/page";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { OpenAPIPageProps_Preloaded } from "fumadocs-openapi/ui";
import { ImproveDocsCta } from "../components/improve_docs_cta";
import { OpenAPIPage } from "../components/openapi_page";
import { LLMCopyButton, ViewOptions } from "../components/page_actions";
import { getMDXComponents } from "../mdx_components";

interface PageParams {
  params: Promise<{ slug?: string[] }>;
}

type DocPage = NonNullable<ReturnType<typeof source.getPage>>;

const GITHUB_BLOB =
  "https://github.com/measure-sh/measure/blob/main/frontend/dashboard";

/**
 * GitHub source link for a docs page. API reference pages are generated
 * from the OpenAPI specs at build time and aren't in the repo, so they
 * link to the spec they were generated from instead.
 */
function githubSourceUrl(page: DocPage) {
  if (page.slugs[0] === "api" && page.slugs.length > 1) {
    const spec = page.slugs[1] === "sdk" ? "sdk" : "dashboard";
    return `${GITHUB_BLOB}/content/openapi/${spec}.yaml`;
  }
  return `${GITHUB_BLOB}/content/docs/${page.path}`;
}

// OpenAPIPage renders an already-parsed spec, and a static MDX file
// cannot carry one, so the page renderer parses the spec server-side and
// passes it in a prop named `preloaded`. Every other prop (the spec path,
// operation ids and display options) comes from the generated MDX of the
// API reference page. The wrapper below receives the MDX props and adds
// `preloaded`, so its parameter is typed as OpenAPIPage's props with
// `preloaded` removed, because `preloaded` is the one prop the MDX
// cannot pass.
type OpenAPIPageMdxProps = Omit<OpenAPIPageProps_Preloaded, "preloaded">;

export default async function Page(props: PageParams) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) {
    notFound();
  }

  const MDX = page.data.body;

  return (
    <DocsPage toc={page.data.toc} full={page.data.full}>
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription className="mb-2">
        {page.data.description}
      </DocsDescription>
      <div className="flex flex-row flex-wrap items-center gap-2 border-b pb-6">
        <LLMCopyButton markdownUrl={`${page.url}.md`} />
        <ViewOptions
          markdownUrl={`${page.url}.md`}
          githubUrl={githubSourceUrl(page)}
        />
      </div>
      <DocsBody>
        <MDX
          components={getMDXComponents({
            OpenAPIPage: async (props: OpenAPIPageMdxProps) => (
              <OpenAPIPage
                {...props}
                {...await openapi.preloadOpenAPIPage(page)}
              />
            ),
          })}
        />
      </DocsBody>
      <ImproveDocsCta />
    </DocsPage>
  );
}

export async function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata(props: PageParams): Promise<Metadata> {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) {
    notFound();
  }

  // seoTitle carries the longer search-facing title; the plain title is the
  // visible page heading and sidebar label.
  const title = page.data.seoTitle ?? page.data.title;

  return {
    title,
    description: page.data.description,
    alternates: { canonical: page.url },
    openGraph: {
      ...sharedOpenGraph,
      title,
      description: page.data.description,
      url: page.url,
    },
  };
}
