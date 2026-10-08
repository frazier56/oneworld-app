import { useEffect } from "react";
export function SEOHead({ title, description }: { title?: string; description?: string; canonical?: string; keywords?: string; [k: string]: any }) {
  useEffect(() => {
    if (title) document.title = title;
    if (description) {
      let m = document.querySelector('meta[name="description"]');
      if (!m) { m = document.createElement("meta"); m.setAttribute("name", "description"); document.head.appendChild(m); }
      m.setAttribute("content", description);
    }
  }, [title, description]);
  return null;
}
export default SEOHead;
