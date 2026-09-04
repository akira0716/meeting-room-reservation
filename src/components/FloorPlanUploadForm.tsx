"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * フロア図（背景画像）のアップロード用フォーム。
 *
 * NOTE: 暫定UI。認証・認可(管理者ページ)が実装されるまでは誰でも操作できてしまうため、
 * 「管理者用の簡易操作」であることが分かるよう控えめな表示にしている。
 * TASKS.mdの認証・認可実装後、管理者のみに表示を絞る。
 */
export function FloorPlanUploadForm({ floorId }: { floorId: string }) {
  const router = useRouter();
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // 同じファイルを連続選択できるようにリセット
    if (!file) return;

    setIsUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`/api/floors/${floorId}/image`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "アップロードに失敗しました");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "アップロードに失敗しました");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="mt-2 flex items-center gap-2 text-xs text-neutral-400">
      <label className="cursor-pointer rounded border border-dashed border-black/20 px-2 py-1 hover:border-black/40 dark:border-white/20 dark:hover:border-white/40">
        {isUploading ? "アップロード中..." : "（管理者用・暫定）フロア図を差し替え"}
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          disabled={isUploading}
          onChange={handleFileChange}
        />
      </label>
      {error && <span className="text-rose-500">{error}</span>}
    </div>
  );
}
