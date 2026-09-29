export interface QueueJob<T = Record<string, unknown>> {
  id: string;
  name: string;
  data: T;
  delayMs?: number;
  attempts: number;
  maxAttempts: number;
  enqueuedAt: string;
  status: "WAITING" | "ACTIVE" | "COMPLETED" | "FAILED" | "DELAYED";
}

export type JobHandler<T = any> = (job: QueueJob<T>) => Promise<void>;

export class DistributedJobQueue {
  private queue: QueueJob[] = [];
  private handlers = new Map<string, JobHandler>();
  private dlq: QueueJob[] = [];
  private isRunning = false;
  private intervalTimer: NodeJS.Timeout | null = null;

  constructor(private queueName: string = "omnipost-publishing-queue") {}

  registerHandler(jobName: string, handler: JobHandler) {
    this.handlers.set(jobName, handler);
  }

  async addJob<T = Record<string, unknown>>(
    name: string,
    data: T,
    options: { delayMs?: number; maxAttempts?: number } = {}
  ): Promise<QueueJob<T>> {
    const job: QueueJob<T> = {
      id: `job_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name,
      data,
      delayMs: options.delayMs ?? 0,
      attempts: 0,
      maxAttempts: options.maxAttempts ?? 3,
      enqueuedAt: new Date().toISOString(),
      status: (options.delayMs && options.delayMs > 0) ? "DELAYED" : "WAITING",
    };

    this.queue.push(job as QueueJob<any>);
    return job;
  }

  startWorker(pollIntervalMs = 1000) {
    if (this.isRunning) return;
    this.isRunning = true;

    this.intervalTimer = setInterval(async () => {
      await this.processNextBatch();
    }, pollIntervalMs);
  }

  stopWorker() {
    this.isRunning = false;
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
  }

  private async processNextBatch() {
    const now = Date.now();

    for (const job of this.queue) {
      if (job.status === "WAITING" || (job.status === "DELAYED" && now - new Date(job.enqueuedAt).getTime() >= (job.delayMs || 0))) {
        job.status = "ACTIVE";
        job.attempts += 1;

        const handler = this.handlers.get(job.name);
        if (!handler) {
          job.status = "FAILED";
          this.dlq.push(job);
          continue;
        }

        try {
          await handler(job);
          job.status = "COMPLETED";
        } catch {
          if (job.attempts < job.maxAttempts) {
            job.status = "WAITING";
          } else {
            job.status = "FAILED";
            this.dlq.push(job);
          }
        }
      }
    }

    // Clean completed jobs
    this.queue = this.queue.filter((j) => j.status !== "COMPLETED");
  }

  getMetrics() {
    return {
      queueName: this.queueName,
      waiting: this.queue.filter((j) => j.status === "WAITING" || j.status === "DELAYED").length,
      active: this.queue.filter((j) => j.status === "ACTIVE").length,
      dlqCount: this.dlq.length,
    };
  }

  getDeadLetterQueue(): QueueJob[] {
    return [...this.dlq];
  }
}

export const publishingQueue = new DistributedJobQueue("social-publishing-worker");
