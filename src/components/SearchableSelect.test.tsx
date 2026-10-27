import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SearchableSelect } from "./SearchableSelect";

describe("SearchableSelect with add and delete capabilities", () => {
  const defaultOptions = [
    { value: "Rent", label: "Rent" },
    { value: "Electricity", label: "Electricity" },
    { value: "Water", label: "Water" },
  ];

  it("renders delete button on options when onDeleteOption is provided and triggers callback", () => {
    const onDelete = vi.fn();
    const onChange = vi.fn();

    render(
      <SearchableSelect
        options={defaultOptions}
        value=""
        onChange={onChange}
        onDeleteOption={onDelete}
      />
    );

    const input = screen.getByRole("combobox");
    fireEvent.focus(input);

    const deleteRentBtn = screen.getByRole("button", { name: "Delete Rent" });
    expect(deleteRentBtn).toBeInTheDocument();

    fireEvent.click(deleteRentBtn);
    expect(onDelete).toHaveBeenCalledWith("Rent");
    // Should NOT trigger onChange selection when deleting
    expect(onChange).not.toHaveBeenCalled();
  });

  it("provides quick add button when typing a new custom option", () => {
    const onAdd = vi.fn();
    const onChange = vi.fn();

    render(
      <SearchableSelect
        options={defaultOptions}
        value=""
        onChange={onChange}
        onAddOption={onAdd}
        allowCustomValue={true}
      />
    );

    const input = screen.getByRole("combobox");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Generator Fuel" } });

    const addBtn = screen.getByRole("button", { name: /Add “Generator Fuel”/i });
    expect(addBtn).toBeInTheDocument();

    fireEvent.click(addBtn);
    expect(onAdd).toHaveBeenCalledWith("Generator Fuel");
    expect(onChange).toHaveBeenCalledWith("Generator Fuel");
  });

  it("allows adding a new option from the bottom input in the dropdown", () => {
    const onAdd = vi.fn();
    const onChange = vi.fn();

    render(
      <SearchableSelect
        options={defaultOptions}
        value=""
        onChange={onChange}
        onAddOption={onAdd}
        addOptionPlaceholder="New utility name..."
      />
    );

    const input = screen.getByRole("combobox");
    fireEvent.focus(input);

    const bottomInput = screen.getByPlaceholderText("New utility name...");
    expect(bottomInput).toBeInTheDocument();

    fireEvent.change(bottomInput, { target: { value: "Internet 5G" } });
    const addBtn = screen.getByRole("button", { name: /Add/i });
    fireEvent.click(addBtn);

    expect(onAdd).toHaveBeenCalledWith("Internet 5G");
    expect(onChange).toHaveBeenCalledWith("Internet 5G");
  });
});
