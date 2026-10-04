"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createScenario, deleteScenario, addEvent, updateEvent, deleteEvent } from "../../../lib/services/scenarioService.js";

function eventInputFromForm(formData: FormData): Record<string, string> {
  const input: Record<string, string> = {};
  for (const key of ["accountId", "amount", "currency", "incomeId", "expenseId", "newAmount", "loanId", "sourceAccountId", "strategy", "index", "newAnnualValuePercent", "endDate"]) {
    const value = formData.get(key);
    if (typeof value === "string") input[key] = value;
  }
  return input;
}

export async function createScenarioAction(lang: string, formData: FormData): Promise<void> {
  const name = String(formData.get("name") ?? "").trim();
  if (name.length === 0) return;
  await createScenario(name);
  revalidatePath(`/${lang}/simulation`);
}

export async function deleteScenarioAction(lang: string, formData: FormData): Promise<void> {
  const id = String(formData.get("scenarioId") ?? "");
  if (id.length === 0) return;
  await deleteScenario(id);
  revalidatePath(`/${lang}/simulation`);
}

export async function addEventAction(lang: string, formData: FormData): Promise<void> {
  const scenarioId = String(formData.get("scenarioId") ?? "");
  const date = String(formData.get("date") ?? "");
  const eventType = String(formData.get("eventType") ?? "one_time_expense");
  if (!scenarioId || !date) return;
  await addEvent(scenarioId, eventType, date, eventInputFromForm(formData));
  revalidatePath(`/${lang}/simulation`);
}

export async function updateEventAction(lang: string, formData: FormData): Promise<void> {
  const scenarioId = String(formData.get("scenarioId") ?? "");
  const eventId = String(formData.get("eventId") ?? "");
  const date = String(formData.get("date") ?? "");
  const eventType = String(formData.get("eventType") ?? "one_time_expense");
  if (!scenarioId || !eventId || !date) return;
  await updateEvent(scenarioId, eventId, eventType, date, eventInputFromForm(formData));
  revalidatePath(`/${lang}/simulation`);
  // Drop editEventId from the URL so the edit popup (EditEventModal) closes on save,
  // instead of re-rendering itself open with the just-saved values.
  redirect(`/${lang}/simulation?scenarioId=${scenarioId}`);
}

export async function deleteEventAction(lang: string, formData: FormData): Promise<void> {
  const scenarioId = String(formData.get("scenarioId") ?? "");
  const eventId = String(formData.get("eventId") ?? "");
  if (!scenarioId || !eventId) return;
  await deleteEvent(scenarioId, eventId);
  revalidatePath(`/${lang}/simulation`);
}
