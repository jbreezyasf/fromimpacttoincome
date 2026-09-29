import { useEffect,useState } from 'react';
import { useParams } from 'wouter';
import Layout from '@/components/Layout';
import { supabase } from '@/lib/supabase';
import { Episode,youtubeId,setPageMeta,validWebUrl } from '@/lib/podcast';
export default function PodcastEpisode(){
 const {slug}=useParams<{slug:string}>(); const [episode,setEpisode]=useState<Episode|null>(null);
 useEffect(()=>{supabase.from('podcast_episodes').select('*').eq('slug',slug).eq('status','published').single().then(({data})=>setEpisode(data));},[slug]);
 useEffect(()=>{if(episode) setPageMeta(`${episode.title} | From Impact to Income`,episode.meta_description||episode.description);},[episode]);
 if(!episode) return <Layout><main className="container pt-36 min-h-screen"><p>Episode unavailable.</p></main></Layout>;
 const id=youtubeId(episode.youtube_url);
 return <Layout><main className="pt-32 pb-24" style={{background:'var(--brand-cream)'}}><article className="container max-w-4xl"><p className="font-mono-label" style={{color:'var(--brand-orange)'}}>FROM IMPACT TO INCOME · {episode.guest_name}</p><h1 className="font-display text-4xl md:text-6xl my-6" style={{color:'var(--brand-green)'}}>{episode.title}</h1><p className="text-xl mb-10">{episode.description}</p>{id&&<div className="aspect-video mb-12"><iframe className="w-full h-full" src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}`} title={`${episode.title} video`} allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowFullScreen loading="lazy" /></div>}{!id&&episode.media_url&&episode.media_kind==='video'&&<video controls className="w-full mb-12" src={episode.media_url} />}{!id&&episode.media_url&&episode.media_kind==='audio'&&<audio controls className="w-full mb-12" src={episode.media_url} />}{episode.article&&<div className="prose prose-lg max-w-none whitespace-pre-wrap leading-relaxed">{episode.article}</div>}{episode.guest_bio&&<section className="mt-16 border-t pt-8"><h2 className="font-display text-3xl mb-3">Meet {episode.guest_name}</h2><p>{episode.guest_bio}</p><ul className="mt-4">{episode.guest_links?.filter(l=>validWebUrl(l.url)).map((l,i)=><li key={i}><a href={l.url} rel="noopener noreferrer" target="_blank" className="underline">{l.label}</a></li>)}</ul></section>}{episode.transcript&&<details className="mt-12 border-t pt-6"><summary className="cursor-pointer font-semibold">Read transcript</summary><p className="whitespace-pre-wrap mt-6">{episode.transcript}</p></details>}</article></main></Layout>;
}
