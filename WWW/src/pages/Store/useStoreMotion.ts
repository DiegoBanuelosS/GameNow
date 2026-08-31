import { useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP, ScrollTrigger);

function reduceMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function useStoreEnter(ready: boolean) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!ready || !root.current || reduceMotion()) {
        return;
      }

      gsap.from(".site-header-bar", { y: -28, opacity: 0, duration: 0.55, ease: "power3.out" });
      gsap.from(".ad-strip, .games-page > .games-crumb, .games-page > h1, .games-page > .games-tables-lead", {
        y: 22,
        opacity: 0,
        duration: 0.6,
        stagger: 0.06,
        ease: "power3.out",
      });

      const reveal = (selector: string, child: string) => {
        const trigger = root.current?.querySelector(selector);
        const items = root.current?.querySelectorAll(child);
        if (!trigger || !items?.length) {
          return;
        }
        gsap.from(items, {
          y: 28,
          opacity: 0,
          duration: 0.55,
          stagger: 0.07,
          ease: "power3.out",
          scrollTrigger: {
            trigger,
            start: "top 82%",
            toggleActions: "play none none reverse",
          },
        });
      };

      reveal(".event-offers", ".event-offers h2, .offer-card");
      reveal(".games-tables", ".games-tables-head, .games-table-wrap");
      reveal(".games-layout", ".games-sidebar, .games-pager");
    },
    { scope: root, dependencies: [ready] },
  );

  return root;
}

export function useSearchMotion(open: boolean) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!open || !root.current || reduceMotion()) {
        return;
      }
      gsap.from(".search-overlay-backdrop", { opacity: 0, duration: 0.28, ease: "power2.out" });
      gsap.from(".search-overlay-panel", {
        y: -18,
        opacity: 0,
        duration: 0.42,
        ease: "power3.out",
      });
    },
    { scope: root, dependencies: [open] },
  );

  return root;
}

export function useSearchHits(query: string) {
  const list = useRef<HTMLUListElement>(null);

  useGSAP(
    () => {
      if (!list.current || reduceMotion()) {
        return;
      }
      const items = list.current.querySelectorAll("li");
      if (!items.length) {
        return;
      }
      gsap.from(items, {
        y: 8,
        opacity: 0,
        duration: 0.28,
        stagger: 0.035,
        ease: "power2.out",
      });
    },
    { scope: list, dependencies: [query] },
  );

  return list;
}
