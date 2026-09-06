import { Zen_Kaku_Gothic_New } from "next/font/google";
import Link from "next/link";
import { FaqAccordion, type Faq } from "./FaqAccordion";
import { LandingFloorMap } from "./LandingFloorMap";

// LP専用のフォント。アプリ本体（ログイン後の画面）は既存のGeist（layout.tsx）のままにし、
// LPだけこのフォントを使う（next/font/googleはページ単位でも適用できるため、
// ルートのフォント設定には手を入れていない）
const zenKakuGothicNew = Zen_Kaku_Gothic_New({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const BEFORE_ITEMS = [
  "会議室の名前と場所が結びつかず、当日フロアを歩いて探す",
  "空いている部屋を探すのに、カレンダーを行き来する",
  "同じ時間に別の人が予約していて、直前に気づく",
];

const AFTER_ITEMS = [
  "フロアマップの色を見れば、空いている部屋と場所が同時にわかる",
  "部屋をクリックして、その日の空き枠からそのまま予約",
  "重複と同時編集はシステム側で検知して、先の予約を守る",
];

const FEATURES = [
  {
    no: "01",
    slot: "floor map / status colors",
    title: "フロアの空き状況を、色で見る",
    body: "空きはミント、使用中はローズ。部屋の名前を覚えていなくても、今どこが使えるかが一目でわかります。",
  },
  {
    no: "02",
    slot: "floor plan image overlay",
    title: "自社のフロア図をそのまま背景に",
    body: "画像をアップロードすると、会議室の矩形が図面の座標に重なります。差し替えて図面サイズが変わっても、会議室の位置は自動で補正されます。",
  },
  {
    no: "03",
    slot: "room detail / time slots",
    title: "部屋を押して、空き枠を選ぶだけ",
    body: "その日のタイムスロット別の予約状況が開きます。空いている時間帯を選べば、画面を移動せずに予約が入ります。",
  },
  {
    no: "04",
    slot: "roles & invitations",
    title: "招待した人だけが入れる",
    body: "管理者がメールアドレスを登録したメンバーだけがサインインできます。権限は管理者と一般メンバーの2段階。",
  },
];

const INTEGRATIONS = [
  {
    name: "Google アカウント",
    status: "対応済み",
    note: "サインインはGoogleのみ。パスワード管理は不要です。",
    badgeClass: "text-emerald-800 bg-emerald-50 border border-emerald-200",
  },
  {
    name: "Google カレンダー",
    status: "対応予定",
    note: "既存の予約データを読み込む連携を準備中です。",
    badgeClass: "text-yellow-800 bg-yellow-50 border border-yellow-200",
  },
  {
    name: "Outlook / Microsoft 365",
    status: "検討中",
    note: "ご要望をお聞かせください。優先度の参考にします。",
    badgeClass: "text-neutral-600 bg-neutral-100 border border-neutral-200",
  },
];

const FAQS: Faq[] = [
  {
    q: "今使っているGoogleカレンダーの予約はどうなりますか？",
    a: "カレンダーの予約データはそのままで構いません。予約の仕組みを置き換えるのではなく、フロアマップというUIを足す発想で作っています。カレンダー連携は段階的に対応を進めています。",
  },
  {
    q: "フロア図の画像は用意が必要ですか？",
    a: "あると入り口や目印からの位置関係が掴みやすくなりますが、必須ではありません。画像がないフロアは、会議室の矩形配置だけを表示エリアに合わせて拡大縮小して表示します。",
  },
  {
    q: "同じ時間帯に複数人が予約したらどうなりますか？",
    a: "作成時に既存予約との時間帯重複をチェックし、更新時はバージョンを見て「他の人が先に更新した」場合を検知します。あとから押した予約が黙って上書きすることはありません。",
  },
  {
    q: "誰でもサインインできてしまいませんか？",
    a: "管理者が招待したメールアドレスだけがサインインできます。権限は管理者と一般メンバーの2段階で、フロア図のアップロードや予約作成はサーバー側でも権限を再確認しています。",
  },
  {
    q: "導入にどれくらいかかりますか？",
    a: "Googleアカウントでサインインし、建物とフロアを登録して会議室を並べるだけです。フロア図の画像は後から差し替えても、会議室の位置を自動で補正します。",
  },
];

const CTA_LABEL = "無料で試す";

export function LandingPage() {
  return (
    <div className={`${zenKakuGothicNew.className} bg-white text-neutral-900`}>
      {/* ダーク配色のヘッダー＋ヒーロー */}
      <div className="bg-[#0a0a0a] text-[#ededed]">
        <header className="mx-auto flex max-w-[1120px] flex-wrap items-center justify-between gap-4 px-6 py-5">
          <div className="flex items-center gap-2.5">
            <div className="h-[26px] w-[26px] rounded-[7px] bg-emerald-200" />
            <span className="font-mono text-[15px] font-medium tracking-wide">Roomap</span>
          </div>
          <nav className="flex flex-wrap items-center gap-5 text-[13px]">
            <a href="#story" className="text-neutral-400">
              ストーリー
            </a>
            <a href="#features" className="text-neutral-400">
              機能
            </a>
            <a href="#faq" className="text-neutral-400">
              FAQ
            </a>
            <Link href="/login" className="text-neutral-400">
              ログイン
            </Link>
            <Link
              href="/signup"
              className="inline-block rounded-lg bg-emerald-200 px-4 py-2 text-[13px] font-semibold text-emerald-900"
            >
              {CTA_LABEL}
            </Link>
          </nav>
        </header>

        <div className="mx-auto flex max-w-[900px] flex-col items-center gap-6 px-6 pb-18 pt-12 text-center">
          <span className="font-mono text-xs text-emerald-200">
            「〇〇会議室って、どこだっけ」
          </span>
          <h1 className="text-balance text-[clamp(32px,5.4vw,60px)] font-bold leading-[1.22] tracking-tight">
            その部屋が
            <br />
            どこにあるか、
            <br />
            地図で答えます。
          </h1>
          <p className="max-w-[44ch] text-pretty text-base leading-[1.9] text-neutral-400">
            会議室の空き状況と位置を、迷わず予約できる。スタートアップのオフィスに、ちょうどいい会議室予約です。
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href="/signup"
              className="inline-block rounded-[10px] bg-emerald-200 px-[30px] py-[15px] text-[15px] font-semibold text-emerald-900"
            >
              {CTA_LABEL}
            </Link>
            <a
              href="#story"
              className="inline-block rounded-[10px] border border-neutral-700 px-[26px] py-[15px] text-[15px] font-medium text-[#ededed]"
            >
              3分でわかる仕組み
            </a>
          </div>
        </div>

        <div className="mx-auto max-w-[1120px] px-6">
          <div className="rounded-t-2xl border border-b-0 border-neutral-800 bg-[#141414] p-4 pb-0">
            <div className="flex flex-wrap items-center gap-4 px-1 pb-3.5 text-xs text-neutral-400">
              <span className="flex items-center gap-1.5">
                <span className="h-[11px] w-[11px] rounded-[3px] bg-emerald-200" />
                空き
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-[11px] w-[11px] rounded-[3px] bg-rose-200" />
                使用中
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-[11px] w-[11px] rounded-[3px] bg-neutral-600" />
                予約対象外
              </span>
              <span className="ml-auto font-mono">本社ビル 3F ・ 更新 14:20</span>
            </div>
            <LandingFloorMap />
          </div>
        </div>
      </div>

      {/* ストーリー：Before/After */}
      <div id="story" className="mx-auto max-w-[1120px] px-6 py-20">
        <h2 className="mb-10 text-[clamp(22px,2.6vw,30px)] font-bold tracking-tight">
          予約はできている。探す時間だけが残っている。
        </h2>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div className="min-w-0 rounded-2xl border border-neutral-200 bg-neutral-50 p-7">
            <span className="inline-block rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 font-mono text-[11px] text-rose-800">
              BEFORE
            </span>
            <ul className="mt-5 flex flex-col gap-3.5 pl-5 text-sm leading-[1.8] text-neutral-600">
              {BEFORE_ITEMS.map((item) => (
                <li key={item} className="list-disc">
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="min-w-0 rounded-2xl border border-emerald-200 bg-[#f0fdf9] p-7">
            <span className="inline-block rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-mono text-[11px] text-emerald-800">
              AFTER
            </span>
            <ul className="mt-5 flex flex-col gap-3.5 pl-5 text-sm leading-[1.8] text-emerald-800">
              {AFTER_ITEMS.map((item) => (
                <li key={item} className="list-disc">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* 機能 */}
      <div id="features" className="border-t border-neutral-200 bg-neutral-50">
        <div className="mx-auto flex max-w-[1120px] flex-col gap-14 px-6 py-20">
          {FEATURES.map((feature) => (
            <div
              key={feature.no}
              className="grid grid-cols-1 items-center gap-9 sm:grid-cols-2"
            >
              <div className="flex min-w-0 flex-col gap-3.5">
                <span className="font-mono text-xs text-emerald-700">{feature.no}</span>
                <h3 className="text-[clamp(19px,2.2vw,24px)] font-bold leading-snug">
                  {feature.title}
                </h3>
                <p className="max-w-[46ch] text-[15px] leading-[1.9] text-neutral-600">
                  {feature.body}
                </p>
              </div>
              <div className="flex h-[200px] min-w-0 items-end rounded-2xl border border-neutral-200 bg-[repeating-linear-gradient(135deg,#ffffff_0,#ffffff_10px,#f4f4f4_10px,#f4f4f4_20px)] p-3.5">
                <span className="font-mono text-[11px] text-neutral-400">{feature.slot}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 連携 */}
      <div className="mx-auto max-w-[1120px] px-6 py-18">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {INTEGRATIONS.map((integration) => (
            <div
              key={integration.name}
              className="flex min-w-0 flex-col gap-2.5 rounded-xl border border-neutral-200 p-5"
            >
              <span className="text-sm font-semibold">{integration.name}</span>
              <span
                className={`inline-block w-fit rounded-full px-2.5 py-1 text-[11px] leading-[1.4] ${integration.badgeClass}`}
              >
                {integration.status}
              </span>
              <p className="text-[13px] leading-[1.75] text-neutral-500">{integration.note}</p>
            </div>
          ))}
        </div>
      </div>

      {/* FAQ */}
      <div id="faq" className="border-t border-neutral-200">
        <div className="mx-auto grid max-w-[1120px] grid-cols-1 gap-10 px-6 py-20 sm:grid-cols-2">
          <h2 className="self-start text-[clamp(22px,2.6vw,30px)] font-bold tracking-tight">
            よくある質問
          </h2>
          <FaqAccordion faqs={FAQS} />
        </div>
      </div>

      {/* 最終CTA */}
      <div id="cta" className="border-t border-neutral-200 bg-emerald-50">
        <div className="mx-auto flex max-w-[1120px] flex-col items-center gap-5 px-6 py-20 text-center">
          <h2 className="text-[clamp(24px,3.2vw,38px)] font-bold tracking-tight text-emerald-900">
            フロアを1つ登録するところから
          </h2>
          <p className="max-w-[52ch] text-[15px] leading-[1.85] text-emerald-800">
            Googleアカウントでサインインして、建物とフロアを登録。会議室を並べれば、その日からマップで予約できます。
          </p>
          <Link
            href="/signup"
            className="mt-2 inline-block rounded-[10px] bg-emerald-700 px-8 py-[15px] text-[15px] font-semibold text-white"
          >
            {CTA_LABEL}
          </Link>
          <span className="font-mono text-xs text-emerald-700">
            14日間無料 ・ クレジットカード不要
          </span>
        </div>
      </div>

      <footer className="mx-auto flex max-w-[1120px] flex-wrap justify-between gap-4 px-6 py-8 font-mono text-xs text-neutral-400">
        <span>Roomap</span>
        <span>© 2026</span>
      </footer>
    </div>
  );
}
