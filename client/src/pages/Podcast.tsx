import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import Layout from '@/components/Layout';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { Episode, setPageMeta } from '@/lib/podcast';
export default function Podcast() {
 const [episodes,setEpisodes]=useState<Episode[]>([]);
 useEffect(()=>{setPageMeta('From Impact to Income Podcast | Creator stories with Juanita Brazziel','Conversations with creators about the products and services they built, the impact they make, and how they earn income.'); if(isSupabaseConfigured) supabase.from('podcast_episodes').select('*').eq('status','published').order('published_at',{ascending:false}).then(({data})=>setEpisodes(data||[]));},[]);
 return <Layout><main className="pt-32 pb-24 min-h-screen" style={{background:'var(--brand-cream)'}}><div className="container"><span className="font-mono-label" style={{color:'var(--brand-orange)'}}>THE PODCAST</span><h1 className="font-display text-5xl md:text-7xl font-semibold max-w-4xl mt-5" style={{color:'var(--brand-green)'}}>From Impact to Income</h1><p className="text-xl max-w-2xl mt-6 mb-16" style={{color:'var(--brand-ink-muted)'}}>The creative process behind the apps, products, and services changing communities—and the real ways their creators make them sustainable.</p><div className="grid md:grid-cols-2 gap-6">{episodes.map(e=><Link key={e.slug} href={'/podcast/'+e.slug}><article className="p-8 border rounded-md h-full hover:shadow-lg transition-shadow bg-white"><span className="font-mono-label" style={{color:'var(--brand-orange)'}}>{e.guest_name || 'Solo episode'}</span><h2 className="font-display text-3xl my-4" style={{color:'var(--brand-green)'}}>{e.title}</h2><p>{e.description}</p><span className="block mt-6 underline">Watch, listen & read →</span></article></Link>)}</div>{episodes.length===0&&<p className="border-t pt-10">Episodes are on their way. Come back for the first conversation.</p>}</div></main></Layout>;
}
