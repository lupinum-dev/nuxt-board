import { defineComponent as y, computed as m, shallowRef as p, onScopeDispose as v, h as x } from "vue";
import { boundsIntersect as $ } from "@canvas/core";
import { useCanvasEngine as b } from "@canvas/vue";
function L(e = {}) {
  const o = e.routing ?? "bezier";
  return {
    name: "connections",
    install(r) {
      const n = r, s = /* @__PURE__ */ new Map();
      let c = 1;
      n.createEdge = (t) => {
        const a = {
          id: t.id ?? crypto.randomUUID(),
          from: t.from,
          to: t.to,
          fromAnchor: t.fromAnchor,
          toAnchor: t.toAnchor,
          data: structuredClone(t.data ?? {}),
          zIndex: c++
        };
        return s.set(a.id, a), r.emit("edge:created", a), structuredClone(a);
      }, n.deleteEdge = (t) => {
        s.has(t) && (s.delete(t), r.emit("edge:deleted", t));
      }, n.getEdges = () => Array.from(s.values()).map((t) => structuredClone(t)), n.getEdgesFrom = (t) => n.getEdges().filter((a) => a.from === t), n.getEdgesTo = (t) => n.getEdges().filter((a) => a.to === t), n.getEdgesBetween = (t, a) => n.getEdges().filter((i) => i.from === t && i.to === a);
      const l = r.on("node:deleted", (t) => {
        for (const a of s.values())
          (a.from === t || a.to === t) && s.delete(a.id);
      });
      return n.__connectionRouting = o, () => {
        l();
      };
    }
  };
}
function u(e, o) {
  const r = o?.offset ?? 0.5;
  switch (o?.side ?? "right") {
    case "top":
      return { x: e.x + e.width * r, y: e.y };
    case "bottom":
      return { x: e.x + e.width * r, y: e.y + e.height };
    case "left":
      return { x: e.x, y: e.y + e.height * r };
    default:
      return { x: e.x + e.width, y: e.y + e.height * r };
  }
}
function E(e, o, r = "bezier") {
  if (r === "straight")
    return `M ${e.x} ${e.y} L ${o.x} ${o.y}`;
  if (r === "step") {
    const s = (e.x + o.x) / 2;
    return `M ${e.x} ${e.y} L ${s} ${e.y} L ${s} ${o.y} L ${o.x} ${o.y}`;
  }
  const n = Math.max(40, Math.abs(o.x - e.x) * 0.4);
  return `M ${e.x} ${e.y} C ${e.x + n} ${e.y}, ${o.x - n} ${o.y}, ${o.x} ${o.y}`;
}
function M(e, o) {
  return {
    minX: Math.min(e.x, o.x),
    minY: Math.min(e.y, o.y),
    maxX: Math.max(e.x, o.x),
    maxY: Math.max(e.y, o.y)
  };
}
function P(e, o) {
  const r = new Map(e.getSnapshot().nodes.map((n) => [n.id, n]));
  return e.getEdges().filter((n) => {
    const s = r.get(n.from), c = r.get(n.to);
    return !s || !c ? !1 : $(o, M(u(s, n.fromAnchor), u(c, n.toAnchor)));
  });
}
const z = y({
  name: "CanvasConnectionLayer",
  props: {
    engine: {
      type: Object,
      default: null
    },
    routing: {
      type: String,
      default: "bezier"
    }
  },
  setup(e, { slots: o }) {
    const r = b(), n = m(() => e.engine ?? r.engine), s = p(0), c = [
      n.value.on("edge:created", () => {
        s.value += 1;
      }),
      n.value.on("edge:deleted", () => {
        s.value += 1;
      }),
      n.value.on("node:updated", () => {
        s.value += 1;
      }),
      n.value.on("node:deleted", () => {
        s.value += 1;
      })
    ];
    v(() => {
      for (const t of c)
        t();
    });
    const l = m(() => {
      s.value;
      const t = r.snapshot.value, a = new Map(t.nodes.map((i) => [i.id, i]));
      return n.value.getEdges().map((i) => {
        const d = a.get(i.from), g = a.get(i.to);
        if (!d || !g)
          return null;
        const f = u(d, i.fromAnchor), h = u(g, i.toAnchor);
        return {
          edge: i,
          from: f,
          to: h,
          path: E(f, h, e.routing)
        };
      }).filter((i) => !!i);
    });
    return () => x(
      "svg",
      {
        class: "canvas-connection-layer",
        style: {
          position: "absolute",
          inset: "0",
          overflow: "visible",
          pointerEvents: "none"
        }
      },
      l.value.map(
        (t) => o.edge ? o.edge(t) : x("path", {
          d: t.path,
          stroke: "currentColor",
          fill: "none",
          "stroke-width": 2
        })
      )
    );
  }
});
export {
  z as CanvasConnectionLayer,
  L as connectionPlugin,
  M as getEdgeBounds,
  P as getVisibleEdges,
  u as resolveAnchorPoint,
  E as routeEdgePath
};
