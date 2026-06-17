import { createRoot } from "react-dom/client";
import { OverlayApp } from "./OverlayApp";
import "./styles/fonts.css";

const root = createRoot(document.getElementById("root")!);
root.render(<OverlayApp />);
