declare module '#demo-sources' {
  const sources: Record<
    keyof typeof import('../demo-sources').demoFiles,
    string
  >
  export default sources
}
