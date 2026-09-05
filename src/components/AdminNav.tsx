import Link from "next/link";

const ADMIN_LINKS = [
  { href: "/admin/floors", label: "フロア管理" },
  { href: "/admin/invitations", label: "メンバー招待" },
] as const;

/** 管理者向けページ間の簡易ナビ。管理画面が増えてきたため、各ページの上部で共通表示する */
export function AdminNav({ current }: { current: (typeof ADMIN_LINKS)[number]["href"] }) {
  return (
    <nav className="flex gap-3 text-xs">
      {ADMIN_LINKS.map((link) =>
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
