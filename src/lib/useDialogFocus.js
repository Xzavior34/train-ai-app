import { useEffect, useRef } from "react";

const dialogs = [];
let originalOverflow = "";
const focusable = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function useDialogFocus(isOpen, dialogRef, onClose) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!isOpen || !dialogRef.current) return;
    const dialog = dialogRef.current;
    const previous = document.activeElement;
    const token = {};
    if (!dialogs.length) { originalOverflow = document.body.style.overflow; document.body.style.overflow = "hidden"; }
    dialogs.push(token);
    const controls = () => [...dialog.querySelectorAll(focusable)].filter(el => el.getClientRects().length && el.getAttribute("aria-hidden") !== "true");
    (controls()[0] || dialog).focus();
    function handleKey(event) {
      if (dialogs.at(-1) !== token) return;
      if (event.key === "Escape") {
        event.preventDefault(); event.stopImmediatePropagation(); closeRef.current?.();
      } else if (event.key === "Tab") {
        const items = controls(), first = items[0], last = items.at(-1);
        if (!first) { event.preventDefault(); dialog.focus(); return; }
        if (!dialog.contains(document.activeElement) || (event.shiftKey && document.activeElement === first) || (!event.shiftKey && document.activeElement === last)) {
          event.preventDefault(); (event.shiftKey ? last : first).focus();
        }
      }
    }
    document.addEventListener("keydown", handleKey, true);
    return () => {
      document.removeEventListener("keydown", handleKey, true);
      dialogs.splice(dialogs.indexOf(token), 1);
      if (!dialogs.length) document.body.style.overflow = originalOverflow;
      if (previous?.isConnected) previous.focus?.();
    };
  }, [isOpen, dialogRef]);
}
