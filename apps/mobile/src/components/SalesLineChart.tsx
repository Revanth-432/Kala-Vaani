import React, { useMemo, useState } from 'react';
import { View, type LayoutChangeEvent, type GestureResponderEvent } from 'react-native';
import Svg, { Path, Line, Circle } from 'react-native-svg';
import { Text, COLORS } from './ui';

export interface MonthPoint {
  /** "YYYY-MM" */
  month: string;
  revenue: number;
  orders: number;
}

const HEIGHT = 200;
const PAD = { top: 12, right: 12, bottom: 26, left: 48 };
const GRID = '#EDE6DD'; // one step off the card surface: recessive hairlines
const LINE = COLORS.primary;

/** Clean axis ticks (0, step, 2·step, …) covering the max value */
function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0];
  const raw = max / count;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? raw;
  const ticks: number[] = [];
  for (let v = 0; v <= max + step * 0.001; v += step) ticks.push(v);
  if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step);
  return ticks;
}

export function compactRupees(value: number): string {
  if (value >= 10000000) return `₹${+(value / 10000000).toFixed(1)}Cr`;
  if (value >= 100000) return `₹${+(value / 100000).toFixed(1)}L`;
  if (value >= 1000) return `₹${+(value / 1000).toFixed(1)}K`;
  return `₹${Math.round(value)}`;
}

/**
 * Monthly sales as a single line. Tap or drag across the chart to pick a month;
 * `onSelect` reports it so the screen can show its numbers above the plot.
 */
export function SalesLineChart({
  data,
  selected,
  onSelect,
  monthLabel,
  accessibilityLabel,
}: {
  data: MonthPoint[];
  selected: number;
  onSelect: (index: number) => void;
  monthLabel: (month: string) => string;
  accessibilityLabel: string;
}) {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const ticks = useMemo(() => niceTicks(Math.max(...data.map((d) => d.revenue), 0)), [data]);
  const top = ticks[ticks.length - 1] || 1;

  const x = (i: number) => PAD.left + (data.length <= 1 ? plotW / 2 : (plotW * i) / (data.length - 1));
  const y = (v: number) => PAD.top + plotH - (v / top) * plotH;

  const linePath = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(d.revenue)}`).join(' ');
  const areaPath =
    data.length > 0
      ? `${linePath} L${x(data.length - 1)},${y(0)} L${x(0)},${y(0)} Z`
      : '';

  // Whole column is the hit target, not just the dot
  const pick = (e: GestureResponderEvent) => {
    if (!plotW || data.length === 0) return;
    const rel = e.nativeEvent.locationX - PAD.left;
    const step = data.length <= 1 ? plotW : plotW / (data.length - 1);
    const index = Math.min(data.length - 1, Math.max(0, Math.round(rel / step)));
    if (index !== selected) onSelect(index);
  };

  // Show every month label when there is room, otherwise every other one
  const labelEvery = plotW / Math.max(1, data.length - 1) < 30 ? 2 : 1;

  return (
    <View
      onLayout={onLayout}
      style={{ height: HEIGHT }}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={pick}
      onResponderMove={pick}
    >
      {width > 0 ? (
        <>
          <Svg width={width} height={HEIGHT}>
            {ticks.map((tick) => (
              <Line
                key={tick}
                x1={PAD.left}
                x2={width - PAD.right}
                y1={y(tick)}
                y2={y(tick)}
                stroke={GRID}
                strokeWidth={1}
              />
            ))}
            {data[selected] ? (
              <Line
                x1={x(selected)}
                x2={x(selected)}
                y1={PAD.top}
                y2={y(0)}
                stroke={COLORS.muted}
                strokeWidth={1}
              />
            ) : null}
            <Path d={areaPath} fill={LINE} fillOpacity={0.1} />
            <Path
              d={linePath}
              fill="none"
              stroke={LINE}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {data.map((d, i) =>
              d.orders > 0 || i === selected ? (
                <Circle
                  key={d.month}
                  cx={x(i)}
                  cy={y(d.revenue)}
                  r={i === selected ? 6 : 4}
                  fill={LINE}
                  stroke="#FFFFFF"
                  strokeWidth={2}
                />
              ) : null,
            )}
          </Svg>

          {/* Axis text uses text colours, never the series colour */}
          {ticks.map((tick) => (
            <Text
              key={`y-${tick}`}
              className="text-xs text-artisan-muted"
              style={{ position: 'absolute', left: 0, width: PAD.left - 6, top: y(tick) - 8, textAlign: 'right' }}
            >
              {compactRupees(tick)}
            </Text>
          ))}
          {data.map((d, i) =>
            i % labelEvery === (data.length - 1) % labelEvery ? (
              <Text
                key={`x-${d.month}`}
                className={`text-xs ${i === selected ? 'font-bold text-artisan-slate' : 'text-artisan-muted'}`}
                style={{ position: 'absolute', top: HEIGHT - PAD.bottom + 6, left: x(i) - 20, width: 40, textAlign: 'center' }}
              >
                {monthLabel(d.month)}
              </Text>
            ) : null,
          )}
        </>
      ) : null}
    </View>
  );
}
