import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CountBadge } from "./CountBadge";

describe("CountBadge", () => {
  it("renders the given count", () => {
    render(<CountBadge count={5} />);
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByLabelText("5 items")).toBeInTheDocument();
  });

  it("renders multi-digit counts", () => {
    render(<CountBadge count={42} />);
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByLabelText("42 items")).toBeInTheDocument();
  });

  it("applies variant classes for amber, indigo, and neutral", () => {
    const { rerender } = render(<CountBadge count={1} variant="amber" />);
    const badge = screen.getByText("1");
    expect(badge.className).toContain("rounded-full");
    expect(badge.className).toContain("text-amber-900");

    rerender(<CountBadge count={1} variant="amber" active />);
    expect(badge.className).toContain("bg-amber-700");

    rerender(<CountBadge count={4} variant="indigo" />);
    expect(badge.className).toContain("text-indigo-900");

    rerender(<CountBadge count={4} variant="indigo" active />);
    expect(badge.className).toContain("bg-indigo-700");
  });

  it("applies active styles when active is true", () => {
    render(<CountBadge count={3} variant="primary" active />);
    const badge = screen.getByText("3");
    expect(badge.className).toContain("bg-primary-700");
  });

  it("supports custom className", () => {
    render(<CountBadge count={9} className="custom-class" />);
    expect(screen.getByText("9").className).toContain("custom-class");
  });
});
