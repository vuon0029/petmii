import { r as reactExports, j as jsxRuntimeExports } from "./fonts-Br8b_t7H.js";
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
function formatKB(kb) {
  if (kb < 1024) return `${kb.toFixed(0)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}
function metricsAvailable() {
  return typeof window.petmiiAPI?.getSystemMetrics === "function";
}
function ResourceMonitor({ compact = false }) {
  const [metrics, setMetrics] = reactExports.useState(null);
  const [visible, setVisible] = reactExports.useState(false);
  const [unavailable, setUnavailable] = reactExports.useState(false);
  const intervalRef = reactExports.useRef(null);
  reactExports.useEffect(() => {
    if (!visible) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }
    if (!metricsAvailable()) {
      setUnavailable(true);
      return;
    }
    async function fetchMetrics() {
      try {
        const data = await window.petmiiAPI.getSystemMetrics();
        setMetrics(data);
      } catch {
      }
    }
    fetchMetrics();
    intervalRef.current = setInterval(fetchMetrics, 2e3);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [visible]);
  if (!visible) {
    return /* @__PURE__ */ jsxRuntimeExports.jsx(
      "button",
      {
        type: "button",
        className: "resource-monitor-toggle",
        onClick: () => setVisible(true),
        title: "Show resource usage",
        children: "📊 Stats"
      }
    );
  }
  const totalMemoryKB = metrics ? metrics.processes.reduce((sum, p) => sum + p.memory.workingSetSize, 0) : 0;
  const totalCPU = metrics ? metrics.processes.reduce((sum, p) => sum + p.cpu.percentCPUUsage, 0) : 0;
  if (unavailable) {
    return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "resource-monitor resource-monitor--error", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "📊 Metrics unavailable — restart the app" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", className: "resource-monitor-close", onClick: () => setVisible(false), children: "✕" })
    ] });
  }
  if (compact) {
    return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "resource-monitor resource-monitor--compact", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "resource-monitor-header", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "resource-monitor-title", children: "📊" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "button",
          {
            type: "button",
            className: "resource-monitor-close",
            onClick: () => setVisible(false),
            children: "✕"
          }
        )
      ] }),
      metrics ? /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "resource-monitor-summary", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
          "RAM: ",
          formatKB(totalMemoryKB)
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
          "CPU: ",
          totalCPU.toFixed(1),
          "%"
        ] })
      ] }) : /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "resource-monitor-loading", children: "Loading…" })
    ] });
  }
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "resource-monitor", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "resource-monitor-header", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "resource-monitor-title", children: "📊 Resource Monitor" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        "button",
        {
          type: "button",
          className: "resource-monitor-close",
          onClick: () => setVisible(false),
          children: "✕"
        }
      )
    ] }),
    metrics ? /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "resource-monitor-summary", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "resource-monitor-stat", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "resource-monitor-label", children: "Total RAM" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "resource-monitor-value", children: formatKB(totalMemoryKB) })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "resource-monitor-stat", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "resource-monitor-label", children: "Total CPU" }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "resource-monitor-value", children: [
            totalCPU.toFixed(1),
            "%"
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "resource-monitor-processes", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("table", { className: "resource-monitor-table", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("thead", { children: /* @__PURE__ */ jsxRuntimeExports.jsxs("tr", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "Process" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "RAM" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("th", { children: "CPU" })
        ] }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("tbody", { children: metrics.processes.map((p) => /* @__PURE__ */ jsxRuntimeExports.jsxs("tr", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: p.type }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("td", { children: formatKB(p.memory.workingSetSize) }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("td", { children: [
            p.cpu.percentCPUUsage.toFixed(1),
            "%"
          ] })
        ] }, p.pid)) })
      ] }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "resource-monitor-heap", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "resource-monitor-label", children: "Main Heap" }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "resource-monitor-value", children: [
          formatBytes(metrics.mainProcess.heapUsed),
          " / ",
          formatBytes(metrics.mainProcess.heapTotal)
        ] })
      ] })
    ] }) : /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "resource-monitor-loading", children: "Loading metrics…" })
  ] });
}
export {
  ResourceMonitor
};
