import { describe, expect, it } from "vitest";

import { buildMailtoLink, buildMailtoSubject } from "./mailto";

describe("buildMailtoSubject", () => {
  it("matches the brief's own literal example exactly", () => {
    expect(buildMailtoSubject("Sample Belt No.5", 40, "GBP")).toBe("Enquiry: Sample Belt No.5 (GBP 40)");
  });

  it("doesn't zero-pad a fractional price", () => {
    expect(buildMailtoSubject("Sample Belt No.5", 40.5, "GBP")).toBe("Enquiry: Sample Belt No.5 (GBP 40.5)");
  });
});

describe("buildMailtoLink", () => {
  const base = {
    to: "owner@example.com",
    priceCurrency: "GBP",
    pageUrl: "https://alllifeworks.com/shop/sample-belt-no-5",
  };

  it("builds a mailto: link with the recipient unencoded and an encoded subject/body", () => {
    const link = buildMailtoLink({ ...base, productName: "Sample Belt No.5", priceAmount: 40 });

    expect(link).toMatch(/^mailto:owner@example\.com\?subject=.+&body=.+$/);

    const url = new URL(link);
    expect(url.pathname).toBe("owner@example.com");
    expect(decodeURIComponent(url.searchParams.get("subject")!)).toBe("Enquiry: Sample Belt No.5 (GBP 40)");
    const body = decodeURIComponent(url.searchParams.get("body")!);
    expect(body).toContain("Sample Belt No.5");
    expect(body).toContain("£40.00");
    expect(body).toContain(base.pageUrl);
  });

  // The brief explicitly calls out spaces, ampersands, pound signs and
  // non-ASCII characters as cases to unit-test the encoding of.
  it("encodes spaces in the subject", () => {
    const link = buildMailtoLink({ ...base, productName: "Sample Belt No.5", priceAmount: 40 });
    const subjectParam = link.split("subject=")[1].split("&")[0];
    expect(subjectParam).not.toContain(" ");
    expect(subjectParam).toContain("%20");
  });

  it("encodes an ampersand in the product name so it can't be mistaken for another query param", () => {
    const link = buildMailtoLink({ ...base, productName: "Belt & Buckle Set", priceAmount: 55 });
    const subjectParam = link.split("subject=")[1].split("&body=")[0];
    expect(subjectParam).not.toContain("&");
    expect(subjectParam).toContain("%26");
    expect(decodeURIComponent(subjectParam)).toBe("Enquiry: Belt & Buckle Set (GBP 55)");
  });

  it("encodes the pound sign that appears in the body's formatted price", () => {
    const link = buildMailtoLink({ ...base, productName: "Sample Belt No.5", priceAmount: 40 });
    const bodyParam = link.split("body=")[1];
    expect(bodyParam).not.toContain("£");
    expect(bodyParam.toLowerCase()).toContain("%c2%a3"); // UTF-8 percent-encoding of £
    expect(decodeURIComponent(bodyParam)).toContain("£40.00");
  });

  it("encodes non-ASCII characters in the product name", () => {
    const link = buildMailtoLink({ ...base, productName: "Édition spéciale", priceAmount: 60 });
    const subjectParam = link.split("subject=")[1].split("&body=")[0];
    expect(subjectParam).not.toContain("É");
    expect(subjectParam).not.toContain("é");
    expect(decodeURIComponent(subjectParam)).toBe("Enquiry: Édition spéciale (GBP 60)");
  });

  it("leaves a plain recipient address unencoded (RFC 6068 allows '@' in addr-spec)", () => {
    const link = buildMailtoLink({ ...base, to: "serve@alllifeworks.com", productName: "X", priceAmount: 1 });
    expect(link.startsWith("mailto:serve@alllifeworks.com?")).toBe(true);
  });
});
