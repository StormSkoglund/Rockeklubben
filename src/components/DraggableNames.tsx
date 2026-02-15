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
];

export default function DraggableNames() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let draggable: any;
    if (containerRef.current) {
      // append the mirror to document.body so hit-testing aligns with viewport coordinates
      // and mark external events as `allDay` so they snap correctly to month-day cells.
      draggable = new Draggable(containerRef.current, {
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
    }

    return () => {
      if (draggable) draggable.destroy();
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
