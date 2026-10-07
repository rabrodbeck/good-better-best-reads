import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ChatMarkdown } from "@/components/chat/chat-markdown";

describe("ChatMarkdown component", () => {
  it("renders bold and italic text cleanly", () => {
    const markdown = "This is **bold text** and *italicized text*.";
    const html = renderToStaticMarkup(<ChatMarkdown content={markdown} />);

    expect(html).toContain("<strong");
    expect(html).toContain("bold text");
    expect(html).toContain("<em");
    expect(html).toContain("italicized text");
  });

  it("renders headings with appropriate hierarchy and classes", () => {
    const markdown = "# Title\n## Section\n### Sub-bullet";
    const html = renderToStaticMarkup(<ChatMarkdown content={markdown} />);

    expect(html).toContain("<h3");
    expect(html).toContain("Title");
    expect(html).toContain("<h4");
    expect(html).toContain("Section");
    expect(html).toContain("<h5");
    expect(html).toContain("Sub-bullet");
  });

  it("renders unordered and ordered lists", () => {
    const markdown = "- First bullet\n- Second bullet\n\n1. Step one\n2. Step two";
    const html = renderToStaticMarkup(<ChatMarkdown content={markdown} />);

    expect(html).toContain("<ul");
    expect(html).toContain("<li");
    expect(html).toContain("First bullet");
    expect(html).toContain("<ol");
    expect(html).toContain("Step one");
  });

  it("renders blockquotes with literary styling", () => {
    const markdown = "> A book is a garden carried in the pocket.";
    const html = renderToStaticMarkup(<ChatMarkdown content={markdown} />);

    expect(html).toContain("<blockquote");
    expect(html).toContain("border-primary/50");
    expect(html).toContain("A book is a garden carried in the pocket.");
  });

  it("renders inline code formatting", () => {
    const markdown = "Check out the `ISBN-13` catalog number.";
    const html = renderToStaticMarkup(<ChatMarkdown content={markdown} />);

    expect(html).toContain("<code");
    expect(html).toContain("font-mono");
    expect(html).toContain("ISBN-13");
  });

  it("renders hyperlinks with secure attributes", () => {
    const markdown = "Visit [StoryGraph](https://thestorygraph.com) for details.";
    const html = renderToStaticMarkup(<ChatMarkdown content={markdown} />);

    expect(html).toContain("<a");
    expect(html).toContain('href="https://thestorygraph.com"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain("StoryGraph");
  });
});
