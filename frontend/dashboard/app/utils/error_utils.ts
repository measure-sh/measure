export function errorGroupTitle(fileName: string, methodName: string): string {
  const file = fileName !== "" ? fileName : "unknown_file";
  const method = methodName !== "" ? methodName : "unknown_method";
  const complete = method.endsWith(")") || method.endsWith("]");
  return `${file}: ${method}${complete ? "" : "()"}`;
}

export function errorGroupPath(
  teamId: string,
  appId: string,
  group: { id: string; type: string; file_name: string },
): string {
  // A thread dump without a main thread gives its ANR no type, and an app hang
  // group has no type, so joining unconditionally would yield a leading "@".
  const groupName =
    [group.type, group.file_name].filter((part) => part !== "").join("@") ||
    "unknown_file";
  return `/${teamId}/errors/${appId}/${group.id}/${encodeURIComponent(groupName)}`;
}
