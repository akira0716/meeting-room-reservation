import { AccountMenu } from "./AccountMenu";
import { LogoutButton } from "./LogoutButton";
import { SiteNav, type SitePath } from "./SiteNav";

/**
 * 会議室マップ・フロア管理・メンバー招待の3画面で共通利用するヘッダー。
 * 管理者には常にページ間ナビ（現在地の強調表示つき）を出すことで、
 * 管理画面から会議室マップへ戻る導線が無かった問題も合わせて解消している。
 */
export function AppHeader({
  title,
  subtitle,
  isAdmin,
  currentPath,
  accountEmail,
  accountName,
  accountImage,
}: {
  title: string;
  subtitle?: string;
  isAdmin: boolean;
  currentPath: SitePath;
  accountEmail: string;
  accountName: string | null;
  accountImage: string | null;
}) {
  return (
    <header className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-xl font-semibold">{title}</h1>
        {subtitle && <p className="text-sm text-neutral-500">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-4">
        {isAdmin && <SiteNav current={currentPath} />}
        <AccountMenu email={accountEmail} name={accountName} image={accountImage}>
          <LogoutButton />
        </AccountMenu>
      </div>
    </header>
  );
}
