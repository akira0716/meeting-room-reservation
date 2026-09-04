"use client";

import { useMemo, useState } from "react";
import type { FloorMapData, RoomWithReservations } from "@/lib/queries/getFloorMapData";
import { FloorPlanUploadForm } from "./FloorPlanUploadForm";
import { RoomDetailPanel } from "./RoomDetailPanel";

const PADDING = 24;

function floorLabel(floor: FloorMapData["floors"][number]): string {
  return floor.label ?? `${floor.floorNumber}F`;
}

export function FloorMapView({ data }: { data: FloorMapData }) {
  const [selectedFloorId, setSelectedFloorId] = useState(data.floors[0]?.id);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);

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
      </div>

      {selectedFloor && <FloorPlanUploadForm floorId={selectedFloor.id} />}

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-[2fr_1fr]">
        <svg
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
          {selectedFloor?.rooms.map((room) => (
            <g
              key={room.id}
              onClick={() => setSelectedRoomId(room.id)}
              className="cursor-pointer"
            >
              <rect
                x={room.positionX}
                y={room.positionY}
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
                x={room.positionX + room.width / 2}
                y={room.positionY + room.height / 2 - 6}
                textAnchor="middle"
                className="select-none fill-neutral-900 text-[13px] font-medium dark:fill-neutral-50"
              >
                {room.name}
              </text>
              <text
                x={room.positionX + room.width / 2}
                y={room.positionY + room.height / 2 + 12}
                textAnchor="middle"
                className="select-none fill-neutral-600 text-[11px] dark:fill-neutral-300"
              >
                {room.isOccupiedNow ? "使用中" : "空き"}
              </text>
            </g>
          ))}
        </svg>

        <div>
          {selectedRoom ? (
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
