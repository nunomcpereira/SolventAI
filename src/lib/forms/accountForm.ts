import { type AccountType } from "../../domain/accounts/account.js";
import { type AccountFormInput } from "../services/accountsService.js";

/** Shared shape behind every "create an account" form (accounts page, dashboard quick-add). */
export function parseAccountFormCreate(formData: FormData): AccountFormInput {
  return {
    name: String(formData.get("name") ?? ""),
    type: String(formData.get("type") ?? "checking") as AccountType,
    currency: String(formData.get("currency") ?? "EUR"),
    balance: String(formData.get("balance") ?? "0"),
    minimumReserve: String(formData.get("minimumReserve") ?? "0"),
    active: formData.get("active") === "on",
  };
}
