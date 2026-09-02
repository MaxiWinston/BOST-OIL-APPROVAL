# BOST Manifest - Automated 5:00 AM Daily NPA Scheduler Service

from datetime import datetime, date, timedelta, time
import logging
import threading

logger = logging.getLogger('bost_manifest')

_scheduler_thread = None
_stop_event = threading.Event()
_last_processed_date = None
_lock = threading.Lock()


def has_orders_for_date(target_date=None, depot_id=None):
    from apps.dispatch.models import NPARequest
    target_date = target_date or date.today()
    qs = NPARequest.objects.filter(delivery_date=target_date)
    if depot_id:
        qs = qs.filter(depot_id=depot_id)
    return qs.exists()


def ensure_daily_batch_exists(target_date=None, depot_id=None, count=None):
    """
    Ensures that today's NPA batch has been generated and dispatched.
    If no orders exist for target_date, generates them immediately.
    """
    global _last_processed_date
    target_date = target_date or date.today()

    with _lock:
        if _last_processed_date == target_date:
            return None

        try:
            if not has_orders_for_date(target_date, depot_id):
                from apps.dispatch.npa_generator import process_daily_npa_cycle
                logger.info(f"[NPA Scheduler] No orders found for {target_date}. Triggering daily NPA cycle...")
                result = process_daily_npa_cycle(target_date=target_date, depot_id=depot_id, count=count)
                _last_processed_date = target_date
                logger.info(
                    f"[NPA Scheduler] Generated daily cycle for {target_date}: "
                    f"{result['new_orders_count']} new orders, {result['rolled_over_count']} rolled over."
                )
                return result
            else:
                _last_processed_date = target_date
        except Exception as e:
            logger.error(f"[NPA Scheduler] Error in ensure_daily_batch_exists: {e}", exc_info=True)
    return None


def _scheduler_loop():
    logger.info("[NPA Scheduler] Background daily order scheduler loop started.")
    while not _stop_event.is_set():
        try:
            now = datetime.now()
            today = now.date()

            # Ensure today's daily batch exists
            if now.hour >= 5 or has_orders_for_date(today) is False:
                ensure_daily_batch_exists(target_date=today)
        except Exception as e:
            logger.error(f"[NPA Scheduler] Error in scheduler loop iteration: {e}")

        # Check every 60 seconds
        _stop_event.wait(60.0)


def start_daily_scheduler():
    """
    Starts the background scheduler thread to ensure daily orders run continuously.
    """
    global _scheduler_thread, _stop_event
    with _lock:
        if _scheduler_thread and _scheduler_thread.is_alive():
            return

        _stop_event.clear()
        _scheduler_thread = threading.Thread(target=_scheduler_loop, daemon=True, name="NPADailyScheduler")
        _scheduler_thread.start()
        logger.info("[NPA Scheduler] Background daily order scheduler thread spawned.")


def stop_daily_scheduler():
    """
    Stops the background scheduler thread.
    """
    global _scheduler_thread, _stop_event
    with _lock:
        _stop_event.set()
        if _scheduler_thread:
            _scheduler_thread = None
        logger.info("[NPA Scheduler] Background daily order scheduler stopped.")

