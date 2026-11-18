import type { Metadata } from "next";
import { Clock, EyeOff, Volume2, KeyRound, LogOut, ShieldCheck, UserRound, UserSquare } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getActiveSessionCount, getVipTiers } from "@/lib/queries";
import { getTierProgress } from "@/lib/vip";
import { logout } from "@/lib/actions/auth";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { PasswordForm, SignOutOthersForm } from "@/components/profile/SecurityForms";
import { AvatarPicker, PrivacyForm } from "@/components/profile/SettingsForms";
import { SoundControls } from "@/components/ui/SoundSettings";

export const metadata: Metadata = { title: "Account Settings" };

const dateFmt = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" });

function Panel({ icon: Icon, title, description, children, id }: { icon: typeof UserRound; title: string; description?: string; children: React.ReactNode; id?: string }) {
  return (
    <section id={id} className="scroll-mt-24 rounded-[1.5rem] border border-line bg-surface p-6 sm:p-8">
      <div className="mb-6 flex items-start gap-4">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-gold/30 bg-gold/10 text-gold">
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-2xl text-ivory sm:text-3xl">{title}</h2>
          {description && <p className="mt-1 text-sm text-muted">{description}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

export default async function SettingsPage() {
  const user = await requireUser("/profile/settings");
  const [tiers, sessions] = await Promise.all([getVipTiers(), getActiveSessionCount(user.id)]);
  const tierLevel = getTierProgress(user.vipPoints, tiers).current.level;

  return (
    <div className="space-y-5">
      <h1 className="sr-only">Account settings</h1>
      <Panel icon={UserSquare} title="Avatar" description="Some avatars unlock as you climb the VIP tiers.">
        <AvatarPicker current={user.avatar} tierLevel={tierLevel} />
      </Panel>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Panel icon={UserRound} title="Profile details" description={`Signed in as @${user.username}. Usernames cannot be changed.`}>
          <ProfileForm displayName={user.displayName} email={user.email ?? ""} />
        </Panel>
        <Panel icon={KeyRound} title="Password" description="Changing it signs you out everywhere else.">
          <PasswordForm username={user.username} />
        </Panel>
      </div>

      <Panel id="sound" icon={Volume2} title="Sound" description="Table sounds, win fanfares and interface tones.">
        <SoundControls />
      </Panel>

      <Panel icon={EyeOff} title="Privacy">
        <PrivacyForm showOnWinners={user.showOnWinners} />
      </Panel>

      <Panel icon={ShieldCheck} title="Security" description="Sessions are stored as one-way hashes and expire after 30 days of inactivity.">
        <dl className="mb-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-line bg-ink/50 px-4 py-3">
            <dt className="text-[0.6rem] font-bold uppercase tracking-[0.2em] text-subtle">Active sessions</dt>
            <dd className="mt-1 font-display text-2xl text-ivory">{sessions}</dd>
          </div>
          <div className="rounded-xl border border-line bg-ink/50 px-4 py-3">
            <dt className="flex items-center gap-1 text-[0.6rem] font-bold uppercase tracking-[0.2em] text-subtle">
              <Clock className="h-3 w-3" /> Last login
            </dt>
            <dd className="mt-1 text-sm text-ivory">{user.lastLoginAt ? dateFmt.format(user.lastLoginAt) : "—"}</dd>
          </div>
          <div className="rounded-xl border border-line bg-ink/50 px-4 py-3">
            <dt className="text-[0.6rem] font-bold uppercase tracking-[0.2em] text-subtle">Password changed</dt>
            <dd className="mt-1 text-sm text-ivory">{user.passwordChangedAt ? dateFmt.format(user.passwordChangedAt) : "Never"}</dd>
          </div>
        </dl>
        <div className="flex flex-wrap items-center gap-4">
          <SignOutOthersForm otherSessions={Math.max(0, sessions - 1)} />
          <form action={logout} className="ml-auto">
            <button type="submit" className="inline-flex h-10 items-center gap-2 rounded-full border border-line px-5 text-sm font-semibold text-muted transition-colors hover:border-ruby/50 hover:text-[#ff9aa2]">
              <LogOut className="h-4 w-4" /> Log out
            </button>
          </form>
        </div>
      </Panel>
    </div>
  );
}
