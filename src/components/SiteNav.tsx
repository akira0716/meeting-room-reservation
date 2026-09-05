import Link from "next/link";

const SITE_LINKS = [
  { href: "/", label: "会議室マップ" },
  { href: "/admin/floors", label: "フロア管理" },
  { href: "/admin/invitations", label: "メンバー招待" },
] as const;

export type SitePath = (typeof SITE_LINKS)[number]["href"];

/**
 * 管理者向けのページ間ナビ（会議室マップ・フロア管理・メンバー招待）。
 * 管理画面に入ると会議室マップへ戻る導線が無かったため、常に3つのリンクを
 * まとめて表示する（現在地はリンクにせず強調表示のみ）。一般メンバーは
 * 管理画面自体を利用できないため、AppHeader側でisAdminのときだけ表示する。
 */
export function SiteNav({ current }: { current: SitePath }) {
  return (
    <nav className="flex gap-3 text-xs">
      {SITE_LINKS.map((link) =>
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
