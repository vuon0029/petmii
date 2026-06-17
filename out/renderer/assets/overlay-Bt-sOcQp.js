import { r as reactExports, j as jsxRuntimeExports, P as PetAvatar, c as createRoot } from "./fonts-Br8b_t7H.js";
const LOW_STAT_THRESHOLD = 25;
const DRAG_THRESHOLD_MS = 200;
function OverlayApp() {
  const [variant, setVariant] = reactExports.useState(null);
  const [petState, setPetState] = reactExports.useState(null);
  const [direction, setDirection] = reactExports.useState("right");
  const [isDragging, setIsDragging] = reactExports.useState(false);
  const [rotation, setRotation] = reactExports.useState(0);
  const [physicsState, setPhysicsState] = reactExports.useState("idle");
  const mouseDownTime = reactExports.useRef(0);
  const dragStarted = reactExports.useRef(false);
  reactExports.useEffect(() => {
    async function init() {
      const saved = await window.petmiiAPI.loadPet();
      if (saved) {
        setVariant({
          species: saved.species,
          color: saved.color,
          personality: saved.personality
        });
        setPetState(saved);
      }
    }
    init();
    window.petmiiAPI.onVariantUpdate((v) => {
      setVariant(v);
    });
    window.petmiiAPI.onStateUpdate((s) => {
      setPetState(s);
    });
    window.petmiiAPI.onDirectionUpdate((dir) => {
      setDirection(dir);
    });
    window.petmiiAPI.onRotationUpdate((deg) => {
      setRotation(deg);
    });
    window.petmiiAPI.onPhysicsStateUpdate((state) => {
      setPhysicsState(state);
    });
  }, []);
  const handleMouseDown = reactExports.useCallback((e) => {
    e.preventDefault();
    mouseDownTime.current = Date.now();
    dragStarted.current = false;
    window.petmiiAPI.overlayDragStart(e.screenX, e.screenY);
  }, []);
  const handleMouseMove = reactExports.useCallback((e) => {
    if (mouseDownTime.current === 0) return;
    const elapsed = Date.now() - mouseDownTime.current;
    if (elapsed >= DRAG_THRESHOLD_MS) {
      if (!dragStarted.current) {
        dragStarted.current = true;
        setIsDragging(true);
      }
      window.petmiiAPI.overlayDragMove(e.screenX, e.screenY);
    }
  }, []);
  const handleMouseUp = reactExports.useCallback(() => {
    const elapsed = Date.now() - mouseDownTime.current;
    mouseDownTime.current = 0;
    if (dragStarted.current) {
      dragStarted.current = false;
      setIsDragging(false);
      window.petmiiAPI.overlayDragEnd();
    } else if (elapsed < DRAG_THRESHOLD_MS) {
      window.petmiiAPI.exitOverlayMode();
    }
  }, []);
  const handleMouseLeave = reactExports.useCallback(() => {
    if (dragStarted.current) {
      dragStarted.current = false;
      setIsDragging(false);
      mouseDownTime.current = 0;
      window.petmiiAPI.overlayDragEnd();
    }
  }, []);
  if (!variant) return null;
  const lowStats = [];
  if (petState) {
    if (petState.hunger < LOW_STAT_THRESHOLD)
      lowStats.push({ icon: "🍖", cls: "overlay-stat-hunger" });
    if (petState.happiness < LOW_STAT_THRESHOLD)
      lowStats.push({ icon: "💛", cls: "overlay-stat-happiness" });
    if (petState.energy < LOW_STAT_THRESHOLD)
      lowStats.push({ icon: "⚡", cls: "overlay-stat-energy" });
  }
  const transforms = [];
  if (direction === "left" && physicsState === "idle") {
    transforms.push("scaleX(-1)");
  }
  if (rotation !== 0) {
    transforms.push(`rotate(${rotation}deg)`);
  }
  const stateClass = physicsState !== "idle" ? `physics-${physicsState}` : "";
  return /* @__PURE__ */ jsxRuntimeExports.jsx(
    "div",
    {
      className: "overlay-container",
      onMouseMove: handleMouseMove,
      onMouseUp: handleMouseUp,
      onMouseLeave: handleMouseLeave,
      children: /* @__PURE__ */ jsxRuntimeExports.jsxs(
        "div",
        {
          className: `overlay-pet ${stateClass} ${isDragging ? "dragging" : ""}`,
          onMouseDown: handleMouseDown,
          style: {
            transform: transforms.length > 0 ? transforms.join(" ") : void 0,
            transition: physicsState === "getting-up" ? "transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)" : void 0
          },
          children: [
            petState && physicsState === "idle" && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "overlay-nametag", children: /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "overlay-nametag-text", children: petState.name }) }),
            lowStats.length > 0 && physicsState === "idle" && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "overlay-alerts", children: lowStats.map((stat) => /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "overlay-alert-icon", children: stat.icon }, stat.cls)) }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              PetAvatar,
              {
                species: variant.species,
                color: variant.color,
                personality: variant.personality
              }
            )
          ]
        }
      )
    }
  );
}
const root = createRoot(document.getElementById("root"));
root.render(/* @__PURE__ */ jsxRuntimeExports.jsx(OverlayApp, {}));
