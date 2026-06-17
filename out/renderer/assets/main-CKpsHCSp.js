const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./ResourceMonitor-DnelejYL.js","./fonts-Br8b_t7H.js","./fonts-DOt_lrWH.css","./ResourceMonitor-DrTkO6xk.css"])))=>i.map(i=>d[i]);
import { r as reactExports, j as jsxRuntimeExports, P as PetAvatar, c as createRoot } from "./fonts-Br8b_t7H.js";
const VALID_TRANSITIONS = {
  NO_PET: ["EGG_READY"],
  EGG_READY: ["HATCHING"],
  HATCHING: ["NAMING"],
  NAMING: ["ACTIVE_PET"],
  ACTIVE_PET: ["EGG_READY"]
};
function isValidTransition(from, to) {
  return VALID_TRANSITIONS[from].includes(to);
}
function useOnboarding() {
  const [state, setState] = reactExports.useState("EGG_READY");
  const [petVariant, setPetVariant] = reactExports.useState(null);
  const [petState, setPetState] = reactExports.useState(null);
  const [error, setError] = reactExports.useState(null);
  const [loading, setLoading] = reactExports.useState(true);
  reactExports.useEffect(() => {
    async function init() {
      try {
        const saved = await window.petmiiAPI.loadPet();
        if (saved) {
          setPetState(saved);
          setPetVariant({
            species: saved.species,
            color: saved.color,
            personality: saved.personality
          });
          setState("ACTIVE_PET");
        } else {
          setState("EGG_READY");
        }
      } catch (err) {
        setState("EGG_READY");
        setError(
          err instanceof Error ? err.message : "Failed to load pet data"
        );
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);
  function transition(target) {
    if (!isValidTransition(state, target)) {
      return false;
    }
    setState(target);
    return true;
  }
  return {
    state,
    loading,
    petVariant,
    petState,
    error,
    transition,
    setPetVariant,
    setPetState,
    setError
  };
}
function usePetState(petState, setPetState) {
  const STAT_INCREMENT = 15;
  function clamp(value, min = 0, max = 100) {
    return Math.min(max, Math.max(min, value));
  }
  const feed = reactExports.useCallback(async () => {
    if (!petState) return null;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const updated = {
      ...petState,
      hunger: clamp(petState.hunger + STAT_INCREMENT),
      lastFedAt: now,
      updatedAt: now
    };
    await window.petmiiAPI.savePet(updated);
    setPetState(updated);
    return updated;
  }, [petState, setPetState]);
  const play = reactExports.useCallback(async () => {
    if (!petState) return null;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const updated = {
      ...petState,
      happiness: clamp(petState.happiness + STAT_INCREMENT),
      lastPlayedAt: now,
      updatedAt: now
    };
    await window.petmiiAPI.savePet(updated);
    setPetState(updated);
    return updated;
  }, [petState, setPetState]);
  const clean = reactExports.useCallback(async () => {
    if (!petState) return null;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const updated = {
      ...petState,
      cleanliness: clamp(petState.cleanliness + STAT_INCREMENT),
      lastCleanedAt: now,
      updatedAt: now
    };
    await window.petmiiAPI.savePet(updated);
    setPetState(updated);
    return updated;
  }, [petState, setPetState]);
  const rest = reactExports.useCallback(async () => {
    if (!petState) return null;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const updated = {
      ...petState,
      energy: clamp(petState.energy + STAT_INCREMENT),
      lastRestedAt: now,
      updatedAt: now
    };
    await window.petmiiAPI.savePet(updated);
    setPetState(updated);
    return updated;
  }, [petState, setPetState]);
  const rename = reactExports.useCallback(
    async (newName) => {
      if (!petState) return null;
      const trimmed = newName.trim();
      if (trimmed.length === 0) {
        throw new Error("Name cannot be empty");
      }
      if (trimmed.length > 20) {
        throw new Error("Name must be 20 characters or fewer");
      }
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const updated = {
        ...petState,
        name: trimmed,
        updatedAt: now
      };
      await window.petmiiAPI.savePet(updated);
      setPetState(updated);
      return updated;
    },
    [petState, setPetState]
  );
  const reset = reactExports.useCallback(async () => {
    await window.petmiiAPI.clearPet();
    setPetState(null);
    return null;
  }, [setPetState]);
  return { feed, play, clean, rest, rename, reset };
}
const SPECIES = ["mochi", "blob", "bun", "sprout", "ghost", "star"];
const COLORS = ["cream", "pink", "blue", "mint", "lavender", "yellow"];
const PERSONALITIES = ["sweet", "chaotic", "sleepy", "curious", "shy", "sassy"];
function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function generateRandomPetVariant() {
  return {
    species: randomFrom(SPECIES),
    color: randomFrom(COLORS),
    personality: randomFrom(PERSONALITIES)
  };
}
const DEFAULT_PET_STATS = {
  hunger: 15,
  happiness: 15,
  energy: 15,
  cleanliness: 15,
  bond: 10,
  mood: "happy",
  lifeStage: "baby",
  lastMessage: "Your new pet hatched!",
  lastFedAt: null,
  lastPlayedAt: null,
  lastCleanedAt: null,
  lastRestedAt: null
};
const SPECIES_DEFAULT_NAMES = {
  mochi: "Mochi",
  blob: "Bobo",
  bun: "Bun",
  sprout: "Sprout",
  ghost: "Boo",
  star: "Star"
};
function EggHatchScreen({ hatching = false, onHatch, onAnimationEnd }) {
  reactExports.useEffect(() => {
    if (!hatching || !onAnimationEnd) return;
    const timer = setTimeout(() => {
      onAnimationEnd();
    }, 2e3);
    return () => clearTimeout(timer);
  }, [hatching, onAnimationEnd]);
  const eggClassName = hatching ? "egg hatching" : "egg";
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "egg-hatch-screen", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("h1", { children: "petmii" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: eggClassName, "aria-label": "Egg" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("button", { onClick: onHatch, disabled: hatching, children: "Hatch Egg" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("p", { children: "Tap to meet your new pet." })
  ] });
}
function NamePetScreen({ variant, onNameSubmit }) {
  const [name, setName] = reactExports.useState(SPECIES_DEFAULT_NAMES[variant.species]);
  const [error, setError] = reactExports.useState("");
  function handleSubmit(e) {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      setError("A non-empty name is required");
      return;
    }
    if (trimmed.length > 20) {
      setError("Name must be 20 characters or fewer");
      return;
    }
    setError("");
    onNameSubmit(trimmed);
  }
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "name-pet-screen", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("h1", { children: "Name your new pet!" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "name-pet-preview", children: /* @__PURE__ */ jsxRuntimeExports.jsx(
      PetAvatar,
      {
        species: variant.species,
        color: variant.color,
        personality: variant.personality
      }
    ) }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("form", { onSubmit: handleSubmit, className: "name-pet-input-area", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        "input",
        {
          type: "text",
          value: name,
          onChange: (e) => {
            setName(e.target.value);
            setError("");
          },
          placeholder: "Name your pet",
          maxLength: 20,
          autoFocus: true,
          "aria-label": "Pet name",
          "aria-invalid": error ? true : void 0,
          "aria-describedby": error ? "name-error" : void 0
        }
      ),
      error && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "name-pet-error", id: "name-error", role: "alert", children: error }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "submit", className: "name-pet-confirm-btn", children: "Confirm" })
    ] })
  ] });
}
const scriptRel = function detectScriptRel() {
  const relList = typeof document !== "undefined" && document.createElement("link").relList;
  return relList && relList.supports && relList.supports("modulepreload") ? "modulepreload" : "preload";
}();
const assetsURL = function(dep, importerUrl) {
  return new URL(dep, importerUrl).href;
};
const seen = {};
const __vitePreload = function preload(baseModule, deps, importerUrl) {
  let promise = Promise.resolve();
  if (deps && deps.length > 0) {
    const links = document.getElementsByTagName("link");
    const cspNonceMeta = document.querySelector(
      "meta[property=csp-nonce]"
    );
    const cspNonce = cspNonceMeta?.nonce || cspNonceMeta?.getAttribute("nonce");
    promise = Promise.allSettled(
      deps.map((dep) => {
        dep = assetsURL(dep, importerUrl);
        if (dep in seen) return;
        seen[dep] = true;
        const isCss = dep.endsWith(".css");
        const cssSelector = isCss ? '[rel="stylesheet"]' : "";
        const isBaseRelative = !!importerUrl;
        if (isBaseRelative) {
          for (let i = links.length - 1; i >= 0; i--) {
            const link2 = links[i];
            if (link2.href === dep && (!isCss || link2.rel === "stylesheet")) {
              return;
            }
          }
        } else if (document.querySelector(`link[href="${dep}"]${cssSelector}`)) {
          return;
        }
        const link = document.createElement("link");
        link.rel = isCss ? "stylesheet" : scriptRel;
        if (!isCss) {
          link.as = "script";
        }
        link.crossOrigin = "";
        link.href = dep;
        if (cspNonce) {
          link.setAttribute("nonce", cspNonce);
        }
        document.head.appendChild(link);
        if (isCss) {
          return new Promise((res, rej) => {
            link.addEventListener("load", res);
            link.addEventListener(
              "error",
              () => rej(new Error(`Unable to preload CSS for ${dep}`))
            );
          });
        }
      })
    );
  }
  function handlePreloadError(err) {
    const e = new Event("vite:preloadError", {
      cancelable: true
    });
    e.payload = err;
    window.dispatchEvent(e);
    if (!e.defaultPrevented) {
      throw err;
    }
  }
  return promise.then((res) => {
    for (const item of res || []) {
      if (item.status !== "rejected") continue;
      handlePreloadError(item.reason);
    }
    return baseModule().catch(handlePreloadError);
  });
};
function StatBar({ label, value, color = "#4caf50" }) {
  const clampedValue = Math.max(0, Math.min(100, value));
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "stat-bar", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "stat-bar__label", children: label }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(
      "div",
      {
        className: "stat-bar__track",
        role: "progressbar",
        "aria-label": label,
        "aria-valuenow": clampedValue,
        "aria-valuemin": 0,
        "aria-valuemax": 100,
        children: /* @__PURE__ */ jsxRuntimeExports.jsx(
          "div",
          {
            className: "stat-bar__fill",
            style: { width: `${clampedValue}%`, backgroundColor: color }
          }
        )
      }
    )
  ] });
}
const ResourceMonitor = reactExports.lazy(
  () => __vitePreload(() => import("./ResourceMonitor-DnelejYL.js"), true ? __vite__mapDeps([0,1,2,3]) : void 0, import.meta.url).then((m) => ({ default: m.ResourceMonitor }))
);
function PetDetails({
  petState,
  onReset,
  onRename,
  onFeed,
  onPlay,
  onClean,
  onRest,
  onOverlayMode
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "pet-details", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "pet-details-header", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("h1", { children: "petmii" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "pet-name", children: petState.name })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "pet-details-info", children: [
      petState.species,
      " · ",
      petState.color,
      " · ",
      petState.personality
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "pet-details-avatar", children: /* @__PURE__ */ jsxRuntimeExports.jsx(
      PetAvatar,
      {
        species: petState.species,
        color: petState.color,
        personality: petState.personality
      }
    ) }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "pet-details-mood", children: [
      "Mood: ",
      petState.mood
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "pet-details-stats", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(StatBar, { label: "Hunger", value: petState.hunger, color: "#ff9800" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(StatBar, { label: "Happiness", value: petState.happiness, color: "#ffc107" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(StatBar, { label: "Energy", value: petState.energy, color: "#4caf50" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(StatBar, { label: "Cleanliness", value: petState.cleanliness, color: "#2196f3" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(StatBar, { label: "Bond", value: petState.bond, color: "#e91e63" })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "pet-details-actions", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", onClick: onFeed, children: "Feed" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", onClick: onPlay, children: "Play" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", onClick: onClean, children: "Clean" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", onClick: onRest, children: "Rest" })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "pet-details-message", "aria-live": "polite", children: petState.lastMessage }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(reactExports.Suspense, { fallback: null, children: /* @__PURE__ */ jsxRuntimeExports.jsx(ResourceMonitor, {}) }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "pet-details-settings", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", onClick: onOverlayMode, className: "pet-details-overlay-btn", children: "🐾 Overlay Mode" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", onClick: () => onRename(petState.name), children: "Rename" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", onClick: onReset, children: "Reset" })
    ] })
  ] });
}
function RenamePetModal({ currentName, onRename, onClose }) {
  const [name, setName] = reactExports.useState(currentName);
  const [error, setError] = reactExports.useState("");
  function handleSubmit(e) {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      setError("A non-empty name is required");
      return;
    }
    if (trimmed.length > 20) {
      setError("Name must be 20 characters or fewer");
      return;
    }
    setError("");
    onRename(trimmed);
  }
  return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "rename-modal-overlay", onClick: onClose, role: "dialog", "aria-modal": "true", "aria-label": "Rename pet", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rename-modal", onClick: (e) => e.stopPropagation(), children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { children: "Rename Pet" }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("form", { onSubmit: handleSubmit, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        "input",
        {
          type: "text",
          value: name,
          onChange: (e) => {
            setName(e.target.value);
            setError("");
          },
          maxLength: 20,
          placeholder: "Name your pet",
          autoFocus: true,
          "aria-label": "Pet name",
          "aria-describedby": error ? "rename-error" : void 0
        }
      ),
      error && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { id: "rename-error", className: "rename-modal__error", role: "alert", children: error }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rename-modal__actions", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", className: "rename-modal__cancel", onClick: onClose, children: "Cancel" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "submit", className: "rename-modal__confirm", children: "Confirm" })
      ] })
    ] })
  ] }) });
}
function App() {
  const {
    state,
    loading,
    petVariant,
    petState,
    transition,
    setPetVariant,
    setPetState
  } = useOnboarding();
  const { feed, play, clean, rest, rename, reset } = usePetState(
    petState,
    setPetState
  );
  const [showRenameModal, setShowRenameModal] = reactExports.useState(false);
  if (loading) {
    return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "egg-hatch-screen", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("h1", { children: "petmii" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { children: "Loading..." })
    ] });
  }
  function handleHatch() {
    const variant = generateRandomPetVariant();
    setPetVariant(variant);
    transition("HATCHING");
  }
  function handleAnimationEnd() {
    transition("NAMING");
  }
  async function handleNameSubmit(name) {
    if (!petVariant) return;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const newPet = {
      id: crypto.randomUUID(),
      name,
      species: petVariant.species,
      color: petVariant.color,
      personality: petVariant.personality,
      ...DEFAULT_PET_STATS,
      hatchedAt: now,
      createdAt: now,
      updatedAt: now
    };
    try {
      console.log("[petmii] Saving new pet:", newPet.name);
      await window.petmiiAPI.savePet(newPet);
      console.log("[petmii] Pet saved successfully");
      setPetState(newPet);
      transition("ACTIVE_PET");
    } catch (err) {
      console.error("[petmii] Failed to save pet:", err);
    }
  }
  async function handleReset() {
    const confirmed = window.confirm(
      "Are you sure you want to reset your pet? This cannot be undone."
    );
    if (!confirmed) return;
    window.petmiiAPI.closeOverlay();
    await reset();
    transition("EGG_READY");
  }
  function handleRenameClick(_currentName) {
    setShowRenameModal(true);
  }
  async function handleRenameConfirm(newName) {
    try {
      console.log("[petmii] Renaming pet to:", newName);
      const updated = await rename(newName);
      if (updated) {
        window.petmiiAPI.updateOverlay({
          species: updated.species,
          color: updated.color,
          personality: updated.personality
        });
      }
      setShowRenameModal(false);
    } catch (err) {
      console.error("[petmii] Failed to rename pet:", err);
    }
  }
  switch (state) {
    case "EGG_READY":
      return /* @__PURE__ */ jsxRuntimeExports.jsx(EggHatchScreen, { onHatch: handleHatch });
    case "HATCHING":
      return /* @__PURE__ */ jsxRuntimeExports.jsx(
        EggHatchScreen,
        {
          hatching: true,
          onHatch: handleHatch,
          onAnimationEnd: handleAnimationEnd
        }
      );
    case "NAMING":
      return /* @__PURE__ */ jsxRuntimeExports.jsx(NamePetScreen, { variant: petVariant, onNameSubmit: handleNameSubmit });
    case "ACTIVE_PET":
      return /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          PetDetails,
          {
            petState,
            onReset: handleReset,
            onRename: handleRenameClick,
            onFeed: feed,
            onPlay: play,
            onClean: clean,
            onRest: rest,
            onOverlayMode: () => window.petmiiAPI.enterOverlayMode()
          }
        ),
        showRenameModal && /* @__PURE__ */ jsxRuntimeExports.jsx(
          RenamePetModal,
          {
            currentName: petState.name,
            onRename: handleRenameConfirm,
            onClose: () => setShowRenameModal(false)
          }
        )
      ] });
    default:
      return /* @__PURE__ */ jsxRuntimeExports.jsx(EggHatchScreen, { onHatch: handleHatch });
  }
}
const root = createRoot(document.getElementById("root"));
root.render(/* @__PURE__ */ jsxRuntimeExports.jsx(App, {}));
