/**
 * navigator.clipboard is only available in a "secure context" (https:// or
 * http://localhost) — testing over the LAN from a phone means the page is
 * served over plain http:// from a real IP, where the Clipboard API is
 * undefined and the copy button would otherwise silently do nothing. Falls
 * back to the classic hidden-textarea + execCommand trick, which still
 * works everywhere.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fall through to the legacy path below
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.top = "-1000px";
  textarea.style.left = "-1000px";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  document.body.removeChild(textarea);
  return ok;
}
