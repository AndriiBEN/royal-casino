/**
 * Re-mounted on every navigation, so each page settles in with one short fade (see
 * .rc-page-in in globals.css; disabled under prefers-reduced-motion).
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="rc-page-in">{children}</div>;
}
