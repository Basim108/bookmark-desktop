import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App", () => {
  it("renders the scaffold placeholder", () => {
    render(<App />);
    expect(screen.getByText(/Bookmark Desktop/i)).toBeInTheDocument();
  });
});
