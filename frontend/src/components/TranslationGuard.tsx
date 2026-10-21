"use client";

/**
 * Chrome's translator wraps text nodes in <font>. React then calls
 * insertBefore/removeChild on a node that is no longer a direct child and
 * the page dies on the next update (Run Live Inference, refresh, a tab).
 * If the reference was moved, append the new node instead of throwing.
 */
function installTranslationGuard() {
  if (typeof window === "undefined" || typeof Node !== "function") return;

  const proto = Node.prototype as unknown as {
    removeChild: (child: Node) => Node;
    insertBefore: (node: Node, child: Node | null) => Node;
    __raincastTranslationGuard?: boolean;
  };
  if (proto.__raincastTranslationGuard) return;

  const removeChild = proto.removeChild;
  const insertBefore = proto.insertBefore;

  proto.removeChild = function (this: Node, child: Node) {
    if (child.parentNode !== this) return child;
    return removeChild.call(this, child);
  };

  proto.insertBefore = function (this: Node, node: Node, child: Node | null) {
    if (child && child.parentNode !== this) {
      return insertBefore.call(this, node, null);
    }
    return insertBefore.call(this, node, child);
  };

  proto.__raincastTranslationGuard = true;
}

installTranslationGuard();

export function TranslationGuard() {
  return null;
}
