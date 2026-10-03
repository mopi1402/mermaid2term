import { availableParallelism } from "node:os";
import { Worker, parentPort } from "node:worker_threads";

// A few threads, never the whole machine: the gate runs on every done and must leave the rest of it free.
const THREADS = Math.max(1, Math.min(4, availableParallelism() - 1));
const DONE = -1;

interface Answer<R> {
  readonly at: number;
  readonly result: R;
}

// Each job by its index, handed out one at a time and the heaviest first, so a slow source never finishes alone at
// the tail; results in index order.
export function pooled<R>(script: URL, weights: readonly number[]): Promise<R[]> {
  const count = weights.length;
  const order = weights.map((_, at) => at).sort((a, b) => weights[b] - weights[a]);
  const results: R[] = new Array<R>(count);
  let next = 0;
  let settled = 0;
  return new Promise((resolve, reject) => {
    if (count === 0) resolve(results);
    const threads = Math.min(THREADS, count);
    for (let t = 0; t < threads; t++) {
      const worker = new Worker(script);
      const hand = (): void => worker.postMessage(next < count ? order[next++] : DONE);
      worker.on("message", ({ at, result }: Answer<R>) => {
        results[at] = result;
        settled += 1;
        if (settled === count) resolve(results);
        hand();
      });
      worker.on("error", reject);
      hand();
    }
  });
}

// The worker's side: answers every index it is handed, and leaves when told there is none left.
export function serve<R>(job: (at: number) => R): void {
  const port = parentPort ?? undefined;
  if (port === undefined) throw new Error("serve runs in a worker thread");
  port.on("message", (at: number) => {
    if (at === DONE) port.close();
    else port.postMessage({ at, result: job(at) } satisfies Answer<R>);
  });
}
