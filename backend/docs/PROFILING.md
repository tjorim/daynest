# Profiling Slow Requests and MCP Calls

Python 3.15 ships a sampling profiler in the standard library, `profiling.sampling` ("Tachyon"). It reads the interpreter's stacks from outside the process, so the backend needs no code changes, no extra dependency and no restart to be profiled. Use it to investigate a specific slow route or MCP tool locally. It is **not enabled in production** (see [Production](#production)).

## Find the slow request first

Start from the request log, not the profiler. Every response carries `Server-Timing: app;dur=…, db;desc="N queries";dur=…` (visible in the browser devtools Network tab), and a request slower than 300 ms is logged as a warning with its method, route template, status, duration and query count (`app/core/request_timing.py`). Many queries for one request is an N+1 pattern that the SQL log explains better than a profile does. A high `app` time with few queries is what a profile is for. `X-Request-ID` ties the response to the structured request log ([OBSERVABILITY.md](OBSERVABILITY.md)).

## Local setup

Run the backend against a local PostgreSQL with the dev auth bypass, so requests can be replayed with a fixed bearer token:

```bash
cd backend
export ENVIRONMENT=dev \
  DATABASE_URL=postgresql+psycopg://daynest:daynest@127.0.0.1:5432/daynest \
  DEV_AUTH_BYPASS_TOKEN=dev-profiling \
  RATE_LIMIT_ENABLED=false \
  PYTHONPATH=.
uv run alembic upgrade head
```

`RATE_LIMIT_ENABLED=false` keeps a replay loop from being cut off at 200 requests per minute.

## Choose the mode

| Target | Flags | Why |
|---|---|---|
| Sync REST routes (`def` handlers, most of `app/api/routes`) | `--mode cpu -a` | FastAPI runs them in its threadpool, so every thread must be sampled. Wall-clock mode is dominated by idle pool workers. |
| MCP tools and other `async def` code | `--async-aware` | Reconstructs stacks per asyncio task. Cannot be combined with `-a`. |
| A request that is slow but not CPU-bound (waiting on DB or HTTP) | `--mode wall -a` | Wall time shows where it waits. |
| A request that hangs | `dump <pid>` | Prints what every thread is doing right now. |

## Profile a fresh server

Start uvicorn under the profiler for a fixed duration, then replay the slow request while it runs:

```bash
uv run python -m profiling.sampling run --mode cpu -a -d 30 \
  --flamegraph -o /tmp/today.html \
  -m uvicorn app.main:app --port 8000

# in another shell
for i in $(seq 300); do
  curl -s -o /dev/null -H 'Authorization: Bearer dev-profiling' http://localhost:8000/api/today
done
```

Open `/tmp/today.html` in a browser. Use `--pstats --sort cumtime -l 30` for a terminal table, or `--collapsed -o stacks.txt` to diff runs and feed other flamegraph tools.

MCP tools reject the dev bypass token, so mint a local integration key once:

```bash
uv run python -c "
from app.db.session import SessionLocal
from app.mcp.identity import create_integration_client
print(create_integration_client(SessionLocal, 'dev@localhost', name='profiling')['api_key'])"
```

Then run with `--async-aware` instead of `--mode cpu -a`, and call the tool through a FastMCP client against `http://localhost:8000/mcp/` with `Authorization: Bearer <key>`.

## Attach to a running server

To catch a slowdown that only appears after the server has been up a while, attach by PID instead of restarting. Use the PID of the Python process that listens on the port (`ss -ltnp | grep :8000`), not the `uv run` wrapper that started it:

```bash
uv run python -m profiling.sampling attach --mode cpu -a -d 15 --flamegraph -o /tmp/attach.html <uvicorn-pid>
uv run python -m profiling.sampling dump <uvicorn-pid>   # one-shot stack of every thread
```

Attaching needs ptrace permission on the target. Locally that means the same user and `kernel.yama.ptrace_scope` 0, or running the profiler as root.

## Reading the output

- Expect an error rate of roughly 10–30% in the summary under `-a`; locally that was the share of samples that could not be read, not a sign the profile is broken. `--async-aware` runs stayed under 3%.
- Frames show the file's base name only (`today_service.py:TodayService.get_today:398`), so search the flamegraph for the service or repository class rather than a path.
- Compare against a baseline with `--diff-flamegraph baseline.bin` (record the baseline with `--binary -o baseline.bin`) when checking whether a change made a route faster.
- A profile holds function names, file paths, line numbers and sample counts, not argument or variable values. The flamegraph HTML also embeds the source lines of the sampled frames. Treat both as local diagnostics rather than something to publish.

## Production

Not enabled. Attaching to a container's PID 1 depends on the host's ptrace policy (`kernel.yama.ptrace_scope`), the container's seccomp profile and capabilities (`CAP_SYS_PTRACE`), and a collection and retention policy for profiles, which does not exist yet. Those belong to `tjorim/apps` and need their own review before anything changes there. Reproduce locally with production-like data volumes instead.

Measurements and decisions from the Python 3.15 upgrade are recorded in #995.
