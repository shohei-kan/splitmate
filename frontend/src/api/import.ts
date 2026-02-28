import { apiFetch } from "./client";
import type { CardUser, ImportResult } from "./types";

function buildImportForm(file: File) {
  const fd = new FormData();
  fd.append("file", file);
  return fd;
}

export function importRakutenCsv(file: File, cardUser: CardUser) {
  const fd = buildImportForm(file);
  return apiFetch<ImportResult>(`/api/import/rakuten/?card_user=${cardUser}`, {
    method: "POST",
    body: fd,
    headers: {
      Accept: "application/json",
    },
  });
}

export function importMitsuiCsv(file: File, cardUser: CardUser) {
  const fd = buildImportForm(file);
  return apiFetch<ImportResult>(`/api/import/mitsui/?card_user=${cardUser}`, {
    method: "POST",
    body: fd,
    headers: {
      Accept: "application/json",
    },
  });
}
