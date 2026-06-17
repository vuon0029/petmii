import { useState, useEffect, useRef } from "react";
import type { SystemMetrics } from "../types";
import "../styles/resource-monitor.css";

interface ResourceMonitorProps {
  /** Compact mode for overlay */
  compact?: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatKB(kb: number): string {
  if (kb < 1024) return `${kb.toFixed(0)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

/** Check the API method exists (guards against stale preload builds) */
function metricsAvailable(): boolean {
  return typeof window.petmiiAPI?.getSystemMetrics === "function";
}

export function ResourceMonitor({ compact = false }: ResourceMonitorProps) {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [visible, setVisible] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
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
        // Non-critical — silently ignore fetch errors
      }
    }

    fetchMetrics();
    intervalRef.current = setInterval(fetchMetrics, 2000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [visible]);

  if (!visible) {
    return (
      <button
        type="button"
        className="resource-monitor-toggle"
        onClick={() => setVisible(true)}
        title="Show resource usage"
      >
        📊 Stats
      </button>
    );
  }

  const totalMemoryKB = metrics
    ? metrics.processes.reduce((sum, p) => sum + p.memory.workingSetSize, 0)
    : 0;

  const totalCPU = metrics
    ? metrics.processes.reduce((sum, p) => sum + p.cpu.percentCPUUsage, 0)
    : 0;

  if (unavailable) {
    return (
      <div className="resource-monitor resource-monitor--error">
        <span>📊 Metrics unavailable — restart the app</span>
        <button type="button" className="resource-monitor-close" onClick={() => setVisible(false)}>✕</button>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="resource-monitor resource-monitor--compact">
        <div className="resource-monitor-header">
          <span className="resource-monitor-title">📊</span>
          <button
            type="button"
            className="resource-monitor-close"
            onClick={() => setVisible(false)}
          >
            ✕
          </button>
        </div>
        {metrics ? (
          <div className="resource-monitor-summary">
            <span>RAM: {formatKB(totalMemoryKB)}</span>
            <span>CPU: {totalCPU.toFixed(1)}%</span>
          </div>
        ) : (
          <p className="resource-monitor-loading">Loading…</p>
        )}
      </div>
    );
  }

  return (
    <div className="resource-monitor">
      <div className="resource-monitor-header">
        <span className="resource-monitor-title">📊 Resource Monitor</span>
        <button
          type="button"
          className="resource-monitor-close"
          onClick={() => setVisible(false)}
        >
          ✕
        </button>
      </div>

      {metrics ? (
        <>
          <div className="resource-monitor-summary">
            <div className="resource-monitor-stat">
              <span className="resource-monitor-label">Total RAM</span>
              <span className="resource-monitor-value">{formatKB(totalMemoryKB)}</span>
            </div>
            <div className="resource-monitor-stat">
              <span className="resource-monitor-label">Total CPU</span>
              <span className="resource-monitor-value">{totalCPU.toFixed(1)}%</span>
            </div>
          </div>

          <div className="resource-monitor-processes">
            <table className="resource-monitor-table">
              <thead>
                <tr>
                  <th>Process</th>
                  <th>RAM</th>
                  <th>CPU</th>
                </tr>
              </thead>
              <tbody>
                {metrics.processes.map((p) => (
                  <tr key={p.pid}>
                    <td>{p.type}</td>
                    <td>{formatKB(p.memory.workingSetSize)}</td>
                    <td>{p.cpu.percentCPUUsage.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="resource-monitor-heap">
            <span className="resource-monitor-label">Main Heap</span>
            <span className="resource-monitor-value">
              {formatBytes(metrics.mainProcess.heapUsed)} / {formatBytes(metrics.mainProcess.heapTotal)}
            </span>
          </div>
        </>
      ) : (
        <p className="resource-monitor-loading">Loading metrics…</p>
      )}
    </div>
  );
}
