import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AdminList } from "./AdminList";

interface Item {
  id: string;
  name: string;
}

const items: Item[] = [
  { id: "1", name: "Sample Belt No.5" },
  { id: "2", name: "Woven Strap" },
];

function renderList(overrides: Partial<Parameters<typeof AdminList<Item>>[0]> = {}) {
  return render(
    <AdminList<Item>
      items={items}
      searchPlaceholder="Search products…"
      getSearchText={(item) => item.name}
      getKey={(item) => item.id}
      renderItem={(item) => <span>{item.name}</span>}
      emptyState={<p>No products yet.</p>}
      {...overrides}
    />
  );
}

describe("AdminList", () => {
  it("renders every item", () => {
    renderList();
    expect(screen.getByText("Sample Belt No.5")).toBeInTheDocument();
    expect(screen.getByText("Woven Strap")).toBeInTheDocument();
  });

  it("filters by the search text", () => {
    renderList();
    fireEvent.change(screen.getByPlaceholderText("Search products…"), { target: { value: "woven" } });

    expect(screen.queryByText("Sample Belt No.5")).not.toBeInTheDocument();
    expect(screen.getByText("Woven Strap")).toBeInTheDocument();
  });

  it("shows the empty state when nothing matches", () => {
    renderList();
    fireEvent.change(screen.getByPlaceholderText("Search products…"), { target: { value: "nothing matches this" } });

    expect(screen.getByText("No products yet.")).toBeInTheDocument();
  });

  // Found in review (CodeRabbit, PR #38): a search with no matches isn't
  // the same thing as a genuinely empty list — a caller that wants to
  // tell the two apart needs the current search term, which a plain
  // ReactNode emptyState never had access to.
  it("passes the current search term to a function emptyState", () => {
    const emptyState = vi.fn((search: string) => <p>No match for "{search}".</p>);
    renderList({ emptyState });
    fireEvent.change(screen.getByPlaceholderText("Search products…"), { target: { value: "nothing matches this" } });

    expect(emptyState).toHaveBeenLastCalledWith("nothing matches this");
    expect(screen.getByText('No match for "nothing matches this".')).toBeInTheDocument();
  });

  it("calls onItemClick with the clicked item", () => {
    const onItemClick = vi.fn();
    renderList({ onItemClick });

    fireEvent.click(screen.getByText("Sample Belt No.5"));
    expect(onItemClick).toHaveBeenCalledWith(items[0]);
  });

  it("shows a loading state instead of the list", () => {
    renderList({ isLoading: true });
    expect(screen.queryByText("Sample Belt No.5")).not.toBeInTheDocument();
  });
});
