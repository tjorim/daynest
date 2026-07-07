// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PrivacyPolicyPage } from "@/features/legal/PrivacyPolicyPage";

describe("PrivacyPolicyPage", () => {
  it("does not expose a GitHub issue deletion flow", () => {
    render(<PrivacyPolicyPage />);

    expect(screen.queryByRole("link", { name: /github/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/github\.com/i)).not.toBeInTheDocument();
  });

  it("points deletion requests to email contact", () => {
    render(<PrivacyPolicyPage />);

    expect(screen.getByRole("link", { name: /tielemans\.jorim@gmail\.com/i })).toHaveAttribute(
      "href",
      "mailto:tielemans.jorim@gmail.com",
    );
  });
});
