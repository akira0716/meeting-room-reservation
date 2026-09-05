"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { saveFloorLayoutAction, type NewRoomInput } from "@/app/actions";
import { formatDateLabel, toDatetimeLocalValue } from "@/lib/dateKey";
import type { FloorMapData, RoomWithReservations } from "@/lib/queries/getFloorMapData";
import { isOverlapping } from "@/lib/services/reservationOverlap";
import { FloorPlanUploadForm } from "./FloorPlanUploadForm";
import { RoomDetailPanel } from "./RoomDetailPanel";

const PADDING = 24;
const DEFAULT_ROOM_WIDTH = 120;
const DEFAULT_ROOM_HEIGHT = 80;

type Position = { x: number; y: number };
type RoomLayout = { x: number; y: number; width: number; height: number };

const MIN_ROOM_WIDTH = 40;
const MIN_ROOM_HEIGHT = 30;

/** まだDBに保存されていない、追加中の会議室。tempIdはクライアント側だけの一時識別子 */
type DraftRoom = {
  tempId: string;
  name: string;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
  capacity: number | null;
};

function floorLabel(floor: FloorMapData["floors"][number]): string {
  return floor.label ?? `${floor.floorNumber}F`;
}

function createTempId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `draft-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function FloorMapView({ data, isAdmin }: { data: FloorMapData; isAdmin: boolean }) {
  const [selectedFloorId, setSelectedFloorId] = useState(data.floors[0]?.id);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  // ドラッグで動かした／リサイズした位置・サイズだが、まだ「保存」を押していないもの。
  // id(roomId or draftのtempId) -> レイアウト
  const [pendingLayout, setPendingLayout] = useState<Record<string, RoomLayout>>({});
  const [draftRooms, setDraftRooms] = useState<DraftRoom[]>([]);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<Set<string>>(new Set());
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [resizingId, setResizingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [popoverPos, setPopoverPos] = useState<{ left: number; top: number } | null>(null);
  // 会議室検索（参加人数・開始/終了時刻）。フロアは検索条件に含めず、今表示中の
  // フロアの中だけで絞り込む（フロアタブと役割が重複しないようにするため）。
  // 開始・終了は時刻のみ（"HH:MM"）を入力させ、日付は常にdata.date（フロアマップが
  // 表示中の日付）を使う。以前はdatetime-localで日付も入力できてしまい、今日以外の
  // 日付を打ち込んでも実際にはdata.date（読み込み済みの予約データの日）でしか
  // 判定されないため、誤った空き状況が表示される不具合があった。
  const [searchCapacity, setSearchCapacity] = useState("");
  const [searchStartTime, setSearchStartTime] = useState("");
  const [searchEndTime, setSearchEndTime] = useState("");
  const svgRef = useRef<SVGSVGElement>(null);
  // mapOuterRef: ポップオーバーの位置決めの基準（overflowをclipしない、常に全体を包む要素）
  // mapContainerRef: 実際にスクロール／クリップする箱（フロア図画像の表示・スクロール状態はここが持つ）
  const mapOuterRef = useRef<HTMLDivElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const dragSizeRef = useRef({ width: 0, height: 0 });
  const resizeOriginRef = useRef({ x: 0, y: 0 });

  const selectedFloor = data.floors.find((f) => f.id === selectedFloorId) ?? data.floors[0];
  const hasPendingChanges =
    Object.keys(pendingLayout).length > 0 || draftRooms.length > 0 || pendingDeleteIds.size > 0;

  // 会議室検索：編集モード中は対象外（編集モードには別のツールバーがある）。
  // 参加人数・開始/終了時刻はそれぞれ独立に適用でき、指定していない条件は無視する。
  // data.dateの1日分の予約しか読み込んでいないため、検索もその日の時間帯のみを対象にする。
  const searchRange =
    searchStartTime && searchEndTime
      ? { start: new Date(`${data.date}T${searchStartTime}`), end: new Date(`${data.date}T${searchEndTime}`) }
      : null;
  const hasValidSearchRange =
    searchRange !== null &&
    !Number.isNaN(searchRange.start.getTime()) &&
    !Number.isNaN(searchRange.end.getTime()) &&
    searchRange.start < searchRange.end;
  const isSearchActive = !isEditMode && (searchCapacity !== "" || hasValidSearchRange);
  const dateLabel = data.isToday ? "本日" : formatDateLabel(data.date);

  // 予約フォームの開始・終了の初期値。検索条件（開始/終了時刻）を指定していれば
  // それを引き継ぎ、無指定なら「今日を見ている場合は現在時刻を切り上げた次の30分単位」
  // 「今日以外を見ている場合はその日の9:00」をデフォルトにする（今日以外では
  // "現在時刻"に意味が無いため）。
  const defaultBookingRange = (() => {
    if (hasValidSearchRange) {
      return { start: `${data.date}T${searchStartTime}`, end: `${data.date}T${searchEndTime}` };
    }
    if (data.isToday) {
      const now = new Date();
      const start = new Date(now);
      start.setMinutes(Math.ceil(start.getMinutes() / 30) * 30, 0, 0);
      const end = new Date(start.getTime() + 30 * 60_000);
      return { start: toDatetimeLocalValue(start), end: toDatetimeLocalValue(end) };
    }
    return { start: `${data.date}T09:00`, end: `${data.date}T09:30` };
  })();

  function roomMatchesSearch(room: RoomWithReservations): boolean {
    if (searchCapacity !== "") {
      const requiredCapacity = Number(searchCapacity);
      if (room.capacity == null || room.capacity < requiredCapacity) return false;
    }
    if (hasValidSearchRange && searchRange) {
      const hasConflict = room.reservations.some((r) =>
        isOverlapping(searchRange, { start: r.startAt, end: r.endAt }),
      );
      if (hasConflict) return false;
    }
    return true;
  }

  // SVG描画用に、既存の会議室と追加中の会議室を1つのリストにまとめる。
  // ドラッグ移動・リサイズ中の座標（pendingLayout）をここで反映するため、
  // viewBoxの計算（このすぐ下）もこのdisplayRoomsを基準にする。
  // selectedFloor.rooms（サーバーから取得した保存済みの状態）だけを見て
  // viewBoxを決めると、保存前の編集中の位置・サイズがviewBoxに反映されず、
  // 「保存前は表示がずれる／保存後に正しいサイズに直る」という不具合になる。
  const displayRooms = [
    ...(selectedFloor?.rooms.map((room) => {
      const pending = pendingLayout[room.id];
      const baseLayout: RoomLayout = {
        x: room.positionX,
        y: room.positionY,
        width: room.width,
        height: room.height,
      };
      return {
        id: room.id,
        name: room.name,
        x: pending ? pending.x : baseLayout.x,
        y: pending ? pending.y : baseLayout.y,
        width: pending ? pending.width : baseLayout.width,
        height: pending ? pending.height : baseLayout.height,
        // 今日を見ている場合は「今まさに使用中か」、それ以外の日を見ている場合は
        // 「その日に予約が1件でもあるか」を「busy（空きではない）」とみなす。
        // 過去・未来の日付には「今」という概念が無いため、isOccupiedNowをそのまま
        // 使うと常に「空き」に見えてしまう
        isBusy: data.isToday ? room.isOccupiedNow : room.reservations.length > 0,
        isDraft: false,
        markedForDelete: pendingDeleteIds.has(room.id),
        matchesSearch: !isSearchActive || roomMatchesSearch(room),
        baseLayout,
      };
    }) ?? []),
    ...draftRooms.map((draft) => {
      const pending = pendingLayout[draft.tempId];
      const baseLayout: RoomLayout = {
        x: draft.positionX,
        y: draft.positionY,
        width: draft.width,
        height: draft.height,
      };
      return {
        id: draft.tempId,
        name: draft.name || "（名称未設定）",
        x: pending ? pending.x : baseLayout.x,
        y: pending ? pending.y : baseLayout.y,
        width: pending ? pending.width : baseLayout.width,
        height: pending ? pending.height : baseLayout.height,
        isBusy: false,
        isDraft: true,
        markedForDelete: false,
        matchesSearch: true,
        baseLayout,
      };
    }),
  ];

  // フロア図（背景画像）があるフロアは、画像の実ピクセルサイズをそのまま
  // 表示エリア＝1フロアとして扱う（拡大縮小せず、はみ出す分はスクロールする）。
  // 画像が無いフロアは、表示エリア自体を1フロア分として使い、部屋の配置範囲に
  // 合わせて拡大縮小して表示する（スクロールは不要）。
  const floorPlanWidth = selectedFloor?.floorPlanImageWidth ?? null;
  const floorPlanHeight = selectedFloor?.floorPlanImageHeight ?? null;
  const hasFloorPlanImage = Boolean(
    selectedFloor?.floorPlanImageUrl && floorPlanWidth && floorPlanHeight,
  );

  const viewBox = (() => {
    if (floorPlanWidth && floorPlanHeight) {
      return `0 0 ${floorPlanWidth} ${floorPlanHeight}`;
    }
    if (displayRooms.length === 0) {
      return `0 0 400 200`;
    }
    const maxX = Math.max(...displayRooms.map((r) => r.x + r.width));
    const maxY = Math.max(...displayRooms.map((r) => r.y + r.height));
    return `0 0 ${maxX + PADDING} ${maxY + PADDING}`;
  })();

  const selectedRoom: RoomWithReservations | undefined = selectedFloor?.rooms.find(
    (r) => r.id === selectedRoomId,
  );

  // 予約状況ポップオーバーを、クリックした会議室の右隣（収まらなければ左隣）に
  // フロアマップ上へ重ねて表示する。フロアマップの枠からはみ出しても見切れない
  // よう、ポップオーバーはマップの外（mapOuterRef直下、スクロールしない要素）に
  // 置いている。そのため位置は「現在画面のどこに見えているか」（mapOuterRef基準の
  // 現在のビューポート相対位置）で計算する必要があり、スクロールするたびに
  // 再計算する（scrollイベントを監視）。
  useLayoutEffect(() => {
    // 対象が無い場合は何もしない（描画側はselectedRoom/popoverPosの有無だけで
    // ポップオーバーの表示可否を判定するため、ここで明示的にクリアする必要はない）
    if (isEditMode || !selectedRoomId) return;
    const svg = svgRef.current;
    const outer = mapOuterRef.current;
    const room = displayRooms.find((r) => r.id === selectedRoomId);
    if (!svg || !outer || !room) return;

    const POPOVER_WIDTH = 300;
    const GAP = 8;

    function computePosition() {
      const svgEl = svgRef.current;
      const outerEl = mapOuterRef.current;
      const containerEl = mapContainerRef.current;
      if (!svgEl || !outerEl || !room) return;
      const screenCtm = svgEl.getScreenCTM();
      if (!screenCtm) return;
      const ctm: DOMMatrix = screenCtm;

      const outerRect = outerEl.getBoundingClientRect();

      function toOuterRelativePoint(svgX: number, svgY: number) {
        const point = svgEl!.createSVGPoint();
        point.x = svgX;
        point.y = svgY;
        const screenPoint = point.matrixTransform(ctm);
        return {
          x: screenPoint.x - outerRect.left,
          y: screenPoint.y - outerRect.top,
        };
      }

      const topRight = toOuterRelativePoint(room.x + room.width, room.y);
      const topLeft = toOuterRelativePoint(room.x, room.y);

      // フロアマップの枠からはみ出す表示を許容するため、0や枠幅でクランプしない
      // （右に入り切らない時だけ左隣に切り替える、という判定にのみ使う）
      const visibleWidth = containerEl?.clientWidth ?? outerRect.width;
      const fitsOnRight = topRight.x + GAP + POPOVER_WIDTH <= visibleWidth;
      const left = fitsOnRight ? topRight.x + GAP : topLeft.x - GAP - POPOVER_WIDTH;
      const top = topRight.y;

      setPopoverPos({ left, top });
    }

    computePosition();
    const containerEl = mapContainerRef.current;
    window.addEventListener("resize", computePosition);
    // フロア図画像のフロアはマップ内をスクロールできるため、スクロールするたびに
    // 会議室の画面上の位置が変わる。ポップオーバーはスクロールしない
    // mapOuterRef直下にあるため、scrollイベントで都度追従させる必要がある
    containerEl?.addEventListener("scroll", computePosition);
    return () => {
      window.removeEventListener("resize", computePosition);
      containerEl?.removeEventListener("scroll", computePosition);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRoomId, isEditMode, viewBox]);

  function resetPendingEdits() {
    setPendingLayout({});
    setDraftRooms([]);
    setPendingDeleteIds(new Set());
  }

  // 画面上のポインタ座標(px)を、SVGのviewBox座標系に変換する。
  // SVGは表示サイズとviewBoxのスケールが異なるため、getScreenCTMの逆行列を使うのが確実。
  function toSvgPoint(clientX: number, clientY: number): Position {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const point = svg.createSVGPoint();
    point.x = clientX;
    point.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const transformed = point.matrixTransform(ctm.inverse());
    return { x: transformed.x, y: transformed.y };
  }

  function confirmDiscardIfNeeded(): boolean {
    if (!hasPendingChanges) return true;
    return window.confirm("保存されていない変更があります。破棄しますか？");
  }

  function handlePointerDown(e: React.PointerEvent<SVGGElement>, id: string, base: RoomLayout) {
    if (!isEditMode) return;
    // 削除／元に戻す／リサイズハンドル上でのpointerdownはドラッグ扱いにしない。
    // setPointerCaptureをここで取ってしまうと、後続のclickイベントの発火先が
    // このg要素側に変わってしまい、ボタン自体のonClickが発火しなくなるため。
    if ((e.target as Element).closest("[data-no-drag]")) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const svgPoint = toSvgPoint(e.clientX, e.clientY);
    const current = pendingLayout[id] ?? base;
    dragOffsetRef.current = { x: svgPoint.x - current.x, y: svgPoint.y - current.y };
    dragSizeRef.current = { width: current.width, height: current.height };
    setDraggingId(id);
  }

  function handlePointerMove(e: React.PointerEvent<SVGGElement>, id: string) {
    if (draggingId !== id) return;
    const svgPoint = toSvgPoint(e.clientX, e.clientY);
    const { width, height } = dragSizeRef.current;
    setPendingLayout((prev) => ({
      ...prev,
      [id]: {
        x: Math.max(0, svgPoint.x - dragOffsetRef.current.x),
        y: Math.max(0, svgPoint.y - dragOffsetRef.current.y),
        width,
        height,
      },
    }));
  }

  function handlePointerUp() {
    setDraggingId(null);
  }

  // 会議室の右下角のハンドルをドラッグしてサイズ変更する。位置（左上）は固定し、
  // ポインタ位置までwidth/heightを伸縮させる（最小サイズでクランプ）。
  function handleResizePointerDown(
    e: React.PointerEvent<SVGRectElement>,
    id: string,
    base: RoomLayout,
  ) {
    if (!isEditMode) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const current = pendingLayout[id] ?? base;
    resizeOriginRef.current = { x: current.x, y: current.y };
    setResizingId(id);
  }

  function handleResizePointerMove(e: React.PointerEvent<SVGRectElement>, id: string) {
    if (resizingId !== id) return;
    const svgPoint = toSvgPoint(e.clientX, e.clientY);
    const origin = resizeOriginRef.current;
    setPendingLayout((prev) => ({
      ...prev,
      [id]: {
        x: origin.x,
        y: origin.y,
        width: Math.max(MIN_ROOM_WIDTH, svgPoint.x - origin.x),
        height: Math.max(MIN_ROOM_HEIGHT, svgPoint.y - origin.y),
      },
    }));
  }

  function handleResizePointerUp() {
    setResizingId(null);
  }

  function handleAddRoom() {
    if (!selectedFloor) return;
    const offset = (draftRooms.length % 6) * 24;
    setDraftRooms((prev) => [
      ...prev,
      {
        tempId: createTempId(),
        name: "",
        positionX: 40 + offset,
        positionY: 40 + offset,
        width: DEFAULT_ROOM_WIDTH,
        height: DEFAULT_ROOM_HEIGHT,
        capacity: null,
      },
    ]);
  }

  function updateDraftRoom(tempId: string, patch: Partial<DraftRoom>) {
    setDraftRooms((prev) =>
      prev.map((room) => (room.tempId === tempId ? { ...room, ...patch } : room)),
    );
  }

  function removeDraftRoom(tempId: string) {
    setDraftRooms((prev) => prev.filter((room) => room.tempId !== tempId));
    setPendingLayout((prev) => {
      const next = { ...prev };
      delete next[tempId];
      return next;
    });
  }

  function toggleDeleteRoom(roomId: string) {
    setPendingDeleteIds((prev) => {
      const next = new Set(prev);
      if (next.has(roomId)) {
        next.delete(roomId);
      } else {
        next.add(roomId);
      }
      return next;
    });
  }

  async function handleSave() {
    if (!selectedFloor) return;
    if (draftRooms.some((draft) => draft.name.trim().length === 0)) {
      window.alert("追加予定の会議室に名前を入力してください");
      return;
    }
    setIsSaving(true);

    const positionUpdates = selectedFloor.rooms
      .filter((room) => pendingLayout[room.id] && !pendingDeleteIds.has(room.id))
      .map((room) => ({
        roomId: room.id,
        positionX: pendingLayout[room.id].x,
        positionY: pendingLayout[room.id].y,
        width: pendingLayout[room.id].width,
        height: pendingLayout[room.id].height,
      }));

    const newRooms: NewRoomInput[] = draftRooms.map((draft) => {
      const layout = pendingLayout[draft.tempId] ?? {
        x: draft.positionX,
        y: draft.positionY,
        width: draft.width,
        height: draft.height,
      };
      return {
        name: draft.name,
        positionX: layout.x,
        positionY: layout.y,
        width: layout.width,
        height: layout.height,
        capacity: draft.capacity,
      };
    });

    const result = await saveFloorLayoutAction({
      floorId: selectedFloor.id,
      positionUpdates,
      newRooms,
      deleteRoomIds: Array.from(pendingDeleteIds),
    });

    if (result.error) {
      window.alert(result.error);
      setIsSaving(false);
      return;
    }

    resetPendingEdits();
    setIsSaving(false);
  }

  function handleDiscard() {
    resetPendingEdits();
  }

  return (
    <div>
      <div className="flex items-center gap-2 border-b border-black/10 pb-2 dark:border-white/10">
        {data.floors.map((floor) => (
          <button
            key={floor.id}
            type="button"
            onClick={() => {
              if (!confirmDiscardIfNeeded()) return;
              resetPendingEdits();
              setSelectedFloorId(floor.id);
              setSelectedRoomId(null);
            }}
            className={
              floor.id === selectedFloor?.id
                ? "rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
                : "rounded-md px-3 py-1.5 text-sm text-neutral-500 hover:bg-black/5 dark:hover:bg-white/10"
            }
          >
            {floorLabel(floor)}
          </button>
        ))}

        {isAdmin && (
          <button
            type="button"
            onClick={() => {
              if (isEditMode && !confirmDiscardIfNeeded()) return;
              resetPendingEdits();
              setIsEditMode((v) => !v);
              setSelectedRoomId(null);
            }}
            className={
              isEditMode
                ? "ml-auto rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700"
                : "ml-auto rounded-md border border-black/10 px-3 py-1.5 text-sm text-neutral-500 hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
            }
          >
            {isEditMode ? "編集モードを終了" : "会議室の配置を編集"}
          </button>
        )}
      </div>

      {isEditMode && (
        <div className="mt-2 flex items-center gap-3 text-xs">
          <p className="text-neutral-500">
            会議室をドラッグして位置を調整、右下の■をドラッグしてサイズ変更できます。右側から追加・削除もできます。
          </p>
          {hasPendingChanges && (
            <div className="ml-auto flex items-center gap-2">
              <span className="text-amber-600 dark:text-amber-400">未保存の変更があります</span>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="rounded-md bg-neutral-900 px-3 py-1 text-xs font-medium text-white hover:bg-neutral-700 disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
              >
                {isSaving ? "保存中..." : "保存"}
              </button>
              <button
                type="button"
                onClick={handleDiscard}
                disabled={isSaving}
                className="rounded-md px-3 py-1 text-xs text-neutral-500 hover:text-neutral-800 disabled:opacity-50 dark:hover:text-neutral-200"
              >
                破棄
              </button>
            </div>
          )}
        </div>
      )}

      {!isEditMode && (
        <div className="mt-2 flex flex-wrap items-end gap-3 text-xs">
          <div>
            <label className="block text-neutral-500">参加人数</label>
            <input
              type="number"
              min={1}
              value={searchCapacity}
              onChange={(e) => setSearchCapacity(e.target.value)}
              placeholder="指定なし"
              className="mt-0.5 w-20 rounded border border-black/10 bg-transparent px-2 py-1 dark:border-white/10"
            />
          </div>
          <div>
            <label className="block text-neutral-500">開始</label>
            <input
              type="time"
              value={searchStartTime}
              onChange={(e) => setSearchStartTime(e.target.value)}
              className="mt-0.5 rounded border border-black/10 bg-transparent px-2 py-1 dark:border-white/10"
            />
          </div>
          <div>
            <label className="block text-neutral-500">終了</label>
            <input
              type="time"
              value={searchEndTime}
              onChange={(e) => setSearchEndTime(e.target.value)}
              className="mt-0.5 rounded border border-black/10 bg-transparent px-2 py-1 dark:border-white/10"
            />
          </div>
          {isSearchActive && (
            <>
              <button
                type="button"
                onClick={() => {
                  setSearchCapacity("");
                  setSearchStartTime("");
                  setSearchEndTime("");
                }}
                className="text-neutral-500 underline underline-offset-2 hover:text-neutral-800 dark:hover:text-neutral-200"
              >
                検索条件をクリア
              </button>
              {!displayRooms.some((r) => !r.isDraft && r.matchesSearch) && (
                <span className="text-rose-600 dark:text-rose-400">
                  条件に合う会議室がありません
                </span>
              )}
            </>
          )}
          <p className="w-full text-neutral-400">（{dateLabel}の空き状況で絞り込みます）</p>
        </div>
      )}

      {isAdmin && selectedFloor && <FloorPlanUploadForm floorId={selectedFloor.id} />}

      <div className="mt-4">
        {/*
          フロアマップは画面横いっぱいに表示する。予約状況（RoomDetailPanel）は
          専用のカラムを設けず、クリックした会議室の右隣（収まらなければ左隣）に
          ポップオーバーとしてマップ上へ重ねて表示する（下のuseLayoutEffect参照）。
          ポップオーバーはフロアマップの外（mapOuterRef直下）に置き、マップ側の
          overflow-hidden/overflow-autoでは見切れないようにしている。

          フロア図画像があるフロアは、画像の実ピクセルサイズをそのまま
          表示エリア＝1フロアとして扱う（拡大縮小せず、はみ出す分はスクロール
          する。見た目のスクロールバーはno-scrollbarで隠す）。画像が無い
          フロアは、表示エリア自体を1フロア分として使い、部屋の配置範囲に
          合わせてaspect-ratio固定のコンテナ内で拡大縮小して表示する
          （スクロール不要）。
        */}
        <div ref={mapOuterRef} className="relative w-full min-w-0">
          <div
            ref={mapContainerRef}
            className={
              hasFloorPlanImage
                ? "no-scrollbar max-h-[60vh] w-full overflow-auto rounded-lg border border-black/10 dark:border-white/10"
                : "aspect-[4/3] w-full overflow-hidden rounded-lg border border-black/10 bg-neutral-50 dark:border-white/10 dark:bg-neutral-950"
            }
          >
            <svg
              ref={svgRef}
              viewBox={viewBox}
              width={hasFloorPlanImage ? (floorPlanWidth ?? undefined) : undefined}
              height={hasFloorPlanImage ? (floorPlanHeight ?? undefined) : undefined}
              preserveAspectRatio={hasFloorPlanImage ? undefined : "xMidYMid meet"}
              className={hasFloorPlanImage ? "block" : "h-full w-full"}
            >
            {hasFloorPlanImage && selectedFloor?.floorPlanImageUrl && (
              <image
                href={selectedFloor.floorPlanImageUrl}
                x={0}
                y={0}
                width={floorPlanWidth ?? undefined}
                height={floorPlanHeight ?? undefined}
              />
            )}
            {displayRooms.map((room) => {
            const isDragging = draggingId === room.id;

            return (
              <g
                key={room.id}
                onClick={() => {
                  if (!isEditMode && room.matchesSearch) setSelectedRoomId(room.id);
                }}
                onPointerDown={(e) => {
                  if (room.markedForDelete) return;
                  handlePointerDown(e, room.id, room.baseLayout);
                }}
                onPointerMove={(e) => handlePointerMove(e, room.id)}
                onPointerUp={handlePointerUp}
                className={
                  isEditMode
                    ? room.markedForDelete
                      ? "cursor-not-allowed"
                      : isDragging
                        ? "cursor-grabbing"
                        : "cursor-grab"
                    : room.matchesSearch
                      ? "cursor-pointer"
                      : "cursor-not-allowed"
                }
              >
                <rect
                  x={room.x}
                  y={room.y}
                  width={room.width}
                  height={room.height}
                  rx={6}
                  fillOpacity={
                    room.markedForDelete || !room.matchesSearch
                      ? 0.25
                      : selectedFloor?.floorPlanImageUrl
                        ? 0.55
                        : 1
                  }
                  strokeDasharray={
                    room.markedForDelete || !room.matchesSearch ? "4 3" : undefined
                  }
                  className={
                    room.markedForDelete
                      ? "stroke-2 stroke-rose-500"
                      : room.isDraft
                        ? "stroke-2 stroke-emerald-500"
                        : pendingLayout[room.id]
                          ? "stroke-2 stroke-amber-500"
                          : !room.matchesSearch
                            ? "stroke-1 stroke-black/20 dark:stroke-white/20"
                            : room.id === selectedRoomId
                              ? "stroke-2 stroke-neutral-900 dark:stroke-white"
                              : isSearchActive
                                ? "stroke-2 stroke-sky-500"
                                : "stroke-1 stroke-black/20 dark:stroke-white/20"
                  }
                  fill={
                    !room.matchesSearch
                      ? "var(--room-muted)"
                      : room.isBusy
                        ? "var(--room-occupied)"
                        : "var(--room-available)"
                  }
                />
                <text
                  x={room.x + room.width / 2}
                  y={room.y + room.height / 2 - 6}
                  textAnchor="middle"
                  className="select-none fill-neutral-900 text-[13px] font-medium dark:fill-neutral-50"
                >
                  {room.name}
                </text>
                <text
                  x={room.x + room.width / 2}
                  y={room.y + room.height / 2 + 12}
                  textAnchor="middle"
                  className="select-none fill-neutral-600 text-[11px] dark:fill-neutral-300"
                >
                  {room.markedForDelete
                    ? "削除予定"
                    : room.isDraft
                      ? "追加予定"
                      : !room.matchesSearch
                        ? "条件外"
                        : room.isBusy
                          ? data.isToday
                            ? "使用中"
                            : "予約あり"
                          : "空き"}
                </text>
                {isEditMode && !room.markedForDelete && (
                  <text
                    data-no-drag
                    x={room.x + room.width - 10}
                    y={room.y + 14}
                    textAnchor="middle"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (room.isDraft) {
                        removeDraftRoom(room.id);
                      } else {
                        toggleDeleteRoom(room.id);
                      }
                    }}
                    className="cursor-pointer select-none fill-rose-600 text-[14px] font-bold hover:fill-rose-800 dark:fill-rose-400"
                  >
                    ×
                  </text>
                )}
                {isEditMode && !room.markedForDelete && (
                  <rect
                    data-no-drag
                    x={room.x + room.width - 7}
                    y={room.y + room.height - 7}
                    width={14}
                    height={14}
                    rx={2}
                    onPointerDown={(e) => handleResizePointerDown(e, room.id, room.baseLayout)}
                    onPointerMove={(e) => handleResizePointerMove(e, room.id)}
                    onPointerUp={handleResizePointerUp}
                    className="cursor-nwse-resize fill-neutral-900 stroke-1 stroke-white dark:fill-white dark:stroke-neutral-900"
                  />
                )}
                {isEditMode && room.markedForDelete && (
                  <text
                    data-no-drag
                    x={room.x + room.width / 2}
                    y={room.y - 6}
                    textAnchor="middle"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleDeleteRoom(room.id);
                    }}
                    className="cursor-pointer select-none fill-neutral-500 text-[10px] underline hover:fill-neutral-800 dark:hover:fill-neutral-200"
                  >
                    元に戻す
                  </text>
                )}
              </g>
            );
          })}
            </svg>
          </div>

          {!isEditMode && selectedRoom && popoverPos && (
            <div
              className="absolute z-10"
              style={{ left: popoverPos.left, top: popoverPos.top, width: 300 }}
            >
              <RoomDetailPanel
                key={selectedRoom.id}
                room={selectedRoom}
                onClose={() => setSelectedRoomId(null)}
                dateLabel={dateLabel}
                isToday={data.isToday}
                initialBookingRange={defaultBookingRange}
              />
            </div>
          )}
        </div>

        {!isEditMode && (
          // 会議室選択の有無でこの行の高さが変わると、ページ全体の高さが
          // わずかに変動し、ブラウザの縦スクロールバーが出たり消えたり
          // することでレイアウトがガタつく。selectedRoomの有無に関わらず
          // 常にこの行自体は描画し、中身の見た目だけをinvisibleで切り替える。
          <p
            className={
              selectedRoom
                ? "invisible mt-2 text-sm text-neutral-400"
                : "mt-2 text-sm text-neutral-400"
            }
          >
            会議室をクリックすると、{dateLabel}の予約状況と予約フォームが表示されます。
          </p>
        )}

        {isEditMode && (
          <div className="mt-4 space-y-4 text-sm">
            <button
              type="button"
              onClick={handleAddRoom}
              className="rounded-md border border-dashed border-black/20 px-3 py-2 text-xs font-medium text-neutral-600 hover:bg-black/5 dark:border-white/20 dark:text-neutral-300 dark:hover:bg-white/10"
            >
              ＋ 会議室を追加
            </button>

            {draftRooms.length > 0 && (
              <div>
                <p className="text-xs font-medium text-neutral-500">
                  追加予定の会議室（ドラッグで配置調整可）
                </p>
                <ul className="mt-1 grid max-h-56 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
                  {draftRooms.map((draft) => (
                    <li
                      key={draft.tempId}
                      className="rounded-md border border-emerald-500/40 p-2"
                    >
                      <input
                        type="text"
                        required
                        placeholder="会議室名"
                        value={draft.name}
                        onChange={(e) => updateDraftRoom(draft.tempId, { name: e.target.value })}
                        className="w-full rounded border border-black/10 bg-transparent px-2 py-1 text-xs dark:border-white/10"
                      />
                      <div className="mt-1 flex items-center gap-2">
                        <label className="text-xs text-neutral-500">定員</label>
                        <input
                          type="number"
                          min={1}
                          value={draft.capacity ?? ""}
                          onChange={(e) =>
                            updateDraftRoom(draft.tempId, {
                              capacity: e.target.value ? Number(e.target.value) : null,
                            })
                          }
                          className="w-16 rounded border border-black/10 bg-transparent px-2 py-1 text-xs dark:border-white/10"
                        />
                        <button
                          type="button"
                          onClick={() => removeDraftRoom(draft.tempId)}
                          className="ml-auto text-xs text-rose-600 hover:text-rose-800 dark:text-rose-400"
                        >
                          取り消す
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <p className="text-neutral-400">
              会議室の右上の「×」で削除予定に、右下の■でサイズ変更できます。
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
