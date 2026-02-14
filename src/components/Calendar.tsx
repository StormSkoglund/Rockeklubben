import React, { useEffect, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import type { EventInput } from "@fullcalendar/core";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
// FullCalendar CSS is loaded from CDN in index.html (vite couldn't resolve the package CSS)
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import Toast from "./Toast";

type BookingRow = {
  id: string;
  user_name: string;
  // new timestamp fields for hourly scheduling
  start_ts: string; // ISO timestamp
  end_ts: string; // ISO timestamp
};

type ToastItem = {
  id: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

export default function Calendar() {
  const calendarRef = useRef<any>(null);
  const [events, setEvents] = useState<EventInput[]>([]);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [modalEvent, setModalEvent] = useState<null | {
    id: string;
    title: string;
    startIso: string;
    endIso: string;
  }>(null);
  const [supabaseError, setSupabaseError] = useState<string | null>(null);

  useEffect(() => {
    loadBookings();

    // Realtime subscription (only if Supabase configured)
    let channelRef: any = null;
    const setupRealtime = async () => {
      const { isSupabaseConfigured } = await import("../lib/supabase");
      if (!isSupabaseConfigured) return;

      const ch = supabase
        .channel("public:bookings")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "bookings" },
          (payload: any) => {
            const row = payload.new || payload.old;
            if (!row) return;

            if (payload.eventType === "INSERT") {
              // avoid duplicates
              setEvents((prev) =>
                prev.some((e) => e.id === row.id)
                  ? prev
                  : [
                      ...prev,
                      {
                        id: row.id,
                        title: row.user_name,
                        start: row.start_ts,
                        end: row.end_ts,
                      },
                    ],
              );
            }
            if (payload.eventType === "UPDATE") {
              setEvents((prev) =>
                prev.map((e) =>
                  e.id === row.id
                    ? {
                        id: row.id,
                        title: row.user_name,
                        start: row.start_ts,
                        end: row.end_ts,
                      }
                    : e,
                ),
              );
            }
            if (payload.eventType === "DELETE") {
              setEvents((prev) => prev.filter((e) => e.id !== row.id));
            }
          },
        )
        .subscribe();

      channelRef = ch;
    };

    setupRealtime();

    return () => {
      if (channelRef) channelRef.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadBookings() {
    const { data, error } = await supabase
      .from("bookings")
      .select("id,user_name,start_ts,end_ts")
      .order("start_ts", { ascending: true });
    if (error) {
      console.error("Supabase loadBookings error", error);
      const msg =
        (error && (error.message || error.details || JSON.stringify(error))) ||
        "Unknown Supabase error";
      setSupabaseError(msg);
      pushToast({
        id: `supabase-err-${Date.now()}`,
        message: `Supabase error: ${msg}`,
      });
      return;
    }

    setSupabaseError(null);
    const evs = (data || []).map((b: BookingRow) => ({
      id: b.id,
      title: b.user_name,
      start: b.start_ts,
      end: b.end_ts,
    }));
    setEvents(evs || []);
  }

  function toYMD(x: any) {
    if (!x) return "";
    if (typeof x === "string") return x.slice(0, 10);
    if (x instanceof Date) return x.toISOString().slice(0, 10);
    return "";
  }

  function formatForDateTimeLocal(iso?: string) {
    if (!iso) return "";
    const d = new Date(iso);
    const year = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    return `${year}-${mm}-${dd}T${hh}:${min}`;
  }

  function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
    return aStart < bEnd && bStart < aEnd;
  }

  function isRangeBooked(start: Date, end: Date, allowEventId?: string) {
    return events.some((e) => {
      const es = new Date(e.start as string);
      const ee = new Date((e.end as string) || es);
      const overlap = rangesOverlap(start, end, es, ee);
      return overlap && (!allowEventId || e.id !== allowEventId);
    });
  }

  // External name dropped onto a date
  async function handleEventReceive(info: any) {
    const event = info.event;
    const start = event.start as Date | null;
    const end =
      (event.end as Date) ||
      (start ? new Date(start.getTime() + 60 * 60 * 1000) : null); // default 1h

    if (!start || !end) {
      pushToast({
        id: `err-no-date-${Date.now()}`,
        message: "Drop failed — no date/time detected.",
      });
      info.revert();
      return;
    }

    if (end <= start) {
      pushToast({
        id: `err-invalid-range-${Date.now()}`,
        message: "Invalid time range.",
      });
      info.revert();
      return;
    }

    // Client-side overlap prevention
    if (isRangeBooked(start, end)) {
      pushToast({
        id: `err-overlap-${Date.now()}`,
        message: "Time slot overlaps an existing booking.",
      });
      info.revert();
      return;
    }

    // Insert into DB using ISO timestamps
    const { data, error } = await supabase
      .from("bookings")
      .insert([
        {
          start_ts: start.toISOString(),
          end_ts: end.toISOString(),
          user_name: event.title,
          date: toYMD(start),
        },
      ])
      .select()
      .single();

    if (error || !data) {
      console.error("Supabase insert error", error);
      const m =
        (error && (error.message || error.details || JSON.stringify(error))) ||
        "";
      const errMsg = /overlap|exclude|constraint/i.test(m)
        ? "That time slot is already taken."
        : "Failed to save booking.";
      pushToast({
        id: `err-insert-${Date.now()}`,
        message: `${errMsg} ${m ? `(${m})` : ""}`,
      });
      setSupabaseError(m || "Insert failed");
      info.revert();
      return;
    }

    // Persist event id and update local state
    event.setProp("id", data.id);
    setEvents((prev) => [
      ...prev,
      {
        id: data.id,
        title: data.user_name,
        start: data.start_ts,
        end: data.end_ts,
      },
    ]);

    pushToast({
      id: data.id,
      message: `Booked ${data.user_name} — ${new Date(data.start_ts).toLocaleString(undefined, { hour12: false, hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short", year: "numeric" })}`,
      actionLabel: "Undo",
      onAction: async () => await undoDeleteBooking(data.id),
    });
  }

  // Allow external drop OR internal drag to time slots that are not booked (except allow moving same event)
  function eventAllow(dropInfo: any) {
    const start = dropInfo.start as Date;
    const end =
      (dropInfo.end as Date) ||
      (start ? new Date(start.getTime() + 60 * 60 * 1000) : null);
    const draggingEventId = dropInfo.event?.id;
    if (!start || !end) return false;
    return !isRangeBooked(start, end, draggingEventId);
  }

  // When user drags an existing event to another time (reschedule)
  async function handleEventDrop(info: any) {
    const event = info.event;
    const id = event.id as string;
    const newStart = event.start as Date | null;
    const newEnd =
      (event.end as Date) ||
      (newStart ? new Date(newStart.getTime() + 60 * 60 * 1000) : null);

    if (!newStart || !newEnd) {
      pushToast({
        id: `err-no-date-${Date.now()}`,
        message: "Invalid drop target.",
      });
      info.revert();
      return;
    }

    if (isRangeBooked(newStart, newEnd, id)) {
      pushToast({
        id: `err-overlap-${Date.now()}`,
        message: "That time overlaps another booking.",
      });
      info.revert();
      return;
    }

    const { data, error } = await supabase
      .from("bookings")
      .update({
        start_ts: newStart.toISOString(),
        end_ts: newEnd.toISOString(),
        date: toYMD(newStart),
      })
      .eq("id", id)
      .select()
      .single();

    if (error || !data) {
      console.error("Failed to update booking", error);
      pushToast({
        id: `err-update-${Date.now()}`,
        message: "Failed to reschedule (date/time may be taken).",
      });
      info.revert();
      return;
    }

    setEvents((prev) =>
      prev.map((e) =>
        e.id === id ? { ...e, start: data.start_ts, end: data.end_ts } : e,
      ),
    );
    pushToast({
      id,
      message: `Rescheduled ${data.user_name} → ${new Date(data.start_ts).toLocaleString(undefined, { hour12: false, hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short", year: "numeric" })}`,
      actionLabel: "Undo",
      onAction: async () => await undoDeleteBooking(id),
    });
  }

  async function handleEventClick(arg: any) {
    const id = arg.event.id as string;
    const title = arg.event.title;
    const startIso = arg.event.start
      ? (arg.event.start as Date).toISOString()
      : "";
    const endIso = arg.event.end ? (arg.event.end as Date).toISOString() : "";
    setModalEvent({ id, title, startIso, endIso });
  }

  async function deleteBooking(id: string) {
    const { error } = await supabase.from("bookings").delete().eq("id", id);
    if (error) {
      console.error("Delete failed", error);
      alert("Failed to cancel booking");
      return;
    }
    setEvents((prev) => prev.filter((e) => e.id !== id));
    pushToast({ id: `del-${id}`, message: "Booking canceled" });
    setModalEvent(null);
  }

  async function rescheduleBooking(
    id: string,
    newStartIso: string,
    newEndIso?: string,
  ) {
    // Validate
    if (!newStartIso) {
      pushToast({
        id: `err-no-date-resched-${Date.now()}`,
        message: "Please choose a valid start date/time.",
      });
      return;
    }

    const newStart = new Date(newStartIso);
    const newEnd = newEndIso
      ? new Date(newEndIso)
      : new Date(newStart.getTime() + 60 * 60 * 1000);

    if (isRangeBooked(newStart, newEnd, id)) {
      pushToast({
        id: `err-booked-${newStartIso}`,
        message: "That time is already booked. Choose another time.",
      });
      return;
    }

    const { data, error } = await supabase
      .from("bookings")
      .update({
        start_ts: newStart.toISOString(),
        end_ts: newEnd.toISOString(),
        date: toYMD(newStart),
      })
      .eq("id", id)
      .select()
      .single();

    if (error || !data) {
      console.error("Reschedule failed", error);
      pushToast({
        id: `err-resched-${Date.now()}`,
        message: "Failed to reschedule (date/time may be taken)",
      });
      return;
    }

    setEvents((prev) =>
      prev.map((e) =>
        e.id === id ? { ...e, start: data.start_ts, end: data.end_ts } : e,
      ),
    );
    pushToast({
      id,
      message: `Rescheduled ${data.user_name} → ${new Date(data.start_ts).toLocaleString(undefined, { hour12: false, hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short", year: "numeric" })}`,
      actionLabel: "Undo",
      onAction: async () => await undoDeleteBooking(id),
    });
    setModalEvent(null);
  }

  async function undoDeleteBooking(id: string) {
    // Undo for simplicity will delete the existing row if called after reschedule/insert —
    // here we'll attempt to delete the booking (acts as "undo" of create/reschedule)
    const { error } = await supabase.from("bookings").delete().eq("id", id);
    if (error) {
      console.error("Undo delete failed", error);
      alert("Undo failed");
      return;
    }
    setEvents((prev) => prev.filter((e) => e.id !== id));
  }

  function pushToast(t: ToastItem) {
    setToasts((s) => [...s, { ...t, id: t.id || String(Date.now()) }]);
    // auto-remove after 6s
    setTimeout(() => removeToast(t.id), 6000);
  }

  function removeToast(id: string) {
    setToasts((s) => s.filter((t) => t.id !== id));
  }

  return (
    <div className="calendar-container">
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="timeGridWeek"
        headerToolbar={{
          left: "prev,next today",
          center: "title",
          right: "dayGridMonth,timeGridWeek,timeGridDay",
        }}
        slotDuration="01:00:00"
        slotLabelFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
        eventTimeFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
        droppable={true}
        editable={true}
        selectable={true}
        events={events}
        eventReceive={handleEventReceive}
        eventAllow={eventAllow}
        eventDrop={handleEventDrop}
        eventResize={async (info) => {
          // when resized, update DB (similar to drop)
          const id = info.event.id as string;
          const newStart = info.event.start as Date;
          const newEnd = info.event.end as Date;
          if (!newStart || !newEnd) {
            info.revert();
            return;
          }
          if (isRangeBooked(newStart, newEnd, id)) {
            pushToast({
              id: `err-overlap-${Date.now()}`,
              message: "That time overlaps an existing booking.",
            });
            info.revert();
            return;
          }
          const { data, error } = await supabase
            .from("bookings")
            .update({
              start_ts: newStart.toISOString(),
              end_ts: newEnd.toISOString(),
              date: toYMD(newStart),
            })
            .eq("id", id)
            .select()
            .single();
          if (error || !data) {
            pushToast({
              id: `err-resize-${Date.now()}`,
              message: "Failed to save resized booking.",
            });
            info.revert();
            return;
          }
          setEvents((prev) =>
            prev.map((e) =>
              e.id === id
                ? { ...e, start: data.start_ts, end: data.end_ts }
                : e,
            ),
          );
          pushToast({
            id,
            message: `Updated ${data.user_name} → ${new Date(data.start_ts).toLocaleString(undefined, { hour12: false, hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short", year: "numeric" })}`,
          });
        }}
        eventClick={handleEventClick}
        ref={calendarRef}
        height="auto"
      />

      {modalEvent && (
        <div className="modal-backdrop" onClick={() => setModalEvent(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{modalEvent.title}</h3>
            <div className="modal-row">
              Start:{" "}
              {new Date(modalEvent.startIso).toLocaleString(undefined, {
                hour12: false,
                hour: "2-digit",
                minute: "2-digit",
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </div>
            <div className="modal-row">
              End:{" "}
              {modalEvent.endIso
                ? new Date(modalEvent.endIso).toLocaleString(undefined, {
                    hour12: false,
                    hour: "2-digit",
                    minute: "2-digit",
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })
                : "—"}
            </div>
            <div className="modal-actions">
              <button
                className="btn btn-danger"
                onClick={() => deleteBooking(modalEvent.id)}
              >
                Cancel booking
              </button>
              <div className="reschedule">
                <label>
                  Start:
                  <input
                    defaultValue={formatForDateTimeLocal(modalEvent.startIso)}
                    type="datetime-local"
                    id="reschedule-start"
                  />
                </label>
                <label>
                  End:
                  <input
                    defaultValue={
                      modalEvent.endIso
                        ? formatForDateTimeLocal(modalEvent.endIso)
                        : ""
                    }
                    type="datetime-local"
                    id="reschedule-end"
                  />
                </label>
                <button
                  className="btn"
                  onClick={() => {
                    const s = (
                      document.getElementById(
                        "reschedule-start",
                      ) as HTMLInputElement
                    ).value;
                    const e = (
                      document.getElementById(
                        "reschedule-end",
                      ) as HTMLInputElement
                    ).value;
                    if (s)
                      rescheduleBooking(
                        modalEvent.id,
                        new Date(s).toISOString(),
                        e ? new Date(e).toISOString() : undefined,
                      );
                  }}
                >
                  Save
                </button>
              </div>
              <button className="btn" onClick={() => setModalEvent(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {!isSupabaseConfigured && (
        <div className="notice" style={{ marginTop: 12, color: "#b45309" }}>
          Supabase not configured — bookings will not persist. Add keys to
          `.env` and restart dev server.
        </div>
      )}

      {isSupabaseConfigured && supabaseError && (
        <div className="notice" style={{ marginTop: 12 }}>
          <strong>Supabase error:</strong> {supabaseError}
          <div style={{ marginTop: 6 }}>
            Common causes: invalid project URL / anon key, table not created, or
            RLS policy blocking access.
          </div>
        </div>
      )}

      <Toast toasts={toasts} removeToast={removeToast} />
    </div>
  );
}
