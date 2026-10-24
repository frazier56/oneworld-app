// DESIGN PASS (Lee): the old AppLayout carried a horizontal overflow-x-auto
// MOBILE_NAV_ITEMS marquee strip across the top. That is intentionally REMOVED.
// The Shell provides TopBar + BottomTabs; this is now a plain content wrapper.
export default function AppLayout({ children }: { children: React.ReactNode; [k: string]: any }) {
  return <>{children}</>;
}
