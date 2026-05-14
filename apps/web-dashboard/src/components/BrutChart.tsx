import { onMount, onCleanup, createEffect, type JSX } from "solid-js";
import * as echarts from "echarts";

interface BrutChartProps {
  options: echarts.EChartsOption;
  height?: string;
  class?: string;
  style?: JSX.CSSProperties;
  onZoom?: (range: { start: number; end: number }) => void;
}

/** Brutalist-styled ECharts wrapper with SVG renderer (Firefox-safe) */
export function BrutChart(props: BrutChartProps) {
  let container!: HTMLDivElement;
  let chart: echarts.ECharts | undefined;
  // Prevents the dataZoom event fired by setOption from re-triggering onZoom
  let suppressZoom = false;
  let zoomDebounceTimer: ReturnType<typeof setTimeout> | undefined;

  onMount(() => {
    requestAnimationFrame(() => {
      if (!container) return;
      chart = echarts.init(container, undefined, { renderer: "svg" });
      chart.setOption(props.options);

      if (props.onZoom) {
        chart.on("dataZoom", () => {
          if (suppressZoom) return;
          clearTimeout(zoomDebounceTimer);
          zoomDebounceTimer = setTimeout(() => {
            const dzArr = (chart!.getOption().dataZoom as any[] | undefined);
            if (!dzArr) return;
            const dz =
              dzArr.find((d) => d.type === "slider" && d.startValue != null) ??
              dzArr.find((d) => d.startValue != null);
            if (!dz) return;
            const start = Math.floor(dz.startValue);
            const end = Math.floor(dz.endValue);
            if (isFinite(start) && isFinite(end)) {
              props.onZoom!({ start, end });
            }
          }, 400);
        });
      }

      const ro = new ResizeObserver(() => {
        if (container.clientWidth > 0 && container.clientHeight > 0) {
          chart?.resize();
        }
      });
      ro.observe(container);

      onCleanup(() => {
        clearTimeout(zoomDebounceTimer);
        ro.disconnect();
        chart?.dispose();
      });
    });
  });

  createEffect(() => {
    const opts = props.options;
    if (chart && opts) {
      suppressZoom = true;
      // replaceMerge updates series in-place (no disappear), animation: false
      // prevents re-animation on every data/zoom update
      chart.setOption({ ...opts, animation: false }, { replaceMerge: ["series"] });
      suppressZoom = false;
    }
  });

  return (
    <div
      ref={container}
      class={`w-full ${props.class ?? ""}`}
      style={{
        height: props.height ?? "300px",
        "min-height": "200px",
        ...props.style,
      }}
    />
  );
}

/** Standard brutalist chart tooltip config */
export function brutTip(): echarts.EChartsOption["tooltip"] {
  return {
    trigger: "axis",
    backgroundColor: "#000",
    borderColor: "#ff0000",
    borderWidth: 2,
    textStyle: {
      color: "#fff",
      fontFamily: "'Space Mono', monospace",
      fontSize: 11,
    },
  };
}

/** Standard brutalist axis config */
export function brutAxis() {
  return {
    axisLine: { lineStyle: { color: "#000", width: 2 } },
    axisLabel: {
      color: "#666",
      fontFamily: "'Space Mono', monospace",
      fontSize: 10,
    },
  };
}

/** Standard brutalist grid lines */
export function brutGrid() {
  return {
    splitLine: { lineStyle: { color: "#e0e0e0", type: "solid" as const } },
  };
}

/** Standard brutalist dataZoom config.
 * Pass startValue/endValue (timestamps) to preserve zoom position across option updates. */
export function brutZoom(
  startValue?: number,
  endValue?: number,
): echarts.EChartsOption["dataZoom"] {
  const range =
    startValue != null && endValue != null ? { startValue, endValue } : {};
  return [
    { type: "inside" as const, filterMode: "none" as const, ...range },
    {
      type: "slider" as const,
      filterMode: "none" as const,
      ...range,
      height: 16,
      borderColor: "#000",
      backgroundColor: "#f0f0f0",
      fillerColor: "rgba(255,0,0,0.1)",
      handleStyle: { color: "#ff0000", borderColor: "#000" },
      textStyle: { color: "#666", fontSize: 9 },
      bottom: 2,
    },
  ];
}
