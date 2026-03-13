import { createBrowserRouter } from "react-router-dom";
import { AppShell } from "./layouts/AppShell";
import { HomePage } from "../pages/HomePage";
import { CsvImportPage } from "../pages/CsvImportPage";
import { SettingsPage } from "../pages/SettingsPage";
import { SummaryPage } from "../pages/SummaryPage";

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { path: "/", element: <HomePage /> },
      { path: "/summary", element: <SummaryPage /> },
      { path: "/csv", element: <CsvImportPage /> },
      { path: "/settings", element: <SettingsPage /> },
    ],
  },
]);
