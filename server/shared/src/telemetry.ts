export interface SpanContext {
  traceId: string;
  spanId: string;
  name: string;
  startTime: number;
  attributes: Record<string, string | number | boolean>;
}

export interface MetricPoint {
  name: string;
  value: number;
  unit: "ms" | "count" | "bytes";
  tags: Record<string, string>;
  timestamp: string;
}

class OpenTelemetryClient {
  private spans: SpanContext[] = [];
  private metrics: MetricPoint[] = [];

  startSpan(name: string, attributes: Record<string, string | number | boolean> = {}): SpanContext {
    const span: SpanContext = {
      traceId: `tr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      spanId: `sp_${Math.random().toString(36).slice(2, 8)}`,
      name,
      startTime: Date.now(),
      attributes,
    };
    this.spans.push(span);
    return span;
  }

  endSpan(span: SpanContext, error?: unknown): number {
    const duration = Date.now() - span.startTime;
    this.recordMetric(`apm.${span.name}.duration`, duration, "ms", {
      status: error ? "error" : "ok",
      ...(span.attributes as Record<string, string>),
    });

    if (error) {
      this.recordMetric(`apm.${span.name}.errors`, 1, "count", {
        error: error instanceof Error ? error.name : "UnknownError",
      });
    }

    // Keep active spans buffer bounded
    if (this.spans.length > 500) {
      this.spans.splice(0, 100);
    }

    return duration;
  }

  recordMetric(
    name: string,
    value: number,
    unit: "ms" | "count" | "bytes" = "count",
    tags: Record<string, string> = {}
  ) {
    this.metrics.push({
      name,
      value,
      unit,
      tags,
      timestamp: new Date().toISOString(),
    });

    if (this.metrics.length > 1000) {
      this.metrics.splice(0, 200);
    }
  }

  getMetricsSummary() {
    return {
      activeSpansRecorded: this.spans.length,
      metricDataPoints: this.metrics.length,
      latestMetrics: this.metrics.slice(-10),
    };
  }
}

export const telemetry = new OpenTelemetryClient();
