import { onMount, onCleanup, createEffect, type JSX } from "solid-js";
import * as echarts from "echarts";

interface BrutChartProps {
  options: echarts.EChartsOption;
  height?: string;
  class?: string;
  style?: JSX.CSSProperties;
}

/** Brutalist-styled ECharts wrapper with SVG renderer (Firefox-safe) */
export function BrutChart(props: BrutChartProps) {
  let container!: HTMLDivElement;
  let chart: echarts.ECharts | undefined;

  onMount(() => {
    requestAnimationFrame(() => {
      if (!container) return;
      chart = echarts.init(container, undefined, { renderer: "svg" });
      chart.setOption(props.options);

      const ro = new ResizeObserver(() => {
        if (container.clientWidth > 0 && container.clientHeight > 0) {
          chart?.resize();
        }
      });
      ro.observe(container);

      onCleanup(() => {
        ro.disconnect();
        chart?.dispose();
      });
    });
  });

  createEffect(() => {
    const opts = props.options;
    if (chart && opts) {
      chart.setOption(opts, { notMerge: true });
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

/** Standard brutalist dataZoom config */
export function brutZoom(): echarts.EChartsOption["dataZoom"] {
  return [
    { type: "inside" as const },
    {
      type: "slider" as const,
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
