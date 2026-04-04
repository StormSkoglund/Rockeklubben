import { createRoot } from "react-dom/client";
import App from "./App.js";
import "./styles.css";

// FullCalendar injects its styles from the plugin JS at runtime; no separate CSS import needed

createRoot(document.getElementById("root")!).render(<App />);
