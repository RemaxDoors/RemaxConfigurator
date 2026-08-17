"use client";

import * as React from "react";

interface DoorPreviewProps {
  width: number; // mm
  height: number; // mm
  /** Show the wall control/activation box beside the door. */
  showControl?: boolean;
  /** Curtain colour (any CSS colour). Defaults to Remax red. */
  colour?: string;
}

/**
 * A scaled roll-door drawing that reflects the current width / height and
 * whether an activation is fitted. Used by the RRD configurator wizard.
 * (Swing / strip / folding get their own preview components later.)
 */
export function DoorPreview({
  width,
  height,
  showControl = false,
  colour = "#b23b3b",
}: DoorPreviewProps) {
  const hasDims = width > 0 && height > 0;

  // Fit the door into a fixed box, preserving the width:height ratio.
  const BOX_W = 190;
  const BOX_H = 210;
  const boxLeft = 96;
  const boxBottom = 292;

  let dw = BOX_W;
  let dh = hasDims ? BOX_W * (height / width) : BOX_H;
  if (dh > BOX_H) {
    dh = BOX_H;
    dw = hasDims ? BOX_H * (width / height) : BOX_W;
  }
  const dx = boxLeft + (BOX_W - dw) / 2;
  const dyTop = boxBottom - dh;
  const hoodH = Math.min(24, Math.max(14, dh * 0.11));

  return (
    <div className="rounded-xl bg-muted/40 p-2">
      <svg
        viewBox="0 0 340 320"
        className="w-full text-muted-foreground"
        role="img"
        aria-label={
          hasDims
            ? `Door drawing, ${Math.round(width)} wide by ${Math.round(height)} high`
            : "Door drawing placeholder"
        }
      >
        {hasDims ? (
          <>
            {/* width dimension */}
            <line x1={dx} y1={dyTop - 26} x2={dx + dw} y2={dyTop - 26} stroke="currentColor" strokeWidth="1" />
            <line x1={dx} y1={dyTop - 31} x2={dx} y2={dyTop - 21} stroke="currentColor" strokeWidth="1" />
            <line x1={dx + dw} y1={dyTop - 31} x2={dx + dw} y2={dyTop - 21} stroke="currentColor" strokeWidth="1" />
            <text x={dx + dw / 2} y={dyTop - 32} textAnchor="middle" fontSize="12" className="fill-foreground">
              {Math.round(width).toLocaleString()}
            </text>

            {/* height dimension */}
            <line x1={dx - 20} y1={dyTop} x2={dx - 20} y2={boxBottom} stroke="currentColor" strokeWidth="1" />
            <line x1={dx - 25} y1={dyTop} x2={dx - 15} y2={dyTop} stroke="currentColor" strokeWidth="1" />
            <line x1={dx - 25} y1={boxBottom} x2={dx - 15} y2={boxBottom} stroke="currentColor" strokeWidth="1" />
            <text
              x={dx - 26}
              y={(dyTop + boxBottom) / 2}
              textAnchor="middle"
              fontSize="12"
              className="fill-foreground"
              transform={`rotate(-90 ${dx - 26} ${(dyTop + boxBottom) / 2})`}
            >
              {Math.round(height).toLocaleString()}
            </text>

            {/* hood */}
            <rect x={dx - 4} y={dyTop} width={dw + 8} height={hoodH} rx="3" fill="#e9e4d6" stroke="currentColor" strokeWidth="0.5" />
            <text x={dx + dw / 2} y={dyTop + hoodH - 6} textAnchor="middle" fontSize={Math.min(13, dw / 8)} fontWeight="500" fill={colour}>
              RemaxDoors
            </text>

            {/* curtain */}
            <rect x={dx} y={dyTop + hoodH} width={dw} height={dh - hoodH} rx="2" fill={colour} />

            {/* floor */}
            <line x1={dx - 6} y1={boxBottom} x2={dx + dw + 6} y2={boxBottom} stroke="currentColor" strokeWidth="1.5" className="text-foreground" />

            {/* control box */}
            {showControl && (
              <g>
                <rect x={dx + dw + 12} y={boxBottom - 54} width="30" height="42" rx="4" className="fill-background" stroke="currentColor" strokeWidth="0.5" />
                <circle cx={dx + dw + 21} cy={boxBottom - 24} r="2.4" fill={colour} />
                <circle cx={dx + dw + 33} cy={boxBottom - 24} r="2.4" fill="currentColor" />
              </g>
            )}
          </>
        ) : (
          <text x="170" y="160" textAnchor="middle" fontSize="13" fill="currentColor">
            Enter width &amp; height to preview
          </text>
        )}
      </svg>
    </div>
  );
}
