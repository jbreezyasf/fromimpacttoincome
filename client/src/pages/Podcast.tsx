import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import Layout from '@/components/Layout';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { Episode, setPageMeta } from '@/lib/podcast';

export default function Podcast() {
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  useEffect(() => {
    setPageMeta('From Impact to Income Podcast | Creator stories with Juanita Brazziel', 'Conversations with creators about the products and services they built, the impact they make, and how they earn income.');
    if (isSupabaseConfigured) supabase.from('podcast_episodes').select('*').eq('status', 'published').order('published_at', { ascending: false }).then(({ data }) => setEpisodes(data || []));
  }, []);

  return <Layout><main className="min-h-screen pb-24" style={{ background: 'var(--brand-cream)' }}>
    <section className="pt-28 pb-16 md:pt-32 md:pb-20" style={{ background: '#101511', color: '#fffaf0' }}>
      <div className="container grid md:grid-cols-[minmax(0,1fr)_minmax(280px,480px)] items-center gap-8 md:gap-12">
        <div>
          <span className="font-mono-label" style={{ color: '#f8cf56' }}>THE PODCAST WITH JUANITA BRAZZIEL</span>
          <h1 className="font-display text-4xl md:text-6xl font-semibold mt-5 max-w-xl">The story behind what you built.</h1>
          <p className="text-lg max-w-xl mt-6 leading-relaxed" style={{ color: '#f4eee3' }}>Honest conversations with creators about the apps, products, and services changing communities—and the real ways they make that work sustainable.</p>
          <div className="mt-10 max-w-md">
            <label className="block text-sm font-semibold mb-3" htmlFor="podcast-intro">Listen to the show intro · 18 seconds</label>
            <audio id="podcast-intro" controls preload="none" className="w-full" src="/from-impact-to-income-intro.mp3">Your browser does not support audio playback. <a href="/from-impact-to-income-intro.mp3">Download the intro</a>.</audio>
            <details className="text-sm mt-3" style={{ color: '#e9e1d5' }}><summary className="cursor-pointer">Read intro lyrics</summary><p className="mt-2">From impact to income. Turn what you know into what you own. Build it. Brand it. Make it grow. Your story has value, now let it show. FromImpactToIncome.com. Turn your impact into income.</p></details>
          </div>
        </div>
        <img src="/from-impact-to-income-logo.png" alt="From Impact to Income Podcast" width="1254" height="1254" className="w-full max-w-[480px] mx-auto" />
      </div>
    </section>
    <section className="container pt-16" aria-labelledby="episodes-heading">
      <span className="font-mono-label" style={{ color: 'var(--brand-orange)' }}>WATCH · LISTEN · READ</span>
      <h2 id="episodes-heading" className="font-display text-4xl mt-3 mb-10" style={{ color: 'var(--brand-green)' }}>Latest conversations</h2>
      <div className="grid md:grid-cols-2 gap-6">{episodes.map(e => <Link key={e.slug} href={'/podcast/' + e.slug}><article className="p-8 border rounded-md h-full hover:shadow-lg transition-shadow bg-white"><span className="font-mono-label" style={{ color: 'var(--brand-orange)' }}>{e.guest_name || 'Solo episode'}</span><h3 className="font-display text-3xl my-4" style={{ color: 'var(--brand-green)' }}>{e.title}</h3><p>{e.description}</p><span className="block mt-6 underline">Watch, listen & read →</span></article></Link>)}</div>
      {episodes.length === 0 && <p className="border-t pt-10">Episodes are on their way. Come back for the first conversation.</p>}
    </section>
  </main></Layout>;
}
