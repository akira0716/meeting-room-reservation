const BOX_WIDTH = 660;
const BOX_HEIGHT = 400;

type RoomStatus = "free" | "busy" | "muted";

type DemoRoom = {
  id: string;
  name: string;
  cap: string;
  x: number;
  y: number;
  w: number;
  h: number;
  status: RoomStatus;
};

// LPのヒーロー部分を飾る、架空のフロアマップ（実データとは無関係の説明用イラスト）
const ROOMS: DemoRoom[] = [
  { id: "sakura", name: "さくら", cap: "8名", x: 24, y: 24, w: 196, h: 132, status: "free" },
  { id: "kaede", name: "かえで", cap: "6名", x: 236, y: 24, w: 152, h: 132, status: "busy" },
  { id: "kiri", name: "きり", cap: "4名", x: 404, y: 24, w: 132, h: 92, status: "free" },
  { id: "booth", name: "フォンブース", cap: "1名", x: 552, y: 24, w: 84, h: 92, status: "busy" },
  { id: "kusunoki", name: "くすのき", cap: "12名", x: 24, y: 176, w: 220, h: 116, status: "free" },
  { id: "hinoki", name: "ひのき", cap: "6名", x: 260, y: 176, w: 148, h: 116, status: "busy" },
  { id: "lounge", name: "ラウンジ", cap: "", x: 424, y: 136, w: 212, h: 156, status: "muted" },
  { id: "corridor", name: "通路", cap: "", x: 24, y: 312, w: 612, h: 64, status: "muted" },
];

const FILL: Record<RoomStatus, string> = { free: "#a7f3d0", busy: "#fecdd3", muted: "#3f3f3f" };
const INK: Record<RoomStatus, string> = { free: "#064e3b", busy: "#881337", muted: "#a3a3a3" };

function pct(value: number, total: number): string {
  return `${(value / total) * 100}%`;
}

/** LPのヒーロー用、ダーク配色の静的なフロアマップ・イラスト（クリック等の操作は無し） */
export function LandingFloorMap() {
  return (
    <div className="relative aspect-[660/400] w-full rounded-b-[10px] bg-[repeating-linear-gradient(45deg,#1a1a1a_0,#1a1a1a_8px,#161616_8px,#161616_16px)]">
      {ROOMS.map((room) => {
        const roomy = room.w >= 200 && room.h >= 110;
        const showMeta = roomy && room.cap !== "";
        return (
          <div
            key={room.id}
            className="absolute overflow-hidden rounded-md border border-transparent p-1.5"
            style={{
              left: pct(room.x, BOX_WIDTH),
              top: pct(room.y, BOX_HEIGHT),
              width: pct(room.w, BOX_WIDTH),
              height: pct(room.h, BOX_HEIGHT),
              background: FILL[room.status],
            }}
          >
            <div
              className={
                "truncate font-semibold leading-tight " + (roomy ? "text-sm" : "text-xs")
              }
              style={{ color: INK[room.status] }}
            >
              {room.name}
            </div>
            {showMeta && (
              <div
                className="mt-0.5 truncate font-mono text-[11px] opacity-80"
                style={{ color: INK[room.status] }}
              >
                {room.cap}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
