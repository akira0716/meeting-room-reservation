"use client";

import { useMemo, useRef, useState } from "react";
import { updateRoomPositionAction } from "@/app/actions";
import type { FloorMapData, RoomWithReservations } from "@/lib/queries/getFloorMapData";
import { FloorPlanUploadForm } from "./FloorPlanUploadForm";
import { RoomDetailPanel } from "./RoomDetailPanel";

const PADDING = 24;

type DragState = {
  roomId: string;
  x: number;
  y: number;
};

function floorLabel(floor: FloorMapData["floors"][number]): string {
  return floor.label ?? `${floor.floorNumber}F`;
}

export function FloorMapView({ data, isAdmin }: { data: FloorMapData; isAdmin: boolean }) {
  const [selectedFloorId, setSelectedFloorId] = useState(data.floors[0]?.id);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  const selectedFloor = data.floors.find((f) => f.id === selectedFloorId) ?? data.floors[0];

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

  // 画面上のポインタ座標(px)を、SVGのviewBox座標系に変換する。
  // SVGは表示サイズとviewBoxのスケールが異なるため、getScreenCTMの逆行列を使うのが確実。
  function toSvgPoint(clientX: number, clientY: number): { x: number; y: number } {
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

  function handlePointerDown(
    e: React.PointerEvent<SVGGElement>,
    room: RoomWithReservations,
  ) {
    if (!isEditMode) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const svgPoint = toSvgPoint(e.clientX, e.clientY);
    dragOffsetRef.current = { x: svgPoint.x - room.positionX, y: svgPoint.y - room.positionY };
    setDragState({ roomId: room.id, x: room.positionX, y: room.positionY });
  }

  function handlePointerMove(e: React.PointerEvent<SVGGElement>) {
    if (!dragState) return;
    const svgPoint = toSvgPoint(e.clientX, e.clientY);
    setDragState({
      roomId: dragState.roomId,
      x: Math.max(0, svgPoint.x - dragOffsetRef.current.x),
      y: Math.max(0, svgPoint.y - dragOffsetRef.current.y),
    });
  }

  async function handlePointerUp() {
    if (!dragState) return;
    const { roomId, x, y } = dragState;
    setDragState(null);
    await updateRoomPositionAction(roomId, x, y);
  }

  return (
    <div>
      <div className="flex items-center gap-2 border-b border-black/10 pb-2 dark:border-white/10">
        {data.floors.map((floor) => (
          <button
            key={floor.id}
            type="button"
            onClick={() => {
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
              setIsEditMode((v) => !v);
              setSelectedRoomId(null);
            }}
            className={
              isEditMode
                ? "ml-auto rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700"
                : "ml-auto rounded-md border border-black/10 px-3 py-1.5 text-sm text-neutral-500 hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
            }
          >
            {isEditMode ? "編集モード：ON" : "会議室の配置を編集"}
          </button>
        )}
      </div>

      {isEditMode && (
        <p className="mt-2 text-xs text-neutral-500">
          会議室をドラッグして位置を移動できます（自動保存されます）。
        </p>
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
          {selectedFloor?.rooms.map((room) => {
            const isDragging = dragState?.roomId === room.id;
            const x = isDragging ? dragState.x : room.positionX;
            const y = isDragging ? dragState.y : room.positionY;

            return (
              <g
                key={room.id}
                onClick={() => {
                  if (!isEditMode) setSelectedRoomId(room.id);
                }}
                onPointerDown={(e) => handlePointerDown(e, room)}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                className={
                  isEditMode
                    ? isDragging
                      ? "cursor-grabbing"
                      : "cursor-grab"
                    : "cursor-pointer"
                }
              >
                <rect
                  x={x}
                  y={y}
                  width={room.width}
                  height={room.height}
                  rx={6}
                  fillOpacity={selectedFloor?.floorPlanImageUrl ? 0.55 : 1}
                  className={
                    room.id === selectedRoomId
                      ? "stroke-2 stroke-neutral-900 dark:stroke-white"
                      : "stroke-1 stroke-black/20 dark:stroke-white/20"
                  }
                  fill={room.isOccupiedNow ? "var(--room-occupied)" : "var(--room-available)"}
                />
                <text
                  x={x + room.width / 2}
                  y={y + room.height / 2 - 6}
                  textAnchor="middle"
                  className="select-none fill-neutral-900 text-[13px] font-medium dark:fill-neutral-50"
                >
                  {room.name}
                </text>
                <text
                  x={x + room.width / 2}
                  y={y + room.height / 2 + 12}
                  textAnchor="middle"
                  className="select-none fill-neutral-600 text-[11px] dark:fill-neutral-300"
                >
                  {room.isOccupiedNow ? "使用中" : "空き"}
                </text>
              </g>
            );
          })}
        </svg>

        <div>
          {isEditMode ? (
            <p className="text-sm text-neutral-400">
              編集モード中です。会議室をドラッグして配置を調整してください。
            </p>
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
