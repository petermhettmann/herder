import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Image } from "@/components/ui/image";

// Check-in photos live in private storage, so each thumbnail gets a short-lived signed URL.
export default function PhotoStrip({ uris = [] }) {
  const [urls, setUrls] = useState([]);
  const key = uris.join("|");

  useEffect(() => {
    let cancelled = false;
    if (!uris.length) {
      setUrls([]);
      return () => {};
    }
    Promise.all(
      uris.map((uri) =>
        base44.integrations.Core.CreateFileSignedUrl({ file_uri: uri, expires_in: 900 })
          .then((response) => response.signed_url)
          .catch(() => null)
      )
    ).then((list) => {
      if (!cancelled) setUrls(list.filter(Boolean));
    });
    return () => {
      cancelled = true;
    };
  }, [key]);

  if (!urls.length) return null;

  return (
    <div className="flex gap-2">
      {urls.map((url) => (
        <a
          key={url}
          href={url}
          target="_blank"
          rel="noreferrer"
          className="block h-14 w-14 overflow-hidden rounded-md border border-border"
        >
          <Image src={url} alt="Check-in photo" className="h-14 w-14" fittingType="fill" />
        </a>
      ))}
    </div>
  );
}