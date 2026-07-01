// Framework-agnostic map UI for the LocationMap block.
//
// Mirrors the `@aws-blocks/blocks/ui` convention: a factory that returns a DOM
// node plus a small imperative handle, so it works from React/Vue/vanilla. The
// block owns the whole map experience here — offline SVG (bundled, no network)
// and Google Maps — selected by the `config` the caller passes in. No host
// framework and no app API client are imported.
import { setOptions, importLibrary } from "@googlemaps/js-api-loader";
import worldMapSvg from "./world-map.svg?raw";

export interface LatLng {
  lat: number;
  lng: number;
}

/** The map descriptor produced by the backend's getMapConfig. */
export interface LocationMapViewConfig {
  isOffline: boolean;
  googleMapsApiKey?: string | null;
}

export interface CreateLocationMapOptions {
  config: LocationMapViewConfig;
  onSelect: (coords: LatLng) => void;
  /** Map height in px (default 380). */
  height?: number;
}

/** Imperative handle returned by {@link createLocationMap}. */
export interface LocationMapHandle {
  readonly element: HTMLElement;
  setGuess(coords: LatLng | null): void;
  setActual(coords: LatLng | null): void;
  setLocked(locked: boolean): void;
  destroy(): void;
}

const COLORS = {
  coral: "#FF5A5F",
  teal: "#00C2C3",
  yellow: "#FFD151",
  border: "rgba(255,255,255,0.10)",
  textMuted: "#9FBCBB",
  ocean: "#1a3a4a",
};
const SVG_NS = "http://www.w3.org/2000/svg";

/**
 * Create a map view. Renders Google Maps when a key is present and the config
 * isn't offline; otherwise the bundled offline SVG world map.
 */
export function createLocationMap(
  options: CreateLocationMapOptions,
): LocationMapHandle {
  const useGoogle =
    !options.config.isOffline && !!options.config.googleMapsApiKey;
  return useGoogle ? createGoogleMap(options) : createOfflineMap(options);
}

function baseContainer(height: number): HTMLDivElement {
  const el = document.createElement("div");
  el.className = "blocks-location-map";
  el.style.cssText = `width:100%;height:${height}px;border-radius:10px;border:1px solid ${COLORS.border};overflow:hidden;position:relative;background:${COLORS.ocean};`;
  return el;
}

// ─── Offline SVG map (bundled, fully offline) ────────────────────────────────
function createOfflineMap(options: CreateLocationMapOptions): LocationMapHandle {
  const height = options.height ?? 380;
  let zoom = 1;
  let pan = { x: 0, y: 0 };
  let isPanning = false;
  let lastMouse = { x: 0, y: 0 };
  let guess: LatLng | null = null;
  let actual: LatLng | null = null;
  let locked = false;

  const container = baseContainer(height);

  const style = document.createElement("style");
  style.textContent =
    ".blocks-location-map path[data-country]{fill:#2d5a3d;stroke:#1a3a4a;stroke-width:0.3;cursor:crosshair;transition:fill .15s;}" +
    ".blocks-location-map path[data-country]:hover{fill:#4a8a5d;}" +
    ".blocks-location-map svg{width:100%;height:100%;display:block;}";
  container.appendChild(style);

  const inner = document.createElement("div");
  inner.style.cssText =
    "width:100%;height:100%;transform-origin:center center;position:relative;";

  const mapLayer = document.createElement("div");
  mapLayer.style.cssText = "width:100%;height:100%;";
  mapLayer.innerHTML = worldMapSvg;

  const overlay = document.createElementNS(SVG_NS, "svg");
  overlay.setAttribute("viewBox", "0 0 360 180");
  overlay.setAttribute(
    "style",
    "position:absolute;inset:0;width:100%;height:100%;pointer-events:none;",
  );

  inner.appendChild(mapLayer);
  inner.appendChild(overlay);
  container.appendChild(inner);

  const zoomIndicator = document.createElement("div");
  zoomIndicator.style.cssText =
    "position:absolute;bottom:8px;right:8px;background:rgba(0,0,0,0.6);color:#fff;font-size:0.7rem;font-family:monospace;padding:3px 7px;border-radius:6px;pointer-events:none;display:none;";
  container.appendChild(zoomIndicator);

  const toSvgX = (lng: number) => lng + 180;
  const toSvgY = (lat: number) => 90 - lat;

  function applyTransform() {
    inner.style.transform = `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`;
    inner.style.transition = isPanning ? "none" : "transform 0.15s ease-out";
    container.style.cursor = locked
      ? "default"
      : zoom > 1
        ? "grab"
        : "crosshair";
    if (zoom > 1) {
      zoomIndicator.style.display = "block";
      zoomIndicator.textContent = `${zoom.toFixed(1)}×`;
    } else {
      zoomIndicator.style.display = "none";
    }
  }

  function circle(cx: number, cy: number, fill: string): SVGCircleElement {
    const c = document.createElementNS(SVG_NS, "circle");
    c.setAttribute("cx", String(cx));
    c.setAttribute("cy", String(cy));
    c.setAttribute("r", String(2.5 / zoom));
    c.setAttribute("fill", fill);
    c.setAttribute("stroke", "white");
    c.setAttribute("stroke-width", String(0.5 / zoom));
    return c;
  }

  function renderMarkers() {
    while (overlay.firstChild) overlay.removeChild(overlay.firstChild);
    if (guess && actual) {
      const line = document.createElementNS(SVG_NS, "line");
      line.setAttribute("x1", String(toSvgX(guess.lng)));
      line.setAttribute("y1", String(toSvgY(guess.lat)));
      line.setAttribute("x2", String(toSvgX(actual.lng)));
      line.setAttribute("y2", String(toSvgY(actual.lat)));
      line.setAttribute("stroke", COLORS.yellow);
      line.setAttribute("stroke-width", String(0.4 / zoom));
      line.setAttribute("stroke-dasharray", "1.5,1");
      line.setAttribute("opacity", "0.8");
      overlay.appendChild(line);
    }
    if (guess) overlay.appendChild(circle(toSvgX(guess.lng), toSvgY(guess.lat), COLORS.coral));
    if (actual) overlay.appendChild(circle(toSvgX(actual.lng), toSvgY(actual.lat), COLORS.teal));
  }

  function onClick(e: MouseEvent) {
    if (locked || isPanning) return;
    const rect = container.getBoundingClientRect();
    const rawX =
      (e.clientX - rect.left - rect.width / 2 - pan.x) / zoom + rect.width / 2;
    const rawY =
      (e.clientY - rect.top - rect.height / 2 - pan.y) / zoom + rect.height / 2;
    const x = (rawX / rect.width) * 360;
    const y = (rawY / rect.height) * 180;
    const lng = x - 180;
    const lat = 90 - y;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return;
    options.onSelect({ lat, lng });
  }

  function onWheel(e: WheelEvent) {
    e.preventDefault();
    zoom = Math.max(1, Math.min(8, zoom * (e.deltaY < 0 ? 1.2 : 1 / 1.2)));
    applyTransform();
    renderMarkers();
  }

  function onMouseDown(e: MouseEvent) {
    if (e.button !== 0) return;
    isPanning = false;
    lastMouse = { x: e.clientX, y: e.clientY };
    const move = (me: MouseEvent) => {
      const dx = me.clientX - lastMouse.x;
      const dy = me.clientY - lastMouse.y;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) isPanning = true;
      pan = { x: pan.x + dx, y: pan.y + dy };
      lastMouse = { x: me.clientX, y: me.clientY };
      applyTransform();
    };
    const up = () => {
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
      setTimeout(() => {
        isPanning = false;
      }, 0);
    };
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
  }

  container.addEventListener("click", onClick);
  container.addEventListener("wheel", onWheel, { passive: false });
  container.addEventListener("mousedown", onMouseDown);

  applyTransform();
  renderMarkers();

  function maybeReset() {
    if (!guess && !actual) {
      zoom = 1;
      pan = { x: 0, y: 0 };
      applyTransform();
    }
  }

  return {
    element: container,
    setGuess(c) {
      guess = c;
      maybeReset();
      renderMarkers();
    },
    setActual(c) {
      actual = c;
      maybeReset();
      renderMarkers();
    },
    setLocked(l) {
      locked = l;
      applyTransform();
    },
    destroy() {
      container.removeEventListener("click", onClick);
      container.removeEventListener("wheel", onWheel);
      container.removeEventListener("mousedown", onMouseDown);
      container.remove();
    },
  };
}

// ─── Google Maps (deployed) ──────────────────────────────────────────────────
function createGoogleMap(options: CreateLocationMapOptions): LocationMapHandle {
  const height = options.height ?? 380;
  const container = baseContainer(height);

  let map: google.maps.Map | null = null;
  let MarkerCtor: typeof google.maps.Marker | null = null;
  let LatLngBoundsCtor: typeof google.maps.LatLngBounds | null = null;
  let guessMarker: google.maps.Marker | null = null;
  let actualMarker: google.maps.Marker | null = null;
  let guess: LatLng | null = null;
  let actual: LatLng | null = null;
  let locked = false;
  let destroyed = false;

  setOptions({ key: options.config.googleMapsApiKey as string, v: "weekly" });
  Promise.all([
    importLibrary("maps"),
    importLibrary("marker"),
    importLibrary("core"),
  ])
    .then(([maps, marker, core]) => {
      if (destroyed) return;
      MarkerCtor = marker.Marker;
      LatLngBoundsCtor = core.LatLngBounds;
      map = new maps.Map(container, {
        center: { lat: 20, lng: 0 },
        zoom: 2,
        clickableIcons: false,
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: false,
      });
      map!.addListener("click", (e: google.maps.MapMouseEvent) => {
        if (locked || !e.latLng) return;
        options.onSelect({ lat: e.latLng.lat(), lng: e.latLng.lng() });
      });
      renderMarkers();
    })
    .catch(() => {
      /* leave the empty container if Google Maps fails to load */
    });

  function renderMarkers() {
    if (!map || !MarkerCtor || !LatLngBoundsCtor) return;
    guessMarker?.setMap(null);
    guessMarker = null;
    actualMarker?.setMap(null);
    actualMarker = null;
    if (guess) {
      guessMarker = new MarkerCtor({
        position: guess,
        map,
        label: { text: "📍", fontSize: "22px" },
      });
    }
    if (actual) {
      actualMarker = new MarkerCtor({
        position: actual,
        map,
        label: { text: "✅", fontSize: "22px" },
      });
      if (guess) {
        const bounds = new LatLngBoundsCtor();
        bounds.extend(guess);
        bounds.extend(actual);
        map.fitBounds(bounds, 60);
      }
    }
    if (!guess && !actual) {
      map.setCenter({ lat: 20, lng: 0 });
      map.setZoom(2);
    }
  }

  return {
    element: container,
    setGuess(c) {
      guess = c;
      renderMarkers();
    },
    setActual(c) {
      actual = c;
      renderMarkers();
    },
    setLocked(l) {
      locked = l;
    },
    destroy() {
      destroyed = true;
      guessMarker?.setMap(null);
      actualMarker?.setMap(null);
      map = null;
      container.remove();
    },
  };
}
