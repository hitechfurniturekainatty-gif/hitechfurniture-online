import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("@/hooks/useHomeLayout", () => ({ loadHomeLayoutBody: () => Promise.resolve(null) }));
vi.mock("@/components/admin/SingleImagePicker", () => ({ SingleImagePicker: () => <div>image picker</div> }));

import { HomeLayoutEditor } from "./HomeLayoutEditor";

describe("HomeLayoutEditor", () => {
  it("lists every section, opens one with its current text, and tracks unsaved changes", async () => {
    render(<HomeLayoutEditor />);
    await waitFor(() => expect(screen.getByText("Home page sections")).toBeInTheDocument());
    expect(screen.getByText("Big photo section (top)")).toBeInTheDocument();
    expect(screen.getByText("Why Hitech")).toBeInTheDocument();
    expect(screen.getByText("All changes saved.")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Shop by room"));
    const heading = screen.getByDisplayValue("Shop by room");
    fireEvent.change(heading, { target: { value: "Find your room" } });
    expect(screen.getByText("You have unsaved changes.")).toBeInTheDocument();

    fireEvent.change(heading, { target: { value: "" } });
    expect((heading as HTMLInputElement).value).toBe("");
  });
});
