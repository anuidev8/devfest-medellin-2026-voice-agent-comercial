"use client";

import { motion, type HTMLMotionProps } from "motion/react";
import type { CSSProperties, ReactNode } from "react";

export type MasonrySize = "hero" | "tall" | "wide" | "square" | "compact";

const TAGS = {
  article: motion.article,
  div: motion.div,
  label: motion.label,
  section: motion.section,
} as const;

/** "90ms" / "0.2s" → seconds (callers pass the stagger as animationDelay). */
const delayOf = (style?: CSSProperties) => {
  const d = style?.animationDelay;
  if (typeof d === "number") return d / 1000;
  if (!d) return 0;
  const n = parseFloat(d);
  return d.endsWith("ms") ? n / 1000 : n;
};

/** Streaming entrance: rise + unblur on a soft spring; `layout` reflows the bento as cards stream in. */
const enter = (delay: number): Pick<HTMLMotionProps<"div">, "initial" | "animate" | "transition"> => ({
  initial: { opacity: 0, y: 28, scale: 0.97, filter: "blur(8px)" },
  animate: { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" },
  transition: {
    type: "spring",
    stiffness: 140,
    damping: 20,
    delay,
    filter: { duration: 0.5, delay },
    opacity: { duration: 0.4, delay },
  },
});

/**
 * Shopping-console style tile: big rounded visual, title + caption underneath.
 * Used by intake, matches, plan — same shell.
 */
export function MasonryCard({
  size = "square",
  kicker,
  title,
  caption,
  children,
  footer,
  flash,
  active,
  badge,
  className = "",
  as = "article",
  style,
}: {
  size?: MasonrySize;
  kicker?: string;
  title?: ReactNode;
  caption?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  flash?: boolean;
  /** Being asked / read aloud right now → glow + pulse. */
  active?: boolean;
  /** Small pill over the visual (e.g. "Preguntando", "Listo"). */
  badge?: ReactNode;
  className?: string;
  as?: keyof typeof TAGS;
  style?: CSSProperties;
}) {
  const Tag = TAGS[as] as typeof motion.div;
  const rest = { ...style };
  delete rest.animationDelay; // the stagger is applied by framer-motion instead
  return (
    <Tag
      layout="position"
      {...enter(delayOf(style))}
      className={`masonry-card masonry-card--${size} ${flash ? "masonry-card--flash" : ""} ${active ? "masonry-card--active" : ""} ${className}`}
      data-active={active ? "1" : undefined}
      style={rest}
    >
      {badge && <span className="masonry-card__state">{badge}</span>}
      {kicker && <p className="masonry-card__kicker">{kicker}</p>}
      {children && <div className="masonry-card__body">{children}</div>}
      {(title || caption) && (
        <div className="masonry-card__meta">
          {title && <h3 className="masonry-card__title">{title}</h3>}
          {caption && <p className="masonry-card__caption">{caption}</p>}
        </div>
      )}
      {footer}
    </Tag>
  );
}

/** Placeholder tile while a tool / A2UI surface is still streaming. */
export function MasonrySkeleton({ size = "square", delay = 0 }: { size?: MasonrySize; delay?: number }) {
  return (
    <motion.div
      layout="position"
      className={`masonry-card masonry-card--${size}`}
      aria-hidden="true"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35, delay }}
    >
      <div className="masonry-card__body">
        <div className="skeleton-tile flex-1" />
      </div>
      <div className="masonry-card__meta grid gap-2">
        <span className="skeleton-line w-3/5" />
        <span className="skeleton-line w-2/5 opacity-70" />
      </div>
    </motion.div>
  );
}

/** Bento of skeletons in the reference pattern: one hero + 1×1 tiles. */
export function MasonrySkeletonBoard({ count = 5, label = "Cargando…" }: { count?: number; label?: string }) {
  return (
    <div className="masonry-board" role="status" aria-label={label}>
      {Array.from({ length: count }, (_, i) => (
        <MasonrySkeleton key={i} size={i === 0 ? "hero" : "square"} delay={i * 0.06} />
      ))}
    </div>
  );
}

/** Bento board (Shopping Console reference). */
export function MasonryBoard({
  children,
  className = "",
  label,
}: {
  children: ReactNode;
  className?: string;
  label?: string;
}) {
  return (
    <div className={`masonry-board ${className}`} role="list" aria-label={label}>
      {children}
    </div>
  );
}

/** Big board title + a live "streaming" status line while the tool runs. */
export function StreamHeading({ title, status }: { title: string; status?: string }) {
  return (
    <div className="grid gap-3">
      <h2 className="masonry-section-title">{title}</h2>
      {status && (
        <p className="flex items-center gap-2 text-base text-muted" aria-live="polite">
          <span className="dot animate-pulse bg-signal" aria-hidden="true" />
          {status}
        </p>
      )}
    </div>
  );
}
