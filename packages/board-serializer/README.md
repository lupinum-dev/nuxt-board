# @lupinum/board-serializer

JSON Canvas import/export helpers for Vue Board snapshots and engines.

```bash
pnpm add @lupinum/board-serializer @lupinum/board-core
```

```ts
import { jsonCanvasSerializer } from '@lupinum/board-serializer'

const json = jsonCanvasSerializer.export(engine)
const document = jsonCanvasSerializer.parse(json)
jsonCanvasSerializer.hydrateEngine(engine, document, 'replace')
```

When `@lupinum/board-connections` is installed on the engine, connection edges
are exported and hydrated too.

- Docs: https://vue-board.vercel.app/api/board-serializer
- Issues: https://github.com/lupinum/nuxt-board/issues
- License: MIT
