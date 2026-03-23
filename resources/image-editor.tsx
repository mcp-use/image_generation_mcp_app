import { McpUseProvider, useWidget, useFiles, type WidgetMetadata } from "mcp-use/react";
import React from "react";
import { z } from "zod";

import "./image-editor.css";

const editorPropsSchema = z.object({
  title: z.string().optional(),
});

export const widgetMetadata: WidgetMetadata = {
  description:
    "Upload an image and apply AI-powered transformations with a text prompt.",
  props: editorPropsSchema as any,
  exposeAsTool: false,
  metadata: {
    csp: {
      connectDomains: [],
      resourceDomains: [],
      scriptDirectives: ["'unsafe-eval'"],
    },
    prefersBorder: true,
    autoResize: true,
    widgetDescription:
      "Drop or browse for an image, describe the edit, and transform it.",
  },
  annotations: {
    readOnlyHint: false,
  },
};

type EditorProps = z.infer<typeof editorPropsSchema>;
type UnknownRecord = Record<string, unknown>;

const UploadIcon: React.FC = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

const ImageEditorWidget: React.FC = () => {
  const { props, theme, callTool } =
    useWidget<EditorProps, UnknownRecord, UnknownRecord>();
  const { upload, isSupported: filesSupported } = useFiles();

  const title = props?.title ?? "Upload & Transform Image";

  const [uploadedImage, setUploadedImage] = React.useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = React.useState<string | null>(null);
  const [editPrompt, setEditPrompt] = React.useState("");
  const [isTransforming, setIsTransforming] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [isDragOver, setIsDragOver] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const readFileAsDataUrl = React.useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });
  }, []);

  const handleFileSelected = React.useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) {
        setError("Please select an image file (PNG, JPEG, WebP, etc.)");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setError("Image must be under 10 MB");
        return;
      }
      setError(null);
      try {
        if (filesSupported) {
          await upload(file, { modelVisible: true });
        }
        const dataUrl = await readFileAsDataUrl(file);
        setUploadedImage(dataUrl);
        setUploadedFileName(file.name);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load image");
      }
    },
    [filesSupported, upload, readFileAsDataUrl]
  );

  const handleDrop = React.useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFileSelected(file);
    },
    [handleFileSelected]
  );

  const handleTransform = React.useCallback(async () => {
    if (!uploadedImage || !editPrompt.trim()) return;
    setIsTransforming(true);
    setError(null);
    try {
      await callTool("transform_image", {
        prompt: editPrompt.trim(),
        encoded_image: uploadedImage,
        image_count: 1,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transformation failed");
    } finally {
      setIsTransforming(false);
    }
  }, [uploadedImage, editPrompt, callTool]);

  return (
    <McpUseProvider autoSize>
      <section
        className={`editor-shell ${theme === "dark" ? "theme-dark" : "theme-light"}`}
      >
        <header className="editor-header">
          <h2>{title}</h2>
          <p className="editor-subtitle">
            Upload an image, describe the transformation, and let AI edit it.
          </p>
        </header>

        {!uploadedImage ? (
          <div
            className={`editor-dropzone ${isDragOver ? "is-dragover" : ""}`}
            onDrop={handleDrop}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp,image/bmp,image/tiff"
              style={{ display: "none" }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileSelected(file);
              }}
            />
            <div className="editor-dropzone-inner">
              <div className="editor-dropzone-icon">
                <UploadIcon />
              </div>
              <p className="editor-dropzone-label">
                Drop an image here, or click to browse
              </p>
              <p className="editor-dropzone-hint">
                PNG, JPEG, WebP, GIF, BMP, TIFF — max 10 MB
              </p>
            </div>
          </div>
        ) : (
          <div className="editor-preview-card">
            <img
              className="editor-preview-image"
              src={uploadedImage}
              alt={uploadedFileName ?? "Uploaded image"}
            />
            <div className="editor-preview-footer">
              <p className="editor-preview-name">
                {uploadedFileName ?? "Uploaded image"}
              </p>
              <button
                type="button"
                className="editor-preview-change"
                onClick={() => {
                  setUploadedImage(null);
                  setUploadedFileName(null);
                  setError(null);
                }}
              >
                Replace
              </button>
            </div>
          </div>
        )}

        <div className="editor-form">
          <div className="editor-field">
            <label className="editor-label" htmlFor="editor-prompt">
              Transformation prompt
            </label>
            <textarea
              id="editor-prompt"
              className="editor-textarea"
              placeholder="e.g. Remove the background, make it a watercolor painting..."
              value={editPrompt}
              onChange={(e) => setEditPrompt(e.target.value)}
              rows={3}
              disabled={isTransforming}
            />
          </div>

          <div className="editor-actions">
            <button
              type="button"
              className="editor-btn editor-btn-primary"
              disabled={!uploadedImage || !editPrompt.trim() || isTransforming}
              onClick={handleTransform}
            >
              {isTransforming ? (
                <>
                  <span className="editor-spinner" />
                  Transforming...
                </>
              ) : (
                "Transform"
              )}
            </button>
          </div>
        </div>

        {error ? <div className="editor-error">{error}</div> : null}
      </section>
    </McpUseProvider>
  );
};

export default ImageEditorWidget;
