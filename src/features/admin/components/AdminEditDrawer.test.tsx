import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AdminEditDrawer } from "./AdminEditDrawer";

describe("AdminEditDrawer", () => {
  it("renders the title, description and children when open", () => {
    render(
      <AdminEditDrawer
        open
        onOpenChange={() => {}}
        title="Edit product"
        description="Update this product's details."
        footer={<button>Save</button>}
      >
        <p>Form goes here</p>
      </AdminEditDrawer>
    );

    expect(screen.getByText("Edit product")).toBeInTheDocument();
    expect(screen.getByText("Update this product's details.")).toBeInTheDocument();
    expect(screen.getByText("Form goes here")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  it("renders nothing visible when closed", () => {
    render(
      <AdminEditDrawer open={false} onOpenChange={() => {}} title="Edit product">
        <p>Form goes here</p>
      </AdminEditDrawer>
    );

    expect(screen.queryByText("Edit product")).not.toBeInTheDocument();
  });

  it("calls onOpenChange(false) when the sheet's own close control is used", () => {
    const onOpenChange = vi.fn();
    render(
      <AdminEditDrawer open onOpenChange={onOpenChange} title="Edit product">
        <p>Form goes here</p>
      </AdminEditDrawer>
    );

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
