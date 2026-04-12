import { defineComponent as X, computed as c, h as f, shallowRef as Y, onScopeDispose as b } from "vue";
import { useCanvasEngine as $ } from "@canvas/vue";
function R(t, h = {}) {
  const o = Y(t.getSnapshot());
  let v = !1;
  const s = () => {
    v || (v = !0, queueMicrotask(() => {
      o.value = t.getSnapshot(), v = !1;
    }));
  }, d = [
    t.on("command:after", s)
  ];
  b(() => {
    for (const e of d)
      e();
  });
  const i = h.width ?? 200, p = h.height ?? 140, r = h.padding ?? 24, m = c(() => o.value.nodes.length === 0 ? { minX: -500, minY: -500, maxX: 500, maxY: 500 } : {
    minX: Math.min(...o.value.nodes.map((e) => e.x)) - r,
    minY: Math.min(...o.value.nodes.map((e) => e.y)) - r,
    maxX: Math.max(...o.value.nodes.map((e) => e.x + e.width)) + r,
    maxY: Math.max(...o.value.nodes.map((e) => e.y + e.height)) + r
  }), n = c(() => {
    const e = m.value;
    return Math.min(i / Math.max(1, e.maxX - e.minX), p / Math.max(1, e.maxY - e.minY));
  }), x = c(() => {
    const e = m.value, u = (e.maxX - e.minX) * n.value, a = (e.maxY - e.minY) * n.value;
    return {
      x: (i - u) / 2,
      y: (p - a) / 2
    };
  }), w = c(() => {
    const e = m.value, u = x.value;
    return o.value.nodes.map((a) => ({
      node: a,
      x: (a.x - e.minX) * n.value + u.x,
      y: (a.y - e.minY) * n.value + u.y,
      width: Math.max(2, a.width * n.value),
      height: Math.max(2, a.height * n.value)
    }));
  }), g = c(() => {
    const e = m.value, u = x.value, a = t.getViewportSize(), l = t.getVisibleBounds(a.x, a.y);
    return {
      x: (l.minX - e.minX) * n.value + u.x,
      y: (l.minY - e.minY) * n.value + u.y,
      width: Math.max(6, (l.maxX - l.minX) * n.value),
      height: Math.max(6, (l.maxY - l.minY) * n.value)
    };
  });
  async function y(e) {
    const u = o.value.camera, a = t.getViewportSize(), l = x.value, M = {
      x: m.value.minX + (e.x - l.x) / n.value - a.x / (2 * u.z),
      y: m.value.minY + (e.y - l.y) / n.value - a.y / (2 * u.z)
    };
    await t.panTo(M, !1);
  }
  return {
    bounds: m,
    viewportRect: g,
    minimapNodes: w,
    panToMinimapPoint: y
  };
}
const S = X({
  name: "CanvasMinimap",
  props: {
    engine: {
      type: Object,
      default: null
    },
    width: {
      type: Number,
      default: 200
    },
    height: {
      type: Number,
      default: 140
    }
  },
  setup(t, { slots: h }) {
    const o = $(), v = c(() => t.engine ?? o.engine), s = R(v.value, {
      width: t.width,
      height: t.height
    });
    function d(i) {
      const p = i.currentTarget.getBoundingClientRect();
      s.panToMinimapPoint({
        x: i.clientX - p.left,
        y: i.clientY - p.top
      });
    }
    return () => f(
      "div",
      {
        class: "canvas-minimap",
        style: {
          position: "relative",
          width: `${t.width}px`,
          height: `${t.height}px`,
          overflow: "hidden"
        },
        onPointerdown: d
      },
      [
        h.default ? h.default({
          nodes: s.minimapNodes.value,
          viewport: s.viewportRect.value
        }) : [
          ...s.minimapNodes.value.map(
            (i) => f("div", {
              key: i.node.id,
              style: {
                position: "absolute",
                left: `${i.x}px`,
                top: `${i.y}px`,
                width: `${i.width}px`,
                height: `${i.height}px`,
                border: "1px solid currentColor"
              }
            })
          ),
          f("div", {
            style: {
              position: "absolute",
              left: `${s.viewportRect.value.x}px`,
              top: `${s.viewportRect.value.y}px`,
              width: `${s.viewportRect.value.width}px`,
              height: `${s.viewportRect.value.height}px`,
              border: "1px solid currentColor"
            }
          })
        ]
      ]
    );
  }
});
export {
  S as CanvasMinimap,
  R as useMinimap
};
