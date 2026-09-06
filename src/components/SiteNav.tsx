import Link from "next/link";

const BASE_LINKS = [
  { href: "/", label: "会議室マップ" },
  { href: "/calendar", label: "カレンダー" },
] as const;

const ADMIN_LINKS = [
  { href: "/admin/floors", label: "フロア管理" },
  { href: "/admin/invitations", label: "メンバー招待" },
] as const;

export type SitePath = (typeof BASE_LINKS)[number]["href"] | (typeof ADMIN_LINKS)[number]["href"];

/**
 * 全メンバー向けのページ間ナビ（会議室マップ・カレンダー）に、管理者には
 * さらにフロア管理・メンバー招待を加えて表示する。管理画面に入ると会議室
 * マップへ戻る導線が無かったため、常にリンクをまとめて表示する（現在地は
 * リンクにせず強調表示のみ）。
 */
export function SiteNav({ current, isAdmin }: { current: SitePath; isAdmin: boolean }) {
  const links = isAdmin ? [...BASE_LINKS, ...ADMIN_LINKS] : BASE_LINKS;
  return (
    <nav className="flex gap-3 text-xs">
      {links.map((link) =>
        link.href === current ? (
          <span key={link.href} className="font-medium text-neutral-900 dark:text-white">
            {link.label}
          </span>
        ) : (
          <Link
            key={link.href}
            href={link.href}
            className="text-neutral-500 underline underline-offset-2 hover:text-neutral-800 dark:hover:text-neutral-200"
          >
            {link.label}
          </Link>
        ),
      )}
    </nav>
  );
}
