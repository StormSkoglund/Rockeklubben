import DraggableNames from "./components/DraggableNames";
import Calendar from "./components/Calendar";

export default function App() {
  return (
    <div className="app-container">
      <h1>
        <span className="h1-emoji" aria-hidden="true">
          🤘🧑‍🎤🎸
        </span>
        Rockeklubben Os
        <span className="h1-emoji" aria-hidden="true">
          🎤👨‍🎤🤘
        </span>
      </h1>

      <div className="layout">
        <DraggableNames />
        <Calendar />
      </div>

      <footer className="app-footer" role="contentinfo">
        <small>© {new Date().getFullYear()} Alex Storm Skoglund</small>
      </footer>
    </div>
  );
}
