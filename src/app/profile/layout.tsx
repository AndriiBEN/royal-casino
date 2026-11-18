import { ProfileTabs } from "@/components/profile/ProfileTabs";

/** Profile area: Overview, Game history, Account settings. Pages enforce auth themselves. */
export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell-container space-y-6 py-6 sm:py-8">
      <ProfileTabs />
      {children}
    </div>
  );
}
