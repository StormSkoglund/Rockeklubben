import React, { useEffect, useRef } from "react";
import { Draggable } from "@fullcalendar/interaction";

const NAMES = [
  "Silver Monochrome",
  "Young Collection",
  "Blue Experience",
  "Warfart",
  "Verdiløse Menn",
  "Dødsdau",
  "Notörious",
  "Storm Valley",
  "Tommy Cash",
  "Mads Røykenes",
  "Grim Spencer",
  "Jon Hægland",
  "Who's That",
];

export default function DraggableNames() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let draggable: any;
    const container = containerRef.current;

    // helper handlers used to toggle a temporary 'is-dragging' class on <body>
    // which forces `touch-action: none` and prevents the browser from turning
    // the gesture into a scrolling action mid-drag (fixes cancelable=false warnings).
    let onPointerDown: (ev: PointerEvent | TouchEvent) => void;
    let onPointerUp: () => void;
    let onTouchMove: (ev: TouchEvent) => void;

    if (container) {
      // append the mirror to document.body so hit-testing aligns with viewport coordinates
      // and mark external events as `allDay` so they snap correctly to month-day cells.
      draggable = new Draggable(container, {
        itemSelector: ".fc-external",
        appendTo: document.body,
        eventData: function (el) {
          return {
            title: el.getAttribute("data-name") || "Unknown",
            // default duration for hourly booking (1 hour)
            duration: "01:00",
          };
        },
      });

      onPointerDown = (ev: any) => {
        // only enable the 'is-dragging' mode when the pointer started on a draggable item
        const target = ev.target as HTMLElement;
        const el =
          target && target.closest ? target.closest(".fc-external") : null;
        if (el) document.body.classList.add("is-dragging");
      };
      onPointerUp = () => document.body.classList.remove("is-dragging");

      // while dragging, intercept touchmove at document level (passive: false)
      // and prevent default to stop the browser converting the gesture into a scroll.
      onTouchMove = (e: TouchEvent) => {
        if (document.body.classList.contains("is-dragging")) {
          e.preventDefault();
        }
      };

      // pointer events (preferred) + touch fallbacks to cover older browsers
      container.addEventListener("pointerdown", onPointerDown as EventListener);
      window.addEventListener("pointerup", onPointerUp);
      window.addEventListener("pointercancel", onPointerUp);
      container.addEventListener("touchstart", onPointerDown as EventListener, {
        passive: true,
      });
      window.addEventListener("touchend", onPointerUp);
      window.addEventListener("touchcancel", onPointerUp);
      window.addEventListener("dragend", onPointerUp);

      // capture touchmove so we can prevent scrolling during an active drag
      window.addEventListener("touchmove", onTouchMove as EventListener, {
        passive: false,
      });
    }

    return () => {
      if (draggable) draggable.destroy();
      if (container) {
        container.removeEventListener(
          "pointerdown",
          onPointerDown as EventListener,
        );
        window.removeEventListener("pointerup", onPointerUp);
        window.removeEventListener("pointercancel", onPointerUp);
        container.removeEventListener(
          "touchstart",
          onPointerDown as EventListener,
        );
        window.removeEventListener("touchend", onPointerUp);
        window.removeEventListener("touchcancel", onPointerUp);
        window.removeEventListener("dragend", onPointerUp);
        window.removeEventListener("touchmove", onTouchMove as EventListener);
      }
    };
  }, []);

  return (
    <div className="external-container" ref={containerRef}>
      <h3>Bands (trekk og slipp i kalenderen)</h3>
      {NAMES.map((n) => (
        <div key={n} className="fc-external" data-name={n}>
          {n}
        </div>
      ))}
      <strong>Booking</strong>
      <p className="hint">
        Dra et navn til et tidsrom for å booke (standard 1 time). Du kan endre
        varigheten på hendelsene for å forlenge dem; flere navn per dag er
        tillatt så lenge tidene ikke overlapper.
      </p>
      <strong>Slette Booking</strong>
      <p className="hint">
        Slett booking ved å trykke venstre musetast på bandets navn i
        kalenderen.
      </p>
    </div>
  );
}
