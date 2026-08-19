import { useEffect } from "react";

export function useScrollToHash() {
  useEffect(() => {
    const hash = window.location.hash;
    if (hash) {
      const timer = setTimeout(() => {
        const el = document.getElementById(hash.slice(1));
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
          el.classList.add("ring-2", "ring-blue-400/50", "ring-offset-2", "ring-offset-slate-900");
          setTimeout(() => {
            el.classList.remove("ring-2", "ring-blue-400/50", "ring-offset-2", "ring-offset-slate-900");
          }, 3000);
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, []);
}
