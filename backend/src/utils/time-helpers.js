// ─── Shared time-entry helpers ────────────────────────────────────────────────

/**
 * Tính overtime nhất quán giữa /timer/stop và PUT /time-entries.
 * - Countdown (target_duration != null): overtime = max(actual - target, 0)
 * - Stopwatch (target_duration = null):  overtime = 0 (không có khái niệm overtime)
 *
 * @param {number} actualSeconds     - Thời gian thực (giây)
 * @param {number|null} targetDuration - target_duration từ DB (null nếu stopwatch)
 * @returns {number}
 */
export function calcOvertime(actualSeconds, targetDuration) {
  if (targetDuration == null) return 0
  return Math.max(0, actualSeconds - targetDuration)
}
