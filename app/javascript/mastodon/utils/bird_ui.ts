// Themes are stylesheet bundles rather than an initial-state setting. Their
// CSS marker is available before the application mounts, including on servers
// that use Bird UI as the default theme.
export function isBirdUiEnabled() {
  return (
    getComputedStyle(document.documentElement)
      .getPropertyValue('--bird-ui-redesign')
      .trim() === '1'
  );
}
