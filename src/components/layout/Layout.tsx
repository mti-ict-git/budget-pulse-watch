import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Menu } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { PRFChat } from "../chat/PRFChat";
import { Sheet, SheetContent, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet";

export function Layout() {
  const [navigationOpen, setNavigationOpen] = useState(false);
  const location = useLocation();
  useEffect(() => { setNavigationOpen(false); }, [location.pathname]);
  return (
    <Sheet open={navigationOpen} onOpenChange={setNavigationOpen}>
    <div className="merdeka-shell">
      <div className="merdeka-desktop-navigation"><Sidebar /></div>
        <SheetContent side="left" className="merdeka-mobile-navigation p-0 w-[280px]">
          <SheetTitle className="sr-only">Main navigation</SheetTitle>
          <SheetDescription className="sr-only">Navigate MTI ICT PO Monitoring</SheetDescription>
          <Sidebar mobile onNavigate={() => setNavigationOpen(false)} />
        </SheetContent>
      <div className="merdeka-workspace">
        <div className="merdeka-topbar-row">
          <SheetTrigger asChild><button type="button" className="merdeka-mobile-toggle" aria-label="Open navigation"><Menu size={20} /></button></SheetTrigger>
          <Header />
        </div>
        <main id="main-content" className="merdeka-main"><Outlet /></main>
        <footer className="merdeka-footer"><span>MTI ICT PO Monitoring</span><span>Purchase requests & budget control</span></footer>
      </div>
      <PRFChat />
    </div>
    </Sheet>
  );
}
