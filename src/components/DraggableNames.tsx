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
      <p className="hint">
        Drag a name onto a time slot to book (default 1 hour). You can resize
        events to extend duration; multiple names per day allowed as long as
        hours don't overlap.
      </p>
    </div>
  );
}
