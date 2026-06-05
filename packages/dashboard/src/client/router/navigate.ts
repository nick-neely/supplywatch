export function navigateTo(url: string): void {
  window.history.pushState({}, "", url);
  window.dispatchEvent(new Event("supplywatch:navigate"));
}
