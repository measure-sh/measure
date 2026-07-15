import { Accordion, Accordions } from "fumadocs-ui/components/accordion";
import { Tab, Tabs } from "fumadocs-ui/components/tabs";
import defaultMdxComponents from "fumadocs-ui/mdx";
import type { MDXComponents } from "mdx/types";
import { Card } from "./components/card";
import { PlatformIcon } from "./components/platform_icon";
import { TrackedCodeBlock } from "./components/tracked_code_block";

/**
 * Component map for the docs MDX body. The defaults cover headings, links,
 * images, tables, Callout, Cards and code blocks; Tabs, Accordions and
 * PlatformIcon are registered explicitly because the content references
 * them by name. Card shadows the fumadocs default with a variant that
 * restyles its icon chip, and pre shadows the default code block to track
 * copy clicks.
 */
export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    pre: (props) => <TrackedCodeBlock {...props} />,
    Tabs,
    Tab,
    Accordions,
    Accordion,
    Card,
    PlatformIcon,
    ...components,
  };
}
