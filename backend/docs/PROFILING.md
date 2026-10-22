# Profiling Slow Requests With Tachyon

Python 3.15 ships a sampling profiler in the standard library, `profiling.sampling` ("Tachyon"). It reads the interpreter's stacks from outside the process, so the backend needs no code changes, no extra dependency and no restart to be profiled. Use it to investigate a specific slow route or MCP tool locally; it is not enabled in production (see [Production](#production)).

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

## Choose the mode by route type

| Target | Flags | Why |
|---|---|---|
| Sync REST routes (`def` handlers, most of `app/api/routes`) | `--mode cpu -a` | FastAPI runs them in its threadpool, so every thread must be sampled. Wall-clock mode is dominated by idle pool workers. |
| MCP tools and other `async def` code | `--async-aware` | Reconstructs stacks per asyncio task. Cannot be combined with `-a`. |
| A request that is slow but not CPU-bound (waiting on DB or HTTP) | `--mode wall -a`, then `dump` | Wall time shows where it waits; `dump` shows what a stuck request is doing right now. |

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

To catch a slowdown that only appears after the server has been up a while, attach by PID instead of restarting:

```bash
uv run python -m profiling.sampling attach --mode cpu -a -d 15 --flamegraph -o /tmp/attach.html <uvicorn-pid>
uv run python -m profiling.sampling dump <uvicorn-pid>   # one-shot stack of every thread
```

Attaching needs ptrace permission on the target. Locally that means the same user and `kernel.yama.ptrace_scope` 0, or running the profiler as root.

## Reading the output

- Expect an error rate of roughly 10–30% in the summary under `-a`; locally that was the share of samples that could not be read, not a sign the profile is broken. `--async-aware` runs stayed under 3%.
- Frames show the file's base name only (`today_service.py:TodayService.get_today:398`), so search the flamegraph for the service or repository class rather than a path.
- Compare against a baseline with `--diff-flamegraph baseline.bin` (record the baseline with `--binary -o baseline.bin`) when checking whether a change made a route faster.

## Production

Not enabled. Attaching inside the VPS container needs `CAP_SYS_PTRACE` (or a host-side profiler with access to the container's PID namespace), and profiles expose code paths and file names, though not argument values. Granting that capability, deciding who may run it and where profiles are stored need their own review before anything is changed in `tjorim/apps`.
