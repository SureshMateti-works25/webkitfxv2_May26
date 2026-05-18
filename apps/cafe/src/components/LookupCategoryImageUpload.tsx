import { getAtPath } from "@webkitfxv2/core-engine";
import { useFormRenderer } from "@webkitfxv2/react-renderer";
import { useEffect, useId, useRef, useState } from "react";
import { mediaAssetUrl, uploadTenantMediaAsset } from "../lib/commerceApi.js";
import { LOOKUP_TILE_IMAGE_BINDING } from "../lib/lookupTileImage.js";

const ACCEPT_IMAGES = "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp";

function assertImageFile(file: File): void {
  if (!file.type.startsWith("image/")) throw new Error("Please choose an image file (JPEG, PNG, or WebP).");
}

function LookupCategoryImageUploadInner(props: {
  accessToken: string | null;
  canUpload: boolean;
  storageKey: string;
  onStorageKeyChange: (next: string) => void;
  inputId: string;
}) {
  const { accessToken, canUpload, storageKey, onStorageKeyChange, inputId } = props;
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const onPickFiles = async (list: FileList | null) => {
    setUploadError(null);
    const file = list?.[0];
    if (!file) return;
    if (!accessToken) {
      setUploadError("Sign in with a vendor or admin account, then try again.");
      return;
    }
    if (!canUpload) {
      setUploadError("Category images can be uploaded by vendor or admin accounts only.");
      return;
    }
    try {
      assertImageFile(file);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Invalid file.");
      return;
    }
    setUploading(true);
    try {
      const { storageKey: key } = await uploadTenantMediaAsset(accessToken, file);
      onStorageKeyChange(key);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const trimmed = storageKey.trim();
  const previewSrc = trimmed ? mediaAssetUrl(trimmed) : "";

  useEffect(() => {
    setUploadError(null);
    if (!trimmed && fileRef.current) fileRef.current.value = "";
  }, [trimmed]);

  return (
    <div className="lookup-category-image-upload">
      <input
        ref={fileRef}
        id={inputId}
        type="file"
        className="lookup-category-image-upload__file"
        accept={ACCEPT_IMAGES}
        aria-label="Choose category image file"
        disabled={uploading || !canUpload || !accessToken}
        onChange={(e) => void onPickFiles(e.target.files)}
      />
      <div className="lookup-category-image-upload__row">
        <button
          type="button"
          className="shell-btn shell-btn--outline lookup-category-image-upload__browse"
          disabled={uploading || !canUpload || !accessToken}
          onClick={() => fileRef.current?.click()}
        >
          {uploading ? "Uploading…" : "Choose image…"}
        </button>
        {trimmed ? (
          <button
            type="button"
            className="shell-btn shell-btn--outline lookup-category-image-upload__clear"
            disabled={uploading}
            onClick={() => {
              setUploadError(null);
              onStorageKeyChange("");
              if (fileRef.current) fileRef.current.value = "";
            }}
          >
            Remove image
          </button>
        ) : null}
      </div>
      {uploadError ? (
        <p className="lookup-admin-page__form-error" role="alert">
          {uploadError}
        </p>
      ) : null}
      {!previewSrc && !uploading ? (
        <p className="lookup-category-image-upload__empty" id={`${inputId}-hint`}>
          JPEG, PNG, or WebP. Preview appears after upload.
        </p>
      ) : null}
      {!accessToken ? (
        <p className="lookup-admin-page__hint" role="status">
          Sign in as admin or vendor to upload images.
        </p>
      ) : null}
      {previewSrc ? (
        <div className="lookup-category-image-upload__preview" aria-live="polite">
          <img
            key={previewSrc}
            src={previewSrc}
            alt="Uploaded tile preview"
            width={120}
            height={120}
            loading="lazy"
            decoding="async"
          />
        </div>
      ) : null}
    </div>
  );
}

/** Use inside `JsonForm` so uploads write `entry.storefrontImageKey`. */
export function LookupCategoryImageFormBinding(props: { accessToken: string | null; canUpload: boolean }) {
  const { accessToken, canUpload } = props;
  const { setBinding, values } = useFormRenderer();
  const inputId = useId();
  const storageKey = String(getAtPath(values, LOOKUP_TILE_IMAGE_BINDING) ?? "").trim();

  return (
    <LookupCategoryImageUploadInner
      accessToken={accessToken}
      canUpload={canUpload}
      storageKey={storageKey}
      onStorageKeyChange={(next) => setBinding(LOOKUP_TILE_IMAGE_BINDING, next)}
      inputId={inputId}
    />
  );
}

/** Standalone (e.g. edit row) — drives local string state for the storage key. */
export function LookupCategoryImageUploadControl(props: {
  accessToken: string | null;
  canUpload: boolean;
  storageKey: string;
  onStorageKeyChange: (next: string) => void;
}) {
  const inputId = useId();
  return <LookupCategoryImageUploadInner {...props} inputId={inputId} />;
}
