import { Logger } from "@std/log";

const logger = new Logger("metrics", "INFO");

interface Metric {
    name: string;
    value: number;
    timestamp: number;
    labels?: Record<string, string>;
}

interface Counter {
    name: string;
    value: number;
    labels?: Record<string, string>;
}

interface Histogram {
    name: string;
    buckets: number[];
    count: number;
    sum: number;
    labels?: Record<string, string>;
}

class MetricsCollector {
    private counters = new Map<string, Counter>();
    private histograms = new Map<string, Histogram>();
    private metrics: Metric[] = [];
    private maxMetrics = 10000; // Keep last 10k metrics

    // Counter operations
    increment(name: string, value: number = 1, labels?: Record<string, string>): void {
        const key = this.getKey(name, labels);
        const existing = this.counters.get(key);
        
        if (existing) {
            existing.value += value;
        } else {
            this.counters.set(key, { name, value, labels });
        }
        
        this.addMetric(name, value, labels);
        logger.debug(`Counter incremented: ${name}`, { value, labels });
    }

    decrement(name: string, value: number = 1, labels?: Record<string, string>): void {
        this.increment(name, -value, labels);
    }

    // Histogram operations
    observe(name: string, value: number, labels?: Record<string, string>): void {
        const key = this.getKey(name, labels);
        const existing = this.histograms.get(key);
        
        if (existing) {
            existing.count++;
            existing.sum += value;
            // Add to appropriate bucket
            for (let i = 0; i < existing.buckets.length; i++) {
                if (value <= existing.buckets[i]) {
                    break;
                }
            }
        } else {
            this.histograms.set(key, {
                name,
                buckets: [0.1, 0.5, 1, 2.5, 5, 10, 25, 50, 100, 250, 500, 1000],
                count: 1,
                sum: value,
                labels,
            });
        }
        
        this.addMetric(name, value, labels);
    }

    // Timer operations
    startTimer(name: string, labels?: Record<string, string>): () => void {
        const start = Date.now();
        return () => {
            const duration = Date.now() - start;
            this.observe(name, duration, labels);
        };
    }

    // Gauge operations
    set(name: string, value: number, labels?: Record<string, string>): void {
        this.addMetric(name, value, labels);
    }

    // Get metrics
    getCounters(): Counter[] {
        return Array.from(this.counters.values());
    }

    getHistograms(): Histogram[] {
        return Array.from(this.histograms.values());
    }

    getMetrics(): Metric[] {
        return [...this.metrics];
    }

    // Clear metrics
    clear(): void {
        this.counters.clear();
        this.histograms.clear();
        this.metrics = [];
        logger.info("Metrics cleared");
    }

    // Export metrics in Prometheus format
    exportPrometheus(): string {
        const lines: string[] = [];
        
        // Export counters
        for (const counter of this.counters.values()) {
            const labels = this.formatLabels(counter.labels);
            lines.push(`# TYPE ${counter.name} counter`);
            lines.push(`${counter.name}${labels} ${counter.value}`);
        }
        
        // Export histograms
        for (const histogram of this.histograms.values()) {
            const labels = this.formatLabels(histogram.labels);
            lines.push(`# TYPE ${histogram.name} histogram`);
            lines.push(`${histogram.name}_count${labels} ${histogram.count}`);
            lines.push(`${histogram.name}_sum${labels} ${histogram.sum}`);
            
            // Export buckets
            for (const bucket of histogram.buckets) {
                lines.push(`${histogram.name}_bucket{le="${bucket}"}${labels} 0`);
            }
            lines.push(`${histogram.name}_bucket{le="+Inf"}${labels} ${histogram.count}`);
        }
        
        return lines.join('\n');
    }

    private addMetric(name: string, value: number, labels?: Record<string, string>): void {
        this.metrics.push({
            name,
            value,
            timestamp: Date.now(),
            labels,
        });
        
        // Keep only the last maxMetrics
        if (this.metrics.length > this.maxMetrics) {
            this.metrics = this.metrics.slice(-this.maxMetrics);
        }
    }

    private getKey(name: string, labels?: Record<string, string>): string {
        if (!labels) return name;
        const labelStr = Object.entries(labels)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => `${k}="${v}"`)
            .join(',');
        return `${name}{${labelStr}}`;
    }

    private formatLabels(labels?: Record<string, string>): string {
        if (!labels || Object.keys(labels).length === 0) return '';
        const labelStr = Object.entries(labels)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => `${k}="${v}"`)
            .join(',');
        return `{${labelStr}}`;
    }
}

// Global metrics collector
export const metrics = new MetricsCollector();

// Common metric names
export const metricNames = {
    // HTTP metrics
    httpRequestsTotal: 'http_requests_total',
    httpRequestDuration: 'http_request_duration_seconds',
    httpRequestSize: 'http_request_size_bytes',
    httpResponseSize: 'http_response_size_bytes',
    
    // Database metrics
    dbConnectionsActive: 'db_connections_active',
    dbQueriesTotal: 'db_queries_total',
    dbQueryDuration: 'db_query_duration_seconds',
    
    // Cache metrics
    cacheHits: 'cache_hits_total',
    cacheMisses: 'cache_misses_total',
    cacheSize: 'cache_size',
    
    // Business metrics
    todosCreated: 'todos_created_total',
    todosUpdated: 'todos_updated_total',
    todosDeleted: 'todos_deleted_total',
    todosCompleted: 'todos_completed_total',
} as const;

// Helper functions
export function trackHttpRequest(method: string, path: string, statusCode: number, duration: number): void {
    metrics.increment(metricNames.httpRequestsTotal, 1, {
        method,
        path,
        status: statusCode.toString(),
    });
    
    metrics.observe(metricNames.httpRequestDuration, duration / 1000, {
        method,
        path,
        status: statusCode.toString(),
    });
}

export function trackDatabaseQuery(operation: string, duration: number, success: boolean): void {
    metrics.increment(metricNames.dbQueriesTotal, 1, {
        operation,
        success: success.toString(),
    });
    
    metrics.observe(metricNames.dbQueryDuration, duration / 1000, {
        operation,
        success: success.toString(),
    });
}

export function trackCacheHit(key: string): void {
    metrics.increment(metricNames.cacheHits, 1, { key });
}

export function trackCacheMiss(key: string): void {
    metrics.increment(metricNames.cacheMisses, 1, { key });
}

export function trackTodoOperation(operation: 'created' | 'updated' | 'deleted' | 'completed'): void {
    const metricName = `todos_${operation}_total` as keyof typeof metricNames;
    metrics.increment(metricNames[metricName]);
}
