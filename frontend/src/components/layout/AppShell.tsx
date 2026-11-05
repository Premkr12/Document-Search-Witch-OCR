import { Outlet } from "react-router-dom";
import { PaletteProvider } from "@/components/CommandPalette";
import { UploadQueueProvider } from "@/contexts/UploadQueueContext";
import { BreadcrumbProvider } from "./Breadcrumbs";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

export function AppShell() {
  return (
    <UploadQueueProvider>
      <BreadcrumbProvider>
        <PaletteProvider>
          <div className="grid min-h-screen grid-cols-[64px_minmax(0,1fr)] md:grid-cols-[236px_minmax(0,1fr)]">
            <Sidebar />
            <div className="min-w-0">
              <TopBar />
              <main>
                <Outlet />
              </main>
            </div>
          </div>
        </PaletteProvider>
      </BreadcrumbProvider>
    </UploadQueueProvider>
  );
}
