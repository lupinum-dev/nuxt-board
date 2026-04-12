import { defineComponent as f, computed as c, h as r, shallowRef as g, onScopeDispose as M } from "vue";
import { useCanvasEngine as y } from "@canvas/vue";
function b(e, m = {}) {
  const u = g(e.getSnapshot()), l = () => {
    u.value = e.getSnapshot();
  }, i = [
    e.on("camera:change", l),
    e.on("node:created", l),
    e.on("node:updated", l),
    e.on("node:deleted", l),
    e.on("selection:change", l),
    e.on("interaction:update", l),
    e.on("interaction:end", l)
  ];
  M(() => {
    for (const t of i)
      t();
  });
  const p = m.width ?? 200, a = m.height ?? 140, h = m.padding ?? 24, s = c(() => u.value.nodes.length === 0 ? { minX: -500, minY: -500, maxX: 500, maxY: 500 } : {
    minX: Math.min(...u.value.nodes.map((t) => t.x)) - h,
    minY: Math.min(...u.value.nodes.map((t) => t.y)) - h,
    maxX: Math.max(...u.value.nodes.map((t) => t.x + t.width)) + h,
    maxY: Math.max(...u.value.nodes.map((t) => t.y + t.height)) + h
  }), n = c(() => {
    const t = s.value;
    return Math.min(p / Math.max(1, t.maxX - t.minX), a / Math.max(1, t.maxY - t.minY));
  }), v = c(() => {
    const t = s.value;
    return u.value.nodes.map((o) => ({
      node: o,
      x: (o.x - t.minX) * n.value,
      y: (o.y - t.minY) * n.value,
      width: Math.max(2, o.width * n.value),
      height: Math.max(2, o.height * n.value)
    }));
  }), x = c(() => {
    const t = s.value, o = e.getViewportSize(), d = e.getVisibleBounds(o.x, o.y);
    return {
      x: (d.minX - t.minX) * n.value,
      y: (d.minY - t.minY) * n.value,
      width: Math.max(6, (d.maxX - d.minX) * n.value),
      height: Math.max(6, (d.maxY - d.minY) * n.value)
    };
  });
  async function w(t) {
    const o = {
      x: s.value.minX + t.x / n.value,
      y: s.value.minY + t.y / n.value
    };
    await e.panTo(o, !1);
  }
  return {
    bounds: s,
    viewportRect: x,
    minimapNodes: v,
    panToMinimapPoint: w
  };
}
const $ = f({
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
  setup(e, { slots: m }) {
    const u = y(), l = c(() => e.engine ?? u.engine), i = b(l.value, {
      width: e.width,
      height: e.height
    });
    function p(a) {
      const h = a.currentTarget.getBoundingClientRect();
      i.panToMinimapPoint({
        x: a.clientX - h.left,
        y: a.clientY - h.top
      });
    }
    return () => r(
      "div",
      {
        class: "canvas-minimap",
        style: {
          position: "relative",
          width: `${e.width}px`,
          height: `${e.height}px`,
          overflow: "hidden"
        },
        onPointerdown: p
      },
      [
        m.default ? m.default({
          nodes: i.minimapNodes.value,
          viewport: i.viewportRect.value
        }) : [
          ...i.minimapNodes.value.map(
            (a) => r("div", {
              key: a.node.id,
              style: {
                position: "absolute",
                left: `${a.x}px`,
                top: `${a.y}px`,
                width: `${a.width}px`,
                height: `${a.height}px`,
                border: "1px solid currentColor"
              }
            })
          ),
          r("div", {
            style: {
              position: "absolute",
              left: `${i.viewportRect.value.x}px`,
              top: `${i.viewportRect.value.y}px`,
              width: `${i.viewportRect.value.width}px`,
              height: `${i.viewportRect.value.height}px`,
              border: "1px solid currentColor"
            }
          })
        ]
      ]
    );
  }
});
export {
  $ as CanvasMinimap,
  b as useMinimap
};
