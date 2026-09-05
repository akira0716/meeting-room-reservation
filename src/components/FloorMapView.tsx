"use client";

import { useMemo, useRef, useState } from "react";
import { saveFloorLayoutAction, type NewRoomInput } from "@/app/actions";
import type { FloorMapData, RoomWithReservations } from "@/lib/queries/getFloorMapData";
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
  const svgRef = useRef<SVGSVGElement>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const dragSizeRef = useRef({ width: 0, height: 0 });
  const resizeOriginRef = useRef({ x: 0, y: 0 });

  const selectedFloor = data.floors.find((f) => f.id === selectedFloorId) ?? data.floors[0];
  const hasPendingChanges =
    Object.keys(pendingLayout).length > 0 || draftRooms.length > 0 || pendingDeleteIds.size > 0;

  const viewBox = useMemo(() => {
    // フロア図（背景画像）があれば、座標系を画像のピクセルサイズに合わせる
    if (selectedFloor?.floorPlanImageWidth && selectedFloor?.floorPlanImageHeight) {
      return `0 0 ${selectedFloor.floorPlanImageWidth} ${selectedFloor.floorPlanImageHeight}`;
    }
    if (!selectedFloor || selectedFloor.rooms.length === 0) {
      return `0 0 400 200`;
    }
    const maxX = Math.max(...selectedFloor.rooms.map((r) => r.positionX + r.width));
    const maxY = Math.max(...selectedFloor.rooms.map((r) => r.positionY + r.height));
    return `0 0 ${maxX + PADDING} ${maxY + PADDING}`;
  }, [selectedFloor]);

  const selectedRoom: RoomWithReservations | undefined = selectedFloor?.rooms.find(
    (r) => r.id === selectedRoomId,
  );

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

  // SVG描画用に、既存の会議室と追加中の会議室を1つのリストにまとめる
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
        isOccupiedNow: room.isOccupiedNow,
        isDraft: false,
        markedForDelete: pendingDeleteIds.has(room.id),
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
        isOccupiedNow: false,
        isDraft: true,
        markedForDelete: false,
        baseLayout,
      };
    }),
  ];

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

      {isAdmin && selectedFloor && <FloorPlanUploadForm floorId={selectedFloor.id} />}

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-[2fr_1fr]">
        {/*
          フロア図画像の有無・部屋の配置範囲によってviewBoxの縦横比が変わり、
          そのままだと画面の高さが表示のたびに変動してしまう。
          外側をaspect-ratio固定のコンテナにし、svg自体は絶対配置でその中に
          収める（preserveAspectRatio="xMidYMid meet"でレターボックスする）ことで、
          表示領域のサイズを常に一定に保つ。

          min-w-0が無いと、CSS Gridのfrトラックは中身の最小コンテンツ幅を
          考慮してしまい、右側パネルの中身（ボタンやバッジなど）の幅次第で
          このカラム自体の幅が押し縮められ、結果としてaspect-ratioで決まる
          高さまで変動してしまう。両カラムにmin-w-0を付けて、fr比率どおりの
          幅で固定する。
        */}
        <div className="relative aspect-[4/3] w-full min-w-0 overflow-hidden rounded-lg border border-black/10 bg-neutral-50 dark:border-white/10 dark:bg-neutral-950">
          <svg
            ref={svgRef}
            viewBox={viewBox}
            preserveAspectRatio="xMidYMid meet"
            className="absolute inset-0 h-full w-full"
          >
          {selectedFloor?.floorPlanImageUrl && (
            <image
              href={selectedFloor.floorPlanImageUrl}
              x={0}
              y={0}
              width={selectedFloor.floorPlanImageWidth ?? undefined}
              height={selectedFloor.floorPlanImageHeight ?? undefined}
              preserveAspectRatio="xMidYMid slice"
            />
          )}
          {displayRooms.map((room) => {
            const isDragging = draggingId === room.id;

            return (
              <g
                key={room.id}
                onClick={() => {
                  if (!isEditMode) setSelectedRoomId(room.id);
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
                    : "cursor-pointer"
                }
              >
                <rect
                  x={room.x}
                  y={room.y}
                  width={room.width}
                  height={room.height}
                  rx={6}
                  fillOpacity={
                    room.markedForDelete ? 0.2 : selectedFloor?.floorPlanImageUrl ? 0.55 : 1
                  }
                  strokeDasharray={room.markedForDelete ? "4 3" : undefined}
                  className={
                    room.markedForDelete
                      ? "stroke-2 stroke-rose-500"
                      : room.isDraft
                        ? "stroke-2 stroke-emerald-500"
                        : pendingLayout[room.id]
                          ? "stroke-2 stroke-amber-500"
                          : room.id === selectedRoomId
                            ? "stroke-2 stroke-neutral-900 dark:stroke-white"
                            : "stroke-1 stroke-black/20 dark:stroke-white/20"
                  }
                  fill={room.isOccupiedNow ? "var(--room-occupied)" : "var(--room-available)"}
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
                      : room.isOccupiedNow
                        ? "使用中"
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

        <div className="min-w-0">
          {isEditMode ? (
            <div className="space-y-4 text-sm">
              <button
                type="button"
                onClick={handleAddRoom}
                className="w-full rounded-md border border-dashed border-black/20 px-3 py-2 text-xs font-medium text-neutral-600 hover:bg-black/5 dark:border-white/20 dark:text-neutral-300 dark:hover:bg-white/10"
              >
                ＋ 会議室を追加
              </button>

              {draftRooms.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-neutral-500">
                    追加予定の会議室（ドラッグで配置調整可）
                  </p>
                  <ul className="mt-1 max-h-56 space-y-2 overflow-y-auto">
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
                          onChange={(e) =>
                            updateDraftRoom(draft.tempId, { name: e.target.value })
                          }
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
          ) : selectedRoom ? (
            <RoomDetailPanel key={selectedRoom.id} room={selectedRoom} />
          ) : (
            <p className="text-sm text-neutral-400">
              会議室をクリックすると、本日の予約状況と予約フォームが表示されます。
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
