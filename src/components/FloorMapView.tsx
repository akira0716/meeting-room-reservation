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
  // ドラッグで動かしたが、まだ「保存」を押していない位置。id(roomId or draftのtempId) -> 座標
  const [pendingPositions, setPendingPositions] = useState<Record<string, Position>>({});
  const [draftRooms, setDraftRooms] = useState<DraftRoom[]>([]);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<Set<string>>(new Set());
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  const selectedFloor = data.floors.find((f) => f.id === selectedFloorId) ?? data.floors[0];
  const hasPendingChanges =
    Object.keys(pendingPositions).length > 0 ||
    draftRooms.length > 0 ||
    pendingDeleteIds.size > 0;

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
    setPendingPositions({});
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

  function handlePointerDown(e: React.PointerEvent<SVGGElement>, id: string, base: Position) {
    if (!isEditMode) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const svgPoint = toSvgPoint(e.clientX, e.clientY);
    const current = pendingPositions[id] ?? base;
    dragOffsetRef.current = { x: svgPoint.x - current.x, y: svgPoint.y - current.y };
    setDraggingId(id);
  }

  function handlePointerMove(e: React.PointerEvent<SVGGElement>, id: string) {
    if (draggingId !== id) return;
    const svgPoint = toSvgPoint(e.clientX, e.clientY);
    setPendingPositions((prev) => ({
      ...prev,
      [id]: {
        x: Math.max(0, svgPoint.x - dragOffsetRef.current.x),
        y: Math.max(0, svgPoint.y - dragOffsetRef.current.y),
      },
    }));
  }

  function handlePointerUp() {
    setDraggingId(null);
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
    setPendingPositions((prev) => {
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
      .filter((room) => pendingPositions[room.id] && !pendingDeleteIds.has(room.id))
      .map((room) => ({
        roomId: room.id,
        positionX: pendingPositions[room.id].x,
        positionY: pendingPositions[room.id].y,
      }));

    const newRooms: NewRoomInput[] = draftRooms.map((draft) => {
      const pos = pendingPositions[draft.tempId] ?? { x: draft.positionX, y: draft.positionY };
      return {
        name: draft.name,
        positionX: pos.x,
        positionY: pos.y,
        width: draft.width,
        height: draft.height,
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
      const pending = pendingPositions[room.id];
      return {
        id: room.id,
        name: room.name,
        x: pending ? pending.x : room.positionX,
        y: pending ? pending.y : room.positionY,
        width: room.width,
        height: room.height,
        isOccupiedNow: room.isOccupiedNow,
        isDraft: false,
        markedForDelete: pendingDeleteIds.has(room.id),
        basePosition: { x: room.positionX, y: room.positionY },
      };
    }) ?? []),
    ...draftRooms.map((draft) => {
      const pending = pendingPositions[draft.tempId];
      return {
        id: draft.tempId,
        name: draft.name || "（名称未設定）",
        x: pending ? pending.x : draft.positionX,
        y: pending ? pending.y : draft.positionY,
        width: draft.width,
        height: draft.height,
        isOccupiedNow: false,
        isDraft: true,
        markedForDelete: false,
        basePosition: { x: draft.positionX, y: draft.positionY },
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
            会議室をドラッグして位置を調整できます。右側から会議室の追加・削除もできます。
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
        <svg
          ref={svgRef}
          viewBox={viewBox}
          className="w-full rounded-lg border border-black/10 bg-neutral-50 dark:border-white/10 dark:bg-neutral-950"
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
                  handlePointerDown(e, room.id, room.basePosition);
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
                        : pendingPositions[room.id]
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
                {isEditMode && room.markedForDelete && (
                  <text
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

        <div>
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
                  <ul className="mt-1 space-y-2">
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
                会議室の右上の「×」で削除予定にできます。サイズ変更は今後対応予定です。
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
