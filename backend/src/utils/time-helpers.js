export function calcOvertime(actualSeconds, targetDuration) {
  if (targetDuration == null) return 0
  return Math.max(0, actualSeconds - targetDuration)
}