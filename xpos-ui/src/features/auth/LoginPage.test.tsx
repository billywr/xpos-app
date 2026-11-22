import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { MemoryRouter } from "react-router-dom";
import authReducer from "@/store/slices/authSlice";
import { LoginPage } from "./LoginPage";
import * as authApi from "@/api/auth";

vi.mock("@/api/auth");
vi.mock("@/utils/env", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    getEnv: (key: string) => {
      if (key === "VITE_KEYCLOAK_URL") return "http://localhost:8088";
      if (key === "VITE_KEYCLOAK_REALM") return "xpos";
      if (key === "VITE_KEYCLOAK_CLIENT_ID") return "xpos-client-api";
      return "";
    },
  };
});

function wrap(component: React.ReactElement) {
  const store = configureStore({
    reducer: {
      auth: authReducer,
    },
  });
  return render(
    <Provider store={store}>
      <MemoryRouter>{component}</MemoryRouter>
    </Provider>
  );
}

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders username, password inputs and an active, enabled Sign in button", () => {
    wrap(<LoginPage />);

    expect(screen.queryByRole("heading", { name: /sign in/i })).not.toBeInTheDocument();
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();

    const submitBtn = screen.getByRole("button", { name: /sign in/i });
    expect(submitBtn).toBeInTheDocument();
    // The button should remain active/enabled even before typing so autofill doesn't leave it disabled
    expect(submitBtn).not.toBeDisabled();
  });

  it("shows validation error if submitted while fields are empty", async () => {
    wrap(<LoginPage />);

    const submitBtn = screen.getByRole("button", { name: /sign in/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Username and password are required.");
    });
  });

  it("submits successfully when username and password are provided", async () => {
    vi.mocked(authApi.loginWithPassword).mockResolvedValueOnce({
      token: "header.payload.signature",
      iamUserId: "user-123",
      expiresAt: Date.now() + 3600000,
      refreshToken: "refresh-token",
    });

    wrap(<LoginPage />);

    const userInput = screen.getByLabelText(/username/i);
    const passInput = screen.getByLabelText(/password/i);
    const submitBtn = screen.getByRole("button", { name: /sign in/i });

    fireEvent.change(userInput, { target: { value: "billy" } });
    fireEvent.change(passInput, { target: { value: "secret123" } });

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(authApi.loginWithPassword).toHaveBeenCalledWith({
        keycloakUrl: "http://localhost:8088",
        realm: "xpos",
        clientId: "xpos-client-api",
        username: "billy",
        password: "secret123",
      });
    });
  });

  it("reads DOM elements if browser autofilled inputs directly without React onChange", async () => {
    vi.mocked(authApi.loginWithPassword).mockResolvedValueOnce({
      token: "header.payload.signature",
      iamUserId: "user-123",
      expiresAt: Date.now() + 3600000,
      refreshToken: "refresh-token",
    });

    wrap(<LoginPage />);

    const userInput = screen.getByLabelText(/username/i) as HTMLInputElement;
    const passInput = screen.getByLabelText(/password/i) as HTMLInputElement;

    // Simulate browser autofill setting DOM value directly
    userInput.value = "autofilledUser";
    passInput.value = "autofilledPass";

    // Trigger form submit
    const submitBtn = screen.getByRole("button", { name: /sign in/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(authApi.loginWithPassword).toHaveBeenCalledWith({
        keycloakUrl: "http://localhost:8088",
        realm: "xpos",
        clientId: "xpos-client-api",
        username: "autofilledUser",
        password: "autofilledPass",
      });
    });
  });
});
