# BOST Manifest - Automated 5:00 AM Daily NPA Scheduler Service

from datetime import datetime, timedelta, time
import logging
import threading

logger = logging.getLogger('bost_manifest')

_scheduler_timer = None
_scheduler_lock = threading.Lock()
_is_running = False


def get_seconds_until_next_5am(now=None):
    """
    Calculates the exact number of seconds until the next 05:00:00 (5:00 AM).
    """
    now = now or datetime.now()
    target_5am = datetime.combine(now.date(), time(hour=5, minute=0, second=0))

    if now >= target_5am:
        # If it's already past 5:00 AM today, schedule for tomorrow at 5:00 AM
        target_5am += timedelta(days=1)

    delta = (target_5am - now).total_seconds()
    return max(1.0, delta)


def _daily_5am_task():
    global _scheduler_timer, _is_running
    logger.info("[NPA Scheduler] Running 5:00 AM daily NPA order dispatch & rollover cycle...")

    try:
        from apps.dispatch.npa_generator import process_daily_npa_cycle
        result = process_daily_npa_cycle()
        logger.info(
            f"[NPA Scheduler] 5:00 AM cycle completed successfully! "
            f"Rolled over: {result['rolled_over_count']}, "
            f"New orders: {result['new_orders_count']}, "
            f"Total active: {result['total_active_orders_count']}, "
            f"Volume: {result['total_volume']}L, Value: GHS {result['total_value']}"
        )
    except Exception as e:
        logger.error(f"[NPA Scheduler] Error in 5:00 AM cycle execution: {e}", exc_info=True)

    # Schedule next run for tomorrow 5:00 AM
    with _scheduler_lock:
        if _is_running:
            delay = get_seconds_until_next_5am()
            _scheduler_timer = threading.Timer(delay, _daily_5am_task)
            _scheduler_timer.daemon = True
            _scheduler_timer.start()
            logger.info(f"[NPA Scheduler] Next daily cycle scheduled in {delay:.1f} seconds (tomorrow at 05:00 AM).")


def start_daily_scheduler():
    """
    Starts the background scheduler thread to trigger every day at 5:00 AM.
    """
    global _scheduler_timer, _is_running
    with _scheduler_lock:
        if _is_running:
            return

        _is_running = True
        delay = get_seconds_until_next_5am()
        _scheduler_timer = threading.Timer(delay, _daily_5am_task)
        _scheduler_timer.daemon = True
        _scheduler_timer.start()
        logger.info(f"[NPA Scheduler] Background 5:00 AM daily scheduler started (first run in {delay:.1f}s).")


def stop_daily_scheduler():
    """
    Stops the background scheduler thread.
    """
    global _scheduler_timer, _is_running
    with _scheduler_lock:
        _is_running = False
        if _scheduler_timer:
            _scheduler_timer.cancel()
            _scheduler_timer = None
        logger.info("[NPA Scheduler] Background daily scheduler stopped.")
