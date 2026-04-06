import { useEffect, useMemo, useRef } from 'react';
import { usePosts } from '../hooks/usePosts';
import PageShell from '../components/layout/PageShell';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';

function InstagramEmbed({ url }) {
  const ref = useRef(null);

  useEffect(() => {
    if (window.instgrm) {
      window.instgrm.Embeds.process(ref.current);
    }
  }, [url]);

  return (
    <div ref={ref} className="flex justify-center">
      <blockquote
        className="instagram-media"
        data-instgrm-captioned
        data-instgrm-permalink={url}
        style={{
          maxWidth: '540px',
          width: '100%',
          margin: '0',
        }}
      />
    </div>
  );
}

export default function GalleryPage() {
  const { data: rawPosts, loading } = usePosts();
  const posts = useMemo(() => [...rawPosts].sort((a, b) => (a.order ?? 999) - (b.order ?? 999)), [rawPosts]);

  useEffect(() => {
    if (!document.getElementById('instagram-embed-script')) {
      const script = document.createElement('script');
      script.id = 'instagram-embed-script';
      script.src = 'https://www.instagram.com/embed.js';
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  useEffect(() => {
    if (posts.length > 0 && window.instgrm) {
      window.instgrm.Embeds.process();
    }
  }, [posts]);

  if (loading) return <PageShell><LoadingSpinner /></PageShell>;

  return (
    <PageShell title="Galeria">
      {posts.length === 0 ? (
        <EmptyState message="No hay publicaciones todavia" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {posts.map(post => (
            <InstagramEmbed key={post.id} url={post.url} />
          ))}
        </div>
      )}
    </PageShell>
  );
}
