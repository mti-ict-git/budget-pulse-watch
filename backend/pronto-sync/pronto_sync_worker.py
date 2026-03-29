import os
import random
import signal
import subprocess
import time
from dataclasses import dataclass
from typing import List, Optional, Tuple

import requests


@dataclass(frozen=True)
class Step:
    name: str
    args: List[str]
    enabled: bool


@dataclass(frozen=True)
class SyncConfig:
    enabled: bool
    header_enabled: bool
    items_enabled: bool
    budget_year: int
    interval_minutes: int
    apply: bool
    max_prfs: Optional[int]
    limit: int
    log_every: int
    headless: bool
    capture_screenshots: bool
    write_per_po_json: bool


def _parse_bool(raw: Optional[str], default: bool) -> bool:
    if raw is None:
        return default
    v = raw.strip().lower()
    if v in {"1", "true", "yes", "y", "on"}:
        return True
    if v in {"0", "false", "no", "n", "off"}:
        return False
    return default


def _parse_int(raw: Optional[str], default: int) -> int:
    if raw is None:
        return default
    s = raw.strip()
    if not s:
        return default
    try:
        return int(s)
    except ValueError:
        return default


def _sleep_seconds(seconds: int, *, stop_flag: List[bool]) -> None:
    remaining = max(0, int(seconds))
    while remaining > 0 and not stop_flag[0]:
        step = 5 if remaining > 5 else remaining
        time.sleep(step)
        remaining -= step


def _run_step(step: Step) -> int:
    cmd = ["python", "/app/scripts/prf_pronto_sync.py", *step.args]
    print(f"[pronto-sync] step={step.name} start cmd={' '.join(cmd)}", flush=True)
    t0 = time.monotonic()
    p = subprocess.run(cmd, check=False)
    dt = int((time.monotonic() - t0) * 1000)
    print(f"[pronto-sync] step={step.name} exit_code={p.returncode} duration_ms={dt}", flush=True)
    return int(p.returncode)


def _default_config_from_env() -> SyncConfig:
    now_year = time.gmtime().tm_year
    budget_year = _parse_int(os.getenv("PRONTO_SYNC_BUDGET_YEAR"), now_year)
    interval_minutes = _parse_int(os.getenv("PRONTO_SYNC_INTERVAL_MINUTES"), 60)
    limit = _parse_int(os.getenv("PRONTO_SYNC_LIMIT"), 1000)
    log_every = _parse_int(os.getenv("PRONTO_SYNC_LOG_EVERY"), 25)
    max_prfs_raw = os.getenv("PRONTO_SYNC_MAX_PRFS")
    max_prfs = _parse_int(max_prfs_raw, 0) if max_prfs_raw is not None else 0
    apply_changes = _parse_bool(os.getenv("PRONTO_SYNC_APPLY"), False)
    return SyncConfig(
        enabled=_parse_bool(os.getenv("PRONTO_SYNC_ENABLED_DEFAULT"), False),
        header_enabled=True,
        items_enabled=True,
        budget_year=budget_year,
        interval_minutes=interval_minutes if interval_minutes > 0 else 60,
        apply=apply_changes,
        max_prfs=max_prfs if max_prfs > 0 else None,
        limit=limit if limit > 0 else 1000,
        log_every=log_every if log_every > 0 else 25,
        headless=_parse_bool(os.getenv("PRONTO_HEADLESS"), True),
        capture_screenshots=_parse_bool(os.getenv("PRONTO_CAPTURE_SCREENSHOTS"), False),
        write_per_po_json=_parse_bool(os.getenv("PRONTO_WRITE_PER_PO_JSON"), False),
    )


def _coerce_int(value: object) -> Optional[int]:
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, float) and value.is_integer():
        return int(value)
    if isinstance(value, str) and value.strip().lstrip("-").isdigit():
        try:
            return int(value.strip())
        except ValueError:
            return None
    return None


def _coerce_bool(value: object) -> Optional[bool]:
    if isinstance(value, bool):
        return value
    if isinstance(value, int) and value in (0, 1):
        return bool(value)
    if isinstance(value, str):
        v = value.strip().lower()
        if v in {"1", "true", "yes", "y", "on"}:
            return True
        if v in {"0", "false", "no", "n", "off"}:
            return False
    return None


def _merge_config(payload: object, fallback: SyncConfig) -> SyncConfig:
    if not isinstance(payload, dict):
        return fallback

    enabled = _coerce_bool(payload.get("enabled")) if "enabled" in payload else None
    header_enabled = _coerce_bool(payload.get("headerEnabled")) if "headerEnabled" in payload else None
    items_enabled = _coerce_bool(payload.get("itemsEnabled")) if "itemsEnabled" in payload else None
    budget_year_raw = payload.get("budgetYear") if "budgetYear" in payload else None
    budget_year = _coerce_int(budget_year_raw) if budget_year_raw is not None else None
    interval_minutes = _coerce_int(payload.get("intervalMinutes")) if "intervalMinutes" in payload else None
    apply_changes = _coerce_bool(payload.get("apply")) if "apply" in payload else None
    max_prfs_raw = payload.get("maxPrfs") if "maxPrfs" in payload else None
    max_prfs = _coerce_int(max_prfs_raw) if max_prfs_raw is not None else None
    limit = _coerce_int(payload.get("limit")) if "limit" in payload else None
    log_every = _coerce_int(payload.get("logEvery")) if "logEvery" in payload else None
    headless = _coerce_bool(payload.get("headless")) if "headless" in payload else None
    capture_screenshots = _coerce_bool(payload.get("captureScreenshots")) if "captureScreenshots" in payload else None
    write_per_po_json = _coerce_bool(payload.get("writePerPoJson")) if "writePerPoJson" in payload else None

    out_budget_year = budget_year if isinstance(budget_year, int) and budget_year > 2000 else fallback.budget_year
    out_interval = interval_minutes if isinstance(interval_minutes, int) and interval_minutes > 0 else fallback.interval_minutes
    out_limit = limit if isinstance(limit, int) and limit > 0 else fallback.limit
    out_log_every = log_every if isinstance(log_every, int) and log_every > 0 else fallback.log_every
    out_max_prfs = max_prfs if isinstance(max_prfs, int) and max_prfs > 0 else None

    return SyncConfig(
        enabled=enabled if enabled is not None else fallback.enabled,
        header_enabled=header_enabled if header_enabled is not None else fallback.header_enabled,
        items_enabled=items_enabled if items_enabled is not None else fallback.items_enabled,
        budget_year=out_budget_year,
        interval_minutes=out_interval,
        apply=apply_changes if apply_changes is not None else fallback.apply,
        max_prfs=out_max_prfs,
        limit=out_limit,
        log_every=out_log_every,
        headless=headless if headless is not None else fallback.headless,
        capture_screenshots=capture_screenshots if capture_screenshots is not None else fallback.capture_screenshots,
        write_per_po_json=write_per_po_json if write_per_po_json is not None else fallback.write_per_po_json,
    )


def _fetch_config(*, base_url: str, api_key: str, fallback: SyncConfig) -> Tuple[SyncConfig, bool]:
    if not base_url or not api_key:
        return fallback, False
    url = base_url.rstrip("/") + "/api/settings/pronto-sync"
    headers = {"x-api-key": api_key, "accept": "application/json"}
    try:
        resp = requests.get(url, headers=headers, timeout=20)
        if resp.status_code != 200:
            return fallback, False
        payload = resp.json()
        merged = _merge_config(payload, fallback)
        return merged, True
    except Exception:
        return fallback, False


def _build_steps(config: SyncConfig) -> List[Step]:
    base_args = ["--budget-year", str(config.budget_year)]
    if config.max_prfs is not None and config.max_prfs > 0:
        base_args += ["--max-prfs", str(config.max_prfs)]
    if config.limit > 0:
        base_args += ["--limit", str(config.limit)]
    if config.log_every > 0:
        base_args += ["--log-every", str(config.log_every)]

    if config.apply:
        base_args.append("--apply")
    else:
        base_args.append("--dry-run")

    headless_arg = "--pronto-headless" if config.headless else "--no-pronto-headless"
    screenshots_arg = "--pronto-screenshots" if config.capture_screenshots else "--no-pronto-screenshots"
    per_po_arg = "--pronto-per-po-json" if config.write_per_po_json else "--no-pronto-per-po-json"

    header_args = [*base_args, headless_arg, screenshots_arg, per_po_arg]
    items_args = ["--sync-prf-items", *base_args, headless_arg, screenshots_arg, per_po_arg]

    return [
        Step(name="header", args=header_args, enabled=config.header_enabled),
        Step(name="items", args=items_args, enabled=config.items_enabled),
    ]


def main() -> int:
    stop_flag: List[bool] = [False]

    def _handle(_sig: int, _frame) -> None:
        stop_flag[0] = True

    signal.signal(signal.SIGTERM, _handle)
    signal.signal(signal.SIGINT, _handle)

    run_once = _parse_bool(os.getenv("PRONTO_SYNC_RUN_ONCE"), False)

    jitter_seconds = max(0, _parse_int(os.getenv("PRONTO_SYNC_JITTER_SECONDS"), 30))
    initial_delay_seconds = max(0, _parse_int(os.getenv("PRONTO_SYNC_INITIAL_DELAY_SECONDS"), 5))

    enable_worker = _parse_bool(os.getenv("PRONTO_SYNC_ENABLED"), True)
    base_url = str(os.getenv("POMON_BASE_URL") or "").strip()
    api_key = str(os.getenv("POMON_API_KEY") or "").strip()
    env_fallback = _default_config_from_env()
    last_config: Optional[SyncConfig] = None

    if not enable_worker:
        print("[pronto-sync] disabled (PRONTO_SYNC_ENABLED=false)", flush=True)
        _sleep_seconds(365 * 24 * 3600, stop_flag=stop_flag)
        return 0

    if initial_delay_seconds:
        print(f"[pronto-sync] initial_delay_seconds={initial_delay_seconds}", flush=True)
        _sleep_seconds(initial_delay_seconds, stop_flag=stop_flag)

    loop = 0
    while not stop_flag[0]:
        loop += 1
        fallback = last_config if last_config is not None else env_fallback
        config, loaded = _fetch_config(base_url=base_url, api_key=api_key, fallback=fallback)
        last_config = config

        interval_seconds = max(60, int(config.interval_minutes) * 60)
        print(
            f"[pronto-sync] cycle_start loop={loop} loaded_from_api={loaded} enabled={config.enabled} budget_year={config.budget_year} apply={config.apply} interval_seconds={interval_seconds}",
            flush=True,
        )

        steps = _build_steps(config)
        any_enabled = False
        worst_exit = 0
        for step in steps:
            if stop_flag[0]:
                break
            if not config.enabled:
                break
            if not step.enabled:
                continue
            any_enabled = True
            code = _run_step(step)
            if code != 0:
                worst_exit = code

        if not any_enabled:
            print("[pronto-sync] no steps enabled; sleeping", flush=True)

        if run_once:
            return worst_exit

        sleep_for = interval_seconds
        if jitter_seconds:
            sleep_for += random.randint(0, jitter_seconds)
        print(f"[pronto-sync] cycle_end loop={loop} sleep_seconds={sleep_for}", flush=True)
        _sleep_seconds(sleep_for, stop_flag=stop_flag)

    print("[pronto-sync] stopped", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
