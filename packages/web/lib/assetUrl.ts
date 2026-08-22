import { useEffect, useState } from "react";
import { apiBase } from "./api";

export function useAssetRevision(): number {
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const refresh = () => setRevision((value) => value + 1);
    window.addEventListener("pz-dashboard-assets-ready", refresh);
    return () => window.removeEventListener("pz-dashboard-assets-ready", refresh);
  }, []);
  return revision;
}

export function useAssetUrl(path?: string): string | null {
  const [url, setUrl] = useState<string | null>(null);
  const revision = useAssetRevision();

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | undefined;
    setUrl(null);
    if (!path) return;

    void fetch(`${apiBase()}${path}`)
      .then((response) => {
        if (!response.ok) throw new Error(`Asset request failed: ${response.status}`);
        return response.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path, revision]);

  return url;
}
