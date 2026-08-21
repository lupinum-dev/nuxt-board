export interface ConsumedPrereleaseVersion {
  tag: string
  versions: string[]
  baseVersions: Array<string | null>
  consumedChangesets: string[]
  changesetIds: string[]
  changedPaths: string[]
  packagePaths: string[]
  changelog: string
}

export function isConsumedPrereleaseVersion(
  candidate: ConsumedPrereleaseVersion,
): boolean
