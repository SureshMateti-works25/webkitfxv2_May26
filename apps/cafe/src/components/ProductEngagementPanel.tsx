import { JsonForm } from "@webkitfxv2/react-renderer";
import { getAtPath } from "@webkitfxv2/core-engine";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { productEngagementForm } from "../config/forms/index.js";
import {
  addProductComment,
  addProductRating,
  formatCommerceApiError,
  incrementProductDislike,
  incrementProductLike,
  type ProductEngagement,
} from "../lib/commerceApi.js";
import {
  ProductEngagementActionsContext,
  useProductEngagementActions,
  type ProductEngagementPanelId,
} from "./ProductEngagementActionsContext.js";

type Props = {
  productId: string;
  engagement: ProductEngagement | null;
  loading: boolean;
  onRefresh: () => Promise<void>;
};

const favStorageKey = (pid: string) => `pdp:favorite:${pid}`;

function readFavorite(pid: string): boolean {
  try {
    return window.localStorage.getItem(favStorageKey(pid)) === "1";
  } catch {
    return false;
  }
}

function writeFavorite(pid: string, on: boolean) {
  try {
    if (on) window.localStorage.setItem(favStorageKey(pid), "1");
    else window.localStorage.removeItem(favStorageKey(pid));
  } catch {
    /* ignore */
  }
}

/** Lucide-style stroke icons — padded viewBox so round caps are not clipped in pills/cards. */
function IconThumbUpStroke({ size = 18 }: { size?: number }) {
  return (
    <svg
      className="pdp-engagement-icon-svg"
      width={size}
      height={size}
      viewBox="-2 -2 28 28"
      overflow="visible"
      aria-hidden
      fill="none"
    >
      <path
        d="M7 10v12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15 5.88 14 10h5.83a2 2 0 0 1 1.82 1.19l1.01 2.22a2 2 0 0 1 .18.91V20a2 2 0 0 1-2 2h-7.9a2 2 0 0 1-1.69-.9l-2.31-3.23A2 2 0 0 1 4.5 16V10a2 2 0 0 1 2-2h.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconThumbDownStroke({ size = 18 }: { size?: number }) {
  return (
    <svg
      className="pdp-engagement-icon-svg"
      width={size}
      height={size}
      viewBox="-2 -2 28 28"
      overflow="visible"
      aria-hidden
      fill="none"
    >
      <path
        d="M17 14V2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.17 1h10a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2.48a2 2 0 0 0-1.93 1.46L8.5 19.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconHeart({ filled }: { filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path
        d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={filled ? 0 : 1.65}
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconComment() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path
        fill="currentColor"
        d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h4l4 4 4-4h4c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"
      />
    </svg>
  );
}

function IconShare() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path
        fill="currentColor"
        d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z"
      />
    </svg>
  );
}

function IconAbout() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path
        fill="currentColor"
        d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"
      />
    </svg>
  );
}

function IconFlag() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path fill="currentColor" d="M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6z" />
    </svg>
  );
}

function EngagementCommentsList({
  rows,
}: {
  rows: Array<{ id?: string; authorName?: string | null; commentText?: string; createdAt?: string }>;
}) {
  if (rows.length === 0) {
    return (
      <div id="pdp-comments-feed">
        <p className="pdp-engagement-comments__empty">No comments yet. Be the first to add one.</p>
      </div>
    );
  }
  return (
    <div id="pdp-comments-feed">
      <ul className="pdp-engagement-comments">
        {rows.map((r, i) => (
          <li key={r.id ?? `${r.authorName ?? "anon"}-${i}`}>
            <p>{r.commentText ?? ""}</p>
            <small>
              {(r.authorName && r.authorName.trim()) || "Anonymous"}
              {r.createdAt ? ` · ${new Date(r.createdAt).toLocaleString("en-IN")}` : ""}
            </small>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PdpEngagementPills({
  engagement,
  likes,
  dislikes,
  comments,
}: {
  engagement: ProductEngagement | null;
  likes: number;
  dislikes: number;
  comments: number;
}) {
  const ctx = useProductEngagementActions();

  if (!ctx) return null;

  const { activePanel, togglePanel, favorite: fav } = ctx;
  const is = (id: ProductEngagementPanelId) => activePanel === id;

  return (
    <nav className="pdp-engagement-toolbar" aria-label="Product actions">
      <button
        type="button"
        className={`pdp-engagement-toolbar__vote pdp-engagement-toolbar__pill${is("votes") ? " pdp-engagement-toolbar__pill--active" : ""}`}
        onClick={() => togglePanel("votes")}
        aria-expanded={is("votes")}
        aria-controls="pdp-engagement-drawer"
      >
        <span className="pdp-engagement-toolbar__vote-preview" aria-hidden>
          <IconThumbUpStroke size={18} />
          <span className="pdp-engagement-toolbar__vote-preview-count">
            {likes.toLocaleString("en-IN")} / {dislikes.toLocaleString("en-IN")}
          </span>
          <IconThumbDownStroke size={18} />
        </span>
        <span className="pdp-sr-only">Likes and dislikes. Opens voting panel.</span>
      </button>

      <span className="pdp-engagement-toolbar__sep" aria-hidden />

      <button
        type="button"
        className={`pdp-engagement-toolbar__btn${is("favorite") ? " pdp-engagement-toolbar__pill--active" : ""}`}
        onClick={() => togglePanel("favorite")}
        aria-expanded={is("favorite")}
        aria-controls="pdp-engagement-drawer"
      >
        <IconHeart filled={fav} />
        <span>Favorite</span>
      </button>

      <span className="pdp-engagement-toolbar__sep" aria-hidden />

      <button
        type="button"
        className={`pdp-engagement-toolbar__btn${is("comments") ? " pdp-engagement-toolbar__pill--active" : ""}`}
        onClick={() => togglePanel("comments")}
        aria-expanded={is("comments")}
        aria-controls="pdp-engagement-drawer"
      >
        <IconComment />
        <span>
          Comments{" "}
          <span className="pdp-engagement-toolbar__count">{comments.toLocaleString("en-IN")}</span>
        </span>
      </button>

      <span className="pdp-engagement-toolbar__sep" aria-hidden />

      <button
        type="button"
        className={`pdp-engagement-toolbar__btn${is("share") ? " pdp-engagement-toolbar__pill--active" : ""}`}
        onClick={() => togglePanel("share")}
        aria-expanded={is("share")}
        aria-controls="pdp-engagement-drawer"
      >
        <IconShare />
        <span>Share</span>
      </button>

      <span className="pdp-engagement-toolbar__sep" aria-hidden />

      <button
        type="button"
        className={`pdp-engagement-toolbar__btn${is("about") ? " pdp-engagement-toolbar__pill--active" : ""}`}
        onClick={() => togglePanel("about")}
        aria-expanded={is("about")}
        aria-controls="pdp-engagement-drawer"
      >
        <IconAbout />
        <span>About</span>
      </button>

      <span className="pdp-engagement-toolbar__sep" aria-hidden />

      <button
        type="button"
        className={`pdp-engagement-toolbar__btn pdp-engagement-toolbar__btn--icon-only${is("flag") ? " pdp-engagement-toolbar__pill--active" : ""}`}
        onClick={() => togglePanel("flag")}
        aria-expanded={is("flag")}
        aria-controls="pdp-engagement-drawer"
        aria-label="Report this listing"
      >
        <IconFlag />
      </button>

      {engagement != null && engagement.viewsCount > 0 ? (
        <span className="pdp-engagement-toolbar__meta" aria-live="polite">
          {engagement.viewsCount.toLocaleString("en-IN")} views
        </span>
      ) : null}
    </nav>
  );
}

function VoteDrawerBody() {
  const ctx = useProductEngagementActions();
  const productId = ctx?.productId ?? "";
  const [voteBusy, setVoteBusy] = useState<"like" | "dislike" | null>(null);
  const votingRef = useRef(false);

  const onLike = useCallback(async () => {
    if (!ctx || !productId || votingRef.current) return;
    votingRef.current = true;
    setVoteBusy("like");
    try {
      await incrementProductLike(productId);
      await ctx.onRefresh();
    } finally {
      votingRef.current = false;
      setVoteBusy(null);
    }
  }, [ctx, productId]);

  const onDislike = useCallback(async () => {
    if (!ctx || !productId || votingRef.current) return;
    votingRef.current = true;
    setVoteBusy("dislike");
    try {
      await incrementProductDislike(productId);
      await ctx.onRefresh();
    } finally {
      votingRef.current = false;
      setVoteBusy(null);
    }
  }, [ctx, productId]);

  if (!ctx) return null;

  return (
    <div className="pdp-engagement-drawer__vote">
      <p className="pdp-engagement-drawer__hint">Tell others if you liked this dish.</p>
      <div className="pdp-engagement-drawer__vote-actions">
        <button
          type="button"
          className="pdp-engagement-drawer__vote-card"
          onClick={onLike}
          disabled={Boolean(voteBusy)}
          aria-busy={voteBusy === "like"}
        >
          <IconThumbUpStroke size={32} />
          <span className="pdp-engagement-drawer__vote-label">Like</span>
        </button>
        <button
          type="button"
          className="pdp-engagement-drawer__vote-card"
          onClick={onDislike}
          disabled={Boolean(voteBusy)}
          aria-busy={voteBusy === "dislike"}
        >
          <IconThumbDownStroke size={32} />
          <span className="pdp-engagement-drawer__vote-label">Not for me</span>
        </button>
      </div>
    </div>
  );
}

function EngagementDrawer({
  engagement,
  likes,
  dislikes,
}: {
  engagement: ProductEngagement | null;
  likes: number;
  dislikes: number;
}) {
  const ctx = useProductEngagementActions();
  const panel = ctx?.activePanel ?? null;
  const [shareHint, setShareHint] = useState<string | null>(null);
  const fav = ctx?.favorite ?? false;
  const setFavorite = ctx?.setFavorite;

  const scrollAbout = useCallback(() => {
    document.getElementById("pdp-about")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const onShare = useCallback(async () => {
    const url = window.location.href;
    const title = document.title;
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        setShareHint("Shared.");
        window.setTimeout(() => setShareHint(null), 2400);
        return;
      }
    } catch {
      /* cancelled */
    }
    try {
      await navigator.clipboard.writeText(url);
      setShareHint("Link copied to clipboard.");
      window.setTimeout(() => setShareHint(null), 3200);
    } catch {
      setShareHint("Could not copy link.");
      window.setTimeout(() => setShareHint(null), 3200);
    }
  }, []);

  if (!panel) return null;

  return (
    <div id="pdp-engagement-drawer" className="pdp-engagement-drawer" role="region">
      {panel === "votes" ? (
        <>
          <p className="pdp-engagement-drawer__counts" aria-live="polite">
            <strong>{likes.toLocaleString("en-IN")}</strong> likes ·{" "}
            <strong>{dislikes.toLocaleString("en-IN")}</strong> not-for-me
          </p>
          <VoteDrawerBody />
        </>
      ) : null}

      {panel === "favorite" ? (
        <div className="pdp-engagement-drawer__block">
          <p className="pdp-engagement-drawer__hint">
            {fav
              ? "This product is saved as a favorite on this browser."
              : "Save this product to your favorites on this device."}
          </p>
          <button
            type="button"
            className="pdp-engagement-drawer__primary"
            onClick={() => {
              if (!setFavorite) return;
              setFavorite(!fav);
            }}
          >
            {fav ? "Remove favorite" : "Add to favorites"}
          </button>
        </div>
      ) : null}

      {panel === "share" ? (
        <div className="pdp-engagement-drawer__block">
          <p className="pdp-engagement-drawer__hint">Share this product page with someone.</p>
          <button type="button" className="pdp-engagement-drawer__primary" onClick={onShare}>
            Copy link or share
          </button>
          {shareHint ? (
            <p className="pdp-engagement-drawer__status" role="status">
              {shareHint}
            </p>
          ) : null}
        </div>
      ) : null}

      {panel === "about" ? (
        <div className="pdp-engagement-drawer__block">
          <p className="pdp-engagement-drawer__hint">Vendor, SKU, category, and gallery notes are below.</p>
          <button type="button" className="pdp-engagement-drawer__primary" onClick={scrollAbout}>
            Jump to details
          </button>
        </div>
      ) : null}

      {panel === "flag" ? (
        <div className="pdp-engagement-drawer__block">
          <p className="pdp-engagement-drawer__hint">
            Flag listings that look incorrect, unsafe, or misleading. We review flags manually.
          </p>
          <p className="pdp-engagement-drawer__status" role="status">
            Thanks — we recorded this for review. (Demo: no ticket created.)
          </p>
        </div>
      ) : null}

      {panel === "comments" ? (
        <div className="pdp-engagement-drawer__comments">
          <EngagementCommentsList rows={engagement?.recentComments ?? []} />
          <p className="pdp-engagement-drawer__subhead">Add your feedback</p>
        </div>
      ) : null}
    </div>
  );
}

export function ProductEngagementPanel({ productId, engagement, loading, onRefresh }: Props) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<ProductEngagementPanelId | null>(null);

  const [fav, setFav] = useState(false);

  const togglePanel = useCallback((id: ProductEngagementPanelId) => {
    setActivePanel((cur) => (cur === id ? null : id));
  }, []);

  useEffect(() => {
    setActivePanel(null);
    setFav(readFavorite(productId));
  }, [productId]);

  const setFavorite = useCallback((next: boolean) => {
    setFav(next);
    writeFavorite(productId, next);
  }, [productId]);

  const likes = engagement?.likesCount ?? 0;
  const dislikes = engagement?.dislikesCount ?? 0;
  const comments = engagement?.commentsCount ?? 0;

  const seedValues = useMemo(
    () => ({
      input: { authorName: "", rating: "", commentText: "" },
    }),
    []
  );

  const actionsValue = useMemo(
    () => ({
      productId,
      onRefresh,
      activePanel,
      togglePanel,
      favorite: fav,
      setFavorite,
    }),
    [productId, onRefresh, activePanel, togglePanel, fav, setFavorite]
  );

  return (
    <section className="pdp-engagement-panel" aria-label="Views, ratings and comments">
      <h2 className="pdp-engagement-panel__title pdp-sr-only">Views, ratings, and comments</h2>
      {error ? (
        <p role="alert" className="pdp-engagement-panel__error">
          {error}
        </p>
      ) : null}
      <ProductEngagementActionsContext.Provider value={actionsValue}>
        <div className="pdp-engagement-toolbar-wrap">
          <PdpEngagementPills engagement={engagement} likes={likes} dislikes={dislikes} comments={comments} />
          <EngagementDrawer engagement={engagement} likes={likes} dislikes={dislikes} />
        </div>

        {activePanel === "comments" ? (
          <JsonForm
            form={productEngagementForm}
            seedValues={seedValues}
            resetKey={`${productId}:${engagement?.viewsCount ?? 0}:${engagement?.likesCount ?? 0}:${engagement?.dislikesCount ?? 0}:${engagement?.ratingsCount ?? 0}:${engagement?.commentsCount ?? 0}`}
            onSubmit={async (values) => {
              setError(null);
              const scoreRaw = String(getAtPath(values, "input.rating") ?? "").trim();
              const commentText = String(getAtPath(values, "input.commentText") ?? "").trim();
              const authorName = String(getAtPath(values, "input.authorName") ?? "").trim();
              if (!scoreRaw && !commentText) {
                setError("Add a rating or a comment before submitting.");
                return;
              }
              setSaving(true);
              try {
                if (scoreRaw) {
                  const score = Number(scoreRaw);
                  if (!Number.isFinite(score) || score < 1 || score > 5) {
                    throw new Error("Rating must be between 1 and 5.");
                  }
                  await addProductRating({
                    productId,
                    score,
                    authorName: authorName || undefined,
                    commentText: commentText || undefined,
                  });
                }
                if (commentText) {
                  await addProductComment({
                    productId,
                    commentText,
                    authorName: authorName || undefined,
                  });
                }
                await onRefresh();
              } catch (e) {
                setError(formatCommerceApiError(e));
              } finally {
                setSaving(false);
              }
            }}
          >
            <div className="webkitfx-form-actions">
              <button type="submit" disabled={loading || saving} aria-busy={saving}>
                {saving ? "Submitting..." : "Submit feedback"}
              </button>
            </div>
          </JsonForm>
        ) : null}
      </ProductEngagementActionsContext.Provider>
    </section>
  );
}
