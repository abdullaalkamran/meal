const SIZE = 160;
const CENTER = SIZE / 2;
const OUTER_R = 72;
const INNER_R = 42;

const PALETTE = ["#10bfb4", "#4c7df0", "#f59e0b", "#7c6cf6", "#f472b6", "#60a5fa"];

function polar(angleDeg: number, r: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: CENTER + r * Math.sin(rad), y: CENTER - r * Math.cos(rad) };
}

function arcPath(startDeg: number, endDeg: number): string {
  const outerStart = polar(startDeg, OUTER_R);
  const outerEnd = polar(endDeg, OUTER_R);
  const innerEnd = polar(endDeg, INNER_R);
  const innerStart = polar(startDeg, INNER_R);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${OUTER_R} ${OUTER_R} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${INNER_R} ${INNER_R} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y}`,
    "Z",
  ].join(" ");
}

interface DonutChartProps {
  segments: { label: string; value: number }[];
}

export function DonutChart({ segments }: DonutChartProps) {
  const total = segments.reduce((sum, s) => sum + s.value, 0) || 1;
  const arcs = segments.reduce<{ label: string; start: number; end: number }[]>((acc, s) => {
    const prevEnd = acc.at(-1)?.end ?? 0;
    const sweep = (s.value / total) * 360;
    acc.push({ label: s.label, start: prevEnd, end: prevEnd + sweep });
    return acc;
  }, []);

  return (
    <div className="flex items-center gap-4">
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        {arcs.map((arc, i) => (
          <path key={arc.label} d={arcPath(arc.start, arc.end)} fill={PALETTE[i % PALETTE.length]} />
        ))}
      </svg>
      <div className="flex flex-col gap-1.5">
        {segments.map((s, i) => (
          <div key={s.label} className="flex items-center gap-2 text-[10.5px] font-bold">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: PALETTE[i % PALETTE.length] }}
            />
            {s.label} · {Math.round((s.value / total) * 100)}%
          </div>
        ))}
      </div>
    </div>
  );
}
