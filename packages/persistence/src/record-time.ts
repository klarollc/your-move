import { parseUtcTimestamp } from "@cuckcode/contracts";

/** When a stored record was recorded, supplied by the caller's clock (DF-030). */
export type RecordTime = Readonly<{ recordedAt: string }>;

/** Refuses anything that is not a UTC timestamp, so a stored time is never a guess. */
export function validRecordTime(time: RecordTime): string {
  if (!parseUtcTimestamp(time.recordedAt).ok) throw new Error("RECORD_TIME_INVALID");
  return time.recordedAt;
}
